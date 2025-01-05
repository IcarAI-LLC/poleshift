// src/lib/hooks/useTauriDataProcessor.rs

use serde_json;
use std::collections::HashMap;
use std::fs::{remove_file, File};
use std::io::copy;
use std::path::PathBuf; // Needed to serialize Vec<String> -> JSON array string

use flate2::read::GzDecoder;
use tauri::{AppHandle, Manager, Runtime};
use uuid::Uuid; // <-- ADD THIS

use crate::poleshift_common::types::{KrakenConfig, PoleshiftError, StandardResponseNoFiles};
use crate::poleshift_common::utils::emit_progress;

// Pull in these items from your own modules:
use crate::krakenuniq::{
    parse_fastq_files::parse_fastq_files, KrakenUniqResult, ProcessedKrakenUniqReport,
    ProcessedKrakenUniqStdout,
};
use krakenuniq_rs::{classify_reads, ClassificationResults};

impl KrakenConfig {
    pub fn hardcoded(resource_dir: PathBuf, input_files: Vec<String>) -> Self {
        Self {
            db_file: resource_dir
                .join("database.kdb")
                .to_string_lossy()
                .to_string(),
            idx_file: resource_dir
                .join("database.idx")
                .to_string_lossy()
                .to_string(),
            taxdb_file: resource_dir.join("taxDB").to_string_lossy().to_string(),
            counts_file: resource_dir
                .join("database.kdb.counts")
                .to_string_lossy()
                .to_string(),
            input_files: input_files
                .into_iter()
                .map(|file| PathBuf::from(file))
                .collect(),
        }
    }
}

/// Decompresses a file if a `.gz` variant exists, and then deletes the `.gz`.
///
/// E.g., if `file_path` is `/some/path/database.kdb` and
/// `/some/path/database.kdb.gz` exists, then this function
/// will decompress `.gz` into `file_path` and afterwards remove the `.gz`.
fn maybe_decompress(file_path: &str) -> Result<(), PoleshiftError> {
    let gz_path = format!("{}.gz", file_path); // e.g. "database.kdb.gz"
    let gz_path = PathBuf::from(&gz_path);
    let out_path = PathBuf::from(file_path);

    if gz_path.exists() {
        println!(
            "Decompressing {} -> {}",
            gz_path.display(),
            out_path.display()
        );
        let gz_file = File::open(&gz_path).map_err(|e| {
            PoleshiftError::Other(format!("Failed to open {}: {}", gz_path.display(), e))
        })?;
        let mut d = GzDecoder::new(gz_file);
        let mut out_file = File::create(&out_path).map_err(|e| {
            PoleshiftError::Other(format!("Failed to create {}: {}", out_path.display(), e))
        })?;

        // Perform the decompression
        copy(&mut d, &mut out_file).map_err(|e| {
            PoleshiftError::Other(format!("Failed to decompress {}: {}", gz_path.display(), e))
        })?;

        // Now that decompression was successful, remove the `.gz` file
        remove_file(&gz_path).map_err(|e| {
            PoleshiftError::Other(format!(
                "Decompression succeeded but failed to remove {}: {}",
                gz_path.display(),
                e
            ))
        })?;
        println!("Removed compressed file: {}", gz_path.display());
    }

    Ok(())
}

/// Decompress the four main Kraken DB files if needed, then delete the `.gz` files.
fn maybe_decompress_config_files(config: &KrakenConfig) -> Result<(), PoleshiftError> {
    maybe_decompress(&config.db_file)?;
    maybe_decompress(&config.idx_file)?;
    maybe_decompress(&config.taxdb_file)?;
    maybe_decompress(&config.counts_file)?;
    Ok(())
}

