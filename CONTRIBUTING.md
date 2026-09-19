# Contributing to CodeLaunch

## Setup

```bash
npm install
npm run tauri dev
```

Before opening a pull request, ensure all checks pass:

```bash
cargo test --workspace
cargo clippy --workspace --all-targets
npx tsc --noEmit
npm run build
```

## Project Structure

- `crates/codelaunch-core` — all core business logic (models, storage, IDE adapters), completely decoupled from the Tauri runtime. Fully testable using pure `cargo test` without running the GUI.
- `src-tauri` — the Tauri application wrapper. `src-tauri/src/commands.rs` should only contain thin wrappers calling `codelaunch-core`; new business logic belongs in the core crate.
- `src` — frontend built with React, TypeScript, and shadcn/ui.

## How to Add a New IDE

The extension point is the `IdeAdapter` trait (`crates/codelaunch-core/src/ide/mod.rs`):

```rust
pub trait IdeAdapter: Send + Sync {
    fn kind(&self) -> IdeKind;
    fn render(&self, project: &Project, output_dir: &Path) -> Result<RenderedWorkspace>;
    fn launch_command(&self, workspace: &RenderedWorkspace) -> std::process::Command;
}
```

- `render` takes a `Project` and writes the IDE's configuration file(s) into `output_dir`, returning the path to the primary entry file. It is pure I/O — with no system side effects (spawns no processes), making it straightforward to test with golden-file fixtures.
- `launch_command` only constructs a `std::process::Command` (without executing it) — the caller decides when to call `.spawn()`.

Step-by-step:

1. Add the new variant to the `IdeKind` enum (`crates/codelaunch-core/src/model/project.rs`).
2. Create `crates/codelaunch-core/src/ide/<your_ide>/mod.rs` implementing `IdeAdapter`. If the IDE is a VS Code fork (e.g. Cursor), the quickest path is to reuse `crate::ide::vscode::build_workspace_document` and only change the CLI binary in `launch_command` — see `VsCodeAdapter` as a reference.
3. Register the adapter in `IdeRegistry::new()` (`crates/codelaunch-core/src/ide/mod.rs`).
4. Add tests: at least one golden-file comparing `render` output against an expected config file (see `crates/codelaunch-core/tests/vscode_adapter_tests.rs` as a model).
5. In the frontend, enable the new option in `IdeSelect`/`ProjectEditorPage.tsx` (currently only "VS Code" is selectable; other options are shown disabled as "coming soon").

No other files should need modifications — `commands.rs`, `launcher.rs`, and the UI (list, save, launch) work uniformly through the trait without needing IDE-specific knowledge.

## Commit Conventions

Keep commit messages concise and focused on the "why" behind the change, rather than the "what" (the git diff already shows the what).
