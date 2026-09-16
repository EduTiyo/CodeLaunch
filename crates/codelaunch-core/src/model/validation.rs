use thiserror::Error;

use super::project::Project;

#[derive(Debug, Error, PartialEq)]
pub enum ValidationError {
    #[error("project name must not be empty")]
    EmptyName,
    #[error("duplicate folder name: {0}")]
    DuplicateFolderName(String),
    #[error("terminal {0} references a folder that does not exist in this project")]
    DanglingFolderReference(String),
    #[error("duplicate terminal label: {0} (VS Code task labels must be unique project-wide)")]
    DuplicateTerminalLabel(String),
}

/// Structural validation only (referential integrity, obvious mistakes).
/// Filesystem checks (e.g. "does this path exist") are left to the caller/UI as warnings,
/// since a path may legitimately not exist yet while editing.
pub fn validate(project: &Project) -> Result<(), Vec<ValidationError>> {
    let mut errors = Vec::new();

    if project.name.trim().is_empty() {
        errors.push(ValidationError::EmptyName);
    }

    let mut seen_names = std::collections::HashSet::new();
    for folder in &project.folders {
        if !seen_names.insert(&folder.name) {
            errors.push(ValidationError::DuplicateFolderName(folder.name.clone()));
        }
    }

    let mut seen_labels = std::collections::HashSet::new();
    for group in &project.terminal_groups {
        for terminal in &group.terminals {
            if project.find_folder(terminal.folder_id).is_none() {
                errors.push(ValidationError::DanglingFolderReference(
                    terminal.label.clone(),
                ));
            }
            if !seen_labels.insert(&terminal.label) {
                errors.push(ValidationError::DuplicateTerminalLabel(terminal.label.clone()));
            }
        }
    }

    if errors.is_empty() {
        Ok(())
    } else {
        Err(errors)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::project::{Folder, IdeKind, Terminal, TerminalGroup};
    use uuid::Uuid;

    #[test]
    fn rejects_dangling_folder_reference() {
        let mut project = Project::new("Test", IdeKind::VsCode);
        let mut group = TerminalGroup::new("group1", 0);
        group
            .terminals
            .push(Terminal::new("Backend 1", Uuid::new_v4(), 0));
        project.terminal_groups.push(group);

        let errors = validate(&project).unwrap_err();
        assert_eq!(errors.len(), 1);
        assert!(matches!(
            errors[0],
            ValidationError::DanglingFolderReference(_)
        ));
    }

    #[test]
    fn rejects_duplicate_terminal_labels_across_groups() {
        let mut project = Project::new("Test", IdeKind::VsCode);
        let folder = Folder::new("BACKEND", "/tmp/backend");
        let folder_id = folder.id;
        project.folders.push(folder);

        let mut group1 = TerminalGroup::new("group1", 1);
        group1
            .terminals
            .push(Terminal::new("Terminal 1", folder_id, 0));
        let mut group2 = TerminalGroup::new("group2", 2);
        group2
            .terminals
            .push(Terminal::new("Terminal 1", folder_id, 0));
        project.terminal_groups.push(group1);
        project.terminal_groups.push(group2);

        let errors = validate(&project).unwrap_err();
        assert_eq!(errors.len(), 1);
        assert!(matches!(errors[0], ValidationError::DuplicateTerminalLabel(_)));
    }

    #[test]
    fn accepts_valid_project() {
        let mut project = Project::new("Test", IdeKind::VsCode);
        let folder = Folder::new("BACKEND", "/tmp/backend");
        let folder_id = folder.id;
        project.folders.push(folder);

        let mut group = TerminalGroup::new("group1", 0);
        group
            .terminals
            .push(Terminal::new("Backend 1", folder_id, 0));
        project.terminal_groups.push(group);

        assert!(validate(&project).is_ok());
    }
}
