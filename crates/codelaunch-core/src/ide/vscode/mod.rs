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
    pub kind: IdeKind,
    /// The CLI binary name/path. Configurable so users with a non-standard
    /// install (or a fork like Cursor, VSCodium, Windsurf) can override it.
    pub cli_binary: String,
}

impl VsCodeAdapter {
    pub fn new(kind: IdeKind, cli_binary: impl Into<String>) -> Self {
        Self {
            kind,
            cli_binary: cli_binary.into(),
        }
    }
}

impl Default for VsCodeAdapter {
    fn default() -> Self {
        Self::new(IdeKind::VsCode, "code")
    }
}

impl IdeAdapter for VsCodeAdapter {
    fn kind(&self) -> IdeKind {
        self.kind
    }

    fn render(&self, project: &Project, output_dir: &Path) -> Result<RenderedWorkspace> {
        let doc = build_workspace_document(project)?;
        let project_dir = output_dir.join(project.id.to_string());
        fs::create_dir_all(&project_dir)?;

        // Remove previous workspace file(s) in this project's folder (e.g. if the project was renamed)
        if let Ok(entries) = fs::read_dir(&project_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.extension().and_then(|s| s.to_str()) == Some("code-workspace") {
                    let _ = fs::remove_file(path);
                }
            }
        }

        let path = project_dir.join(format!("{}.code-workspace", slugify(&project.name)));
        let json = serde_json::to_string_pretty(&doc)?;
        fs::write(&path, json)?;

