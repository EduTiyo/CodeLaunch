// Mirrors the Rust structs in crates/codelaunch-core/src/model/project.rs.
// TODO: generate this automatically via ts-rs once the model stabilizes (see plan Fase 1).

export type IdeKind = "vs-code" | "cursor" | "vscodium" | "windsurf";

export interface IdeOption {
  id: IdeKind;
  name: string;
}

export const IDE_OPTIONS: IdeOption[] = [
  { id: "vs-code", name: "VS Code" },
  { id: "cursor", name: "Cursor" },
  { id: "vscodium", name: "VSCodium" },
  { id: "windsurf", name: "Windsurf" },
];

export const IDE_LABELS: Record<IdeKind, string> = {
  "vs-code": "VS Code",
  "cursor": "Cursor",
  "vscodium": "VSCodium",
  "windsurf": "Windsurf",
};

export interface DetectedCommand {
  label: string;
  command: string;
  source: string;
  default_selected: boolean;
}

export interface Folder {
  id: string;
  name: string;
  path: string;
}

export interface Terminal {
  id: string;
  label: string;
  folder_id: string;
  command: string | null;
  keep_alive: boolean;
  order: number;
}

export interface TerminalGroup {
  id: string;
  name: string;
  order: number;
  terminals: Terminal[];
}

export interface Project {
  id: string;
  name: string;
  ide: IdeKind;
  folders: Folder[];
  terminals_enabled: boolean;
  terminal_groups: TerminalGroup[];
  extra_settings: Record<string, unknown>;
  schema_version: number;
  created_at: string;
  updated_at: string;
}

export interface ProjectSummary {
  id: string;
  name: string;
  ide: IdeKind;
  folder_count: number;
  terminal_group_count: number;
  updated_at: string;
}

export function newId(): string {
  return crypto.randomUUID();
}

export function emptyProject(name: string): Project {
  const now = new Date().toISOString();
  return {
    id: newId(),
    name,
    ide: "vs-code",
    folders: [],
    terminals_enabled: false,
    terminal_groups: [],
    extra_settings: {},
    schema_version: 1,
    created_at: now,
    updated_at: now,
  };
}
