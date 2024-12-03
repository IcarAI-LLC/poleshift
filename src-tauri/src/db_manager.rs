// src/db_manager.rs
use std::path::PathBuf;
use tauri::{Manager, Runtime};
use std::fs;
use reqwest;
use tokio::io::AsyncWriteExt;
use flate2::read::GzDecoder;
use tar::Archive;
use futures_util::stream::StreamExt;
use std::time::Instant;

const DB_DOWNLOAD_URL: &str = "https://poleshift.icarai.cloud/storage/v1/object/public/kraken-uniq-db/kudb.tar.gz?t=2024-11-30T06%3A44%3A44.315Z";

pub struct DbManager;

impl DbManager {
    pub async fn ensure_database<R: Runtime>(app_handle: &tauri::AppHandle<R>) -> Result<PathBuf, String> {
        // Get the expected database path
        let resource_dir = app_handle.path().desktop_dir()
            .map_err(|e| format!("Failed to get resource directory: {}", e))?;

        let db_path = resource_dir.join("kudb");

        // Check if database exists and is valid
        if !Self::verify_database(&db_path) {
            Self::emit_status(app_handle, "Database not found, starting download...")?;
            Self::download_and_extract_database(db_path.clone(), app_handle).await?;
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
        fs::metadata(path).is_ok()
    }

    async fn download_and_extract_database<R: Runtime>(db_path: PathBuf, app_handle: &tauri::AppHandle<R>) -> Result<(), String> {
        // Create a temporary file for the download
        let resource_dir = app_handle.path().desktop_dir()
            .map_err(|e| format!("Failed to get resource directory: {}", e))?;
        let temp_file = resource_dir.join("kudb_temp.tar.gz");
        let temp_file_for_extract = temp_file.clone();

        Self::emit_status(app_handle, "Downloading database...")?;

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

        // Start time for download speed calculation
        let start_time = Instant::now();
        let mut last_update = Instant::now();
        let mut last_downloaded = 0u64;

        while let Some(chunk) = stream.next().await {
            let chunk = chunk.map_err(|e| format!("Download error: {}", e))?;
            file.write_all(&chunk)
                .await
                .map_err(|e| format!("Failed to write to temporary file: {}", e))?;

            downloaded += chunk.len() as u64;

            let now = Instant::now();
            let elapsed_since_last_update = now.duration_since(last_update).as_secs_f64();
            if elapsed_since_last_update >= 1.0 { // Update every second
                let speed = (downloaded - last_downloaded) as f64 / elapsed_since_last_update; // bytes per second
                last_downloaded = downloaded;
                last_update = now;

                let total_elapsed = now.duration_since(start_time).as_secs_f64();
                let avg_speed = downloaded as f64 / total_elapsed;

                let remaining_bytes = total_size.saturating_sub(downloaded);
                let estimated_time_remaining = if avg_speed > 0.0 {
                    remaining_bytes as f64 / avg_speed
                } else {
                    0.0
                };

                // Emit the stats to UI
                Self::emit_download_stats(app_handle, speed, estimated_time_remaining)?;
            }

            if total_size > 0 {
                let progress = (downloaded as f64 / total_size as f64 * 50.0) as u8; // First 50% for download
                Self::emit_progress(app_handle, progress)?;
            }
        }

        // Ensure all data is written
        file.flush().await
            .map_err(|e| format!("Failed to flush temporary file: {}", e))?;

        Self::emit_status(app_handle, "Extracting database...")?;

        // Clone the app handle for use in the blocking task
        let app_handle_clone = app_handle.clone();

        // Spawn a blocking task for extraction
        tokio::task::spawn_blocking(move || -> Result<(), String> {
            // Get total number of files in the archive
            let total_files = {
                let tar_gz = fs::File::open(&temp_file_for_extract)
                    .map_err(|e| format!("Failed to open downloaded file for counting: {}", e))?;
                let gz = GzDecoder::new(tar_gz);
                let mut archive = Archive::new(gz);
                archive.entries()
                    .map_err(|e| format!("Failed to read archive entries for counting: {}", e))?
                    .count()
            };

            // Open the tar.gz file again for extraction
            let tar_gz = fs::File::open(&temp_file_for_extract)
                .map_err(|e| format!("Failed to open downloaded file for extraction: {}", e))?;
            let gz = GzDecoder::new(tar_gz);
            let mut archive = Archive::new(gz);

            // Create the target directory if it doesn't exist
            if let Some(parent) = db_path.parent() {
                fs::create_dir_all(parent)
                    .map_err(|e| format!("Failed to create database directory: {}", e))?;
            }

            // Start extraction
            let mut files_extracted = 0;
            let start_time = Instant::now();
            for entry in archive.entries().map_err(|e| format!("Failed to read archive entries: {}", e))? {
                let mut entry = entry.map_err(|e| format!("Failed to read archive entry: {}", e))?;
                entry.unpack_in(db_path.parent().unwrap())
                    .map_err(|e| format!("Failed to extract entry: {}", e))?;

                files_extracted += 1;

                // Compute progress
                let progress = 50 + ((files_extracted as f64 / total_files as f64) * 50.0) as u8; // Second 50% for extraction
                let _ = Self::emit_progress(&app_handle_clone, progress);

                // Compute extract speed and estimated time remaining
                let elapsed = start_time.elapsed().as_secs_f64();
                let extract_speed = files_extracted as f64 / elapsed; // files per second
                let files_remaining = total_files - files_extracted;
                let estimated_time_remaining = if extract_speed > 0.0 {
                    files_remaining as f64 / extract_speed
                } else {
                    0.0
                };

                // Emit extraction stats
                let _ = Self::emit_extract_stats(&app_handle_clone, extract_speed, files_extracted, files_remaining, estimated_time_remaining);
            }

            // Update progress to 100% after extraction
            let _ = Self::emit_progress(&app_handle_clone, 100);

            // Clean up temporary file
            fs::remove_file(&temp_file_for_extract).ok(); // Ignore error on cleanup

            Ok(())
        }).await
            .map_err(|e| format!("Failed to join extraction task: {}", e))??;

        Self::emit_status(app_handle, "Database setup complete")?;

        Ok(())
    }

    fn emit_progress<R: Runtime>(app_handle: &tauri::AppHandle<R>, progress: u8) -> Result<(), String> {
        let js_code = format!(
            "document.getElementById('progress-bar').style.width = '{}%';",
            progress
        );

        let webview = app_handle.get_webview_window("splashscreen")
            .ok_or_else(|| "Failed to get webview for splashscreen".to_string())?;

        webview.eval(&js_code)
            .map_err(|e| format!("Failed to evaluate JavaScript code: {}", e))
    }

    fn emit_status<R: Runtime>(app_handle: &tauri::AppHandle<R>, status: &str) -> Result<(), String> {
        // Escape any single quotes to prevent JavaScript syntax errors
        let escaped_status = status.replace("'", "\\'");
        let js_code = format!(
            "document.getElementById('status').textContent = '{}';",
            escaped_status
        );

        let webview = app_handle.get_webview_window("splashscreen")
            .ok_or_else(|| "Failed to get webview for splashscreen".to_string())?;

        webview.eval(&js_code)
            .map_err(|e| format!("Failed to evaluate JavaScript code: {}", e))
    }

    fn emit_download_stats<R: Runtime>(
        app_handle: &tauri::AppHandle<R>,
        speed: f64,
        estimated_time_remaining: f64,
    ) -> Result<(), String> {
        let speed_kb = speed / 1024.0;
        let js_code = format!(
            "document.getElementById('download-speed').textContent = 'Speed: {:.2} kB/s';\
             document.getElementById('download-eta').textContent = 'Estimated time remaining: {:.0} s';",
            speed_kb,
            estimated_time_remaining
        );

        let webview = app_handle.get_webview_window("splashscreen")
            .ok_or_else(|| "Failed to get webview for splashscreen".to_string())?;

        webview.eval(&js_code)
            .map_err(|e| format!("Failed to evaluate JavaScript code: {}", e))
    }

    fn emit_extract_stats<R: Runtime>(
        app_handle: &tauri::AppHandle<R>,
        speed: f64,
        files_extracted: usize,
        files_remaining: usize,
        estimated_time_remaining: f64,
    ) -> Result<(), String> {
        let js_code = format!(
            "document.getElementById('extract-speed').textContent = 'Speed: {:.2} files/s';\
             document.getElementById('files-extracted').textContent = 'Files extracted: {}';\
             document.getElementById('files-remaining').textContent = 'Files remaining: {}';\
             document.getElementById('extract-eta').textContent = 'Estimated time remaining: {:.0} s';",
            speed,
            files_extracted,
            files_remaining,
            estimated_time_remaining
        );

        let webview = app_handle.get_webview_window("splashscreen")
            .ok_or_else(|| "Failed to get webview for splashscreen".to_string())?;

        webview.eval(&js_code)
            .map_err(|e| format!("Failed to evaluate JavaScript code: {}", e))
    }
}
