use std::{
    fs::{self, File},
    io::{BufReader, BufWriter, Read, Write},
    path::{Path, PathBuf},
    sync::Arc,
};

use flate2::read::GzDecoder;
use futures_util::{future::join_all, StreamExt};
use reqwest::header::CONTENT_TYPE;
use openssl::sha;
use serde::Deserialize;
use tauri::{AppHandle, Manager, Window};
use tauri::Emitter;
// -----------------------------------------------------------------------------
// 1. Data structures & error types
// -----------------------------------------------------------------------------

/// Example error type for demonstration. You can modify as you wish.
#[derive(Debug)]
pub enum PoleshiftError {
    PathResolution(String),
    Other(String),
}

/// TOML wrapper for your [[resource]] array
#[derive(Debug, Deserialize)]
struct ResourceConfig {
    resource: Vec<ResourceTomlEntry>,
}

/// Represents each [[resource]] table in the TOML
#[derive(Debug, Deserialize)]
struct ResourceTomlEntry {
    file_name: String,
    file_url: String,
    checksum_compressed: String,
    checksum_decompressed: String,
    compressed: bool,
}

/// Describes a resource file to download & verify.
#[derive(Debug, Clone)]
pub struct ResourceFiles {
    /// Name of the compressed file on the remote server
    pub file_name: String,
    /// URL to download from
    pub file_url: String,
    /// Final (decompressed) local path
    pub file_path: String,
    /// Expected SHA-256 of the compressed file
    pub checksum_compressed: String,
    /// Expected SHA-256 of the final decompressed file
    pub checksum_decompressed: String,
    /// Whether to decompress after download
    pub compressed: bool,
}

/// Progress event payload for download.
#[derive(serde::Serialize, Clone)]
struct DownloadProgress {
    file_name: String,
    downloaded: u64,
    total_size: u64,
}

/// Progress event payload for checksum.
#[derive(serde::Serialize, Clone)]
struct ChecksumProgress {
    file_name: String,
    hashed: u64,
    total_size: u64,
}

// -----------------------------------------------------------------------------
// 2. Commands exposed to Tauri
// -----------------------------------------------------------------------------

/// Closes the splashscreen window and shows the main window.
#[tauri::command]
pub async fn close_splashscreen(window: Window) {
    if let Some(splash) = window.get_window("splashscreen") {
        let _ = splash.close();
    }
    if let Some(main) = window.get_window("main") {
        let _ = main.show();
    }
}

