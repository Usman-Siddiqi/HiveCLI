import {
  BUILTIN_AGENT_TEMPLATES,
  CODEX_CLI_ARGS,
  shouldMigrateCodexCliArgs,
} from "@hive/shared/constants";
import type {
  AgentEvent,
  AgentRun,
  SessionReplay,
  SessionSnapshot,
  Workspace,
  WorkspaceDetail,
} from "@hive/shared";
import { create } from "zustand";

import { api, type WorkspaceRootStatus } from "@/lib/api";
import { getRuntimeConfig } from "@/lib/runtime";

interface LiveRunState {
  run: AgentRun;
  output: string;
}

export interface HiveAgentRoles {
  workerA?: string;
  workerB?: string;
  judge?: string;
  implementer?: string;
}

export interface CurrentTaskPaths {
  rootPath: string;
  sourceDir?: string;
  runRootDir?: string;
  publishDir?: string;
  publishSource?: string;
  artifactPaths?: string[];
  workerAPath?: string;
  workerBPath?: string;
  judgePath?: string;
  implementerPath?: string;
}

interface RunPathMetadata {
  role?: string;
  sourceDir?: string;
  workingDir?: string;
  runRootDir?: string;
  publishDir?: string;
  publishSource?: string;
  artifactPaths?: string[];
}

function shouldMigrateCodexAgentArgs(provider: string, args: string[] | undefined) {
  return provider === "codex" && shouldMigrateCodexCliArgs(args);
}

function isFixtureWorkspace(workspace: Workspace) {
  return /^fixture\b/i.test(workspace.name.trim());
}

function pickInitialWorkspace(workspaces: Workspace[]) {
  const firstRealWorkspace = workspaces.find((workspace) => !isFixtureWorkspace(workspace));
  return firstRealWorkspace ?? workspaces[0];
}

function assignRoles(agents: WorkspaceDetail["agents"]): HiveAgentRoles {
  const selected = new Set<string>();
  const enabled = agents.filter((agent) => agent.enabled);
  const take = (matches: (agent: typeof enabled[number]) => boolean) => {
    const agent = enabled.find((candidate) => !selected.has(candidate.id) && matches(candidate));
    if (agent) selected.add(agent.id);
    return agent?.id;
  };

  const judge = take((agent) => agent.canJudge && /judge/i.test(agent.name))
    ?? take((agent) => agent.canJudge);
  const implementer = take((agent) => /implementer/i.test(agent.name));
  const namedWorkerA = take((agent) => /worker[ _-]a\b/i.test(agent.name));
  const namedWorkerB = take((agent) => /worker[ _-]b\b/i.test(agent.name));

  return {
    workerA: namedWorkerA ?? take(() => true),
    workerB: namedWorkerB ?? take(() => true),
    judge,
    implementer,
  };
}

function unverifiedRootStatus(rootPath: string): WorkspaceRootStatus {
  return {
    rootPath,
    resolvedPath: null,
    exists: false,
    isDirectory: false,
    valid: false,
    error: "Unable to verify the project directory.",
  };
}

function readRunPathMetadata(run?: AgentRun): RunPathMetadata {
  if (!run?.metadata || typeof run.metadata !== "object") {
    return {};
  }

  const metadata = run.metadata as Record<string, unknown>;
  return {
    role: typeof metadata.role === "string" ? metadata.role : undefined,
    sourceDir: typeof metadata.sourceDir === "string" ? metadata.sourceDir : undefined,
    workingDir: typeof metadata.workingDir === "string" ? metadata.workingDir : undefined,
    runRootDir: typeof metadata.runRootDir === "string" ? metadata.runRootDir : undefined,
    publishDir: typeof metadata.publishDir === "string" ? metadata.publishDir : undefined,
    publishSource: typeof metadata.publishSource === "string" ? metadata.publishSource : undefined,
    artifactPaths: Array.isArray(metadata.artifactPaths)
      ? metadata.artifactPaths.filter((value): value is string => typeof value === "string")
      : undefined,
  };
}

