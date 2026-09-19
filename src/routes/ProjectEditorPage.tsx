import { useEffect, useRef, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { toast } from "sonner";
import { ChevronDown, FolderPlus, Sparkles, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { DetectedCommand, Folder, IdeKind, Project, Terminal, TerminalGroup } from "@/lib/types";
import { emptyProject, IDE_LABELS, IDE_OPTIONS, newId } from "@/lib/types";
import { detectFolderCommands, launchProject, loadProject, previewWorkspace, saveProject } from "@/lib/tauriApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TerminalGrid } from "@/components/TerminalGrid";
import { AutoDetectDialog } from "@/components/AutoDetectDialog";

interface Props {
  projectId: string | null;
  onDirtyChange?: (isDirty: boolean) => void;
}

function sanitizeProject(p: Project): Project {
  const validFolderIds = new Set(p.folders.map((f) => f.id));
  const fallbackFolderId = p.folders[0]?.id ?? "";
  return {
    ...p,
    terminal_groups: (p.terminal_groups || []).map((g) => ({
      ...g,
      terminals: (g.terminals || []).map((t) =>
        validFolderIds.has(t.folder_id)
          ? t
          : { ...t, folder_id: fallbackFolderId }
      ),
    })),
  };
}

export function ProjectEditorPage({ projectId, onDirtyChange }: Props) {
  const { t } = useTranslation();
  const [project, setProject] = useState<Project | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [detectFolder, setDetectFolder] = useState<Folder | null>(null);
  const [isDetectOpen, setIsDetectOpen] = useState(false);
  const initialJsonRef = useRef<string | null>(null);

  useEffect(() => {
    if (projectId) {
      loadProject(projectId)
        .then((raw) => {
          const p = sanitizeProject(raw);
          setProject(p);
          initialJsonRef.current = JSON.stringify(p);
          onDirtyChange?.(false);
        })
        .catch((e) => toast.error(String(e)));
    } else {
      const initial = emptyProject(t("editor.defaultProjectName"));
      setProject(initial);
      initialJsonRef.current = JSON.stringify(initial);
      onDirtyChange?.(false);
    }
  }, [projectId, t, onDirtyChange]);

  const handleSaveRef = useRef<(andOpen: boolean) => Promise<void>>(() => Promise.resolve());

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        handleSaveRef.current(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (!project || !initialJsonRef.current) return;
    const isDirty = JSON.stringify(project) !== initialJsonRef.current;
    onDirtyChange?.(isDirty);
  }, [project, onDirtyChange]);

  if (!project) {
    return <p className="p-6 text-sm text-muted-foreground">{t("common.loading")}</p>;
  }

  function update(patch: Partial<Project>) {
    setProject((prev) => (prev ? { ...prev, ...patch } : prev));
  }

  async function addFolder() {
    const result = await open({ directory: true, multiple: true });
    if (!result) return;
    const paths = Array.isArray(result) ? result : [result];
    const newFolders: Folder[] = paths.map((path) => ({
      id: newId(),
      name: path.split(/[/\\]/).filter(Boolean).pop() ?? "folder",
      path,
    }));
    const updatedFolders = [...project!.folders, ...newFolders];
    const firstFolderId = updatedFolders[0]?.id;
    // Heal any terminals that may be missing a valid folder reference
    const updatedGroups = project!.terminal_groups.map((g) => ({
      ...g,
      terminals: g.terminals.map((t) =>
        !updatedFolders.some((f) => f.id === t.folder_id) && firstFolderId
          ? { ...t, folder_id: firstFolderId }
          : t
      ),
    }));
    update({ folders: updatedFolders, terminal_groups: updatedGroups });

    if (newFolders.length === 1) {
      const added = newFolders[0];
      detectFolderCommands(added.path)
        .then((cmds) => {
          if (cmds.length > 0) {
            setDetectFolder(added);
            setIsDetectOpen(true);
          }
        })
        .catch(() => {});
    }
  }

  function handleAddDetectedCommands(
    selected: DetectedCommand[],
    targetGroupId: string,
    newGroupName?: string
  ) {
    if (!project || !detectFolder || selected.length === 0) return;

    let groups = [...project.terminal_groups];
    let targetGroup: TerminalGroup;

    if (targetGroupId === "__new__" || groups.length === 0) {
      const nextOrder = groups.length + 1;
      const group: TerminalGroup = {
        id: newId(),
        name: newGroupName?.trim() || `group${nextOrder}`,
        order: nextOrder,
        terminals: [],
      };
      groups.push(group);
      targetGroup = group;
    } else {
      targetGroup = groups.find((g) => g.id === targetGroupId) ?? groups[0];
    }

    const existingLabels = new Set<string>();
    groups.forEach((g) => {
      g.terminals.forEach((t) => existingLabels.add(t.label));
    });

    const newTerminals: Terminal[] = selected.map((cmd) => {
      let label = cmd.label;
      let counter = 2;
      while (existingLabels.has(label)) {
        label = `${cmd.label} (${counter})`;
        counter++;
      }
      existingLabels.add(label);

      return {
        id: newId(),
        label,
        folder_id: detectFolder.id,
        command: cmd.command,
        keep_alive: true,
        order: 0,
      };
    });

    const updatedGroups = groups.map((g) => {
      if (g.id !== targetGroup.id) return g;
      const combined = [...g.terminals, ...newTerminals].map((t, idx) => ({
        ...t,
        order: idx,
      }));
      return { ...g, terminals: combined };
    });

    update({
      terminal_groups: updatedGroups,
      terminals_enabled: true,
    });

    toast.success(
      t("editor.toasts.detectedAdded", {
        count: selected.length,
        folder: detectFolder.name,
      })
    );
  }


  function removeFolder(id: string) {
    const remainingFolders = project!.folders.filter((f) => f.id !== id);
    const fallbackFolderId = remainingFolders[0]?.id ?? "";
    const updatedGroups = project!.terminal_groups.map((g) => ({
      ...g,
      terminals: g.terminals.map((t) =>
        t.folder_id === id ? { ...t, folder_id: fallbackFolderId } : t
      ),
    }));
    update({ folders: remainingFolders, terminal_groups: updatedGroups });
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

  function removeGroup(groupId: string) {
    update({ terminal_groups: project!.terminal_groups.filter((g) => g.id !== groupId) });
  }

  function addTerminal(groupId: string) {
    if (project!.folders.length === 0) {
      toast.error(t("editor.toasts.addFolderFirst"));
      return;
    }
    // VS Code task labels must be unique across the whole workspace file, not just
    // within a group — count every terminal in the project, not just this group's.
    const totalTerminals = project!.terminal_groups.reduce((n, g) => n + g.terminals.length, 0);
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
                  label: `${t("terminals.terminal")} ${totalTerminals + 1}`,
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
          : { ...g, terminals: g.terminals.map((t) => (t.id === terminalId ? { ...t, ...patch } : t)) }
      ),
    });
  }

  function updateGroupName(groupId: string, name: string) {
    update({
      terminal_groups: project!.terminal_groups.map((g) =>
        g.id === groupId ? { ...g, name } : g
      ),
    });
  }

  function moveGroup(groupId: string, direction: "up" | "down") {
    const groups = [...project!.terminal_groups];
    const index = groups.findIndex((g) => g.id === groupId);
    if (index === -1) return;
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= groups.length) return;
    const [moved] = groups.splice(index, 1);
    groups.splice(targetIndex, 0, moved);
    update({
      terminal_groups: groups.map((g, i) => ({ ...g, order: i + 1 })),
    });
  }

  function moveTerminal(groupId: string, terminalId: string, direction: "left" | "right") {
    update({
      terminal_groups: project!.terminal_groups.map((g) => {
        if (g.id !== groupId) return g;
        const index = g.terminals.findIndex((t) => t.id === terminalId);
        if (index === -1) return g;
        const targetIndex = direction === "left" ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= g.terminals.length) return g;
        const newTerminals = [...g.terminals];
        const [moved] = newTerminals.splice(index, 1);
        newTerminals.splice(targetIndex, 0, moved);
        return {
          ...g,
          terminals: newTerminals.map((t, i) => ({ ...t, order: i })),
        };
      }),
    });
  }

  function removeTerminal(groupId: string, terminalId: string) {
    update({
      terminal_groups: project!.terminal_groups.map((g) =>
        g.id !== groupId ? g : { ...g, terminals: g.terminals.filter((t) => t.id !== terminalId) }
      ),
    });
  }

  async function handleSave(andOpen: boolean) {
    if (!project!.name.trim()) {
      toast.error(t("editor.toasts.nameRequired"));
      return;
    }
    if (
      project!.terminals_enabled &&
      project!.folders.length === 0 &&
      project!.terminal_groups.some((g) => g.terminals.length > 0)
    ) {
      toast.error(t("editor.toasts.addFolderFirst"));
      return;
    }
    try {
      const saved = await saveProject(project!);
      setProject(saved);
      initialJsonRef.current = JSON.stringify(saved);
      onDirtyChange?.(false);
      if (andOpen) {
        await launchProject(saved.id);
        toast.success(
          t("editor.toasts.savedAndOpened", {
            ide: IDE_LABELS[saved.ide] ?? "IDE",
          })
        );
      } else {
        toast.success(t("editor.toasts.saved"));
      }
    } catch (e) {
      toast.error(String(e));
    }
  }

  handleSaveRef.current = handleSave;

  async function handlePreview() {
    try {
      setPreview(await previewWorkspace(project!));
    } catch (e) {
      toast.error(String(e));
    }
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 px-6 pb-28 pt-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-end gap-4">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="project-name">{t("editor.name")}</Label>
            <Input
              id="project-name"
              value={project.name}
              onChange={(e) => update({ name: e.target.value })}
            />
          </div>
          <div className="w-44 space-y-1.5">
            <Label htmlFor="project-group">{t("editor.group")}</Label>
            <Input
              id="project-group"
              value={project.group ?? ""}
              onChange={(e) =>
                update({ group: e.target.value.trim() ? e.target.value : null })
              }
              placeholder={t("editor.groupPlaceholder")}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t("editor.ide")}</Label>
            <Select
              value={project.ide}
              onValueChange={(ide: IdeKind) => update({ ide })}
            >
              <SelectTrigger className="w-44">
                <SelectValue placeholder="VS Code" />
              </SelectTrigger>
              <SelectContent>
                {IDE_OPTIONS.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{t("editor.comingSoon")}</p>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">{t("editor.folders")}</h2>
          <Button variant="outline" size="sm" onClick={addFolder}>
            <FolderPlus className="size-3.5" />
            {t("editor.addFolder")}
          </Button>
        </div>
        {project.folders.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("editor.noFolders")}</p>
        ) : (
          <div className="divide-y divide-border rounded-lg border border-border">
            {project.folders.map((f) => (
              <div key={f.id} className="flex items-center justify-between gap-4 px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{f.name}</p>
                  <p className="truncate font-mono text-xs text-muted-foreground">{f.path}</p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      setDetectFolder(f);
                      setIsDetectOpen(true);
                    }}
                    title={t("editor.detectScriptsTooltip")}
                  >
                    <Sparkles className="size-3.5" />
                    {t("editor.detectScripts")}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 shrink-0 text-muted-foreground"
                    onClick={() => removeFolder(f.id)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <Separator />

      <section className="space-y-4">
        <Label className="flex items-center gap-2 text-sm font-medium">
          <Switch
            checked={project.terminals_enabled}
            onCheckedChange={(terminals_enabled) => update({ terminals_enabled })}
          />
          {t("editor.integratedTerminals")}
        </Label>

        {project.terminals_enabled && (
          <TerminalGrid
            groups={project.terminal_groups}
            folders={project.folders}
            onAddGroup={addGroup}
            onRemoveGroup={removeGroup}
            onAddTerminal={addTerminal}
            onUpdateTerminal={updateTerminal}
            onRemoveTerminal={removeTerminal}
            onUpdateGroupName={updateGroupName}
            onMoveGroup={moveGroup}
            onMoveTerminal={moveTerminal}
          />
        )}
      </section>

      <section>
        <Button variant="ghost" size="sm" onClick={handlePreview}>
          <ChevronDown className="size-3.5" />
          {t("editor.viewJson")}
        </Button>
        {preview && (
          <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-muted p-3 font-mono text-xs">
            {preview}
          </pre>
        )}
      </section>

      <div className="fixed inset-x-0 bottom-0 border-t border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-end gap-2 px-6 py-3">
          <Button variant="outline" onClick={() => handleSave(false)}>
            {t("common.save")}
            <span className="ml-1 text-xs text-muted-foreground opacity-80">(⌘S)</span>
          </Button>
          <Button onClick={() => handleSave(true)}>{t("editor.saveAndOpen")}</Button>
        </div>
      </div>

      <AutoDetectDialog
        open={isDetectOpen}
        onOpenChange={setIsDetectOpen}
        folder={detectFolder}
        groups={project.terminal_groups}
        onAddCommands={handleAddDetectedCommands}
      />
    </div>
  );
}

