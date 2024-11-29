use std::fs;
use std::path::PathBuf;
use tauri::State;

#[tauri::command]
fn list_resource_files(resource_dir: State<'_, PathBuf>) -> Result<Vec<String>, String> {
    if !resource_dir.exists() {
        return Err("Resource directory does not exist".into());
    }

    let mut files = Vec::new();
    for entry in fs::read_dir(&*resource_dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        if let Some(file_name) = entry.path().file_name() {
            files.push(file_name.to_string_lossy().to_string());
        }
    }

    Ok(files)
}
