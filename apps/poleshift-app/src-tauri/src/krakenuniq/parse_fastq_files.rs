use crate::io::fastq::FastqReader;
use crate::io::fastqgz::FastqGzReader;
use crate::io::{ParseError, Validate};
use crate::krakenuniq::RawSequence;
use rayon::prelude::*;
use std::fs::File;
use uuid::Uuid;

/// Calculate the median of a list of u8 quality scores.
fn median_quality(scores: &[u8]) -> f64 {
    if scores.is_empty() {
        return 0.0;
    }
    let mut sorted = scores.to_vec();
    sorted.sort_unstable();
    let len = sorted.len();
    if len % 2 == 1 {
        sorted[len / 2] as f64
    } else {
        let mid = len / 2;
        (sorted[mid - 1] as f64 + sorted[mid] as f64) / 2.0
    }
}

/// A helper function that splits a FASTQ header into key-value pairs.
/// For example, a typical Nanopore header might look like:
///
/// @<parent_read_id> runid=<run_id> read=123 ch=456 start_time=2024-01-01T12:34:56Z sampleid=SAMPLE1 ...
///
/// We'll parse each space-delimited token to see if it matches runid=..., read=..., etc.
fn parse_nanopore_header(
    header: &str,
) -> (
    String, // run_id
    i32,    // read
    i32,    // ch
    String, // start_time
    String, // sample_id_fastq
    String, // barcode
    String, // barcode_alias
    String, // parent_read_id
    String, // basecall_model_version_id
    String,
    String,
) {
    let mut run_id = String::new();
    let mut read = 0;
    let mut ch = 0;
    let mut start_time = String::new();
    let mut sample_id_fastq = String::new();
    let mut barcode = String::new();
    let mut barcode_alias = String::new();
    let mut parent_read_id = String::new();
    let mut basecall_model_version_id = String::new();
    let mut protocol_group_id = String::new();
    let mut flow_cell_id = String::new();

    // Split on whitespace and iterate
    let parts: Vec<&str> = header.split_whitespace().collect();
    for part in parts {
        // If the FASTQ header starts with "@", it could be your "parent_read_id".
        // e.g. "@f5ad7a72-81c1-4fce-a0db-fa31daf5d669"
        if part.starts_with('@') {
            // We skip '@' symbol
            parent_read_id = part.trim_start_matches('@').to_string();
        } else if let Some(value) = part.strip_prefix("runid=") {
            run_id = value.to_string();
        } else if let Some(value) = part.strip_prefix("read=") {
            read = value.parse().unwrap_or_default();
        } else if let Some(value) = part.strip_prefix("ch=") {
            ch = value.parse().unwrap_or_default();
        } else if let Some(value) = part.strip_prefix("start_time=") {
            start_time = value.to_string();
        } else if let Some(value) = part.strip_prefix("sample_id=") {
            sample_id_fastq = value.to_string();
        } else if let Some(value) = part.strip_prefix("barcode=") {
            barcode = value.to_string();
        } else if let Some(value) = part.strip_prefix("barcode_alias=") {
            barcode_alias = value.to_string();
        } else if let Some(value) = part.strip_prefix("flow_cell_id=") {
            flow_cell_id = value.to_string();
        } else if let Some(value) = part.strip_prefix("protocol_group_id=") {
            protocol_group_id = value.to_string();
        } else if let Some(value) = part.strip_prefix("basecall_model_version_id=") {
            basecall_model_version_id = value.to_string();
        }
        // If other fields exist that you need to parse, handle them similarly
    }

    (
        run_id,
        read,
        ch,
        start_time,
        sample_id_fastq,
        barcode,
        barcode_alias,
        parent_read_id,
        basecall_model_version_id,
        flow_cell_id,
        protocol_group_id,
    )
}

/// Parse all sequences from the given file paths and return a flat `Vec<RawSequence>`.
///
/// In a real-world app, you might want more robust file-extension checks.
/// Here, we check only for ".gz".
pub fn parse_fastq_files(
    file_paths: &[String],
    user_id: String,
    org_id: String,
    raw_data_id: String,
    sample_id: String,
) -> Result<Vec<RawSequence>, ParseError> {
    let mut all_sequences = Vec::new();

    for path in file_paths {
        // Decide whether it's gz-compressed
        let is_gz = path.ends_with(".gz");
        let file = File::open(path)?;

        // Depending on gz or not, create the appropriate reader
        let records = if is_gz {
            let mut reader = FastqGzReader::new(file);
            reader.collect_records()?
        } else {
            let mut reader = FastqReader::new(file);
            reader.collect_records()?
        };

        // Validate in parallel (or serially if you prefer)
        records
            .par_iter()
            .try_for_each(|r| r.validate().map_err(ParseError::Fastq))?;

        // Convert each FastqRecord into a RawSequence
        for rec in records {
            let qual_median = median_quality(&rec.quality);

            // Parse fields from the FASTQ header
            let (
                run_id,
                read,
                ch,
                start_time,
                sample_id_fastq,
                barcode,
                barcode_alias,
                parent_read_id,
                basecall_model_version_id,
                flow_cell_id,
                protocol_group_id,
            ) = parse_nanopore_header(&rec.header);

            // You can also decide how you want to populate `id`, `feature_id`, `metadata`, etc.
            // For demonstration, let's store the entire header in `metadata`,
            // and put the parent_read_id into `id`.
            let raw_seq = RawSequence {
                id: String::from(Uuid::new_v4()), // or rec.header.clone(), etc.
                feature_id: parent_read_id.clone(),
                // metadata: rec.header.clone(), // store the raw header
                sequence: rec.sequence.clone(),
                // Convert the ASCII Phred+33 scores to a human-readable string
                quality: String::from_utf8_lossy(&rec.quality).to_string(),
                quality_median: qual_median,
                run_id,
                read,
                ch,
                start_time,
                sample_id_fastq,
                barcode,
                barcode_alias,
                parent_read_id,
                basecall_model_version_id,
                flow_cell_id,
                protocol_group_id,
                user_id: user_id.clone(),
                org_id: org_id.clone(),
                sample_id: sample_id.clone(),
                raw_data_id: raw_data_id.clone(),
            };

            all_sequences.push(raw_seq);
        }
    }

    Ok(all_sequences)
}
