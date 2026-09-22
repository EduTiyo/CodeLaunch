mod commands;

use commands::{
    build_state, delete_project, detect_folder_commands, import_vscode_workspace, launch_many,
    launch_project, list_projects, load_project, open_terminal_settings, preview_workspace,
    rename_project_group, save_project, set_projects_group,
};

#[cfg(target_os = "macos")]
fn ensure_sensible_path() {
    use std::path::PathBuf;

    if let Some(path) = std::env::var_os("PATH") {
        let mut paths = std::env::split_paths(&path).collect::<Vec<_>>();
        let common_dirs = [
            "/opt/homebrew/bin",
            "/opt/homebrew/sbin",
            "/usr/local/bin",
            "/usr/local/sbin",
        ];
        let mut changed = false;
        for dir_str in common_dirs {
            let dir = PathBuf::from(dir_str);
            if dir.is_dir() && !paths.contains(&dir) {
                paths.insert(0, dir);
                changed = true;
            }
        }
        if changed {
            if let Ok(new_path) = std::env::join_paths(paths) {
                std::env::set_var("PATH", new_path);
            }
        }
    }
}

#[cfg(not(target_os = "macos"))]
fn ensure_sensible_path() {}

#[cfg(target_os = "linux")]
fn ensure_linux_env() {
    // Avoid Wayland protocol crash ("Error 71 dispatching to Wayland display")
    // by falling back to X11/XWayland when GDK_BACKEND is not explicitly set.
    if std::env::var_os("GDK_BACKEND").is_none() {
        std::env::set_var("GDK_BACKEND", "x11");
    }
    // Prevent WebKitGTK DMA-BUF rendering crashes and white/blank screens.
    if std::env::var_os("WEBKIT_DISABLE_DMABUF_RENDERER").is_none() {
        std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
    }
}

#[cfg(not(target_os = "linux"))]
fn ensure_linux_env() {}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    ensure_linux_env();
    ensure_sensible_path();
    let state = build_state().expect("failed to initialize CodeLaunch state");

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(state)
        .invoke_handler(tauri::generate_handler![
            list_projects,
            load_project,
            save_project,
            delete_project,
            preview_workspace,
            launch_project,
            launch_many,
            import_vscode_workspace,
            open_terminal_settings,
            detect_folder_commands,
            set_projects_group,
            rename_project_group,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
