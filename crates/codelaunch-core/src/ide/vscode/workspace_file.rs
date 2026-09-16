//! Serde model for VS Code's `.code-workspace` file format — just the subset
//! CodeLaunch needs to read and write (folders, settings, tasks).
//!
//! Written as strict JSON via `serde_json`, which VS Code accepts fine (JSON5 is
//! a superset used for the *comments/trailing-commas* convenience VS Code allows,
//! not a requirement).

use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct VsCodeWorkspaceFile {
    pub folders: Vec<VsCodeFolderEntry>,
    #[serde(default)]
    pub settings: Map<String, Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tasks: Option<VsCodeTasksSection>,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct VsCodeFolderEntry {
    pub name: String,
    pub path: String,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct VsCodeTasksSection {
    pub version: String,
    pub tasks: Vec<VsCodeTask>,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Default)]
pub struct VsCodeTask {
    pub label: String,
    #[serde(rename = "type", skip_serializing_if = "Option::is_none")]
    pub task_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub command: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub args: Vec<String>,
    #[serde(rename = "isBackground", skip_serializing_if = "Option::is_none")]
    pub is_background: Option<bool>,
    #[serde(
        rename = "problemMatcher",
        default,
        skip_serializing_if = "Option::is_none"
    )]
    pub problem_matcher: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub presentation: Option<VsCodePresentation>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub options: Option<VsCodeTaskOptions>,
    #[serde(rename = "dependsOn", default, skip_serializing_if = "Vec::is_empty")]
    pub depends_on: Vec<String>,
    #[serde(rename = "dependsOrder", skip_serializing_if = "Option::is_none")]
    pub depends_order: Option<String>,
    #[serde(rename = "runOptions", skip_serializing_if = "Option::is_none")]
    pub run_options: Option<VsCodeRunOptions>,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct VsCodePresentation {
    pub reveal: String,
    pub panel: String,
    pub group: String,
    pub focus: bool,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct VsCodeTaskOptions {
    pub cwd: String,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct VsCodeRunOptions {
    #[serde(rename = "runOn")]
    pub run_on: String,
}

/// Settings required for the auto-open-terminals mechanism to work, merged with
/// (and overridable by) `Project.extra_settings`.
pub fn default_vscode_settings() -> Map<String, Value> {
    let mut settings = Map::new();
    settings.insert(
        "terminal.integrated.enablePersistentSessions".into(),
        Value::Bool(true),
    );
    settings.insert(
        "terminal.integrated.persistentSessionReviveProcess".into(),
        Value::String("onExit".into()),
    );
    settings.insert(
        "terminal.integrated.defaultProfile.osx".into(),
        Value::String("zsh".into()),
    );
    settings.insert(
        "terminal.integrated.splitCwd".into(),
        Value::String("inherited".into()),
    );
    settings.insert("task.allowAutomaticTasks".into(), Value::String("on".into()));
    settings
}
