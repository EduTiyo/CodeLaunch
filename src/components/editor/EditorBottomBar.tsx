import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

interface EditorBottomBarProps {
  onSave: (andOpen: boolean) => void;
}

export function EditorBottomBar({ onSave }: EditorBottomBarProps) {
  const { t } = useTranslation();

  return (
    <div className="fixed inset-x-0 bottom-0 border-t border-border bg-background/95 backdrop-blur z-20">
      <div className="mx-auto flex max-w-3xl items-center justify-end gap-2 px-6 py-3">
        <Button variant="outline" onClick={() => onSave(false)}>
          {t("common.save")}
          <span className="ml-1 text-xs text-muted-foreground opacity-80">(⌘S)</span>
        </Button>
        <Button onClick={() => onSave(true)}>
          {t("editor.saveAndOpen")}
        </Button>
      </div>
    </div>
  );
}
