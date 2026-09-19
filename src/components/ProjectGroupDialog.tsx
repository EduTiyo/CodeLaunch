import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Folder, FolderX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  existingGroups: string[];
  initialGroupName?: string;
  hasGroupedProjects?: boolean;
  onSaveGroup: (groupName: string | null) => void;
}

export function ProjectGroupDialog({
  open,
  onOpenChange,
  selectedCount,
  existingGroups,
  initialGroupName,
  hasGroupedProjects = false,
  onSaveGroup,
}: Props) {
  const { t } = useTranslation();
  const [groupName, setGroupName] = useState("");

  useEffect(() => {
    if (open) {
      setGroupName(initialGroupName ?? "");
    }
  }, [open, initialGroupName]);

  function handleSave() {
    const trimmed = groupName.trim();
    if (!trimmed) return;
    onSaveGroup(trimmed);
    onOpenChange(false);
  }

  function handleRemove() {
    onSaveGroup(null);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Folder className="size-4 text-primary" />
            {t("projects.groupDialog.title")}
          </DialogTitle>
          <DialogDescription>
            {t("projects.groupDialog.description", { count: selectedCount })}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSave();
          }}
          className="space-y-4 py-2"
        >
          <div className="space-y-2">
            <Label htmlFor="group-name-input">{t("projects.groupDialog.nameLabel")}</Label>
            <Input
              id="group-name-input"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder={t("projects.groupDialog.placeholder")}
              autoFocus
            />
          </div>

          {existingGroups.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-xs text-muted-foreground">
                {t("projects.groupDialog.existingGroups")}:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {existingGroups.map((g) => (
                  <Badge
                    key={g}
                    variant={groupName === g ? "default" : "secondary"}
                    className="cursor-pointer transition-colors hover:opacity-80 text-xs"
                    onClick={() => setGroupName(g)}
                  >
                    {g}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 pt-2 sm:justify-between">
            <div>
              {hasGroupedProjects && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs text-destructive hover:text-destructive"
                  onClick={handleRemove}
                >
                  <FolderX className="size-3.5" />
                  {t("projects.groupDialog.ungroup")}
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                {t("common.cancel")}
              </Button>
              <Button
                type="submit"
                disabled={!groupName.trim()}
              >
                {t("projects.groupDialog.apply")}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
