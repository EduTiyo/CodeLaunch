import { useState } from "react";
import { ProjectListPage } from "./routes/ProjectListPage";
import { ProjectEditorPage } from "./routes/ProjectEditorPage";

type View = { mode: "list" } | { mode: "edit"; projectId: string | null };

export default function App() {
  const [view, setView] = useState<View>({ mode: "list" });

  if (view.mode === "edit") {
    return (
      <ProjectEditorPage
        projectId={view.projectId}
        onBack={() => setView({ mode: "list" })}
      />
    );
  }

  return (
    <ProjectListPage onEdit={(id) => setView({ mode: "edit", projectId: id })} />
  );
}
