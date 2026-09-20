import { Folder, Play } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

interface BatchActionBarProps {
  selectedCount: number;
  busy: boolean;
  onGroupSelected: () => void;
  onLaunchSelected: () => void;
}

export function BatchActionBar({
  selectedCount,
  busy,
  onGroupSelected,
  onLaunchSelected,
}: BatchActionBarProps) {
  const { t } = useTranslation();

  if (selectedCount === 0) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 border-t border-border bg-background/95 backdrop-blur z-20">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-3">
        <span className="text-sm text-muted-foreground">
          {t("projects.selectedCount", { count: selectedCount })}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={onGroupSelected}
            disabled={busy}
          >
            <Folder className="size-3.5 mr-1" />
            {t("projects.groupSelected")}
          </Button>
          <Button onClick={onLaunchSelected} disabled={busy}>
            <Play className="size-3.5 mr-1" />
            {t("projects.launchSelected")}
          </Button>
        </div>
      </div>
    </div>
  );
}
