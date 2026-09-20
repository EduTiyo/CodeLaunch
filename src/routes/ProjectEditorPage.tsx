import { useTranslation } from "react-i18next";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { TerminalGrid } from "@/components/TerminalGrid";
import { AutoDetectDialog } from "@/components/AutoDetectDialog";
import { useProjectEditor } from "@/hooks/useProjectEditor";
import { ProjectBasicInfoSection } from "@/components/editor/ProjectBasicInfoSection";
import { ProjectFoldersSection } from "@/components/editor/ProjectFoldersSection";
import { WorkspacePreviewSection } from "@/components/editor/WorkspacePreviewSection";
import { EditorBottomBar } from "@/components/editor/EditorBottomBar";

interface Props {
  projectId: string | null;
  onDirtyChange?: (isDirty: boolean) => void;
}

export function ProjectEditorPage({ projectId, onDirtyChange }: Props) {
  const { t } = useTranslation();
  const editor = useProjectEditor({ projectId, onDirtyChange });

  if (!editor.project) {
    return (
      <p className="p-6 text-sm text-muted-foreground">
        {t("common.loading")}
      </p>
    );
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 px-6 pb-28 pt-6">
      <ProjectBasicInfoSection
        project={editor.project}
        onUpdate={editor.update}
        onActivateTerminal={editor.handleActivateTerminal}
      />

      <ProjectFoldersSection
        folders={editor.project.folders}
        onAddFolder={editor.addFolder}
        onRemoveFolder={editor.removeFolder}
        onDetectScripts={(folder) => {
          editor.setDetectFolder(folder);
          editor.setIsDetectOpen(true);
        }}
      />

      <Separator />

      <section className="space-y-4">
        <Label className="flex items-center gap-2 text-sm font-medium">
          <Switch
            checked={editor.project.terminals_enabled}
            onCheckedChange={(terminals_enabled) =>
              editor.update({ terminals_enabled })
            }
          />
          {t("editor.integratedTerminals")}
        </Label>

        {editor.project.terminals_enabled && (
          <TerminalGrid
            groups={editor.project.terminal_groups}
            folders={editor.project.folders}
            onAddGroup={editor.addGroup}
            onRemoveGroup={editor.removeGroup}
            onAddTerminal={editor.addTerminal}
            onUpdateTerminal={editor.updateTerminal}
            onRemoveTerminal={editor.removeTerminal}
            onUpdateGroupName={editor.updateGroupName}
            onMoveGroup={editor.moveGroup}
            onMoveTerminal={editor.moveTerminal}
          />
        )}
      </section>

      <WorkspacePreviewSection
        ide={editor.project.ide}
        preview={editor.preview}
        onPreview={editor.handlePreview}
      />

      <EditorBottomBar onSave={editor.handleSave} />

      <AutoDetectDialog
        open={editor.isDetectOpen}
        onOpenChange={editor.setIsDetectOpen}
        folder={editor.detectFolder}
        groups={editor.project.terminal_groups}
        onAddCommands={editor.handleAddDetectedCommands}
      />
    </div>
  );
}
