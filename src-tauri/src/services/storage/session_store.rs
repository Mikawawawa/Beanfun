//! Session persistence — encrypted storage for active login session.
//!
//! # Security model
//!
//! Session data (web_token, skey) is encrypted using the same DPAPI +
//! Entropy mechanism as [`super::users_dat`]. The threat model is:
//!
//! - **Same-user access**: DPAPI `CurrentUser` scope protects against
//!   other users on the same machine.
//! - **Cross-device copy**: Ciphertext is bound to the user's Windows
//!   profile; copying the file to another device renders it unreadable.
//! - **Malware running as same user**: This is the same threat model as
//!   `Users.dat` — if malware can read DPAPI-protected files, the
//!   password in `Users.dat` is the higher-value target.
//!
//! Session tokens have TTL (typically 24-72 hours), so the exposure
//! window is bounded even if the file is compromised.
//!
//! # On-disk layout
//!
//! `%APPDATA%\Beanfun\Session.dat` contains DPAPI ciphertext of a
//! JSON-serialized [`PersistedSession`]. The format mirrors `Users.dat`
//! for consistency.
//!
//! # Save flow
//!
//! 1. [`PersistedSession`] → JSON plaintext.
//! 2. Reuse existing entropy from registry (same as `Users.dat`).
//! 3. [`super::dpapi_protect`] → ciphertext.
//! 4. Write to disk.
//!
//! # Load flow
//!
//! 1. Read ciphertext from disk.
//! 2. [`super::dpapi_unprotect`] using registry entropy.
//! 3. JSON parse → [`PersistedSession`].
//! 4. Validate expiration (if present).
//!
//! Any failure (missing file, decrypt failure, parse failure) returns
//! `Ok(None)` — callers treat this as "no saved session" and fall back
//! to normal login flow.

use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use super::error::StorageError;

#[cfg(target_os = "windows")]
use super::{
    dpapi::{dpapi_protect, dpapi_unprotect},
    entropy::{
        read_from_registry_at, write_to_registry_at, Entropy, REGISTRY_SUBKEY, REGISTRY_VALUE_NAME,
    },
};

/// Default filename for the session store, relative to the storage root.
pub const SESSION_FILENAME: &str = "Session.dat";

/// Session data persisted to disk. All sensitive fields are encrypted
/// via DPAPI.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct PersistedSession {
    /// Login region — "TW" or "HK".
    pub region: String,
    /// Account ID that was logged in.
    pub account_id: String,
    /// Session key (pSKey) from the portal.
    pub skey: String,
    /// bfWebToken — the actual session bearer.
    pub web_token: String,
    /// Service code (e.g., "610074" for MapleStory).
    pub service_code: String,
    /// Service region (e.g., "T9").
    pub service_region: String,
    /// Optional expiration timestamp (Unix seconds). If present and
    /// passed, the session is treated as expired.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub expires_at: Option<i64>,
    /// When the session was saved (Unix seconds).
    pub saved_at: i64,
}

impl PersistedSession {
    /// Check if the session has expired based on `expires_at`.
    pub fn is_expired(&self) -> bool {
        if let Some(expires) = self.expires_at {
            let now = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs() as i64;
            now >= expires
        } else {
            false
        }
    }
}

/// Build the default session file path under `storage_root`.
pub fn default_session_path(storage_root: &Path) -> PathBuf {
    storage_root.join(SESSION_FILENAME)
}

/// Save `session` to `path`, encrypted with DPAPI using the same
/// entropy mechanism as `Users.dat`.
///
/// # Errors
///
/// Returns [`StorageError::Registry`] if the entropy cannot be read
/// from or written to the registry.
/// Returns [`StorageError::Dpapi`] if DPAPI protection fails.
/// Returns [`StorageError::Io`] if file write fails.
#[cfg(target_os = "windows")]
pub async fn save_session(path: &Path, session: &PersistedSession) -> Result<(), StorageError> {
    save_session_at(path, session, REGISTRY_SUBKEY, REGISTRY_VALUE_NAME).await
}

/// Lower-level variant for testing — avoids polluting production registry.
#[cfg(target_os = "windows")]
pub async fn save_session_at(
    path: &Path,
    session: &PersistedSession,
    entropy_subkey: &str,
    entropy_value_name: &str,
) -> Result<(), StorageError> {
    let path = path.to_path_buf();
    let plaintext = serde_json::to_string(session).map_err(|e| {
        StorageError::Io(std::io::Error::new(
            std::io::ErrorKind::InvalidData,
            format!("JSON serialize failed: {e}"),
        ))
    })?;
    let subkey = entropy_subkey.to_string();
    let value_name = entropy_value_name.to_string();

    spawn_blocking_storage(move || {
        save_session_blocking(&path, &plaintext, &subkey, &value_name)
    })
    .await
}

#[cfg(target_os = "windows")]
fn save_session_blocking(
    path: &Path,
    plaintext: &str,
    entropy_subkey: &str,
    entropy_value_name: &str,
) -> Result<(), StorageError> {
    // Reuse existing entropy if available, otherwise generate new.
    let entropy = match read_from_registry_at(entropy_subkey, entropy_value_name) {
        Ok(e) => e,
        Err(_) => {
            let e = Entropy::generate();
            write_to_registry_at(entropy_subkey, entropy_value_name, &e)?;
            e
        }
    };

    let cipher = dpapi_protect(plaintext.as_bytes(), entropy.as_bytes())?;

    if let Some(parent) = path.parent() {
        if !parent.as_os_str().is_empty() {
            std::fs::create_dir_all(parent).map_err(StorageError::Io)?;
        }
    }
    std::fs::write(path, &cipher).map_err(StorageError::Io)?;
    Ok(())
}

