import { useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { toast } from "sonner";
import { Copy, FolderInput, MoreHorizontal, Play, Plus, Rocket, Search, X } from "lucide-react";
import { useTranslation, Trans } from "react-i18next";
import type { Project, ProjectSummary } from "@/lib/types";
import { newId } from "@/lib/types";
import {
  deleteProject,
  importVsCodeWorkspace,
  launchMany,
  launchProject,
  listProjects,
  loadProject,
  saveProject,
} from "@/lib/tauriApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Props {
  onEdit: (id: string | null) => void;
}

export function ProjectListPage({ onEdit }: Props) {
  const { t } = useTranslation();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<ProjectSummary | null>(null);

  const refresh = () => listProjects().then(setProjects).catch((e) => toast.error(String(e)));

  useEffect(() => {
    refresh();
  }, []);

  async function handleDuplicate(id: string) {
    setBusy(true);
    try {
      const original = await loadProject(id);
      const now = new Date().toISOString();
      const newFolders = original.folders.map((f) => ({ ...f, id: newId() }));
      const folderIdMap = new Map<string, string>();
      original.folders.forEach((f, i) => {
        folderIdMap.set(f.id, newFolders[i].id);
      });
      const duplicated: Project = {
        ...original,
        id: newId(),
        name: `${original.name} (${t("common.copy")})`,
        folders: newFolders,
        terminal_groups: original.terminal_groups.map((g) => ({
          ...g,
          id: newId(),
          terminals: g.terminals.map((term) => ({
            ...term,
            id: newId(),
            folder_id: folderIdMap.get(term.folder_id) ?? (newFolders[0]?.id || ""),
          })),
        })),
        created_at: now,
        updated_at: now,
      };
      await saveProject(duplicated);
      toast.success(t("projects.toasts.duplicated", { name: duplicated.name }));
      refresh();
    } catch (e) {
      toast.error(String(e));
    } finally {
      setBusy(false);
    }
  }

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
      filters: [{ name: t("projects.vsCodeWorkspace"), extensions: ["code-workspace"] }],
    });
    if (!path || Array.isArray(path)) return;
    setBusy(true);
    try {
      const project = await importVsCodeWorkspace(path);
      toast.success(t("projects.toasts.imported", { name: project.name }));
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
      toast.success(t("projects.toasts.workspaceOpened"));
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
        toast.success(t("projects.toasts.workspacesOpened", { count: selected.size }));
      } else {
        toast.error(t("projects.toasts.completedWithErrors", { errors: errors.join("; ") }));
      }
    } catch (e) {
      toast.error(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirmDelete() {
    if (!projectToDelete) return;
    setBusy(true);
    try {
      await deleteProject(projectToDelete.id);
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(projectToDelete.id);
        return next;
      });
      toast.success(t("projects.toasts.projectDeleted", { name: projectToDelete.name }));
      setProjectToDelete(null);
      refresh();
    } catch (e) {
      toast.error(String(e));
    } finally {
      setBusy(false);
    }
  }

  const query = search.toLowerCase().trim();
  const filteredProjects = query
    ? projects.filter((p) => p.name.toLowerCase().includes(query))
    : projects;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 px-6 py-6 pb-24">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h1 className="text-sm font-medium text-muted-foreground">{t("projects.title")}</h1>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleImport} disabled={busy}>
              <FolderInput className="size-3.5" />
              {t("projects.importWorkspace")}
            </Button>
            <Button size="sm" onClick={() => onEdit(null)} disabled={busy}>
              <Plus className="size-3.5" />
              {t("projects.newProject")}
            </Button>
          </div>
        </div>

        {projects.length > 0 && (
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("projects.searchPlaceholder")}
              className="h-8 pl-8 pr-8 text-xs"
            />
            {search && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 size-6 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setSearch("")}
                aria-label={t("projects.clearSearch")}
              >
                <X className="size-3" />
              </Button>
            )}
          </div>
        )}
      </div>

      {projects.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border py-16 text-center">
          <Rocket className="size-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {t("projects.emptyDescription")}
          </p>
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border py-12 text-center">
          <Search className="size-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {t("projects.noSearchResults", { query: search })}
          </p>
          <Button variant="ghost" size="sm" onClick={() => setSearch("")}>
            {t("projects.clearSearch")}
          </Button>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead>{t("projects.table.name")}</TableHead>
              <TableHead>{t("projects.table.ide")}</TableHead>
              <TableHead>{t("projects.table.folders")}</TableHead>
              <TableHead>{t("projects.table.terminals")}</TableHead>
              <TableHead className="w-32 text-right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredProjects.map((p) => (
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
                  {p.terminal_group_count > 0 ? t("projects.table.groupCount", { count: p.terminal_group_count }) : "—"}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleLaunch(p.id)}
                      disabled={busy}
                    >
                      <Play className="size-3.5" />
                      {t("projects.actions.launch")}
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-7" disabled={busy}>
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => onEdit(p.id)}>
                          {t("projects.actions.edit")}
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => handleDuplicate(p.id)}>
                          <Copy className="size-3.5" />
                          {t("projects.actions.duplicate")}
                        </DropdownMenuItem>
                        <DropdownMenuItem variant="destructive" onSelect={() => setProjectToDelete(p)}>
                          {t("projects.actions.delete")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {selected.size > 0 && (
        <div className="fixed inset-x-0 bottom-0 border-t border-border bg-background/95 backdrop-blur">
          <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-3">
            <span className="text-sm text-muted-foreground">
              {t("projects.selectedCount", { count: selected.size })}
            </span>
            <Button onClick={handleLaunchSelected} disabled={busy}>
              {t("projects.launchSelected")}
            </Button>
          </div>
        </div>
      )}

      <Dialog
        open={!!projectToDelete}
        onOpenChange={(open) => {
          if (!open && !busy) {
            setProjectToDelete(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("projects.deleteDialog.title")}</DialogTitle>
            <DialogDescription>
              <Trans
                i18nKey="projects.deleteDialog.description"
                values={{ name: projectToDelete?.name }}
                components={{
                  strong: <span className="font-semibold text-foreground" />,
                }}
              />
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setProjectToDelete(null)}
              disabled={busy}
            >
              {t("projects.deleteDialog.cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={busy}
            >
              {busy ? t("projects.deleteDialog.deleting") : t("projects.deleteDialog.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
