use std::collections::{HashMap};
use std::path::PathBuf;

use crate::poleshift_common::types::{FileMeta, FilesResponse, PoleshiftError, StandardResponse, StandardResponseNoFiles};
use crate::poleshift_common::utils::emit_progress;
use rusqlite::{Connection};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};
use uuid::Uuid;
// ---------------------------------------------------------------------------
// Structures
// ---------------------------------------------------------------------------

#[derive(Serialize)]
pub struct CTDReport {
    /// The raw data from each channel, combining all channels by timestamp
    pub rawData: Vec<RawDataRow>,
    /// The final processed data rows after combining channels and applying filters
    pub processedData: Vec<ProcessedDataRow>,
}

/// A single row of “raw” data combining multiple channel values.
#[derive(Serialize, Deserialize, Clone, Debug)]
struct RawDataRow {
    // Required base fields
    tstamp: Option<i64>,
    depth: Option<f64>,
    pressure: Option<f64>,
    sea_pressure: Option<f64>,
    temperature: Option<f64>,
    chlorophyll_a: Option<f64>,
    salinity: Option<f64>,
    speed_of_sound: Option<f64>,
    specific_conductivity: Option<f64>,

    // Units for each channel
    depth_unit: String,
    pressure_unit: String,
    sea_pressure_unit: String,
    temperature_unit: String,
    chlorophyll_a_unit: String,
    salinity_unit: String,
    speed_of_sound_unit: String,
    specific_conductivity_unit: String,

    // IDs for traceability
    id: Uuid,
    sample_id: String,
    org_id: String,
    user_id: String,
    raw_data_id: String,
}

/// Matches your Channels table in the DB.
#[derive(Serialize, Clone)]
struct Channel {
    channel_id: i32,
    short_name: Option<String>,
    long_name: Option<String>,
    units: Option<String>,
    is_derived: Option<bool>,
    is_visible: Option<bool>,
}

/// A single row of “processed” data combining multiple channel values.
#[derive(Serialize, Deserialize, Clone, Debug)]
struct ProcessedDataRow {
    // Required base fields
    tstamp: Option<i64>,
    depth: Option<f64>,
    pressure: Option<f64>,
    sea_pressure: Option<f64>,
    temperature: Option<f64>,
    chlorophyll_a: Option<f64>,
    salinity: Option<f64>,
    speed_of_sound: Option<f64>,
    specific_conductivity: Option<f64>,

    // Units for each channel
    depth_unit: String,
    pressure_unit: String,
    sea_pressure_unit: String,
    temperature_unit: String,
    chlorophyll_a_unit: String,
    salinity_unit: String,
    speed_of_sound_unit: String,
    specific_conductivity_unit: String,

    // IDs for traceability
    id: Uuid,
    sample_id: String,
    org_id: String,
    user_id: String,
    processed_data_id: String,
}

// ---------------------------------------------------------------------------
// Main command
// ---------------------------------------------------------------------------

