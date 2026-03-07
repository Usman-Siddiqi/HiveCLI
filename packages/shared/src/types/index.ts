import type { z } from "zod";

import {
  AgentDefinitionSchema,
  AgentEventSchema,
  AgentRunRequestSchema,
  AgentRunSchema,
  AppSettingsSchema,
  CouncilSummarySchema,
  CreateSessionInputSchema,
  CreateWorkspaceInputSchema,
  MessageSchema,
  SaveAgentInputSchema,
  SessionReplaySchema,
  SessionSchema,
  StartTaskInputSchema,
  TaskSchema,
  WorkspaceDetailSchema,
  WorkspaceSchema,
} from "../schemas/index.js";
import type { BUILT_IN_AGENT_TEMPLATES } from "../constants/index.js";

export type Workspace = z.infer<typeof WorkspaceSchema>;
export type AgentDefinition = z.infer<typeof AgentDefinitionSchema>;
export type Session = z.infer<typeof SessionSchema>;
export type Task = z.infer<typeof TaskSchema>;
export type AgentRun = z.infer<typeof AgentRunSchema>;
export type AgentRunRequest = z.infer<typeof AgentRunRequestSchema>;
export type AgentEvent = z.infer<typeof AgentEventSchema>;
export type Message = z.infer<typeof MessageSchema>;
export type AppSettings = z.infer<typeof AppSettingsSchema>;
export type CouncilSummary = z.infer<typeof CouncilSummarySchema>;
export type SessionReplay = z.infer<typeof SessionReplaySchema>;
export type WorkspaceDetail = z.infer<typeof WorkspaceDetailSchema>;
export type CreateWorkspaceInput = z.infer<typeof CreateWorkspaceInputSchema>;
export type SaveAgentInput = z.infer<typeof SaveAgentInputSchema>;
export type CreateSessionInput = z.infer<typeof CreateSessionInputSchema>;
export type StartTaskInput = z.infer<typeof StartTaskInputSchema>;
export type BuiltInAgentTemplate = (typeof BUILT_IN_AGENT_TEMPLATES)[number];
