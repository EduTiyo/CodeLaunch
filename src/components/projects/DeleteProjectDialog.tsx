import { useTranslation, Trans } from "react-i18next";
import type { ProjectSummary } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface DeleteProjectDialogProps {
  project: ProjectSummary | null;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteProjectDialog({
  project,
  busy,
  onClose,
  onConfirm,
}: DeleteProjectDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog
      open={!!project}
      onOpenChange={(open) => {
        if (!open && !busy) {
          onClose();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("projects.deleteDialog.title")}</DialogTitle>
          <DialogDescription>
            <Trans
              i18nKey="projects.deleteDialog.description"
              values={{ name: project?.name }}
              components={{
                strong: <span className="font-semibold text-foreground" />,
              }}
            />
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={busy}
          >
            {t("projects.deleteDialog.cancel")}
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={busy}
          >
            {busy
              ? t("projects.deleteDialog.deleting")
              : t("projects.deleteDialog.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
