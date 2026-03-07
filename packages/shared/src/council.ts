import type { AgentDefinition, AgentRun, Task } from "./types";

export interface CouncilSource {
  agent: Pick<AgentDefinition, "id" | "name" | "provider">;
  run: Pick<AgentRun, "id" | "status" | "finalText" | "errorText">;
}

export function buildCouncilPrompt(task: Pick<Task, "prompt">, sources: CouncilSource[]): string {
  const sections = sources.map((source, index) => {
    const body =
      source.run.finalText?.trim() ||
      source.run.errorText?.trim() ||
      "No final output was produced.";

    return [
      `Agent ${index + 1}: ${source.agent.name} (${source.agent.provider})`,
      `Status: ${source.run.status}`,
      body,
    ].join("\n");
  });

  return [
    "You are the council judge for a multi-agent developer workspace.",
    "Read the original prompt and the outputs from each agent, then synthesize the best final answer.",
    "Call out disagreements or tradeoffs when they materially affect the recommendation.",
    "",
    "Original prompt:",
    task.prompt,
    "",
    "Agent outputs:",
    sections.join("\n\n---\n\n"),
  ].join("\n");
}
