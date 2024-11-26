// src-tauri/src/main.rs

use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};
use uuid::Uuid;
use chrono::{DateTime, Utc};

#[derive(Serialize)]
struct CTDReport {
    channels: Vec<Channel>,
    data: Vec<DataRow>,
}

#[derive(Serialize)]
struct Channel {
    // Define fields based on your Channels table schema
    // Example:
    id: i32,
    name: String,
    // Add other fields as necessary
}

#[derive(Serialize, Deserialize)]
struct DataRow {
    // Define fields based on your data table schema
    // Example:
    timestamp: Option<String>, // Using String to handle JSON serialization
    channel06: f64,
    // Add other fields as necessary
}

#[derive(Serialize)]
struct FileMeta {
    name: String,
    #[serde(rename = "type")]
    file_type: String,
    path: String,
}

#[tauri::command]
async fn handle_ctd_data_upload(
    app_handle: AppHandle,
    sample_id: String,
    modal_inputs: serde_json::Value, // Assuming modalInputs is sent as JSON
    file_paths: Vec<String>,
) -> Result<(CTDReport, FileMeta, FileMeta), String> {
    if file_paths.is_empty() {
        return Err("No files uploaded".into());
    }

    let file_path = &file_paths[0];
    let db_connection = Connection::open(file_path)
        .map_err(|e| format!("Failed to open database: {}", e))?;

    // Emit progress: 0%
    app_handle
        .emit_all(
            "progress",
            serde_json::json!({"progress": 0, "status": "Opening database..."}),
        )
        .map_err(|e| format!("Failed to emit progress: {}", e))?;

    // Read Channels
    let channel_rows = db_connection
        .prepare("SELECT id, name FROM Channels")
        .map_err(|e| e.to_string())?
        .query_map([], |row| {
            Ok(Channel {
                id: row.get(0)?,
                name: row.get(1)?,
                // Map other fields as necessary
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    // Emit progress: 20%
    app_handle
        .emit_all(
            "progress",
            serde_json::json!({"progress": 20, "status": "Reading channel data..."}),
        )
        .map_err(|e| format!("Failed to emit progress: {}", e))?;

    // Read Data
    let mut stmt = db_connection
        .prepare("SELECT timestamp, channel06 FROM data")
        .map_err(|e| e.to_string())?;

    let data_iter = stmt
        .query_map([], |row| {
            Ok(DataRow {
                timestamp: row.get(0)?,
                channel06: row.get(1)?,
                // Map other fields as necessary
            })
        })
        .map_err(|e| e.to_string())?;

    let mut data_rows: Vec<DataRow> = data_iter
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    // Emit progress: 40%
    app_handle
        .emit_all(
            "progress",
            serde_json::json!({"progress": 40, "status": "Reading measurements..."}),
        )
        .map_err(|e| format!("Failed to emit progress: {}", e))?;

    // Filter data where channel06 > 0.2
    data_rows.retain(|item| item.channel06 > 0.2);

    // Emit progress: 60%
    app_handle
        .emit_all(
            "progress",
            serde_json::json!({"progress": 60, "status": "Filtering data..."}),
        )
        .map_err(|e| format!("Failed to emit progress: {}", e))?;

    // Sort data by timestamp
    data_rows.sort_by(|a, b| {
        match (&a.timestamp, &b.timestamp) {
            (Some(ts_a), Some(ts_b)) => {
                let dt_a = DateTime::parse_from_rfc3339(ts_a);
                let dt_b = DateTime::parse_from_rfc3339(ts_b);
                match (dt_a, dt_b) {
                    (Ok(a_dt), Ok(b_dt)) => a_dt.cmp(&b_dt),
                    _ => std::cmp::Ordering::Equal,
                }
            }
            _ => std::cmp::Ordering::Equal,
        }
    });

    // Emit progress: 70%
    app_handle
        .emit_all(
            "progress",
            serde_json::json!({"progress": 70, "status": "Processing depth data..."}),
        )
        .map_err(|e| format!("Failed to emit progress: {}", e))?;

    // Ensure depth is monotonically increasing
    let mut monotonically_increasing_data = Vec::new();
    let mut previous_depth = f64::NEG_INFINITY;

    for row in data_rows {
        if row.channel06 >= previous_depth {
            monotonically_increasing_data.push(row);
            previous_depth = row.channel06;
        }
    }

    // Emit progress: 80%
    app_handle
        .emit_all(
            "progress",
            serde_json::json!({"progress": 80, "status": "Validating measurements..."}),
        )
        .map_err(|e| format!("Failed to emit progress: {}", e))?;

    let report = CTDReport {
        channels: channel_rows,
        data: monotonically_increasing_data,
    };

    // Emit progress: 90%
    app_handle
        .emit_all(
            "progress",
            serde_json::json!({"progress": 90, "status": "Generating report..."}),
        )
        .map_err(|e| format!("Failed to emit progress: {}", e))?;

    // Generate report file
    let temp_dir = std::env::temp_dir();
    let report_filename = format!("ctd_data_report_{}.json", Uuid::new_v4());
    let temp_report_file_path = temp_dir.join(report_filename);

    fs::write(
        &temp_report_file_path,
        serde_json::to_string_pretty(&report).map_err(|e| e.to_string())?,
    )
        .map_err(|e| e.to_string())?;

    // Close database connection
    drop(db_connection);

    // Emit progress: 100%
    app_handle
        .emit_all(
            "progress",
            serde_json::json!({"progress": 100, "status": "Complete"}),
        )
        .map_err(|e| format!("Failed to emit progress: {}", e))?;

    // Prepare file metadata to send back to frontend
    let raw_file = FileMeta {
        name: PathBuf::from(file_path)
            .file_name()
            .unwrap()
            .to_string_lossy()
            .into_owned(),
        file_type: "application/octet-stream".into(),
        path: file_path.clone(),
    };

    let report_file = FileMeta {
        name: temp_report_file_path
            .file_name()
            .unwrap()
            .to_string_lossy()
            .into_owned(),
        file_type: "application/json".into(),
        path: temp_report_file_path.to_string_lossy().into_owned(),
    };

    Ok((report, raw_file, report_file))
}
