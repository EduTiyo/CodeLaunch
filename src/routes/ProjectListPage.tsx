import { useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import type { ProjectSummary } from "../lib/types";
import {
  deleteProject,
  importVsCodeWorkspace,
  launchMany,
  launchProject,
  listProjects,
} from "../lib/tauriApi";

interface Props {
  onEdit: (id: string | null) => void;
}

export function ProjectListPage({ onEdit }: Props) {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = () => listProjects().then(setProjects).catch((e) => setMessage(String(e)));

  useEffect(() => {
    refresh();
  }, []);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleImport() {
    const path = await open({
      multiple: false,
      filters: [{ name: "VS Code Workspace", extensions: ["code-workspace"] }],
    });
    if (!path || Array.isArray(path)) return;
    setBusy(true);
    try {
      const project = await importVsCodeWorkspace(path);
      setMessage(`Importado "${project.name}" (${project.terminal_groups.length} grupo(s) de terminal).`);
      refresh();
    } catch (e) {
      setMessage(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleLaunch(id: string) {
    setBusy(true);
    try {
      await launchProject(id);
      setMessage("Workspace aberto.");
    } catch (e) {
      setMessage(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleLaunchSelected() {
    setBusy(true);
    try {
      const errors = await launchMany([...selected]);
      setMessage(
        errors.length === 0
          ? `${selected.size} workspace(s) aberto(s).`
          : `Concluído com erros: ${errors.join("; ")}`
      );
    } catch (e) {
      setMessage(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    setBusy(true);
    try {
      await deleteProject(id);
      refresh();
    } catch (e) {
      setMessage(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ padding: "1.5rem", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ fontSize: "1.25rem" }}>CodeLaunch</h1>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button onClick={handleImport} disabled={busy}>
            Importar .code-workspace...
          </button>
          <button onClick={() => onEdit(null)} disabled={busy}>
            + Novo Projeto
          </button>
          <button onClick={handleLaunchSelected} disabled={busy || selected.size === 0}>
            Abrir Selecionados ({selected.size})
          </button>
        </div>
      </div>

      {message && (
        <p style={{ background: "#eef", padding: "0.5rem", borderRadius: 4 }}>{message}</p>
      )}

      <table style={{ width: "100%", marginTop: "1rem", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>
            <th></th>
            <th>Nome</th>
            <th>IDE</th>
            <th>Pastas</th>
            <th>Grupos de terminal</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {projects.map((p) => (
            <tr key={p.id} style={{ borderBottom: "1px solid #eee" }}>
              <td>
                <input
                  type="checkbox"
                  checked={selected.has(p.id)}
                  onChange={() => toggle(p.id)}
                />
              </td>
              <td>{p.name}</td>
              <td>{p.ide}</td>
              <td>{p.folder_count}</td>
              <td>{p.terminal_group_count}</td>
              <td style={{ display: "flex", gap: "0.5rem" }}>
                <button onClick={() => handleLaunch(p.id)} disabled={busy}>
                  Abrir
                </button>
                <button onClick={() => onEdit(p.id)} disabled={busy}>
                  Editar
                </button>
                <button onClick={() => handleDelete(p.id)} disabled={busy}>
                  Excluir
                </button>
              </td>
            </tr>
          ))}
          {projects.length === 0 && (
            <tr>
              <td colSpan={6} style={{ padding: "1rem", color: "#666" }}>
                Nenhum projeto ainda. Importe um .code-workspace existente ou crie um novo.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
