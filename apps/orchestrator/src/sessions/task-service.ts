import { buildCouncilPrompt, buildImplementerPrompt, CODEX_CLI_ARGS, shouldMigrateCodexCliArgs } from "@hive/shared";
import type {
  AgentDefinition,
  AgentEvent,
  AgentRun,
  AgentRunRequest,
  RunTaskInput,
  Task,
} from "@hive/shared";

import { CliAgentAdapter } from "../adapters/cli-adapter";
import type { AgentAdapter } from "../adapters/base";
import { Repository } from "../db/repository";
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

  private async runSingleAgent(task: Task, agent: AgentDefinition, run: AgentRun, prompt: string, workspaceRoot: string, role: "assistant" | "judge" = "assistant") {
    const request: AgentRunRequest = { sessionId: task.sessionId, taskId: task.id, agentId: agent.id, prompt, workspaceRoot };
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

  async runTask(input: RunTaskInput) {
    const workspaceDetail = await this.repository.getWorkspace(input.workspaceId);
    if (!workspaceDetail) throw new Error("Workspace not found.");

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
      workspaceDetail.agents
        .filter((agent) => workerAgentIds.includes(agent.id))
        .map((agent) => this.normalizeAgent(agent)),
    );
    if (agents.length === 0) throw new Error("No selected agents were found for this workspace.");

    const session = await this.resolveSession(input);
    const task = await this.repository.createTask(session.id, input.prompt, input.mode, input.judgeAgentId);

    // Step 1: Run worker agents in parallel
    const runs = await Promise.all(agents.map((agent) => this.repository.createAgentRun(task.sessionId, task.id, agent.id, { adapter: this.adapter.serializeForReplay(agent) })));
    const settledRuns = await Promise.all(agents.map((agent, index) => this.runSingleAgent(task, agent, runs[index], input.prompt, workspaceDetail.workspace.rootPath)));

    // Step 2: Run judge on worker outputs
    let judgeVerdict = "";
    if (input.mode === "council" && input.judgeAgentId) {
      const judge = workspaceDetail.agents.find((agent) => agent.id === input.judgeAgentId);
      if (judge) {
        const normalizedJudge = await this.normalizeAgent(judge);
        const judgeRun = await this.repository.createAgentRun(task.sessionId, task.id, normalizedJudge.id, { adapter: this.adapter.serializeForReplay(normalizedJudge), judge: true });
        const judgePrompt = buildCouncilPrompt(task, settledRuns.map((run) => {
          const agent = agents.find((value) => value.id === run?.agentId)!;
          return { agent: { id: agent.id, name: agent.name, provider: agent.provider }, run: { id: run!.id, status: run!.status, finalText: run!.finalText, errorText: run!.errorText } };
        }));
        const judgeResult = await this.runSingleAgent(task, normalizedJudge, judgeRun, judgePrompt, workspaceDetail.workspace.rootPath, "judge");
        judgeVerdict = judgeResult?.finalText ?? "";
      }
    }

    // Step 3: Run implementer with judge verdict + worker outputs
    if (implementerAgent && judgeVerdict) {
      const normalizedImplementer = await this.normalizeAgent(implementerAgent);
      const implRun = await this.repository.createAgentRun(task.sessionId, task.id, normalizedImplementer.id, { adapter: this.adapter.serializeForReplay(normalizedImplementer), implementer: true });
      const implPrompt = buildImplementerPrompt(
        task,
        settledRuns.map((run) => {
          const agent = agents.find((value) => value.id === run?.agentId)!;
          return { agent: { id: agent.id, name: agent.name, provider: agent.provider }, run: { id: run!.id, status: run!.status, finalText: run!.finalText, errorText: run!.errorText } };
        }),
        judgeVerdict,
      );
      await this.runSingleAgent(task, normalizedImplementer, implRun, implPrompt, workspaceDetail.workspace.rootPath);
    }

    return { sessionId: session.id, taskId: task.id };
  }
}
