mod chat;
mod handle_ctd_data;
mod io;
mod krakenuniq;
mod poleshift_common;
mod process_sidebar_stats;

use chat::create_chatbot_session;
use handle_ctd_data::handle_ctd_data;
use krakenuniq::handle_sequence_data::handle_sequence_data;
use process_sidebar_stats::process_sidebar_stats;
use tauri::{WebviewUrl, WebviewWindowBuilder};
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_positioner::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            handle_ctd_data,
            handle_sequence_data,
            process_sidebar_stats,
            create_chatbot_session
        ])
        .run(tauri::generate_context!())
        .expect("Error while running Tauri application");
}
