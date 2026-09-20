use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

use crate::ide::{IdeAdapter, RenderedWorkspace, Result};
use crate::model::{Folder, IdeKind, Project, Terminal, TerminalGroup};

#[derive(Default)]
pub struct TerminalAdapter;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TargetOs {
    MacOs,
    Linux,
    Windows,
}

impl TargetOs {
    pub fn current() -> Self {
        if cfg!(target_os = "macos") {
            Self::MacOs
        } else if cfg!(target_os = "windows") {
            Self::Windows
        } else {
            Self::Linux
        }
    }
}

impl IdeAdapter for TerminalAdapter {
    fn kind(&self) -> IdeKind {
        IdeKind::Terminal
    }

    fn render(&self, project: &Project, output_dir: &Path) -> Result<RenderedWorkspace> {
        let os = TargetOs::current();
        render_for_os(project, output_dir, os)
    }

    fn launch_command(&self, workspace: &RenderedWorkspace) -> Command {
        #[cfg(target_os = "windows")]
        {
            let mut cmd = Command::new("cmd");
            cmd.arg("/c").arg(&workspace.entry_path);
            cmd
        }
        #[cfg(not(target_os = "windows"))]
        {
            let mut cmd = Command::new("/bin/bash");
            cmd.arg(&workspace.entry_path);
            cmd
        }
    }
}

pub fn render_for_os(
    project: &Project,
    output_dir: &Path,
    os: TargetOs,
) -> Result<RenderedWorkspace> {
    let slug = slugify(&project.name);
    let project_dir = output_dir.join(format!("{slug}-terminal"));
    fs::create_dir_all(&project_dir)?;

    let mut generated_files = Vec::new();
    let grouped_terminals = collect_grouped_terminals(project);

    match os {
        TargetOs::MacOs => {
            let mut grouped_scripts = Vec::new();

            for (g_idx, (group, terms)) in grouped_terminals.iter().enumerate() {
                let mut scripts = Vec::new();
                for (t_idx, &(term, folder)) in terms.iter().enumerate() {
                    let script_name = format!(
                        "term_g{}_t{}_{}.command",
                        g_idx + 1,
                        t_idx + 1,
                        slugify(&term.label)
                    );
                    let script_path = project_dir.join(&script_name);
                    let content = generate_macos_terminal_script(term, folder);
                    fs::write(&script_path, content)?;
                    make_executable(&script_path)?;
                    generated_files.push(script_path.clone());
                    scripts.push((term, script_path));
                }
                grouped_scripts.push((*group, scripts));
            }

            let master_path = project_dir.join("launch.command");
            let master_content = generate_macos_master_script(project, &grouped_scripts);
            fs::write(&master_path, master_content)?;
            make_executable(&master_path)?;

            Ok(RenderedWorkspace {
                entry_path: master_path,
                generated_files,
            })
        }
        TargetOs::Linux => {
            let mut grouped_scripts = Vec::new();

            for (g_idx, (group, terms)) in grouped_terminals.iter().enumerate() {
                let mut scripts = Vec::new();
                for (t_idx, &(term, folder)) in terms.iter().enumerate() {
                    let script_name = format!(
                        "term_g{}_t{}_{}.sh",
                        g_idx + 1,
                        t_idx + 1,
                        slugify(&term.label)
                    );
                    let script_path = project_dir.join(&script_name);
                    let content = generate_linux_terminal_script(term, folder);
                    fs::write(&script_path, content)?;
                    make_executable(&script_path)?;
                    generated_files.push(script_path.clone());
                    scripts.push((term, script_path));
                }
                grouped_scripts.push((*group, scripts));
            }

            let master_path = project_dir.join("launch.sh");
            let master_content = generate_linux_master_script(project, &grouped_scripts);
            fs::write(&master_path, master_content)?;
            make_executable(&master_path)?;

            Ok(RenderedWorkspace {
                entry_path: master_path,
                generated_files,
            })
        }
        TargetOs::Windows => {
            let mut grouped_scripts = Vec::new();

            for (g_idx, (group, terms)) in grouped_terminals.iter().enumerate() {
                let mut scripts = Vec::new();
                for (t_idx, &(term, folder)) in terms.iter().enumerate() {
                    let script_name = format!(
                        "term_g{}_t{}_{}.bat",
                        g_idx + 1,
                        t_idx + 1,
                        slugify(&term.label)
                    );
                    let script_path = project_dir.join(&script_name);
                    let content = generate_windows_terminal_script(term, folder);
                    fs::write(&script_path, content)?;
                    generated_files.push(script_path.clone());
                    scripts.push((term, script_path));
                }
                grouped_scripts.push((*group, scripts));
            }

            let master_path = project_dir.join("launch.bat");
            let master_content = generate_windows_master_script(project, &grouped_scripts);
            fs::write(&master_path, master_content)?;

            Ok(RenderedWorkspace {
                entry_path: master_path,
                generated_files,
            })
        }
    }
}

