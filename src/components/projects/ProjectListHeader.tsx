import { FolderInput, Plus, Search, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ProjectListHeaderProps {
  search: string;
  onSearchChange: (search: string) => void;
  hasProjects: boolean;
  busy: boolean;
  onImport: () => void;
  onNewProject: () => void;
}

export function ProjectListHeader({
  search,
  onSearchChange,
  hasProjects,
  busy,
  onImport,
  onNewProject,
}: ProjectListHeaderProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h1 className="text-sm font-medium text-muted-foreground">
          {t("projects.title")}
        </h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onImport} disabled={busy}>
            <FolderInput className="size-3.5" />
            {t("projects.importWorkspace")}
          </Button>
          <Button size="sm" onClick={onNewProject} disabled={busy}>
            <Plus className="size-3.5" />
            {t("projects.newProject")}
          </Button>
        </div>
      </div>

      {hasProjects && (
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t("projects.searchPlaceholder")}
            className="h-8 pl-8 pr-8 text-xs"
          />
          {search && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 size-6 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => onSearchChange("")}
              aria-label={t("projects.clearSearch")}
            >
              <X className="size-3" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
