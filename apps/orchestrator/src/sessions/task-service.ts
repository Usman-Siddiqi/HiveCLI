import {
  buildCouncilPrompt,
  buildImplementerPrompt,
  buildWorkerPrompt,
  CODEX_CLI_ARGS,
  shouldMigrateCodexCliArgs,
} from "@hive/shared";
import type {
  AgentDefinition,
  AgentEvent,
  AgentRun,
  AgentRunMetadata,
  AgentRunRequest,
  CouncilSource,
  RunTaskInput,
  Task,
} from "@hive/shared";

import { CliAgentAdapter } from "../adapters/cli-adapter";
import type { AgentAdapter } from "../adapters/base";
import { Repository } from "../db/repository";
import {
  createRunWorkspacePaths,
  generateJudgeArtifacts,
  getWorkerDirectory,
  parseImplementerDecision,
  prepareRunWorkspace,
  publishRunOutput,
} from "./run-workspace";
import { nowIso } from "../utils/time";
import { requireWorkspaceRoot } from "../utils/workspace-root";
import { EventHub } from "../ws/hub";

const MAX_HANDOFF_TEXT = 8_000;

function summarizeHandoff(text: string | null | undefined) {
  if (!text || text.length <= MAX_HANDOFF_TEXT) return text;
  const half = MAX_HANDOFF_TEXT / 2;
  return `${text.slice(0, half)}\n\n[Output shortened for handoff]\n\n${text.slice(-half)}`;
}

function errorMessage(error: unknown) {
  return (error instanceof Error ? error.message : String(error)) || "An unexpected run error occurred.";
}

export class TaskInputError extends Error {}

export class TaskService {
  private readonly adapter: AgentAdapter;
  private readonly runSequences = new Map<string, number>();

  constructor(private readonly repository: Repository, private readonly hub: EventHub, adapter?: AgentAdapter) {
    this.adapter = adapter ?? new CliAgentAdapter();
  }

  private nextSequence(runId: string) {
    const value = (this.runSequences.get(runId) ?? 0) + 1;
    this.runSequences.set(runId, value);
    return value;
  }

  private async emitEvent(run: AgentRun, type: AgentEvent["type"], payload: string) {
    const event = await this.repository.appendEvent({
      sessionId: run.sessionId,
      taskId: run.taskId,
      agentRunId: run.id,
      agentId: run.agentId,
      type,
      payload,
      sequence: this.nextSequence(run.id),
    });
    this.hub.broadcastEvent(event);
  }

  private createSessionTitle(prompt: string) {
    return prompt.split("\n")[0].trim().slice(0, 80) || "Untitled session";
  }

  private async resolveSession(input: RunTaskInput) {
    if (input.sessionId) {
      const session = await this.repository.getSession(input.sessionId);
      if (!session || session.workspaceId !== input.workspaceId) {
        throw new TaskInputError("The selected session does not belong to this workspace.");
      }
      return session;
    }
    return this.repository.createSession(input.workspaceId, this.createSessionTitle(input.prompt));
  }

  private async normalizeAgent(agent: AgentDefinition) {
    if (agent.provider !== "codex" || !shouldMigrateCodexCliArgs(agent.args)) {
      return agent;
    }

    const nextArgs = [...CODEX_CLI_ARGS];
    const updated = await this.repository.updateAgent(agent.id, { args: nextArgs });
    return updated ?? { ...agent, args: nextArgs };
  }