pub fn generate_preview_for_os(project: &Project, os: TargetOs) -> Result<String> {
    let grouped = collect_grouped_terminals(project);

    let pseudo_grouped = |ext: &str| -> Vec<(&TerminalGroup, Vec<(&Terminal, PathBuf)>)> {
        grouped
            .iter()
            .enumerate()
            .map(|(g_idx, (group, terms))| {
                let pseudo_terms = terms
                    .iter()
                    .enumerate()
                    .map(|(t_idx, &(term, _))| {
                        let script_name = format!(
                            "term_g{}_t{}_{}.{ext}",
                            g_idx + 1,
                            t_idx + 1,
                            slugify(&term.label)
                        );
                        (term, PathBuf::from(script_name))
                    })
                    .collect();
                (*group, pseudo_terms)
            })
            .collect()
    };

    let mut preview = String::new();
    match os {
        TargetOs::MacOs => {
            let pseudo = pseudo_grouped("command");
            preview.push_str("# === Launch Script (launch.command) ===\n");
            preview.push_str(&generate_macos_master_script(project, &pseudo));
            preview.push('\n');

            for (group, terms) in &grouped {
                preview.push_str(&format!(
                    "\n# ========================================\n# Group: {}\n# ========================================\n",
                    group.name
                ));
                for (term, folder) in terms {
                    preview.push_str(&format!("\n# --- Tab: {} ---\n", term.label));
                    preview.push_str(&generate_macos_terminal_script(term, folder));
                }
            }
        }
        TargetOs::Linux => {
            let pseudo = pseudo_grouped("sh");
            preview.push_str("# === Launch Script (launch.sh) ===\n");
            preview.push_str(&generate_linux_master_script(project, &pseudo));
            preview.push('\n');

            for (group, terms) in &grouped {
                preview.push_str(&format!(
                    "\n# ========================================\n# Group: {}\n# ========================================\n",
                    group.name
                ));
                for (term, folder) in terms {
                    preview.push_str(&format!("\n# --- Tab: {} ---\n", term.label));
                    preview.push_str(&generate_linux_terminal_script(term, folder));
                }
            }
        }
        TargetOs::Windows => {
            let pseudo = pseudo_grouped("bat");
            preview.push_str(":: === Launch Script (launch.bat) ===\n");
            preview.push_str(&generate_windows_master_script(project, &pseudo));
            preview.push('\n');

            for (group, terms) in &grouped {
                preview.push_str(&format!(
                    "\n:: ========================================\n:: Group: {}\n:: ========================================\n",
                    group.name
                ));
                for (term, folder) in terms {
                    preview.push_str(&format!("\n:: --- Tab: {} ---\n", term.label));
                    preview.push_str(&generate_windows_terminal_script(term, folder));
                }
            }
        }
    }

    Ok(preview)
}

pub fn generate_preview(project: &Project) -> Result<String> {
    let mut preview = String::new();

    preview.push_str(
        "# ==============================================================================\n",
    );
    preview.push_str(
        "# [macOS] (launch.command) — 1 janela por grupo com abas (iTerm2 ou Terminal.app)\n",
    );
    preview.push_str(
        "# ==============================================================================\n\n",
    );
    preview.push_str(&generate_preview_for_os(project, TargetOs::MacOs)?);

    preview.push_str(
        "\n\n# ==============================================================================\n",
    );
    preview.push_str(
        "# [Linux] (launch.sh) — 1 janela por grupo com abas (gnome-terminal, konsole, xfce4)\n",
    );
    preview.push_str(
        "# ==============================================================================\n\n",
    );
    preview.push_str(&generate_preview_for_os(project, TargetOs::Linux)?);

    preview.push_str(
        "\n\n# ==============================================================================\n",
    );
    preview.push_str(
        "# [Windows] (launch.bat) — 1 janela por grupo com abas (Windows Terminal wt.exe)\n",
    );
    preview.push_str(
        "# ==============================================================================\n\n",
    );
    preview.push_str(&generate_preview_for_os(project, TargetOs::Windows)?);

    Ok(preview)
}

fn collect_grouped_terminals(
    project: &Project,
) -> Vec<(&TerminalGroup, Vec<(&Terminal, &Folder)>)> {
    if !project.terminals_enabled {
        return Vec::new();
    }

    let mut result = Vec::new();
    let mut groups: Vec<_> = project.terminal_groups.iter().collect();
    groups.sort_by_key(|g| g.order);

    for group in groups {
        let mut terminals: Vec<_> = group.terminals.iter().collect();
        terminals.sort_by_key(|t| t.order);

        let mut group_terms = Vec::new();
        for term in terminals {
            if let Some(folder) = project.find_folder(term.folder_id) {
                group_terms.push((term, folder));
            }
        }

        if !group_terms.is_empty() {
            result.push((group, group_terms));
        }
    }

    result
}

fn resolve_folder_path(folder: &Folder) -> String {
    let path = if folder.path.is_absolute() {
        folder.path.clone()
    } else {
        std::env::current_dir()
            .unwrap_or_default()
            .join(&folder.path)
    };
    path.to_string_lossy().into_owned()
}

fn make_executable(path: &Path) -> Result<()> {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = fs::metadata(path)?.permissions();
        perms.set_mode(0o755);
        fs::set_permissions(path, perms)?;
    }
    let _ = path;
    Ok(())
}

