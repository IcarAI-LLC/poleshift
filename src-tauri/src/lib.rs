mod handle_ctd_data;
mod handle_nutrient_ammonia;
mod handle_sequence_data;
mod db_manager;

use tauri::Manager;
use handle_ctd_data::handle_ctd_data_upload;
use handle_nutrient_ammonia::handle_nutrient_ammonia;
use handle_sequence_data::handle_sequence_data;
use db_manager::DbManager;
use fix_path_env;
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let _ = fix_path_env::fix();
    tauri::Builder::default()
        .setup(|app| {
            // Clone necessary handles to avoid moving the non-Send `app` into the async block
            let app_handle = app.handle().clone(); // Get a cloneable handle to the app

            // Perform initialization in a separate async task
            tauri::async_runtime::spawn(async move {
                // Initialize your app
                println!("Initializing...");
                match DbManager::ensure_database(&app_handle).await {
                    Ok(db_path) => println!("Database ready at: {:?}", db_path),
                    Err(e) => eprintln!("Database setup failed: {}", e),
                }
                println!("Done initializing.");

                // After initialization, close the splashscreen and show the main window
                let app_handle_clone = app_handle.clone();
                tauri::async_runtime::spawn_blocking(move || {
                    let _ = app_handle_clone.get_window("splashscreen").unwrap().close();
                    let _ = app_handle_clone.get_window("main").unwrap().show();
                });
            });

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
