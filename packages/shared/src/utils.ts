import type { AgentDefinition, AgentRun, Task } from "./types/index.js";

const ANSI_REGEX =
  // eslint-disable-next-line no-control-regex
  /\u001B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g;

export function stripAnsi(value: string): string {
  return value.replace(ANSI_REGEX, "");
}

export function buildCouncilPrompt(params: {
  task: Task;
  judge: AgentDefinition;
  sourceRuns: Array<AgentRun & { agentName: string }>;
}): string {
  const sourceText = params.sourceRuns
    .map(
      (run) =>
        `## ${run.agentName}\nStatus: ${run.status}\n\n${run.finalText.trim() || "(no final output)"}`,
    )
    .join("\n\n");

  return [
    `You are ${params.judge.name}, acting as the council judge for HiveCLI.`,
    "Read the original prompt and each agent transcript, then produce a concise synthesis.",
    "Call out the best approach, major disagreements, and a recommended next step.",
    "",
    "## Original Prompt",
    params.task.prompt,
    "",
    "## Agent Outputs",
    sourceText,
  ].join("\n");
}