fn generate_macos_terminal_script(term: &Terminal, folder: &Folder) -> String {
    let folder_path = resolve_folder_path(folder);
    let title = term.label.replace('"', "\\\"");

    let mut script = String::new();
    script.push_str("#!/bin/zsh\n");
    script.push_str("[ -f \"$HOME/.zprofile\" ] && source \"$HOME/.zprofile\" 2>/dev/null\n");
    script.push_str("[ -f \"$HOME/.zshrc\" ] && source \"$HOME/.zshrc\" 2>/dev/null\n");
    script.push_str("#!/bin/zsh\n");
    script.push_str("[ -f \"$HOME/.zprofile\" ] && source \"$HOME/.zprofile\" 2>/dev/null\n");
    script.push_str("[ -f \"$HOME/.zshrc\" ] && source \"$HOME/.zshrc\" 2>/dev/null\n");
    script.push_str(&format!("cd \"{}\" || exit 1\n", folder_path));
    script.push_str(&format!("printf '\\033]0;%s\\007' \"{}\"\n", title));

    match (&term.command, term.keep_alive) {
        (Some(cmd), true) => {
            script.push_str(&format!(
                "trap : INT; {}; exec \"${{SHELL:-zsh}}\" -l\n",
                cmd
            ));
        }
        (Some(cmd), false) => {
            script.push_str(&format!("{}\n", cmd));
        }
        (None, _) => {
            script.push_str("exec \"${{SHELL:-zsh}}\" -l\n");
        }
    }

    script
}

