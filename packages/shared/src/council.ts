import type { AgentDefinition, AgentRun, Task } from "./types";

export interface CouncilSource {
  agent: Pick<AgentDefinition, "id" | "name" | "provider">;
  run: Pick<AgentRun, "id" | "status" | "finalText" | "errorText">;
}

export interface WorkerPromptContext {
  sourceDir: string;
  workingDir: string;
  workspaceRoot: string;
}

export interface JudgePromptContext {
  judgeDir: string;
  workerDirs: [string, string];
  artifactPaths: string[];
  diffSummary: string;
}

export interface ImplementerPromptContext {
  workerDirs: [string, string];
  implementerDir: string;
  publishDir: string;
}

export function buildWorkerPrompt(task: Pick<Task, "prompt">, context: WorkerPromptContext): string {
  return [
    "You are a worker agent in a filesystem-backed coding council.",
    "Work only inside your assigned working folder.",
    "Treat the selected project directory as source material only. Do not modify it.",
    "Make all code and file changes inside the working folder you were assigned.",
    "At the end, summarize exactly what you changed and any important tradeoffs.",
    "",
    `Selected project directory: ${context.workspaceRoot}`,
    `Source snapshot: ${context.sourceDir}`,
    `Assigned working folder: ${context.workingDir}`,
    "",
    "Original task:",
    task.prompt,
  ].join("\n");
}

export function buildCouncilPrompt(
  task: Pick<Task, "prompt">,
  sources: CouncilSource[],
  context: JudgePromptContext,
): string {
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
    "You are the council judge for a filesystem-backed multi-agent developer workspace.",
    "Read the original prompt, compare the worker responses, and compare the contents of the worker folders.",
    "Choose the best implementation strategy and call out meaningful tradeoffs when they affect the recommendation.",
    "",
    "Original prompt:",
    task.prompt,
    "",
    `Judge working folder: ${context.judgeDir}`,
    `Worker A folder: ${context.workerDirs[0]}`,
    `Worker B folder: ${context.workerDirs[1]}`,
    `Artifacts: ${context.artifactPaths.join(", ")}`,
    "",
    "Agent outputs:",
    sections.join("\n\n---\n\n"),
    "",
    "Folder comparison summary:",
    context.diffSummary,
  ].join("\n");
}

export function buildImplementerPrompt(
  task: Pick<Task, "prompt">,
  sources: CouncilSource[],
  judgeVerdict: string,
  context: ImplementerPromptContext,
): string {
  const sections = sources.map((source, index) => {
    const body =
      source.run.finalText?.trim() ||
      source.run.errorText?.trim() ||
      "No final output was produced.";

    return [
      `Agent ${index + 1}: ${source.agent.name} (${source.agent.provider})`,
      body,
    ].join("\n");
  });

  return [
    "You are the implementer agent in a filesystem-backed multi-agent developer workspace.",
    "The judge has reviewed the outputs from multiple worker agents and produced a verdict.",
    "You must work in your own assigned implementer folder.",
    "You may either choose Worker A, choose Worker B, or merge both.",
    "The first lines of your response must be:",
    "DECISION: COPY_WORKER_A | COPY_WORKER_B | MERGE",
    "RATIONALE: <short explanation>",
    "",
    "Original task:",
    task.prompt,
    "",
    `Worker A folder: ${context.workerDirs[0]}`,
    `Worker B folder: ${context.workerDirs[1]}`,
    `Your implementer folder: ${context.implementerDir}`,
    `Publish folder: ${context.publishDir}`,
    "",
    "Worker outputs:",
    sections.join("\n\n---\n\n"),
    "",
    "Judge verdict:",
    judgeVerdict,
    "",
    "If you choose COPY_WORKER_A or COPY_WORKER_B, clearly say so in the DECISION block.",
    "If you choose MERGE, write the merged implementation into your implementer folder.",
    "Do not modify the original selected project directory.",
  ].join("\n");
}
