import { useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { toast } from "sonner";
import { ChevronDown, FolderPlus, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Folder, Project, Terminal, TerminalGroup } from "@/lib/types";
import { emptyProject, newId } from "@/lib/types";
import { launchProject, loadProject, previewWorkspace, saveProject } from "@/lib/tauriApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TerminalGrid } from "@/components/TerminalGrid";

interface Props {
  projectId: string | null;
}

export function ProjectEditorPage({ projectId }: Props) {
  const { t } = useTranslation();
  const [project, setProject] = useState<Project | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (projectId) {
      loadProject(projectId).then(setProject).catch((e) => toast.error(String(e)));
    } else {
      setProject(emptyProject(t("editor.defaultProjectName")));
    }
  }, [projectId, t]);

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
      name: path.split("/").filter(Boolean).pop() ?? "folder",
      path,
    }));
    update({ folders: [...project!.folders, ...newFolders] });
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

  function removeTerminal(groupId: string, terminalId: string) {
    update({
      terminal_groups: project!.terminal_groups.map((g) =>
        g.id !== groupId ? g : { ...g, terminals: g.terminals.filter((t) => t.id !== terminalId) }
      ),
    });
  }

  async function handleSave(andOpen: boolean) {
    try {
      const saved = await saveProject(project!);
      setProject(saved);
      if (andOpen) {
        await launchProject(saved.id);
        toast.success(t("editor.toasts.savedAndOpened"));
      } else {
        toast.success(t("editor.toasts.saved"));
      }
    } catch (e) {
      toast.error(String(e));
    }
  }

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
          <div className="space-y-1.5">
            <Label>{t("editor.ide")}</Label>
            <Select value={project.ide} disabled>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="vs-code">VS Code</SelectItem>
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
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 shrink-0 text-muted-foreground"
                  onClick={() => removeFolder(f.id)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
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
          </Button>
          <Button onClick={() => handleSave(true)}>{t("editor.saveAndOpen")}</Button>
        </div>
      </div>
    </div>
  );
}
