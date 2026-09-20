import { ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { IdeKind } from "@/lib/types";
import { Button } from "@/components/ui/button";

interface WorkspacePreviewSectionProps {
  ide: IdeKind;
  preview: string | null;
  onPreview: () => void;
}

export function WorkspacePreviewSection({
  ide,
  preview,
  onPreview,
}: WorkspacePreviewSectionProps) {
  const { t } = useTranslation();

  return (
    <section>
      <Button variant="ghost" size="sm" onClick={onPreview}>
        <ChevronDown className="size-3.5" />
        {ide === "terminal" ? t("editor.viewScript") : t("editor.viewJson")}
      </Button>
      {preview && (
        <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-muted p-3 font-mono text-xs">
          {preview}
        </pre>
      )}
    </section>
  );
}