/// Main command: downloads, decompresses (if needed), and verifies multiple resources in parallel.
#[tauri::command]
pub async fn download_resources(app_handle: AppHandle) -> Result<(), String> {
    // 1) Find/create the resource directory
    let resource_dir = app_handle
        .path()
        .resource_dir()
        .map_err(|e| PoleshiftError::PathResolution(e.to_string()))
        .map_err(|e| format!("Failed to get resource dir: {:?}", e))?
        .join("resources");

    fs::create_dir_all(&resource_dir)
        .map_err(|e| format!("Failed to create resource directory: {e}"))?;

    // 2) Load the resources from TOML
    let resources = load_resource_configs(&resource_dir)
        .map_err(|e| format!("Could not load resource config: {e}"))?;

    // 3) Build a future for each resource
    let client = Arc::new(reqwest::Client::new());
    let app_handle = Arc::new(app_handle);

    let tasks = resources.into_iter().map(|res| {
        let client = client.clone();
        let app_handle = app_handle.clone();
        let resource_dir = resource_dir.clone();

        async move {
            let compressed_path = resource_dir.join(&res.file_name);
            let compressed_unchecked_path =
                resource_dir.join(format!("{}_unchecked", res.file_name));

            let final_path = PathBuf::from(&res.file_path);
            let final_unchecked_path =
                PathBuf::from(format!("{}_unchecked", final_path.display()));

            // -- A) Handle the compressed file (download / verify) --
            let need_compressed_verification = compressed_unchecked_path.exists();
            let already_verified_compressed =
                compressed_path.exists() && !need_compressed_verification;

            if need_compressed_verification {
                // We have an "_unchecked" file => re-verify it
                if !res.checksum_compressed.is_empty() {
                    match sha256_of_file_with_progress(
                        &compressed_unchecked_path,
                        &res.file_name,
                        &app_handle,
                    ) {
                        Ok(hash) => {
                            if hash != res.checksum_compressed {
                                println!("✘ Compressed checksum mismatch for {} => re-download", res.file_name);
                                let _ = fs::remove_file(&compressed_unchecked_path);
                            } else {
                                println!("✔ Compressed checksum OK => rename {}", res.file_name);
                                fs::rename(&compressed_unchecked_path, &compressed_path).map_err(
                                    |e| {
                                        format!(
                                            "Failed to rename {} to {}: {e}",
                                            compressed_unchecked_path.display(),
                                            compressed_path.display()
                                        )
                                    },
                                )?;
                            }
                        }
                        Err(e) => {
                            println!("Error verifying {}_unchecked: {e}", res.file_name);
                            let _ = fs::remove_file(&compressed_unchecked_path);
                        }
                    }
                } else {
                    // no checksum => just rename
                    fs::rename(&compressed_unchecked_path, &compressed_path).map_err(|e| {
                        format!(
                            "Failed to rename {} to {}: {e}",
                            compressed_unchecked_path.display(),
                            compressed_path.display()
                        )
                    })?;
                }
            } else if already_verified_compressed {
                println!("Skipping compressed re-check: {} is verified", res.file_name);
            } else {
                // Must download
                println!("Downloading new compressed: {}", res.file_name);

                let response = client
                    .get(&res.file_url)
                    .header(CONTENT_TYPE, "application/x-gzip")
                    .send()
                    .await
                    .map_err(|e| format!("Failed to download {}: {e}", res.file_name))?;

                if !response.status().is_success() {
                    return Err(format!(
                        "Failed to download {}. HTTP Status: {}",
                        res.file_name,
                        response.status()
                    ));
                }

                let total_size = response.content_length().unwrap_or(0);
                let mut downloaded = 0u64;

                let mut writer = BufWriter::new(
                    File::create(&compressed_unchecked_path).map_err(|e| {
                        format!(
                            "Cannot create {}: {e}",
                            compressed_unchecked_path.display()
                        )
                    })?,
                );

                let mut stream = response.bytes_stream();
                while let Some(chunk_result) = stream.next().await {
                    let chunk = chunk_result
                        .map_err(|e| format!("Error reading chunk for {}: {e}", res.file_name))?;
                    writer.write_all(&chunk).map_err(|e| {
                        format!("Failed to write chunk for {}: {e}", res.file_name)
                    })?;

                    // Emit partial download progress
                    downloaded += chunk.len() as u64;
                    let payload = DownloadProgress {
                        file_name: res.file_name.clone(),
                        downloaded,
                        total_size,
                    };
                    app_handle
                        .emit("download-progress", payload)
                        .map_err(|e| format!("Failed to emit download progress: {e}"))?;
                }
                drop(writer);

                // Verify => rename
                if !res.checksum_compressed.is_empty() {
                    match sha256_of_file_with_progress(
                        &compressed_unchecked_path,
                        &res.file_name,
                        &app_handle,
                    ) {
                        Ok(hash) => {
                            if hash != res.checksum_compressed {
                                let _ = fs::remove_file(&compressed_unchecked_path);
                                return Err(format!(
                                    "Compressed checksum mismatch for {}.\nExpected: {}\nFound: {}",
                                    res.file_name, res.checksum_compressed, hash
                                ));
                            } else {
                                println!("✔ Compressed checksum OK => rename {}", res.file_name);
                                fs::rename(&compressed_unchecked_path, &compressed_path).map_err(
                                    |e| {
                                        format!(
                                            "Failed to rename {} to {}: {e}",
                                            compressed_unchecked_path.display(),
                                            compressed_path.display()
                                        )
                                    },
                                )?;
                            }
                        }
                        Err(e) => {
                            let _ = fs::remove_file(&compressed_unchecked_path);
                            return Err(format!(
                                "Error computing compressed checksum for {}: {e}",
                                res.file_name
                            ));
                        }
                    }
                } else {
                    // no compressed checksum => assume it's good
                    fs::rename(&compressed_unchecked_path, &compressed_path).map_err(|e| {
                        format!(
                            "Failed to rename {} to {}: {e}",
                            compressed_unchecked_path.display(),
                            compressed_path.display()
                        )
                    })?;
                }
            }

            // -- B) Handle the final decompressed file (if compressed = true) --
            if res.compressed {
                let need_final_verification = final_unchecked_path.exists();
                let already_verified_final = final_path.exists() && !need_final_verification;

                if need_final_verification {
                    // We have final_unchecked => verify
                    if !res.checksum_decompressed.is_empty() {
                        match sha256_of_file_with_progress(
                            &final_unchecked_path,
                            &res.file_name,
                            &app_handle,
                        ) {
                            Ok(hash) => {
                                if hash != res.checksum_decompressed {
                                    println!("✘ Decompressed mismatch => removing {}", final_unchecked_path.display());
                                    let _ = fs::remove_file(&final_unchecked_path);
                                } else {
                                    println!("✔ Decompressed file OK => rename {}", final_unchecked_path.display());
                                    fs::rename(&final_unchecked_path, &final_path).map_err(|e| {
                                        format!(
                                            "Failed to rename {} to {}: {e}",
                                            final_unchecked_path.display(),
                                            final_path.display()
                                        )
                                    })?;
                                }
                            }
                            Err(e) => {
                                println!("Error verifying {}_unchecked: {e}", res.file_name);
                                let _ = fs::remove_file(&final_unchecked_path);
                            }
                        }
                    } else {
                        // no final checksum => just rename
                        fs::rename(&final_unchecked_path, &final_path).map_err(|e| {
                            format!(
                                "Failed to rename {} to {}: {e}",
                                final_unchecked_path.display(),
                                final_path.display()
                            )
                        })?;
                    }
                } else if already_verified_final {
                    println!("Skipping final re-check: {} is verified", final_path.display());
                } else {
                    // We must decompress
                    println!("Decompressing to final: {}", final_path.display());

                    if !compressed_path.exists() {
                        return Err(format!(
                            "Cannot decompress {} because compressed file is missing",
                            res.file_name
                        ));
                    }

                    let compressed_file = File::open(&compressed_path).map_err(|e| {
                        format!("Cannot open {}: {e}", compressed_path.display())
                    })?;
                    let mut gz_decoder = GzDecoder::new(compressed_file);

                    let mut output_file =
                        File::create(&final_unchecked_path).map_err(|e| {
                            format!("Cannot create {}: {e}", final_unchecked_path.display())
                        })?;

                    std::io::copy(&mut gz_decoder, &mut output_file)
                        .map_err(|e| format!("Error decompressing {}: {e}", res.file_name))?;

                    // Verify => rename
                    if !res.checksum_decompressed.is_empty() {
                        match sha256_of_file_with_progress(
                            &final_unchecked_path,
                            &res.file_name,
                            &app_handle,
                        ) {
                            Ok(hash) => {
                                if hash != res.checksum_decompressed {
                                    let _ = fs::remove_file(&final_unchecked_path);
                                    return Err(format!(
                                        "Decompressed checksum mismatch for {}.\nExpected: {}\nFound: {}",
                                        res.file_name, res.checksum_decompressed, hash
                                    ));
                                } else {
                                    println!("✔ Final decompressed OK => rename {}", final_unchecked_path.display());
                                    fs::rename(&final_unchecked_path, &final_path).map_err(
                                        |e| {
                                            format!(
                                                "Failed to rename {} to {}: {e}",
                                                final_unchecked_path.display(),
                                                final_path.display()
                                            )
                                        },
                                    )?;
                                }
                            }
                            Err(e) => {
                                let _ = fs::remove_file(&final_unchecked_path);
                                return Err(format!(
                                    "Error computing decompressed checksum for {}: {e}",
                                    res.file_name
                                ));
                            }
                        }
                    } else {
                        // no final checksum => just rename
                        fs::rename(&final_unchecked_path, &final_path).map_err(|e| {
                            format!(
                                "Failed to rename {} to {}: {e}",
                                final_unchecked_path.display(),
                                final_path.display()
                            )
                        })?;
                    }
                }
            }

            Ok::<_, String>(())
        }
    });

    // 4) Run tasks concurrently
    let results = join_all(tasks).await;

    // 5) Check for any errors
    for res in results {
        if let Err(e) = res {
            return Err(e);
        }
    }

    Ok(())
}

