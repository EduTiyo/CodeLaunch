import { Rocket, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

interface EmptyProjectsStateProps {
  search?: string;
  onClearSearch?: () => void;
}

export function EmptyProjectsState({
  search,
  onClearSearch,
}: EmptyProjectsStateProps) {
  const { t } = useTranslation();

  if (search) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border py-12 text-center">
        <Search className="size-6 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          {t("projects.noSearchResults", { query: search })}
        </p>
        {onClearSearch && (
          <Button variant="ghost" size="sm" onClick={onClearSearch}>
            {t("projects.clearSearch")}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border py-16 text-center">
      <Rocket className="size-6 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">
        {t("projects.emptyDescription")}
      </p>
    </div>
  );
}
