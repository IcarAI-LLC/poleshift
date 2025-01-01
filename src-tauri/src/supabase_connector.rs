use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::async_runtime::Mutex as AsyncMutex;
use lazy_static::lazy_static;

use supabase_rs::SupabaseClient;
use supabase_auth::models::{AuthClient, LogoutScope, Session, User};

const SUPABASE_URL: &str = env!("VITE_SUPABASE_URL");
const SUPABASE_ANON_KEY: &str = env!("VITE_SUPABASE_ANON");
const SUPABASE_JWT_SECRET: &str = env!("VITE_SUPABASE_JWT");

/// Adjust these as needed to match your TS definitions for `UserRole` or other user-related data.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum UserRole {
    Admin,
    Lead,
    Researcher,
    Viewer,
    // etc.
}

/// Example of your PoleshiftPermissions or other permission sets.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PoleshiftPermissions {
    // For demonstration, define them how you wish
    AdminPermission,
    LeadPermission,
    ResearcherPermission,
    ViewerPermission,
}

/// This mirrors the TypeScript `CrudEntry` interface.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CrudEntry {
    pub data: serde_json::Value,
    pub id: String,
    pub op: UpdateType,
    pub op_id: u64,
    pub tx_id: u64,
    #[serde(rename = "type")]
    pub type_: String,
}

/// This mirrors the TypeScript `UpdateType` enum.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "UPPERCASE")]
pub enum UpdateType {
    PUT,
    PATCH,
    DELETE,
}

/// A helper struct for your "fetchCredentials" return shape.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Credentials {
    pub endpoint: String,
    pub token: String,
    pub expires_at: u64,
    // Optionally include user fields as needed.
    pub user: User,
}

/// A struct to hold your `SupabaseClient` and any relevant local state.
/// You can expand this to store sessions, last_user_id, user roles, etc. as needed.
pub struct SupabaseConnector {
    pub client: SupabaseClient,
    pub auth_client: AuthClient,
    pub session: Option<Session>,
    pub last_user_id: Option<String>,
    // Example usage: store a “fatal” code list or similar
    pub fatal_response_codes: Vec<regex::Regex>,
}

/// Lazy-initialized global instance of `SupabaseConnector`.
/// In a real-world app, you might want to store environment variables differently
/// and handle re-initialization carefully.
lazy_static! {
    static ref SUPABASE_CONNECTOR: AsyncMutex<SupabaseConnector> = AsyncMutex::new(
        SupabaseConnector::new()
    );
}

impl SupabaseConnector {
    /// Constructor. Adjust to match your environment variable usage,
    /// or pass in parameters from `tauri.conf.json`.
    pub fn new() -> Self {
        let supabase_url: String = SUPABASE_URL.parse().unwrap();
        let supabase_anon_key: String = SUPABASE_ANON_KEY.parse().unwrap();
        let supabase_jwt: String = SUPABASE_JWT_SECRET.parse().unwrap();
        // Create the client
        let client = SupabaseClient::new(supabase_url.clone(), supabase_anon_key.clone())
            .expect("Failed to create SupabaseClient");
        let auth_client = AuthClient::new(supabase_url, supabase_anon_key, supabase_jwt);

        // Example: If you have certain known fatal error codes you want to handle specially
        let fatal_codes = vec![
            regex::Regex::new(r"^22P02$").unwrap(), // example Postgres error code
        ];

        Self {
            client,
            auth_client,
            session: None,
            last_user_id: None,
            fatal_response_codes: fatal_codes,
        }
    }
}

// -----------------------
// TAURI COMMANDS
// -----------------------

#[tauri::command]
pub async fn login(email: String, password: String) -> Result<(), String> {
    let mut connector = SUPABASE_CONNECTOR.lock().await;

    // "login_with_email(...)" returns a Session on success, not an Option<Session>.
    match connector.auth_client.login_with_email(&email, &password).await {
        Ok(session) => {
            connector.last_user_id = Option::from(session.user.id.clone());
            // If we have a valid session, store it as Some(session)
            connector.session = Some(session);
            Ok(())
        }
        Err(e) => Err(format!("Error during login: {:?}", e)),
    }
}

