import { invoke } from "@tauri-apps/api/core";
import type { Project, ProjectSummary } from "./types";

export function listProjects(): Promise<ProjectSummary[]> {
  return invoke("list_projects");
}

export function loadProject(id: string): Promise<Project> {
  return invoke("load_project", { id });
}

export function saveProject(project: Project): Promise<Project> {
  return invoke("save_project", { project });
}

export function deleteProject(id: string): Promise<void> {
  return invoke("delete_project", { id });
}

export function previewWorkspace(project: Project): Promise<string> {
  return invoke("preview_workspace", { project });
}

export function launchProject(id: string): Promise<void> {
  return invoke("launch_project", { id });
}

/** Returns a list of "<id>: <error>" strings for any project that failed to launch. */
export function launchMany(ids: string[]): Promise<string[]> {
  return invoke("launch_many", { ids });
}

export function importVsCodeWorkspace(path: string): Promise<Project> {
  return invoke("import_vscode_workspace", { path });
}

export function openTerminalSettings(): Promise<void> {
  return invoke("open_terminal_settings");
}
