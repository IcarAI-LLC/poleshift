// src/lib.rs
mod handle_ctd_data;
use handle_ctd_data::handle_ctd_data_upload;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(debug_assertions)]
    tauri::Builder::default()
        .plugin(tauri_plugin_devtools::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![handle_ctd_data_upload])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}