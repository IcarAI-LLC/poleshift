import {DataType, ProcessingState, TaxonomicRankAndUnclassified} from "./index.ts";
import {DateTime} from "luxon";

/** ─────────────────────────────────────────────────────────────────────────────
 *  16) processed_data_improved
 *  ────────────────────────────────────────────────────────────────────────────**/
export interface ProcessedDataImproved {
    id: string;             // notNull, primaryKey
    data_type: DataType;      // notNull
    user_id: string;        // notNull
    org_id: string;         // notNull
    sample_id: string;      // notNull
    created_at: string;     // notNull, default(DateTime.now().toISO())
    processing_state: ProcessingState;
    status_message: string | null;
    progress_percentage: number | null;
}

/** ─────────────────────────────────────────────────────────────────────────────
 *  17) processed_ctd_rbr_data_values
 *  ────────────────────────────────────────────────────────────────────────────**/
export interface ProcessedCtdRbrDataValues {
    id: string;                         // notNull, primaryKey
    timestamp: string;                  // notNull, default(DateTime.now().toISO())
    depth: number | null;              // real (nullable)
    pressure: number | null;           // real (nullable)
    sea_pressure: number | null;       // real (nullable)
    temperature: number | null;        // real (nullable)
    chlorophyll_a: number | null;      // real (nullable)
    salinity: number | null;           // real (nullable)
    speed_of_sound: number | null;     // real (nullable)
    specific_conductivity: number | null;
    processed_data_id: string;         // notNull, FK -> processed_data_improved.id
    user_id: string;                   // notNull, FK -> user_profiles.id
    org_id: string;                    // notNull, FK -> organizations.id
    sample_id: string;                 // notNull, FK -> sample_group_metadata.id
    depth_unit: string | null;
    pressure_unit: string | null;
    sea_pressure_unit: string | null;
    temperature_unit: string | null;
    chlorophyll_a_unit: string | null;
    salinity_unit: string | null;
    speed_of_sound_unit: string | null;
    specific_conductivity_unit: string | null;
}

/** ─────────────────────────────────────────────────────────────────────────────
 *  18) processed_nutrient_ammonia_data
 *  ────────────────────────────────────────────────────────────────────────────**/
export interface ProcessedNutrientAmmoniaData {
    id: string;                               // notNull, primaryKey
    processed_data_id: string;                // notNull, FK -> processed_data_improved.id
    user_id: string;                          // notNull, FK -> user_profiles.id
    org_id: string;                           // notNull, FK -> organizations.id
    sample_id: string;                        // notNull, FK -> sample_group_metadata.id
    ammonia: number;                          // notNull, real
    ammonium: number;                         // notNull, real
}

/** ─────────────────────────────────────────────────────────────────────────────
 *  19) processed_kraken_uniq_report
 *  ────────────────────────────────────────────────────────────────────────────**/
export interface ProcessedKrakenUniqReport {
    id: string;                               // notNull, primaryKey
    percentage: number;                       // notNull, real
    reads: string;                            // notNull, text
    tax_reads: string;                        // notNull, text
    kmers: string;                            // notNull, text
    duplication: string;                      // notNull, text
    coverage: string;                         // notNull, text
    tax_id: number;                           // notNull, integer
    rank: TaxonomicRankAndUnclassified;       // notNull, your custom enum
    tax_name: string;                         // notNull, text
    parent_id: string | null;                // text (nullable)
    children_ids: string | null;             // text (nullable)
    processed_data_id: string;               // notNull, FK -> processed_data_improved.id
    user_id: string;                         // notNull, FK -> user_profiles.id
    org_id: string;                          // notNull, FK -> organizations.id
    sample_id: string;                       // notNull, FK -> sample_group_metadata.id
    e_score: number;
}

/** ─────────────────────────────────────────────────────────────────────────────
 *  20) raw_data_improved
 *  ────────────────────────────────────────────────────────────────────────────**/
export interface RawDataImproved {
    id: string;           // notNull, primaryKey
    data_type: string;    // notNull
    user_id: string | null;    // text (nullable)
    org_id: string;       // notNull
    sample_id: string;    // notNull
    created_at: string;   // notNull, default(DateTime.now().toISO())
}

/** ─────────────────────────────────────────────────────────────────────────────
 *  17) processed_ctd_rbr_data_values
 *  ────────────────────────────────────────────────────────────────────────────**/
export interface RawCtdRbrDataValues {
    id: string;                         // notNull, primaryKey
    timestamp: string;                  // notNull, default(DateTime.now().toISO())
    depth: number | null;              // real (nullable)
    pressure: number | null;           // real (nullable)
    sea_pressure: number | null;       // real (nullable)
    temperature: number | null;        // real (nullable)
    chlorophyll_a: number | null;      // real (nullable)
    salinity: number | null;           // real (nullable)
    speed_of_sound: number | null;     // real (nullable)
    specific_conductivity: number | null;
    raw_data_id: string;         // notNull, FK -> raw_data_improved.id
    user_id: string;                   // notNull, FK -> user_profiles.id
    org_id: string;                    // notNull, FK -> organizations.id
    sample_id: string;                 // notNull, FK -> sample_group_metadata.id
    depth_unit: string | null;
    pressure_unit: string | null;
    sea_pressure_unit: string | null;
    temperature_unit: string | null;
    chlorophyll_a_unit: string | null;
    salinity_unit: string | null;
    speed_of_sound_unit: string | null;
    specific_conductivity_unit: string | null;
}

/** ─────────────────────────────────────────────────────────────────────────────
 *  23) raw_nutrient_ammonia_data
 *  ────────────────────────────────────────────────────────────────────────────**/
export interface RawNutrientAmmoniaData {
    id: string;             // notNull, primaryKey
    ammonia: number;        // notNull, real
    raw_data_id: string;    // notNull, integer
    sample_id: string;      // notNull
    org_id: string;         // notNull
    user_id: string | null;
}

/** ─────────────────────────────────────────────────────────────────────────────
 *  24) raw_fastq_data
 *  ────────────────────────────────────────────────────────────────────────────**/
export interface RawFastqData {
    id: string;             // notNull, primaryKey
    feature_id: string;     // notNull, text
    // metadata: string;       // notNull, text
    sequence: string;       // notNull, text
    quality: string;        // notNull, text
    quality_median: string;
    run_id: string;
    read: number;
    ch: number;
    start_time: DateTime;
    sample_id_fastq: string;
    barcode: string;
    barcode_alias: string;
    parent_read_id: string;
    basecall_model_version_id: string;
    flow_cell_id: string;
    protocol_group_id: string;
    raw_data_id: string;    // notNull, integer
    sample_id: string;      // notNull
    org_id: string;         // notNull
    user_id: string;
}

/** ─────────────────────────────────────────────────────────────────────────────
 *  23) processed_kraken_uniq_outfile
 *  ────────────────────────────────────────────────────────────────────────────**/
export interface ProcessedKrakenUniqStdout {
    id: string,
    sample_id: string,
    user_id: string,
    org_id: string,
    processed_data_id: string,
    classified: boolean,
    feature_id: number,
    tax_id: number,
    read_length: number,
    hit_data: string,
}

/** ─────────────────────────────────────────────────────────────────────────────
 *  24) pr2_krakenuniq_taxdb
 *  ────────────────────────────────────────────────────────────────────────────**/
export interface Pr2KrakenuniqTaxdb {
    id: number,
    parent_id: number,
    tax_name: string,
    rank: string,
}
