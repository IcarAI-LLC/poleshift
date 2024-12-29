use crate::poleshift_common::types::{
    FileMeta, FilesResponse, KrakenConfig, PoleshiftError, StandardResponse, StandardResponseNoFiles,
};
use crate::poleshift_common::utils::emit_progress;
use super::parse_kraken_uniq_report::parse_kraken_uniq_report;

use serde::Serialize;
use std::path::PathBuf;
use std::sync::{Arc, Mutex}; // <-- Added
use tauri::{AppHandle, Emitter, Manager, Runtime};
use tauri_plugin_shell::process::CommandEvent;
use tauri_plugin_shell::ShellExt;
use uuid::Uuid;

// Pull in these items from your own modules:
use crate::krakenuniq::{
    parse_fastq_files::parse_fastq_files,
    parse_stdout::parse_kraken_uniq_output, // <-- Make sure you have this parse function
    KrakenUniqResult,
};

/// These constants reflect the CLI flags for KrakenUniq:
const DATABASE_FLAG: &str = "-d";
const INDEX_FLAG: &str = "-i";
const TAXDB_FLAG: &str = "-a";
const THREADS_FLAG: &str = "-t";
const PRELOAD_FLAG: &str = "-M";
const REPORT_FILE_FLAG: &str = "-r";
// const OUTFILE_FLAG: &str = "-o"; // We omit this so output goes to stdout

/// Example of how you might build the config
impl KrakenConfig {
    pub fn hardcoded(
        resource_dir: PathBuf,
        report_path: PathBuf,
        // We won't really use `output_path` in this approach, but you can keep it if needed
        output_path: PathBuf,
        input_files: Vec<String>,
    ) -> Self {
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
            threads: 1,
            report_file: report_path.to_string_lossy().to_string(),
            outfile: output_path.to_string_lossy().to_string(), // Not used if we're capturing stdout
            input_files,
        }
    }
}

