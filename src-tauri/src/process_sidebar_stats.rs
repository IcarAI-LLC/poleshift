use serde::{Deserialize, Serialize};
use tauri::command;
use std::collections::HashMap;

#[derive(Debug, Serialize, Deserialize)]
pub struct ProcessedStats {
    average_temperature: Option<f64>,
    average_salinity: Option<f64>,
    ammonium_stats: AmmoniumStats,
    species_data: HashMap<String, i32>,
    genus_data: HashMap<String, i32>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AmmoniumStats {
    average: Option<f64>,
    min: Option<f64>,
    max: Option<f64>,
    count: i32,
}

#[derive(Debug, Deserialize)]
pub struct ProcessedDataEntry {
    sample_id: String,
    config_id: String,
    status: String,
    data: serde_json::Value,
    metadata: Option<serde_json::Value>,
    raw_file_paths: Option<Vec<String>>,
    processed_file_paths: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
pub struct SampleGroup {
    id: String,
    loc_id: String,
}

#[derive(Debug, Deserialize)]
pub struct ProcessRequest {
    sample_groups: Vec<SampleGroup>,
    processed_data: HashMap<String, ProcessedDataEntry>,
    confidence_threshold: f64,
}

#[derive(Debug, Deserialize)]
pub struct Channel {
    channel_id: i32,
    long_name: String,
}

fn process_kraken_report(report_content: &str, confidence_threshold: f64) -> (HashMap<String, Vec<String>>, HashMap<String, Vec<String>>) {
    let mut species_set: HashMap<String, Vec<String>> = HashMap::new();
    let mut genus_set: HashMap<String, Vec<String>> = HashMap::new();

    let lines: Vec<&str> = report_content.lines().collect();
    let start_index = if lines.get(1).map_or(false, |line| line.contains("unclassified")) {
        2
    } else {
        1
    };

    for line in lines.iter().skip(start_index) {
        let parts: Vec<&str> = line.split('\t').collect();
        if parts.len() >= 9 {
            if let Ok(percentage) = parts[0].trim().parse::<f64>() {
                if percentage > confidence_threshold {
                    let rank = parts[7].trim().to_uppercase();
                    let name = parts[8].trim_start().to_string();

                    if rank == "SPECIES" || rank == "GENUS" {
                        let set = if rank == "SPECIES" { &mut species_set } else { &mut genus_set };
                        set.entry(name)
                            .or_insert_with(Vec::new);
                    }
                }
            }
        }
    }

    (species_set, genus_set)
}

#[command]
pub async fn process_sidebar_stats(request: ProcessRequest) -> Result<ProcessedStats, String> {
    let mut temp_sum = 0.0;
    let mut temp_count = 0;
    let mut sal_sum = 0.0;
    let mut sal_count = 0;
    let mut total_amm = 0.0;
    let mut amm_count = 0;
    let mut min_amm: Option<f64> = None;
    let mut max_amm: Option<f64> = None;
    let mut species_set: HashMap<String, Vec<String>> = HashMap::new();
    let mut genus_set: HashMap<String, Vec<String>> = HashMap::new();

    for group in request.sample_groups {
        let sample_id = &group.id;

        // Process CTD data
        if let Some(entry) = request.processed_data.get(&format!("{}:ctd_data", sample_id)) {
            if let Ok(report) = serde_json::from_value::<serde_json::Value>(entry.data.clone()) {
                if let (Some(channels), Some(data)) = (
                    report.get("report").and_then(|r| r.get("channels")),
                    report.get("report").and_then(|r| r.get("data")),
                ) {
                    if let (Ok(channels), Ok(data)) = (
                        serde_json::from_value::<Vec<Channel>>(channels.clone()),
                        serde_json::from_value::<Vec<HashMap<String, f64>>>(data.clone()),
                    ) {
                        let channel_map: HashMap<String, String> = channels.iter()
                            .map(|channel| {
                                (
                                    channel.long_name.clone(),
                                    format!("channel{:02}", channel.channel_id)
                                )
                            })
                            .collect();

                        for point in data {
                            if let Some(depth) = point.get(&channel_map["Depth"]) {
                                if *depth <= 2.0 {
                                    if let Some(temp_channel) = channel_map.get("Temperature") {
                                        if let Some(temp) = point.get(temp_channel) {
                                            temp_sum += temp;
                                            temp_count += 1;
                                        }
                                    }
                                    if let Some(sal_channel) = channel_map.get("Salinity") {
                                        if let Some(sal) = point.get(sal_channel) {
                                            sal_sum += sal;
                                            sal_count += 1;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        // Process nutrient data
        if let Some(entry) = request.processed_data.get(&format!("{}:nutrient_ammonia", sample_id)) {
            if let Ok(report) = serde_json::from_value::<serde_json::Value>(entry.data.clone()) {
                if let Some(amm_value) = report.get("report")
                    .and_then(|r| r.get("ammonium_value"))
                    .and_then(|v| v.as_f64())
                {
                    total_amm += amm_value;
                    amm_count += 1;
                    min_amm = Some(min_amm.map_or(amm_value, |min| min.min(amm_value)));
                    max_amm = Some(max_amm.map_or(amm_value, |max| max.max(amm_value)));
                }
            }
        }

        // Process sequencing data
        if let Some(entry) = request.processed_data.get(&format!("{}:sequencing_data", sample_id)) {
            if let Ok(report) = serde_json::from_value::<serde_json::Value>(entry.data.clone()) {
                if let Some(report_content) = report.get("report")
                    .and_then(|r| r.get("report_content"))
                    .and_then(|c| c.as_str())
                {
                    let (mut species, mut genera) = process_kraken_report(report_content, request.confidence_threshold);

                    // Add sample ID to each set
                    for samples in species.values_mut() {
                        samples.push(sample_id.clone());
                    }
                    for samples in genera.values_mut() {
                        samples.push(sample_id.clone());
                    }

                    // Merge into main sets
                    for (taxon, samples) in species {
                        species_set.entry(taxon)
                            .or_insert_with(Vec::new)
                            .extend(samples);
                    }
                    for (taxon, samples) in genera {
                        genus_set.entry(taxon)
                            .or_insert_with(Vec::new)
                            .extend(samples);
                    }
                }
            }
        }
    }

    Ok(ProcessedStats {
        average_temperature: if temp_count > 0 { Some(temp_sum / temp_count as f64) } else { None },
        average_salinity: if sal_count > 0 { Some(sal_sum / sal_count as f64) } else { None },
        ammonium_stats: AmmoniumStats {
            average: if amm_count > 0 { Some(total_amm / amm_count as f64) } else { None },
            min: min_amm,
            max: max_amm,
            count: amm_count,
        },
        species_data: species_set.into_iter()
            .map(|(name, samples)| (name, samples.len() as i32))
            .collect(),
        genus_data: genus_set.into_iter()
            .map(|(name, samples)| (name, samples.len() as i32))
            .collect(),
    })
}