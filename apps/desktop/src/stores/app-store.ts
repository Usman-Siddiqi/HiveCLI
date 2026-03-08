import {
  BUILTIN_AGENT_TEMPLATES,
  CODEX_CLI_ARGS,
  shouldMigrateCodexCliArgs,
  type AgentEvent,
  type AgentRun,
  type SessionReplay,
  type SessionSnapshot,
  type Workspace,
  type WorkspaceDetail,
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
  const find = (hints: string[]) =>
    agents.find((agent) => hints.some((hint) => agent.name.toLowerCase().includes(hint)))?.id;

  const workerA = find(["worker a", "worker-a", "worker_a"]) ?? agents[0]?.id;
  const workerB = find(["worker b", "worker-b", "worker_b"]) ?? agents[1]?.id;
  const judge = find(["judge"]) ?? agents.find((agent) => agent.canJudge)?.id ?? agents[2]?.id;
  const implementer = find(["implementer", "implement"]) ?? agents[3]?.id;

  return { workerA, workerB, judge, implementer };
}

function optimisticRootStatus(rootPath: string): WorkspaceRootStatus {
  const hasPath = rootPath.trim().length > 0;
  return {
    rootPath,
    resolvedPath: hasPath ? rootPath : null,
    exists: hasPath,
    isDirectory: hasPath,
    valid: hasPath,
    error: null,
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
  loadSession: (sessionId: string) => Promise<void>;
  refreshSessions: (workspaceId: string) => Promise<void>;
  refreshWorkspaceRootStatus: (workspaceId?: string) => Promise<void>;
  updateWorkspaceRoot: (rootPath: string) => Promise<void>;
  clearWorkspaceError: () => void;
  pushEvent: (event: AgentEvent) => void;
  runHiveTask: (prompt: string) => Promise<void>;
  ensureCodexWorkspace: () => Promise<void>;
}

let socket: WebSocket | null = null;

function connectWebsocket(
  pushEvent: (event: AgentEvent) => void,
  setConnection: (state: AppState["connectionState"]) => void,
) {
  if (socket && (socket.readyState === WebSocket.CONNECTING || socket.readyState === WebSocket.OPEN)) {
    return;
  }

  setConnection("connecting");
  void getRuntimeConfig().then((runtime) => {
    socket = new WebSocket(runtime.websocketUrl);
    socket.addEventListener("open", () => setConnection("open"));
    socket.addEventListener("close", () => setConnection("closed"));
    socket.addEventListener("message", (message) => {
      const payload = JSON.parse(message.data) as { kind: string; data: AgentEvent };
      if (payload.kind === "agent-event") {
        pushEvent(payload.data);
      }
    });
  });
}

export const useAppStore = create<AppState>((set, get) => ({
  runtimeReady: false,
  workspaces: [],
  sessions: [],
  runOutputs: {},
  events: [],
  roles: {},
  connectionState: "idle",

  boot: async () => {
    const workspaces = await api.listWorkspaces();
    set({ workspaces, runtimeReady: true });

    connectWebsocket(
      (event) => get().pushEvent(event),
      (connectionState) => set({ connectionState }),
    );

    const initialWorkspace = pickInitialWorkspace(workspaces);

    if (initialWorkspace) {
      await get().loadWorkspace(initialWorkspace.id);
    } else {
      await get().ensureCodexWorkspace();
    }
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

    let workspaceRootStatus = optimisticRootStatus(workspaceDetail.workspace.rootPath);
    try {
      workspaceRootStatus = await api.getWorkspaceRootStatus(workspaceId);
    } catch {
      workspaceRootStatus = optimisticRootStatus(workspaceDetail.workspace.rootPath);
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
      workspaces: get().workspaces.map((workspace) =>
        workspace.id === workspaceDetail.workspace.id ? workspaceDetail.workspace : workspace,
      ),
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
      set({ workspaceRootStatus: optimisticRootStatus(rootPath) });
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

  loadSession: async (sessionId) => {
    const activeSession = await api.getSession(sessionId);
    const runOutputs = Object.fromEntries(
      activeSession.tasks.flatMap((taskRun) =>
        taskRun.runs.map((run) => [run.id, { run, output: run.finalText ?? "" }]),
      ),
    );

    set({
      activeSession,
      runOutputs,
      events: activeSession.events,
      currentTaskPaths: deriveCurrentTaskPaths(
        get().workspaceDetail,
        activeSession,
        runOutputs,
        get().roles,
      ),
    });
  },

  runHiveTask: async (prompt) => {
    const {
      workspaceDetail,
      activeSession,
      roles,
      refreshSessions,
      loadSession,
      workspaceRootStatus,
    } = get();

    if (!workspaceDetail) {
      return;
    }

    if (!workspaceRootStatus?.valid) {
      set({ workspaceError: "Select a valid project directory before running a task." });
      return;
    }

    const allAgentIds = [roles.workerA, roles.workerB, roles.judge, roles.implementer].filter(Boolean) as string[];

    set({
      runOutputs: {},
      events: [],
      workspaceError: undefined,
      currentTaskPaths: {
        rootPath: workspaceDetail.workspace.rootPath,
      },
    });

    try {
      const response = await api.runTask({
        workspaceId: workspaceDetail.workspace.id,
        sessionId: activeSession?.session.id,
        prompt,
        mode: "council",
        agentIds: allAgentIds,
        judgeAgentId: roles.judge ?? null,
      });

      await refreshSessions(workspaceDetail.workspace.id);
      await loadSession(response.sessionId);
    } catch (error) {
      set({
        workspaceError:
          error instanceof Error ? error.message : "Task run failed before the agents could start.",
      });
      throw error;
    }
  },

  pushEvent: (event) => {
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
      nextOutput += event.payload;
    }
    if (event.type === "final") {
      nextRun.finalText = event.payload;
      nextRun.status = "completed";
      nextOutput = event.payload;
    }
    if (event.type === "error") {
      nextRun.errorText = event.payload;
      nextRun.status = "failed";
    }
    if (event.type === "exit") {
      const exitCode = Number(event.payload);
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
