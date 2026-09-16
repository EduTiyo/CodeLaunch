# CodeLaunch

Abra os workspaces certos, nas janelas certas, com os terminais certos já rodando — sem editar
`.code-workspace` à mão.

CodeLaunch é um app desktop (Tauri) que permite configurar visualmente, por projeto:

- quais pastas fazem parte do workspace;
- se terminais integrados devem abrir automaticamente;
- como esses terminais são agrupados em splits (ex: 3 terminais lado a lado, sendo 2 de backend e
  1 de frontend);
- qual comando cada terminal roda ao subir (ex: `docker compose up -d; npm run dev`).

Hoje ele gera e abre workspaces do **VS Code**, mas foi desenhado para crescer para outras IDEs
(veja [Arquitetura](#arquitetura) e [CONTRIBUTING.md](./CONTRIBUTING.md)).

## Por quê

É comum acumular vários repositórios (ex: `back` + `front` de cada produto) e, todo dia, repetir a
mesma sequência manual: abrir cada janela do VS Code, abrir o terminal integrado, dividir em
splits, entrar em cada pasta, rodar `docker compose up`, rodar `npm run dev`... O VS Code já sabe
fazer boa parte disso sozinho via `tasks.json` (`presentation.group` para splits,
`runOptions.runOn: "folderOpen"` para autostart) — só que escrever esse JSON à mão é chato e
propenso a erro. O CodeLaunch é uma interface visual para gerar esse JSON corretamente.

## Instalação / desenvolvimento

Pré-requisitos: [Node.js](https://nodejs.org/) 18+, [Rust](https://rustup.rs/) (via `rustup`), e
as [dependências do sistema do Tauri](https://tauri.app/start/prerequisites/) para o seu SO (no
macOS, as Command Line Tools do Xcode bastam).

```bash
npm install
npm run tauri dev
```

Isso abre o app em modo desenvolvimento com hot-reload do frontend e recompilação automática do
backend Rust quando os arquivos mudam.

Para gerar um binário instalável:

```bash
npm run tauri build
```

## Como usar

1. **Importe um workspace existente** — se você já tem um `.code-workspace` do VS Code configurado
   à mão, clique em "Importar .code-workspace..." na lista de projetos. O CodeLaunch lê as pastas,
   os grupos de terminal e os comandos já configurados e recria o projeto.
2. **Ou crie um novo** — "Novo projeto", dê um nome, adicione as pastas (o seletor de arquivos
   aceita selecionar várias pastas de uma vez).
3. **Configure os terminais** (opcional) — ligue "Terminais integrados", adicione um ou mais
   grupos, e dentro de cada grupo adicione os terminais que devem abrir lado a lado. Cada terminal
   tem: a pasta em que abre, um comando opcional, e se deve "manter vivo após o comando" (útil para
   comandos que ficam rodando em primeiro plano, tipo `npm run dev` — se você der `Ctrl+C`, o
   terminal continua aberto num shell interativo em vez de fechar).
4. **Salve e abra** — "Salvar e abrir" gera o `.code-workspace` (numa pasta própria do CodeLaunch,
   não junto dos seus repositórios) e chama `code --new-window` nele.
5. **Abra vários projetos de uma vez** — na lista de projetos, marque as caixinhas dos projetos
   desejados e clique em "Abrir selecionados".

## Arquitetura

```
crates/codelaunch-core/     # lógica de negócio pura, sem depender do runtime do Tauri
├── model/                  # Project, Folder, TerminalGroup, Terminal, validação
├── storage/                # persistência em JSON (um arquivo por projeto)
├── ide/                    # trait IdeAdapter + implementação para VS Code
│   └── vscode/              # gera e importa .code-workspace (folders, settings, tasks)
└── launcher.rs             # resolve o adapter certo e dispara o processo da IDE

src-tauri/                  # binário Tauri fino — só expõe commands, sem lógica própria
└── src/commands.rs

src/                        # frontend React + TypeScript + shadcn/ui
├── routes/                 # tela de lista e tela de edição de projeto
├── components/             # TerminalGrid/TerminalGroupPanel/TerminalPane (visual dos splits)
└── lib/                    # tipos + wrappers tipados de invoke()
```

O ponto central da extensibilidade é a trait `IdeAdapter`
(`crates/codelaunch-core/src/ide/mod.rs`): qualquer IDE nova (Cursor, JetBrains, ...) só precisa
implementar `render` (gera a config) e `launch_command` (monta o comando pra abrir a IDE) — o resto
do app (armazenamento, UI, comandos Tauri) já funciona sem mudanças. Veja
[CONTRIBUTING.md](./CONTRIBUTING.md) para o passo a passo de adicionar uma IDE nova.

## Testes

```bash
cargo test --workspace       # testes do backend, incluindo golden-file/round-trip
cargo clippy --workspace --all-targets
npx tsc --noEmit              # type-check do frontend
```

Os testes de `ide/vscode` incluem fixtures reais (`crates/codelaunch-core/tests/fixtures/`) que
comprovam que o gerador reproduz fielmente arquivos `.code-workspace` escritos à mão.

## Licença

[MIT](./LICENSE).
