import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Sparkles } from "lucide-react";
import { detectFolderCommands } from "@/lib/tauriApi";
import type { DetectedCommand, Folder, TerminalGroup } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folder: Folder | null;
  groups: TerminalGroup[];
  onAddCommands: (
    selected: DetectedCommand[],
    targetGroupId: string,
    newGroupName?: string
  ) => void;
}

export function AutoDetectDialog({
  open,
  onOpenChange,
  folder,
  groups,
  onAddCommands,
}: Props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [commands, setCommands] = useState<DetectedCommand[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [targetGroupId, setTargetGroupId] = useState<string>("");

  useEffect(() => {
    if (!open || !folder) return;

    let isMounted = true;
    setLoading(true);
    setCommands([]);
    setSelectedIndices(new Set());

    // Default target group: first group if available, otherwise new group
    setTargetGroupId(groups.length > 0 ? groups[0].id : "__new__");

    detectFolderCommands(folder.path)
      .then((detected) => {
        if (!isMounted) return;
        setCommands(detected);
        const defaults = new Set<number>();
        detected.forEach((cmd, idx) => {
          if (cmd.default_selected) {
            defaults.add(idx);
          }
        });
        setSelectedIndices(defaults);
      })
      .catch(() => {
        if (!isMounted) return;
        setCommands([]);
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [open, folder, groups]);

  const toggleSelect = (index: number) => {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIndices(new Set(commands.map((_, i) => i)));
  };

  const deselectAll = () => {
    setSelectedIndices(new Set());
  };

  const handleConfirm = () => {
    const selected = commands.filter((_, i) => selectedIndices.has(i));
    if (selected.length === 0) return;
    onAddCommands(selected, targetGroupId, folder?.name);
    onOpenChange(false);
  };

  const selectedCount = selectedIndices.size;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            {t("editor.detectDialog.title")}
          </DialogTitle>
          <DialogDescription>
            {t("editor.detectDialog.description", {
              folder: folder?.name ?? "",
            })}
          </DialogDescription>
          {folder && (
            <p className="truncate font-mono text-xs text-muted-foreground">
              {folder.path}
            </p>
          )}
        </DialogHeader>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="size-6 animate-spin" />
            <p className="mt-2 text-sm">{t("editor.detectDialog.scanning")}</p>
          </div>
        ) : commands.length === 0 ? (
          <div className="py-6 text-center text-muted-foreground">
            <p className="text-sm font-medium">
              {t("editor.detectDialog.noCommandsFound")}
            </p>
            <p className="mt-1 text-xs">{t("editor.detectDialog.noCommandsHint")}</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs">
              <div className="flex gap-2">
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-xs"
                  onClick={selectAll}
                >
                  {t("editor.detectDialog.selectAll")}
                </Button>
                <span className="text-muted-foreground">|</span>
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-xs"
                  onClick={deselectAll}
                >
                  {t("editor.detectDialog.deselectAll")}
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground whitespace-nowrap">
                  {t("editor.detectDialog.targetGroup")}:
                </Label>
                <Select
                  value={targetGroupId}
                  onValueChange={setTargetGroupId}
                >
                  <SelectTrigger className="h-7 text-xs w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {groups.map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.name}
                      </SelectItem>
                    ))}
                    <SelectItem value="__new__">
                      {t("editor.detectDialog.newGroup", {
                        name: folder?.name ?? "group",
                      })}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="max-h-60 overflow-y-auto divide-y divide-border rounded-lg border border-border">
              {commands.map((cmd, idx) => {
                const isSelected = selectedIndices.has(idx);
                return (
                  <div
                    key={`${cmd.source}-${cmd.label}-${idx}`}
                    className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-muted/40 cursor-pointer"
                    onClick={() => toggleSelect(idx)}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleSelect(idx)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{cmd.label}</span>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                          {cmd.source}
                        </Badge>
                      </div>
                      <p className="truncate font-mono text-xs text-muted-foreground">
                        {cmd.command}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={loading || selectedCount === 0}
          >
            <Sparkles className="size-3.5" />
            {t("editor.detectDialog.addCount", { count: selectedCount })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
