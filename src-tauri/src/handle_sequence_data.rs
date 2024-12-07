use std::io::{Read, Result as IoResult};
use std::path::PathBuf;
use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, Runtime, Window};
use tauri_plugin_shell::process::CommandEvent;
use tauri_plugin_shell::ShellExt;
use uuid::Uuid;

use crate::poleshift_common::utils::{
    emit_progress, FileMeta, FilesResponse, PoleshiftError, StandardResponse,
};

#[derive(Debug, Serialize)]
pub struct KrakenReport {
    pub report_path: String,
    pub report_content: String,
    pub status: String,
}

struct ProgressReader<Inner: Read, RT: Runtime> {
    inner: Inner,
    window: Window<RT>,
    total_size: u64,
    bytes_read: u64,
    last_emitted_percent: u8,
}

impl<Inner: Read, RT: Runtime> ProgressReader<Inner, RT> {
    fn new(inner: Inner, window: Window<RT>, total_size: u64) -> Self {
        Self {
            inner,
            window,
            total_size,
            bytes_read: 0,
            last_emitted_percent: 0,
        }
    }
}

impl<Inner: Read, RT: Runtime> Read for ProgressReader<Inner, RT> {
    fn read(&mut self, buf: &mut [u8]) -> IoResult<usize> {
        let n = self.inner.read(buf)?;
        if n == 0 {
            return Ok(0);
        }

        self.bytes_read += n as u64;
        if self.total_size > 0 {
            let percent = ((self.bytes_read as f64 / self.total_size as f64) * 100.0).floor() as u8;
            // Emit progress every 5% increments as an example
            if percent >= self.last_emitted_percent + 5 && percent <= 95 {
                let msg = format!("Extracting database... {}%", percent);
                if let Err(e) = crate::poleshift_common::utils::emit_progress(&self.window, percent, &msg) {
                    println!("Failed to emit progress: {}", e);
                }
                self.last_emitted_percent = percent;
            }
        }

        Ok(n)
    }
}

#[tauri::command]
pub async fn handle_sequence_data<R: Runtime>(
    app_handle: AppHandle<R>,
    file_paths: Vec<String>,
) -> Result<StandardResponse<KrakenReport>, PoleshiftError> {
    println!("handle_sequence_data called with file_paths: {:?}", file_paths);

    if file_paths.is_empty() {
        println!("No files provided.");
        return Err(PoleshiftError::NoFiles);
    }

    let window = app_handle
        .get_window("main")
        .ok_or_else(|| {
            println!("Window 'main' not found.");
            PoleshiftError::WindowNotFound
        })?;

    emit_progress(&window, 0, "Initializing...")?;
    println!("Progress emitted: 0%, 'Initializing...'");

    let base_dir = app_handle
        .path()
        .resource_dir()
        .map_err(|e| {
            println!("Failed to resolve base directory: {}", e);
            PoleshiftError::PathResolution(e.to_string())
        })?;

    let resource_dir = app_handle
        .path()
        .resource_dir()
        .map_err(|e| {
            println!("Failed to resolve resource directory: {}", e);
            PoleshiftError::PathResolution(e.to_string())
        })?
        .join("resources");

    println!("Resource directory resolved: {:?}", resource_dir);

    // Define paths for database files
    let classifier_binary = base_dir.join("classifyExact");
    let db_file = resource_dir.join("database.kdb");
    let idx_file = resource_dir.join("database.idx");
    let taxdb_file = resource_dir.join("taxDB");

    // Verify all required files exist
    let required_files = [
        (&classifier_binary, "Classifier binary"),
        (&db_file, "Database file"),
        (&idx_file, "Index file"),
        (&taxdb_file, "Taxonomy database"),
    ];

    for (path, desc) in required_files.iter() {
        if !path.exists() {
            println!("{} not found at: {:?}", desc, path);
            return Err(PoleshiftError::DatabaseNotFound(
                format!("{} not found: {}", desc, path.to_string_lossy())
            ));
        }
    }

    emit_progress(&window, 40, "Database files ready")?;

    let data_dir = app_handle.path().temp_dir().map_err(|e| {
        println!("Failed to resolve app local data directory: {}", e);
        PoleshiftError::PathResolution(e.to_string())
    })?;

    let report_filename = format!("kraken_report_{}.txt", Uuid::new_v4());
    let report_file_path = data_dir.join(&report_filename);

    emit_progress(&window, 50, "Running KrakenUniq...")?;

    let window_clone = window.clone();
    println!("Spawning sidecar 'krakenuniq'...");

    let sidecar_command = app_handle.shell().sidecar("krakenuniq").map_err(|e| {
        println!("Error spawning sidecar: {}", e);
        PoleshiftError::SidecarSpawnError(e.to_string())
    })?;

    // Build command with updated paths
    let mut sidecar_command = sidecar_command
        .arg("--classifier-binary")
        .arg(classifier_binary.to_string_lossy().to_string())
        .arg("--db-file")
        .arg(db_file.to_string_lossy().to_string())
        .arg("--idx-file")
        .arg(idx_file.to_string_lossy().to_string())
        .arg("--taxdb-file")
        .arg(taxdb_file.to_string_lossy().to_string())
        .arg("--report-file")
        .arg(report_file_path.to_string_lossy().to_string())
        .arg("--exact")
        .arg("--preload")
        .arg("--output")
        .arg("off")
        .arg("--threads")
        .arg("16");

    // Add input files
    for path in &file_paths {
        println!("Adding input file to command: {:?}", path);
        sidecar_command = sidecar_command.arg(path);
    }

    let (mut rx, mut _child) = sidecar_command.spawn().map_err(|e| {
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