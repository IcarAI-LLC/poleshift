use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_http::reqwest::Client;
use tauri_plugin_positioner::{Position, WindowExt};

#[derive(Debug, Deserialize, Serialize)]
struct CreateSessionResponse {
    url: String,
}

fn local_part_of_email(email: &str) -> Result<&str, String> {
    // split_once('@') returns Some((before, after)) if there's an '@';
    // otherwise it returns None.
    let (local_part, domain_part) = email
        .split_once('@')
        .ok_or_else(|| "Email must contain '@'")?;

    // Here you might also want to check if local_part or domain_part is empty.
    if local_part.is_empty() {
        return Err("Local part is empty".into());
    }
    if domain_part.is_empty() {
        return Err("Domain part is empty".into());
    }

    Ok(local_part)
}

#[tauri::command(rename_all = "snake_case")]
pub async fn create_chatbot_session(
    app_handle: AppHandle,
    api_key: String,
    email: String,
    user_id: String,
    org_id: String,
) -> Result<String, String> {
    // First, check if the window exists.
    let window_label = "poleshift_chat";
    if let Some(window) = app_handle.get_window(window_label) {
        // If the window already exists, just focus it and return.
        window
            .set_focus()
            .map_err(|e| format!("Failed to focus window: {}", e))?;
        return Ok("Window already exists; focused instead.".to_string());
    }

    // If the window does not exist, proceed with creating a session and building the window.
    let endpoint = "https://www.askyourdatabase.com/api/chatbot/v2/session";
    let chatbotid = "017e091a5e8e360085286ccb6c4eb3bf";

    // Capture the `Ok` value in a variable that remains in scope
    let name = match local_part_of_email(&*email) {
        Ok(name) => name,
        Err(e) => {
            eprintln!("Error: {}", e);
            std::process::exit(1); // Exit the program with code 1
        }
    };

    // Now `name` is in scope here.
    let user_id = user_id;
    let org_id = org_id;

    let body = serde_json::json!({
    "chatbotid": chatbotid,
    "email": email,
    "name": name,
    "properties": {
        "userId": format!("{}{}{}", "'",user_id, "'"),
        "orgId": format!("{}{}{}", "'",org_id, "'")
        }
    });
    println!("{}", body);
    let client = Client::new();
    let response = client
        .post(endpoint)
        .header("Accept", "application/json, text/plain, */*")
        .header("Accept-Language", "en")
        .header("Content-Type", "application/json")
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;
    println!("{:?}", response);
    let status = response.status();
    if !status.is_success() {
        let text = response.text().await.unwrap_or_default();
        return Err(format!("API error {}: {}", status, text));
    }

    let json: CreateSessionResponse = response
        .json()
        .await
        .map_err(|e| format!("JSON parse error: {}", e))?;
    let fetched_url = json.url.clone();

    // Create a new window if not already open.
    let window = WebviewWindowBuilder::new(
        &app_handle,
        window_label,
        WebviewUrl::External(fetched_url.parse().unwrap()),
    )
    .title("Poleshift Chat")
    .inner_size(800.0, 800.0)
    .focused(true)
    .build()
    .map_err(|e| format!("Failed to create window: {}", e))?;

    // Move the newly created window to the bottom-right.
    window
        .move_window(Position::Center)
        .map_err(|e| format!("Failed to move window: {}", e))?;

    Ok("Success".to_string())
}
