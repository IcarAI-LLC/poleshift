//poleshift/src-tauri/src/poleshift_common/utils.rs

use crate::poleshift_common::types::PoleshiftError;
use tauri::{Emitter, Runtime, Window};

pub fn emit_progress<R: Runtime>(
    window: &Window<R>,
    progress: u8,
    status: &str,
) -> Result<(), PoleshiftError> {
    window
        .emit(
            "progress",
            serde_json::json!({
                "progress": progress,
                "status": status
            }),
        )
        .map_err(|e| PoleshiftError::ProgressError(e.to_string()))
}
