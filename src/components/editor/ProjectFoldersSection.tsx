import { FolderPlus, Sparkles, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Folder } from "@/lib/types";
import { Button } from "@/components/ui/button";

interface ProjectFoldersSectionProps {
  folders: Folder[];
  onAddFolder: () => void;
  onRemoveFolder: (id: string) => void;
  onDetectScripts: (folder: Folder) => void;
}

export function ProjectFoldersSection({
  folders,
  onAddFolder,
  onRemoveFolder,
  onDetectScripts,
}: ProjectFoldersSectionProps) {
  const { t } = useTranslation();

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">{t("editor.folders")}</h2>
        <Button variant="outline" size="sm" onClick={onAddFolder}>
          <FolderPlus className="size-3.5" />
          {t("editor.addFolder")}
        </Button>
      </div>

      {folders.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("editor.noFolders")}</p>
      ) : (
        <div className="divide-y divide-border rounded-lg border border-border">
          {folders.map((f) => (
            <div
              key={f.id}
              className="flex items-center justify-between gap-4 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium">{f.name}</p>
                <p className="truncate font-mono text-xs text-muted-foreground">
                  {f.path}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => onDetectScripts(f)}
                  title={t("editor.detectScriptsTooltip")}
                >
                  <Sparkles className="size-3.5" />
                  {t("editor.detectScripts")}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 shrink-0 text-muted-foreground"
                  onClick={() => onRemoveFolder(f.id)}
                  aria-label={`Remove folder ${f.name}`}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
