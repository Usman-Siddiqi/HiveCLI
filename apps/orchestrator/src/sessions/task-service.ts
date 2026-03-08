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
  RunTaskInput,
  Task,
} from "@hive/shared";

import { CliAgentAdapter } from "../adapters/cli-adapter";
import type { AgentAdapter } from "../adapters/base";
import { Repository } from "../db/repository";
import {
  type ImplementerDecision,
  createRunWorkspacePaths,
  generateJudgeArtifacts,
  parseImplementerDecision,
  prepareRunWorkspace,
  publishRunOutput,
} from "./run-workspace";
import { requireWorkspaceRoot } from "../utils/workspace-root";
import { nowIso } from "../utils/time";
import { EventHub } from "../ws/hub";

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

  private async emitEvent(input: Omit<AgentEvent, "id" | "timestamp" | "sequence"> & { sequence?: number }) {
    const event = await this.repository.appendEvent({ ...input, sequence: input.sequence ?? this.nextSequence(input.agentRunId), timestamp: nowIso() });
    this.hub.broadcastEvent(event);
    return event;
  }

  private createSessionTitle(prompt: string) {
    return prompt.split("\n")[0].trim().slice(0, 80) || "Untitled session";
  }

  private async resolveSession(input: RunTaskInput) {
    if (input.sessionId) {
      const session = await this.repository.getSession(input.sessionId);
      if (session) return session;
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
    role: "assistant" | "judge" = "assistant",
  ) {
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
    await this.repository.updateAgentRun(run.id, { status: "running", startedAt: nowIso() });
    await this.emitEvent({ sessionId: task.sessionId, taskId: task.id, agentRunId: run.id, agentId: agent.id, type: "status", payload: "running" });

    let finalText = "";
    let failed = false;
    let exitCode: number | null = null;

    const running = this.adapter.startRun(agent, request, {
      onStdout: (chunk) => void this.emitEvent({ sessionId: task.sessionId, taskId: task.id, agentRunId: run.id, agentId: agent.id, type: "stdout", payload: chunk }),
      onStderr: (chunk) => void this.emitEvent({ sessionId: task.sessionId, taskId: task.id, agentRunId: run.id, agentId: agent.id, type: "stderr", payload: chunk }),
      onStatus: (status) => void this.emitEvent({ sessionId: task.sessionId, taskId: task.id, agentRunId: run.id, agentId: agent.id, type: "status", payload: status }),
      onExit: (code) => {
        exitCode = code;
        if (code !== null && code !== 0) failed = true;
        void this.emitEvent({ sessionId: task.sessionId, taskId: task.id, agentRunId: run.id, agentId: agent.id, type: "exit", payload: String(code ?? "") });
      },
      onError: (error) => {
        failed = true;
        void this.emitEvent({ sessionId: task.sessionId, taskId: task.id, agentRunId: run.id, agentId: agent.id, type: "error", payload: error.message });
      },
      onFinal: (value) => {
        finalText = value;
        void this.emitEvent({ sessionId: task.sessionId, taskId: task.id, agentRunId: run.id, agentId: agent.id, type: "final", payload: value });
      },
    });

    await running.done;
    await this.repository.updateAgentRun(run.id, { status: failed ? "failed" : "completed", finishedAt: nowIso(), exitCode, finalText, errorText: failed ? finalText || "Agent exited with an error." : null });
    await this.repository.appendMessage({ sessionId: task.sessionId, taskId: task.id, agentRunId: run.id, agentId: agent.id, role, content: finalText, isFinal: true });
    await this.repository.touchSession(task.sessionId);
    return this.repository.getRun(run.id);
  }

  private async emitLifecycleMessage(task: Task, run: AgentRun, payload: string) {
    await this.emitEvent({
      sessionId: task.sessionId,
      taskId: task.id,
      agentRunId: run.id,
      agentId: run.agentId,
      type: "message",
      payload: `${payload}\n`,
    });
  }

  private async failRun(task: Task, run: AgentRun, error: Error) {
    await this.emitEvent({
      sessionId: task.sessionId,
      taskId: task.id,
      agentRunId: run.id,
      agentId: run.agentId,
      type: "error",
      payload: error.message,
    });
    await this.repository.updateAgentRun(run.id, {
      status: "failed",
      finishedAt: nowIso(),
      errorText: error.message,
    });
  }

  async runTask(input: RunTaskInput) {
    const workspaceDetail = await this.repository.getWorkspace(input.workspaceId);
    if (!workspaceDetail) throw new Error("Workspace not found.");

    const workspaceRootStatus = await requireWorkspaceRoot(workspaceDetail.workspace.rootPath);
    const workspaceRoot = workspaceRootStatus.resolvedPath!;

    const sourceAgentIds = input.mode === "council" && input.judgeAgentId ? input.agentIds.filter((agentId) => agentId !== input.judgeAgentId) : input.agentIds;

    // In council mode, separate out implementer agents (agents named "Implementer" that are not the judge)
    const implementerAgent = input.mode === "council"
      ? workspaceDetail.agents.find((a) => sourceAgentIds.includes(a.id) && a.name.toLowerCase().includes("implementer"))
      : undefined;

    const workerAgentIds = implementerAgent
      ? sourceAgentIds.filter((id) => id !== implementerAgent.id)
      : sourceAgentIds;

    if (workerAgentIds.length === 0) throw new Error("Council mode requires at least one non-judge worker agent.");

    const agents = await Promise.all(
      workerAgentIds
        .map((agentId) => workspaceDetail.agents.find((agent) => agent.id === agentId))
        .filter((agent): agent is AgentDefinition => Boolean(agent))
        .map((agent) => this.normalizeAgent(agent)),
    );
    if (agents.length === 0) throw new Error("No selected agents were found for this workspace.");
    if (input.mode === "council" && agents.length !== 2) {
      throw new Error("Council mode currently requires exactly two worker agents.");
    }

    const session = await this.resolveSession(input);
    const task = await this.repository.createTask(session.id, input.prompt, input.mode, input.judgeAgentId);
    const runPaths = createRunWorkspacePaths(workspaceRoot, task.id);

    const workerRuns = await Promise.all(
      agents.map((agent, index) => {
        const metadata: AgentRunMetadata = {
          role: "worker",
          workspaceRoot,
          runRootDir: runPaths.runRootDir,
          sourceDir: runPaths.sourceDir,
          workingDir: runPaths.workerDirs[index],
          publishDir: runPaths.publishDir,
        };

        return this.repository.createAgentRun(task.sessionId, task.id, agent.id, {
          adapter: this.adapter.serializeForReplay(agent),
          ...metadata,
        });
      }),
    );

    const judge = input.mode === "council" && input.judgeAgentId
      ? workspaceDetail.agents.find((agent) => agent.id === input.judgeAgentId)
      : undefined;
    const normalizedJudge = judge ? await this.normalizeAgent(judge) : undefined;
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

    const normalizedImplementer = implementerAgent ? await this.normalizeAgent(implementerAgent) : undefined;
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

    try {
      for (const run of workerRuns) {
        await this.emitLifecycleMessage(task, run, `Preparing run folders in ${runPaths.runRootDir}`);
      }
      if (judgeRun) {
        await this.emitLifecycleMessage(task, judgeRun, `Judge folder: ${runPaths.judgeDir}`);
      }
      if (implementerRun) {
        await this.emitLifecycleMessage(task, implementerRun, `Implementer folder: ${runPaths.implementerDir}`);
      }

      const preparedWorkspace = await prepareRunWorkspace(workspaceRoot, task.id);
      const prepWarnings = preparedWorkspace.warnings;

      for (const run of workerRuns) {
        await this.emitLifecycleMessage(task, run, `Worker folders ready. Source snapshot: ${runPaths.sourceDir}`);
      }
      if (prepWarnings.length > 0) {
        for (const run of [...workerRuns, judgeRun, implementerRun].filter((value): value is AgentRun => Boolean(value))) {
          await this.emitLifecycleMessage(task, run, prepWarnings.join("\n"));
        }
      }
    } catch (error) {
      const failure = error instanceof Error ? error : new Error("Failed to prepare run folders.");
      for (const run of [...workerRuns, judgeRun, implementerRun].filter((value): value is AgentRun => Boolean(value))) {
        await this.failRun(task, run, failure);
      }
      throw failure;
    }

    // Step 1: Run worker agents in parallel
    const settledRuns = await Promise.all(
      agents.map((agent, index) =>
        this.runSingleAgent(
          task,
          agent,
          workerRuns[index],
          {
            role: "worker",
            prompt: buildWorkerPrompt(task, {
              workspaceRoot,
              sourceDir: runPaths.sourceDir,
              workingDir: runPaths.workerDirs[index],
            }),
            sourceDir: runPaths.sourceDir,
            workingDir: runPaths.workerDirs[index],
            runRootDir: runPaths.runRootDir,
            publishDir: runPaths.publishDir,
            workspaceRoot,
          },
        ),
      ),
    );

    // Step 2: Run judge on worker outputs
    let judgeVerdict = "";
    if (normalizedJudge && judgeRun) {
      const judgeArtifacts = await generateJudgeArtifacts(runPaths);
      await this.repository.updateAgentRun(judgeRun.id, {
        metadata: {
          ...(judgeRun.metadata ?? {}),
          role: "judge",
          workspaceRoot,
          runRootDir: runPaths.runRootDir,
          sourceDir: runPaths.sourceDir,
          workingDir: runPaths.judgeDir,
          publishDir: runPaths.publishDir,
          artifactPaths: judgeArtifacts.artifactPaths,
          warnings: judgeArtifacts.warnings,
        },
      });
      await this.emitLifecycleMessage(task, judgeRun, `Diff artifacts generated:\n${judgeArtifacts.artifactPaths.join("\n")}`);

      const judgePrompt = buildCouncilPrompt(task, settledRuns.map((run) => {
        const agent = agents.find((value) => value.id === run?.agentId)!;
        return { agent: { id: agent.id, name: agent.name, provider: agent.provider }, run: { id: run!.id, status: run!.status, finalText: run!.finalText, errorText: run!.errorText } };
      }), {
        judgeDir: runPaths.judgeDir,
        workerDirs: runPaths.workerDirs,
        artifactPaths: judgeArtifacts.artifactPaths,
        diffSummary: judgeArtifacts.diffSummary,
      });
      const judgeResult = await this.runSingleAgent(task, normalizedJudge, judgeRun, {
        role: "judge",
        prompt: judgePrompt,
        sourceDir: runPaths.sourceDir,
        workingDir: runPaths.judgeDir,
        runRootDir: runPaths.runRootDir,
        publishDir: runPaths.publishDir,
        artifactPaths: judgeArtifacts.artifactPaths,
        workspaceRoot,
      }, "judge");
      judgeVerdict = judgeResult?.finalText ?? "";
    }

    // Step 3: Run implementer with judge verdict + worker outputs
    if (normalizedImplementer && implementerRun && judgeVerdict) {
      const implPrompt = buildImplementerPrompt(
        task,
        settledRuns.map((run) => {
          const agent = agents.find((value) => value.id === run?.agentId)!;
          return { agent: { id: agent.id, name: agent.name, provider: agent.provider }, run: { id: run!.id, status: run!.status, finalText: run!.finalText, errorText: run!.errorText } };
        }),
        judgeVerdict,
        {
          workerDirs: runPaths.workerDirs,
          implementerDir: runPaths.implementerDir,
          publishDir: runPaths.publishDir,
        },
      );
      const implementerResult = await this.runSingleAgent(task, normalizedImplementer, implementerRun, {
        role: "implementer",
        prompt: implPrompt,
        sourceDir: runPaths.sourceDir,
        workingDir: runPaths.implementerDir,
        runRootDir: runPaths.runRootDir,
        publishDir: runPaths.publishDir,
        workspaceRoot,
      });
      const decision = parseImplementerDecision(implementerResult?.finalText ?? "");
      try {
        await this.emitLifecycleMessage(task, implementerRun, `Publishing result using decision ${decision} to ${runPaths.publishDir}`);
        const publishResult = await publishRunOutput(runPaths, decision as ImplementerDecision);
        await this.repository.updateAgentRun(implementerRun.id, {
          metadata: {
            ...(implementerResult?.metadata ?? {}),
            role: "implementer",
            workspaceRoot,
            runRootDir: runPaths.runRootDir,
            sourceDir: runPaths.sourceDir,
            workingDir: runPaths.implementerDir,
            publishDir: runPaths.publishDir,
            publishSource: publishResult.publishSource,
          },
        });
        await this.emitLifecycleMessage(task, implementerRun, `Published final result to ${publishResult.publishDir}`);
      } catch (error) {
        const publishError = error instanceof Error ? error : new Error("Failed to publish implementer output.");
        await this.emitEvent({
          sessionId: task.sessionId,
          taskId: task.id,
          agentRunId: implementerRun.id,
          agentId: implementerRun.agentId,
          type: "error",
          payload: publishError.message,
        });
        await this.repository.updateAgentRun(implementerRun.id, {
          status: "failed",
          finishedAt: nowIso(),
          errorText: publishError.message,
        });
        throw publishError;
      }
    }

    return { sessionId: session.id, taskId: task.id };
  }
}