/// Load a [`PersistedSession`] from `path`.
///
/// Returns `Ok(None)` if:
/// - The file does not exist.
/// - Decryption fails (wrong entropy, corrupted file).
/// - JSON parsing fails.
/// - The session has expired (based on `expires_at`).
///
/// Returns `Err` only for actual I/O errors reading the file.
#[cfg(target_os = "windows")]
pub async fn load_session(path: &Path) -> Result<Option<PersistedSession>, StorageError> {
    load_session_at(path, REGISTRY_SUBKEY, REGISTRY_VALUE_NAME).await
}

/// Lower-level variant for testing.
#[cfg(target_os = "windows")]
pub async fn load_session_at(
    path: &Path,
    entropy_subkey: &str,
    entropy_value_name: &str,
) -> Result<Option<PersistedSession>, StorageError> {
    let path = path.to_path_buf();
    let subkey = entropy_subkey.to_string();
    let value_name = entropy_value_name.to_string();

    spawn_blocking_storage(move || load_session_blocking(&path, &subkey, &value_name)).await
}

#[cfg(target_os = "windows")]
fn load_session_blocking(
    path: &Path,
    entropy_subkey: &str,
    entropy_value_name: &str,
) -> Result<Option<PersistedSession>, StorageError> {
    // Read file. Missing file is not an error — just no saved session.
    let cipher = match std::fs::read(path) {
        Ok(bytes) => bytes,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(e) => return Err(StorageError::Io(e)),
    };

    // Read entropy from registry. If missing, we can't decrypt.
    let entropy = match read_from_registry_at(entropy_subkey, entropy_value_name) {
        Ok(e) => e,
        Err(_) => {
            tracing::warn!("Session entropy missing from registry, cannot decrypt");
            return Ok(None);
        }
    };

    // Decrypt. Any failure (wrong entropy, tampered ciphertext) is
    // treated as "no valid session" — delete the corrupted file.
    let plain = match dpapi_unprotect(&cipher, entropy.as_bytes()) {
        Ok(p) => p,
        Err(e) => {
            tracing::warn!(error = %e, "Session decryption failed, deleting corrupted file");
            let _ = std::fs::remove_file(path);
            return Ok(None);
        }
    };

    // Parse JSON.
    let session: PersistedSession = match serde_json::from_slice(&plain) {
        Ok(s) => s,
        Err(e) => {
            tracing::warn!(error = %e, "Session JSON parse failed, deleting corrupted file");
            let _ = std::fs::remove_file(path);
            return Ok(None);
        }
    };

    // Check expiration.
    if session.is_expired() {
        tracing::info!("Saved session has expired");
        let _ = std::fs::remove_file(path);
        return Ok(None);
    }

    Ok(Some(session))
}

/// Clear (delete) the saved session file at `path`.
///
/// Returns `Ok(())` even if the file does not exist.
pub async fn clear_session(path: &Path) -> Result<(), StorageError> {
    let path = path.to_path_buf();
    spawn_blocking_storage(move || {
        match std::fs::remove_file(&path) {
            Ok(()) => Ok(()),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
            Err(e) => Err(StorageError::Io(e)),
        }
    })
    .await
}

/// Run a blocking storage closure on the tokio blocking pool.
#[cfg(target_os = "windows")]
async fn spawn_blocking_storage<F, R>(f: F) -> Result<R, StorageError>
where
    F: FnOnce() -> Result<R, StorageError> + Send + 'static,
    R: Send + 'static,
{
    tokio::task::spawn_blocking(f)
        .await
        .map_err(|join_err| {
            StorageError::Io(std::io::Error::other(format!(
                "blocking storage task panicked: {join_err}"
            )))
        })?
}

// Stub implementations for non-Windows platforms (for compilation only).
#[cfg(not(target_os = "windows"))]
pub async fn save_session(_path: &Path, _session: &PersistedSession) -> Result<(), StorageError> {
    Err(StorageError::Io(std::io::Error::new(
        std::io::ErrorKind::Unsupported,
        "Session store is Windows-only",
    )))
}

#[cfg(not(target_os = "windows"))]
pub async fn load_session(_path: &Path) -> Result<Option<PersistedSession>, StorageError> {
    Ok(None)
}

#[cfg(not(target_os = "windows"))]
pub async fn clear_session(_path: &Path) -> Result<(), StorageError> {
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn persisted_session_expiration_check() {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64;

        // Not expired (future).
        let session = PersistedSession {
            region: "TW".to_string(),
            account_id: "test".to_string(),
            skey: "skey".to_string(),
            web_token: "token".to_string(),
            service_code: "610074".to_string(),
            service_region: "T9".to_string(),
            expires_at: Some(now + 3600),
            saved_at: now,
        };
        assert!(!session.is_expired());

        // Expired (past).
        let expired = PersistedSession {
            expires_at: Some(now - 1),
            ..session.clone()
        };
        assert!(expired.is_expired());

        // No expiration.
        let no_expiry = PersistedSession {
            expires_at: None,
            ..session
        };
        assert!(!no_expiry.is_expired());
    }

    #[test]
    fn default_session_path_builds_correctly() {
        let root = Path::new("C:\\AppData\\Beanfun");
        let path = default_session_path(root);
        assert_eq!(path, Path::new("C:\\AppData\\Beanfun\\Session.dat"));
    }
}
