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

The repo is in a working MVP state.

Implemented:

- workspace CRUD
- agent CRUD
- session history and replay
- broadcast tasks
- council mode with judge agent
- WebSocket event streaming
- PTY-backed CLI agent runs
- local startup launcher
- redesigned desktop frontend
- README with screenshots

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

## Frontend Notes

The frontend was fully redesigned away from the original “generic AI dark dashboard” look.

Current visual direction:

- denser workstation UI
- smaller radii
- flatter surfaces
- less pill-heavy
- darker, warmer palette
- less decorative hero/dashboard framing

Highest-impact frontend files:

- `apps/desktop/src/index.css`
- `apps/desktop/src/components/app-layout.tsx`
- `apps/desktop/src/pages/dashboard-page.tsx`
- `apps/desktop/src/pages/swarm-page.tsx`
- `apps/desktop/src/components/agent-panel.tsx`
- `apps/desktop/src/components/prompt-composer.tsx`

## Skills / Design Guidance Used

Used:

- local `frontend-design` skill

Reviewed but only partially adopted:

- `Uncodixfy` from `https://github.com/cyxzdev/Uncodixfy`

Important safety note:

- `Uncodixfy` was not treated as executable instruction logic because it contained prompt-injection style lines about hidden reasoning
- only safe UI constraints were used from it

## Tests / Validation Already Run

These were run successfully after the Node 25 compatibility changes:

- `pnpm --filter @hive/orchestrator test`
- `pnpm build`
- `pnpm start`

Verified startup behavior:

- orchestrator health endpoint responds on `http://127.0.0.1:45231/health`
- frontend responds on `http://localhost:1420`

## Known Caveats

- Tauri runtime config exists, but full bundled sidecar spawning from Tauri is still not the actual startup path used in development
- `pnpm start:tauri` uses the same launcher logic, but real Tauri testing still depends on Rust being installed
- desktop bundle chunk size is still large; Vite warns about a large JS chunk
- `node:sqlite` is currently experimental in Node, though it works for this repo on Node 25

## Files Most Likely To Matter Next

If continuing product work, likely touch these:

- `apps/desktop/src/pages/*`
- `apps/desktop/src/components/*`
- `apps/orchestrator/src/sessions/task-service.ts`
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
- Prefer preserving the redesigned frontend direction instead of drifting back toward rounded/glassy/pill-heavy UI.
- Do not reintroduce `better-sqlite3` unless there is a strong reason.
- If touching startup, keep `pnpm start` idempotent.
- If touching tests around PTY on Windows, prefer `process.execPath` over hardcoded `node`.
