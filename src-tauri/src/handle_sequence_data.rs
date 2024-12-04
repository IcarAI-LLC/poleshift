use serde::Serialize;
use std::{fs, io::Write, path::PathBuf};
use tauri::{AppHandle, Emitter, Manager, Runtime, Window};
use tauri::path::BaseDirectory;
use uuid::Uuid;
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::{CommandEvent, CommandChild};
use log::{info, error};
use tokio::sync::oneshot;

#[derive(Debug, Serialize)]
pub struct KrakenReport {
    report_path: String,
    report_content: String,
    status: String,
}

#[derive(Debug, thiserror::Error)]
pub enum KrakenError {
    #[error("No input files provided")]
    NoFiles,
    #[error("Database file not found: {0}")]
    DatabaseNotFound(String),
}

#[tauri::command]
pub async fn handle_sequence_data<R: Runtime>(
    app_handle: AppHandle<R>,
    file_paths: Vec<String>,
) -> Result<KrakenReport, String> {
    print!("Starting handle_sequence_data function.\n");

    if file_paths.is_empty() {
        print!("Error: No input files provided.\n");
        return Err(KrakenError::NoFiles.to_string());
    }

    // Get the main window
    let window = app_handle
        .get_window("main")
        .ok_or_else(|| {
            print!("Error: Failed to get main window.\n");
            "Failed to get main window".to_string()
        })?;
    print!("Successfully obtained the main window.\n");

    // Emit initial progress
    emit_progress(&window, 0, "Initializing...")?;
    print!("Emitted initial progress: 0% - Initializing...\n");

    // Clone the window for use inside the async closure
    let window_clone = window.clone();

    // Get the kudb path from resources
    let kudb_path = match app_handle.path().resolve("kudb", BaseDirectory::Desktop) {
        Ok(path) => {
            print!("Resolved kudb path: {:?}\n", path);
            path
        },
        Err(e) => {
            print!("Error resolving kudb path: {}\n", e);
            return Err(format!("Failed to resolve kudb path: {}", e));
        }
    };

    if !kudb_path.exists() {
        print!("Error: Database file not found at {:?}\n", kudb_path);
        return Err(KrakenError::DatabaseNotFound(
            kudb_path.to_string_lossy().to_string(),
        )
            .to_string());
    }
    print!("Database file exists at {:?}\n", kudb_path);

    // Generate a unique report file name using the user's desktop directory
    let desktop_dir = match app_handle.path().desktop_dir() {
        Ok(dir) => {
            print!("Obtained desktop directory: {:?}\n", dir);
            dir
        },
        Err(e) => {
            print!("Error: Failed to get desktop directory: {}\n", e);
            return Err(format!("Failed to get desktop dir: {}", e));
        }
    };

    let report_filename = format!("kraken_report_{}.txt", Uuid::new_v4());
    let report_file_path = desktop_dir.join(&report_filename);
    print!("Generated report file path: {:?}\n", report_file_path);

    // Create a temporary directory for input files
    let temp_dir = match app_handle.path().temp_dir() {
        Ok(dir) => {
            print!("Obtained temp directory: {:?}\n", dir);
            dir
        },
        Err(e) => {
            print!("Error: Failed to get temp dir: {}\n", e);
            return Err(format!("Failed to get temp dir: {}", e));
        }
    };

    let input_temp_dir = temp_dir.join(format!("input_files_{}", Uuid::new_v4()));
    if let Err(e) = fs::create_dir(&input_temp_dir) {
        print!("Error: Failed to create temp input directory: {}\n", e);
        return Err(format!("Failed to create temp input directory: {}", e));
    }
    print!("Created temporary input directory at {:?}\n", input_temp_dir);

    // Copy files to temporary directory
    let mut temp_file_paths = Vec::new();
    for original_path in &file_paths {
        print!("Processing original file path: {}\n", original_path);
        let original_path_buf = PathBuf::from(original_path);
        let file_name = match original_path_buf.file_name() {
            Some(name) => name,
            None => {
                print!("Error: Invalid file path: {}\n", original_path);
                return Err(format!("Invalid file path: {}", original_path));
            }
        };
        let temp_file_path = input_temp_dir.join(file_name);
        if let Err(e) = fs::copy(&original_path_buf, &temp_file_path) {
            print!(
                "Error: Failed to copy file to temp directory: {}\n",
                e
            );
            return Err(format!("Failed to copy file to temp directory: {}", e));
        }
        print!(
            "Copied file to temporary path: {:?}\n",
            temp_file_path
        );
        temp_file_paths.push(temp_file_path);
    }
    print!(
        "All input files copied to temporary directory: {:?}\n",
        temp_file_paths
    );

    // Prepare and execute krakenuniq sidecar command
    emit_progress(&window, 20, "Running KrakenUniq...")?;
    print!("Emitted progress: 20% - Running KrakenUniq...\n");

    info!("Temporary input file paths: {:?}", temp_file_paths);
    print!("Initializing sidecar command for 'krakenuniq'.\n");

    // Initialize the sidecar command using tauri-plugin-shell
    let sidecar_command = match app_handle.shell().sidecar("krakenuniq") {
        Ok(cmd) => {
            print!("Successfully obtained sidecar command for 'krakenuniq'.\n");
            cmd
        },
        Err(e) => {
            print!("Error: Failed to get sidecar command: {}\n", e);
            return Err(format!("Failed to get sidecar command: {}", e));
        }
    };

    // Append command-line arguments directly if krakenuniq expects them
    let mut sidecar_command = sidecar_command
        .arg("--db")
        .arg(&kudb_path)
        .arg("--report-file")
        .arg(&report_file_path)
        .arg("--threads")
        .arg("8");
    print!("Appended initial arguments to sidecar command.\n");

    // Add input file paths as arguments
    for path in &temp_file_paths {
        sidecar_command = sidecar_command.arg(path.to_string_lossy().to_string());
        print!("Added input file to sidecar command arguments: {}\n", path.display());
    }

    // Spawn the command
    let (mut rx, mut child) = match sidecar_command.spawn() {
        Ok(spawned) => {
            print!("Successfully spawned sidecar command.\n");
            spawned
        },
        Err(e) => {
            print!("Error: Failed to spawn sidecar: {}\n", e);
            return Err(format!("Failed to spawn sidecar: {}", e));
        }
    };

    // Create a oneshot channel to signal process termination
    let (tx, rx_termination) = oneshot::channel();

    // Spawn a task to handle sidecar events
    tauri::async_runtime::spawn(async move {
        print!("Spawned async task to handle sidecar events.\n");
        // Read events such as stdout and stderr
        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(line_bytes) => {
                    let line = String::from_utf8_lossy(&line_bytes);
                    print!("Sidecar stdout: {}\n", line);
                    if let Err(e) = window_clone
                        .emit("message", Some(format!("stdout: {}", line)))
                    {
                        print!("Failed to emit stdout event: {}\n", e);
                    }
                },
                CommandEvent::Stderr(line_bytes) => {
                    let line = String::from_utf8_lossy(&line_bytes);
                    print!("Sidecar stderr: {}\n", line);
                    if let Err(e) = window_clone
                        .emit("message", Some(format!("stderr: {}", line)))
                    {
                        print!("Failed to emit stderr event: {}\n", e);
                    }
                },
                CommandEvent::Terminated(payload) => { // Corrected pattern
                    print!(
                        "Sidecar terminated with exit code: {:?}, signal: {:?}\n",
                        payload.code, payload.signal
                    );
                    if let Err(e) = window_clone
                        .emit("message", Some(format!("Sidecar terminated with exit code: {:?}", payload.code)))
                    {
                        print!("Failed to emit termination event: {}\n", e);
                    }
                    // Signal termination
                    if tx.send(()).is_err() {
                        print!("Failed to send termination signal.\n");
                    }
                    // Exit the loop after sending the termination signal
                    break;
                },
                CommandEvent::Error(err_msg) => {
                    print!("Sidecar encountered an error: {}\n", err_msg);
                    if let Err(e) = window_clone
                        .emit("error", Some(format!("Sidecar error: {}", err_msg)))
                    {
                        print!("Failed to emit error event: {}\n", e);
                    }
                    // Depending on your application's logic, you might want to terminate here
                },
                _ => {
                    print!("Received unknown sidecar event.\n");
                }
            }
        }
        print!("Sidecar event handling task has ended.\n");
    });

    print!("Awaiting sidecar process to terminate.\n");
    // Await the termination signal
    match rx_termination.await {
        Ok(_) => {
            print!("Received termination signal from sidecar process.\n");
        },
        Err(e) => {
            print!("Error: Failed to receive termination signal: {}\n", e);
            return Err(format!("Failed to receive termination signal: {}", e));
        }
    }

    print!("Assuming report file has been generated at {:?}.\n", report_file_path);

    emit_progress(&window, 80, "Processing results...")?;
    print!("Emitted progress: 80% - Processing results...\n");

    // Optional: Verify the report file exists
    if !report_file_path.exists() {
        print!(
            "Error: Report file was not found at {:?} after sidecar terminated.\n",
            report_file_path
        );
        return Err(format!(
            "Report file was not found at: {}",
            report_file_path.to_string_lossy()
        ));
    }

    // Read the content of the report file
    let report_content = match fs::read_to_string(&report_file_path) {
        Ok(content) => {
            print!("Successfully read report file content.\n");
            content
        },
        Err(e) => {
            print!("Error: Failed to read report file: {}\n", e);
            return Err(format!("Failed to read report file: {}", e));
        }
    };

    emit_progress(&window, 100, "Complete")?;
    print!("Emitted progress: 100% - Complete.\n");

    // Optional: Clean up temporary input directory
    if let Err(e) = fs::remove_dir_all(&input_temp_dir) {
        print!(
            "Warning: Failed to remove temporary input directory {:?}: {}\n",
            input_temp_dir, e
        );
        // Optionally, emit a warning to the frontend
        let _ = window.emit("warning", Some(format!("Failed to remove temporary input directory: {}", e)));
    } else {
        print!("Removed temporary input directory at {:?}.\n", input_temp_dir);
    }

    print!("handle_sequence_data function completed successfully.\n");
    Ok(KrakenReport {
        report_path: report_file_path.to_string_lossy().into_owned(),
        report_content,
        status: "Success".into(),
    })
}

fn emit_progress<R: Runtime>(
    window: &Window<R>,
    progress: u8,
    status: &str,
) -> Result<(), String> {
    window
        .emit(
            "progress",
            serde_json::json!({
                "progress": progress,
                "status": status
            }),
        )
        .map_err(|e| {
            print!("Error: Failed to emit progress: {}\n", e);
            format!("Failed to emit progress: {}", e)
        })
}
