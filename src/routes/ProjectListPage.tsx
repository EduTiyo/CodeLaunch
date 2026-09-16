import { useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { toast } from "sonner";
import { FolderInput, MoreHorizontal, Plus, Rocket } from "lucide-react";
import type { ProjectSummary } from "@/lib/types";
import {
  deleteProject,
  importVsCodeWorkspace,
  launchMany,
  launchProject,
  listProjects,
} from "@/lib/tauriApi";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Props {
  onEdit: (id: string | null) => void;
}

export function ProjectListPage({ onEdit }: Props) {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const refresh = () => listProjects().then(setProjects).catch((e) => toast.error(String(e)));

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
      toast.success(`Importado "${project.name}".`);
      refresh();
    } catch (e) {
      toast.error(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleLaunch(id: string) {
    setBusy(true);
    try {
      await launchProject(id);
      toast.success("Workspace aberto.");
    } catch (e) {
      toast.error(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleLaunchSelected() {
    setBusy(true);
    try {
      const errors = await launchMany([...selected]);
      if (errors.length === 0) {
        toast.success(`${selected.size} workspace(s) aberto(s).`);
      } else {
        toast.error(`Concluído com erros: ${errors.join("; ")}`);
      }
    } catch (e) {
      toast.error(String(e));
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
      toast.error(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 px-6 py-6 pb-24">
      <div className="flex items-center justify-between">
        <h1 className="text-sm font-medium text-muted-foreground">Projetos</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleImport} disabled={busy}>
            <FolderInput className="size-3.5" />
            Importar .code-workspace...
          </Button>
          <Button size="sm" onClick={() => onEdit(null)} disabled={busy}>
            <Plus className="size-3.5" />
            Novo projeto
          </Button>
        </div>
      </div>

      {projects.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border py-16 text-center">
          <Rocket className="size-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Nenhum projeto ainda — importe um .code-workspace existente ou crie um novo.
          </p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead>Nome</TableHead>
              <TableHead>IDE</TableHead>
              <TableHead>Pastas</TableHead>
              <TableHead>Terminais</TableHead>
              <TableHead className="w-8" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {projects.map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  <Checkbox checked={selected.has(p.id)} onCheckedChange={() => toggle(p.id)} />
                </TableCell>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell>
                  <Badge variant="secondary">VS Code</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">{p.folder_count}</TableCell>
                <TableCell className="text-muted-foreground">
                  {p.terminal_group_count > 0 ? `${p.terminal_group_count} grupo(s)` : "—"}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="size-7" disabled={busy}>
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleLaunch(p.id)}>Abrir</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onEdit(p.id)}>Editar</DropdownMenuItem>
                      <DropdownMenuItem variant="destructive" onClick={() => handleDelete(p.id)}>
                        Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {selected.size > 0 && (
        <div className="fixed inset-x-0 bottom-0 border-t border-border bg-background/95 backdrop-blur">
          <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-3">
            <span className="text-sm text-muted-foreground">{selected.size} selecionado(s)</span>
            <Button onClick={handleLaunchSelected} disabled={busy}>
              Abrir selecionados
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
