use serde::Serialize;
use uuid::Uuid;

pub mod handle_sequence_data;
mod parse_fastq_files;

#[derive(Debug, Serialize)]
pub struct KrakenUniqResult {
    processedKrakenUniqReport: Vec<ProcessedKrakenUniqReport>,
    processedKrakenUniqStdout: Vec<ProcessedKrakenUniqStdout>,
    rawSequences: Vec<RawSequence>,
}

#[derive(Debug, Serialize)]
pub struct ProcessedKrakenUniqReport {
    pub id: String,
    pub percentage: f32,
    pub reads: String,
    pub tax_reads: String,
    pub kmers: String,
    pub duplication: String,
    pub tax_name: String,
    pub parent_id: Option<Uuid>,
    #[serde(serialize_with = "serialize_uuid_vec")]
    pub children_ids: Vec<Uuid>,
    pub processed_data_id: String,
    pub user_id: String,
    pub org_id: String,
    pub sample_id: String,
    pub tax_id: u64,
    pub rank: String,
    pub coverage: String,
    pub e_score: f64,
}

// Updated serialization function to output Postgres array format
fn serialize_uuid_vec<S>(uuids: &Vec<Uuid>, serializer: S) -> Result<S::Ok, S::Error>
where
    S: serde::Serializer,
{
    // Convert to Postgres array format: {uuid1,uuid2,uuid3}
    let postgres_array = if uuids.is_empty() {
        "{}".to_string()
    } else {
        let uuid_strings: Vec<String> = uuids
            .iter()
            .map(|uuid| format!("\"{}\"", uuid.to_string()))
            .collect();
        format!("{{{}}}", uuid_strings.join(","))
    };

    serializer.serialize_str(&postgres_array)
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
    pub processed_data_id: String,
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
    pub raw_data_id: String,
    pub sync_flag_id: bool,
}
