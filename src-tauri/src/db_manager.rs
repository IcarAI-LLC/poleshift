// src/db_manager.rs
use std::path::PathBuf;
use tauri::{Emitter, Manager, Runtime, Window};
use std::fs;
use reqwest;
use tokio::io::AsyncWriteExt;
use flate2::read::GzDecoder;
use tar::Archive;
use futures_util::stream::StreamExt;

const DB_DOWNLOAD_URL: &str = "https://poleshift.icarai.cloud/storage/v1/object/public/kraken-uniq-db/kudb.tar.gz?t=2024-11-30T06%3A44%3A44.315Z"; // Replace with actual URL

pub struct DbManager;

impl DbManager {
    pub async fn ensure_database<R: Runtime>(app: &tauri::App<R>) -> Result<PathBuf, String> {
        let window = app.get_window("main")
            .ok_or_else(|| "Failed to get main window".to_string())?;

        // Get the expected database path
        let resource_dir = app.path().resource_dir()
            .map_err(|e| format!("Failed to get resource directory: {}", e))?;

        let db_path = resource_dir.join("kudb");

        // Check if database exists and is valid
        if !Self::verify_database(&db_path) {
            Self::emit_status(&window, "Database not found, starting download...")?;
            Self::download_and_extract_database(db_path.clone(), &window).await?;
        }

        Ok(db_path)
    }

    fn verify_database(path: &PathBuf) -> bool {
        if !path.exists() {
            return false;
        }

        // Check if it's a directory and contains expected files
        if !path.is_dir() {
            return false;
        }

        // Add additional verification if needed
        match fs::metadata(path) {
            Ok(_) => true,
            Err(_) => false,
        }
    }

    async fn download_and_extract_database<R: Runtime>(db_path: PathBuf, window: &Window<R>) -> Result<(), String> {
        // Create a temporary file for the download
        let temp_dir = std::env::temp_dir();
        let temp_file = temp_dir.join("kudb_temp.tar.gz");
        let temp_file_for_extract = temp_file.clone();

        Self::emit_status(window, "Downloading database...")?;

        // Download the file
        let response = reqwest::get(DB_DOWNLOAD_URL)
            .await
            .map_err(|e| format!("Failed to download database: {}", e))?;

        let total_size = response.content_length().unwrap_or(0);
        let mut downloaded = 0u64;
        let mut file = tokio::fs::File::create(&temp_file)
            .await
            .map_err(|e| format!("Failed to create temporary file: {}", e))?;

        let mut stream = response.bytes_stream();
        while let Some(chunk) = stream.next().await {
            let chunk = chunk.map_err(|e| format!("Download error: {}", e))?;
            file.write_all(&chunk)
                .await
                .map_err(|e| format!("Failed to write to temporary file: {}", e))?;

            downloaded += chunk.len() as u64;
            if total_size > 0 {
                let progress = (downloaded as f64 / total_size as f64 * 50.0) as u8; // First 50% for download
                Self::emit_progress(window, progress)?;
            }
        }

        // Ensure all data is written
        file.flush().await
            .map_err(|e| format!("Failed to flush temporary file: {}", e))?;

        Self::emit_status(window, "Extracting database...")?;

        // Extract the tarball
        let db_path_clone = db_path.clone();
        tokio::task::spawn_blocking(move || -> Result<(), String> {
            // Open the tar.gz file
            let tar_gz = fs::File::open(&temp_file_for_extract)
                .map_err(|e| format!("Failed to open downloaded file: {}", e))?;
            let gz = GzDecoder::new(tar_gz);
            let mut archive = Archive::new(gz);

            // Create the target directory if it doesn't exist
            if let Some(parent) = db_path_clone.parent() {
                fs::create_dir_all(parent)
                    .map_err(|e| format!("Failed to create database directory: {}", e))?;
            }

            // Extract everything
            archive.unpack(db_path_clone.parent().unwrap())
                .map_err(|e| format!("Failed to extract database: {}", e))?;

            // Clean up temporary file
            fs::remove_file(&temp_file_for_extract).ok(); // Ignore error on cleanup

            Ok(())
        }).await
            .map_err(|e| format!("Failed to join extraction task: {}", e))??;

        Self::emit_progress(window, 100)?;
        Self::emit_status(window, "Database setup complete")?;

        Ok(())
    }

    fn emit_progress<R: Runtime>(window: &Window<R>, progress: u8) -> Result<(), String> {
        window.emit(
            "db-progress",
            serde_json::json!({ "progress": progress }),
        ).map_err(|e| format!("Failed to emit progress: {}", e))
    }

    fn emit_status<R: Runtime>(window: &Window<R>, status: &str) -> Result<(), String> {
        window.emit(
            "db-status",
            serde_json::json!({ "status": status }),
        ).map_err(|e| format!("Failed to emit status: {}", e))
    }
}