use serde::Serialize;
use tauri::{Window};
use tokio::fs;
use uuid::Uuid;
use crate::poleshift_common::utils::{StandardResponse, PoleshiftError, FileMeta, emit_progress, FilesResponse};

// Nutrient Ammonia Handler
#[derive(Serialize)]
pub struct NutrientAmmoniaReport {
    pub ammonia_value: f64,
    pub ammonium_value: f64,
    pub processed_path: String,
}

#[tauri::command]
pub async fn handle_nutrient_ammonia(
    window: Window,
    _sample_id: String,
    modal_inputs: serde_json::Value,
) -> Result<StandardResponse<NutrientAmmoniaReport>, PoleshiftError> {
    emit_progress(&window, 0, "Starting calculation...")?;

    let ammonia_value_str = modal_inputs
        .get("ammoniaValue")
        .and_then(|v| v.as_str())
        .ok_or_else(|| PoleshiftError::DataError("ammoniaValue is missing or not a string".into()))?;

    let ammonia_value: f64 = ammonia_value_str
        .parse()
        .map_err(|_| PoleshiftError::DataError("Invalid Ammonia Value".into()))?;

    emit_progress(&window, 50, "Converting to ammonium...")?;

    let ammonium_value = ammonia_value * (17.0 / 14.0);

    emit_progress(&window, 75, "Generating report...")?;

    let report_filename = format!("nutrient_ammonia_report_{}.json", Uuid::new_v4());
    let temp_dir = std::env::temp_dir();
    let temp_report_file_path = temp_dir.join(&report_filename);

    let report = NutrientAmmoniaReport {
        ammonia_value,
        ammonium_value,
        processed_path: temp_report_file_path.to_string_lossy().into_owned(),
    };

    tokio::fs::write(
        &temp_report_file_path,
        serde_json::to_string_pretty(&report)?,
    ).await?;

    emit_progress(&window, 100, "Complete")?;

    let processed_file = FileMeta {
        name: report_filename,
        file_type: "application/json".into(),
        path: temp_report_file_path.to_string_lossy().into_owned(),
    };

    Ok(StandardResponse {
        status: "Success".to_string(),
        report,
        files: FilesResponse {
            raw: vec![], // no raw files here
            processed: vec![processed_file],
        },
    })
}
