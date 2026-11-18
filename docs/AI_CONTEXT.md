# HiveCLI developer notes

The root README has setup and validation commands. Use the browser workbench for ordinary development. Start the stack from the repository root with `pnpm start` so that it builds the shared package and manages both services.

## Runtime

- `apps/desktop/src/router.tsx` defines the active frontend routes. The orchestrator client is in `apps/desktop/src/lib/` and workspace/run state is in `apps/desktop/src/stores/app-store.ts`.
- `apps/orchestrator/src/index.ts` starts the Express and WebSocket server. The default API binds to `127.0.0.1:45231`. If serving the workbench on a non-default port, set `HIVECLI_ALLOWED_ORIGINS` to the exact frontend origin before starting the API. Other runtime options are in `apps/orchestrator/src/config.ts`.
- `apps/orchestrator/src/sessions/task-service.ts` coordinates the stages and records results. `run-workspace.ts` creates project copies, generates comparison artifacts, and publishes the result.
- `packages/shared/src/constants.ts` defines CLI presets. Existing exact Codex defaults migrate to the current preset. User-edited argument lists are preserved.
- `packages/shared/src/council.ts` builds stage prompts. The implementer reports a decision to copy a candidate as-is or merge using its own folder. The orchestrator performs publication.

Each stage runs a locally installed executable. The Codex preset requests the CLI's workspace-write sandbox. Snapshot folders are separate copies, and custom CLI permissions depend on the command being run. The selected project, run directories, output copies, and SQLite data should be treated as local user data.

## Validation

Run `pnpm build`, `pnpm typecheck`, `pnpm test`, and `pnpm test:ui` from the repository root. The unit tests and browser smoke use local CLIs defined in `apps/orchestrator/tests/fixtures/` and work without provider authentication.
