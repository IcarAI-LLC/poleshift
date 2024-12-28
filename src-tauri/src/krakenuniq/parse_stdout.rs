// parse_stdout.rs
use crate::krakenuniq::ProcessedKrakenUniqStdout;
use uuid::Uuid;

pub fn parse_kraken_uniq_output(
    output: &str,
    processed_data_id: &str,
    user_id: &str,
    org_id: &str,
    sample_id: &str,
) -> Result<Vec<ProcessedKrakenUniqStdout>, String> {
    let mut results = Vec::new();

    for line in output.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }

        // We'll assume tab-separated fields:
        // {C|U}   {read_id}   {tax_id}   {read_length}   {hit_data...}
        let parts: Vec<&str> = line.split('\t').collect();
        if parts.len() < 5 {
            return Err(format!(
                "Expected at least 5 columns in line, found {}. Line: {}",
                parts.len(),
                line
            ));
        }

        let classified = match parts[0] {
            "C" => true,
            "U" => false,
            other => {
                return Err(format!(
                    "Invalid classification indicator (expected 'C' or 'U'): {}",
                    other
                ));
            }
        };
        let feature_id = parts[1].to_string();
        let tax_id = parts[2].parse::<i32>().map_err(|e| {
            format!("Failed to parse tax_id as i32 from '{}': {}", parts[2], e)
        })?;
        let read_length = parts[3].parse::<i32>().map_err(|e| {
            format!(
                "Failed to parse read_length as i32 from '{}': {}",
                parts[3], e
            )
        })?;

        // Join leftover columns into the 'hit_data' string
        let hit_data = parts[4..].join(" ");

        results.push(ProcessedKrakenUniqStdout {
            id: Uuid::new_v4().to_string(),
            classified,
            feature_id,
            tax_id,
            read_length,
            hit_data,
            user_id: user_id.to_string(),
            org_id: org_id.to_string(),
            sample_id: sample_id.to_string(),
            processed_data_id: processed_data_id.to_string(),
        });
    }

    Ok(results)
}
