use crate::model::{Project, Terminal};

use super::workspace_file::{
    VsCodePresentation, VsCodeRunOptions, VsCodeTask, VsCodeTaskOptions, VsCodeTasksSection,
};

const AGGREGATOR_LABEL: &str = "Open All Terminals";
// Prevents the shell from aborting the -c execution chain upon SIGINT (Ctrl+C).
// When a foreground child (e.g. yarn dev / next dev) is killed by SIGINT, POSIX WCE
// (Wait and Cooperative Exit) semantics would otherwise cause the shell running -c
// to terminate immediately with exit code 130 instead of proceeding to exec "$0" -l.
// Setting a no-op `:` trap intercepts SIGINT in the shell without propagating
// abort to subsequent commands, while child processes reset signal handlers to default.
const KEEP_ALIVE_PREFIX: &str = "trap : INT; ";
// `$0` (not `$SHELL`) because VS Code's task runner doesn't always propagate the
// SHELL env var to spawned task processes — when it's unset, `exec $SHELL -l`
// silently expands to an invalid command, the script ends, and the whole terminal
// dies for real on the next Ctrl+C instead of dropping into an interactive shell.
// `$0` is always set correctly: it's the very shell binary this script is running in.
const KEEP_ALIVE_SUFFIX: &str = "; exec \"$0\" -l";
// Still recognized on import so existing workspace files written with the old,
// env-var-dependent form keep importing correctly.
const LEGACY_KEEP_ALIVE_SUFFIX: &str = "; exec $SHELL -l";

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
                // "process" (not "shell"): a "shell" task makes VS Code run our
                // command+args through an extra, non-interactive wrapper shell —
                // that outer shell has no job control, so Ctrl+C kills the whole
                // tree instead of just the foreground job. "process" execs
                // command+args directly, with our own `-i` shell as the only one.
                task_type: Some("process".into()),
                command: Some(shell_command()),
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

pub fn shell_command() -> String {
    shell_command_for_os(cfg!(target_os = "windows"))
}

pub fn shell_command_for_os(is_windows: bool) -> String {
    if is_windows {
        "powershell.exe".into()
    } else {
        "${env:SHELL}".into()
    }
}

pub fn build_shell_args(terminal: &Terminal) -> Vec<String> {
    build_shell_args_for_os(terminal, cfg!(target_os = "windows"))
}

pub fn build_shell_args_for_os(terminal: &Terminal, is_windows: bool) -> Vec<String> {
    if is_windows {
        match (&terminal.command, terminal.keep_alive) {
            (Some(cmd), true) => vec!["-NoExit".into(), "-Command".into(), cmd.clone()],
            (Some(cmd), false) => vec!["-Command".into(), cmd.clone()],
            (None, _) => vec!["-NoExit".into()],
        }
    } else {
        match (&terminal.command, terminal.keep_alive) {
            (Some(cmd), true) => vec![
                "-lic".into(),
                format!("{KEEP_ALIVE_PREFIX}{cmd}{KEEP_ALIVE_SUFFIX}"),
            ],
            (Some(cmd), false) => vec!["-lic".into(), cmd.clone()],
            (None, _) => vec!["-l".into()],
        }
    }
}

/// Inverse of [`build_shell_args`], used by the importer.
/// Returns `(command, keep_alive)`.
pub fn parse_shell_args(args: &[String]) -> (Option<String>, bool) {
    match args {
        // POSIX empty command / interactive login shell
        [flag] if flag == "-l" => (None, true),
        // Windows empty command / interactive shell
        [flag] if flag == "-NoExit" => (None, true),
        // Windows command with keep_alive
        [flag1, flag2, script] if flag1 == "-NoExit" && flag2 == "-Command" => {
            (Some(script.clone()), true)
        }
        // Windows command without keep_alive
        [flag, script] if flag == "-Command" => (Some(script.clone()), false),
        // POSIX command (with or without keep_alive)
        [flag, script] if flag == "-lic" || flag == "-lc" => {
            if let Some(cmd) = script
                .strip_suffix(KEEP_ALIVE_SUFFIX)
                .or_else(|| script.strip_suffix(LEGACY_KEEP_ALIVE_SUFFIX))
            {
                let clean = cmd.strip_prefix(KEEP_ALIVE_PREFIX).unwrap_or(cmd);
                (Some(clean.to_string()), true)
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
            vec![
                "-lic".to_string(),
                "trap : INT; npm run dev; exec \"$0\" -l".to_string()
            ]
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
    fn parse_accepts_format_without_trap_prefix() {
        let args = vec![
            "-lic".to_string(),
            "npm run dev; exec \"$0\" -l".to_string(),
        ];
        let (command, keep_alive) = parse_shell_args(&args);
        assert_eq!(command.as_deref(), Some("npm run dev"));
        assert!(keep_alive);
    }

    #[test]
    fn parse_accepts_legacy_shell_env_var_suffix() {
        let args = vec![
            "-lic".to_string(),
            "npm run dev; exec $SHELL -l".to_string(),
        ];
        let (command, keep_alive) = parse_shell_args(&args);
        assert_eq!(command.as_deref(), Some("npm run dev"));
        assert!(keep_alive);
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

    #[test]
    fn windows_shell_args_and_parse_roundtrip() {
        let mut terminal = Terminal::new("Backend 1", uuid::Uuid::new_v4(), 0);
        terminal.command = Some("npm run dev".into());
        terminal.keep_alive = true;

        let args = build_shell_args_for_os(&terminal, true);
        assert_eq!(args, vec!["-NoExit", "-Command", "npm run dev"]);
        let (parsed_cmd, keep_alive) = parse_shell_args(&args);
        assert_eq!(parsed_cmd.as_deref(), Some("npm run dev"));
        assert!(keep_alive);

        terminal.keep_alive = false;
        let args_no_keep = build_shell_args_for_os(&terminal, true);
        assert_eq!(args_no_keep, vec!["-Command", "npm run dev"]);
        let (parsed_no_keep, keep_alive) = parse_shell_args(&args_no_keep);
        assert_eq!(parsed_no_keep.as_deref(), Some("npm run dev"));
        assert!(!keep_alive);

        let empty_term = Terminal::new("Shell", uuid::Uuid::new_v4(), 0);
        let args_empty = build_shell_args_for_os(&empty_term, true);
        assert_eq!(args_empty, vec!["-NoExit"]);
        let (parsed_empty, keep_alive) = parse_shell_args(&args_empty);
        assert_eq!(parsed_empty, None);
        assert!(keep_alive);
    }
}
