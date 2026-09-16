use std::path::PathBuf;
use std::sync::Mutex;

use codelaunch_core::ide::vscode::{build_workspace_document, parse_vscode_workspace};
use codelaunch_core::ide::IdeRegistry;
use codelaunch_core::launcher;
use codelaunch_core::model::{Project, ProjectSummary};
use codelaunch_core::storage::{default_projects_dir, default_workspaces_dir, FsProjectRepository, ProjectRepository};
use uuid::Uuid;

pub struct AppState {
    pub repo: FsProjectRepository,
    pub registry: IdeRegistry,
    pub workspaces_dir: PathBuf,
}

/// Mutex is overkill for a single-user desktop app with no real concurrency, but it
/// keeps Tauri's `Send + Sync` requirement trivially satisfied without unsafe.
pub type SharedState = Mutex<AppState>;

pub fn build_state() -> Result<SharedState, String> {
    let projects_dir = default_projects_dir().ok_or("could not resolve config directory")?;
    let workspaces_dir = default_workspaces_dir().ok_or("could not resolve config directory")?;
    let repo = FsProjectRepository::new(projects_dir).map_err(|e| e.to_string())?;
    Ok(Mutex::new(AppState {
        repo,
        registry: IdeRegistry::new(),
        workspaces_dir,
    }))
}

#[tauri::command]
pub fn list_projects(state: tauri::State<SharedState>) -> Result<Vec<ProjectSummary>, String> {
    state.lock().unwrap().repo.list().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn load_project(state: tauri::State<SharedState>, id: Uuid) -> Result<Project, String> {
    state
        .lock()
        .unwrap()
        .repo
        .load(id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_project(state: tauri::State<SharedState>, mut project: Project) -> Result<Project, String> {
    project.updated_at = chrono::Utc::now();
    state
        .lock()
        .unwrap()
        .repo
        .save(&project)
        .map_err(|e| e.to_string())?;
    Ok(project)
}

#[tauri::command]
pub fn delete_project(state: tauri::State<SharedState>, id: Uuid) -> Result<(), String> {
    state
        .lock()
        .unwrap()
        .repo
        .delete(id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn preview_workspace(project: Project) -> Result<String, String> {
    let doc = build_workspace_document(&project).map_err(|e| e.to_string())?;
    serde_json::to_string_pretty(&doc).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn launch_project(state: tauri::State<SharedState>, id: Uuid) -> Result<(), String> {
    let guard = state.lock().unwrap();
    let project = guard.repo.load(id).map_err(|e| e.to_string())?;
    launcher::launch(&guard.registry, &project, &guard.workspaces_dir).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn launch_many(state: tauri::State<SharedState>, ids: Vec<Uuid>) -> Result<Vec<String>, String> {
    let guard = state.lock().unwrap();
    let mut errors = Vec::new();
    for id in ids {
        let result = guard
            .repo
            .load(id)
            .map_err(|e| e.to_string())
            .and_then(|project| {
                launcher::launch(&guard.registry, &project, &guard.workspaces_dir)
                    .map_err(|e| e.to_string())
            });
        if let Err(e) = result {
            errors.push(format!("{id}: {e}"));
        }
    }
    Ok(errors)
}

#[tauri::command]
pub fn import_vscode_workspace(
    state: tauri::State<SharedState>,
    path: String,
) -> Result<Project, String> {
    let project = parse_vscode_workspace(std::path::Path::new(&path)).map_err(|e| e.to_string())?;
    state
        .lock()
        .unwrap()
        .repo
        .save(&project)
        .map_err(|e| e.to_string())?;
    Ok(project)
}
