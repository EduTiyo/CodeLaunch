import type { ReactNode } from "react";
import {
  ChevronDown,
  ChevronRight,
  Edit2,
  Folder,
  FolderX,
  MoreHorizontal,
  Play,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ProjectGroupSectionProps {
  title: string;
  count: number;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  allSelected: boolean;
  onToggleSelect: () => void;
  shortcutLabel?: string;
  busy: boolean;
  onLaunchGroup?: () => void;
  onRenameGroup?: () => void;
  onUngroupAll?: () => void;
  children: ReactNode;
}

export function ProjectGroupSection({
  title,
  count,
  isCollapsed,
  onToggleCollapse,
  allSelected,
  onToggleSelect,
  shortcutLabel,
  busy,
  onLaunchGroup,
  onRenameGroup,
  onUngroupAll,
  children,
}: ProjectGroupSectionProps) {
  const { t } = useTranslation();

  return (
    <div className="rounded-lg border border-border overflow-hidden bg-card shadow-xs">
      <div className="flex items-center justify-between px-3 py-2 bg-muted/40 border-b border-border/60">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="size-6 text-muted-foreground hover:text-foreground"
            onClick={onToggleCollapse}
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
            onCheckedChange={onToggleSelect}
            aria-label={`Select all projects in ${title}`}
          />
          {onLaunchGroup && <Folder className="size-4 text-primary" />}
          <span className="font-semibold text-sm">{title}</span>
          <Badge
            variant={onLaunchGroup ? "secondary" : "outline"}
            className="text-xs px-1.5 py-0 h-4"
          >
            {count}
          </Badge>
        </div>

        {onLaunchGroup && (
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1.5 text-xs"
              onClick={onLaunchGroup}
              disabled={busy}
            >
              <Play className="size-3" />
              {t("projects.launchGroup", { count })}
              {shortcutLabel && (
                <kbd className="ml-0.5 font-mono text-[10px] opacity-70">
                  ({shortcutLabel})
                </kbd>
              )}
            </Button>
            {(onRenameGroup || onUngroupAll) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-muted-foreground"
                    aria-label="Group options"
                  >
                    <MoreHorizontal className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {onRenameGroup && (
                    <DropdownMenuItem onSelect={onRenameGroup}>
                      <Edit2 className="size-3.5" />
                      {t("projects.actions.renameGroup")}
                    </DropdownMenuItem>
                  )}
                  {onUngroupAll && (
                    <DropdownMenuItem
                      variant="destructive"
                      onSelect={onUngroupAll}
                    >
                      <FolderX className="size-3.5" />
                      {t("projects.actions.ungroupAll")}
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        )}
      </div>

      {!isCollapsed && children}
    </div>
  );
}
