use std::path::Path;

use crate::ide::{IdeError, IdeRegistry, Result};
use crate::model::Project;

/// Renders the project's workspace file and spawns the IDE process to open it.
/// Does not wait for the IDE process to exit (`code --new-window` returns immediately
/// once the window is requested).
pub fn launch(registry: &IdeRegistry, project: &Project, workspaces_dir: &Path) -> Result<()> {
    let adapter = registry.get(project.ide)?;
    let rendered = adapter.render(project, workspaces_dir)?;
    let mut cmd = adapter.launch_command(&rendered);
    match cmd.spawn() {
        Ok(_) => Ok(()),
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => {
            let binary = cmd.get_program().to_string_lossy().into_owned();
            Err(IdeError::ExecutableNotFound {
                ide: format!("{:?}", project.ide),
                binary,
                source: err,
            })
        }
        Err(err) => Err(IdeError::Io(err)),
    }
}
