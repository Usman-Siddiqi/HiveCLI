import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const workspaces = sqliteTable("workspaces", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  rootPath: text("root_path").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const agents = sqliteTable("agents", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  provider: text("provider").notNull(),
  model: text("model"),
  command: text("command"),
  argsJson: text("args_json").notNull(),
  cwd: text("cwd"),
  envJson: text("env_json").notNull(),
  enabled: integer("enabled", { mode: "boolean" }).notNull(),
  canJudge: integer("can_judge", { mode: "boolean" }).notNull(),
  shellAccess: integer("shell_access", { mode: "boolean" }).notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  title: text("title").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const tasks = sqliteTable("tasks", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  prompt: text("prompt").notNull(),
  mode: text("mode").notNull(),
  judgeAgentId: text("judge_agent_id"),
  createdAt: text("created_at").notNull(),
});

export const agentRuns = sqliteTable("agent_runs", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  taskId: text("task_id").notNull(),
  agentId: text("agent_id").notNull(),
  status: text("status").notNull(),
  startedAt: text("started_at"),
  finishedAt: text("finished_at"),
  exitCode: integer("exit_code"),
  finalText: text("final_text"),
  errorText: text("error_text"),
  metadataJson: text("metadata_json"),
});

export const messages = sqliteTable("messages", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  taskId: text("task_id").notNull(),
  agentRunId: text("agent_run_id").notNull(),
  agentId: text("agent_id").notNull(),
  role: text("role").notNull(),
  content: text("content").notNull(),
  isFinal: integer("is_final", { mode: "boolean" }).notNull(),
  createdAt: text("created_at").notNull(),
});

export const events = sqliteTable("events", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  taskId: text("task_id").notNull(),
  agentRunId: text("agent_run_id").notNull(),
  agentId: text("agent_id").notNull(),
  type: text("type").notNull(),
  payload: text("payload").notNull(),
  sequence: integer("sequence").notNull(),
  timestamp: text("timestamp").notNull(),
});

export const settings = sqliteTable("settings", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
