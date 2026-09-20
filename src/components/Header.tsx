import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { LanguageSelect } from "./LanguageSelect";
import { ThemeToggle } from "./ThemeToggle";
import { Button } from "./ui/button";

interface HeaderProps {
  isEditing: boolean;
  onBack?: () => void;
}

export function Header({ isEditing, onBack }: HeaderProps) {
  const { t } = useTranslation();

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-12 max-w-3xl items-center justify-between px-6">
        {isEditing ? (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2"
            onClick={onBack}
          >
            <ArrowLeft className="size-3.5" />
            {t("common.back")}
          </Button>
        ) : (
          <div className="flex items-center gap-2">
            <img src="/icon.svg" alt="CodeLaunch" className="size-5" />
            <span className="text-sm font-semibold">CodeLaunch</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <LanguageSelect />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
