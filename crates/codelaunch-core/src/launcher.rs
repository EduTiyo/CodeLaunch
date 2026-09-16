use std::path::Path;

use crate::ide::{IdeRegistry, Result};
use crate::model::Project;

/// Renders the project's workspace file and spawns the IDE process to open it.
/// Does not wait for the IDE process to exit (`code --new-window` returns immediately
/// once the window is requested).
pub fn launch(registry: &IdeRegistry, project: &Project, workspaces_dir: &Path) -> Result<()> {
    let adapter = registry.get(project.ide)?;
    let rendered = adapter.render(project, workspaces_dir)?;
    adapter.launch_command(&rendered).spawn()?;
    Ok(())
}
