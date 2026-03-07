import { z } from "zod";

import {
  AGENT_EVENT_TYPES,
  AGENT_RUN_STATES,
  AGENT_TYPES,
  TASK_MODES,
} from "./constants";

export const workspaceSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  rootPath: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const createWorkspaceSchema = workspaceSchema.pick({
  name: true,
  rootPath: true,
});

export const agentDefinitionSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  name: z.string().min(1),
  type: z.enum(AGENT_TYPES),
  provider: z.string().min(1),
  model: z.string().nullable().optional(),
  command: z.string().nullable().optional(),
  args: z.array(z.string()).default([]),
  cwd: z.string().nullable().optional(),
  env: z.record(z.string(), z.string()).default({}),
  enabled: z.boolean().default(true),
  canJudge: z.boolean().default(false),
  shellAccess: z.boolean().default(false),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const createAgentSchema = agentDefinitionSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const sessionSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  title: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const taskSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  prompt: z.string().min(1),
  mode: z.enum(TASK_MODES),
  createdAt: z.string(),
});

export const agentRunSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  taskId: z.string(),
  agentId: z.string(),
  status: z.enum(AGENT_RUN_STATES),
  startedAt: z.string().nullable().optional(),
  finishedAt: z.string().nullable().optional(),
  exitCode: z.number().int().nullable().optional(),
  finalText: z.string().nullable().optional(),
  errorText: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const agentRunRequestSchema = z.object({
  sessionId: z.string(),
  taskId: z.string(),
  agentId: z.string(),
  prompt: z.string().min(1),
  context: z.string().optional(),
  workspaceRoot: z.string().min(1),
});

export const agentEventSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  taskId: z.string(),
  agentRunId: z.string(),
  agentId: z.string(),
  type: z.enum(AGENT_EVENT_TYPES),
  payload: z.string(),
  sequence: z.number().int().nonnegative(),
  timestamp: z.string(),
});

export const messageSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  taskId: z.string(),
  agentRunId: z.string(),
  agentId: z.string(),
  role: z.enum(["user", "assistant", "system", "judge"]),
  content: z.string(),
  isFinal: z.boolean(),
  createdAt: z.string(),
});

export const runTaskInputSchema = z.object({
  workspaceId: z.string(),
  sessionId: z.string().optional(),
  prompt: z.string().min(1),
  mode: z.enum(TASK_MODES),
  agentIds: z.array(z.string()).min(1),
  judgeAgentId: z.string().nullable().optional(),
  context: z.string().optional(),
});

export const appSettingsSchema = z.object({
  id: z.string(),
  key: z.string().min(1),
  value: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const sessionReplaySchema = z.object({
  session: sessionSchema,
  tasks: z.array(
    z.object({
      task: taskSchema,
      runs: z.array(agentRunSchema),
    }),
  ),
  messages: z.array(messageSchema),
  events: z.array(agentEventSchema),
});
