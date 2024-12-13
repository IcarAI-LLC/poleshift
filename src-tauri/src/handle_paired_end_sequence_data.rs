use crate::poleshift_common::types::{
    FileMeta, FilesResponse, KrakenConfig, PoleshiftError, StandardResponse,
};
use crate::poleshift_common::utils::emit_progress;
use std::path::PathBuf;
use std::vec;
use futures_util::TryFutureExt;
use tauri::{AppHandle, Emitter, Manager, Runtime};
use tauri_plugin_shell::process::CommandEvent;
use tauri_plugin_shell::ShellExt;
use tokio::fs;
use uuid::Uuid;
use crate::handle_sequence_data::KrakenReport;

// Flag Constants
const DATABASE_FLAG: &str = "-d";
const INDEX_FLAG: &str = "-i";
const TAXDB_FLAG: &str = "-a";
const THREADS_FLAG: &str = "-t";
const PRELOAD_FLAG: &str = "-M";
const REPORT_FILE_FLAG: &str = "-r";
/*
const QUICK_FLAG: &str = "-q";
const UNCLASSIFIED_OUT_FLAG: &str = "-U";
const CLASSIFIED_OUT_FLAG: &str = "-C";
const MIN_HITS_FLAG: &str = "-m";
const OUTFILE_FLAG: &str = "-o";
const ONLY_CLASSIFIED_OUTPUT_FLAG: &str = "-c";
const PRELOAD_SIZE_FLAG: &str = "-x";
const PRINT_SEQUENCE_FLAG: &str = "-s";
const HLL_PRECISION_FLAG: &str = "-p";
*/
#[tauri::command]
pub async fn handle_paired_end_sequence_data<R: Runtime>(
    app_handle: AppHandle<R>,
    file_paths: Vec<String>,
) -> Result<StandardResponse<KrakenReport>, PoleshiftError> {
    let platform = tauri_plugin_os::platform();
    if platform.eq_ignore_ascii_case("WINDOWS") {
        println!("Operation not supported on Windows OS.");
        return Err(PoleshiftError::UnsupportedOS(
            "Windows OS is not supported yet.".into(),
        ));
    }

    println!("handle_sequence_data called with file_paths: {:?}", file_paths);

    if file_paths.is_empty() {
        println!("No files provided.");
        return Err(PoleshiftError::NoFiles);
    }

    if file_paths.len() > 2 {
        println!("Too many files provided for paired-end processing.");
        return Err(PoleshiftError::InvalidInput("Only two input files are allowed for paired-end processing.".into()));
    }

    let window = app_handle.get_window("main").ok_or_else(|| {
        println!("Window 'main' not found.");
        PoleshiftError::WindowNotFound
    })?;

    emit_progress(&window, 0, "Initializing...")?;

    let resource_dir = app_handle
        .path()
        .resource_dir()
        .map_err(|e| PoleshiftError::PathResolution(e.to_string()))?
        .join("resources");

    let data_dir = app_handle.path().temp_dir().map_err(|e| PoleshiftError::PathResolution(e.to_string()))?;

    let report_filename = format!("kraken_report_{}.txt", Uuid::new_v4());
    let report_file_path = data_dir.join(&report_filename);

    emit_progress(&window, 20, "Filesystem initialized...")?;
    let window_clone = window.clone();

    let merged_file_path = if file_paths.len() == 2 {
        let merged_filename = format!("merged_{}.fq", Uuid::new_v4());
        let merged_path = data_dir.join(&merged_filename);

        println!("Merging paired-end files into: {}", merged_path.display());
        let mut merged_file = fs::File::create(&merged_path).map_err(|e| PoleshiftError::IoError(e.to_string()))?;

        for path in &file_paths {
            let content = fs::read_to_string(path).map_err(|e| PoleshiftError::IoError(e.to_string()))?;
            merged_file.write_all(content.as_bytes()).map_err(|e| PoleshiftError::IoError(e.to_string()))?;
        }

        Some(merged_path)
    } else {
        None
    };

    let input_files = if let Some(merged_path) = merged_file_path {
        vec![merged_path.to_string_lossy().to_string()]
    } else {
        file_paths.clone()
    };

    let config = KrakenConfig::hardcoded(resource_dir, report_file_path.clone(), input_files);
    let sidecar_command = app_handle.shell().sidecar("classifyExact").map_err(|e| {
        println!("Error spawning sidecar: {}", e);
        PoleshiftError::SidecarSpawnError(e.to_string())
    })?;

    // Build command with updated paths
    let mut sidecar_command = sidecar_command
        .arg(DATABASE_FLAG)
        .arg(config.db_file)
        .arg(INDEX_FLAG)
        .arg(config.idx_file)
        .arg(TAXDB_FLAG)
        .arg(config.taxdb_file)
        .arg(REPORT_FILE_FLAG)
        .arg(config.report_file)
        .arg(PRELOAD_FLAG)
        .arg(THREADS_FLAG)
        .arg(config.threads.to_string());

    // Add input files
    for path in &config.input_files {
        println!("Adding input file to command: {:?}", path);
        sidecar_command = sidecar_command.arg(path);
    }

    let (mut rx, _child) = sidecar_command.spawn().map_err(|e| {
        println!("Error spawning sidecar command: {}", e);
        PoleshiftError::SidecarSpawnError(e.to_string())
    })?;

    let (tx, rx_termination) = tokio::sync::oneshot::channel();
    println!("Sidecar command spawned, waiting for output...");

    tauri::async_runtime::spawn(async move {
        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(line_bytes) => {
                    let line = String::from_utf8_lossy(&line_bytes);
                    println!("Sidecar STDOUT: {}", line);
                    let _ = window_clone.emit("message", Some(format!("stdout: {}", line)));
                }
                CommandEvent::Stderr(line_bytes) => {
                    let line = String::from_utf8_lossy(&line_bytes);
                    println!("Sidecar STDERR: {}", line);
                    let _ = window_clone.emit("message", Some(format!("stderr: {}", line)));
                }
                CommandEvent::Terminated(payload) => {
                    println!("Sidecar terminated with code: {:?}", payload.code);
                    let _ = window_clone.emit(
                        "message",
                        Some(format!("Sidecar terminated: {:?}", payload.code)),
                    );
                    let _ = tx.send(());
                    break;
                }
                CommandEvent::Error(err_msg) => {
                    println!("Sidecar error event: {}", err_msg);
                    let _ = window_clone.emit("error", Some(format!("Sidecar error: {}", err_msg)));
                }
                other => {
                    println!("Sidecar unknown event: {:?}", other);
                }
            }
        }
    });

    rx_termination.await.map_err(|e| {
        println!("Error waiting for sidecar termination: {}", e);
        PoleshiftError::Other(e.to_string())
    })?;

    emit_progress(&window, 80, "Processing results...")?;

    if !report_file_path.exists() {
        println!(
            "Report file not found at expected location: {}",
            report_file_path.display()
        );
        return Err(PoleshiftError::ReportError(format!(
            "Report file not found: {}",
            report_file_path.to_string_lossy()
        )));
    }

    let report_content = tokio::fs::read_to_string(&report_file_path)
        .await
        .map_err(|e| {
            println!(
                "Failed to read report file '{}': {}",
                report_file_path.display(),
                e
            );
            PoleshiftError::IoError(e.to_string())
        })?;
    emit_progress(&window, 100, "Complete")?;

    let raw_files: Vec<FileMeta> = file_paths
        .iter()
        .map(|f| {
            let name = PathBuf::from(f)
                .file_name()
                .map(|n| n.to_string_lossy().into_owned())
                .unwrap_or_else(|| "unknown".to_string());
            FileMeta {
                name,
                file_type: "application/octet-stream".to_string(),
                path: f.clone(),
            }
        })
        .collect();

    let processed_file = FileMeta {
        name: report_filename.clone(),
        file_type: "text/plain".to_string(),
        path: report_file_path.to_string_lossy().to_string(),
    };

    let kraken_report = KrakenReport {
        report_path: processed_file.path.clone(),
        report_content,
        status: "Success".into(),
    };

    Ok(StandardResponse {
        status: "Success".to_string(),
        report: kraken_report,
        files: FilesResponse {
            raw: raw_files,
            processed: vec![processed_file],
        },
    })
}