fn generate_macos_master_script(
    project: &Project,
    grouped_scripts: &[(&TerminalGroup, Vec<(&Terminal, PathBuf)>)],
) -> String {
    let mut script = String::new();
    script.push_str("#!/usr/bin/env bash\n");
    script.push_str(&format!(
        "# CodeLaunch Terminal Launcher for {}\n",
        project.name
    ));
    script.push_str("# Auto-detects iTerm2 vs Terminal.app\n\n");

    script.push_str(r#"if [ -d "/Applications/iTerm.app" ] || [ -d "$HOME/Applications/iTerm.app" ] || osascript -e 'id of application "iTerm"' >/dev/null 2>&1; then
    USE_ITERM=1
else
    USE_ITERM=0
fi

if [ "$USE_ITERM" -eq 1 ]; then
osascript << 'APPLESCRIPT'
tell application "iTerm"
    activate
"#);
    script.push_str("# Auto-detects iTerm2 vs Terminal.app\n\n");

    script.push_str(r#"if [ -d "/Applications/iTerm.app" ] || [ -d "$HOME/Applications/iTerm.app" ] || osascript -e 'id of application "iTerm"' >/dev/null 2>&1; then
    USE_ITERM=1
else
    USE_ITERM=0
fi

if [ "$USE_ITERM" -eq 1 ]; then
osascript << 'APPLESCRIPT'
tell application "iTerm"
    activate
"#);

    if grouped_scripts.is_empty() {
        if project.folders.is_empty() {
            script.push_str("    set newWindow to (create window with default profile)\n");
            script.push_str("    set newWindow to (create window with default profile)\n");
        } else {
            for (idx, folder) in project.folders.iter().enumerate() {
                let path = resolve_folder_path(folder);
                let escaped_path = path.replace('\\', "\\\\").replace('"', "\\\"");
                let escaped_path = path.replace('\\', "\\\\").replace('"', "\\\"");
                if idx == 0 {
                    script.push_str("    set newWindow to (create window with default profile)\n");
                    script.push_str("    set newWindow to (create window with default profile)\n");
                    script.push_str(&format!(
                        "    tell current session of newWindow\n        write text \"cd \\\"{}\\\" && exec $SHELL -l\"\n    end tell\n",
                        escaped_path
                    ));
                } else {
                    script.push_str(&format!(
                        "    tell newWindow\n        set newTab to (create tab with default profile)\n        tell current session of newTab\n            write text \"cd \\\"{}\\\" && exec $SHELL -l\"\n        end tell\n    end tell\n",
                        escaped_path
                    ));
                }
            }
        }
    } else {
        for (g_idx, (_group, terms)) in grouped_scripts.iter().enumerate() {
            let win_var = format!("win_g{}", g_idx + 1);
            script.push_str(&format!(
                "    set {} to (create window with default profile)\n",
                win_var
            ));
            for (t_idx, (_term, script_path)) in terms.iter().enumerate() {
                let path_str = script_path.display().to_string();
                let escaped_path = path_str.replace('\\', "\\\\").replace('"', "\\\"");
                if t_idx == 0 {
                    script.push_str(&format!(
                        "    tell current session of {}\n        write text \"exec \\\"{}\\\"\"\n    end tell\n",
                        win_var, escaped_path
                    ));
                } else {
                    let tab_var = format!("tab_g{}_t{}", g_idx + 1, t_idx + 1);
                    script.push_str(&format!(
                        "    tell {}\n        set {} to (create tab with default profile)\n        tell current session of {}\n            write text \"exec \\\"{}\\\"\"\n        end tell\n    end tell\n",
                        win_var, tab_var, tab_var, escaped_path
                    ));
                }
            }
        }
    }

    script.push_str("end tell\nAPPLESCRIPT\nelse\n");

    script.push_str("osascript << 'APPLESCRIPT'\nset wasRunning to application \"Terminal\" is running\ntell application \"Terminal\"\n    activate\n    if not wasRunning then\n        repeat 10 times\n            if (count of windows) > 0 then exit repeat\n            delay 0.1\n        end repeat\n    end if\n");

    if grouped_scripts.is_empty() {
        if project.folders.is_empty() {
            script.push_str("    if not wasRunning and (count of windows) > 0 then\n        do script \"cd '$PWD' && exec $SHELL -l\" in window 1\n    else\n        do script \"cd '$PWD' && exec $SHELL -l\"\n    end if\n");
        } else {
            for (idx, folder) in project.folders.iter().enumerate() {
                let path = resolve_folder_path(folder);
                let escaped_path = path.replace('\\', "\\\\").replace('"', "\\\"");
                if idx == 0 {
                    script.push_str(&format!(
                        "    if not wasRunning and (count of windows) > 0 then\n        do script \"cd \\\"{}\\\" && exec $SHELL -l\" in window 1\n    else\n        do script \"cd \\\"{}\\\" && exec $SHELL -l\"\n    end if\n",
                        escaped_path, escaped_path
                        "    tell current session of newWindow\n        write text \"cd \\\"{}\\\" && exec $SHELL -l\"\n    end tell\n",
                        escaped_path
                    ));
                } else {
                    script.push_str(&format!(
                        "    tell newWindow\n        set newTab to (create tab with default profile)\n        tell current session of newTab\n            write text \"cd \\\"{}\\\" && exec $SHELL -l\"\n        end tell\n    end tell\n",
                        escaped_path
                    ));
                }
            }
        }
    } else {
        for (g_idx, (_group, terms)) in grouped_scripts.iter().enumerate() {
            let win_var = format!("win_g{}", g_idx + 1);
            script.push_str(&format!(
                "    set {} to (create window with default profile)\n",
                win_var
            ));
            for (t_idx, (_term, script_path)) in terms.iter().enumerate() {
                let path_str = script_path.display().to_string();
                let escaped_path = path_str.replace('\\', "\\\\").replace('"', "\\\"");
                if t_idx == 0 {
                    script.push_str(&format!(
                        "    tell current session of {}\n        write text \"exec \\\"{}\\\"\"\n    end tell\n",
                        win_var, escaped_path
                    ));
                } else {
                    let tab_var = format!("tab_g{}_t{}", g_idx + 1, t_idx + 1);
                    script.push_str(&format!(
                        "    tell {}\n        set {} to (create tab with default profile)\n        tell current session of {}\n            write text \"exec \\\"{}\\\"\"\n        end tell\n    end tell\n",
                        win_var, tab_var, tab_var, escaped_path
                    ));
                }
            }
        }
    }

    script.push_str("end tell\nAPPLESCRIPT\nelse\n");

    script.push_str("osascript << 'APPLESCRIPT'\nset wasRunning to application \"Terminal\" is running\ntell application \"Terminal\"\n    activate\n    if not wasRunning then\n        repeat 10 times\n            if (count of windows) > 0 then exit repeat\n            delay 0.1\n        end repeat\n    end if\n");

    if grouped_scripts.is_empty() {
        if project.folders.is_empty() {
            script.push_str("    if not wasRunning and (count of windows) > 0 then\n        do script \"cd '$PWD' && exec $SHELL -l\" in window 1\n    else\n        do script \"cd '$PWD' && exec $SHELL -l\"\n    end if\n");
        } else {
            for (idx, folder) in project.folders.iter().enumerate() {
                let path = resolve_folder_path(folder);
                let escaped_path = path.replace('\\', "\\\\").replace('"', "\\\"");
                if idx == 0 {
                    script.push_str(&format!(
                        "    if not wasRunning and (count of windows) > 0 then\n        do script \"cd \\\"{}\\\" && exec $SHELL -l\" in window 1\n    else\n        do script \"cd \\\"{}\\\" && exec $SHELL -l\"\n    end if\n",
                        escaped_path, escaped_path
                    ));
                } else {
                    script.push_str("    delay 0.5\n    try\n        tell application \"System Events\" to tell process \"Terminal\"\n            keystroke \"t\" using {command down}\n        end tell\n        delay 0.5\n");
                    script.push_str(&format!("        do script \"cd \\\"{}\\\" && exec $SHELL -l\" in selected tab of front window\n    on error\n        do script \"cd \\\"{}\\\" && exec $SHELL -l\"\n    end try\n", escaped_path, escaped_path));
                    script.push_str(&format!("        do script \"cd \\\"{}\\\" && exec $SHELL -l\" in selected tab of front window\n    on error\n        do script \"cd \\\"{}\\\" && exec $SHELL -l\"\n    end try\n", escaped_path, escaped_path));
                }
            }
        }
    } else {
        for (g_idx, (_group, terms)) in grouped_scripts.iter().enumerate() {
            if g_idx > 0 {
                script.push_str("    delay 0.5\n");
            }
            for (t_idx, (_term, script_path)) in terms.iter().enumerate() {
                let path_str = script_path.display().to_string();
                let escaped_path = path_str.replace('\\', "\\\\").replace('"', "\\\"");
                if g_idx == 0 && t_idx == 0 {
                    // First terminal in the first group: reuse startup window if Terminal wasn't running
                    script.push_str(&format!(
                        "    if not wasRunning and (count of windows) > 0 then\n        do script \"exec \\\"{}\\\"\" in window 1\n    else\n        do script \"exec \\\"{}\\\"\"\n    end if\n",
                        escaped_path, escaped_path
                    ));
                } else if t_idx == 0 {
                    // First terminal in subsequent groups starts a new window in Terminal.app
                    script.push_str(&format!(
                        "    do script \"exec \\\"{}\\\"\"\n",
                        escaped_path
                    ));
                } else {
                    // Additional terminals in the same group open as tabs in that window
                    script.push_str("    delay 0.5\n    try\n        tell application \"System Events\" to tell process \"Terminal\"\n            keystroke \"t\" using {command down}\n        end tell\n        delay 0.5\n");
                    script.push_str(&format!(
                        "        do script \"exec \\\"{}\\\"\" in selected tab of front window\n    on error\n        do script \"exec \\\"{}\\\"\"\n    end try\n",
                        escaped_path, escaped_path
                        escaped_path, escaped_path
                    ));
                }
            }
        }
    }

    script.push_str("end tell\nAPPLESCRIPT\nfi\n");
    script.push_str("end tell\nAPPLESCRIPT\nfi\n");
    script
}

fn generate_linux_terminal_script(term: &Terminal, folder: &Folder) -> String {
    let folder_path = resolve_folder_path(folder);
    let title = term.label.replace('"', "\\\"");

    let mut script = String::new();
    script.push_str("#!/usr/bin/env bash\n");
    script.push_str("[ -f \"$HOME/.profile\" ] && source \"$HOME/.profile\" 2>/dev/null\n");
    script.push_str("[ -f \"$HOME/.bashrc\" ] && source \"$HOME/.bashrc\" 2>/dev/null\n");
    script.push_str("[ -f \"$HOME/.profile\" ] && source \"$HOME/.profile\" 2>/dev/null\n");
    script.push_str("[ -f \"$HOME/.bashrc\" ] && source \"$HOME/.bashrc\" 2>/dev/null\n");
    script.push_str(&format!("cd \"{}\" || exit 1\n", folder_path));
    script.push_str(&format!("printf '\\033]0;%s\\007' \"{}\"\n", title));

    match (&term.command, term.keep_alive) {
        (Some(cmd), true) => {
            script.push_str(&format!(
                "trap : INT; {}; exec \"${{SHELL:-bash}}\" -l\n",
                cmd
            ));
        }
        (Some(cmd), false) => {
            script.push_str(&format!("{}\n", cmd));
        }
        (None, _) => {
            script.push_str("exec \"${{SHELL:-bash}}\" -l\n");
        }
    }

    script
}

fn generate_linux_master_script(
    project: &Project,
    grouped_scripts: &[(&TerminalGroup, Vec<(&Terminal, PathBuf)>)],
) -> String {
    let mut script = String::new();
    script.push_str("#!/usr/bin/env bash\n");
    script.push_str(&format!(
        "# CodeLaunch Terminal Launcher for {}\n\n",
        project.name
    ));

    script.push_str(
        r#"# Detect installed terminal emulator
TERMINAL_BIN=""
if [ -n "$TERMINAL" ] && command -v "$TERMINAL" >/dev/null 2>&1; then
    TERMINAL_BIN="$TERMINAL"
elif command -v xdg-terminal-exec >/dev/null 2>&1; then
    TERMINAL_BIN="xdg-terminal-exec"
elif command -v x-terminal-emulator >/dev/null 2>&1; then
    TERMINAL_BIN="x-terminal-emulator"
else
    for term in gnome-terminal ptyxis konsole xfce4-terminal mate-terminal kitty alacritty xterm; do
        if command -v "$term" >/dev/null 2>&1; then
            TERMINAL_BIN="$term"
            break
        fi
    done
fi
"#,
    );

    if grouped_scripts.is_empty() {
        if let Some(folder) = project.folders.first() {
            let path = resolve_folder_path(folder);
            script.push_str(&format!(
                r#"
case "$TERMINAL_BIN" in
    gnome-terminal|ptyxis|mate-terminal)
        "$TERMINAL_BIN" --working-directory="{}" &
        ;;
    konsole)
        "$TERMINAL_BIN" --workdir "{}" &
        ;;
    *)
        (cd "{}" && "$TERMINAL_BIN" &)
        ;;
esac
"#,
                path, path, path
            ));
        }
    } else {
        for (g_idx, (_group, terms)) in grouped_scripts.iter().enumerate() {
            script.push_str(&format!(
                "\n# === Group {} (Window with Tabs) ===\n",
                g_idx + 1
            ));
            script.push_str(
                r#"case "$TERMINAL_BIN" in
    gnome-terminal|ptyxis|mate-terminal)
"#,
            );
            let mut cmd = String::from("        \"$TERMINAL_BIN\"");
            for (t_idx, (term, script_path)) in terms.iter().enumerate() {
                let title = term.label.replace('"', "\\\"");
                if t_idx == 0 {
                    cmd.push_str(&format!(
                        " --window --title=\"{}\" -- /bin/bash \"{}\"",
                        title,
                        script_path.display()
                    ));
                } else {
                    cmd.push_str(&format!(
                        " --tab --title=\"{}\" -- /bin/bash \"{}\"",
                        title,
                        script_path.display()
                    ));
                }
            }
            cmd.push_str(" &\n        ;;\n");
            script.push_str(&cmd);

            script.push_str(
                r#"    konsole)
"#,
            );
            let mut konsole_cmd = String::from(
                "        TABS_FILE=$(mktemp)\n        cat << 'EOF' > \"$TABS_FILE\"\n",
            );
            for (term, script_path) in terms {
                konsole_cmd.push_str(&format!(
                    "title: {};; command: /bin/bash \"{}\"\n",
                    term.label,
                    script_path.display()
                ));
            }
            konsole_cmd.push_str(
                "EOF\n        \"$TERMINAL_BIN\" --tabs-from-file \"$TABS_FILE\" &\n        ;;\n",
            );
            script.push_str(&konsole_cmd);

            script.push_str(
                r#"    xfce4-terminal)
"#,
            );
            let mut xfce_cmd = String::from("        \"$TERMINAL_BIN\"");
            for (t_idx, (term, script_path)) in terms.iter().enumerate() {
                let title = term.label.replace('"', "\\\"");
                if t_idx == 0 {
                    xfce_cmd.push_str(&format!(
                        " --window --title=\"{}\" -e \"/bin/bash '{}'\"",
                        title,
                        script_path.display()
                    ));
                } else {
                    xfce_cmd.push_str(&format!(
                        " --tab --title=\"{}\" -e \"/bin/bash '{}'\"",
                        title,
                        script_path.display()
                    ));
                }
            }
            xfce_cmd.push_str(" &\n        ;;\n");
            script.push_str(&xfce_cmd);

            script.push_str(
                r#"    *)
"#,
            );
            for (_term, script_path) in terms {
                script.push_str(&format!(
                    "        /bin/bash \"{}\" &\n",
                    script_path.display()
                ));
            }
            script.push_str("        ;;\nesac\n");
        }
    }

    script
}

