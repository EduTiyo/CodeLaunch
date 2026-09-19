use std::collections::HashMap;
use std::path::PathBuf;

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

pub const CURRENT_SCHEMA_VERSION: u32 = 1;

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct Project {
    pub id: Uuid,
    pub name: String,
    pub ide: IdeKind,
    pub folders: Vec<Folder>,
    pub terminals_enabled: bool,
    pub terminal_groups: Vec<TerminalGroup>,
    /// Passthrough for arbitrary IDE-specific settings the UI doesn't model explicitly
    /// (e.g. extra keys under VS Code's workspace "settings").
    pub extra_settings: HashMap<String, serde_json::Value>,
    pub schema_version: u32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl Project {
    pub fn new(name: impl Into<String>, ide: IdeKind) -> Self {
        let now = Utc::now();
        Self {
            id: Uuid::new_v4(),
            name: name.into(),
            ide,
            folders: Vec::new(),
            terminals_enabled: false,
            terminal_groups: Vec::new(),
            extra_settings: HashMap::new(),
            schema_version: CURRENT_SCHEMA_VERSION,
            created_at: now,
            updated_at: now,
        }
    }

    pub fn find_folder(&self, folder_id: Uuid) -> Option<&Folder> {
        self.folders.iter().find(|f| f.id == folder_id)
    }
}

/// Lightweight projection of a [`Project`] for list views, avoiding a full deserialize.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct ProjectSummary {
    pub id: Uuid,
    pub name: String,
    pub ide: IdeKind,
    pub folder_count: usize,
    pub terminal_group_count: usize,
    pub updated_at: DateTime<Utc>,
}

impl From<&Project> for ProjectSummary {
    fn from(project: &Project) -> Self {
        Self {
            id: project.id,
            name: project.name.clone(),
            ide: project.ide,
            folder_count: project.folders.len(),
            terminal_group_count: project.terminal_groups.len(),
            updated_at: project.updated_at,
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct Folder {
    pub id: Uuid,
    /// Display name, also used to resolve `${workspaceFolder:<name>}` in generated tasks.
    pub name: String,
    pub path: PathBuf,
}

impl Folder {
    pub fn new(name: impl Into<String>, path: impl Into<PathBuf>) -> Self {
        Self {
            id: Uuid::new_v4(),
            name: name.into(),
            path: path.into(),
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct TerminalGroup {
    pub id: Uuid,
    pub name: String,
    pub order: u32,
    pub terminals: Vec<Terminal>,
}

impl TerminalGroup {
    pub fn new(name: impl Into<String>, order: u32) -> Self {
        Self {
            id: Uuid::new_v4(),
            name: name.into(),
            order,
            terminals: Vec::new(),
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct Terminal {
    pub id: Uuid,
    pub label: String,
    pub folder_id: Uuid,
    /// Command to run when the terminal opens, without the `keep_alive` wrapper.
    pub command: Option<String>,
    /// When true (default), the terminal is kept alive with an interactive shell
    /// after `command` exits (e.g. after Ctrl+C kills a foreground dev server).
    pub keep_alive: bool,
    /// Left-to-right position within the group's split.
    pub order: u32,
}

impl Terminal {
    pub fn new(label: impl Into<String>, folder_id: Uuid, order: u32) -> Self {
        Self {
            id: Uuid::new_v4(),
            label: label.into(),
            folder_id,
            command: None,
            keep_alive: true,
            order,
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq, Hash, Default)]
#[serde(rename_all = "kebab-case")]
pub enum IdeKind {
    #[default]
    VsCode,
    Cursor,
    Vscodium,
    Windsurf,
}

impl IdeKind {
    pub fn default_binary(&self) -> &'static str {
        match self {
            Self::VsCode => "code",
            Self::Cursor => "cursor",
            Self::Vscodium => "codium",
            Self::Windsurf => "windsurf",
        }
    }

    pub fn display_name(&self) -> &'static str {
        match self {
            Self::VsCode => "VS Code",
            Self::Cursor => "Cursor",
            Self::Vscodium => "VSCodium",
            Self::Windsurf => "Windsurf",
        }
    }
}

impl std::fmt::Display for IdeKind {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.display_name())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ide_kind_serde_roundtrip() {
        for (kind, expected) in [
            (IdeKind::VsCode, "\"vs-code\""),
            (IdeKind::Cursor, "\"cursor\""),
            (IdeKind::Vscodium, "\"vscodium\""),
            (IdeKind::Windsurf, "\"windsurf\""),
        ] {
            let serialized = serde_json::to_string(&kind).unwrap();
            assert_eq!(serialized, expected);
            let deserialized: IdeKind = serde_json::from_str(&serialized).unwrap();
            assert_eq!(deserialized, kind);
        }
    }
}
