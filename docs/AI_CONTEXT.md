# HiveCLI Agent Context

This file is a handoff note for other AI agents working in this workspace.

## Project Summary

HiveCLI is a local-first desktop app for running multiple CLI-backed agents in parallel inside one workspace.

Current stack:

- Desktop shell: Tauri 2
- Frontend: React, TypeScript, Vite, Tailwind
- Backend/orchestrator: Node.js, TypeScript, Express, WebSockets
- Terminal runtime: node-pty
- Persistence: SQLite
- Shared contracts: `packages/shared`

## Current Status

The repo is in a working MVP state with a redesigned 4-panel Codex CLI workspace.

Implemented:

- workspace CRUD
- agent CRUD
- session history and replay
- broadcast tasks
- council mode with judge agent
- **implementer agent step** (3-step pipeline: Workers → Judge → Implementer)
- WebSocket event streaming
- PTY-backed CLI agent runs
- local startup launcher
- **4-panel terminal workspace UI** (Judge, Implementer, Worker A, Worker B)
- **auto-workspace creation** with 4 Codex CLI agents on first launch
- CORS support on orchestrator
- README with one current live screenshot
- folder-backed project workflow with visible `hivecli-runs/<task-id>` and `publish/<task-id>`

## Recent Changes (4-Panel Redesign)

The frontend was completely redesigned from a 3-column dashboard layout to a focused 4-panel terminal workspace.

### Layout change:

```
BEFORE:                               AFTER:
┌──────┬──────────┬────────┐          ┌──────────────┬──────────────┐
│Roster│Agent Grid│Events  │          │  Judge       │  Implementer │
│      │          │Council │          │  (terminal)  │  (terminal)  │
│Prompt│          │        │          ├──────────────┼──────────────┤
│      │          │        │          │  Worker A    │  Worker B    │
└──────┴──────────┴────────┘          │  (terminal)  │  (terminal)  │
                                      └──────────────┴──────────────┘
                                      │         Prompt Bar          │
                                      └─────────────────────────────┘
```

### Files modified:

- `apps/desktop/src/pages/swarm-page.tsx` — complete rewrite to 4-panel grid
- `apps/desktop/src/stores/app-store.ts` — added role-based agent mapping, `ensureCodexWorkspace()`, `runHiveTask()`, agent args migration
- `apps/desktop/src/components/app-layout.tsx` — sidebar removed, replaced with minimal top bar
- `apps/desktop/src/router.tsx` — swarm page is now the default `/` route
- `apps/desktop/src/index.css` — full-viewport layout with `.hive-grid`, `.hive-panel`, role accents
- `apps/desktop/src/components/terminal-pane.tsx` — now fills container dynamically
- `packages/shared/src/council.ts` — added `buildImplementerPrompt()`
- `apps/orchestrator/src/sessions/task-service.ts` — 3-step pipeline: Workers → Judge → Implementer
- `apps/orchestrator/src/sessions/run-workspace.ts` — run-folder prep, source seeding, judge diff artifacts, implementer publish
- `apps/orchestrator/src/adapters/cli-adapter.ts` — Windows fix: resolves commands explicitly and uses `cmd.exe /c` when needed for PATH resolution
- `apps/orchestrator/src/index.ts` — added `cors` middleware
- `apps/orchestrator/src/routes/api.ts` — added error logging to `/api/tasks/run`
- `apps/orchestrator/vitest.config.ts` — excludes generated `hivecli-runs/` and `publish/` trees from test discovery
- `packages/shared/src/constants.ts` — codex template args updated to `["exec", "--full-auto", "-m", "gpt-5.1-codex-mini", "-c", "model_reasoning_effort=medium", "{{prompt}}"]`

### Files created:

- `apps/desktop/src/components/worker-terminal.tsx` — worker panel with green accent
- `apps/desktop/src/components/judge-panel.tsx` — judge panel with amber accent
- `apps/desktop/src/components/implementer-panel.tsx` — implementer panel with violet accent
- `apps/desktop/src/components/prompt-bar.tsx` — compact bottom prompt bar
- `apps/desktop/src/components/workspace-directory-control.tsx` — project directory rail with picker/manual entry
- `apps/desktop/src/lib/directory-picker.ts` — runtime-aware directory picker bridge
- `apps/orchestrator/src/utils/workspace-root.ts` — root-path validation

### Key architectural decisions:

