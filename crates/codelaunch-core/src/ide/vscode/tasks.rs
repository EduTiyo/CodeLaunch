use crate::model::{Project, Terminal};

use super::workspace_file::{
    VsCodePresentation, VsCodeRunOptions, VsCodeTask, VsCodeTaskOptions, VsCodeTasksSection,
};

const AGGREGATOR_LABEL: &str = "Open All Terminals";
const KEEP_ALIVE_SUFFIX: &str = "; exec $SHELL -l";

pub fn build_tasks_section(project: &Project) -> Option<VsCodeTasksSection> {
    if !project.terminals_enabled || project.terminal_groups.is_empty() {
        return None;
    }

    let mut tasks = Vec::new();
    let mut all_labels = Vec::new();

    let mut groups: Vec<_> = project.terminal_groups.iter().collect();
    groups.sort_by_key(|g| g.order);

    for group in groups {
        let group_key = format!("group{}", group.order);
        let mut terminals: Vec<_> = group.terminals.iter().collect();
        terminals.sort_by_key(|t| t.order);

        for terminal in terminals {
            let Some(folder) = project.find_folder(terminal.folder_id) else {
                continue;
            };

            tasks.push(VsCodeTask {
                label: terminal.label.clone(),
                task_type: Some("shell".into()),
                command: Some("${env:SHELL}".into()),
                args: build_shell_args(terminal),
                is_background: Some(true),
                problem_matcher: Some(vec![]),
                presentation: Some(VsCodePresentation {
                    reveal: "always".into(),
                    panel: "dedicated".into(),
                    group: group_key.clone(),
                    focus: false,
                }),
                options: Some(VsCodeTaskOptions {
                    cwd: format!("${{workspaceFolder:{}}}", folder.name),
                }),
                ..Default::default()
            });
            all_labels.push(terminal.label.clone());
        }
    }

    if all_labels.is_empty() {
        return None;
    }

    tasks.push(VsCodeTask {
        label: AGGREGATOR_LABEL.into(),
        depends_on: all_labels,
        depends_order: Some("parallel".into()),
        run_options: Some(VsCodeRunOptions {
            run_on: "folderOpen".into(),
        }),
        ..Default::default()
    });

    Some(VsCodeTasksSection {
        version: "2.0.0".into(),
        tasks,
    })
}

fn build_shell_args(terminal: &Terminal) -> Vec<String> {
    match (&terminal.command, terminal.keep_alive) {
        (Some(cmd), true) => vec!["-lic".into(), format!("{cmd}{KEEP_ALIVE_SUFFIX}")],
        (Some(cmd), false) => vec!["-lic".into(), cmd.clone()],
        (None, _) => vec!["-l".into()],
    }
}

/// Inverse of [`build_shell_args`], used by the importer.
/// Returns `(command, keep_alive)`.
pub fn parse_shell_args(args: &[String]) -> (Option<String>, bool) {
    match args {
        [flag] if flag == "-l" => (None, true),
        [flag, script] if flag == "-lic" || flag == "-lc" => {
            if let Some(cmd) = script.strip_suffix(KEEP_ALIVE_SUFFIX) {
                (Some(cmd.to_string()), true)
            } else {
                (Some(script.clone()), false)
            }
        }
        _ => (None, false),
    }
}

pub fn is_aggregator_task(task: &VsCodeTask) -> bool {
    task.label == AGGREGATOR_LABEL || (task.presentation.is_none() && !task.depends_on.is_empty())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn keep_alive_command_wraps_with_exec_shell() {
        let mut terminal = Terminal::new("Backend 1", uuid::Uuid::new_v4(), 0);
        terminal.command = Some("npm run dev".into());
        terminal.keep_alive = true;
        assert_eq!(
            build_shell_args(&terminal),
            vec!["-lic".to_string(), "npm run dev; exec $SHELL -l".to_string()]
        );
    }

    #[test]
    fn empty_command_is_plain_login_shell() {
        let terminal = Terminal::new("Backend 1", uuid::Uuid::new_v4(), 0);
        assert_eq!(build_shell_args(&terminal), vec!["-l".to_string()]);
    }

    #[test]
    fn parse_is_inverse_of_build() {
        let mut terminal = Terminal::new("Backend 1", uuid::Uuid::new_v4(), 0);
        terminal.command = Some("docker compose up -d; npm run dev".into());
        terminal.keep_alive = true;

        let args = build_shell_args(&terminal);
        let (command, keep_alive) = parse_shell_args(&args);
        assert_eq!(command, terminal.command);
        assert_eq!(keep_alive, terminal.keep_alive);
    }

    #[test]
    fn parse_no_keep_alive_roundtrip() {
        let mut terminal = Terminal::new("Backend 1", uuid::Uuid::new_v4(), 0);
        terminal.command = Some("npm run dev".into());
        terminal.keep_alive = false;

        let args = build_shell_args(&terminal);
        let (command, keep_alive) = parse_shell_args(&args);
        assert_eq!(command, terminal.command);
        assert_eq!(keep_alive, terminal.keep_alive);
    }
}