#[tauri::command]
pub async fn sign_up(email: String, password: String) -> Result<(), String> {
    let connector = SUPABASE_CONNECTOR.lock().await;
    // sign_up_with_email_and_password returns a Session on success, or an error
    match connector
        .auth_client
        .sign_up_with_email_and_password(&email, &password, None)
        .await
    {
        Ok(_session) => Ok(()),
        Err(e) => Err(format!("Error during sign up: {:?}", e)),
    }
}

#[tauri::command]
pub async fn logout() -> Result<(), String> {
    let mut connector = SUPABASE_CONNECTOR.lock().await;

    if let Some(ref session) = connector.session {
        // We have a session, so attempt the logout
        match connector
            .auth_client
            .logout(Some(LogoutScope::Global), &session.access_token)
            .await
        {
            Ok(_) => {
                // Clear local session
                connector.session = None;
                connector.last_user_id = None;
                Ok(())
            }
            Err(e) => Err(format!("Error during logout: {:?}", e)),
        }
    } else {
        // If no session exists, there's nothing to log out of
        Ok(())
    }
}

#[tauri::command]
pub async fn reset_password(email: String) -> Result<(), String> {
    let connector = SUPABASE_CONNECTOR.lock().await;
    match connector.auth_client.reset_password_for_email(&email).await {
        Ok(_) => Ok(()),
        Err(e) => Err(format!("Error during password reset: {:?}", e)),
    }
}

#[tauri::command]
pub async fn fetch_credentials() -> Result<Option<Credentials>, String> {
    let endpoint = std::env::var("VITE_POWERSYNC_URL").unwrap_or_default();
    let connector = SUPABASE_CONNECTOR.lock().await;

    if let Some(ref session) = connector.session {

        Ok(Some(Credentials {
            endpoint,
            token: session.access_token.clone(),
            expires_at: session.expires_at.clone(),
            user: session.user.clone(),
        }))
    } else {
        Ok(None)
    }
}

#[tauri::command]
pub async fn invoke_supabase_function() -> Result<Option<Credentials>, String> {
    let endpoint = std::env::var("VITE_POWERSYNC_URL").unwrap_or_default();
    let connector = SUPABASE_CONNECTOR.lock().await;

    if let Some(ref session) = connector.session {

        Ok(Some(Credentials {
            endpoint,
            token: session.access_token.clone(),
            expires_at: session.expires_at.clone(),
            user: session.user.clone(),
        }))
    } else {
        Ok(None)
    }
}



/// Example function that groups operations by `table` + `opType`.
fn group_by_table_and_op(ops: &[CrudEntry]) -> HashMap<String, Vec<CrudEntry>> {
    let mut map: HashMap<String, Vec<CrudEntry>> = HashMap::new();
    for op in ops {
        let key = format!("{}-{}", op.type_, op.op.to_string());
        map.entry(key).or_default().push(op.clone());
    }
    map
}

/**
 * A small async retry helper that does not spawn separate tasks.
 *
 * - `func()` should be an async closure returning `Result<T, E>`.
 * - We loop up to `retries + 1` times.
 */
async fn retry_async<F, T, E>(
    mut func: F,
    mut retries: usize,
    mut delay: u64,
    factor: u64,
) -> Result<T, E>
where
// We expect something that when called, returns a Future that yields `Result<T, E>`
    F: FnMut() -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<T, E>> + Send>>,
{
    loop {
        match func().await {
            Ok(val) => {
                return Ok(val);
            }
            Err(e) => {
                if retries == 0 {
                    return Err(e);
                }
                eprintln!("Retrying in {} ms... ({} retries left)", delay, retries);
                tokio::time::sleep(std::time::Duration::from_millis(delay)).await;
                retries -= 1;
                delay *= factor;
            }
        }
    }
}

/**
 * Example of how you might implement a batched “uploadData” method
 * using a vector of CrudEntries.  In your actual app, adjust to match
 * your supabase_rs usage, especially inside the closures passed to `retry_async`.
 */
