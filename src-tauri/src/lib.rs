mod commands;

use std::path::PathBuf;

use commands::{
    build_state, delete_project, import_vscode_workspace, launch_many, launch_project,
    list_projects, load_project, preview_workspace, save_project,
};

#[cfg(target_os = "macos")]
fn ensure_sensible_path() {
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
