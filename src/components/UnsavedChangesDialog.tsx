import { useTranslation } from "react-i18next";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

interface UnsavedChangesDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function UnsavedChangesDialog({
  open,
  onClose,
  onConfirm,
}: UnsavedChangesDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("editor.unsavedChangesDialog.title")}</DialogTitle>
          <DialogDescription>
            {t("editor.unsavedChangesDialog.description")}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("editor.unsavedChangesDialog.keepEditing")}
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            {t("editor.unsavedChangesDialog.discard")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
