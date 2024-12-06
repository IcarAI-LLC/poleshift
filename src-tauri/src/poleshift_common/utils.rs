use serde::Serialize;
use tauri::{Emitter, Runtime, Window};

#[derive(Debug, thiserror::Error, serde::Serialize)]
pub enum PoleshiftError {
    #[error("No input files provided")]
    NoFiles,
    #[error("Database file not found: {0}")]
    DatabaseNotFound(String),
    #[error("Window not found")]
    WindowNotFound,
    #[error("Path resolution error: {0}")]
    PathResolution(String),
    #[error("IO Error: {0}")]
    IoError(String),
    #[error("Spawn sidecar error: {0}")]
    SidecarSpawnError(String),
    #[error("Report generation error: {0}")]
    ReportError(String),
    #[error("Data processing error: {0}")]
    DataError(String),
    #[error("Progress emission error: {0}")]
    ProgressError(String),
    #[error("Serialization error: {0}")]
    SerializationError(String),
    #[error("Unknown error: {0}")]
    Other(String),
}

impl From<std::io::Error> for PoleshiftError {
    fn from(e: std::io::Error) -> Self {
        PoleshiftError::IoError(e.to_string())
    }
}

impl From<tauri::Error> for PoleshiftError {
    fn from(e: tauri::Error) -> Self {
        PoleshiftError::Other(e.to_string())
    }
}

impl From<serde_json::Error> for PoleshiftError {
    fn from(e: serde_json::Error) -> Self {
        PoleshiftError::SerializationError(e.to_string())
    }
}

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

/// Structure representing file metadata to be sent back to the frontend.
#[derive(Serialize, Debug)]
pub struct FileMeta {
    pub name: String,
    #[serde(rename = "type")]
    pub file_type: String,
    pub path: String,
}

#[derive(Debug, Serialize)]
pub struct FilesResponse {
    pub raw: Vec<FileMeta>,
    pub processed: Vec<FileMeta>,
}

#[derive(Debug, Serialize)]
pub struct StandardResponse<T> {
    pub status: String,
    pub report: T,
    pub files: FilesResponse,
}
