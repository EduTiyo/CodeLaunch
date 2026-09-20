import { useEffect, useMemo, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import type { Project, ProjectSummary } from "@/lib/types";
import { newId } from "@/lib/types";
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

export function useProjectList() {
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

  return {
    projects,
    search,
    setSearch,
    selected,
    busy,
    projectToDelete,
    setProjectToDelete,
    collapsedGroups,
    isGroupDialogOpen,
    setIsGroupDialogOpen,
    isRenameDialogOpen,
    setIsRenameDialogOpen,
    groupToRename,
    setGroupToRename,
    targetProjectsForGroup,
    initialGroupNameForDialog,
    filteredProjects,
    groups,
    ungrouped,
    existingGroups,
    hasGroupedProjects,
    refresh,
    toggle,
    handleDuplicate,
    handleImport,
    handleLaunch,
    handleLaunchSelected,
    handleConfirmDelete,
    toggleGroupCollapse,
    handleToggleGroupSelect,
    handleLaunchGroup,
    handleSaveGroup,
    handleRenameGroup,
    handleUngroupAll,
    openGroupDialogForSelection,
    openGroupDialogForSingle,
  };
}
