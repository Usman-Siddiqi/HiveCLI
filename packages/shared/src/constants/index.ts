export const EVENT_TYPES = [
  "status",
  "token",
  "stdout",
  "stderr",
  "message",
  "final",
  "error",
  "exit",
] as const;

export const RUN_STATUSES = [
  "idle",
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled",
] as const;

export const TASK_MODES = ["broadcast", "council"] as const;

export const AGENT_TYPES = ["cli", "api-llm", "local-llm", "judge"] as const;

export const BUILT_IN_AGENT_TEMPLATES = [
  {
    id: "codex-cli",
    name: "Codex CLI",
    provider: "codex",
    description: "OpenAI Codex terminal workflow with shell access.",
    command: "codex",
    args: [],
    type: "cli",
  },
  {
    id: "gemini-cli",
    name: "Gemini CLI",
    provider: "gemini",
    description: "Google Gemini terminal workflow with shell access.",
    command: "gemini",
    args: [],
    type: "cli",
  },
  {
    id: "custom-cli",
    name: "Custom CLI",
    provider: "custom",
    description: "Bring your own command and args.",
    command: "",
    args: [],
    type: "cli",
  },
] as const;
