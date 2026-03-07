import {
  BUILTIN_AGENT_TEMPLATES,
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

interface LiveRunState {
  run: AgentRun;
  output: string;
}

interface AppState {
  runtimeReady: boolean;
  workspaces: Workspace[];
  workspaceDetail?: WorkspaceDetail;
  sessions: SessionSnapshot[];
  activeSession?: SessionReplay;
  runOutputs: Record<string, LiveRunState>;
  events: AgentEvent[];
  selectedAgentIds: string[];
  judgeAgentId?: string | null;
  connectionState: "idle" | "connecting" | "open" | "closed";
  boot: () => Promise<void>;
  loadWorkspace: (workspaceId: string) => Promise<void>;
  loadSession: (sessionId: string) => Promise<void>;
  selectAgents: (agentIds: string[]) => void;
  setJudgeAgentId: (agentId?: string | null) => void;
  refreshSessions: (workspaceId: string) => Promise<void>;
  pushEvent: (event: AgentEvent) => void;
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
  selectedAgentIds: [],
  judgeAgentId: null,
  connectionState: "idle",
  boot: async () => {
    const workspaces = await api.listWorkspaces();
    set({ workspaces, runtimeReady: true });

    connectWebsocket(
      (event) => get().pushEvent(event),
      (connectionState) => set({ connectionState }),
    );

    if (workspaces[0]) {
      await get().loadWorkspace(workspaces[0].id);
    }
  },
  loadWorkspace: async (workspaceId) => {
    const [workspaceDetail, sessions] = await Promise.all([
      api.getWorkspace(workspaceId),
      api.listSessions(workspaceId),
    ]);

    set({
      workspaceDetail,
      sessions,
      selectedAgentIds: workspaceDetail.agents
        .filter((agent) => agent.enabled)
        .slice(0, 4)
        .map((agent) => agent.id),
      judgeAgentId: workspaceDetail.agents.find((agent) => agent.canJudge)?.id ?? null,
    });
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
  selectAgents: (selectedAgentIds) => set({ selectedAgentIds }),
  setJudgeAgentId: (judgeAgentId) => set({ judgeAgentId }),
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
