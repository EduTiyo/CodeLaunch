import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Edit2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  oldName: string;
  onRename: (oldName: string, newName: string) => void;
}

export function RenameGroupDialog({
  open,
  onOpenChange,
  oldName,
  onRename,
}: Props) {
  const { t } = useTranslation();
  const [newName, setNewName] = useState("");

  useEffect(() => {
    if (open) {
      setNewName(oldName);
    }
  }, [open, oldName]);

  function handleSave() {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === oldName) return;
    onRename(oldName, trimmed);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit2 className="size-4 text-primary" />
            {t("projects.renameGroupDialog.title")}
          </DialogTitle>
          <DialogDescription>
            {t("projects.renameGroupDialog.description", { name: oldName })}
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
            <Label htmlFor="rename-group-input">
              {t("projects.renameGroupDialog.nameLabel")}
            </Label>
            <Input
              id="rename-group-input"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={oldName}
              autoFocus
            />
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button
              type="submit"
              disabled={!newName.trim() || newName.trim() === oldName}
            >
              {t("common.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
