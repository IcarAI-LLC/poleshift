// src/handle_nutrient_ammonia_input.rs

use serde::Serialize;
use std::fs;
use tauri::{Emitter, Manager, Runtime, Window};
use uuid::Uuid;

/// Structure representing the ammonia and ammonium values.
#[derive(Serialize)]
pub struct NutrientAmmoniaReport {
    ammonia_value: f64,
    ammonium_value: f64,
}

/// Structure representing file metadata to be sent back to the frontend.
#[derive(Serialize)]
pub struct FileMeta {
    name: String,
    #[serde(rename = "type")]
    file_type: String,
    path: String,
}

/// Helper function to emit progress events to the frontend.
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

/// Tauri command to handle nutrient ammonia input processing.
#[tauri::command]
pub async fn handle_nutrient_ammonia(
    window: Window,
    sample_id: String,
    modal_inputs: serde_json::Value,
    // Assuming 'files' are not needed for this specific function.
) -> Result<(NutrientAmmoniaReport, FileMeta), String> {
    // Emit initial progress: 0%
    emit_progress(&window, 0, "Starting calculation...")?;

    // Extract 'ammoniaValue' from modal_inputs
    let ammonia_value_str = modal_inputs
        .get("ammoniaValue")
        .and_then(|v| v.as_str())
        .ok_or("ammoniaValue is missing or not a string")?;

    // Parse 'ammoniaValue' to f64
    let ammonia_value: f64 = ammonia_value_str
        .parse()
        .map_err(|_| "Invalid Ammonia Value")?;

    // Emit progress: 50%
    emit_progress(&window, 50, "Converting to ammonium...")?;

    // Perform the conversion from ammonia to ammonium
    let ammonium_value = ammonia_value * (17.0 / 14.0);

    // Create the report data
    let report = NutrientAmmoniaReport {
        ammonia_value,
        ammonium_value,
    };

    // Emit progress: 75%
    emit_progress(&window, 75, "Generating report...")?;

    // Generate a unique filename for the report
    let report_filename = format!("nutrient_ammonia_report_{}.json", Uuid::new_v4());

    // Determine the temporary directory path
    let temp_dir = std::env::temp_dir();
    let temp_report_file_path = temp_dir.join(&report_filename);

    // Serialize the report data to JSON and write to the temporary file
    fs::write(
        &temp_report_file_path,
        serde_json::to_string_pretty(&report).map_err(|e| format!("Serialization Error: {}", e))?,
    )
        .map_err(|e| format!("Failed to write report file: {}", e))?;

    // Emit progress: 100%
    emit_progress(&window, 100, "Complete")?;

    // Prepare the file metadata to return to the frontend
    let report_file = FileMeta {
        name: report_filename,
        file_type: "application/json".into(),
        path: temp_report_file_path
            .to_str()
            .ok_or("Failed to convert file path to string")?
            .to_string(),
    };

    // Return the report data and file metadata
    Ok((report, report_file))
}