#[tauri::command]
pub async fn upload_data(crud_entries: Vec<CrudEntry>) -> Result<(), String> {
    let connector = SUPABASE_CONNECTOR.lock().await;
    if crud_entries.is_empty() {
        println!("No transactions to upload.");
        return Ok(());
    }

    println!("Uploading data with batching...");

    let grouped_ops = group_by_table_and_op(&crud_entries);

    let mut last_op: Option<CrudEntry> = None;

    for (key, ops) in grouped_ops.into_iter() {
        if ops.is_empty() {
            continue;
        }

        let parts: Vec<&str> = key.split('-').collect();
        if parts.len() != 2 {
            return Err(format!("Invalid group key: {}", key));
        }
        let table_name = parts[0];
        let op_type = parts[1];

        match op_type {
            // ---------------------------
            // PUT (changed to *non*-bulk upsert)
            // ---------------------------
            "PUT" => {
                // Handle each PUT item individually (no bulk upsert).
                for op in ops {
                    last_op = Some(op.clone());

                    let id_copy = op.id.clone();
                    let data_copy = op.data.clone();
                    let tn = table_name.to_string();
                    let client = connector.client.clone();

                    retry_async(
                        || {
                            let id2 = id_copy.clone();
                            let data2 = data_copy.clone();
                            let tn2 = tn.clone();
                            let client2 = client.clone();

                            Box::pin(async move {
                                // Depending on supabase_rs usage:
                                // upsert might look like `client2.upsert(&tn2, &id2, data2).await`
                                client2.upsert_without_defined_key(&tn2, data2).await
                            })
                        },
                        3,
                        1000,
                        2,
                    )
                        .await
                        .map_err(|e| {
                            format!(
                                "Error in PUT (upsert) for table [{}]. Last operation: {:?}. Error: {:?}",
                                table_name, last_op, e
                            )
                        })?;
                }
            }

            "PATCH" => {
                // For PATCH, do them one at a time
                for op in ops {
                    last_op = Some(op.clone());

                    let id_copy = op.id.clone();
                    let data_copy = op.data.clone();
                    let tn = table_name.to_string();
                    let client = connector.client.clone();

                    retry_async(
                        || {
                            let id2 = id_copy.clone();
                            let data2 = data_copy.clone();
                            let tn2 = tn.clone();
                            let client2 = client.clone();

                            Box::pin(async move {
                                // e.g. client2.update(table_name, id, data)
                                client2.update(&tn2, &id2, data2).await
                            })
                        },
                        3,
                        1000,
                        2,
                    )
                        .await
                        .map_err(|e| {
                            format!(
                                "Error in PATCH for table [{}]. Last operation: {:?}. Error: {:?}",
                                table_name, last_op, e
                            )
                        })?;
                }
            }

            "DELETE" => {
                // For DELETE -> single in(...) delete or loop
                let ids_to_delete: Vec<String> = ops
                    .iter()
                    .map(|op| {
                        last_op = Some(op.clone());
                        op.id.clone()
                    })
                    .collect();

                let joined_ids = ids_to_delete.join(",");

                let tn = table_name.to_string();
                let client = connector.client.clone();

                retry_async(
                    || {
                        let tn2 = tn.clone();
                        let ids_copy = joined_ids.clone();
                        let client2 = client.clone();
                        Box::pin(async move {
                            // e.g. client2.delete(table_name, "id1,id2,...")
                            client2.delete(&tn2, &ids_copy).await
                        })
                    },
                    3,
                    1000,
                    2,
                )
                    .await
                    .map_err(|e| {
                        format!(
                            "Error in DELETE for table [{}]. Last operation: {:?}. Error: {:?}",
                            table_name, last_op, e
                        )
                    })?;
            }

            _ => {
                return Err(format!("Unsupported operation type: {}", op_type));
            }
        }
    }

    println!("Data upload successful.");
    Ok(())
}

// If you have additional logic for role-based permissions, decoding JWT payload, etc.,
// you can add more Tauri commands or internal methods here.

/// A quick helper so `op.op` can be turned into a string for building map keys, etc.
impl ToString for UpdateType {
    fn to_string(&self) -> String {
        match self {
            UpdateType::PUT => "PUT".to_string(),
            UpdateType::PATCH => "PATCH".to_string(),
            UpdateType::DELETE => "DELETE".to_string(),
        }
    }
}