function deriveCurrentTaskPaths(
  workspaceDetail: WorkspaceDetail | undefined,
  activeSession: SessionReplay | undefined,
  liveOutputs: Record<string, LiveRunState>,
  roles: HiveAgentRoles,
): CurrentTaskPaths | undefined {
  if (!workspaceDetail) {
    return undefined;
  }

  const latestTask = activeSession?.tasks.at(-1);
  const sourceRuns = latestTask?.runs?.length
    ? latestTask.runs
    : Object.values(liveOutputs).map((entry) => entry.run);

  if (sourceRuns.length === 0) {
    return {
      rootPath: workspaceDetail.workspace.rootPath,
    };
  }

  const byAgentId = new Map(sourceRuns.map((run) => [run.agentId, run]));
  const workerAMeta = readRunPathMetadata(byAgentId.get(roles.workerA ?? ""));
  const workerBMeta = readRunPathMetadata(byAgentId.get(roles.workerB ?? ""));
  const judgeMeta = readRunPathMetadata(byAgentId.get(roles.judge ?? ""));
  const implementerMeta = readRunPathMetadata(byAgentId.get(roles.implementer ?? ""));
  const anyMeta = [workerAMeta, workerBMeta, judgeMeta, implementerMeta].find(
    (metadata) => metadata.runRootDir || metadata.publishDir || metadata.sourceDir,
  );

  return {
    rootPath: workspaceDetail.workspace.rootPath,
    sourceDir: anyMeta?.sourceDir,
    runRootDir: anyMeta?.runRootDir,
    publishDir: anyMeta?.publishDir,
    publishSource: implementerMeta.publishSource ?? anyMeta?.publishSource,
    artifactPaths: judgeMeta.artifactPaths ?? implementerMeta.artifactPaths ?? anyMeta?.artifactPaths,
    workerAPath: workerAMeta.workingDir,
    workerBPath: workerBMeta.workingDir,
    judgePath: judgeMeta.workingDir,
    implementerPath: implementerMeta.workingDir,
  };
}

interface AppState {
  runtimeReady: boolean;
  bootError?: string;
  runningTask: boolean;
  streamingTaskId?: string;
  workspaces: Workspace[];
  workspaceDetail?: WorkspaceDetail;
  workspaceRootStatus?: WorkspaceRootStatus;
  workspaceError?: string;
  currentTaskPaths?: CurrentTaskPaths;
  sessions: SessionSnapshot[];
  activeSession?: SessionReplay;
  runOutputs: Record<string, LiveRunState>;
  events: AgentEvent[];
  roles: HiveAgentRoles;
  connectionState: "idle" | "connecting" | "open" | "closed";

  boot: () => Promise<void>;
  loadWorkspace: (workspaceId: string) => Promise<void>;
  loadSession: (sessionId: string, taskId?: string) => Promise<void>;
  refreshSessions: (workspaceId: string) => Promise<void>;
  refreshWorkspaceRootStatus: (workspaceId?: string) => Promise<void>;
  updateWorkspaceRoot: (rootPath: string) => Promise<void>;
  clearWorkspaceError: () => void;
  pushEvent: (event: AgentEvent) => void;
  runHiveTask: (prompt: string) => Promise<void>;
  ensureCodexWorkspace: () => Promise<void>;
}

let socket: WebSocket | null = null;
let pendingConnection = false;
let retryTimer: ReturnType<typeof setTimeout> | undefined;
let retryDelay = 1_000;
let pendingBoot: Promise<void> | undefined;

function connectWebsocket(
  pushEvent: (event: AgentEvent) => void,
  setConnection: (state: AppState["connectionState"]) => void,
) {
  if (pendingConnection || socket) return;

  clearTimeout(retryTimer);
  pendingConnection = true;
  setConnection("connecting");
  const retry = () => {
    socket = null;
    setConnection("closed");
    retryTimer = setTimeout(() => connectWebsocket(pushEvent, setConnection), retryDelay);
    retryDelay = Math.min(retryDelay * 2, 10_000);
  };

  void getRuntimeConfig().then((runtime) => {
    const nextSocket = new WebSocket(runtime.websocketUrl);
    socket = nextSocket;
    nextSocket.addEventListener("open", () => {
      retryDelay = 1_000;
      setConnection("open");
    });
    nextSocket.addEventListener("close", retry, { once: true });
    nextSocket.addEventListener("message", (message) => {
      try {
        const payload = JSON.parse(message.data) as { kind: string; data: AgentEvent };
        if (payload.kind === "agent-event") pushEvent(payload.data);
      } catch {
        // Ignore malformed messages and continue receiving the live stream.
      }
    });
  }).catch(retry).finally(() => {
    pendingConnection = false;
  });
}

const TRANSCRIPT_LIMIT = 160_000;

function appendOutput(output: string, chunk: string) {
  return (output + chunk).slice(-TRANSCRIPT_LIMIT);
}

