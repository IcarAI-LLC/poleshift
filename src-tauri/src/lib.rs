mod handle_ctd_data;
mod handle_nutrient_ammonia;
mod handle_sequence_data;
mod poleshift_common;

use handle_ctd_data::handle_ctd_data_upload;
use handle_nutrient_ammonia::handle_nutrient_ammonia;
use handle_sequence_data::handle_sequence_data;
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            handle_ctd_data_upload,
            handle_nutrient_ammonia,
            handle_sequence_data
        ])
        .run(tauri::generate_context!())
        .expect("Error while running Tauri application");
}
