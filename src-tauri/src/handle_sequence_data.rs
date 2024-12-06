use std::path::PathBuf;
use futures_util::TryFutureExt;
use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, Runtime};
use tauri::path::BaseDirectory;
use tauri_plugin_shell::process::CommandEvent;
use tauri_plugin_shell::ShellExt;
use tokio::fs;
use tokio::sync::oneshot;
use uuid::Uuid;
use crate::poleshift_common::utils::{emit_progress, FileMeta, FilesResponse, PoleshiftError, StandardResponse};

#[derive(Debug, Serialize)]
pub struct KrakenReport {
    pub report_path: String,
    pub report_content: String,
    pub status: String,
    // If you want a dedicated processed_path field, you can alias or reuse report_path
    // pub processed_path: String,
}

#[tauri::command]
pub async fn handle_sequence_data<R: Runtime>(
    app_handle: AppHandle<R>,
    file_paths: Vec<String>,
) -> Result<StandardResponse<KrakenReport>, PoleshiftError> {
    if file_paths.is_empty() {
        return Err(PoleshiftError::NoFiles);
    }

    let window = app_handle
        .get_window("main")
        .ok_or(PoleshiftError::WindowNotFound)?;

    emit_progress(&window, 0, "Initializing...")?;

    // Resolve kudb path, check existence, etc. (unchanged logic)
    let kudb_path = app_handle
        .path()
        .resolve("kudb", BaseDirectory::Desktop)
        .map_err(|e| PoleshiftError::PathResolution(e.to_string()))?;
    if !kudb_path.exists() {
        return Err(PoleshiftError::DatabaseNotFound(
            kudb_path.to_string_lossy().to_string(),
        ));
    }

    let desktop_dir = app_handle
        .path()
        .desktop_dir()
        .map_err(|e| PoleshiftError::PathResolution(e.to_string()))?;

    let report_filename = format!("kraken_report_{}.txt", Uuid::new_v4());
    let report_file_path = desktop_dir.join(&report_filename);

    // Temporary directory creation, file copying (unchanged logic)
    let temp_dir = app_handle
        .path()
        .temp_dir()
        .map_err(|e| PoleshiftError::PathResolution(e.to_string()))?;
    let input_temp_dir = temp_dir.join(format!("input_files_{}", Uuid::new_v4()));
    fs::create_dir(&input_temp_dir).await?;

    let mut temp_file_paths = Vec::new();
    for original_path in &file_paths {
        let original_path_buf = PathBuf::from(original_path);
        let file_name = original_path_buf.file_name().ok_or_else(|| {
            PoleshiftError::Other(format!("Invalid file path: {}", original_path))
        })?;
        let temp_file_path = input_temp_dir.join(file_name);
        fs::copy(&original_path_buf, &temp_file_path).await?;
        temp_file_paths.push(temp_file_path);
    }

    emit_progress(&window, 20, "Running KrakenUniq...")?;

    let window_clone = window.clone();
    let sidecar_command = app_handle
        .shell()
        .sidecar("krakenuniq")
        .map_err(|e| PoleshiftError::SidecarSpawnError(e.to_string()))?;

    let mut sidecar_command = sidecar_command
        .arg("--db")
        .arg(&kudb_path)
        .arg("--report-file")
        .arg(&report_file_path)
        .arg("--threads")
        .arg("8");

    for path in &temp_file_paths {
        sidecar_command = sidecar_command.arg(path.to_string_lossy().to_string());
    }

    let (mut rx, mut _child) = sidecar_command.spawn().map_err(|e| PoleshiftError::SidecarSpawnError(e.to_string()))?;

    let (tx, rx_termination) = oneshot::channel();

    tauri::async_runtime::spawn(async move {
        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(line_bytes) => {
                    let line = String::from_utf8_lossy(&line_bytes);
                    let _ = window_clone.emit("message", Some(format!("stdout: {}", line)));
                }
                CommandEvent::Stderr(line_bytes) => {
                    let line = String::from_utf8_lossy(&line_bytes);
                    let _ = window_clone.emit("message", Some(format!("stderr: {}", line)));
                }
                CommandEvent::Terminated(payload) => {
                    let _ = window_clone.emit("message", Some(format!("Sidecar terminated: {:?}", payload.code)));
                    let _ = tx.send(());
                    break;
                }
                CommandEvent::Error(err_msg) => {
                    let _ = window_clone.emit("error", Some(format!("Sidecar error: {}", err_msg)));
                }
                _ => {}
            }
        }
    });

    rx_termination.await.map_err(|e| PoleshiftError::Other(e.to_string()))?;

    emit_progress(&window, 80, "Processing results...")?;

    if !report_file_path.exists() {
        return Err(PoleshiftError::ReportError(format!(
            "Report file not found: {}",
            report_file_path.to_string_lossy()
        )));
    }

    let report_content = fs::read_to_string(&report_file_path).await
        .map_err(|e| PoleshiftError::IoError(e.to_string()))?;

    emit_progress(&window, 100, "Complete")?;

    // Clean up temporary input directory
    let _ = fs::remove_dir_all(&input_temp_dir);

    // Build raw and processed file lists
    let raw_files: Vec<FileMeta> = file_paths.iter().map(|f| FileMeta {
        name: PathBuf::from(f)
            .file_name()
            .unwrap()
            .to_string_lossy()
            .into_owned(),
        file_type: "application/octet-stream".to_string(),
        path: f.clone(),
    }).collect();

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
