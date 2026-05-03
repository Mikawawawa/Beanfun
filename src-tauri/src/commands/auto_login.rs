//! Auto-login and session restore commands.
//!
//! This module provides two main commands:
//!
//! 1. [`try_restore_session`] — Attempts to restore a saved session from disk.
//!    If the session is valid (not expired and ping succeeds), the user is
//!    considered logged in without re-entering credentials.
//!
//! 2. [`auto_login`] — If session restore fails, attempts to log in using
//!    saved credentials from `Users.dat` (for accounts with `auto_login=true`).
//!
//! Both commands respect the `enableAutoLogin` config flag and should only be
//! called when the user has explicitly enabled auto-login.

use tauri::{AppHandle, Manager, State};

use crate::services::beanfun::{
    client::{BeanfunClient, ClientConfig, LoginRegion},
    login::{login_hk_regular, login_tw_regular},
    session::Session,
    LoginError,
};
use crate::services::storage::{
    clear_session, default_session_path, load_records, load_session, save_session, PersistedSession,
};
use crate::commands::state::{AppState, AuthContext, PendingTotp};

/// Result of trying to restore or auto-login.
#[derive(Debug, Clone, serde::Serialize, specta::Type)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum AutoLoginResult {
    /// Session restored or login succeeded — user is now authenticated.
    Success,
    /// Session expired or ping failed — need to re-authenticate.
    SessionExpired,
    /// No saved session and no auto-login credentials available.
    NoCredentials,
    /// Login requires TOTP verification.
    RequiresTotp { account_id: String },
    /// Login requires advance verification (email/SMS).
    RequiresVerify { account_id: String },
    /// Login failed with an error message.
    Error { message: String },
}

