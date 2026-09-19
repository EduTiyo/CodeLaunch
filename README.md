# CodeLaunch

Launch the right workspaces in the right windows with the right terminals already running — without hand-editing `.code-workspace` files.

CodeLaunch is a desktop app (built with Tauri) that allows you to visually configure, per project:

- which folders belong to the workspace;
- whether integrated terminals should launch automatically;
- how those terminals are grouped into splits (e.g., 3 side-by-side terminals: 2 backend, 1 frontend);
- what command each terminal runs on startup (e.g., `docker compose up -d; npm run dev`).

Currently, it generates and launches **VS Code** workspaces, but it was designed from the ground up to support other IDEs (see [Architecture](#architecture) and [CONTRIBUTING.md](./CONTRIBUTING.md)).

## Why

It is common to accumulate multiple repositories (e.g., `backend` + `frontend` for each product) and repeat the same manual routine every day: open each VS Code window, open the integrated terminal, split it into panes, navigate into each directory, run `docker compose up`, run `npm run dev`... VS Code can already handle much of this on its own via `tasks.json` (`presentation.group` for splits, `runOptions.runOn: "folderOpen"` for autostart) — but writing this JSON by hand is tedious and error-prone. CodeLaunch provides an intuitive visual interface to generate this configuration properly.

## Installation / Development

Prerequisites: [Node.js](https://nodejs.org/) 18+, [Rust](https://rustup.rs/) (via `rustup`), and [Tauri system prerequisites](https://tauri.app/start/prerequisites/) for your OS (on macOS, Xcode Command Line Tools are sufficient).

```bash
npm install
npm run tauri dev
```

This launches the app in development mode with frontend hot-reloading and automatic Rust recompilation when backend files change.

To build an installable binary:

```bash
npm run tauri build
```

## How to Use

1. **Import an existing workspace** — if you already have a hand-configured `.code-workspace` file from VS Code, click "Import .code-workspace..." on the project list. CodeLaunch reads the folders, terminal groups, and configured commands, recreating the project.
2. **Or create a new one** — click "New project", provide a name, and add folders (the file picker allows selecting multiple folders at once).
3. **Configure terminals** (optional) — toggle "Integrated terminals", add one or more groups, and add the terminals that should open side-by-side within each group. Each terminal has: the directory it opens in, an optional startup command, and whether to "keep alive after command" (useful for long-running foreground commands like `npm run dev` — if you hit `Ctrl+C`, the terminal stays open in an interactive shell instead of closing).
4. **Save and open** — "Save and open" generates the `.code-workspace` file (in CodeLaunch's dedicated config directory, not cluttering your repos) and executes `code --new-window` on it.
5. **Launch multiple projects at once** — in the project list, check the boxes for your desired projects and click "Launch selected".

## Architecture

```
crates/codelaunch-core/     # pure business logic, independent of the Tauri runtime
├── model/                  # Project, Folder, TerminalGroup, Terminal, validation
├── storage/                # JSON persistence (one file per project)
├── ide/                    # IdeAdapter trait + VS Code implementation
│   └── vscode/             # generates and imports .code-workspace (folders, settings, tasks)
└── launcher.rs             # resolves the target adapter and spawns the IDE process

src-tauri/                  # thin Tauri binary — exposes commands, no business logic
└── src/commands.rs

src/                        # React + TypeScript + shadcn/ui frontend
├── routes/                 # project list and edit screens
├── components/             # TerminalGrid/TerminalGroupPanel/TerminalPane (split view UI)
└── lib/                    # types + typed wrappers for invoke()
```

The core extensibility point is the `IdeAdapter` trait (`crates/codelaunch-core/src/ide/mod.rs`): adding support for any new IDE (Cursor, JetBrains, etc.) only requires implementing `render` (generates the configuration) and `launch_command` (constructs the command to open the IDE) — the rest of the application (storage, UI, Tauri commands) works out of the box. Check [CONTRIBUTING.md](./CONTRIBUTING.md) for a step-by-step guide on adding a new IDE.

## Testing

```bash
cargo test --workspace       # backend tests, including golden-file / round-trip suites
cargo clippy --workspace --all-targets
npx tsc --noEmit             # frontend type-checking
```

The `ide/vscode` tests include real-world fixtures (`crates/codelaunch-core/tests/fixtures/`) that verify the generator faithfully reproduces handwritten `.code-workspace` files.

## License

[MIT](./LICENSE).