export const useAppStore = create<AppState>((set, get) => ({
  runtimeReady: false,
  runningTask: false,
  workspaces: [],
  sessions: [],
  runOutputs: {},
  events: [],
  roles: {},
  connectionState: "idle",

  boot: () => {
    if (pendingBoot) return pendingBoot;

    set({ bootError: undefined });
    pendingBoot = (async () => {
      const workspaces = await api.listWorkspaces();
      set({ workspaces });

      const initialWorkspace = pickInitialWorkspace(workspaces);
      if (initialWorkspace) {
        await get().loadWorkspace(initialWorkspace.id);
      } else {
        await get().ensureCodexWorkspace();
      }

      connectWebsocket(
        (event) => get().pushEvent(event),
        (connectionState) => set({ connectionState }),
      );
      set({ runtimeReady: true });
    })().catch((error: unknown) => {
      const detail = error instanceof Error ? error.message : "Unknown error.";
      set({ bootError: `Start the local orchestrator with pnpm start and try again. ${detail}` });
    }).finally(() => {
      pendingBoot = undefined;
    });

    return pendingBoot;
  },

  ensureCodexWorkspace: async () => {
    const workspace = await api.createWorkspace({
      name: "HiveCLI Workspace",
      rootPath: ".",
    });

    const agentConfigs = [
      { name: "Worker A", canJudge: false },
      { name: "Worker B", canJudge: false },
      { name: "Judge", canJudge: true },
      { name: "Implementer", canJudge: false },
    ];

    for (const config of agentConfigs) {
      await api.createAgent({
        workspaceId: workspace.id,
        name: config.name,
        type: "cli",
        provider: "codex",
        command: "codex",
        args: [...CODEX_CLI_ARGS],
        cwd: null,
        env: {},
        enabled: true,
        canJudge: config.canJudge,
        shellAccess: true,
        model: null,
      });
    }

    await get().loadWorkspace(workspace.id);
  },

  loadWorkspace: async (workspaceId) => {
    const [workspaceDetail, sessions] = await Promise.all([
      api.getWorkspace(workspaceId),
      api.listSessions(workspaceId),
    ]);

    for (const agent of workspaceDetail.agents) {
      if (shouldMigrateCodexAgentArgs(agent.provider, agent.args)) {
        const nextArgs = [...CODEX_CLI_ARGS];
        await api.updateAgent(agent.id, { args: nextArgs });
        agent.args = nextArgs;
      }
    }

    const roles = assignRoles(workspaceDetail.agents);

    let workspaceRootStatus = unverifiedRootStatus(workspaceDetail.workspace.rootPath);
    try {
      workspaceRootStatus = await api.getWorkspaceRootStatus(workspaceId);
    } catch {
      workspaceRootStatus = unverifiedRootStatus(workspaceDetail.workspace.rootPath);
    }

    const nextTaskPaths = deriveCurrentTaskPaths(
      workspaceDetail,
      get().activeSession,
      get().runOutputs,
      roles,
    );

    set({
      workspaceDetail,
      sessions,
      roles,
      workspaceRootStatus,
      currentTaskPaths: nextTaskPaths,
      workspaceError: undefined,
      workspaces: [
        ...get().workspaces.filter((workspace) => workspace.id !== workspaceId),
        workspaceDetail.workspace,
      ],
    });
  },

  refreshSessions: async (workspaceId) => {
    set({ sessions: await api.listSessions(workspaceId) });
  },

  refreshWorkspaceRootStatus: async (workspaceId) => {
    const targetWorkspaceId = workspaceId ?? get().workspaceDetail?.workspace.id;
    if (!targetWorkspaceId) {
      return;
    }

    try {
      const workspaceRootStatus = await api.getWorkspaceRootStatus(targetWorkspaceId);
      set({ workspaceRootStatus });
    } catch {
      const rootPath = get().workspaceDetail?.workspace.rootPath ?? "";
      set({ workspaceRootStatus: unverifiedRootStatus(rootPath) });
    }
  },

  updateWorkspaceRoot: async (rootPath) => {
    const workspaceDetail = get().workspaceDetail;
    if (!workspaceDetail) {
      return;
    }

    const updatedWorkspace = await api.updateWorkspace(workspaceDetail.workspace.id, { rootPath });
    set((state) => ({
      workspaces: state.workspaces.map((workspace) =>
        workspace.id === updatedWorkspace.id ? updatedWorkspace : workspace,
      ),
      workspaceDetail: state.workspaceDetail
        ? {
            ...state.workspaceDetail,
            workspace: {
              ...state.workspaceDetail.workspace,
              rootPath: updatedWorkspace.rootPath,
              updatedAt: updatedWorkspace.updatedAt,
            },
          }
        : state.workspaceDetail,
    }));

    await get().refreshWorkspaceRootStatus(updatedWorkspace.id);

    set({
      currentTaskPaths: deriveCurrentTaskPaths(
        get().workspaceDetail,
        get().activeSession,
        get().runOutputs,
        get().roles,
      ),
      workspaceError: undefined,
    });
  },

  clearWorkspaceError: () => {
    set({ workspaceError: undefined });
  },

  loadSession: async (sessionId, taskId) => {
    const activeSession = await api.getSession(sessionId);
    const task = taskId
      ? activeSession.tasks.find(({ task }) => task.id === taskId)
      : activeSession.tasks.at(-1);
    const transcriptByRun = new Map<string, string>();
    for (const event of activeSession.events) {
      if (event.taskId === task?.task.id && ["stdout", "stderr", "message"].includes(event.type)) {
        transcriptByRun.set(event.agentRunId, appendOutput(transcriptByRun.get(event.agentRunId) ?? "", event.payload));
      }
    }
    const runOutputs = Object.fromEntries(
      (task?.runs ?? []).map((run) => [run.id, { run, output: transcriptByRun.get(run.id) || run.finalText || "" }]),
    );

    set({
      activeSession,
      runOutputs,
      events: activeSession.events.slice(-400).reverse(),
      currentTaskPaths: deriveCurrentTaskPaths(get().workspaceDetail, activeSession, runOutputs, get().roles),
    });
  },

  runHiveTask: async (prompt) => {
    const { workspaceDetail, roles, workspaceRootStatus, runningTask, connectionState } = get();
    if (runningTask || !workspaceDetail || !prompt.trim()) return;

    if (!workspaceRootStatus?.valid || connectionState !== "open") {
      throw new Error("Connect the orchestrator and choose a valid project directory before running a task.");
    }

    const { workerA, workerB, judge, implementer } = roles;
    if (!workerA || !workerB || !judge || !implementer) {
      throw new Error("Configure agents for all four council roles before starting a run.");
    }

    set({
      runningTask: true,
      streamingTaskId: undefined,
      activeSession: undefined,
      runOutputs: {},
      events: [],
      workspaceError: undefined,
      currentTaskPaths: { rootPath: workspaceDetail.workspace.rootPath },
    });

    let submitted = false;
    try {
      const response = await api.runTask({
        workspaceId: workspaceDetail.workspace.id,
        prompt: prompt.trim(),
        mode: "council",
        agentIds: [workerA, workerB, judge, implementer],
        judgeAgentId: judge,
      });

      submitted = true;
      await Promise.all([get().refreshSessions(workspaceDetail.workspace.id), get().loadSession(response.sessionId, response.taskId)]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error.";
      set({
        workspaceError: submitted
          ? `The run ended, but its saved results could not be refreshed. ${message}`
          : message,
      });
      if (!submitted) throw error;
    } finally {
      set({ runningTask: false, streamingTaskId: undefined });
    }
  },

  pushEvent: (event) => {
    const { runningTask, streamingTaskId, roles } = get();
    if (!runningTask || !Object.values(roles).includes(event.agentId)) return;
    if (streamingTaskId && streamingTaskId !== event.taskId) return;

    const current = get().runOutputs[event.agentRunId] ?? {
      run: {
        id: event.agentRunId,
        sessionId: event.sessionId,
        taskId: event.taskId,
        agentId: event.agentId,
        status: "running" as const,
      },
      output: "",
    };

    const nextRun = { ...current.run };
    let nextOutput = current.output;

    if (event.type === "status") {
      nextRun.status = event.payload as AgentRun["status"];
    }
    if (event.type === "stdout" || event.type === "stderr" || event.type === "message") {
      nextOutput = appendOutput(nextOutput, event.payload);
    }
    if (event.type === "final") {
      nextRun.finalText = event.payload;
    }
    if (event.type === "error") {
      nextRun.errorText = event.payload;
    }
    if (event.type === "exit") {
      const exitCode = event.payload.length ? Number(event.payload) : Number.NaN;
      nextRun.exitCode = Number.isFinite(exitCode) ? exitCode : null;
      nextRun.finishedAt = new Date().toISOString();
    }

    set((state) => {
      const nextRunOutputs = {
        ...state.runOutputs,
        [event.agentRunId]: {
          run: nextRun,
          output: nextOutput,
        },
      };

      return {
        streamingTaskId: event.taskId,
        events: [event, ...state.events].slice(0, 400),
        runOutputs: nextRunOutputs,
        currentTaskPaths: deriveCurrentTaskPaths(
          state.workspaceDetail,
          state.activeSession,
          nextRunOutputs,
          state.roles,
        ),
      };
    });
  },
}));

export { BUILTIN_AGENT_TEMPLATES };
