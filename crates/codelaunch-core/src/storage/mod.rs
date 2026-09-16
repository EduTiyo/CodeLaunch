pub mod project_repo;

use std::path::PathBuf;

pub use project_repo::{default_projects_dir, FsProjectRepository, ProjectRepository, RepoError};

use crate::model::project::CURRENT_SCHEMA_VERSION;

/// Base config directory for the app, respecting OS conventions
/// (e.g. `~/Library/Application Support/codelaunch` on macOS).
pub fn config_dir() -> Option<PathBuf> {
    directories::ProjectDirs::from("dev", "codelaunch", "CodeLaunch")
        .map(|dirs| dirs.config_dir().to_path_buf())
}

pub fn default_workspaces_dir() -> Option<PathBuf> {
    config_dir().map(|dir| dir.join("workspaces"))
}

/// Migrates a persisted project JSON value to [`CURRENT_SCHEMA_VERSION`].
/// A no-op today since only version 1 exists, but kept as the single seam
/// future migrations plug into.
pub fn migrate_schema(value: serde_json::Value) -> serde_json::Value {
    let version = value
        .get("schema_version")
        .and_then(|v| v.as_u64())
        .unwrap_or(CURRENT_SCHEMA_VERSION as u64);

    match version {
        v if v == CURRENT_SCHEMA_VERSION as u64 => value,
        // Future: `1 => migrate_v1_to_v2(value)` etc.
        _ => value,
    }
}