- Codex CLI agents use `exec --full-auto -m gpt-5.1-codex-mini -c model_reasoning_effort=medium "{{prompt}}"` to run non-interactively
- Each task creates a visible run tree under `<workspace.rootPath>/hivecli-runs/<task-id>`
- Worker A and Worker B are seeded from `source/`, judge gets artifact files plus inline diff summary, implementer publishes to `<workspace.rootPath>/publish/<task-id>`
- On Windows, `cli-adapter.ts` resolves commands explicitly instead of relying on bare PATH lookup in `node-pty`
- Codex on Windows uses a temp prompt file with stdin redirection so multiline judge/implementer prompts survive the shell hop
- Codex final text is sanitized to remove trailing timestamped diagnostics after the answer
- The app-store auto-patches existing codex agents with empty args on workspace load
- The implementer agent is identified by name convention (`"implementer"` in agent name)
- Judge → Implementer handoff uses `buildImplementerPrompt()` from `@hive/shared`
- The orchestrator also normalizes stale Codex agent args on the server before a run starts

## Startup

Preferred startup commands:

```powershell
pnpm start
```

or:

```powershell
.\Start-HiveCLI.ps1
```

What this now does:

- starts the orchestrator if it is not already running
- reuses the orchestrator if it is already running on `127.0.0.1:45231`
- starts the frontend if it is not already running on `localhost:1420`
- exits cleanly if both are already running

Files involved:

- `scripts/start-hivecli.mjs`
- `Start-HiveCLI.ps1`
- root `package.json`

## Important Runtime Change

The orchestrator was moved off `better-sqlite3` for runtime use.

Reason:

- the previous setup was fragile on Node 25 because of native SQLite bindings

Current DB runtime:

- Node built-in `node:sqlite`

Relevant files:

- `apps/orchestrator/src/db/client.ts`
- `apps/orchestrator/src/db/bootstrap.ts`
- `apps/orchestrator/src/db/repository.ts`

`node-pty` is still used for terminal-backed agents.

## Node Version

The repo now allows Node `22` through `25`.

Root engine range:

- `>=22 <26`

## Orchestrator Notes

The orchestrator config now resolves the repo root by walking up until it finds `pnpm-workspace.yaml`.

This fixed a prior bug where the database was being created under:

- `apps/orchestrator/apps/orchestrator/data`

Relevant file:

- `apps/orchestrator/src/config.ts`

Ignored paths now include:

- `.hivecli`
- `apps/orchestrator/apps`
- `.playwright-cli`
- `output`

CORS is enabled via the `cors` npm package in `apps/orchestrator/src/index.ts`.

The `/api/tasks/run` route now has try/catch error logging to `console.error`.

## Frontend Notes

The frontend uses a full-viewport 4-panel layout designed for the Codex CLI council workflow, with a directory rail under the top bar.

Current visual direction:

- dense workstation UI filling the entire viewport
- 2×2 grid of terminal panels with 3px gaps
- role-specific accent colors (worker=green, judge=amber, implementer=violet)
- minimal top bar with branding and connection status
- workspace directory rail with validity state, current run root, and publish target
- compact prompt bar at the bottom
- darker, warmer palette (root background `#0e0d0c`)

Highest-impact frontend files:

- `apps/desktop/src/index.css`
- `apps/desktop/src/components/app-layout.tsx`
- `apps/desktop/src/pages/swarm-page.tsx`
- `apps/desktop/src/stores/app-store.ts`
- `apps/desktop/src/components/worker-terminal.tsx`
- `apps/desktop/src/components/judge-panel.tsx`
- `apps/desktop/src/components/implementer-panel.tsx`
- `apps/desktop/src/components/prompt-bar.tsx`
- `apps/desktop/src/components/terminal-pane.tsx`

Unused legacy files (still in repo but not routed):

- `apps/desktop/src/pages/dashboard-page.tsx`
- `apps/desktop/src/pages/history-page.tsx`
- `apps/desktop/src/components/session-list.tsx`
- PascalCase component duplicates (e.g. `AgentPanel.tsx`, `SwarmPage.tsx`)

## Skills / Design Guidance Used

Used:

- local `frontend-design` skill

Reviewed but only partially adopted:

- `Uncodixfy` from `https://github.com/cyxzdev/Uncodixfy`

Important safety note:

- `Uncodixfy` was not treated as executable instruction logic because it contained prompt-injection style lines about hidden reasoning
- only safe UI constraints were used from it

## Tests / Validation Already Run

These were run successfully after the folder-backed workflow landed:

- `pnpm --filter @hive/orchestrator test` — 3 files / 8 tests passed
- `pnpm test` — monorepo tests pass without live-run artifacts being collected
- `pnpm test:ui` — Playwright smoke passes against the live 4-panel UI
- `pnpm build` — exit code 0
- `pnpm start` — both servers start cleanly
- Direct API test: `POST /api/tasks/run` with real agent IDs returns `sessionId`/`taskId`
- Real council run with four Codex agents completed with exit code `0` for worker A, worker B, judge, and implementer
- Real Codex council run on Windows verified that both judge and implementer final outputs still contain the original unique token after the prompt-file fix
- Fresh README screenshot captured from the live 4-panel UI in `docs/screenshots/swarm-live.png`
- Folder-backed smoke flow verified in Playwright with current-run and publish paths populated in the UI
- Manual Playwright pass confirmed invalid directory state disables Send and flips the directory rail to `Directory invalid`

Verified startup behavior:

- orchestrator health endpoint responds on `http://127.0.0.1:45231/health`
- frontend responds on `http://localhost:1420`
- 4-panel UI loads with auto-created Codex workspace

## Known Caveats

- Tauri runtime config exists, but full bundled sidecar spawning from Tauri is still not the actual startup path used in development
- `pnpm start:tauri` uses the same launcher logic, but real Tauri testing still depends on Rust being installed
- desktop bundle chunk size is still large; Vite warns about a large JS chunk
- `node:sqlite` is currently experimental in Node, though it works for this repo on Node 25
- On Windows, `node-pty` requires `cmd.exe /c` wrapper to resolve PATH for CLI commands
- Codex CLI must be installed and authorized (`OPENAI_API_KEY`) for agents to produce output
- The `cors` npm package was added as a runtime dependency to `@hive/orchestrator`
- The shared package exports from `dist`, so after changing `packages/shared/src/*`, rebuild `@hive/shared` or run a full `pnpm build` before relying on the desktop dev server
- The default auto-created workspace still starts at `.`; if that points at a large project, snapshot creation can be expensive until the user picks a tighter project folder

## Files Most Likely To Matter Next

If continuing product work, likely touch these:

- `apps/desktop/src/pages/*`
- `apps/desktop/src/components/*`
- `apps/desktop/src/stores/app-store.ts`
- `apps/orchestrator/src/sessions/task-service.ts`
- `apps/orchestrator/src/adapters/cli-adapter.ts`
- `apps/orchestrator/src/routes/api.ts`
- `packages/shared/src/*`

If continuing startup/runtime work, likely touch these:

- `scripts/start-hivecli.mjs`
- `Start-HiveCLI.ps1`
- `apps/orchestrator/src/config.ts`

## Git / Branch

Working branch convention in this repo session:

- `CO/...`

Current remote work was being pushed incrementally to:

- `origin/CO/hivecli-mvp`

## Practical Guidance For The Next Agent

- Build after making changes. The user explicitly asked for that.
- Prefer preserving the 4-panel terminal workspace layout.
- Do not reintroduce `better-sqlite3` unless there is a strong reason.
- If touching startup, keep `pnpm start` idempotent.
- If touching tests around PTY on Windows, prefer `process.execPath` over hardcoded `node`.
- On Windows, always spawn CLI agents through `cmd.exe /c` in `node-pty` for PATH resolution.
- Codex CLI agents must use `exec --full-auto -m gpt-5.1-codex-mini -c model_reasoning_effort=medium "{{prompt}}"` args to run non-interactively.
- The app-store and orchestrator both patch codex agents with stale or empty args.
- Use `pnpm test:ui` for browser automation. It runs a Playwright smoke test against the live 4-panel workflow and writes `.hivecli/playwright-smoke.png`.
- Generated `hivecli-runs/` and `publish/` trees are intentionally excluded from Vitest discovery so old live runs do not poison the test suite.
- For lower-cost manual/live testing on the current ChatGPT-backed Codex account, use `-c model_reasoning_effort=low`. Attempts to switch to `gpt-5-mini`, `gpt-5.4-mini`, `gpt-4.1`, and `gpt-4.1-mini` returned 400 model-not-supported errors in this environment.
