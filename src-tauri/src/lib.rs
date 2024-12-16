mod build_taxonomy_hierarchy;
mod handle_ctd_data;
mod handle_nutrient_ammonia;
mod handle_sequence_data;
mod poleshift_common;
mod process_sidebar_stats;
mod handle_paired_end_sequence_data;

use build_taxonomy_hierarchy::build_taxonomy_hierarchy;
use build_taxonomy_hierarchy::get_hierarchy_stats;
use build_taxonomy_hierarchy::validate_taxonomy_hierarchy;
use handle_ctd_data::handle_ctd_data_upload;
use handle_nutrient_ammonia::handle_nutrient_ammonia;
use handle_sequence_data::handle_sequence_data;
use process_sidebar_stats::process_sidebar_stats;
use handle_paired_end_sequence_data::handle_paired_end_sequence_data;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            handle_ctd_data_upload,
            handle_nutrient_ammonia,
            handle_sequence_data,
            handle_paired_end_sequence_data,
            build_taxonomy_hierarchy,
            validate_taxonomy_hierarchy,
            get_hierarchy_stats,
            process_sidebar_stats
        ])
        .run(tauri::generate_context!())
        .expect("Error while running Tauri application");
}
