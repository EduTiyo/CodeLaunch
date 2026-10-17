import { ChevronDown, ChevronUp } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { IdeKind } from "@/lib/types";
import { Button } from "@/components/ui/button";

interface WorkspacePreviewSectionProps {
  ide: IdeKind;
  preview: string | null;
  isOpen: boolean;
  onPreview: () => void;
}

export function WorkspacePreviewSection({
  ide,
  preview,
  isOpen,
  onPreview,
}: WorkspacePreviewSectionProps) {
  const { t } = useTranslation();

  const isTerminal = ide === "terminal";
  const label = isOpen
    ? isTerminal
      ? t("editor.hideScript")
      : t("editor.hideJson")
    : isTerminal
      ? t("editor.viewScript")
      : t("editor.viewJson");

  return (
    <section>
      <Button variant="ghost" size="sm" onClick={onPreview}>
        {isOpen ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
        {label}
      </Button>
      {isOpen && preview && (
        <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-muted p-3 font-mono text-xs">
          {preview}
        </pre>
      )}
    </section>
  );
}
