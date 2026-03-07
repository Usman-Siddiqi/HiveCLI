import { z } from "zod";

import {
  AGENT_TYPES,
  BUILT_IN_AGENT_TEMPLATES,
  EVENT_TYPES,
  RUN_STATUSES,
  TASK_MODES,
} from "../constants/index.js";

export const IsoDateSchema = z.string().datetime();
export const JsonRecordSchema = z.record(z.string(), z.string());

export const AgentTypeSchema = z.enum(AGENT_TYPES);
export const EventTypeSchema = z.enum(EVENT_TYPES);
export const TaskModeSchema = z.enum(TASK_MODES);
export const RunStatusSchema = z.enum(RUN_STATUSES);

export const WorkspaceSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  rootPath: z.string().min(1),
  createdAt: IsoDateSchema,
  updatedAt: IsoDateSchema,
});

export const AgentDefinitionSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  name: z.string().min(1),
  type: AgentTypeSchema,
  provider: z.string().min(1),
  model: z.string().optional(),
  command: z.string().optional(),
  args: z.array(z.string()).default([]),
  cwd: z.string().optional(),
  env: JsonRecordSchema.default({}),
  enabled: z.boolean().default(true),
  canJudge: z.boolean().default(false),
  createdAt: IsoDateSchema,
  updatedAt: IsoDateSchema,
});

export const SessionSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  title: z.string().min(1),
  createdAt: IsoDateSchema,
  updatedAt: IsoDateSchema,
});

export const TaskSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  prompt: z.string().min(1),
  mode: TaskModeSchema,
  judgeAgentId: z.string().nullable().optional(),
  createdAt: IsoDateSchema,
});

export const AgentRunSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  taskId: z.string(),
  agentId: z.string(),
  status: RunStatusSchema,
  command: z.string().nullable().optional(),
  exitCode: z.number().nullable().optional(),
  startedAt: IsoDateSchema.nullable().optional(),
  finishedAt: IsoDateSchema.nullable().optional(),
  finalText: z.string().default(""),
  errorText: z.string().optional(),
});

export const AgentRunRequestSchema = z.object({
  sessionId: z.string(),
  taskId: z.string(),
  agentId: z.string(),
  prompt: z.string().min(1),
  context: z.string().optional(),
  workspaceRoot: z.string().min(1),
});

export const AgentEventSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  taskId: z.string(),
  agentRunId: z.string(),
  agentId: z.string(),
  type: EventTypeSchema,
  payload: z.string(),
  sequence: z.number().int().nonnegative(),
  timestamp: IsoDateSchema,
});

export const MessageSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  taskId: z.string(),
  agentId: z.string(),
  role: z.enum(["user", "assistant", "judge", "system"]),
  content: z.string(),
  isFinal: z.boolean().default(false),
  createdAt: IsoDateSchema,
});

export const AppSettingsSchema = z.object({
  id: z.string(),
  orchestratorUrl: z.string().url(),
  theme: z.enum(["dark", "system"]).default("dark"),
  storagePath: z.string().optional(),
  defaultWorkspacePath: z.string().optional(),
  createdAt: IsoDateSchema,
  updatedAt: IsoDateSchema,
});

export const CouncilSummarySchema = z.object({
  taskId: z.string(),
  sessionId: z.string(),
  judgeAgentId: z.string(),
  summary: z.string(),
  sourceAgentIds: z.array(z.string()),
  createdAt: IsoDateSchema,
});

export const SessionReplaySchema = z.object({
  session: SessionSchema,
  tasks: z.array(TaskSchema),
  runs: z.array(AgentRunSchema),
  messages: z.array(MessageSchema),
  events: z.array(AgentEventSchema),
  councilSummaries: z.array(CouncilSummarySchema),
});

export const WorkspaceDetailSchema = z.object({
  workspace: WorkspaceSchema,
  agents: z.array(AgentDefinitionSchema),
  recentSessions: z.array(SessionSchema),
});

export const AgentTemplateSchema = z.enum(
  BUILT_IN_AGENT_TEMPLATES.map((template) => template.id) as [string, ...string[]],
);

export const CreateWorkspaceInputSchema = z.object({
  name: z.string().min(1),
  rootPath: z.string().min(1),
});

export const SaveAgentInputSchema = AgentDefinitionSchema.pick({
  workspaceId: true,
  name: true,
  type: true,
  provider: true,
  model: true,
  command: true,
  args: true,
  cwd: true,
  env: true,
  enabled: true,
  canJudge: true,
}).extend({
  id: z.string().optional(),
});

export const CreateSessionInputSchema = z.object({
  workspaceId: z.string(),
  title: z.string().min(1),
});

export const StartTaskInputSchema = z.object({
  sessionId: z.string(),
  prompt: z.string().min(1),
  mode: TaskModeSchema,
  agentIds: z.array(z.string()).min(1),
  judgeAgentId: z.string().nullable().optional(),
});

export const ApiEnvelopeSchema = <T extends z.ZodTypeAny>(schema: T) =>
  z.object({
    data: schema,
  });
