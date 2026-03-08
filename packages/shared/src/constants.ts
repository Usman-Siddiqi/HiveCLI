export const AGENT_TYPES = ["cli", "api-llm", "local-llm", "judge"] as const;

export const TASK_MODES = ["broadcast", "council"] as const;

export const AGENT_EVENT_TYPES = [
  "status",
  "token",
  "stdout",
  "stderr",
  "message",
  "final",
  "error",
  "exit",
] as const;

export const AGENT_RUN_STATES = [
  "idle",
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled",
] as const;

export const CODEX_CLI_ARGS = [
  "exec",
  "--full-auto",
  "-m",
  "gpt-5.1-codex-mini",
  "-c",
  "model_reasoning_effort=medium",
  "{{prompt}}",
] as const;

export const LEGACY_CODEX_CLI_ARGS = ["--approval-mode", "full-auto", "-q", "{{prompt}}"] as const;

export function isLegacyCodexCliArgs(args: string[] | undefined) {
  if (!args || args.length !== LEGACY_CODEX_CLI_ARGS.length) {
    return false;
  }

  return LEGACY_CODEX_CLI_ARGS.every((value, index) => args[index] === value);
}

export function shouldMigrateCodexCliArgs(args: string[] | undefined) {
  return !args || args.length === 0 || isLegacyCodexCliArgs(args);
}

export const BUILTIN_AGENT_TEMPLATES = [
  {
    id: "codex-cli",
    name: "Codex CLI",
    type: "cli",
    provider: "codex",
    command: "codex",
    args: [...CODEX_CLI_ARGS],
    canJudge: true,
    shellAccess: true,
  },
  {
    id: "gemini-cli",
    name: "Gemini CLI",
    type: "cli",
    provider: "gemini",
    command: "gemini",
    args: [],
    canJudge: true,
    shellAccess: true,
  },
  {
    id: "custom-cli",
    name: "Custom CLI",
    type: "cli",
    provider: "custom",
    command: "",
    args: [],
    canJudge: false,
    shellAccess: true,
  },
] as const;
