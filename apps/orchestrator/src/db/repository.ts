import { desc, eq } from "drizzle-orm";

import type {
  AgentDefinition,
  AgentEvent,
  AgentRun,
  AppSettings,
  Message,
  Session,
  SessionReplay,
  SessionSnapshot,
  Task,
  TaskRunSummary,
  Workspace,
  WorkspaceDetail,
} from "@hive/shared";

import { createId } from "../utils/id";
import { nowIso } from "../utils/time";
import { agentRuns, agents, events, messages, sessions, settings, tasks, workspaces } from "./schema";

type DrizzleDatabase = ReturnType<typeof import("./client").createDatabase>["db"];

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  return JSON.parse(value) as T;
}

function compactPatch<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, fieldValue]) => fieldValue !== undefined)) as T;
}

function toWorkspace(row: typeof workspaces.$inferSelect): Workspace {
  return { id: row.id, name: row.name, rootPath: row.rootPath, createdAt: row.createdAt, updatedAt: row.updatedAt };
}

function toAgent(row: typeof agents.$inferSelect): AgentDefinition {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    name: row.name,
    type: row.type as AgentDefinition["type"],
    provider: row.provider,
    model: row.model,
    command: row.command,
    args: parseJson<string[]>(row.argsJson, []),
    cwd: row.cwd,
    env: parseJson<Record<string, string>>(row.envJson, {}),
    enabled: row.enabled,
    canJudge: row.canJudge,
    shellAccess: row.shellAccess,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toSession(row: typeof sessions.$inferSelect): Session {
  return { id: row.id, workspaceId: row.workspaceId, title: row.title, createdAt: row.createdAt, updatedAt: row.updatedAt };
}

function toTask(row: typeof tasks.$inferSelect): Task {
  return { id: row.id, sessionId: row.sessionId, prompt: row.prompt, mode: row.mode as Task["mode"], createdAt: row.createdAt };
}

function toAgentRun(row: typeof agentRuns.$inferSelect): AgentRun {
  return {
    id: row.id,
    sessionId: row.sessionId,
    taskId: row.taskId,
    agentId: row.agentId,
    status: row.status as AgentRun["status"],
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
    exitCode: row.exitCode,
    finalText: row.finalText,
    errorText: row.errorText,
    metadata: parseJson<Record<string, unknown> | undefined>(row.metadataJson, undefined),
  };
}

function toMessage(row: typeof messages.$inferSelect): Message {
  return {
    id: row.id,
    sessionId: row.sessionId,
    taskId: row.taskId,
    agentRunId: row.agentRunId,
    agentId: row.agentId,
    role: row.role as Message["role"],
    content: row.content,
    isFinal: row.isFinal,
    createdAt: row.createdAt,
  };
}

function toEvent(row: typeof events.$inferSelect): AgentEvent {
  return {
    id: row.id,
    sessionId: row.sessionId,
    taskId: row.taskId,
    agentRunId: row.agentRunId,
    agentId: row.agentId,
    type: row.type as AgentEvent["type"],
    payload: row.payload,
    sequence: row.sequence,
    timestamp: row.timestamp,
  };
}

function toSetting(row: typeof settings.$inferSelect): AppSettings {
  return { id: row.id, key: row.key, value: row.value, createdAt: row.createdAt, updatedAt: row.updatedAt };
}

export class Repository {
  constructor(private readonly database: DrizzleDatabase) {}

  async listWorkspaces() {
    return this.database.select().from(workspaces).orderBy(desc(workspaces.updatedAt)).all().map(toWorkspace);
  }

  async createWorkspace(input: Pick<Workspace, "name" | "rootPath">) {
    const timestamp = nowIso();
    const row = { id: createId(), name: input.name, rootPath: input.rootPath, createdAt: timestamp, updatedAt: timestamp };
    this.database.insert(workspaces).values(row).run();
    return toWorkspace(row);
  }

  async getWorkspace(workspaceId: string): Promise<WorkspaceDetail | undefined> {
    const workspaceRow = this.database.select().from(workspaces).where(eq(workspaces.id, workspaceId)).get();
    if (!workspaceRow) return undefined;
    const [agentRows, sessionRows] = await Promise.all([
      this.database.select().from(agents).where(eq(agents.workspaceId, workspaceId)).all(),
      this.database.select().from(sessions).where(eq(sessions.workspaceId, workspaceId)).orderBy(desc(sessions.updatedAt)).all(),
    ]);
    return { workspace: toWorkspace(workspaceRow), agents: agentRows.map(toAgent), sessions: sessionRows.map(toSession) };
  }

  async getAgent(agentId: string) {
    const row = this.database.select().from(agents).where(eq(agents.id, agentId)).get();
    return row ? toAgent(row) : undefined;
  }

  async createAgent(input: Omit<AgentDefinition, "id" | "createdAt" | "updatedAt">) {
    const timestamp = nowIso();
    const row = {
      id: createId(),
      workspaceId: input.workspaceId,
      name: input.name,
      type: input.type,
      provider: input.provider,
      model: input.model ?? null,
      command: input.command ?? null,
      argsJson: JSON.stringify(input.args ?? []),
      cwd: input.cwd ?? null,
      envJson: JSON.stringify(input.env ?? {}),
      enabled: input.enabled,
      canJudge: input.canJudge,
      shellAccess: input.shellAccess,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.database.insert(agents).values(row).run();
    return toAgent(row);
  }

  async updateAgent(agentId: string, input: Partial<AgentDefinition>) {
    const current = await this.getAgent(agentId);
    if (!current) return undefined;
    const next = compactPatch({
      name: input.name ?? current.name,
      type: input.type ?? current.type,
      provider: input.provider ?? current.provider,
      model: input.model ?? current.model ?? null,
      command: input.command ?? current.command ?? null,
      argsJson: JSON.stringify(input.args ?? current.args ?? []),
      cwd: input.cwd ?? current.cwd ?? null,
      envJson: JSON.stringify(input.env ?? current.env ?? {}),
      enabled: input.enabled ?? current.enabled,
      canJudge: input.canJudge ?? current.canJudge,
      shellAccess: input.shellAccess ?? current.shellAccess,
      updatedAt: nowIso(),
    });
    this.database.update(agents).set(next).where(eq(agents.id, agentId)).run();
    return this.getAgent(agentId);
  }

  async deleteAgent(agentId: string) {
    this.database.delete(agents).where(eq(agents.id, agentId)).run();
  }

  async createSession(workspaceId: string, title: string) {
    const timestamp = nowIso();
    const row = { id: createId(), workspaceId, title, createdAt: timestamp, updatedAt: timestamp };
    this.database.insert(sessions).values(row).run();
    return toSession(row);
  }

  async getSession(sessionId: string) {
    const row = this.database.select().from(sessions).where(eq(sessions.id, sessionId)).get();
    return row ? toSession(row) : undefined;
  }

  async touchSession(sessionId: string) {
    this.database.update(sessions).set({ updatedAt: nowIso() }).where(eq(sessions.id, sessionId)).run();
  }

  async listSessionSnapshots(workspaceId: string): Promise<SessionSnapshot[]> {
    const sessionRows = this.database.select().from(sessions).where(eq(sessions.workspaceId, workspaceId)).orderBy(desc(sessions.updatedAt)).all();
    return sessionRows.map((sessionRow) => {
      const taskRow = this.database.select().from(tasks).where(eq(tasks.sessionId, sessionRow.id)).orderBy(desc(tasks.createdAt)).get();
      let latestTask: TaskRunSummary | undefined;
      if (taskRow) {
        latestTask = { task: toTask(taskRow), runs: this.database.select().from(agentRuns).where(eq(agentRuns.taskId, taskRow.id)).all().map(toAgentRun) };
      }
      return { session: toSession(sessionRow), latestTask };
    });
  }

  async createTask(sessionId: string, prompt: string, mode: Task["mode"], judgeAgentId?: string | null) {
    const row = { id: createId(), sessionId, prompt, mode, judgeAgentId: judgeAgentId ?? null, createdAt: nowIso() };
    this.database.insert(tasks).values(row).run();
    await this.touchSession(sessionId);
    return toTask(row);
  }

  async createAgentRun(sessionId: string, taskId: string, agentId: string, metadata?: Record<string, unknown>) {
    const row = { id: createId(), sessionId, taskId, agentId, status: "queued", startedAt: null, finishedAt: null, exitCode: null, finalText: null, errorText: null, metadataJson: metadata ? JSON.stringify(metadata) : null };
    this.database.insert(agentRuns).values(row).run();
    return toAgentRun(row);
  }

  async updateAgentRun(runId: string, patch: Partial<AgentRun>) {
    this.database.update(agentRuns).set(compactPatch({
      status: patch.status,
      startedAt: patch.startedAt,
      finishedAt: patch.finishedAt,
      exitCode: patch.exitCode ?? null,
      finalText: patch.finalText ?? null,
      errorText: patch.errorText ?? null,
      metadataJson: patch.metadata ? JSON.stringify(patch.metadata) : undefined,
    })).where(eq(agentRuns.id, runId)).run();
  }

  async getRun(runId: string) {
    const row = this.database.select().from(agentRuns).where(eq(agentRuns.id, runId)).get();
    return row ? toAgentRun(row) : undefined;
  }

  async appendMessage(input: Omit<Message, "id" | "createdAt">) {
    const row = { id: createId(), sessionId: input.sessionId, taskId: input.taskId, agentRunId: input.agentRunId, agentId: input.agentId, role: input.role, content: input.content, isFinal: input.isFinal, createdAt: nowIso() };
    this.database.insert(messages).values(row).run();
    return toMessage(row);
  }

  async appendEvent(input: Omit<AgentEvent, "id" | "timestamp"> & { timestamp?: string }) {
    const row = { id: createId(), sessionId: input.sessionId, taskId: input.taskId, agentRunId: input.agentRunId, agentId: input.agentId, type: input.type, payload: input.payload, sequence: input.sequence, timestamp: input.timestamp ?? nowIso() };
    this.database.insert(events).values(row).run();
    return toEvent(row);
  }

  async getSessionReplay(sessionId: string): Promise<SessionReplay | undefined> {
    const sessionRow = await this.getSession(sessionId);
    if (!sessionRow) return undefined;
    const [taskRows, messageRows, eventRows] = await Promise.all([
      this.database.select().from(tasks).where(eq(tasks.sessionId, sessionId)).orderBy(tasks.createdAt).all(),
      this.database.select().from(messages).where(eq(messages.sessionId, sessionId)).orderBy(messages.createdAt).all(),
      this.database.select().from(events).where(eq(events.sessionId, sessionId)).orderBy(events.timestamp).all(),
    ]);
    return {
      session: sessionRow,
      tasks: taskRows.map((taskRow) => ({ task: toTask(taskRow), runs: this.database.select().from(agentRuns).where(eq(agentRuns.taskId, taskRow.id)).all().map(toAgentRun) })),
      messages: messageRows.map(toMessage),
      events: eventRows.map(toEvent),
    };
  }

  async listSettings() {
    return this.database.select().from(settings).orderBy(settings.key).all().map(toSetting);
  }

  async upsertSetting(key: string, value: string) {
    const existing = this.database.select().from(settings).where(eq(settings.key, key)).get();
    if (existing) {
      const updatedAt = nowIso();
      this.database.update(settings).set({ value, updatedAt }).where(eq(settings.key, key)).run();
      return toSetting({ ...existing, value, updatedAt });
    }
    const timestamp = nowIso();
    const row = { id: createId(), key, value, createdAt: timestamp, updatedAt: timestamp };
    this.database.insert(settings).values(row).run();
    return toSetting(row);
  }
}