/// Try to restore a previously saved session.
///
/// This command:
/// 1. Loads the persisted session from disk.
/// 2. Checks if it has expired.
/// 3. Creates a `BeanfunClient` and injects the saved session token.
/// 4. Calls `ping()` to verify the session is still valid on the server.
/// 5. If valid, sets up `AppState::auth` and starts the ping loop.
///
/// # Returns
///
/// - `Success` — Session restored, user is logged in.
/// - `SessionExpired` — Session file missing, expired, or ping failed.
/// - `Error` — Unexpected error during restore.
#[tauri::command]
#[specta::specta]
pub async fn try_restore_session(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<AutoLoginResult, String> {
    let storage_root = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {e}"))?;
    let session_path = default_session_path(&storage_root);

    // Load persisted session.
    let persisted = match load_session(&session_path).await {
        Ok(Some(s)) => s,
        Ok(None) => {
            tracing::info!("No saved session found");
            return Ok(AutoLoginResult::SessionExpired);
        }
        Err(e) => {
            tracing::error!(error = %e, "Failed to load session");
            return Ok(AutoLoginResult::Error {
                message: format!("Failed to load session: {e}"),
            });
        }
    };

    tracing::info!(
        account_id = %persisted.account_id,
        region = %persisted.region,
        "Attempting to restore session"
    );

    // Parse region.
    let region = match persisted.region.as_str() {
        "TW" => LoginRegion::TW,
        "HK" => LoginRegion::HK,
        _ => {
            tracing::warn!(region = %persisted.region, "Unknown region in saved session");
            let _ = clear_session(&session_path).await;
            return Ok(AutoLoginResult::SessionExpired);
        }
    };

    // Create client and inject session.
    let client = BeanfunClient::new(ClientConfig::for_region(region))
        .map_err(|e| format!("Failed to create client: {e}"))?;

    // Inject the saved token into the cookie jar.
    if let Err(e) = client.inject_session_token(&persisted.web_token) {
        tracing::warn!(error = %e, "Failed to inject session token");
        let _ = clear_session(&session_path).await;
        return Ok(AutoLoginResult::SessionExpired);
    }

    // Verify session with ping.
    match client.ping().await {
        Ok(()) => {
            tracing::info!("Session ping succeeded");
        }
        Err(e) => {
            tracing::warn!(error = %e, "Session ping failed");
            let _ = clear_session(&session_path).await;
            return Ok(AutoLoginResult::SessionExpired);
        }
    }

    // Build Session object.
    let session = Session {
        region,
        skey: persisted.skey,
        web_token: persisted.web_token,
        account_id: persisted.account_id.clone(),
        service_code: persisted.service_code,
        service_region: persisted.service_region,
    };

    // Set up auth context.
    let auth = AuthContext::new(client, session);
    let ping_client = auth.client.clone();
    let ping_cancel = auth.ping_cancel.clone();

    // Store in AppState.
    {
        let mut guard = state.auth.write().await;
        *guard = Some(auth);
    }

    // Start ping loop.
    crate::commands::auth::spawn_ping_loop(ping_client, ping_cancel);

    tracing::info!(account_id = %persisted.account_id, "Session restored successfully");
    Ok(AutoLoginResult::Success)
}

/// Attempt to auto-login using saved credentials from Users.dat.
///
/// This command:
/// 1. Loads Users.dat and finds an account with `auto_login=true` and non-empty password.
/// 2. If found, attempts to log in using the saved credentials.
/// 3. On success, saves the new session to disk.
///
/// # Returns
///
/// - `Success` — Login succeeded, session saved.
/// - `NoCredentials` — No account with auto-login enabled.
/// - `RequiresTotp` — Login requires TOTP (account_id included).
/// - `RequiresVerify` — Login requires advance verification.
/// - `Error` — Login failed with error message.
#[tauri::command]
#[specta::specta]
pub async fn auto_login(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<AutoLoginResult, String> {
    let storage_root = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {e}"))?;

    // Load Users.dat.
    let users_dat_path = match crate::services::storage::default_users_dat_path() {
        Ok(p) => p,
        Err(e) => {
            tracing::error!(error = %e, "Failed to get Users.dat path");
            return Ok(AutoLoginResult::Error {
                message: format!("Failed to get accounts path: {e}"),
            });
        }
    };
    let records = match load_records(&users_dat_path).await {
        Ok(r) => r,
        Err(e) => {
            tracing::error!(error = %e, "Failed to load Users.dat");
            return Ok(AutoLoginResult::Error {
                message: format!("Failed to load accounts: {e}"),
            });
        }
    };

    // Find account with auto_login=true and non-empty password.
    let target_account = records
        .0
        .iter()
        .find(|acc| acc.auto_login && !acc.password.is_empty());

    let account = match target_account {
        Some(a) => a.clone(),
        None => {
            tracing::info!("No account with auto_login enabled found");
            return Ok(AutoLoginResult::NoCredentials);
        }
    };

    tracing::info!(
        account_id = %account.account_id,
        region = %account.region,
        "Attempting auto-login"
    );

    // Parse region.
    let region = match account.region.as_str() {
        "TW" => LoginRegion::TW,
        "HK" => LoginRegion::HK,
        _ => {
            return Ok(AutoLoginResult::Error {
                message: format!("Unknown region: {}", account.region),
            });
        }
    };

    // Create client.
    let client = BeanfunClient::new(ClientConfig::for_region(region))
        .map_err(|e| format!("Failed to create client: {e}"))?;

    // Create credentials.
    let creds = crate::services::beanfun::Credentials::new(&account.account_id, &account.password);

    // Perform login.
    let login_result = match region {
        LoginRegion::TW => login_tw_regular(&client, &creds).await,
        LoginRegion::HK => {
            login_hk_regular(
                &client,
                &creds,
                LoginRegion::HK.default_service_code(),
                LoginRegion::HK.default_service_region(),
            )
            .await
        }
    };

    match login_result {
        Ok(session) => {
            // Save session to disk.
            let persisted = PersistedSession {
                region: match session.region {
                    LoginRegion::TW => "TW".to_string(),
                    LoginRegion::HK => "HK".to_string(),
                },
                account_id: session.account_id.clone(),
                skey: session.skey.clone(),
                web_token: session.web_token.clone(),
                service_code: session.service_code.clone(),
                service_region: session.service_region.clone(),
                expires_at: None, // TODO: Determine actual TTL from Beanfun response
                saved_at: std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs() as i64,
            };

            let session_path = default_session_path(&storage_root);
            if let Err(e) = save_session(&session_path, &persisted).await {
                tracing::warn!(error = %e, "Failed to save session, but login succeeded");
                // Continue anyway — user is logged in, just won't have auto-restore next time.
            }

            // Set up auth context.
            let auth = AuthContext::new(client, session);
            let ping_client = auth.client.clone();
            let ping_cancel = auth.ping_cancel.clone();
            {
                let mut guard = state.auth.write().await;
                *guard = Some(auth);
            }

            // Start ping loop.
            crate::commands::auth::spawn_ping_loop(ping_client, ping_cancel);

            tracing::info!(account_id = %account.account_id, "Auto-login succeeded");
            Ok(AutoLoginResult::Success)
        }
        Err(LoginError::TotpRequired(challenge)) => {
            tracing::info!(account_id = %account.account_id, "Auto-login requires TOTP");
            // Store the client and challenge so login_totp can continue the flow.
            *state.pending_totp.write().await = Some(PendingTotp::new(client, *challenge));
            Ok(AutoLoginResult::RequiresTotp {
                account_id: account.account_id,
            })
        }
        Err(LoginError::AdvanceCheckRequired { .. }) => {
            tracing::info!(account_id = %account.account_id, "Auto-login requires verification");
            Ok(AutoLoginResult::RequiresVerify {
                account_id: account.account_id,
            })
        }
        Err(e) => {
            tracing::warn!(error = %e, account_id = %account.account_id, "Auto-login failed");
            Ok(AutoLoginResult::Error {
                message: format!("Login failed: {e}"),
            })
        }
    }
}

/// Clear the saved session (called on logout).
#[tauri::command]
#[specta::specta]
pub async fn clear_saved_session(app: AppHandle) -> Result<(), String> {
    let storage_root = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {e}"))?;
    let session_path = default_session_path(&storage_root);

    match clear_session(&session_path).await {
        Ok(()) => {
            tracing::info!("Saved session cleared");
            Ok(())
        }
        Err(e) => {
            tracing::warn!(error = %e, "Failed to clear saved session");
            // Don't fail logout just because we couldn't delete the file.
            Ok(())
        }
    }
}
