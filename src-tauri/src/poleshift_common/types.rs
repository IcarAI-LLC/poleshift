//poleshift/src-tauri/src/poleshift_common/types.rs
use serde::Serialize;

#[derive(Debug, thiserror::Error, serde::Serialize)]
pub enum PoleshiftError {
    #[error("No input files provided")]
    NoFiles,
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
    #[error("Unsupported OS: {0}")]
    UnsupportedOS(String),
    #[error("Unsupported OS: {0}")]
    InvalidInput(String),
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

#[derive(Debug)]
pub struct KrakenConfig {
    // Direct paths to classification binaries and database files
    pub db_file: String,
    pub idx_file: String,
    pub taxdb_file: String,
    pub threads: u32,
    pub report_file: String,
    pub input_files: Vec<String>,
}

/*
   pub uid_mapping_file: Option<String>,
   pub quick: bool,
   pub min_hits: u32,
   pub unclassified_out: Option<String>,
   pub classified_out: Option<String>,
   pub outfile: Option<String>,
   pub print_sequence: bool,
   pub preload: bool,
   pub preload_size: Option<String>,
   pub paired: bool,
   pub check_names: bool,
   pub uid_mapping: bool,
   pub only_classified_output: bool,
   pub hll_precision: i32,
   pub use_exact_counting: bool,
*/
