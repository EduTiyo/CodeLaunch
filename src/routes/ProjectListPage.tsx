import { useEffect, useMemo, useRef, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronRight,
  Copy,
  Edit2,
  Folder,
  FolderInput,
  FolderX,
  MoreHorizontal,
  Play,
  Plus,
  Rocket,
  Search,
  X,
} from "lucide-react";
import { useTranslation, Trans } from "react-i18next";
import type { Project, ProjectSummary } from "@/lib/types";
import { IDE_LABELS, newId } from "@/lib/types";
import {
  deleteProject,
  importVsCodeWorkspace,
  launchMany,
  launchProject,
  listProjects,
  loadProject,
  renameProjectGroup,
  saveProject,
  setProjectsGroup,
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
import { ProjectGroupDialog } from "@/components/ProjectGroupDialog";
import { RenameGroupDialog } from "@/components/RenameGroupDialog";

interface Props {
  onEdit: (id: string | null) => void;
}

const isMac =
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPod|iPad/i.test(navigator.userAgent || navigator.platform);

export function ProjectListPage({ onEdit }: Props) {
  const { t } = useTranslation();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<ProjectSummary | null>(null);

  // Grouping state
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [isGroupDialogOpen, setIsGroupDialogOpen] = useState(false);
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [groupToRename, setGroupToRename] = useState("");
  const [targetProjectsForGroup, setTargetProjectsForGroup] = useState<string[]>([]);
  const [initialGroupNameForDialog, setInitialGroupNameForDialog] = useState<string | undefined>(undefined);

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

  function toggleGroupCollapse(groupName: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupName)) {
        next.delete(groupName);
      } else {
        next.add(groupName);
      }
      return next;
    });
  }

  function handleToggleGroupSelect(groupProjects: ProjectSummary[]) {
    const allSelected =
      groupProjects.length > 0 && groupProjects.every((p) => selected.has(p.id));
    setSelected((prev) => {
      const next = new Set(prev);
      groupProjects.forEach((p) => {
        if (allSelected) {
          next.delete(p.id);
        } else {
          next.add(p.id);
        }
      });
      return next;
    });
  }

  async function handleLaunchGroup(groupProjects: ProjectSummary[]) {
    setBusy(true);
    try {
      const errors = await launchMany(groupProjects.map((p) => p.id));
      if (errors.length === 0) {
        toast.success(
          t("projects.toasts.workspacesOpened", { count: groupProjects.length })
        );
      } else {
        toast.error(
          t("projects.toasts.completedWithErrors", { errors: errors.join("; ") })
        );
      }
    } catch (e) {
      toast.error(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveGroup(groupName: string | null) {
    if (targetProjectsForGroup.length === 0) return;
    setBusy(true);
    try {
      await setProjectsGroup(targetProjectsForGroup, groupName);
      if (groupName) {
        toast.success(
          t("projects.toasts.groupUpdated", { count: targetProjectsForGroup.length })
        );
      } else {
        toast.success(
          t("projects.toasts.groupRemoved", { count: targetProjectsForGroup.length })
        );
      }
      refresh();
    } catch (e) {
      toast.error(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleRenameGroup(oldName: string, newName: string) {
    setBusy(true);
    try {
      await renameProjectGroup(oldName, newName);
      toast.success(t("projects.toasts.groupRenamed", { name: newName }));
      refresh();
    } catch (e) {
      toast.error(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleUngroupAll(groupName: string) {
    const ids = projects
      .filter((p) => p.group?.trim() === groupName)
      .map((p) => p.id);
    if (ids.length === 0) return;
    setBusy(true);
    try {
      await setProjectsGroup(ids, null);
      toast.success(t("projects.toasts.groupRemoved", { count: ids.length }));
      refresh();
    } catch (e) {
      toast.error(String(e));
    } finally {
      setBusy(false);
    }
  }

  function openGroupDialogForSelection() {
    const ids = [...selected];
    setTargetProjectsForGroup(ids);
    const selectedProjects = projects.filter((p) => selected.has(p.id));
    const firstGroup = selectedProjects[0]?.group ?? undefined;
    const allSame = selectedProjects.every((p) => p.group === firstGroup);
    setInitialGroupNameForDialog(allSame ? (firstGroup ?? undefined) : undefined);
    setIsGroupDialogOpen(true);
  }

  function openGroupDialogForSingle(p: ProjectSummary) {
    setTargetProjectsForGroup([p.id]);
    setInitialGroupNameForDialog(p.group ?? undefined);
    setIsGroupDialogOpen(true);
  }

  const query = search.toLowerCase().trim();
  const filteredProjects = query
    ? projects.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          (p.group && p.group.toLowerCase().includes(query))
      )
    : projects;

  const { groups, ungrouped, existingGroups } = useMemo(() => {
    const map = new Map<string, ProjectSummary[]>();
    const ungroupedList: ProjectSummary[] = [];

    filteredProjects.forEach((p) => {
      const g = p.group?.trim();
      if (g) {
        if (!map.has(g)) map.set(g, []);
        map.get(g)!.push(p);
      } else {
        ungroupedList.push(p);
      }
    });

    const allGroups = Array.from(
      new Set(projects.map((p) => p.group?.trim()).filter(Boolean) as string[])
    ).sort();

    return {
      groups: Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b)),
      ungrouped: ungroupedList,
      existingGroups: allGroups,
    };
  }, [filteredProjects, projects]);

  const hasGroupedProjects = targetProjectsForGroup.some((id) => {
    const p = projects.find((proj) => proj.id === id);
    return Boolean(p?.group);
  });

  const launchableShortcuts = useMemo(() => {
    const list: {
      key: string;
      digit: number;
      label: string;
      action: () => void;
    }[] = [];

    let currentDigit = 1;

    function addShortcut(key: string, action: () => void) {
      if (currentDigit <= 9) {
        list.push({
          key,
          digit: currentDigit,
          label: isMac ? `⌘${currentDigit}` : `Ctrl+${currentDigit}`,
          action,
        });
        currentDigit++;
      }
    }

    if (groups.length === 0) {
      filteredProjects.forEach((p) => {
        addShortcut(`project:${p.id}`, () => handleLaunch(p.id));
      });
    } else {
      groups.forEach(([groupName, groupProjects]) => {
        addShortcut(`group:${groupName}`, () => handleLaunchGroup(groupProjects));

        if (!collapsedGroups.has(groupName)) {
          groupProjects.forEach((p) => {
            addShortcut(`project:${p.id}`, () => handleLaunch(p.id));
          });
        }
      });

      if (ungrouped.length > 0 && !collapsedGroups.has("__ungrouped__")) {
        ungrouped.forEach((p) => {
          addShortcut(`project:${p.id}`, () => handleLaunch(p.id));
        });
      }
    }

    const map = new Map<string, { digit: number; label: string; action: () => void }>();
    list.forEach((item) => {
      map.set(item.key, item);
    });

    return { list, map };
  }, [groups, filteredProjects, collapsedGroups, ungrouped, busy]);

  const shortcutsRef = useRef(launchableShortcuts.list);
  shortcutsRef.current = launchableShortcuts.list;

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (busy) return;
      if (projectToDelete || isGroupDialogOpen || isRenameDialogOpen) return;
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement)?.isContentEditable
      ) {
        return;
      }

      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey) {
        const digit = parseInt(e.key, 10);
        if (digit >= 1 && digit <= 9) {
          const item = shortcutsRef.current.find((i) => i.digit === digit);
          if (item) {
            e.preventDefault();
            item.action();
          }
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [busy, projectToDelete, isGroupDialogOpen, isRenameDialogOpen]);

  function renderProjectTable(items: ProjectSummary[]) {
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8" />
            <TableHead>{t("projects.table.name")}</TableHead>
            <TableHead>{t("projects.table.openWith")}</TableHead>
            <TableHead>{t("projects.table.folders")}</TableHead>
            <TableHead>{t("projects.table.terminals")}</TableHead>
            <TableHead className="w-32 text-right" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((p) => (
            <TableRow key={p.id}>
              <TableCell>
                <Checkbox
                  checked={selected.has(p.id)}
                  onCheckedChange={() => toggle(p.id)}
                />
              </TableCell>
              <TableCell className="font-medium">
                <div className="flex items-center gap-2">
                  <span>{p.name}</span>
                  {p.group && groups.length === 0 && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                      {p.group}
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="secondary">{IDE_LABELS[p.ide] ?? p.ide}</Badge>
              </TableCell>
              <TableCell className="text-muted-foreground">{p.folder_count}</TableCell>
              <TableCell className="text-muted-foreground">
                {p.terminal_group_count > 0
                  ? t("projects.table.groupCount", {
                      count: p.terminal_group_count,
                    })
                  : "—"}
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
                    {launchableShortcuts.map.get(`project:${p.id}`) && (
                      <kbd className="ml-1 font-mono text-[10px] opacity-70">
                        ({launchableShortcuts.map.get(`project:${p.id}`)!.label})
                      </kbd>
                    )}
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        disabled={busy}
                      >
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
                      <DropdownMenuItem onSelect={() => openGroupDialogForSingle(p)}>
                        <Folder className="size-3.5" />
                        {t("projects.actions.assignGroup")}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        variant="destructive"
                        onSelect={() => setProjectToDelete(p)}
                      >
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
    );
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 px-6 py-6 pb-24">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h1 className="text-sm font-medium text-muted-foreground">
            {t("projects.title")}
          </h1>
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
      ) : groups.length === 0 ? (
        renderProjectTable(filteredProjects)
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map(([groupName, groupProjects]) => {
            const isCollapsed = collapsedGroups.has(groupName);
            const allSelected =
              groupProjects.length > 0 &&
              groupProjects.every((p) => selected.has(p.id));

            return (
              <div
                key={groupName}
                className="rounded-lg border border-border overflow-hidden bg-card shadow-xs"
              >
                <div className="flex items-center justify-between px-3 py-2 bg-muted/40 border-b border-border/60">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-6 text-muted-foreground hover:text-foreground"
                      onClick={() => toggleGroupCollapse(groupName)}
                      aria-label="Toggle group collapse"
                    >
                      {isCollapsed ? (
                        <ChevronRight className="size-4" />
                      ) : (
                        <ChevronDown className="size-4" />
                      )}
                    </Button>
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={() =>
                        handleToggleGroupSelect(groupProjects)
                      }
                    />
                    <Folder className="size-4 text-primary" />
                    <span className="font-semibold text-sm">{groupName}</span>
                    <Badge variant="secondary" className="text-xs px-1.5 py-0 h-4">
                      {groupProjects.length}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 gap-1.5 text-xs"
                      onClick={() => handleLaunchGroup(groupProjects)}
                      disabled={busy}
                    >
                      <Play className="size-3" />
                      {t("projects.launchGroup", {
                        count: groupProjects.length,
                      })}
                      {launchableShortcuts.map.get(`group:${groupName}`) && (
                        <kbd className="ml-0.5 font-mono text-[10px] opacity-70">
                          ({launchableShortcuts.map.get(`group:${groupName}`)!.label})
                        </kbd>
                      )}
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 text-muted-foreground"
                        >
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onSelect={() => {
                            setGroupToRename(groupName);
                            setIsRenameDialogOpen(true);
                          }}
                        >
                          <Edit2 className="size-3.5" />
                          {t("projects.actions.renameGroup")}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          onSelect={() => handleUngroupAll(groupName)}
                        >
                          <FolderX className="size-3.5" />
                          {t("projects.actions.ungroupAll")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {!isCollapsed && renderProjectTable(groupProjects)}
              </div>
            );
          })}

          {ungrouped.length > 0 && (
            <div className="rounded-lg border border-border overflow-hidden bg-card shadow-xs">
              <div className="flex items-center justify-between px-3 py-2 bg-muted/40 border-b border-border/60">
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-6 text-muted-foreground hover:text-foreground"
                    onClick={() => toggleGroupCollapse("__ungrouped__")}
                    aria-label="Toggle ungrouped collapse"
                  >
                    {collapsedGroups.has("__ungrouped__") ? (
                      <ChevronRight className="size-4" />
                    ) : (
                      <ChevronDown className="size-4" />
                    )}
                  </Button>
                  <Checkbox
                    checked={
                      ungrouped.length > 0 &&
                      ungrouped.every((p) => selected.has(p.id))
                    }
                    onCheckedChange={() => handleToggleGroupSelect(ungrouped)}
                  />
                  <span className="font-medium text-sm text-muted-foreground">
                    {t("projects.ungroupedProjects")}
                  </span>
                  <Badge variant="outline" className="text-xs px-1.5 py-0 h-4">
                    {ungrouped.length}
                  </Badge>
                </div>
              </div>

              {!collapsedGroups.has("__ungrouped__") &&
                renderProjectTable(ungrouped)}
            </div>
          )}
        </div>
      )}

      {selected.size > 0 && (
        <div className="fixed inset-x-0 bottom-0 border-t border-border bg-background/95 backdrop-blur">
          <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-3">
            <span className="text-sm text-muted-foreground">
              {t("projects.selectedCount", { count: selected.size })}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={openGroupDialogForSelection}
                disabled={busy}
              >
                <Folder className="size-3.5 mr-1" />
                {t("projects.groupSelected")}
              </Button>
              <Button onClick={handleLaunchSelected} disabled={busy}>
                <Play className="size-3.5 mr-1" />
                {t("projects.launchSelected")}
              </Button>
            </div>
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
              {busy
                ? t("projects.deleteDialog.deleting")
                : t("projects.deleteDialog.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ProjectGroupDialog
        open={isGroupDialogOpen}
        onOpenChange={setIsGroupDialogOpen}
        selectedCount={targetProjectsForGroup.length}
        existingGroups={existingGroups}
        initialGroupName={initialGroupNameForDialog}
        hasGroupedProjects={hasGroupedProjects}
        onSaveGroup={handleSaveGroup}
      />

      <RenameGroupDialog
        open={isRenameDialogOpen}
        onOpenChange={setIsRenameDialogOpen}
        oldName={groupToRename}
        onRename={handleRenameGroup}
      />
    </div>
  );
}