        Ok(RenderedWorkspace {
            entry_path: path,
            generated_files: vec![],
        })
    }

    fn launch_command(&self, workspace: &RenderedWorkspace) -> Command {
        let binary = resolve_cli_path(&self.cli_binary);
        #[cfg(target_os = "windows")]
        {
            let binary_str = binary.to_string_lossy().to_lowercase();
            if !binary_str.ends_with(".exe") {
                let mut cmd = Command::new("cmd");
                use std::os::windows::process::CommandExt;
                cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
                cmd.arg("/c")
                    .arg(&binary)
                    .arg("--new-window")
                    .arg(&workspace.entry_path);
                return cmd;
            }
        }
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
            #[cfg(target_os = "windows")]
            {
                // On Windows, do not match extensionless scripts (e.g. `bin/code` shell script).
                // Search for executable extensions: .exe, .cmd, .bat
                for ext in &[".exe", ".cmd", ".bat"] {
                    let candidate = if binary.to_lowercase().ends_with(ext) {
                        dir.join(binary)
                    } else {
                        dir.join(format!("{binary}{ext}"))
                    };
                    if candidate.is_file() {
                        return candidate;
                    }
                }
            }
            #[cfg(not(target_os = "windows"))]
            {
                let candidate = dir.join(binary);
                if candidate.is_file() {
                    return candidate;
                }
            }
        }
    }

    // 2. OS-specific known locations for supported IDE binaries
    let known_candidates: &[&str] = match binary {
        "code" => &[
            #[cfg(target_os = "macos")]
            "/opt/homebrew/bin/code",
            #[cfg(target_os = "macos")]
            "/usr/local/bin/code",
            #[cfg(target_os = "macos")]
            "/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code",
            #[cfg(target_os = "macos")]
            "/Applications/Visual Studio Code - Insiders.app/Contents/Resources/app/bin/code",
            #[cfg(target_os = "windows")]
            "C:\\Program Files\\Microsoft VS Code\\Code.exe",
            #[cfg(target_os = "windows")]
            "C:\\Program Files\\Microsoft VS Code\\bin\\code.cmd",
            #[cfg(target_os = "windows")]
            "C:\\Program Files (x86)\\Microsoft VS Code\\Code.exe",
            #[cfg(target_os = "windows")]
            "C:\\Program Files (x86)\\Microsoft VS Code\\bin\\code.cmd",
            #[cfg(target_os = "linux")]
            "/usr/bin/code",
            #[cfg(target_os = "linux")]
            "/snap/bin/code",
            #[cfg(target_os = "linux")]
            "/usr/local/bin/code",
        ],
        "cursor" => &[
            #[cfg(target_os = "macos")]
            "/opt/homebrew/bin/cursor",
            #[cfg(target_os = "macos")]
            "/usr/local/bin/cursor",
            #[cfg(target_os = "macos")]
            "/Applications/Cursor.app/Contents/Resources/app/bin/cursor",
            #[cfg(target_os = "macos")]
            "/Applications/Cursor.app/Contents/MacOS/Cursor",
            #[cfg(target_os = "windows")]
            "C:\\Program Files\\Cursor\\Cursor.exe",
            #[cfg(target_os = "windows")]
            "C:\\Program Files\\Cursor\\bin\\cursor.cmd",
            #[cfg(target_os = "windows")]
            "C:\\Program Files\\Cursor\\resources\\app\\bin\\cursor.cmd",
            #[cfg(target_os = "linux")]
            "/usr/bin/cursor",
            #[cfg(target_os = "linux")]
            "/snap/bin/cursor",
            #[cfg(target_os = "linux")]
            "/usr/local/bin/cursor",
        ],
        "codium" => &[
            #[cfg(target_os = "macos")]
            "/opt/homebrew/bin/codium",
            #[cfg(target_os = "macos")]
            "/usr/local/bin/codium",
            #[cfg(target_os = "macos")]
            "/Applications/VSCodium.app/Contents/Resources/app/bin/codium",
            #[cfg(target_os = "macos")]
            "/Applications/VSCodium - Insiders.app/Contents/Resources/app/bin/codium",
            #[cfg(target_os = "windows")]
            "C:\\Program Files\\VSCodium\\VSCodium.exe",
            #[cfg(target_os = "windows")]
            "C:\\Program Files\\VSCodium\\bin\\codium.cmd",
            #[cfg(target_os = "linux")]
            "/usr/bin/codium",
            #[cfg(target_os = "linux")]
            "/snap/bin/codium",
            #[cfg(target_os = "linux")]
            "/usr/local/bin/codium",
        ],
        "windsurf" => &[
            #[cfg(target_os = "macos")]
            "/opt/homebrew/bin/windsurf",
            #[cfg(target_os = "macos")]
            "/usr/local/bin/windsurf",
            #[cfg(target_os = "macos")]
            "/Applications/Windsurf.app/Contents/Resources/app/bin/windsurf",
            #[cfg(target_os = "macos")]
            "/Applications/Windsurf.app/Contents/MacOS/Windsurf",
            #[cfg(target_os = "windows")]
            "C:\\Program Files\\Windsurf\\Windsurf.exe",
            #[cfg(target_os = "windows")]
            "C:\\Program Files\\Windsurf\\bin\\windsurf.cmd",
            #[cfg(target_os = "linux")]
            "/usr/bin/windsurf",
            #[cfg(target_os = "linux")]
            "/snap/bin/windsurf",
            #[cfg(target_os = "linux")]
            "/usr/local/bin/windsurf",
        ],
        _ => &[],
    };

    for candidate in known_candidates {
        let p = PathBuf::from(candidate);
        if p.is_file() {
            return p;
        }
    }

    #[cfg(any(target_os = "macos", target_os = "windows", target_os = "linux"))]
    if let Some(dirs) = directories::BaseDirs::new() {
        #[cfg(target_os = "macos")]
        {
            let home = dirs.home_dir();
            let user_candidates: Vec<PathBuf> = match binary {
                "code" => vec![
                    home.join(".local/bin/code"),
                    home.join("bin/code"),
                    home.join(
                        "Applications/Visual Studio Code.app/Contents/Resources/app/bin/code",
                    ),
                ],
                "cursor" => vec![
                    home.join(".local/bin/cursor"),
                    home.join("bin/cursor"),
                    home.join("Applications/Cursor.app/Contents/Resources/app/bin/cursor"),
                ],
                "codium" => vec![
                    home.join(".local/bin/codium"),
                    home.join("bin/codium"),
                    home.join("Applications/VSCodium.app/Contents/Resources/app/bin/codium"),
                ],
                "windsurf" => vec![
                    home.join(".local/bin/windsurf"),
                    home.join("bin/windsurf"),
                    home.join("Applications/Windsurf.app/Contents/Resources/app/bin/windsurf"),
                ],
                _ => vec![],
            };
            for candidate in user_candidates {
                if candidate.is_file() {
                    return candidate;
                }
            }
        }

        #[cfg(target_os = "windows")]
        {
            let local_data = dirs.data_local_dir();
            let user_candidates: Vec<PathBuf> = match binary {
                "code" => vec![
                    local_data.join("Programs/Microsoft VS Code/Code.exe"),
                    local_data.join("Programs/Microsoft VS Code/bin/code.cmd"),
                ],
                "cursor" => vec![
                    local_data.join("Programs/cursor/Cursor.exe"),
                    local_data.join("Programs/cursor/bin/cursor.cmd"),
                    local_data.join("Programs/cursor/resources/app/bin/cursor.cmd"),
                ],
                "codium" => vec![
                    local_data.join("Programs/VSCodium/VSCodium.exe"),
                    local_data.join("Programs/VSCodium/bin/codium.cmd"),
                ],
                "windsurf" => vec![
                    local_data.join("Programs/windsurf/Windsurf.exe"),
                    local_data.join("Programs/windsurf/bin/windsurf.cmd"),
                ],
                _ => vec![],
            };
            for candidate in user_candidates {
                if candidate.is_file() {
                    return candidate;
                }
            }
        }

        #[cfg(target_os = "linux")]
        {
            let home = dirs.home_dir();
            let user_candidates = [
                home.join(format!(".local/bin/{binary}")),
                home.join(format!("bin/{binary}")),
            ];
            for candidate in user_candidates {
                if candidate.is_file() {
                    return candidate;
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
    let folder_str = folder.path.to_string_lossy();
    if folder.path.is_absolute() || folder_str.starts_with(r"\\") || folder_str.starts_with("//") {
        return folder_str.into_owned();
    }
    let path = std::env::current_dir()
        .unwrap_or_default()
        .join(&folder.path);
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
                assert!(
                    resolved.is_file(),
                    "expected resolved path to exist: {:?}",
                    resolved
                );
            }
        }
    }

    #[test]
    fn render_isolates_workspaces_by_project_id_preventing_collisions() {
        let adapter = VsCodeAdapter::default();
        let tmp = tempfile::tempdir().unwrap();

        let project1 = Project::new("My App", IdeKind::VsCode);
        let project2 = Project::new("My App", IdeKind::VsCode);
        assert_ne!(project1.id, project2.id);

        let rendered1 = adapter.render(&project1, tmp.path()).unwrap();
        let rendered2 = adapter.render(&project2, tmp.path()).unwrap();

        assert_ne!(rendered1.entry_path, rendered2.entry_path);
        assert!(rendered1.entry_path.is_file());
        assert!(rendered2.entry_path.is_file());
        assert_eq!(
            rendered1.entry_path.file_name(),
            Some(std::ffi::OsStr::new("my-app.code-workspace"))
        );
        assert_eq!(
            rendered2.entry_path.file_name(),
            Some(std::ffi::OsStr::new("my-app.code-workspace"))
        );
    }

    #[test]
    fn render_cleans_up_old_workspace_on_rename() {
        let adapter = VsCodeAdapter::default();
        let tmp = tempfile::tempdir().unwrap();

        let mut project = Project::new("Initial Name", IdeKind::VsCode);
        let rendered1 = adapter.render(&project, tmp.path()).unwrap();
        assert!(rendered1.entry_path.is_file());
        assert!(rendered1
            .entry_path
            .ends_with("initial-name.code-workspace"));

        project.name = "Renamed Project".into();
        let rendered2 = adapter.render(&project, tmp.path()).unwrap();
        assert!(rendered2.entry_path.is_file());
        assert!(rendered2
            .entry_path
            .ends_with("renamed-project.code-workspace"));
        assert!(!rendered1.entry_path.exists());
    }

    #[test]
    fn launch_command_builds_expected_arguments() {
        let adapter = VsCodeAdapter::new(IdeKind::VsCode, "/dummy/code");
        let workspace = RenderedWorkspace {
            entry_path: PathBuf::from("/path/to/project.code-workspace"),
            generated_files: vec![],
        };
        let cmd = adapter.launch_command(&workspace);
        let args: Vec<String> = cmd
            .get_args()
            .map(|a| a.to_string_lossy().into_owned())
            .collect();
        assert!(args.contains(&"--new-window".to_string()));
        assert!(args.contains(&"/path/to/project.code-workspace".to_string()));
    }
}
