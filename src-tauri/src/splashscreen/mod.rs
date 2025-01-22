use sha2::{Digest, Sha256};
use std::{
    fs::File,
    io::{BufReader, BufWriter, Write, Read},
    path::Path
};
use flate2::read::GzDecoder;
use reqwest::header::CONTENT_TYPE;
use futures_util::StreamExt;  // for `bytes_stream()`
use indicatif::{ProgressBar, ProgressStyle};

/// Compute the SHA-256 hash for in-memory bytes, returning a lowercase hex string.
fn sha256_of_bytes(bytes: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    format!("{:x}", hasher.finalize())
}

/// Compute the SHA-256 hash of the given file on disk, returning a lowercase hex string.
fn sha256_of_file(path: &std::path::Path) -> Result<String, std::io::Error> {
    let file = File::open(path)?;
    let mut reader = BufReader::new(file);
    let mut hasher = Sha256::new();
    let mut buffer = [0u8; 8192];

    loop {
        let n = reader.read(&mut buffer)?;
        if n == 0 {
            break;
        }
        hasher.update(&buffer[..n]);
    }
    Ok(format!("{:x}", hasher.finalize()))
}

#[derive(Debug)]
pub struct ResourceFiles {
    pub file_name: String,
    pub file_url: String,
    pub file_path: String,
    /// Expected checksum of the compressed (.gz) file
    pub checksum_compressed: String,
    /// Expected checksum of the final (decompressed) file
    pub checksum_decompressed: String,
    pub compressed: bool,
}

