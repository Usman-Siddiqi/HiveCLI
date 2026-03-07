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

export const BUILTIN_AGENT_TEMPLATES = [
  {
    id: "codex-cli",
    name: "Codex CLI",
    type: "cli",
    provider: "codex",
    command: "codex",
    args: [],
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
