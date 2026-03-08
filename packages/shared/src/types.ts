import type {
  AGENT_EVENT_TYPES,
  AGENT_RUN_STATES,
  AGENT_TYPES,
  BUILTIN_AGENT_TEMPLATES,
  TASK_MODES,
} from "./constants";

export type AgentType = (typeof AGENT_TYPES)[number];
export type TaskMode = (typeof TASK_MODES)[number];
export type AgentEventType = (typeof AGENT_EVENT_TYPES)[number];
export type AgentRunState = (typeof AGENT_RUN_STATES)[number];
export type AgentRole = "worker" | "judge" | "implementer";

export interface Workspace {
  id: string;
  name: string;
  rootPath: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceRootStatus {
  rootPath: string;
  resolvedPath: string | null;
  exists: boolean;
  isDirectory: boolean;
  valid: boolean;
  error?: string | null;
}

export interface AgentDefinition {
  id: string;
  workspaceId: string;
  name: string;
  type: AgentType;
  provider: string;
  model?: string | null;
  command?: string | null;
  args?: string[];
  cwd?: string | null;
  env?: Record<string, string>;
  enabled: boolean;
  canJudge: boolean;
  shellAccess: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Session {
  id: string;
  workspaceId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  sessionId: string;
  prompt: string;
  mode: TaskMode;
  createdAt: string;
}

export interface AgentRun {
  id: string;
  sessionId: string;
  taskId: string;
  agentId: string;
  status: AgentRunState;
  startedAt?: string | null;
  finishedAt?: string | null;
  exitCode?: number | null;
  finalText?: string | null;
  errorText?: string | null;
  metadata?: AgentRunMetadata;
}

export interface AgentRunRequest {
  sessionId: string;
  taskId: string;
  agentId: string;
  prompt: string;
  role: AgentRole;
  context?: string;
  workspaceRoot: string;
  sourceDir?: string;
  workingDir?: string;
  runRootDir?: string;
  publishDir?: string;
  artifactPaths?: string[];
}

export interface AgentRunMetadata {
  role?: AgentRole;
  workspaceRoot?: string;
  runRootDir?: string;
  sourceDir?: string;
  workingDir?: string;
  publishDir?: string;
  publishSource?: string | null;
  artifactPaths?: string[];
  warnings?: string[];
}

export interface AgentEvent {
  id: string;
  sessionId: string;
  taskId: string;
  agentRunId: string;
  agentId: string;
  type: AgentEventType;
  payload: string;
  sequence: number;
  timestamp: string;
}

export interface Message {
  id: string;
  sessionId: string;
  taskId: string;
  agentRunId: string;
  agentId: string;
  role: "user" | "assistant" | "system" | "judge";
  content: string;
  isFinal: boolean;
  createdAt: string;
}

export interface TaskRunSummary {
  task: Task;
  runs: AgentRun[];
}

export interface SessionReplay {
  session: Session;
  tasks: TaskRunSummary[];
  messages: Message[];
  events: AgentEvent[];
}

export interface AppSettings {
  id: string;
  key: string;
  value: string;
  createdAt: string;
  updatedAt: string;
}

export type BuiltinAgentTemplate = (typeof BUILTIN_AGENT_TEMPLATES)[number];

export interface WorkspaceDetail {
  workspace: Workspace;
  agents: AgentDefinition[];
  sessions: Session[];
}

export interface RunTaskInput {
  workspaceId: string;
  sessionId?: string;
  prompt: string;
  mode: TaskMode;
  agentIds: string[];
  judgeAgentId?: string | null;
  context?: string;
}

export interface SessionSnapshot {
  session: Session;
  latestTask?: TaskRunSummary;
}