/// Our command to handle sequence data; decompresses DB files first, then calls `classify_reads`.
#[tauri::command(rename_all = "snake_case")]
pub async fn handle_sequence_data<R: Runtime>(
    app_handle: AppHandle<R>,
    file_paths: Vec<String>,
    processed_data_id: String,
    raw_data_id: String,
    user_id: String,
    org_id: String,
    sample_id: String,
) -> Result<StandardResponseNoFiles<KrakenUniqResult>, PoleshiftError> {
    if file_paths.is_empty() {
        return Err(PoleshiftError::NoFiles);
    }

    let window = app_handle
        .get_window("main")
        .ok_or_else(|| PoleshiftError::WindowNotFound)?;

    emit_progress(&window, 10, "Resolving database paths...", "processing")?;

    // 2) Resolve paths for resources and temporary storage
    let resource_dir = app_handle
        .path()
        .resource_dir()
        .map_err(|e| PoleshiftError::PathResolution(e.to_string()))?
        .join("./resources");
    println!("resource_dir: {:?}", resource_dir);

    emit_progress(
        &window,
        20,
        "Decompressing database files if necessary...",
        "processing",
    )?;

    // 3) Build a local `KrakenConfig`
    let config = KrakenConfig::hardcoded(resource_dir, file_paths.clone());

    // 4) Attempt to decompress the DB files if they are gzipped
    maybe_decompress_config_files(&config)?;

    emit_progress(&window, 30, "Starting classification...", "processing")?;

    // 5) Perform classification using `classify_reads`
    let classification_results: ClassificationResults = match classify_reads(
        &config.db_file,
        &config.idx_file,
        &config.counts_file,
        &config.taxdb_file,
        config.input_files,
        /* print_sequence_in_kraken = */ false,
        /* only_classified_kraken_output = */ false,
        /* generate_report = */ true,
    ) {
        Ok(results) => results,
        Err(e) => {
            println!("Error during classification: {}", e);
            return Err(PoleshiftError::Other(e.to_string()));
        }
    };

    emit_progress(
        &window,
        40,
        "Classification complete. Preparing final data...",
        "processing",
    )?;

    // 6) Parse FASTQ data for "rawSequences"
    let raw_sequences_parsed = parse_fastq_files(
        &file_paths,
        user_id.clone(),
        org_id.clone(),
        raw_data_id.clone(),
        sample_id.clone(),
    );
    let raw_sequence_entries = match raw_sequences_parsed {
        Ok(rows) => rows,
        Err(msg) => {
            println!("Error parsing sequence data: {}", msg);
            return Err(PoleshiftError::Other(msg.to_string()));
        }
    };

    // 7) Replace numeric tax IDs with newly generated UUIDs
    let kraken_report_rows = classification_results
        .kraken_report_rows
        .unwrap_or_default();

    let mut row_with_assigned_ids = Vec::new();
    for row in kraken_report_rows {
        let assigned_id = Uuid::new_v4();
        row_with_assigned_ids.push((row, assigned_id));
    }

    let tax_id_to_uuid: HashMap<u32, Uuid> = row_with_assigned_ids
        .iter()
        .map(|(row, assigned_uuid)| (row.tax_id, *assigned_uuid))
        .collect();

    let processed_kraken_uniq_report: Vec<ProcessedKrakenUniqReport> = row_with_assigned_ids
        .into_iter()
        .map(|(row, assigned_id)| {
            let parent_uuid = row
                .parent_tax_id
                .and_then(|tax_id| tax_id_to_uuid.get(&tax_id).cloned());

            let child_uuids: Vec<Uuid> = row
                .children_tax_ids
                .iter()
                .filter_map(|child_tax_id| tax_id_to_uuid.get(child_tax_id).cloned())
                .collect();

            // Calculate e-score
            let tax_reads_f64 = row.tax_reads as f64;
            let kmers_f64 = row.kmers as f64;
            let coverage_f64 = row.cov as f64;

            // Calculate double exponential of coverage
            let double_exp_cov = coverage_f64.exp().exp();

            // Calculate final e-score
            let e_score = if kmers_f64 > 0.0 {
                (tax_reads_f64 / kmers_f64) * double_exp_cov
            } else {
                0.0
            };

            ProcessedKrakenUniqReport {
                id: String::from(assigned_id),
                percentage: row.pct,
                reads: row.reads.to_string(),
                tax_reads: row.tax_reads.to_string(),
                kmers: row.kmers.to_string(),
                duplication: row.dup.to_string(),
                tax_name: row.tax_name,
                parent_id: parent_uuid,
                children_ids: child_uuids,
                processed_data_id: String::from(
                    Uuid::parse_str(&processed_data_id).expect("Invalid processed_data_id UUID"),
                ),
                user_id: String::from(Uuid::parse_str(&user_id).expect("Invalid user_id UUID")),
                org_id: String::from(Uuid::parse_str(&org_id).expect("Invalid org_id UUID")),
                sample_id: String::from(
                    Uuid::parse_str(&sample_id).expect("Invalid sample_id UUID"),
                ),
                tax_id: row.tax_id as u64,
                rank: row.rank,
                coverage: row.cov.to_string(),
                e_score,
            }
        })
        .collect();

    // 8) Transform classification output lines -> ProcessedKrakenUniqStdout
    let processed_kraken_uniq_stdout = classification_results
        .kraken_output_lines
        .iter()
        .map(|line| ProcessedKrakenUniqStdout {
            id: String::from(Uuid::new_v4()),
            classified: false,
            tax_id: line.tax_id as i32,
            read_length: line.length as i32,
            hit_data: line.hitlist.to_string(),
            user_id: String::from(Uuid::parse_str(&user_id).expect("Invalid user_id UUID")),
            org_id: String::from(Uuid::parse_str(&org_id).expect("Invalid org_id UUID")),
            sample_id: String::from(Uuid::parse_str(&sample_id).expect("Invalid sample_id UUID")),
            feature_id: line.read_id.to_string(),
            processed_data_id: String::from(
                Uuid::parse_str(&processed_data_id).expect("Invalid processed_data_id UUID"),
            ),
        })
        .collect::<Vec<_>>();

    emit_progress(&window, 50, "Processing complete...", "processing")?;

    // 9) Construct final result
    let final_kraken_result = KrakenUniqResult {
        processedKrakenUniqReport: processed_kraken_uniq_report,
        processedKrakenUniqStdout: processed_kraken_uniq_stdout,
        rawSequences: raw_sequence_entries,
    };

    // 10) Return in the `StandardResponseNoFiles`
    Ok(StandardResponseNoFiles {
        status: "Success".to_string(),
        report: final_kraken_result,
    })
}
