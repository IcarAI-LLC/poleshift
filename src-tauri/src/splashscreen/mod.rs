use std::{
    fs::{self, File},
    io::{BufReader, BufWriter, Read, Write},
    path::{Path, PathBuf},
    sync::Arc,
};

use flate2::read::GzDecoder;
use futures_util::{StreamExt, future::join_all};
use reqwest::header::CONTENT_TYPE;
use openssl::sha;
use tauri::{AppHandle, Emitter, Manager, Window};

use crate::poleshift_common::types::PoleshiftError;

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

/// Computes the SHA-256 hash of a file with OpenSSL, **emitting** partial progress events.
fn sha256_of_file_with_progress(
    path: &Path,
    file_name: &str,
    app_handle: &AppHandle,
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

        // partial progress
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

/// Main command: downloads, decompresses (if needed), and verifies multiple resources in parallel.
/// Uses "_unchecked" suffix for newly created files until checksums pass.
#[tauri::command]
pub async fn download_resources(app_handle: AppHandle) -> Result<(), String> {
    // 1) Find/create the resource directory
    let resource_dir = app_handle
        .path()
        .resource_dir()
        .map_err(|e| PoleshiftError::PathResolution(e.to_string())).unwrap()
        .join("resources");

    fs::create_dir_all(&resource_dir)
        .map_err(|e| format!("Failed to create resource directory: {e}"))?;

    // 2) Define all the resources
    let resources = vec![
        ResourceFiles {
            file_name: "database.kdb.gz".into(),
            file_url: "https://pr2.poleshift.cloud/database.kdb.gz".into(),
            file_path: resource_dir.join("database.kdb").to_string_lossy().to_string(),
            checksum_compressed: "d01c990394bb7dd3e55ec3bcffd82f20194b4045bec88d503fbb9db5da9254c8".into(),
            checksum_decompressed: "b1b5322ad305ea92da0c9e22fea04b848271812e11a4b2b63adf176ff8b584de".into(),
            compressed: true,
        },
        ResourceFiles {
            file_name: "database.kdb.counts.gz".into(),
            file_url: "https://pr2.poleshift.cloud/database.kdb.counts.gz".into(),
            file_path: resource_dir.join("database.kdb.counts").to_string_lossy().to_string(),
            checksum_compressed: "a66bcb659953a9793e75d62ec07fe99fcc1ee9c6d408f6d0b588caaf6afa4991".into(),
            checksum_decompressed: "7823e77c3bc89539c9c0f104c9cc728e16b60b4f6bc8718a2d072ff951f217b7".into(),
            compressed: true,
        },
        ResourceFiles {
            file_name: "database.idx.gz".into(),
            file_url: "https://pr2.poleshift.cloud/database.idx.gz".into(),
            file_path: resource_dir.join("database.idx").to_string_lossy().to_string(),
            checksum_compressed: "ecb678053d571f3fad38a67f15b72e10bd820f54d4c97fa4be919a5eba075395".into(),
            checksum_decompressed: "64eeb6e6cc4684f6b196bd17713103fb242768d1dafec471e395cc6489584e83".into(),
            compressed: true,
        },
        ResourceFiles {
            file_name: "taxDB.gz".into(),
            file_url: "https://pr2.poleshift.cloud/taxDB.gz".into(),
            file_path: resource_dir.join("taxDB").to_string_lossy().to_string(),
            checksum_compressed: "0b0bde984ccce9d903d91c05306ed209901858adc73f0b8ca460a8333c372959".into(),
            checksum_decompressed: "1a067cb6c1a512e27bc131ced0e39d72b688bd4eccf31b51e9d08468638edd1a".into(),
            compressed: true,
        },
    ];

    let client = Arc::new(reqwest::Client::new());
    let app_handle = Arc::new(app_handle);

    // 3) Build a future for each resource
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

            // ---------------------
            // A) Handle Compressed File
            // ---------------------
            //
            // Logic order:
            //   1) If "compressed_unchecked_path" exists, it was not verified -> re-verify it.
            //   2) Else if "compressed_path" exists, assume it's already verified -> skip everything.
            //   3) Otherwise, we have no file -> download to "_unchecked", then verify, rename.

            let need_compressed_verification = compressed_unchecked_path.exists();
            let already_verified_compressed = compressed_path.exists() && !need_compressed_verification;

            if need_compressed_verification {
                // We have an "_unchecked" file => try verifying
                if !res.checksum_compressed.is_empty() {
                    match sha256_of_file_with_progress(&compressed_unchecked_path, &res.file_name, &app_handle) {
                        Ok(hash) => {
                            if hash != res.checksum_compressed {
                                // If mismatch, remove the partial file and force re-download
                                println!("✘ Compressed checksum mismatch for {} => re-download", res.file_name);
                                let _ = fs::remove_file(&compressed_unchecked_path);
                            } else {
                                // Verified OK => rename to final
                                println!("✔ Compressed checksum OK for {} => rename", res.file_name);
                                fs::rename(&compressed_unchecked_path, &compressed_path)
                                    .map_err(|e| format!("Failed to rename {} to {}: {e}",
                                                         compressed_unchecked_path.display(), compressed_path.display()))?;
                            }
                        }
                        Err(e) => {
                            println!("Error verifying {}_unchecked: {e}", res.file_name);
                            let _ = fs::remove_file(&compressed_unchecked_path);
                        }
                    }
                } else {
                    // no checksum => just rename
                    fs::rename(&compressed_unchecked_path, &compressed_path)
                        .map_err(|e| format!("Failed to rename {} to {}: {e}",
                                             compressed_unchecked_path.display(), compressed_path.display()))?;
                }
            } else if already_verified_compressed {
                // We have a final "compressed_path" and no "_unchecked" => do nothing
                println!("Skipping compressed re-check: {} is verified", res.file_name);
            } else {
                // No file => must download
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

                // Write to "_unchecked"
                let mut writer = BufWriter::new(
                    File::create(&compressed_unchecked_path)
                        .map_err(|e| format!("Cannot create {}: {e}", compressed_unchecked_path.display()))?,
                );

                let mut stream = response.bytes_stream();
                while let Some(chunk_result) = stream.next().await {
                    let chunk = chunk_result
                        .map_err(|e| format!("Error reading chunk for {}: {e}", res.file_name))?;
                    writer
                        .write_all(&chunk)
                        .map_err(|e| format!("Failed to write chunk for {}: {e}", res.file_name))?;

                    downloaded += chunk.len() as u64;
                    let payload = DownloadProgress {
                        file_name: res.file_name.clone(),
                        downloaded,
                        total_size,
                    };
                    app_handle.emit("download-progress", payload)
                        .map_err(|e| format!("Failed to emit download progress: {e}"))?;
                }
                drop(writer);

                // Verify => rename
                if !res.checksum_compressed.is_empty() {
                    match sha256_of_file_with_progress(&compressed_unchecked_path, &res.file_name, &app_handle) {
                        Ok(hash) => {
                            if hash != res.checksum_compressed {
                                // mismatch => remove partial, fail or re-download
                                let _ = fs::remove_file(&compressed_unchecked_path);
                                return Err(format!(
                                    "Compressed checksum mismatch for {}. Expected: {}\nFound: {}",
                                    res.file_name, res.checksum_compressed, hash
                                ));
                            } else {
                                println!("✔ Compressed checksum OK => rename {}", res.file_name);
                                fs::rename(&compressed_unchecked_path, &compressed_path)
                                    .map_err(|e| format!("Failed to rename {} to {}: {e}",
                                                         compressed_unchecked_path.display(), compressed_path.display()))?;
                            }
                        }
                        Err(e) => {
                            let _ = fs::remove_file(&compressed_unchecked_path);
                            return Err(format!("Error computing compressed checksum for {}: {e}", res.file_name));
                        }
                    }
                } else {
                    // no compressed checksum => assume it's good
                    fs::rename(&compressed_unchecked_path, &compressed_path)
                        .map_err(|e| format!("Failed to rename {} to {}: {e}",
                                             compressed_unchecked_path.display(), compressed_path.display()))?;
                }
            }

            // ---------------------
            // B) Handle Decompressed (if compressed = true)
            // ---------------------
            if res.compressed {
                let need_final_verification = final_unchecked_path.exists();
                let already_verified_final = final_path.exists() && !need_final_verification;

                if need_final_verification {
                    // We have a final_unchecked => verify
                    if !res.checksum_decompressed.is_empty() {
                        match sha256_of_file_with_progress(&final_unchecked_path, &res.file_name, &app_handle) {
                            Ok(hash) => {
                                if hash != res.checksum_decompressed {
                                    println!("✘ Decompressed mismatch => removing {}, forcing re-decompress", final_unchecked_path.display());
                                    let _ = fs::remove_file(&final_unchecked_path);
                                } else {
                                    println!("✔ Decompressed file OK => rename {}", final_unchecked_path.display());
                                    fs::rename(&final_unchecked_path, &final_path)
                                        .map_err(|e| format!("Failed to rename {} to {}: {e}",
                                                             final_unchecked_path.display(), final_path.display()))?;
                                }
                            }
                            Err(e) => {
                                println!("Error verifying {}_unchecked: {e}", res.file_name);
                                let _ = fs::remove_file(&final_unchecked_path);
                            }
                        }
                    } else {
                        // no final checksum => rename
                        fs::rename(&final_unchecked_path, &final_path)
                            .map_err(|e| format!("Failed to rename {} to {}: {e}",
                                                 final_unchecked_path.display(), final_path.display()))?;
                    }
                } else if already_verified_final {
                    println!("Skipping final re-check: {} is verified", final_path.display());
                } else {
                    // We must decompress
                    println!("Decompressing new final: {}", final_path.display());

                    // Ensure compressed_path is present
                    if !compressed_path.exists() {
                        return Err(format!(
                            "Cannot decompress {} because compressed file is missing",
                            res.file_name
                        ));
                    }

                    let compressed_file = File::open(&compressed_path)
                        .map_err(|e| format!("Cannot open {}: {e}", compressed_path.display()))?;
                    let mut gz_decoder = GzDecoder::new(compressed_file);

                    let mut output_file = File::create(&final_unchecked_path)
                        .map_err(|e| format!("Cannot create {}: {e}", final_unchecked_path.display()))?;

                    std::io::copy(&mut gz_decoder, &mut output_file)
                        .map_err(|e| format!("Error decompressing {}: {e}", res.file_name))?;

                    // verify => rename
                    if !res.checksum_decompressed.is_empty() {
                        match sha256_of_file_with_progress(&final_unchecked_path, &res.file_name, &app_handle) {
                            Ok(hash) => {
                                if hash != res.checksum_decompressed {
                                    let _ = fs::remove_file(&final_unchecked_path);
                                    return Err(format!(
                                        "Decompressed checksum mismatch for {}.\nExpected: {}\nFound: {}",
                                        res.file_name, res.checksum_decompressed, hash
                                    ));
                                } else {
                                    println!("✔ Final decompressed OK => rename {}", final_unchecked_path.display());
                                    fs::rename(&final_unchecked_path, &final_path)
                                        .map_err(|e| format!("Failed to rename {} to {}: {e}",
                                                             final_unchecked_path.display(), final_path.display()))?;
                                }
                            }
                            Err(e) => {
                                let _ = fs::remove_file(&final_unchecked_path);
                                return Err(format!("Error computing decompressed checksum for {}: {e}", res.file_name));
                            }
                        }
                    } else {
                        fs::rename(&final_unchecked_path, &final_path)
                            .map_err(|e| format!("Failed to rename {} to {}: {e}",
                                                 final_unchecked_path.display(), final_path.display()))?;
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
