import { useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import type { Folder, Project, Terminal, TerminalGroup } from "../lib/types";
import { emptyProject, newId } from "../lib/types";
import { launchProject, loadProject, previewWorkspace, saveProject } from "../lib/tauriApi";

interface Props {
  projectId: string | null;
  onBack: () => void;
}

export function ProjectEditorPage({ projectId, onBack }: Props) {
  const [project, setProject] = useState<Project | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (projectId) {
      loadProject(projectId).then(setProject).catch((e) => setMessage(String(e)));
    } else {
      setProject(emptyProject("Novo Projeto"));
    }
  }, [projectId]);

  if (!project) return <div style={{ padding: "1.5rem" }}>Carregando...</div>;

  function update(patch: Partial<Project>) {
    setProject((prev) => (prev ? { ...prev, ...patch } : prev));
  }

  async function addFolder() {
    const path = await open({ directory: true, multiple: false });
    if (!path || Array.isArray(path)) return;
    const name = path.split("/").filter(Boolean).pop() ?? "folder";
    const folder: Folder = { id: newId(), name, path };
    update({ folders: [...project!.folders, folder] });
  }

  function removeFolder(id: string) {
    update({ folders: project!.folders.filter((f) => f.id !== id) });
  }

  function addGroup() {
    const nextOrder = project!.terminal_groups.length + 1;
    const group: TerminalGroup = {
      id: newId(),
      name: `group${nextOrder}`,
      order: nextOrder,
      terminals: [],
    };
    update({ terminal_groups: [...project!.terminal_groups, group] });
  }

  function removeGroup(id: string) {
    update({ terminal_groups: project!.terminal_groups.filter((g) => g.id !== id) });
  }

  function addTerminal(groupId: string) {
    if (project!.folders.length === 0) {
      setMessage("Adicione uma pasta antes de criar um terminal.");
      return;
    }
    update({
      terminal_groups: project!.terminal_groups.map((g) =>
        g.id !== groupId
          ? g
          : {
              ...g,
              terminals: [
                ...g.terminals,
                {
                  id: newId(),
                  label: `Terminal ${g.terminals.length + 1}`,
                  folder_id: project!.folders[0].id,
                  command: null,
                  keep_alive: true,
                  order: g.terminals.length,
                } satisfies Terminal,
              ],
            }
      ),
    });
  }

  function updateTerminal(groupId: string, terminalId: string, patch: Partial<Terminal>) {
    update({
      terminal_groups: project!.terminal_groups.map((g) =>
        g.id !== groupId
          ? g
          : {
              ...g,
              terminals: g.terminals.map((t) =>
                t.id === terminalId ? { ...t, ...patch } : t
              ),
            }
      ),
    });
  }

  function removeTerminal(groupId: string, terminalId: string) {
    update({
      terminal_groups: project!.terminal_groups.map((g) =>
        g.id !== groupId
          ? g
          : { ...g, terminals: g.terminals.filter((t) => t.id !== terminalId) }
      ),
    });
  }

  async function handleSave(andOpen: boolean) {
    try {
      const saved = await saveProject(project!);
      setProject(saved);
      if (andOpen) {
        await launchProject(saved.id);
        setMessage("Salvo e aberto.");
      } else {
        setMessage("Salvo.");
      }
    } catch (e) {
      setMessage(String(e));
    }
  }

  async function handlePreview() {
    try {
      setPreview(await previewWorkspace(project!));
    } catch (e) {
      setMessage(String(e));
    }
  }

  return (
    <div style={{ padding: "1.5rem", fontFamily: "system-ui, sans-serif" }}>
      <button onClick={onBack}>&larr; Voltar</button>
      <h1 style={{ fontSize: "1.25rem" }}>Editar Projeto</h1>
      {message && <p style={{ background: "#eef", padding: "0.5rem", borderRadius: 4 }}>{message}</p>}

      <label style={{ display: "block", margin: "1rem 0" }}>
        Nome
        <br />
        <input value={project.name} onChange={(e) => update({ name: e.target.value })} />
      </label>

      <label style={{ display: "block" }}>
        IDE
        <br />
        <select value={project.ide} disabled>
          <option value="vs-code">VS Code</option>
        </select>{" "}
        <span style={{ color: "#888" }}>(outras IDEs em breve)</span>
      </label>

      <h2 style={{ fontSize: "1rem", marginTop: "1.5rem" }}>Pastas</h2>
      <ul>
        {project.folders.map((f) => (
          <li key={f.id}>
            <strong>{f.name}</strong> — {f.path}{" "}
            <button onClick={() => removeFolder(f.id)}>Remover</button>
          </li>
        ))}
      </ul>
      <button onClick={addFolder}>+ Pasta</button>

      <h2 style={{ fontSize: "1rem", marginTop: "1.5rem" }}>
        Terminais{" "}
        <label style={{ fontWeight: "normal", fontSize: "0.9rem" }}>
          <input
            type="checkbox"
            checked={project.terminals_enabled}
            onChange={(e) => update({ terminals_enabled: e.target.checked })}
          />{" "}
          habilitados
        </label>
      </h2>

      {project.terminals_enabled && (
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
          {project.terminal_groups.map((group) => (
            <div
              key={group.id}
              style={{ border: "1px solid #ccc", borderRadius: 6, padding: "0.75rem", minWidth: 220 }}
            >
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <strong>{group.name}</strong>
                <button onClick={() => removeGroup(group.id)}>Remover grupo</button>
              </div>
              {group.terminals.map((t) => (
                <div key={t.id} style={{ borderTop: "1px solid #eee", marginTop: "0.5rem", paddingTop: "0.5rem" }}>
                  <input
                    value={t.label}
                    onChange={(e) => updateTerminal(group.id, t.id, { label: e.target.value })}
                    style={{ width: "100%" }}
                  />
                  <select
                    value={t.folder_id}
                    onChange={(e) => updateTerminal(group.id, t.id, { folder_id: e.target.value })}
                    style={{ width: "100%", marginTop: "0.25rem" }}
                  >
                    {project.folders.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                  <textarea
                    placeholder="comando (opcional)"
                    value={t.command ?? ""}
                    onChange={(e) =>
                      updateTerminal(group.id, t.id, { command: e.target.value || null })
                    }
                    style={{ width: "100%", marginTop: "0.25rem" }}
                  />
                  <label style={{ display: "block", fontSize: "0.85rem" }}>
                    <input
                      type="checkbox"
                      checked={t.keep_alive}
                      onChange={(e) => updateTerminal(group.id, t.id, { keep_alive: e.target.checked })}
                    />{" "}
                    manter vivo após o comando (exec $SHELL -l)
                  </label>
                  <button onClick={() => removeTerminal(group.id, t.id)}>Remover terminal</button>
                </div>
              ))}
              <button style={{ marginTop: "0.5rem" }} onClick={() => addTerminal(group.id)}>
                + Terminal
              </button>
            </div>
          ))}
          <button onClick={addGroup} style={{ alignSelf: "flex-start" }}>
            + Grupo
          </button>
        </div>
      )}

      <div style={{ marginTop: "1.5rem", display: "flex", gap: "0.5rem" }}>
        <button onClick={handlePreview}>Preview JSON</button>
        <button onClick={() => handleSave(false)}>Salvar</button>
        <button onClick={() => handleSave(true)}>Salvar e Abrir</button>
      </div>

      {preview && (
        <pre style={{ background: "#111", color: "#0f0", padding: "1rem", marginTop: "1rem", overflow: "auto" }}>
          {preview}
        </pre>
      )}
    </div>
  );
}
