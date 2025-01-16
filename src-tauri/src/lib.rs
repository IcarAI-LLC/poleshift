#[cfg(desktop)]
mod chat;
#[cfg(desktop)]
mod handle_ctd_data;
#[cfg(desktop)]
mod io;
#[cfg(desktop)]
mod krakenuniq;
#[cfg(desktop)]
mod poleshift_common;
#[cfg(desktop)]
mod process_sidebar_stats;

#[cfg(desktop)]
use chat::create_chatbot_session;
#[cfg(desktop)]
use handle_ctd_data::handle_ctd_data;
#[cfg(desktop)]
use krakenuniq::handle_sequence_data::handle_sequence_data;
#[cfg(desktop)]
use process_sidebar_stats::process_sidebar_stats;
#[cfg(desktop)]
use tauri::Manager;
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();
    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, args, cwd| {
            let _ = app.get_webview_window("main")
                .expect("no main window")
                .set_focus();
        }))
            .invoke_handler(tauri::generate_handler![
            handle_ctd_data,
            handle_sequence_data,
            process_sidebar_stats,
            create_chatbot_session
        ]).plugin(tauri_plugin_positioner::init())
            .plugin(tauri_plugin_updater::Builder::new().build())
            .plugin(tauri_plugin_upload::init())
            .plugin(tauri_plugin_http::init())
            .plugin(tauri_plugin_fs::init())
            .plugin(tauri_plugin_dialog::init())
    }
    builder
        .run(tauri::generate_context!())
        .expect("Error while running Tauri application");
}
