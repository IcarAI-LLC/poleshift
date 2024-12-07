use std::io::{Read, Result as IoResult};
use std::path::PathBuf;
use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, Runtime, Window};
use tauri_plugin_shell::process::CommandEvent;
use tauri_plugin_shell::ShellExt;
use uuid::Uuid;

use std::fs::File;
use flate2::read::GzDecoder;
use tar::Archive;

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

    let resource_dir = app_handle
        .path()
        .resource_dir()
        .map_err(|e| {
            println!("Failed to resolve resource directory: {}", e);
            PoleshiftError::PathResolution(e.to_string())
        })?
        .join("resources/krakenuniq-database");

    println!("Resource directory resolved: {:?}", resource_dir);

    let kudb_dir = resource_dir.join("kudb");
    let kudb_tar_gz = resource_dir.join("kudb.tar.gz");

    println!("kudb_dir: {:?}", kudb_dir);
    println!("kudb_tar_gz: {:?}", kudb_tar_gz);
    println!("Current working directory: {:?}", std::env::current_dir());
    println!("Executable directory: {:?}", std::env::current_exe());

    // Extract KUDb if needed
    if !kudb_dir.exists() {
        println!(
            "kudb directory does not exist, attempting to extract from '{}'",
            kudb_tar_gz.display()
        );

        if !kudb_tar_gz.exists() {
            println!("kudb.tar.gz not found at: {}", kudb_tar_gz.display());
            return Err(PoleshiftError::DatabaseNotFound(
                kudb_tar_gz.to_string_lossy().to_string(),
            ));
        }

        println!("Opening tar.gz file...");
        let tar_gz = File::open(&kudb_tar_gz).map_err(|e| {
            println!("Error opening {:?}: {}", kudb_tar_gz, e);
            PoleshiftError::Other(e.to_string())
        })?;
        println!("tar.gz file opened successfully.");

        // Get total file size for progress calculation
        let total_size = tar_gz.metadata().map(|m| m.len()).unwrap_or(0);

        println!("Creating GzDecoder...");
        let gz = GzDecoder::new(tar_gz);
        println!("GzDecoder created.");

        println!("Creating TAR archive with progress tracking...");
        let mut archive = Archive::new(ProgressReader::new(gz, window.clone(), total_size));
        println!("TAR archive created. Starting unpack...");

        // Try extracting
        match archive.unpack(&resource_dir) {
            Ok(_) => {
                println!("Extraction successful to {:?}", resource_dir);
            }
            Err(e) => {
                println!("Extraction failed: {}", e);
                return Err(PoleshiftError::Other(format!("Extraction failed: {}", e)));
            }
        }

        // Once unpacking finishes, let's mark progress 100% for extraction phase
        emit_progress(&window, 40, "Extraction complete")?;
        println!("Extraction complete. Progress: 40%");
    } else {
        println!("kudb directory already exists, skipping extraction.");
    }

    // Verify kudb_dir after extraction attempt
    if !kudb_dir.exists() {
        println!("kudb directory still does not exist after extraction attempt.");
        return Err(PoleshiftError::DatabaseNotFound(
            kudb_dir.to_string_lossy().to_string(),
        ));
    }

    println!("kudb_dir confirmed: exists at {:?}", kudb_dir);

    // Now continue with the rest of the logic
    let data_dir = app_handle.path().temp_dir().map_err(|e| {
        println!("Failed to resolve app local data directory: {}", e);
        PoleshiftError::PathResolution(e.to_string())
    })?;

    println!("Temp directory resolved to: {:?}", data_dir);

    let report_filename = format!("kraken_report_{}.txt", Uuid::new_v4());
    let report_file_path = data_dir.join(&report_filename);
    println!("Report file will be created at: {:?}", report_file_path);

    // Temporary directory creation and file copying
    let temp_dir = app_handle.path().temp_dir().map_err(|e| {
        println!("Failed to resolve temp directory: {}", e);
        PoleshiftError::PathResolution(e.to_string())
    })?;

    println!("Temp directory: {:?}", temp_dir);

    let input_temp_dir = temp_dir.join(format!("input_files_{}", Uuid::new_v4()));
    println!("Creating input temp directory at: {:?}", input_temp_dir);

    tokio::fs::create_dir(&input_temp_dir).await.map_err(|e| {
        println!("Failed to create input temp directory: {}", e);
        PoleshiftError::IoError(e.to_string())
    })?;

    let mut temp_file_paths = Vec::new();
    for original_path in &file_paths {
        println!("Processing original file: {}", original_path);
        let original_path_buf = PathBuf::from(original_path);
        let file_name = original_path_buf.file_name().ok_or_else(|| {
            println!("Invalid file path: {}", original_path);
            PoleshiftError::Other(format!("Invalid file path: {}", original_path))
        })?;
        let temp_file_path = input_temp_dir.join(file_name);
        println!(
            "Copying '{}' to '{}'",
            original_path_buf.display(),
            temp_file_path.display()
        );
        tokio::fs::copy(&original_path_buf, &temp_file_path)
            .await
            .map_err(|e| {
                println!("Failed to copy file '{}': {}", original_path, e);
                PoleshiftError::IoError(e.to_string())
            })?;
        temp_file_paths.push(temp_file_path);
    }

    emit_progress(&window, 50, "Running KrakenUniq...")?;
    println!("Progress emitted: 50%, 'Running KrakenUniq...'");

    let window_clone = window.clone();
    println!("Spawning sidecar 'krakenuniq'...");

    let sidecar_command = app_handle.shell().sidecar("krakenuniq").map_err(|e| {
        println!("Error spawning sidecar: {}", e);
        PoleshiftError::SidecarSpawnError(e.to_string())
    })?;

    let mut sidecar_command = sidecar_command
        .arg("--db")
        .arg(&kudb_dir)
        .arg("--report-file")
        .arg(&report_file_path)
        .arg("--threads")
        .arg("8")
        .arg("--exact")
        .arg("--preload");

    println!("KrakenUniq command prepared with DB: {:?}", kudb_dir);
    println!("Report file: {:?}", report_file_path);

    for path in &temp_file_paths {
        println!("Adding input file to command: {:?}", path);
        sidecar_command = sidecar_command.arg(path.to_str().unwrap().to_string());
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
    println!("Progress emitted: 80%, 'Processing results...'");

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

    println!("Reading report file...");
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

    println!(
        "Report file read successfully, content length: {}",
        report_content.len()
    );

    emit_progress(&window, 100, "Complete")?;
    println!("Progress emitted: 100%, 'Complete'");

    println!(
        "Cleaning up temporary input directory: {:?}",
        input_temp_dir
    );
    let _ = tokio::fs::remove_dir_all(&input_temp_dir)
        .await
        .map_err(|e| {
            println!("Failed to remove temp directory: {}", e);
            e
        });

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
    println!("Raw files metadata built: {:?}", raw_files);

    let processed_file = FileMeta {
        name: report_filename.clone(),
        file_type: "text/plain".to_string(),
        path: report_file_path.to_string_lossy().to_string(),
    };
    println!("Processed file metadata: {:?}", processed_file);

    let kraken_report = KrakenReport {
        report_path: processed_file.path.clone(),
        report_content,
        status: "Success".into(),
    };
    println!("Kraken report: {:?}", kraken_report);

    println!("Returning success response.");
    Ok(StandardResponse {
        status: "Success".to_string(),
        report: kraken_report,
        files: FilesResponse {
            raw: raw_files,
            processed: vec![processed_file],
        },
    })
}
