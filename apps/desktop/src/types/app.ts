import type {
  AgentEvent,
  AgentRun,
  AppSettings,
  CouncilSummary,
  Message,
  Session,
  SessionReplay,
  Task,
  Workspace,
  WorkspaceDetail,
} from "@hive/shared";

export interface BootstrapPayload {
  settings: AppSettings;
  workspaces: Workspace[];
  agentTemplates: Array<{
    id: string;
    name: string;
    provider: string;
    description: string;
    command: string;
    args: string[];
    type: string;
  }>;
}

export type RealtimePayload =
  | { kind: "event"; data: AgentEvent }
  | { kind: "run"; data: AgentRun }
  | { kind: "message"; data: Message }
  | { kind: "summary"; data: CouncilSummary }
  | { kind: "task"; data: Task };

export interface AppStateShape {
  settings?: AppSettings;
  workspaces: Workspace[];
  agentTemplates: BootstrapPayload["agentTemplates"];
  activeWorkspace?: WorkspaceDetail;
  sessions: Session[];
  activeSession?: Session;
  activeReplay?: SessionReplay;
  loading: boolean;
  error?: string;
}
