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
  "--sandbox",
  "workspace-write",
  "--skip-git-repo-check",
  "-c",
  "model_reasoning_effort=low",
  "--",
  "{{prompt}}",
] as const;

const previousCodexOptions = [
  "-m", "gpt-5.1-codex-mini", "-c", "model_reasoning_effort=medium", "{{prompt}}",
] as const;

const previousCodexPresets = [
  ["--approval-mode", "full-auto", "-q", "{{prompt}}"],
  ["exec", "--full-auto", ...previousCodexOptions],
  ["exec", "--full-auto", "--skip-git-repo-check", ...previousCodexOptions],
];

export function shouldMigrateCodexCliArgs(args: string[] | undefined) {
  if (!args?.length) {
    return true;
  }

  return previousCodexPresets.some(
    (preset) => preset.length === args.length && preset.every((value, index) => value === args[index]),
  );
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
    args: ["--prompt={{prompt}}"],
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
