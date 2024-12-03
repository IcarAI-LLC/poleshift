use serde::{Serialize};
use std::process::Command;
use std::{fs, path::PathBuf};
use tauri::{AppHandle, Emitter, Manager, Runtime, Window};
use tauri::path::BaseDirectory;
use uuid::Uuid;

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
    if file_paths.is_empty() {
        return Err(KrakenError::NoFiles.to_string());
    }

    // Get the main window
    let window = app_handle
        .get_window("main")
        .ok_or_else(|| "Failed to get main window".to_string())?;

    // Get the kudb path from resources
    let kudb_path = app_handle
        .path()
        .resolve("kudb", BaseDirectory::Desktop)
        .map_err(|e| format!("Failed to resolve kudb path: {}", e))?;

    // Get the kudb path from resources
    let kraken_path = app_handle
        .path()
        .resolve("krakenuniq-ubuntu-dist/installed_scripts/krakenuniq", BaseDirectory::Desktop)
        .map_err(|e| format!("Failed to resolve kraken path: {}", e))?;

    // Emit initial progress
    emit_progress(&window, 0, "Initializing...")?;

    if !kudb_path.exists() {
        return Err(KrakenError::DatabaseNotFound(
            kudb_path.to_string_lossy().to_string(),
        )
            .to_string());
    }

    if !kraken_path.exists() {
        return Err(KrakenError::DatabaseNotFound(
            kudb_path.to_string_lossy().to_string(),
        )
            .to_string());
    }

    // Generate a unique report file name using the user's desktop directory
    let desktop_dir = app_handle
        .path()
        .app_cache_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    let report_filename = format!("kraken_report_{}.txt", Uuid::new_v4());
    let report_file_path = desktop_dir.join(report_filename);

    // Create a temporary directory for input files
    let temp_dir = app_handle
        .path()
        .temp_dir()
        .map_err(|e| format!("Failed to get cache dir: {}", e))?;
    let input_temp_dir = temp_dir.join(format!("input_files_{}", Uuid::new_v4()));
    fs::create_dir(&input_temp_dir)
        .map_err(|e| format!("Failed to create temp input directory: {}", e))?;

    // Copy files to temporary directory
    let mut temp_file_paths = Vec::new();
    for original_path in &file_paths {
        let original_path_buf = PathBuf::from(original_path);
        let file_name = original_path_buf.file_name()
            .ok_or_else(|| format!("Invalid file path: {}", original_path))?;
        let temp_file_path = input_temp_dir.join(file_name);
        fs::copy(&original_path_buf, &temp_file_path)
            .map_err(|e| format!("Failed to copy file to temp directory: {}", e))?;
        temp_file_paths.push(temp_file_path);
    }

    // Prepare and execute krakenuniq command
    emit_progress(&window, 20, "Running KrakenUniq...")?;

    println!("Temporary input file paths: {:?}", temp_file_paths);

    let output = Command::new(kraken_path)
        .arg("--db")
        .arg(&kudb_path)
        .arg("--report-file")
        .arg(&report_file_path)
        .arg("--threads")
        .arg("8")
        .args(&temp_file_paths)
        .output()
        .map_err(|e| format!("Failed to execute krakenuniq: {}", e))?;

    // Log stdout and stderr
    println!("krakenuniq stdout: {}", String::from_utf8_lossy(&output.stdout));
    println!("krakenuniq stderr: {}", String::from_utf8_lossy(&output.stderr));

    if !output.status.success() {
        return Err(format!(
            "krakenuniq failed: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    emit_progress(&window, 80, "Processing results...")?;

    // Verify report file was created
    if !report_file_path.exists() {
        return Err(format!(
            "Report file not generated at: {}",
            report_file_path.to_string_lossy()
        ));
    }

    // Read the content of the report file
    let report_content = fs::read_to_string(&report_file_path)
        .map_err(|e| format!("Failed to read report file: {}", e))?;

    emit_progress(&window, 100, "Complete")?;

    // Optionally, clean up temporary files
    fs::remove_dir_all(&input_temp_dir).ok();

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
        .map_err(|e| format!("Failed to emit progress: {}", e))
}