/// Our command to handle sequence data; parses the KrakenUniq classification output from stdout.
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
    // 1) OS checks & basic setup
    let platform = tauri_plugin_os::platform();
    if platform.eq_ignore_ascii_case("WINDOWS") {
        return Err(PoleshiftError::UnsupportedOS(
            "Windows OS is not supported yet.".into(),
        ));
    }

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
        .join("../../resources");

    let temp_dir = app_handle
        .path()
        .temp_dir()
        .map_err(|e| PoleshiftError::PathResolution(e.to_string()))?;

    // We'll still create a report file for KrakenUniq's summary report
    let report_filename = format!("kraken_report_{}.txt", Uuid::new_v4());
    let report_file_path = temp_dir.join(&report_filename);

    // We can still build an output path for passing to `KrakenConfig`, even if we don’t use it
    let output_filename = format!("kraken_output_{}.txt", Uuid::new_v4());
    let output_file_path = temp_dir.join(&output_filename);

    let window_clone = window.clone();
    emit_progress(&window, 30, "Starting Charybdis...", "processing")?;

    // 3) Build KrakenConfig (remove or ignore outfile usage)
    let config = KrakenConfig::hardcoded(
        resource_dir,
        report_file_path.clone(),
        output_file_path.clone(),
        file_paths.clone(),
    );

    // 4) Spawn krakenuniq sidecar (without -o) so read-level data prints to stdout
    let sidecar_command = app_handle
        .shell()
        .sidecar("classifyExact")
        .map_err(|e| PoleshiftError::SidecarSpawnError(e.to_string()))?;

    let mut sidecar_command = sidecar_command
        .arg(DATABASE_FLAG)
        .arg(&config.db_file)
        .arg(INDEX_FLAG)
        .arg(&config.idx_file)
        .arg(TAXDB_FLAG)
        .arg(&config.taxdb_file)
        .arg(REPORT_FILE_FLAG)
        .arg(&config.report_file)
        // .arg(OUTFILE_FLAG)
        // .arg(&config.outfile) // <-- omit so data goes to stdout
        .arg(PRELOAD_FLAG)
        .arg(THREADS_FLAG)
        .arg(config.threads.to_string());

    // Add input files
    for path in &config.input_files {
        sidecar_command = sidecar_command.arg(path);
    }

    // We'll capture the sidecar's stdout in a thread-safe string
    let kraken_uniq_stdout = Arc::new(Mutex::new(String::new()));

    let (mut rx, _child) = sidecar_command
        .spawn()
        .map_err(|e| PoleshiftError::SidecarSpawnError(e.to_string()))?;

    let (tx, rx_termination) = tokio::sync::oneshot::channel();

    // Clone for use in the spawned async block
    let kraken_uniq_stdout_in_spawn = Arc::clone(&kraken_uniq_stdout);

    // 5) Handle asynchronous events from the sidecar
    tauri::async_runtime::spawn(async move {
        while let Some(event) = rx.recv().await {
            match event {
                // Each line of stdout is appended to our Arc<Mutex<String>>
                CommandEvent::Stdout(line_bytes) => {
                    let line = String::from_utf8_lossy(&line_bytes);

                    let mut stdout_guard = kraken_uniq_stdout_in_spawn.lock().unwrap();
                    stdout_guard.push_str(&line);

                    let _ = window_clone.emit("message", Some(format!("stdout: {}", line)));
                }
                // Stderr can be logged similarly (but not appended to our read-level data):
                CommandEvent::Stderr(line_bytes) => {
                    let line = String::from_utf8_lossy(&line_bytes);
                    let _ = window_clone.emit("message", Some(format!("stderr: {}", line)));
                }
                // When the process terminates, signal the main thread to continue
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

    // Wait for sidecar to finish
    rx_termination
        .await
        .map_err(|e| PoleshiftError::Other(e.to_string()))?;

    emit_progress(&window, 40, "Processing Charybdis output...", "processing")?;

    // 6) Parse the summary Kraken report (written to `report_file_path`)
    if !report_file_path.exists() {
        return Err(PoleshiftError::ReportError(format!(
            "Report file not found: {}",
            report_file_path.display()
        )));
    }

    let report_content = tokio::fs::read_to_string(&report_file_path)
        .await
        .map_err(|e| PoleshiftError::IoError(e.to_string()))?;

    let parsed = parse_kraken_uniq_report(
        &report_content,
        &processed_data_id,
        &user_id,
        &org_id,
        &sample_id,
    );

    let final_rows = match parsed {
        Ok(rows) => rows,
        Err(msg) => {
            println!("Error parsing Kraken report: {}", msg);
            return Err(PoleshiftError::Other(msg));
        }
    };

    // 7) Parse FASTQ data if needed
    let raw_sequences_parsed =
        parse_fastq_files(&file_paths, user_id.clone(), org_id.clone(), raw_data_id, sample_id.clone());
    let raw_sequence_entries = match raw_sequences_parsed {
        Ok(rows) => rows,
        Err(msg) => {
            println!("Error parsing sequence data: {}", msg);
            return Err(PoleshiftError::Other(msg.to_string()));
        }
    };

    // Lock the Arc<Mutex<String>> to read the final accumulated stdout
    let std_out_copy = {
        let guard = kraken_uniq_stdout.lock().unwrap();
        guard.clone()
    };

    // 8) Parse the in-memory stdout for read-level classification
    let processed_stdout = match parse_kraken_uniq_output(
        &std_out_copy,
        &processed_data_id,
        &user_id,
        &org_id,
        &sample_id,
    ) {
        Ok(rows) => rows,
        Err(msg) => {
            println!("Error parsing Kraken output (stdout): {}", msg);
            return Err(PoleshiftError::Other(msg));
        }
    };

    emit_progress(&window, 50, "Processing complete...", "processing")?;

    // 9) Construct and return the final result
    let final_kraken_result = KrakenUniqResult {
        processedKrakenUniqReport: final_rows,
        processedKrakenUniqStdout: processed_stdout,
        rawSequences: raw_sequence_entries,
    };
    Ok(StandardResponseNoFiles {
        status: "Success".to_string(),
        report: final_kraken_result,
    })
}
