import { useState } from "react";
import { ThemeProvider, useTheme } from "next-themes";
import { ArrowLeft, Moon, Sun } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { ProjectListPage } from "@/routes/ProjectListPage";
import { ProjectEditorPage } from "@/routes/ProjectEditorPage";

type View = { mode: "list" } | { mode: "edit"; projectId: string | null };

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <Button
      variant="ghost"
      size="icon"
      className="relative size-8"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      aria-label="Alternar tema"
    >
      <Sun className="size-4 scale-100 transition-transform dark:scale-0" />
      <Moon className="absolute size-4 scale-0 transition-transform dark:scale-100" />
    </Button>
  );
}

function AppShell() {
  const [view, setView] = useState<View>({ mode: "list" });
  const isEditing = view.mode === "edit";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-12 max-w-3xl items-center justify-between px-6">
          {isEditing ? (
            <Button
              variant="ghost"
              size="sm"
              className="-ml-2"
              onClick={() => setView({ mode: "list" })}
            >
              <ArrowLeft className="size-3.5" />
              Voltar
            </Button>
          ) : (
            <span className="text-sm font-semibold">CodeLaunch</span>
          )}
          <ThemeToggle />
        </div>
      </header>

      {isEditing ? (
        <ProjectEditorPage projectId={view.projectId} />
      ) : (
        <ProjectListPage onEdit={(id) => setView({ mode: "edit", projectId: id })} />
      )}

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