// -----------------------------------------------------------------------------
// 3. Support utilities: config loader + hashing with progress
// -----------------------------------------------------------------------------

/// Reads `taxdb_config.toml` in the given `resource_dir`.
fn load_resource_configs(
    resource_dir: &Path,
) -> Result<Vec<ResourceFiles>, Box<dyn std::error::Error>> {
    // We expect a file `taxdb_config.toml` in the `resources` directory
    let config_path = resource_dir.join("taxdb_config.toml");
    if !config_path.exists() {
        return Err(format!("Config file not found at {}", config_path.display()).into());
    }

    // Read entire TOML
    let toml_content = fs::read_to_string(&config_path)?;
    let parsed: ResourceConfig = toml::from_str(&toml_content)?;

    // Convert each TOML entry into the final ResourceFiles
    let resource_files = parsed
        .resource
        .into_iter()
        .map(|entry| {
            // We'll remove the trailing ".gz" from file_name if compressed
            let decompressed_name = if entry.compressed && entry.file_name.ends_with(".gz") {
                // e.g. "database.kdb.gz" => "database.kdb"
                entry.file_name.trim_end_matches(".gz").to_string()
            } else {
                entry.file_name.clone()
            };

            ResourceFiles {
                file_name: entry.file_name,
                file_url: entry.file_url,
                file_path: resource_dir.join(decompressed_name).to_string_lossy().to_string(),
                checksum_compressed: entry.checksum_compressed,
                checksum_decompressed: entry.checksum_decompressed,
                compressed: entry.compressed,
            }
        })
        .collect();

    Ok(resource_files)
}

/// Computes the SHA-256 hash of a file with OpenSSL, **emitting** partial progress events.
fn sha256_of_file_with_progress(
    path: &Path,
    file_name: &str,
    app_handle: &tauri::AppHandle,
) -> Result<String, std::io::Error> {
    let file = File::open(path)?;
    let metadata = file.metadata()?;
    let total_size = metadata.len();

    let mut reader = BufReader::new(file);
    let mut buffer = [0u8; 8192];
    let mut hasher = sha::Sha256::new();
    let mut hashed = 0u64;

    loop {
        let n = reader.read(&mut buffer)?;
        if n == 0 {
            break;
        }
        hasher.update(&buffer[..n]);
        hashed += n as u64;

        // partial progress: emit "checksum-progress"
        let payload = ChecksumProgress {
            file_name: file_name.to_string(),
            hashed,
            total_size,
        };
        let _ = app_handle.emit("checksum-progress", payload);
    }

    // Convert final digest to hex
    let digest = hasher.finish();
    Ok(hex::encode(digest))
}