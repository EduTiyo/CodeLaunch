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
        let binary = resolve_cli_path(&self.cli_binary);
        let mut cmd = Command::new(binary);
        cmd.arg("--new-window").arg(&workspace.entry_path);
        cmd
    }
}

/// Resolves the CLI binary path by searching `PATH` and checking well-known IDE installation paths.
/// This prevents failures in packaged GUI apps (e.g. on macOS) where the launcher environment
/// has a minimal `PATH` that does not include `/opt/homebrew/bin` or standard application bundles.
pub fn resolve_cli_path(binary: &str) -> PathBuf {
    let path = PathBuf::from(binary);
    if binary.contains(std::path::MAIN_SEPARATOR) || binary.contains('/') {
        return path;
    }

    // 1. Search in PATH
    if let Some(path_var) = std::env::var_os("PATH") {
        for dir in std::env::split_paths(&path_var) {
            let candidate = dir.join(binary);
            if candidate.is_file() {
                return candidate;
            }
        }
    }

    // 2. OS-specific known locations when resolving default 'code'
    if binary == "code" {
        #[cfg(target_os = "macos")]
        {
            let candidates = [
                "/opt/homebrew/bin/code",
                "/usr/local/bin/code",
                "/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code",
                "/Applications/Visual Studio Code - Insiders.app/Contents/Resources/app/bin/code",
            ];
            for candidate in candidates {
                let p = PathBuf::from(candidate);
                if p.is_file() {
                    return p;
                }
            }
            if let Some(dirs) = directories::BaseDirs::new() {
                let home = dirs.home_dir();
                let user_candidates = [
                    home.join(".local/bin/code"),
                    home.join("bin/code"),
                    home.join("Applications/Visual Studio Code.app/Contents/Resources/app/bin/code"),
                ];
                for candidate in user_candidates {
                    if candidate.is_file() {
                        return candidate;
                    }
                }
            }
        }

        #[cfg(target_os = "windows")]
        {
            if let Some(dirs) = directories::BaseDirs::new() {
                let candidate = dirs
                    .data_local_dir()
                    .join("Programs/Microsoft VS Code/bin/code.cmd");
                if candidate.is_file() {
                    return candidate;
                }
            }
            let candidates = [
                "C:\\Program Files\\Microsoft VS Code\\bin\\code.cmd",
                "C:\\Program Files (x86)\\Microsoft VS Code\\bin\\code.cmd",
            ];
            for candidate in candidates {
                let p = PathBuf::from(candidate);
                if p.is_file() {
                    return candidate;
                }
            }
        }

        #[cfg(target_os = "linux")]
        {
            let candidates = [
                "/usr/bin/code",
                "/snap/bin/code",
                "/usr/local/bin/code",
            ];
            for candidate in candidates {
                let p = PathBuf::from(candidate);
                if p.is_file() {
                    return p;
                }
            }
        }
    }

    path
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resolve_cli_path_preserves_explicit_paths() {
        let explicit = "/custom/bin/code";
        assert_eq!(resolve_cli_path(explicit), PathBuf::from(explicit));
    }

    #[test]
    fn resolve_cli_path_finds_code_on_system() {
        let resolved = resolve_cli_path("code");
        // On macOS or Unix where VS Code or Homebrew is installed, it should resolve to an existing file
        #[cfg(target_os = "macos")]
        {
            if Path::new("/Applications/Visual Studio Code.app").exists()
                || Path::new("/opt/homebrew/bin/code").exists()
            {
                assert!(resolved.is_file(), "expected resolved path to exist: {:?}", resolved);
            }
        }
    }
}
