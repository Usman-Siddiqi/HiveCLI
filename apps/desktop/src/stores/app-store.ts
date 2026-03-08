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

import { api } from "@/lib/api";
import { getRuntimeConfig } from "@/lib/runtime";

/* ─── Types ─── */

interface LiveRunState {
  run: AgentRun;
  output: string;
}

/** Well-known agent roles in the 4-panel layout. */
export interface HiveAgentRoles {
  workerA?: string; // agent id
  workerB?: string;
  judge?: string;
  implementer?: string;
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

interface AppState {
  runtimeReady: boolean;
  workspaces: Workspace[];
  workspaceDetail?: WorkspaceDetail;
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
  pushEvent: (event: AgentEvent) => void;
  runHiveTask: (prompt: string) => Promise<void>;
  ensureCodexWorkspace: () => Promise<void>;
}

/* ─── WebSocket ─── */

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

/* ─── Helpers ─── */

function assignRoles(agents: WorkspaceDetail["agents"]): HiveAgentRoles {
  // Try to match by name convention, otherwise fall back to order
  const find = (hints: string[]) =>
    agents.find((a) => hints.some((h) => a.name.toLowerCase().includes(h)))?.id;

  const workerA = find(["worker a", "worker-a", "worker_a"]) ?? agents[0]?.id;
  const workerB = find(["worker b", "worker-b", "worker_b"]) ?? agents[1]?.id;
  const judge = find(["judge"]) ?? agents.find((a) => a.canJudge)?.id ?? agents[2]?.id;
  const implementer = find(["implementer", "implement"]) ?? agents[3]?.id;

  return { workerA, workerB, judge, implementer };
}

/* ─── Store ─── */

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

    // Patch existing codex agents that still use the retired CLI invocation.
    for (const agent of workspaceDetail.agents) {
      if (shouldMigrateCodexAgentArgs(agent.provider, agent.args)) {
        const nextArgs = [...CODEX_CLI_ARGS];
        await api.updateAgent(agent.id, { args: nextArgs });
        agent.args = nextArgs;
      }
    }

    const roles = assignRoles(workspaceDetail.agents);

    set({ workspaceDetail, sessions, roles });
  },

  refreshSessions: async (workspaceId) => {
    set({ sessions: await api.listSessions(workspaceId) });
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
    });
  },

  runHiveTask: async (prompt) => {
    const { workspaceDetail, activeSession, roles, refreshSessions, loadSession } = get();
    if (!workspaceDetail) return;

    const allAgentIds = [roles.workerA, roles.workerB, roles.judge, roles.implementer].filter(Boolean) as string[];

    // Clear previous outputs at the start of a new run
    set({ runOutputs: {}, events: [] });

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

    set((state) => ({
      events: [event, ...state.events].slice(0, 400),
      runOutputs: {
        ...state.runOutputs,
        [event.agentRunId]: {
          run: nextRun,
          output: nextOutput,
        },
      },
    }));
  },
}));

export { BUILTIN_AGENT_TEMPLATES };
