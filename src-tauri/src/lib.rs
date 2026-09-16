mod commands;

use commands::{
    build_state, delete_project, import_vscode_workspace, launch_many, launch_project,
    list_projects, load_project, preview_workspace, save_project,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
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
