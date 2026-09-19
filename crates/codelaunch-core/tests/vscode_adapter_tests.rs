//! Golden-file / round-trip tests anchoring the VS Code adapter against the user's
//! real, hand-written `.code-workspace` files (copied into `tests/fixtures/`).
//!
//! Folder `path` values are intentionally excluded from the comparison: CodeLaunch
//! renders the workspace file into its own config directory rather than beside the
//! user's repositories, so it resolves folder paths to absolute — the original
//! fixtures use paths relative to `~/Documents/tsp/.vscode-workspaces/`. Everything
//! else (folder names, settings, task structure/groups/commands) must match exactly.

use std::path::Path;

use codelaunch_core::ide::vscode::{build_workspace_document, parse_vscode_workspace};

const FIXTURES: &[&str] = &["ai-hub", "aria", "aria-operate"];

fn fixture_path(name: &str) -> std::path::PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("tests/fixtures")
        .join(format!("{name}.code-workspace"))
}

/// Strips `folders[].path` from a workspace document's JSON so comparisons focus on
/// structure that must be byte-identical (names, settings, tasks).
fn without_folder_paths(mut value: serde_json::Value) -> serde_json::Value {
    if let Some(folders) = value.get_mut("folders").and_then(|f| f.as_array_mut()) {
        for folder in folders {
            if let Some(obj) = folder.as_object_mut() {
                obj.remove("path");
            }
        }
    }
    value
}

#[test]
fn import_round_trips_all_real_fixtures() {
    for name in FIXTURES {
        let path = fixture_path(name);
        let project = parse_vscode_workspace(&path)
            .unwrap_or_else(|e| panic!("failed to import {name}: {e}"));

        let rendered_doc = build_workspace_document(&project)
            .unwrap_or_else(|e| panic!("failed to render {name}: {e}"));

        let original_raw = std::fs::read_to_string(&path).unwrap();
        let original: serde_json::Value = json5::from_str(&original_raw).unwrap();
        let rendered = serde_json::to_value(&rendered_doc).unwrap();

        assert_eq!(
            without_folder_paths(original.clone())["folders"]
                .as_array()
                .unwrap()
                .iter()
                .map(|f| f["name"].clone())
                .collect::<Vec<_>>(),
            without_folder_paths(rendered.clone())["folders"]
                .as_array()
                .unwrap()
                .iter()
                .map(|f| f["name"].clone())
                .collect::<Vec<_>>(),
            "folder names mismatch for {name}"
        );

        assert_eq!(
            original["tasks"], rendered["tasks"],
            "tasks section mismatch for {name}"
        );

        for (key, expected) in original["settings"].as_object().unwrap() {
            assert_eq!(
                rendered["settings"].get(key),
                Some(expected),
                "setting {key} mismatch for {name}"
            );
        }
    }
}

#[test]
fn import_preserves_terminal_count_and_groups() {
    // aria.code-workspace: group1 has 3 terminals (Backend 1, Backend 2, Frontend 1),
    // group2 has 2 (Backend 3, Frontend 2) — see conversation history that produced it.
    let project = parse_vscode_workspace(&fixture_path("aria")).unwrap();
    assert_eq!(project.terminal_groups.len(), 2);

    let group1 = &project.terminal_groups[0];
    assert_eq!(group1.terminals.len(), 3);
    assert_eq!(
        group1.terminals[1].command.as_deref(),
        Some("docker compose -f .devcontainer/docker-compose.yml up -d; npm run worker")
    );

    let group2 = &project.terminal_groups[1];
    assert_eq!(group2.terminals.len(), 2);
    assert_eq!(group2.terminals[0].command, None);
}

#[test]
fn import_legacy_workspace_without_trap_upgrades_to_trap_format_on_render() {
    let legacy_workspace = r#"{
      "folders": [
        { "name": "app", "path": "/path/to/app" }
      ],
      "tasks": {
        "version": "2.0.0",
        "tasks": [
          {
            "label": "Dev Server",
            "type": "process",
            "command": "${env:SHELL}",
            "args": ["-lic", "yarn dev; exec \"$0\" -l"],
            "presentation": { "reveal": "always", "panel": "dedicated", "group": "group1", "focus": false },
            "options": { "cwd": "${workspaceFolder:app}" }
          }
        ]
      }
    }"#;

    let dir = tempfile::tempdir().unwrap();
    let file_path = dir.path().join("legacy.code-workspace");
    std::fs::write(&file_path, legacy_workspace).unwrap();

    let project = parse_vscode_workspace(&file_path).unwrap();
    let term = &project.terminal_groups[0].terminals[0];
    assert_eq!(term.command.as_deref(), Some("yarn dev"));
    assert!(term.keep_alive);

    let doc = build_workspace_document(&project).unwrap();
    let task = &doc.tasks.unwrap().tasks[0];
    assert_eq!(
        task.args,
        vec![
            "-lic".to_string(),
            "trap : INT; yarn dev; exec \"$0\" -l".to_string()
        ]
    );
}

