import { useState } from "react";
import { ThemeProvider, useTheme } from "next-themes";
import { ArrowLeft, Moon, Sun } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { ProjectListPage } from "@/routes/ProjectListPage";
import { ProjectEditorPage } from "@/routes/ProjectEditorPage";
import { LanguageSelect } from "@/components/LanguageSelect";
import { ErrorBoundary } from "@/components/ErrorBoundary";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type View = { mode: "list" } | { mode: "edit"; projectId: string | null };

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const { t } = useTranslation();
  return (
    <Button
      variant="ghost"
      size="icon"
      className="relative size-8"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      aria-label={t("common.toggleTheme")}
    >
      <Sun className="size-4 scale-100 transition-transform dark:scale-0" />
      <Moon className="absolute size-4 scale-0 transition-transform dark:scale-100" />
    </Button>
  );
}

function AppShell() {
  const { t } = useTranslation();
  const [view, setView] = useState<View>({ mode: "list" });
  const [isDirty, setIsDirty] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const isEditing = view.mode === "edit";

  function handleBackClick() {
    if (isDirty) {
      setShowUnsavedDialog(true);
    } else {
      setView({ mode: "list" });
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-12 max-w-3xl items-center justify-between px-6">
          {isEditing ? (
            <Button
              variant="ghost"
              size="sm"
              className="-ml-2"
              onClick={handleBackClick}
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

      <ErrorBoundary onReset={() => setView({ mode: "list" })}>
        {isEditing ? (
          <ProjectEditorPage
            projectId={view.projectId}
            onDirtyChange={setIsDirty}
          />
        ) : (
          <ProjectListPage
            onEdit={(id) => {
              setIsDirty(false);
              setView({ mode: "edit", projectId: id });
            }}
          />
        )}
      </ErrorBoundary>

      <Dialog open={showUnsavedDialog} onOpenChange={setShowUnsavedDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("editor.unsavedChangesDialog.title")}</DialogTitle>
            <DialogDescription>{t("editor.unsavedChangesDialog.description")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUnsavedDialog(false)}>
              {t("editor.unsavedChangesDialog.keepEditing")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setShowUnsavedDialog(false);
                setIsDirty(false);
                setView({ mode: "list" });
              }}
            >
              {t("editor.unsavedChangesDialog.discard")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Toaster />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <AppShell />
    </ThemeProvider>
  );
}
