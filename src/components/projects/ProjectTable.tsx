import { Copy, Folder, MoreHorizontal, Play } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ProjectSummary } from "@/lib/types";
import { IDE_LABELS } from "@/lib/types";
import { Button } from "@/components/ui/button";
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

interface ProjectTableProps {
  items: ProjectSummary[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  showGroupBadge?: boolean;
  shortcutsMap: Map<string, { label: string }>;
  busy: boolean;
  onLaunch: (id: string) => void;
  onEdit: (id: string) => void;
  onDuplicate: (id: string) => void;
  onAssignGroup: (project: ProjectSummary) => void;
  onDelete: (project: ProjectSummary) => void;
}

export function ProjectTable({
  items,
  selected,
  onToggle,
  showGroupBadge = false,
  shortcutsMap,
  busy,
  onLaunch,
  onEdit,
  onDuplicate,
  onAssignGroup,
  onDelete,
}: ProjectTableProps) {
  const { t } = useTranslation();

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
        {items.map((p) => {
          const shortcut = shortcutsMap.get(`project:${p.id}`);
          return (
            <TableRow key={p.id}>
              <TableCell>
                <Checkbox
                  checked={selected.has(p.id)}
                  onCheckedChange={() => onToggle(p.id)}
                  aria-label={`Select ${p.name}`}
                />
              </TableCell>
              <TableCell className="font-medium">
                <div className="flex items-center gap-2">
                  <span>{p.name}</span>
                  {p.group && showGroupBadge && (
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
                    onClick={() => onLaunch(p.id)}
                    disabled={busy}
                  >
                    <Play className="size-3.5" />
                    {t("projects.actions.launch")}
                    {shortcut && (
                      <kbd className="ml-1 font-mono text-[10px] opacity-70">
                        ({shortcut.label})
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
                        aria-label="Project actions"
                      >
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => onEdit(p.id)}>
                        {t("projects.actions.edit")}
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => onDuplicate(p.id)}>
                        <Copy className="size-3.5" />
                        {t("projects.actions.duplicate")}
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => onAssignGroup(p)}>
                        <Folder className="size-3.5" />
                        {t("projects.actions.assignGroup")}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        variant="destructive"
                        onSelect={() => onDelete(p)}
                      >
                        {t("projects.actions.delete")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