#[tauri::command(rename_all = "snake_case")]
pub async fn handle_ctd_data(
    app_handle: AppHandle,
    sample_id: String,
    org_id: String,
    user_id: String,
    raw_data_id: String,
    processed_data_id: String,
    file_paths: Vec<String>,
) -> Result<StandardResponseNoFiles<CTDReport>, PoleshiftError> {
    // 1. Basic checks
    if file_paths.is_empty() {
        return Err(PoleshiftError::NoFiles);
    }
    let file_path = &file_paths[0];

    // Get the main window so we can emit progress updates.
    let window = app_handle
        .get_window("main")
        .ok_or_else(|| PoleshiftError::WindowNotFound)?;

    emit_progress(&window, 10, "Opening RSK file...", "processing")?;

    // -----------------------------------------------------------------------
    // 2. Query DB for channels & channel data
    // -----------------------------------------------------------------------
    let channels = {
        let db_connection = Connection::open(file_path)
            .map_err(|e| PoleshiftError::IoError(e.to_string()))?;

        // 2a. Get channel metadata
        let mut stmt = db_connection
            .prepare(
                "SELECT channelID, shortName, longName, units, isDerived, isVisible
                 FROM Channels",
            )
            .map_err(|e| PoleshiftError::DataError(e.to_string()))?;

        let channels: Vec<Channel> = stmt
            .query_map([], |row| {
                Ok(Channel {
                    channel_id: row.get(0)?,
                    short_name: row.get(1)?,
                    long_name: row.get(2)?,
                    units: row.get(3)?,
                    is_derived: row.get(4)?,
                    is_visible: row.get(5)?,
                })
            })
            .map_err(|e| PoleshiftError::DataError(e.to_string()))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| PoleshiftError::DataError(e.to_string()))?;

        emit_progress(&window, 20, "Reading channel metadata...", "processing")?;

        channels
    };

    // Build a map from `long_name.to_lowercase()` => `Channel` for quick lookups
    let mut channel_map: HashMap<String, &Channel> = HashMap::new();
    for ch in &channels {
        if let Some(ref ln) = ch.long_name {
            channel_map.insert(ln.to_lowercase(), ch);
        }
    }

    // We’ll define which channels we want in our RawDataRow / ProcessedDataRow
    let depth_ch_id       = channel_map.get("depth").map(|c| c.channel_id);
    let pressure_ch_id    = channel_map.get("pressure").map(|c| c.channel_id);
    let sea_press_ch_id   = channel_map.get("sea pressure").map(|c| c.channel_id);
    let temp_ch_id        = channel_map.get("temperature").map(|c| c.channel_id);
    let chloro_ch_id      = channel_map.get("chlorophyll a").map(|c| c.channel_id);
    let salinity_ch_id    = channel_map.get("salinity").map(|c| c.channel_id);
    let speed_ch_id       = channel_map.get("speed of sound").map(|c| c.channel_id);
    let cond_ch_id        = channel_map.get("specific conductivity").map(|c| c.channel_id);

    // Gather their units (or empty if missing)
    let depth_unit = channel_map
        .get("depth")
        .and_then(|c| c.units.as_ref())
        .cloned()
        .unwrap_or_default();
    let pressure_unit = channel_map
        .get("pressure")
        .and_then(|c| c.units.as_ref())
        .cloned()
        .unwrap_or_default();
    let sea_press_unit = channel_map
        .get("sea pressure")
        .and_then(|c| c.units.as_ref())
        .cloned()
        .unwrap_or_default();
    let temp_unit = channel_map
        .get("temperature")
        .and_then(|c| c.units.as_ref())
        .cloned()
        .unwrap_or_default();
    let chloro_unit = channel_map
        .get("chlorophyll a")
        .and_then(|c| c.units.as_ref())
        .cloned()
        .unwrap_or_default();
    let salinity_unit = channel_map
        .get("salinity")
        .and_then(|c| c.units.as_ref())
        .cloned()
        .unwrap_or_default();
    let speed_unit = channel_map
        .get("speed of sound")
        .and_then(|c| c.units.as_ref())
        .cloned()
        .unwrap_or_default();
    let cond_unit = channel_map
        .get("specific conductivity")
        .and_then(|c| c.units.as_ref())
        .cloned()
        .unwrap_or_default();

    // -----------------------------------------------------------------------
    // 2b. Read data from "data" table. We'll just read *all columns* via a
    //     dynamic query or each column we care about. For demonstration,
    //     we read them all and then pick out the columns we have channel IDs for.
    // -----------------------------------------------------------------------
    //   Example approach: "SELECT tstamp, channel01, channel02, ..."
    //   because we want them all in a single pass. However, if your DB
    //   has many channels or naming patterns, you can do multiple queries.

    let db_connection = Connection::open(file_path)
        .map_err(|e| PoleshiftError::IoError(e.to_string()))?;

    // Build a dynamic list of columns to select. We'll always select "tstamp"
    // but also select "channelNN" for each channelID from 1..=some_max.
    // For safety, you might only do so for channels that exist.
    // This is a minimal example:
    let mut columns = vec!["tstamp".to_owned()];
    for ch in &channels {
        columns.push(format!("\"channel{:02}\"", ch.channel_id));
    }
    let columns_joined = columns.join(", ");

    // SELECT tstamp, "channel01", "channel02", ...
    let query = format!("SELECT {columns_joined} FROM data");
    let mut stmt = db_connection
        .prepare(&query)
        .map_err(|e| PoleshiftError::DataError(e.to_string()))?;

    // We'll read each row as a vector of Option<f64> (for the columns after tstamp)
    // plus Option<i64> for the tstamp itself as the first column.
    let raw_iter = stmt
        .query_map([], |row| {
            // We know the first column is tstamp (i64)
            let tstamp_val = row.get::<_, Option<i64>>(0)?;

            // Then for each channel, we get an Option<f64>.
            // channels.len() columns, starting at index=1
            let mut channel_values = Vec::new();
            for idx in 1..=channels.len() {
                let val = row.get::<_, Option<f64>>(idx)?;
                channel_values.push(val);
            }

            Ok((tstamp_val, channel_values))
        })
        .map_err(|e| PoleshiftError::DataError(e.to_string()))?;

    // Collect into a Vec
    let all_data = raw_iter
        .collect::<Result<Vec<(Option<i64>, Vec<Option<f64>>)>, _>>()
        .map_err(|e| PoleshiftError::DataError(e.to_string()))?;

    emit_progress(&window, 50, "Reading raw measurements...", "processing")?;

    // -----------------------------------------------------------------------
    // 3. Build RAW data rows
    //    We'll combine the channels we specifically care about (depth, pressure, etc.)
    //    into a RawDataRow for each tstamp.
    // -----------------------------------------------------------------------
    let mut raw_rows: Vec<RawDataRow> = Vec::new();

    for (maybe_ts, channel_vals) in &all_data {
        // maybe_ts is Option<i64>; if it's None, skip or handle as you like
        if let Some(ts) = maybe_ts {
            // channel_vals is in the same order as "channels"
            // so channel_vals[i] corresponds to channels[i].
            // We want specific channels (depth, pressure, etc.)

            // Helper function: find a channel’s index, then get its value
            let get_val_for_ch_id = |ch_id: Option<i32>| -> Option<f64> {
                if let Some(cid) = ch_id {
                    // find index of that channel in `channels` vector
                    let pos = channels.iter().position(|c| c.channel_id == cid)?;
                    channel_vals[pos]
                } else {
                    None
                }
            };

            let depth_val         = get_val_for_ch_id(depth_ch_id);
            let pressure_val      = get_val_for_ch_id(pressure_ch_id);
            let sea_pressure_val  = get_val_for_ch_id(sea_press_ch_id);
            let temp_val          = get_val_for_ch_id(temp_ch_id);
            let chloro_val        = get_val_for_ch_id(chloro_ch_id);
            let salinity_val      = get_val_for_ch_id(salinity_ch_id);
            let speed_val         = get_val_for_ch_id(speed_ch_id);
            let cond_val          = get_val_for_ch_id(cond_ch_id);
            let new_id = Uuid::new_v4();    // generate a fresh UUID here
            raw_rows.push(RawDataRow {
                tstamp: Some(*ts),
                depth: depth_val,
                pressure: pressure_val,
                sea_pressure: sea_pressure_val,
                temperature: temp_val,
                chlorophyll_a: chloro_val,
                salinity: salinity_val,
                speed_of_sound: speed_val,
                specific_conductivity: cond_val,

                depth_unit: depth_unit.clone(),
                pressure_unit: pressure_unit.clone(),
                sea_pressure_unit: sea_press_unit.clone(),
                temperature_unit: temp_unit.clone(),
                chlorophyll_a_unit: chloro_unit.clone(),
                salinity_unit: salinity_unit.clone(),
                speed_of_sound_unit: speed_unit.clone(),
                specific_conductivity_unit: cond_unit.clone(),

                id: new_id,
                sample_id: sample_id.clone(),
                org_id: org_id.clone(),
                user_id: user_id.clone(),
                raw_data_id: raw_data_id.clone(),
            });
        }
    }

    // Sort raw data by ascending timestamp
    raw_rows.sort_by_key(|r| r.tstamp);
    emit_progress(&window, 70, "Removing upcasts...", "processing")?;

    // -----------------------------------------------------------------------
    // 4. Now build PROCESSED data rows by applying a monotonic filter on depth
    // -----------------------------------------------------------------------
    // We'll clone from raw_rows into processed_rows, then do monotonic filtering:
    let mut processed_rows: Vec<ProcessedDataRow> = raw_rows.clone()
        .iter()
        .map(|rr| {
            let new_id = Uuid::new_v4();    // generate a fresh UUID here
            println!("Processed data id end: {}", processed_data_id.clone());
            ProcessedDataRow {
                tstamp: rr.tstamp,
                depth: rr.depth,
                pressure: rr.pressure,
                sea_pressure: rr.sea_pressure,
                temperature: rr.temperature,
                chlorophyll_a: rr.chlorophyll_a,
                salinity: rr.salinity,
                speed_of_sound: rr.speed_of_sound,
                specific_conductivity: rr.specific_conductivity,

                depth_unit: rr.depth_unit.clone(),
                pressure_unit: rr.pressure_unit.clone(),
                sea_pressure_unit: rr.sea_pressure_unit.clone(),
                temperature_unit: rr.temperature_unit.clone(),
                chlorophyll_a_unit: rr.chlorophyll_a_unit.clone(),
                salinity_unit: rr.salinity_unit.clone(),
                speed_of_sound_unit: rr.speed_of_sound_unit.clone(),
                specific_conductivity_unit: rr.specific_conductivity_unit.clone(),

                id: new_id,
                sample_id: rr.sample_id.clone(),
                org_id: rr.org_id.clone(),
                user_id: rr.user_id.clone(),
                processed_data_id: processed_data_id.clone(),
            }
        })
        .collect();

    // We already sorted raw_rows by tstamp, so processed_rows is also sorted
    let mut monotonic_filtered: Vec<ProcessedDataRow> = Vec::new();
    let mut prev_depth = f64::NEG_INFINITY;

    for row in processed_rows {
        if let Some(depth) = row.depth {
            if depth >= prev_depth {
                monotonic_filtered.push(row.clone());
                prev_depth = depth;
            }
        }
    }

    // -----------------------------------------------------------------------
    // 5. Build and return the final CTDReport
    // -----------------------------------------------------------------------
    let report = CTDReport {
        rawData: raw_rows.clone(),
        processedData: monotonic_filtered.clone(),
    };

    emit_progress(&window, 100, "Complete...", "processing")?;

    Ok(StandardResponseNoFiles {
        status: "Success".to_string(),
        report,
    })
}