fn generate_windows_terminal_script(term: &Terminal, folder: &Folder) -> String {
    let folder_path = resolve_folder_path(folder);

    let mut script = String::new();
    script.push_str("@echo off\n");
    script.push_str(&format!("title {}\n", term.label));
    script.push_str(&format!("cd /d \"{}\"\n", folder_path));

    match (&term.command, term.keep_alive) {
        (Some(cmd), true) => {
            script.push_str(&format!("call {}\n", cmd));
        }
        (Some(cmd), false) => {
            script.push_str(&format!("call {}\n", cmd));
            script.push_str("exit\n");
        }
        (None, _) => {}
    }

    script
}

fn generate_windows_master_script(
    project: &Project,
    grouped_scripts: &[(&TerminalGroup, Vec<(&Terminal, PathBuf)>)],
) -> String {
    let mut script = String::new();
    script.push_str("@echo off\n");
    script.push_str(&format!(
        "rem CodeLaunch Terminal Launcher for {}\n\n",
        project.name
    ));

    if grouped_scripts.is_empty() {
        if let Some(folder) = project.folders.first() {
            let path = resolve_folder_path(folder);
            script.push_str(&format!("start \"\" cmd /k \"cd /d \"{}\"\"\n", path));
        }
    } else {
        script.push_str("where wt.exe >nul 2>&1\n");
        script.push_str("if %ERRORLEVEL% equ 0 (\n");
        script.push_str("    rem Windows Terminal (1 window per group, with tabs)\n");

        for (_group, terms) in grouped_scripts {
            let mut wt_command = String::from("    start \"\" wt.exe -w new");
            for (idx, (term, script_path)) in terms.iter().enumerate() {
                let path_str = script_path.display().to_string();
                let mode = if term.keep_alive { "/k" } else { "/c" };
                let title = term.label.replace('"', "");
                if idx == 0 {
                    wt_command.push_str(&format!(
                        " new-tab --title \"{}\" cmd {} call \"{}\"",
                        title, mode, path_str
                    ));
                } else {
                    wt_command.push_str(&format!(
                        " ; new-tab --title \"{}\" cmd {} call \"{}\"",
                        title, mode, path_str
                    ));
                }
            }
            script.push_str(&wt_command);
            script.push('\n');
        }

        script.push_str(") else (\n");
        script
            .push_str("    rem Command Prompt (fallback when Windows Terminal is not installed)\n");
        for (_group, terms) in grouped_scripts {
            for (term, script_path) in terms {
                let path_str = script_path.display().to_string();
                let mode = if term.keep_alive { "/k" } else { "/c" };
                let title = term.label.replace('"', "");
                script.push_str(&format!(
                    "    start \"{}\" cmd {} call \"{}\"\n",
                    title, mode, path_str
                ));
            }
        }
        script.push_str(")\n");
    }

    script
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
        "terminal".into()
    } else {
        slug
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::{Folder, IdeKind, Project, Terminal, TerminalGroup};

    fn create_test_project() -> Project {
        let mut project = Project::new("Demo Web App", IdeKind::Terminal);
        let folder = Folder::new("Backend", "/path/to/backend");
        let folder_id = folder.id;
        project.folders.push(folder);
        project.terminals_enabled = true;

        let mut group = TerminalGroup::new("Main Group", 1);
        let mut term1 = Terminal::new("API Server", folder_id, 0);
        term1.command = Some("npm run dev".into());
        term1.keep_alive = true;

        let mut term2 = Terminal::new("Database Migrations", folder_id, 1);
        term2.command = Some("cargo run --bin migrate".into());
        term2.keep_alive = false;

        group.terminals.push(term1);
        group.terminals.push(term2);
        project.terminal_groups.push(group);
        project
    }

    #[test]
    fn render_for_macos_creates_one_window_with_tabs_for_group() {
        let tmp = tempfile::tempdir().unwrap();
        let project = create_test_project();
        let rendered = render_for_os(&project, tmp.path(), TargetOs::MacOs).unwrap();

        assert_eq!(rendered.generated_files.len(), 2);
        assert!(rendered.entry_path.ends_with("launch.command"));

        let master = fs::read_to_string(&rendered.entry_path).unwrap();
        // iTerm2 branch
        assert!(master.contains("tell application \"iTerm\"\n    activate"));
        assert!(master.contains("create window with default profile"));
        assert!(master.contains("create tab with default profile"));
        // Terminal.app fallback branch
        // iTerm2 branch
        assert!(master.contains("tell application \"iTerm\"\n    activate"));
        assert!(master.contains("create window with default profile"));
        assert!(master.contains("create tab with default profile"));
        // Terminal.app fallback branch
        assert!(master.contains("tell application \"Terminal\"\n    activate"));
        assert!(master.contains("do script \"exec"));
        // Second terminal in the same group creates a tab in that window
        assert!(master.contains("keystroke \"t\" using {command down}"));
        assert!(master.contains("in selected tab of front window"));

        let term1_content = fs::read_to_string(&rendered.generated_files[0]).unwrap();
        assert!(term1_content.contains("cd \"/path/to/backend\""));
        assert!(term1_content.contains("trap : INT; npm run dev; exec \"${SHELL:-zsh}\" -l"));

        let term2_content = fs::read_to_string(&rendered.generated_files[1]).unwrap();
        assert!(term2_content.contains("cargo run --bin migrate"));
        assert!(!term2_content.contains("exec \"${SHELL:-zsh}\" -l"));
    }

    #[test]
    fn render_for_macos_handles_multiple_groups_as_separate_windows_with_tabs() {
        let tmp = tempfile::tempdir().unwrap();
        let mut project = create_test_project();
        let folder2 = Folder::new("Frontend", "/path/to/frontend");
        let f2_id = folder2.id;
        project.folders.push(folder2);

        let mut group2 = TerminalGroup::new("Frontend Group", 2);
        let mut term3 = Terminal::new("Vite Dev", f2_id, 0);
        term3.command = Some("npm run dev".into());
        let mut term4 = Terminal::new("Storybook", f2_id, 1);
        term4.command = Some("npm run storybook".into());
        group2.terminals.push(term3);
        group2.terminals.push(term4);
        project.terminal_groups.push(group2);

        let rendered = render_for_os(&project, tmp.path(), TargetOs::MacOs).unwrap();
        assert_eq!(rendered.generated_files.len(), 4);

        let master = fs::read_to_string(&rendered.entry_path).unwrap();
        // Both groups have a second terminal added as a tab via Cmd+T keystroke in Terminal.app
        // Both groups have a second terminal added as a tab via Cmd+T keystroke in Terminal.app
        let tab_adds = master
            .matches("keystroke \"t\" using {command down}")
            .count();
        assert_eq!(
            tab_adds, 2,
            "Each group's second terminal should be added as a tab"
        );
        // Both groups have a second terminal added as a tab in iTerm2
        let iterm_tabs = master.matches("create tab with default profile").count();
        assert_eq!(iterm_tabs, 2);
    }

    #[test]
    fn render_for_linux_creates_expected_scripts() {
        let tmp = tempfile::tempdir().unwrap();
        let project = create_test_project();
        let rendered = render_for_os(&project, tmp.path(), TargetOs::Linux).unwrap();

        assert_eq!(rendered.generated_files.len(), 2);
        assert!(rendered.entry_path.ends_with("launch.sh"));

        assert!(rendered.entry_path.ends_with("launch.sh"));

        let master = fs::read_to_string(&rendered.entry_path).unwrap();
        assert!(master.contains("TERMINAL_BIN"));
        // Modern detection: $TERMINAL, xdg-terminal-exec, x-terminal-emulator
        assert!(master.contains("$TERMINAL"));
        assert!(master.contains("xdg-terminal-exec"));
        assert!(master.contains("x-terminal-emulator"));
        // Modern detection: $TERMINAL, xdg-terminal-exec, x-terminal-emulator
        assert!(master.contains("$TERMINAL"));
        assert!(master.contains("xdg-terminal-exec"));
        assert!(master.contains("x-terminal-emulator"));
        // GNOME / Ptyxis / MATE
        assert!(master.contains("--window --title=\"API Server\""));
        assert!(master.contains("--tab --title=\"Database Migrations\""));
        // Konsole
        assert!(master.contains("--tabs-from-file"));
        assert!(master.contains("title: API Server;; command:"));
        assert!(master.contains("title: Database Migrations;; command:"));
        // XFCE
        assert!(master.contains("--window --title=\"API Server\" -e"));
        assert!(master.contains("--tab --title=\"Database Migrations\" -e"));

        // Verify Linux terminal scripts load user environment (~/.profile and ~/.bashrc)
        let term1_content = fs::read_to_string(&rendered.generated_files[0]).unwrap();
        assert!(term1_content.contains("#!/usr/bin/env bash"));
        assert!(term1_content.contains("[ -f \"$HOME/.profile\" ] && source \"$HOME/.profile\""));
        assert!(term1_content.contains("[ -f \"$HOME/.bashrc\" ] && source \"$HOME/.bashrc\""));
        assert!(term1_content.contains("cd \"/path/to/backend\""));
        assert!(term1_content.contains("trap : INT; npm run dev; exec \"${SHELL:-bash}\" -l"));

        let term2_content = fs::read_to_string(&rendered.generated_files[1]).unwrap();
        assert!(term2_content.contains("cargo run --bin migrate"));
        assert!(!term2_content.contains("exec \"${SHELL:-bash}\" -l"));

        // Verify Linux terminal scripts load user environment (~/.profile and ~/.bashrc)
        let term1_content = fs::read_to_string(&rendered.generated_files[0]).unwrap();
        assert!(term1_content.contains("#!/usr/bin/env bash"));
        assert!(term1_content.contains("[ -f \"$HOME/.profile\" ] && source \"$HOME/.profile\""));
        assert!(term1_content.contains("[ -f \"$HOME/.bashrc\" ] && source \"$HOME/.bashrc\""));
        assert!(term1_content.contains("cd \"/path/to/backend\""));
        assert!(term1_content.contains("trap : INT; npm run dev; exec \"${SHELL:-bash}\" -l"));

        let term2_content = fs::read_to_string(&rendered.generated_files[1]).unwrap();
        assert!(term2_content.contains("cargo run --bin migrate"));
        assert!(!term2_content.contains("exec \"${SHELL:-bash}\" -l"));
    }

    #[test]
    fn render_for_windows_creates_expected_scripts() {
        let tmp = tempfile::tempdir().unwrap();
        let project = create_test_project();
        let rendered = render_for_os(&project, tmp.path(), TargetOs::Windows).unwrap();

        assert_eq!(rendered.generated_files.len(), 2);
        assert!(rendered.entry_path.ends_with("launch.bat"));

        assert!(rendered.entry_path.ends_with("launch.bat"));

        let master = fs::read_to_string(&rendered.entry_path).unwrap();
        assert!(master.contains("where wt.exe"));
        assert!(master.contains("-w new new-tab --title \"API Server\""));
        assert!(master.contains("; new-tab --title \"Database Migrations\""));
        assert!(master.contains("cmd /k call"));
        assert!(master.contains("cmd /c call"));
        // Fallback
        assert!(master.contains("start \"API Server\" cmd /k call"));
        assert!(master.contains("start \"Database Migrations\" cmd /c call"));

        // Verify Windows individual terminal scripts
        let term1_content = fs::read_to_string(&rendered.generated_files[0]).unwrap();
        assert!(term1_content.contains("@echo off"));
        assert!(term1_content.contains("title API Server"));
        assert!(term1_content.contains("cd /d \"/path/to/backend\""));
        assert!(term1_content.contains("call npm run dev"));
        assert!(!term1_content.contains("exit"));

        let term2_content = fs::read_to_string(&rendered.generated_files[1]).unwrap();
        assert!(term2_content.contains("@echo off"));
        assert!(term2_content.contains("title Database Migrations"));
        assert!(term2_content.contains("call cargo run --bin migrate"));
        assert!(term2_content.contains("exit"));

        // Verify Windows individual terminal scripts
        let term1_content = fs::read_to_string(&rendered.generated_files[0]).unwrap();
        assert!(term1_content.contains("@echo off"));
        assert!(term1_content.contains("title API Server"));
        assert!(term1_content.contains("cd /d \"/path/to/backend\""));
        assert!(term1_content.contains("call npm run dev"));
        assert!(!term1_content.contains("exit"));

        let term2_content = fs::read_to_string(&rendered.generated_files[1]).unwrap();
        assert!(term2_content.contains("@echo off"));
        assert!(term2_content.contains("title Database Migrations"));
        assert!(term2_content.contains("call cargo run --bin migrate"));
        assert!(term2_content.contains("exit"));
    }

    #[test]
    fn preview_contains_all_supported_os() {
        let project = create_test_project();
        let preview = generate_preview(&project).unwrap();

        assert!(preview.contains("[macOS]"));
        assert!(preview.contains("[Linux]"));
        assert!(preview.contains("[Windows]"));
        assert!(preview.contains("launch.command"));
        assert!(preview.contains("launch.sh"));
        assert!(preview.contains("launch.bat"));
    }
}
