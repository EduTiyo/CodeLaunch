import { useState } from "react";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { ProjectListPage } from "@/routes/ProjectListPage";
import { ProjectEditorPage } from "@/routes/ProjectEditorPage";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Header } from "@/components/Header";
import { UnsavedChangesDialog } from "@/components/UnsavedChangesDialog";
import { SwipeBackIndicator } from "@/components/SwipeBackIndicator";
import { useTrackpadBack } from "@/hooks/useTrackpadBack";

export type View =
  | { mode: "list" }
  | { mode: "edit"; projectId: string | null };

function AppShell() {
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

  const { progress, isTriggered, isSwiping } = useTrackpadBack({
    onBack: handleBackClick,
    enabled: isEditing && !showUnsavedDialog,
  });

  function handleConfirmDiscard() {
    setShowUnsavedDialog(false);
    setIsDirty(false);
    setView({ mode: "list" });
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header isEditing={isEditing} onBack={handleBackClick} />

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

      <UnsavedChangesDialog
        open={showUnsavedDialog}
        onClose={() => setShowUnsavedDialog(false)}
        onConfirm={handleConfirmDiscard}
      />

      <SwipeBackIndicator
        progress={progress}
        isTriggered={isTriggered}
        isSwiping={isSwiping}
      />

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
