mod chat;
mod handle_ctd_data;
mod io;
mod krakenuniq;
mod poleshift_common;
mod splashscreen;

use chat::create_chatbot_session;
use handle_ctd_data::handle_ctd_data;
use krakenuniq::handle_sequence_data::handle_sequence_data;
use tauri::Manager;
use crate::splashscreen::{close_splashscreen, download_resources};

pub fn run() {
    let mut builder = tauri::Builder::default();
    {
        builder = builder
            .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
                let _ = app.get_webview_window("main").expect("no main window");
            }))
            // Register your new commands here
            .invoke_handler(tauri::generate_handler![
                handle_ctd_data,
                handle_sequence_data,
                create_chatbot_session,
                download_resources,
                close_splashscreen
            ])
            .plugin(tauri_plugin_positioner::init())
            .plugin(tauri_plugin_updater::Builder::new().build())
            .plugin(tauri_plugin_upload::init())
            .plugin(tauri_plugin_http::init())
            .plugin(tauri_plugin_fs::init())
            .plugin(tauri_plugin_dialog::init());
    }
    builder
        .run(tauri::generate_context!())
        .expect("Error while running Tauri application");
}
