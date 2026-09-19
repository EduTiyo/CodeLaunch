use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

use crate::model::{Folder, IdeKind, Project, Terminal, TerminalGroup};

use super::super::{IdeError, Result};
use super::tasks::{is_aggregator_task, parse_shell_args};
use super::workspace_file::VsCodeWorkspaceFile;

/// Parses an existing `.code-workspace` file (JSON5, as VS Code allows comments and
/// trailing commas) back into a [`Project`], reversing [`super::build_workspace_document`].
///
/// The name comes from the file stem (e.g. `aria.code-workspace` -> "aria"), since the
/// workspace file itself carries no project name field.
pub fn parse_vscode_workspace(path: &Path) -> Result<Project> {
    let raw = fs::read_to_string(path)?;
    let doc: VsCodeWorkspaceFile =
        json5::from_str(&raw).map_err(|e| IdeError::ParseError(e.to_string()))?;

    let name = path
        .file_stem()
        .map(|s| s.to_string_lossy().into_owned())
        .unwrap_or_else(|| "Imported Project".into());

    let mut project = Project::new(name, IdeKind::VsCode);

    // Folder paths in the source file are relative to the file's own directory
    // (VS Code's convention), not to whatever process later renders/reads them —
    // resolve to absolute now so `Folder.path` is self-contained.
    let base_dir = path.parent().map(Path::to_path_buf).unwrap_or_default();

    let mut folder_id_by_name = HashMap::new();
    for entry in &doc.folders {
        let resolved_path = resolve_relative(&base_dir, &entry.path);
        let folder = Folder::new(entry.name.clone(), resolved_path);
        folder_id_by_name.insert(entry.name.clone(), folder.id);
        project.folders.push(folder);
    }

    project.extra_settings = doc
        .settings
        .into_iter()
        .filter(|(key, _)| !is_default_setting_key(key))
        .collect();

    let Some(tasks_section) = doc.tasks else {
        return Ok(project);
    };

    project.terminals_enabled = true;

    // Group key ("group1", "group2", ...) -> (first-seen order, terminals).
    let mut group_order: Vec<String> = Vec::new();
    let mut groups_by_key: HashMap<String, Vec<Terminal>> = HashMap::new();

    for (index, task) in tasks_section.tasks.iter().enumerate() {
        if is_aggregator_task(task) {
            continue;
        }
        let Some(presentation) = &task.presentation else {
            continue;
        };
        let folder_id = task
            .options
            .as_ref()
            .and_then(|o| extract_workspace_folder_name(&o.cwd))
            .and_then(|name| folder_id_by_name.get(&name).copied());
        let Some(folder_id) = folder_id else {
            continue;
        };

        let (command, keep_alive) = parse_shell_args(&task.args);

        let mut terminal = Terminal::new(task.label.clone(), folder_id, index as u32);
        terminal.command = command;
        terminal.keep_alive = keep_alive;

        let group_key = presentation.group.clone();
        if !groups_by_key.contains_key(&group_key) {
            group_order.push(group_key.clone());
        }
        groups_by_key.entry(group_key).or_default().push(terminal);
    }

    for (index, key) in group_order.into_iter().enumerate() {
        let mut terminals = groups_by_key.remove(&key).unwrap_or_default();
        for (i, terminal) in terminals.iter_mut().enumerate() {
            terminal.order = i as u32;
        }
        // Preserve the numeric suffix of "group<N>" keys so re-rendering produces
        // the same group key (build_tasks_section derives it from `order`); fall
        // back to position-based numbering (1-indexed) for non-standard keys.
        let order = parse_group_order(&key).unwrap_or((index + 1) as u32);
        let mut group = TerminalGroup::new(key, order);
        group.terminals = terminals;
        project.terminal_groups.push(group);
    }

    project.terminal_groups.sort_by_key(|g| g.order);

    Ok(project)
}

fn parse_group_order(key: &str) -> Option<u32> {
    key.strip_prefix("group")
        .and_then(|s| s.parse::<u32>().ok())
}

/// Joins `base_dir` with `path` and lexically collapses `.`/`..` components,
/// without touching the filesystem (the target directory may not exist yet).
fn resolve_relative(base_dir: &Path, path: &str) -> PathBuf {
    let joined = base_dir.join(path);
    let mut result = PathBuf::new();
    for component in joined.components() {
        match component {
            std::path::Component::ParentDir => {
                result.pop();
            }
            std::path::Component::CurDir => {}
            other => result.push(other.as_os_str()),
        }
    }
    result
}

fn extract_workspace_folder_name(cwd: &str) -> Option<String> {
    cwd.strip_prefix("${workspaceFolder:")
        .and_then(|s| s.strip_suffix('}'))
        .map(|s| s.to_string())
}

fn is_default_setting_key(key: &str) -> bool {
    matches!(
        key,
        "terminal.integrated.enablePersistentSessions"
            | "terminal.integrated.persistentSessionReviveProcess"
            | "terminal.integrated.defaultProfile.osx"
            | "terminal.integrated.splitCwd"
            | "task.allowAutomaticTasks"
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    #[test]
    fn imports_groups_and_commands() {
        let json = r#"{
            "folders": [
                { "name": "BACK", "path": "../back" },
                { "name": "FRONT", "path": "../front" }
            ],
            "settings": {},
            "tasks": {
                "version": "2.0.0",
                "tasks": [
                    {
                        "label": "Backend 1",
                        "type": "shell",
                        "command": "${env:SHELL}",
                        "args": ["-lic", "npm run dev; exec $SHELL -l"],
                        "isBackground": true,
                        "presentation": { "reveal": "always", "panel": "dedicated", "group": "group1", "focus": false },
                        "options": { "cwd": "${workspaceFolder:BACK}" }
                    },
                    {
                        "label": "Frontend 1",
                        "type": "shell",
                        "command": "${env:SHELL}",
                        "args": ["-l"],
                        "isBackground": true,
                        "presentation": { "reveal": "always", "panel": "dedicated", "group": "group1", "focus": false },
                        "options": { "cwd": "${workspaceFolder:FRONT}" }
                    },
                    {
                        "label": "Open All Terminals",
                        "dependsOn": ["Backend 1", "Frontend 1"],
                        "dependsOrder": "parallel",
                        "runOptions": { "runOn": "folderOpen" }
                    }
                ]
            }
        }"#;

        let mut file = tempfile::Builder::new()
            .suffix(".code-workspace")
            .tempfile()
            .unwrap();
        file.write_all(json.as_bytes()).unwrap();

        let project = parse_vscode_workspace(file.path()).unwrap();
        assert_eq!(project.folders.len(), 2);
        assert_eq!(project.terminal_groups.len(), 1);
        let group = &project.terminal_groups[0];
        assert_eq!(group.terminals.len(), 2);
        assert_eq!(group.terminals[0].command.as_deref(), Some("npm run dev"));
        assert!(group.terminals[0].keep_alive);
        assert_eq!(group.terminals[1].command, None);
    }
}
