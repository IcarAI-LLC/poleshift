use serde::Serialize;

pub mod handle_sequence_data;
pub mod parse_kraken_uniq_report;
mod parse_fastq_files;
mod parse_stdout;

#[derive(Debug, Serialize)]
pub struct KrakenUniqResult {
    processedKrakenUniqReport: Vec<ProcessedKrakenUniqReport>,
    processedKrakenUniqStdout: Vec<ProcessedKrakenUniqStdout>,
    rawSequences: Vec<RawSequence>
}
/// The struct we will finally return to the frontend (instead of StandardResponse).
#[derive(Debug, Serialize)]
pub struct ProcessedKrakenUniqReport {
    pub id: String,
    pub percentage: f64,
    pub reads: String,
    pub tax_reads: String,
    pub kmers: String,
    pub duplication: String,
    pub coverage: String,
    pub tax_id: u64,
    pub rank: String,   // or your custom enum
    pub tax_name: String,
    pub parent_id: Option<String>,
    pub children_ids: Option<String>,
    pub processed_data_id: String,
    pub user_id: String,
    pub org_id: String,
    pub sample_id: String,
    pub e_score: f64,
}

#[derive(Debug, Serialize)]
pub struct ProcessedKrakenUniqStdout {
    pub id: String,
    pub classified: bool,
    pub feature_id: String,
    pub tax_id: i32,
    pub read_length: i32,
    pub hit_data: String,
    pub user_id: String,
    pub org_id: String,
    pub sample_id: String,
    pub processed_data_id: String
}

/// The struct we will finally return to the frontend (instead of StandardResponse).
#[derive(Debug, Serialize)]
pub struct RawSequence {
    pub id: String,
    pub feature_id: String,
    // pub metadata: String,
    pub sequence: String,
    pub quality: String,
    pub quality_median: f64,
    pub run_id: String,
    pub read: i32,
    pub ch: i32,
    pub start_time: String,
    pub sample_id_fastq: String,
    pub barcode: String,
    pub barcode_alias: String,
    pub parent_read_id: String,
    pub basecall_model_version_id: String,
    pub flow_cell_id: String,
    pub protocol_group_id: String,
    pub user_id: String,
    pub org_id: String,
    pub sample_id: String,
    pub raw_data_id: String
}