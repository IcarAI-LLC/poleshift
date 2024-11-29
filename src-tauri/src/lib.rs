mod handle_ctd_data;
mod handle_nutrient_ammonia;
mod handle_sequence_data;
use handle_ctd_data::handle_ctd_data_upload;
use handle_nutrient_ammonia::handle_nutrient_ammonia;
use handle_sequence_data::handle_sequence_data;

use tauri::{Manager, path::BaseDirectory};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            #[cfg(debug_assertions)]
            {
                // Check if kudb exists in resources
                if let Ok(kudb_path) = app.path().resolve("kudb", BaseDirectory::Resource) {
                    if kudb_path.exists() {
                        println!("Found kudb database at: {:?}", kudb_path);
                    } else {
                        eprintln!("Warning: kudb database not found at: {:?}", kudb_path);
                    }
                } else {
                    eprintln!("Warning: Failed to resolve kudb path");
                }
            }
            Ok(())
        })
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