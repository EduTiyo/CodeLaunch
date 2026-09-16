# Contribuindo com o CodeLaunch

## Setup

```bash
npm install
npm run tauri dev
```

Antes de abrir um PR:

```bash
cargo test --workspace
cargo clippy --workspace --all-targets
npx tsc --noEmit
npm run build
```

## Estrutura do projeto

- `crates/codelaunch-core` — toda a lógica de negócio (model, storage, adapters de IDE), sem
  depender do runtime do Tauri. Testável com `cargo test` puro, sem precisar abrir o app.
- `src-tauri` — o binário Tauri. `src-tauri/src/commands.rs` só deve conter wrappers finos que
  chamam `codelaunch-core`; lógica de negócio nova entra no core, não aqui.
- `src` — frontend React + TypeScript + shadcn/ui.

## Como adicionar uma nova IDE

O ponto de extensão é a trait `IdeAdapter` (`crates/codelaunch-core/src/ide/mod.rs`):

```rust
pub trait IdeAdapter: Send + Sync {
    fn kind(&self) -> IdeKind;
    fn render(&self, project: &Project, output_dir: &Path) -> Result<RenderedWorkspace>;
    fn launch_command(&self, workspace: &RenderedWorkspace) -> std::process::Command;
}
```

- `render` recebe um `Project` e escreve o(s) arquivo(s) de configuração da IDE em `output_dir`,
  retornando o caminho do arquivo principal. É I/O puro — sem side effect no sistema (não abre
  processo nenhum), o que o torna fácil de testar com um teste golden-file.
- `launch_command` só monta um `std::process::Command` (não o executa) — quem chama decide quando
  dar `.spawn()`.

Passo a passo:

1. Adicione a variante na enum `IdeKind` (`crates/codelaunch-core/src/model/project.rs`).
2. Crie `crates/codelaunch-core/src/ide/<sua_ide>/mod.rs` implementando `IdeAdapter`. Se a IDE for
   um fork do VS Code (ex: Cursor), o caminho mais rápido é reaproveitar
   `crate::ide::vscode::build_workspace_document` e só trocar o binário do CLI em
   `launch_command` — veja `VsCodeAdapter` como referência.
3. Registre o adapter em `IdeRegistry::new()` (`crates/codelaunch-core/src/ide/mod.rs`).
4. Adicione testes: pelo menos um golden-file comparando a saída de `render` contra um arquivo de
   config esperado (veja `crates/codelaunch-core/tests/vscode_adapter_tests.rs` como modelo).
5. No frontend, libere a nova opção em `IdeSelect`/`ProjectEditorPage.tsx` (hoje só "VS Code" é
   selecionável, o restante aparece desabilitado como "em breve").

Nenhum outro arquivo deveria precisar mudar — `commands.rs`, `launcher.rs` e a UI de
lista/salvar/abrir já funcionam via a trait, sem conhecer detalhes de IDE nenhuma.

## Convenções de commit

Mensagens curtas, focadas no "porquê" da mudança, não no "o quê" (o diff já mostra o quê).
