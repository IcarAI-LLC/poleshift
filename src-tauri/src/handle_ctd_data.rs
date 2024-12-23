//poleshift/src-tauri/src/handle_ctd_data.rs

use std::path::PathBuf;
// CTD Handler
use crate::poleshift_common::types::{FileMeta, FilesResponse, PoleshiftError, StandardResponse};
use crate::poleshift_common::utils::emit_progress;
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};
use uuid::Uuid;

#[derive(Serialize)]
pub struct CTDReport {
    channels: Vec<Channel>,
    data: Vec<DataRow>,
    pub processed_path: String,
}

#[derive(Serialize)]
struct Channel {
    channel_id: i32,
    short_name: Option<String>,
    long_name: Option<String>,
    units: Option<String>,
    is_derived: Option<bool>,
    is_visible: Option<bool>,
}

#[derive(Serialize, Deserialize, Clone)]
struct DataRow {
    tstamp: Option<i64>,
    channel01: Option<f64>,
    channel02: Option<f64>,
    channel03: Option<f64>,
    channel04: Option<f64>,
    channel05: Option<f64>,
    channel06: Option<f64>,
    channel07: Option<f64>,
    channel08: Option<f64>,
    channel09: Option<f64>,
}

#[tauri::command]
pub async fn handle_ctd_data_upload(
    app_handle: AppHandle,
    _sample_id: String,
    _modal_inputs: serde_json::Value,
    file_paths: Vec<String>,
) -> Result<StandardResponse<CTDReport>, PoleshiftError> {
    if file_paths.is_empty() {
        return Err(PoleshiftError::NoFiles);
    }

    let file_path = &file_paths[0];

    let window = app_handle.get_window("main").ok_or_else(|| {
        println!("Window 'main' not found.");
        PoleshiftError::WindowNotFound
    })?;
    emit_progress(&window, 0, "Opening database...")?;

    // Put all DB work in a block
    let (channel_rows, monotonically_increasing_data) = {
        let db_connection =
            Connection::open(file_path).map_err(|e| PoleshiftError::IoError(e.to_string()))?;

        let mut stmt = db_connection
            .prepare(
                "SELECT channelID, shortName, longName, units, isDerived, isVisible FROM Channels",
            )
            .map_err(|e| PoleshiftError::DataError(e.to_string()))?;
        let channel_rows = stmt
            .query_map([], |row| {
                Ok(Channel {
                    channel_id: row.get(0)?,
                    short_name: row.get(1)?,
                    long_name: row.get(2)?,
                    units: row.get(3)?,
                    is_derived: row.get(4)?,
                    is_visible: row.get(5)?,
                })
            })
            .map_err(|e| PoleshiftError::DataError(e.to_string()))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| PoleshiftError::DataError(e.to_string()))?;

        emit_progress(&window, 20, "Reading channel data ...")?;

        let mut stmt = db_connection
            .prepare("SELECT * FROM data")
            .map_err(|e| PoleshiftError::DataError(e.to_string()))?;
        let data_iter = stmt
            .query_map([], |row| {
                Ok(DataRow {
                    tstamp: row.get(0)?,
                    channel01: row.get(1)?,
                    channel02: row.get(2)?,
                    channel03: row.get(3)?,
                    channel04: row.get(4)?,
                    channel05: row.get(5)?,
                    channel06: row.get(6)?,
                    channel07: row.get(7)?,
                    channel08: row.get(8)?,
                    channel09: row.get(9)?,
                })
            })
            .map_err(|e| PoleshiftError::DataError(e.to_string()))?;

        let mut data_rows = data_iter
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| PoleshiftError::DataError(e.to_string()))?;

        emit_progress(&window, 40, "Reading measurements...")?;

        data_rows.retain(|item| item.channel06 > Some(0.2));

        emit_progress(&window, 60, "Filtering data...")?;

        // Sorting by timestamp
        data_rows.sort_by_key(|a| a.tstamp);

        emit_progress(&window, 0, "Processing depth data...")?;

        let mut monotonically_increasing_data = Vec::new();
        let mut previous_depth = f64::NEG_INFINITY;
        for row in data_rows.into_iter() {
            if let Some(depth) = row.channel06 {
                if depth >= previous_depth {
                    monotonically_increasing_data.push(row.clone());
                    previous_depth = depth;
                }
            }
        }

        emit_progress(&window, 80, "Validating measurements...")?;

        (channel_rows, monotonically_increasing_data)
    };

    let report_filename = format!("ctd_data_report_{}.json", Uuid::new_v4());
    let temp_dir = std::env::temp_dir();
    let temp_report_file_path = temp_dir.join(&report_filename);

    let report = CTDReport {
        channels: channel_rows,
        data: monotonically_increasing_data,
        processed_path: temp_report_file_path.to_string_lossy().into_owned(),
    };

    emit_progress(&window, 90, "Generating report...")?;

    tokio::fs::write(
        &temp_report_file_path,
        serde_json::to_string_pretty(&report)?,
    )
    .await?;

    emit_progress(&window, 100, "Complete...")?;

    // Raw file(s): The input files are considered raw
    let raw_files: Vec<FileMeta> = file_paths
        .iter()
        .map(|f| FileMeta {
            name: PathBuf::from(f)
                .file_name()
                .unwrap()
                .to_string_lossy()
                .into_owned(),
            file_type: "application/octet-stream".into(),
            path: f.clone(),
        })
        .collect();

    let processed_file = FileMeta {
        name: report_filename,
        file_type: "application/json".into(),
        path: temp_report_file_path.to_string_lossy().into_owned(),
    };

    Ok(StandardResponse {
        status: "Success".to_string(),
        report,
        files: FilesResponse {
            raw: raw_files,
            processed: vec![processed_file],
        },
    })
}