  private async runSingleAgent(
    task: Task,
    agent: AgentDefinition,
    run: AgentRun,
    requestInput: Omit<AgentRunRequest, "sessionId" | "taskId" | "agentId" | "workspaceRoot"> & { workspaceRoot?: string },
  ): Promise<AgentRun> {
    const metadata = run.metadata ?? {};
    const request: AgentRunRequest = {
      sessionId: task.sessionId,
      taskId: task.id,
      agentId: agent.id,
      workspaceRoot: requestInput.workspaceRoot ?? metadata.workspaceRoot ?? "",
      prompt: requestInput.prompt,
      role: requestInput.role,
      context: requestInput.context,
      sourceDir: requestInput.sourceDir ?? metadata.sourceDir,
      workingDir: requestInput.workingDir ?? metadata.workingDir,
      runRootDir: requestInput.runRootDir ?? metadata.runRootDir,
      publishDir: requestInput.publishDir ?? metadata.publishDir,
      artifactPaths: requestInput.artifactPaths ?? metadata.artifactPaths,
    };
    const startedAt = nowIso();
    await this.repository.updateAgentRun(run.id, { status: "running", startedAt });
    await this.emitEvent(run, "status", "running");

    let finalText = "";
    let failure: string | undefined;
    let exitCode: number | null = null;
    let pendingOutput = Promise.resolve();
    const stream = (type: "stdout" | "stderr", chunk: string) => {
      pendingOutput = pendingOutput
        .then(() => this.emitEvent(run, type, chunk))
        .catch((error: unknown) => {
          failure ??= `Could not record agent output: ${errorMessage(error)}`;
        });
    };

    try {
      const running = this.adapter.startRun(agent, request, {
        onStdout: (chunk) => stream("stdout", chunk),
        onStderr: (chunk) => stream("stderr", chunk),
        onStatus: () => {},
        onExit: (code) => { exitCode = code; },
        onError: (error) => { failure ??= errorMessage(error); },
        onFinal: (value) => { finalText = value; },
      });
      await running.done;
    } catch (error) {
      failure ??= errorMessage(error);
    }
    await pendingOutput;

    if (exitCode !== 0) {
      failure ??= exitCode === null ? "Agent ended without an exit code." : `Agent exited with code ${exitCode}. See the output for details.`;
    }
    if (request.role === "judge" && !finalText.trim()) {
      failure ??= "The judge ended without a verdict.";
    }

    const updatedRun: AgentRun = {
      ...run,
      startedAt,
      exitCode,
      finalText,
      status: "running",
    };
    await this.repository.updateAgentRun(run.id, updatedRun);
    await this.emitEvent(run, "exit", String(exitCode ?? ""));
    if (finalText) {
      await this.repository.appendMessage({
        sessionId: task.sessionId,
        taskId: task.id,
        agentRunId: run.id,
        agentId: agent.id,
        role: request.role === "judge" ? "judge" : "assistant",
        content: finalText,
        isFinal: true,
      });
      await this.emitEvent(run, "final", finalText);
    }
    if (failure) return this.finishRun(updatedRun, failure);
    if (request.role === "implementer") return updatedRun;
    return this.finishRun(updatedRun);
  }

  private async finishRun(run: AgentRun, errorText?: string) {
    const finished: AgentRun = {
      ...run,
      status: errorText ? "failed" : "completed",
      finishedAt: nowIso(),
      errorText: errorText ?? null,
    };
    await this.repository.updateAgentRun(run.id, finished);
    if (errorText) await this.emitEvent(run, "error", errorText);
    await this.emitEvent(run, "status", finished.status);
    return finished;
  }

  private async failUnfinishedRuns(runs: AgentRun[], message: string) {
    for (const run of runs) {
      const current = await this.repository.getRun(run.id);
      if (current?.status === "running" || current?.status === "queued") {
        await this.finishRun(current, message);
      }
    }
  }

  private describeWorker(agent: AgentDefinition, run: AgentRun): CouncilSource {
    return {
      agent: { id: agent.id, name: agent.name, provider: agent.provider },
      run: {
        id: run.id,
        status: run.status,
        finalText: summarizeHandoff(run.finalText),
        errorText: summarizeHandoff(run.errorText),
      },
    };
  }

  private requireAgent(agents: AgentDefinition[], id: string) {
    const agent = agents.find((value) => value.id === id);
    if (!agent) throw new TaskInputError("A selected agent is missing from this workspace.");
    if (!agent.enabled) throw new TaskInputError(`Agent "${agent.name}" is disabled.`);
    if (!agent.command?.trim()) {
      throw new TaskInputError(`Agent "${agent.name}" is missing a CLI command.`);
    }
    return agent;
  }

