mod handle_ctd_data;
mod poleshift_common;
mod process_sidebar_stats;
mod io;
mod krakenuniq;
mod supabase_connector;

use handle_ctd_data::handle_ctd_data;
use krakenuniq::handle_sequence_data::handle_sequence_data;
use process_sidebar_stats::process_sidebar_stats;
use supabase_connector::{
    fetch_credentials,
                         logout,
                         login,
                         upload_data,
                         sign_up,
                         reset_password};
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_websocket::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            handle_ctd_data,
            handle_sequence_data,
            process_sidebar_stats,
            fetch_credentials,
            logout,
            login,
            upload_data,
            sign_up,
            reset_password
        ])
        .run(tauri::generate_context!())
        .expect("Error while running Tauri application");
}
