import { ExternalLink } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { IdeKind, Project } from "@/lib/types";
import { IDE_OPTIONS } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const isMac =
  typeof navigator !== "undefined" && /Mac/i.test(navigator.userAgent);

interface ProjectBasicInfoSectionProps {
  project: Project;
  onUpdate: (patch: Partial<Project>) => void;
  onActivateTerminal: () => void;
}

export function ProjectBasicInfoSection({
  project,
  onUpdate,
  onActivateTerminal,
}: ProjectBasicInfoSectionProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end gap-4">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="project-name">{t("editor.name")}</Label>
          <Input
            id="project-name"
            value={project.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
          />
        </div>
        <div className="w-44 space-y-1.5">
          <Label htmlFor="project-group">{t("editor.group")}</Label>
          <Input
            id="project-group"
            value={project.group ?? ""}
            onChange={(e) =>
              onUpdate({ group: e.target.value.trim() ? e.target.value : null })
            }
            placeholder={t("editor.groupPlaceholder")}
          />
        </div>
        <div className="space-y-1.5">
          <Label>{t("editor.openWith")}</Label>
          <Select
            value={project.ide}
            onValueChange={(ide: IdeKind) => onUpdate({ ide })}
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
      {project.ide === "terminal" && isMac && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 px-3.5 py-2.5 text-xs">
          <span className="text-muted-foreground">
            {t("editor.terminalMacNotice")}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 shrink-0 gap-1.5 text-xs"
            onClick={onActivateTerminal}
          >
            <ExternalLink className="size-3" />
            {t("editor.activateTerminal")}
          </Button>
        </div>
      )}
    </div>
  );
}
