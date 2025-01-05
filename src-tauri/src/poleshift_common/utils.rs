//poleshift/src-tauri/src/poleshift_common/utils.rs

use crate::poleshift_common::types::PoleshiftError;
use tauri::{Emitter, Runtime, Window};

pub fn emit_progress<R: Runtime>(
    window: &Window<R>,
    progress_percentage: u8,
    status_message: &str,
    processing_state: &str,
) -> Result<(), PoleshiftError> {
    window
        .emit(
            "progress",
            serde_json::json!({
                "progress_percentage": progress_percentage,
                "status_message": status_message,
                "processing_state": processing_state
            }),
        )
        .map_err(|e| PoleshiftError::ProgressError(e.to_string()))
}
