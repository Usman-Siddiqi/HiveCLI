# HiveCLI — Local Multi-Agent AI Orchestrator for CLI Workflows

> Run multiple AI coding agents in parallel, compare their outputs side-by-side, and automatically merge the best result — all from a local-first desktop app powered by Tauri and Node.js.

[![Node.js](https://img.shields.io/badge/Node.js-22--25-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tauri](https://img.shields.io/badge/Tauri-2-FFC131?logo=tauri&logoColor=white)](https://tauri.app/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![pnpm](https://img.shields.io/badge/pnpm-10-F69220?logo=pnpm&logoColor=white)](https://pnpm.io/)

---

## Table of Contents

- [What Is HiveCLI?](#what-is-hivecli)
- [Screenshot](#screenshot)
- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [Monorepo Layout](#monorepo-layout)
- [Getting Started](#getting-started)
- [Testing](#testing)
- [Folder-Based Agent Workflow](#folder-based-agent-workflow)
- [Built-In Agent Templates](#built-in-agent-templates)
- [Local Persistence](#local-persistence)
- [Current Caveats](#current-caveats)
- [Roadmap](#roadmap)
- [License](#license)

---

## What Is HiveCLI?

HiveCLI is a **local-first desktop workspace** for running multiple **CLI-backed AI agents** in parallel, watching their output live, and chaining them through a **folder-backed council flow**. It is designed for developers who want to orchestrate AI coding assistants like OpenAI Codex CLI, Gemini CLI, or any custom command-line tool — without sending data to external servers.

The current MVP is optimized for a **4-panel Codex CLI council workflow**:

| Panel | Role |
|-------|------|
| **Worker A** | Generates a candidate solution from an isolated project snapshot |
| **Worker B** | Generates an independent alternative solution in parallel |
| **Judge** | Compares both outputs and selects the best approach |
| **Implementer** | Applies the judge's verdict and publishes the final result |

The app fans one prompt out to the workers, seeds each worker from an isolated project snapshot, asks the judge to compare both responses and both folders, then passes that verdict into the implementer for the final published result.

## Screenshot

![HiveCLI multi-agent AI orchestrator showing live 4-panel terminal workspace with Worker A, Worker B, Judge, and Implementer panels running Codex CLI agents in parallel](docs/screenshots/swarm-live.png)

## Key Features

- **One-command startup** — `pnpm start` launches the full stack locally
- **Parallel multi-agent execution** — run two or more AI CLI agents side-by-side with live streaming
- **Real-time terminal output** — WebSocket-powered live streaming via xterm.js
- **Council pipeline** — automated Workers → Judge → Implementer flow for AI-assisted code generation
- **Folder-backed isolation** — each agent works in its own snapshot directory, keeping your source safe
- **PTY-backed CLI agents** — full terminal emulation via `node-pty` for any command-line tool
- **Session history and replay** — saved sessions in local SQLite for reviewing past runs
- **Built-in agent templates** — preconfigured support for Codex CLI, Gemini CLI, and custom commands
- **Local-first and private** — no cloud dependency; all data stays on your machine
- **Workspace-level project directory selection** — point HiveCLI at any local project folder

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop shell | [Tauri 2](https://tauri.app/) |
| Frontend | [React](https://react.dev/), [TypeScript](https://www.typescriptlang.org/), [Vite](https://vite.dev/), [Tailwind CSS](https://tailwindcss.com/) |
| Runtime state | [Zustand](https://github.com/pmndrs/zustand) + [React Query](https://tanstack.com/query) |
| Terminal rendering | [xterm.js](https://xtermjs.org/) |
| Orchestrator | [Node.js](https://nodejs.org/), TypeScript, [Express](https://expressjs.com/), WebSockets |
| Process runtime | [node-pty](https://github.com/nicedoc/node-pty) |
| Persistence | SQLite via Node built-in `node:sqlite` |
| Shared contracts | [Zod](https://zod.dev/) + `packages/shared` |

## Monorepo Layout

```text
apps/
  desktop/       Tauri shell + React UI
  orchestrator/  local sidecar server, PTY runtime, persistence
packages/
  shared/        shared types, schemas, constants, council helpers
docs/
  screenshots/   README assets
```

## Getting Started

### Requirements

- **Node.js** 22 to 25
- **pnpm** 10+
- Windows-first environment for the current MVP
- Rust only if you want to run the Tauri shell directly
- Installed and authorized CLI backends such as [Codex CLI](https://github.com/openai/codex)

### Install

```powershell
pnpm install
```

If `node-pty` needs a local rebuild on your machine:

```powershell
pnpm rebuild node-pty
```

### Run

```powershell
pnpm start
```

That launcher:

- starts the orchestrator if it is not already running on `127.0.0.1:45231`
- reuses it if it is already up
- starts the frontend on `http://localhost:1420`
- exits cleanly if both services are already running

PowerShell launcher:

```powershell
.\Start-HiveCLI.ps1
```

If you have Rust/Tauri installed:

```powershell
pnpm run start:tauri
```

## Testing

From the repo root:

```powershell
pnpm typecheck
pnpm --filter @hive/orchestrator test
pnpm test:ui
pnpm build
```

`pnpm test:ui` runs the Playwright smoke flow against the live app.

## Folder-Based Agent Workflow

For each task run, HiveCLI creates an isolated directory tree:

```text
<project-dir>/hivecli-runs/<task-id>/
  source/
  worker-a/
  worker-b/
  judge/
  implementer/
```

The final accepted result is published to:

```text
<project-dir>/publish/<task-id>
```

The original selected project directory is treated as source material and is not overwritten automatically.

## Built-In Agent Templates

- **Codex CLI** — OpenAI's coding agent
- **Gemini CLI** — Google's AI assistant
- **Custom CLI** — any command-line tool you want to orchestrate

Current Codex default:

```text
codex exec --full-auto --skip-git-repo-check -m gpt-5.1-codex-mini -c model_reasoning_effort=medium "{{prompt}}"
```

## Local Persistence

Default local database path:

```text
apps/orchestrator/data/hivecli.db
```

All data is stored locally. Tracked repo files do not include the local database, runtime logs, or saved session artifacts.

## Current Caveats

- The development path is still sidecar-style: the orchestrator runs separately from the Tauri shell during local dev.
- This MVP is terminal-first. Direct OpenAI, Anthropic, and Gemini API adapters are not implemented yet.
- `node:sqlite` works here on Node 25, but it is still marked experimental upstream.
- `codex` behavior and supported model slugs depend on the local CLI version and auth mode.
- Large dependency/build folders are excluded from worker snapshots by default, but very large source trees will still make runs slower.

## Roadmap

- Direct API-backed LLM adapters (OpenAI, Anthropic, Google Gemini)
- Tauri-bundled orchestrator startup
- Layout persistence and drag/drop panel management
- Safer approval gates for risky CLI actions
- Git-aware workflows and richer task chaining
- Cross-platform support (macOS, Linux)

## License

No license file is included yet.
