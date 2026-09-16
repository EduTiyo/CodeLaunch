pub mod import;
mod tasks;
pub mod workspace_file;

use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

use crate::model::{IdeKind, Project};

use super::{IdeAdapter, RenderedWorkspace, Result};
use workspace_file::{default_vscode_settings, VsCodeFolderEntry, VsCodeWorkspaceFile};

pub use import::parse_vscode_workspace;

pub struct VsCodeAdapter {
    /// The `code` CLI binary name/path. Configurable so users with a non-standard
    /// install (or a fork like a Cursor-style adapter reusing this code) can override it.
    pub cli_binary: String,
}

impl Default for VsCodeAdapter {
    fn default() -> Self {
        Self {
            cli_binary: "code".into(),
        }
    }
}

impl IdeAdapter for VsCodeAdapter {
    fn kind(&self) -> IdeKind {
        IdeKind::VsCode
    }

    fn render(&self, project: &Project, output_dir: &Path) -> Result<RenderedWorkspace> {
        let doc = build_workspace_document(project)?;
        fs::create_dir_all(output_dir)?;

        let path = output_dir.join(format!("{}.code-workspace", slugify(&project.name)));
        let json = serde_json::to_string_pretty(&doc)?;
        fs::write(&path, json)?;

        Ok(RenderedWorkspace {
            entry_path: path,
            generated_files: vec![],
        })
    }

    fn launch_command(&self, workspace: &RenderedWorkspace) -> Command {
        let mut cmd = Command::new(&self.cli_binary);
        cmd.arg("--new-window").arg(&workspace.entry_path);
        cmd
    }
}

/// Pure transformation from a [`Project`] to the serializable workspace document.
/// Exposed for the preview command and for golden-file tests.
pub fn build_workspace_document(project: &Project) -> Result<VsCodeWorkspaceFile> {
    let folders = project
        .folders
        .iter()
        .map(|f| VsCodeFolderEntry {
            name: f.name.clone(),
            path: resolve_folder_path(f),
        })
        .collect();

    let mut settings = default_vscode_settings();
    for (key, value) in &project.extra_settings {
        settings.insert(key.clone(), value.clone());
    }

    let tasks = tasks::build_tasks_section(project);

    Ok(VsCodeWorkspaceFile {
        folders,
        settings,
        tasks,
    })
}

fn resolve_folder_path(folder: &crate::model::Folder) -> String {
    // The generated .code-workspace lives in CodeLaunch's own directory, not next to
    // the user's repositories, so folder paths must be absolute rather than relative.
    let path: PathBuf = if folder.path.is_absolute() {
        folder.path.clone()
    } else {
        std::env::current_dir()
            .unwrap_or_default()
            .join(&folder.path)
    };
    path.to_string_lossy().into_owned()
}

fn slugify(name: &str) -> String {
    let slug: String = name
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() {
                c.to_ascii_lowercase()
            } else {
                '-'
            }
        })
        .collect();
    let slug = slug.trim_matches('-').to_string();
    if slug.is_empty() {
        "project".into()
    } else {
        slug
    }
}