  async runTask(input: RunTaskInput) {
    const workspaceDetail = await this.repository.getWorkspace(input.workspaceId);
    if (!workspaceDetail) throw new TaskInputError("Workspace not found.");
    if (!input.prompt.trim()) throw new TaskInputError("Enter a task prompt.");

    const workspaceRootStatus = await requireWorkspaceRoot(workspaceDetail.workspace.rootPath).catch((error: unknown) => {
      throw new TaskInputError(errorMessage(error));
    });
    const workspaceRoot = workspaceRootStatus.resolvedPath!;

    if (input.mode === "council" && !input.judgeAgentId) {
      throw new TaskInputError("Council mode needs a judge.");
    }
    const judge = input.mode === "council" && input.judgeAgentId
      ? this.requireAgent(workspaceDetail.agents, input.judgeAgentId)
      : undefined;
    if (judge && !judge.canJudge) {
      throw new TaskInputError(`Agent "${judge.name}" is not configured as a judge.`);
    }

    const selectedIds = [...new Set(input.agentIds)].filter((id) => id !== judge?.id);
    const selectedAgents = selectedIds.map((id) => this.requireAgent(workspaceDetail.agents, id));
    const implementer = judge
      ? selectedAgents.find((agent) => agent.name.toLowerCase().includes("implementer"))
      : undefined;
    const workers = selectedAgents.filter((agent) => agent.id !== implementer?.id);
    if (workers.length === 0) throw new TaskInputError("Select at least one worker agent.");
    if (judge && workers.length !== 2) {
      throw new TaskInputError("Council mode requires exactly two worker agents.");
    }

    const agents = await Promise.all(workers.map((agent) => this.normalizeAgent(agent)));
    const normalizedJudge = judge ? await this.normalizeAgent(judge) : undefined;
    const normalizedImplementer = implementer ? await this.normalizeAgent(implementer) : undefined;
    const session = await this.resolveSession(input);
    const task = await this.repository.createTask(session.id, input.prompt, input.mode, judge?.id);
    const runPaths = createRunWorkspacePaths(workspaceRoot, task.id);
    const workerDirectories = agents.map((_, index) => getWorkerDirectory(runPaths, index));

    const workerRuns = await Promise.all(
      agents.map((agent, index) => {
        const metadata: AgentRunMetadata = {
          role: "worker",
          workspaceRoot,
          runRootDir: runPaths.runRootDir,
          sourceDir: runPaths.sourceDir,
          workingDir: workerDirectories[index],
          publishDir: runPaths.publishDir,
        };

        return this.repository.createAgentRun(task.sessionId, task.id, agent.id, {
          adapter: this.adapter.serializeForReplay(agent),
          ...metadata,
        });
      }),
    );

    const judgeRun = normalizedJudge
      ? await this.repository.createAgentRun(task.sessionId, task.id, normalizedJudge.id, {
        adapter: this.adapter.serializeForReplay(normalizedJudge),
        role: "judge",
        workspaceRoot,
        runRootDir: runPaths.runRootDir,
        sourceDir: runPaths.sourceDir,
        workingDir: runPaths.judgeDir,
        publishDir: runPaths.publishDir,
      })
      : undefined;

    const implementerRun = normalizedImplementer
      ? await this.repository.createAgentRun(task.sessionId, task.id, normalizedImplementer.id, {
        adapter: this.adapter.serializeForReplay(normalizedImplementer),
        role: "implementer",
        workspaceRoot,
        runRootDir: runPaths.runRootDir,
        sourceDir: runPaths.sourceDir,
        workingDir: runPaths.implementerDir,
        publishDir: runPaths.publishDir,
      })
      : undefined;

    const runs = [...workerRuns, ...(judgeRun ? [judgeRun] : []), ...(implementerRun ? [implementerRun] : [])];
    try {
      for (const run of workerRuns) {
        await this.emitEvent(run, "message", `Preparing run folders in ${runPaths.runRootDir}\n`);
      }

      const { warnings } = await prepareRunWorkspace(workspaceRoot, task.id, workerDirectories.length, Boolean(implementerRun));
      for (const run of workerRuns) {
        await this.emitEvent(run, "message", `Worker folders ready. Source snapshot: ${runPaths.sourceDir}\n`);
      }
      if (warnings.length > 0) {
        for (const run of runs) {
          await this.emitEvent(run, "message", `${warnings.join("\n")}\n`);
        }
      }

      const workerResults = await Promise.allSettled(
        agents.map((agent, index) => this.runSingleAgent(task, agent, workerRuns[index], {
          role: "worker",
          prompt: buildWorkerPrompt(task, {
            workspaceRoot,
            sourceDir: runPaths.sourceDir,
            workingDir: workerDirectories[index],
          }),
          context: input.context,
        })),
      );
      const settledRuns = workerResults.map((result) => {
        if (result.status === "rejected") throw result.reason;
        return result.value;
      });

      if (normalizedJudge && judgeRun) {
        if (settledRuns.some((run) => run.status !== "completed")) {
          throw new Error("Both workers must finish successfully before the council can compare their results.");
        }

        const sources = settledRuns.map((run, index) => this.describeWorker(agents[index], run));
        const artifacts = await generateJudgeArtifacts(runPaths);
        const metadata = {
          ...judgeRun.metadata,
          artifactPaths: artifacts.artifactPaths,
          warnings: artifacts.warnings,
        };
        await this.repository.updateAgentRun(judgeRun.id, { metadata });
        await this.emitEvent(judgeRun, "message", `Diff artifacts generated:\n${artifacts.artifactPaths.join("\n")}\n`);

        const judgeResult = await this.runSingleAgent(task, normalizedJudge, { ...judgeRun, metadata }, {
          role: "judge",
          prompt: buildCouncilPrompt(task, sources, {
            judgeDir: runPaths.judgeDir,
            workerDirs: runPaths.workerDirs,
            artifactPaths: artifacts.artifactPaths,
            diffSummary: summarizeHandoff(artifacts.diffSummary) ?? "",
          }),
          context: input.context,
        });

        if (normalizedImplementer && implementerRun) {
          if (judgeResult.status !== "completed") {
            throw new Error("The judge must finish successfully before the implementer can publish a result.");
          }
          const implementerResult = await this.runSingleAgent(task, normalizedImplementer, implementerRun, {
            role: "implementer",
            prompt: buildImplementerPrompt(task, sources, summarizeHandoff(judgeResult.finalText) ?? "", {
              workerDirs: runPaths.workerDirs,
              implementerDir: runPaths.implementerDir,
              publishDir: runPaths.publishDir,
            }),
            context: input.context,
          });

          if (implementerResult.status === "running") {
            const decision = parseImplementerDecision(implementerResult.finalText ?? "");
            if (!decision) {
              throw new Error("The implementer did not return a valid publish decision. Its files remain available in the run folder.");
            }
            await this.emitEvent(implementerRun, "message", `Publishing result to ${runPaths.publishDir}\n`);
            const published = await publishRunOutput(runPaths, decision);
            const resolvedRun = {
              ...implementerResult,
              metadata: { ...implementerResult.metadata, publishSource: published.publishSource },
            };
            await this.emitEvent(implementerRun, "message", `Published result to ${published.publishDir}\n`);
            await this.finishRun(resolvedRun);
          }
        }
      }
    } catch (error) {
      await this.failUnfinishedRuns(runs, errorMessage(error));
    } finally {
      for (const run of runs) this.runSequences.delete(run.id);
      await this.repository.touchSession(task.sessionId);
    }

    return { sessionId: session.id, taskId: task.id };
  }
}
