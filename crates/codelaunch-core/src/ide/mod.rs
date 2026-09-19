pub mod vscode;

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::process::Command;

use crate::model::{IdeKind, Project};

#[derive(Debug, thiserror::Error)]
pub enum IdeError {
    #[error(transparent)]
    Io(#[from] std::io::Error),
    #[error(transparent)]
    Json(#[from] serde_json::Error),
    #[error("no adapter registered for {0:?}")]
    UnsupportedIde(IdeKind),
    #[error("failed to parse workspace file: {0}")]
    ParseError(String),
    #[error("executable '{binary}' not found for {ide}. Please ensure it is installed and available in PATH: {source}")]
    ExecutableNotFound {
        ide: String,
        binary: String,
        #[source]
        source: std::io::Error,
    },
}

pub type Result<T> = std::result::Result<T, IdeError>;

#[derive(Debug, Clone, PartialEq)]
pub struct RenderedWorkspace {
    /// The file to hand to the IDE's CLI (e.g. a `.code-workspace` file).
    pub entry_path: PathBuf,
    /// Any other files the adapter wrote as a side effect of rendering.
    pub generated_files: Vec<PathBuf>,
}

/// Everything a target IDE needs to implement to plug into CodeLaunch.
///
/// `render` and `launch_command` are deliberately separate: `render` is pure I/O
/// (write config, no side effect on the running system) and is what golden-file
/// tests exercise; `launch_command` only builds a `Command` and never executes it,
/// so callers (or tests) can inspect it before spawning.
pub trait IdeAdapter: Send + Sync {
    fn kind(&self) -> IdeKind;
    fn render(&self, project: &Project, output_dir: &Path) -> Result<RenderedWorkspace>;
    fn launch_command(&self, workspace: &RenderedWorkspace) -> Command;
}

pub struct IdeRegistry {
    adapters: HashMap<IdeKind, Box<dyn IdeAdapter>>,
}

impl IdeRegistry {
    pub fn new() -> Self {
        let mut adapters: HashMap<IdeKind, Box<dyn IdeAdapter>> = HashMap::new();
        for kind in [
            IdeKind::VsCode,
            IdeKind::Cursor,
            IdeKind::Vscodium,
            IdeKind::Windsurf,
        ] {
            let adapter = vscode::VsCodeAdapter::new(kind, kind.default_binary());
            adapters.insert(kind, Box::new(adapter));
        }
        Self { adapters }
    }

    pub fn get(&self, kind: IdeKind) -> Result<&dyn IdeAdapter> {
        self.adapters
            .get(&kind)
            .map(|b| b.as_ref())
            .ok_or(IdeError::UnsupportedIde(kind))
    }
}

impl Default for IdeRegistry {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn registry_contains_all_ide_kinds() {
        let registry = IdeRegistry::new();
        for kind in [
            IdeKind::VsCode,
            IdeKind::Cursor,
            IdeKind::Vscodium,
            IdeKind::Windsurf,
        ] {
            let adapter = registry.get(kind);
            assert!(adapter.is_ok(), "missing adapter for {kind:?}");
            assert_eq!(adapter.unwrap().kind(), kind);
        }
    }
}