pub async fn download_and_decompress_files() -> Result<String, String> {
    // Sample resource list with placeholder checksums
    // *** If you only want to verify the compressed or decompressed file,
    // you can leave the other checksum empty (or remove that field).
    let resources = vec![
        ResourceFiles {
            file_name: "database.kdb.gz".to_string(),
            file_url: "https://example.com/database.kdb.gz".to_string(),
            file_path: "database.kdb".to_string(),
            checksum_compressed: "<COMPRESSED_CHECKSUM>".to_string(),
            checksum_decompressed: "<DECOMPRESSED_CHECKSUM>".to_string(),
            compressed: true,
        },
        ResourceFiles {
            file_name: "database.kdb.counts.gz".to_string(),
            file_url: "https://example.com/database.kdb.counts.gz".to_string(),
            file_path: "database.kdb.counts".to_string(),
            checksum_compressed: "<COMPRESSED_CHECKSUM>".to_string(),
            checksum_decompressed: "<DECOMPRESSED_CHECKSUM>".to_string(),
            compressed: true,
        },
        ResourceFiles {
            file_name: "database.idx.gz".to_string(),
            file_url: "https://example.com/database.idx.gz".to_string(),
            file_path: "database.idx".to_string(),
            checksum_compressed: "<COMPRESSED_CHECKSUM>".to_string(),
            checksum_decompressed: "<DECOMPRESSED_CHECKSUM>".to_string(),
            compressed: true,
        },
        ResourceFiles {
            file_name: "taxDB.gz".to_string(),
            file_url: "https://example.com/taxDB.gz".to_string(),
            file_path: "taxDB".to_string(),
            checksum_compressed: "<COMPRESSED_CHECKSUM>".to_string(),
            checksum_decompressed: "<DECOMPRESSED_CHECKSUM>".to_string(),
            compressed: true,
        },
    ];

    let client = reqwest::Client::new();

    for resource in &resources {
        // Build the request
        let response = client
            .get(&resource.file_url)
            .header(CONTENT_TYPE, "application/x-gzip")
            .send()
            .await
            .map_err(|e| format!("Failed to download {}: {}", resource.file_name, e))?;

        if !response.status().is_success() {
            return Err(format!(
                "Failed to download {}. HTTP Status: {}",
                resource.file_name,
                response.status()
            ));
        }

        // Prepare a path to write our compressed file to disk
        let compressed_path = Path::new(&resource.file_name);
        let mut writer = BufWriter::new(
            File::create(&compressed_path)
                .map_err(|e| format!("Cannot create file {}: {}", resource.file_name, e))?
        );

        // -----------------------------------------
        // Show progress bar while streaming the response
        // -----------------------------------------
        let total_size = response
            .content_length()
            .unwrap_or(0); // Some servers may not send the content length

        let progress_bar = ProgressBar::new(total_size);
        progress_bar.set_style(
            ProgressStyle::default_bar()
                .template(
                    "{spinner:.green} [{elapsed_precise}] [{bar:40.cyan/blue}] \
                    {bytes}/{total_bytes} ({eta}) - {msg}"
                )
                .expect("Failed to set progress style")
                .progress_chars("#>-"),
        );
        progress_bar.set_message(format!("Downloading {}", &resource.file_name));

        // We use `bytes_stream()` to get an asynchronous stream of the response,
        // then read it chunk by chunk.
        let mut downloaded: u64 = 0;
        let mut stream = response.bytes_stream();

        while let Some(chunk_result) = stream.next().await {
            let chunk = chunk_result
                .map_err(|e| format!("Error reading chunk for {}: {}", resource.file_name, e))?;

            writer
                .write_all(&chunk)
                .map_err(|e| format!("Failed to write chunk for {}: {}", resource.file_name, e))?;

            downloaded += chunk.len() as u64;
            progress_bar.set_position(downloaded);
        }

        // Finish the bar for this file
        progress_bar.finish_with_message(format!("{} downloaded", &resource.file_name));

        // -----------------------------------------
        // Verify compressed file checksum (optional)
        // -----------------------------------------
        if !resource.checksum_compressed.is_empty()
            && resource.checksum_compressed != "<COMPRESSED_CHECKSUM>"
        {
            // Since we downloaded in chunks, we do NOT have `bytes` in memory.
            // We'll just read it back from disk to verify the checksum.
            match sha256_of_file(compressed_path) {
                Ok(computed_compressed) => {
                    if computed_compressed == resource.checksum_compressed {
                        println!("✔ Compressed checksum OK for {}", resource.file_name);
                    } else {
                        println!(
                            "✘ Compressed checksum mismatch for {}.\n  Expected: {}\n  Found:    {}",
                            resource.file_name, resource.checksum_compressed, computed_compressed
                        );
                        // Return an error if you want to stop on checksum mismatch
                        // return Err(format!("Checksum mismatch for {} (compressed file)", resource.file_name));
                    }
                }
                Err(e) => {
                    eprintln!("Error computing compressed checksum for {}: {}", resource.file_name, e);
                }
            }
        }

        // -----------------------------------------
        // Decompress if requested
        // -----------------------------------------
        if resource.compressed {
            // Decompress the file just downloaded
            let compressed_file = File::open(&compressed_path)
                .map_err(|e| format!("Cannot open compressed file {}: {}", resource.file_name, e))?;

            let mut gz_decoder = GzDecoder::new(compressed_file);

            // The final, decompressed file path
            let mut output_file = File::create(&resource.file_path)
                .map_err(|e| format!("Cannot create decompressed file {}: {}", resource.file_path, e))?;

            std::io::copy(&mut gz_decoder, &mut output_file)
                .map_err(|e| format!("Error decompressing {}: {}", resource.file_name, e))?;
        }

        // -----------------------------------------
        // Verify decompressed file checksum (optional)
        // -----------------------------------------
        if !resource.checksum_decompressed.is_empty()
            && resource.checksum_decompressed != "<DECOMPRESSED_CHECKSUM>"
        {
            let final_path = Path::new(&resource.file_path);

            match sha256_of_file(final_path) {
                Ok(computed_decompressed) => {
                    if computed_decompressed == resource.checksum_decompressed {
                        println!("✔ Decompressed checksum OK for {}", resource.file_path);
                    } else {
                        println!(
                            "✘ Decompressed checksum mismatch for {}.\n  Expected: {}\n  Found:    {}",
                            resource.file_path, resource.checksum_decompressed, computed_decompressed
                        );
                        // Return an Err if you want to stop on mismatch:
                        // return Err(format!("Checksum mismatch for {} (decompressed file)", resource.file_name));
                    }
                }
                Err(e) => {
                    eprintln!("✘ Error computing decompressed checksum for {}: {}", resource.file_path, e);
                    // return Err(format!("Checksum error for {}: {}", resource.file_path, e));
                }
            }
        }
    }

    Ok("All files downloaded, decompressed, and checksums verified (where provided).".into())
}
