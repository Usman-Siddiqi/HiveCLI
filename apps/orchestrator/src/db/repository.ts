import type { DatabaseSync } from "node:sqlite";

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

type DatabaseValue = string | number | null;

interface WorkspaceRow {
  id: string;
  name: string;
  rootPath: string;
  createdAt: string;
  updatedAt: string;
}

interface AgentRow {
  id: string;
  workspaceId: string;
  name: string;
  type: string;
  provider: string;
  model: string | null;
  command: string | null;
  argsJson: string;
  cwd: string | null;
  envJson: string;
  enabled: number;
  canJudge: number;
  shellAccess: number;
  createdAt: string;
  updatedAt: string;
}

interface SessionRow {
  id: string;
  workspaceId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

interface TaskRow {
  id: string;
  sessionId: string;
  prompt: string;
  mode: string;
  judgeAgentId: string | null;
  createdAt: string;
}

interface AgentRunRow {
  id: string;
  sessionId: string;
  taskId: string;
  agentId: string;
  status: string;
  startedAt: string | null;
  finishedAt: string | null;
  exitCode: number | null;
  finalText: string | null;
  errorText: string | null;
  metadataJson: string | null;
}

interface MessageRow {
  id: string;
  sessionId: string;
  taskId: string;
  agentRunId: string;
  agentId: string;
  role: string;
  content: string;
  isFinal: number;
  createdAt: string;
}

interface EventRow {
  id: string;
  sessionId: string;
  taskId: string;
  agentRunId: string;
  agentId: string;
  type: string;
  payload: string;
  sequence: number;
  timestamp: string;
}

interface SettingRow {
  id: string;
  key: string;
  value: string;
  createdAt: string;
  updatedAt: string;
}

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  return JSON.parse(value) as T;
}

function toWorkspace(row: WorkspaceRow): Workspace {
  return row;
}

function toAgent(row: AgentRow): AgentDefinition {
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
    enabled: Boolean(row.enabled),
    canJudge: Boolean(row.canJudge),
    shellAccess: Boolean(row.shellAccess),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toSession(row: SessionRow): Session {
  return row;
}

function toTask(row: TaskRow): Task {
  return {
    id: row.id,
    sessionId: row.sessionId,
    prompt: row.prompt,
    mode: row.mode as Task["mode"],
    createdAt: row.createdAt,
  };
}

function toAgentRun(row: AgentRunRow): AgentRun {
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

function toMessage(row: MessageRow): Message {
  return {
    id: row.id,
    sessionId: row.sessionId,
    taskId: row.taskId,
    agentRunId: row.agentRunId,
    agentId: row.agentId,
    role: row.role as Message["role"],
    content: row.content,
    isFinal: Boolean(row.isFinal),
    createdAt: row.createdAt,
  };
}

function toEvent(row: EventRow): AgentEvent {
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

function toSetting(row: SettingRow): AppSettings {
  return row;
}

export class Repository {
  constructor(private readonly database: DatabaseSync) {}

  private all<T>(sql: string, ...params: DatabaseValue[]) {
    return this.database.prepare(sql).all(...params) as T[];
  }

  private get<T>(sql: string, ...params: DatabaseValue[]) {
    return this.database.prepare(sql).get(...params) as T | undefined;
  }

  private run(sql: string, ...params: DatabaseValue[]) {
    return this.database.prepare(sql).run(...params);
  }

  async listWorkspaces() {
    return this.all<WorkspaceRow>(
      `
        select
          id,
          name,
          root_path as rootPath,
          created_at as createdAt,
          updated_at as updatedAt
        from workspaces
        order by updated_at desc
      `,
    ).map(toWorkspace);
  }

  async createWorkspace(input: Pick<Workspace, "name" | "rootPath">) {
    const timestamp = nowIso();
    const row: WorkspaceRow = {
      id: createId(),
      name: input.name,
      rootPath: input.rootPath,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    this.run(
      `
        insert into workspaces (id, name, root_path, created_at, updated_at)
        values (?, ?, ?, ?, ?)
      `,
      row.id,
      row.name,
      row.rootPath,
      row.createdAt,
      row.updatedAt,
    );

    return toWorkspace(row);
  }

  async getWorkspace(workspaceId: string): Promise<WorkspaceDetail | undefined> {
    const workspaceRow = this.get<WorkspaceRow>(
      `
        select
          id,
          name,
          root_path as rootPath,
          created_at as createdAt,
          updated_at as updatedAt
        from workspaces
        where id = ?
      `,
      workspaceId,
    );

    if (!workspaceRow) {
      return undefined;
    }

    const agentRows = this.all<AgentRow>(
      `
        select
          id,
          workspace_id as workspaceId,
          name,
          type,
          provider,
          model,
          command,
          args_json as argsJson,
          cwd,
          env_json as envJson,
          enabled,
          can_judge as canJudge,
          shell_access as shellAccess,
          created_at as createdAt,
          updated_at as updatedAt
        from agents
        where workspace_id = ?
      `,
      workspaceId,
    );

    const sessionRows = this.all<SessionRow>(
      `
        select
          id,
          workspace_id as workspaceId,
          title,
          created_at as createdAt,
          updated_at as updatedAt
        from sessions
        where workspace_id = ?
        order by updated_at desc
      `,
      workspaceId,
    );

    return {
      workspace: toWorkspace(workspaceRow),
      agents: agentRows.map(toAgent),
      sessions: sessionRows.map(toSession),
    };
  }

  async getAgent(agentId: string) {
    const row = this.get<AgentRow>(
      `
        select
          id,
          workspace_id as workspaceId,
          name,
          type,
          provider,
          model,
          command,
          args_json as argsJson,
          cwd,
          env_json as envJson,
          enabled,
          can_judge as canJudge,
          shell_access as shellAccess,
          created_at as createdAt,
          updated_at as updatedAt
        from agents
        where id = ?
      `,
      agentId,
    );

    return row ? toAgent(row) : undefined;
  }

  async createAgent(input: Omit<AgentDefinition, "id" | "createdAt" | "updatedAt">) {
    const timestamp = nowIso();
    const row: AgentRow = {
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
      enabled: input.enabled ? 1 : 0,
      canJudge: input.canJudge ? 1 : 0,
      shellAccess: input.shellAccess ? 1 : 0,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    this.run(
      `
        insert into agents (
          id, workspace_id, name, type, provider, model, command,
          args_json, cwd, env_json, enabled, can_judge, shell_access,
          created_at, updated_at
        )
        values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      row.id,
      row.workspaceId,
      row.name,
      row.type,
      row.provider,
      row.model,
      row.command,
      row.argsJson,
      row.cwd,
      row.envJson,
      row.enabled,
      row.canJudge,
      row.shellAccess,
      row.createdAt,
      row.updatedAt,
    );

    return toAgent(row);
  }

  async updateAgent(agentId: string, input: Partial<AgentDefinition>) {
    const current = await this.getAgent(agentId);
    if (!current) {
      return undefined;
    }

    const next: AgentRow = {
      id: agentId,
      workspaceId: current.workspaceId,
      name: input.name ?? current.name,
      type: input.type ?? current.type,
      provider: input.provider ?? current.provider,
      model: input.model ?? current.model ?? null,
      command: input.command ?? current.command ?? null,
      argsJson: JSON.stringify(input.args ?? current.args ?? []),
      cwd: input.cwd ?? current.cwd ?? null,
      envJson: JSON.stringify(input.env ?? current.env ?? {}),
      enabled: (input.enabled ?? current.enabled) ? 1 : 0,
      canJudge: (input.canJudge ?? current.canJudge) ? 1 : 0,
      shellAccess: (input.shellAccess ?? current.shellAccess) ? 1 : 0,
      createdAt: current.createdAt,
      updatedAt: nowIso(),
    };

    this.run(
      `
        update agents
        set
          name = ?,
          type = ?,
          provider = ?,
          model = ?,
          command = ?,
          args_json = ?,
          cwd = ?,
          env_json = ?,
          enabled = ?,
          can_judge = ?,
          shell_access = ?,
          updated_at = ?
        where id = ?
      `,
      next.name,
      next.type,
      next.provider,
      next.model,
      next.command,
      next.argsJson,
      next.cwd,
      next.envJson,
      next.enabled,
      next.canJudge,
      next.shellAccess,
      next.updatedAt,
      agentId,
    );

    return this.getAgent(agentId);
  }

  async deleteAgent(agentId: string) {
    this.run(`delete from agents where id = ?`, agentId);
  }

  async createSession(workspaceId: string, title: string) {
    const timestamp = nowIso();
    const row: SessionRow = {
      id: createId(),
      workspaceId,
      title,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    this.run(
      `
        insert into sessions (id, workspace_id, title, created_at, updated_at)
        values (?, ?, ?, ?, ?)
      `,
      row.id,
      row.workspaceId,
      row.title,
      row.createdAt,
      row.updatedAt,
    );

    return toSession(row);
  }

  async getSession(sessionId: string) {
    const row = this.get<SessionRow>(
      `
        select
          id,
          workspace_id as workspaceId,
          title,
          created_at as createdAt,
          updated_at as updatedAt
        from sessions
        where id = ?
      `,
      sessionId,
    );

    return row ? toSession(row) : undefined;
  }

  async touchSession(sessionId: string) {
    this.run(`update sessions set updated_at = ? where id = ?`, nowIso(), sessionId);
  }

  async listSessionSnapshots(workspaceId: string): Promise<SessionSnapshot[]> {
    const sessionRows = this.all<SessionRow>(
      `
        select
          id,
          workspace_id as workspaceId,
          title,
          created_at as createdAt,
          updated_at as updatedAt
        from sessions
        where workspace_id = ?
        order by updated_at desc
      `,
      workspaceId,
    );

    return sessionRows.map((sessionRow) => {
      const taskRow = this.get<TaskRow>(
        `
          select
            id,
            session_id as sessionId,
            prompt,
            mode,
            judge_agent_id as judgeAgentId,
            created_at as createdAt
          from tasks
          where session_id = ?
          order by created_at desc
          limit 1
        `,
        sessionRow.id,
      );

      let latestTask: TaskRunSummary | undefined;

      if (taskRow) {
        latestTask = {
          task: toTask(taskRow),
          runs: this.all<AgentRunRow>(
            `
              select
                id,
                session_id as sessionId,
                task_id as taskId,
                agent_id as agentId,
                status,
                started_at as startedAt,
                finished_at as finishedAt,
                exit_code as exitCode,
                final_text as finalText,
                error_text as errorText,
                metadata_json as metadataJson
              from agent_runs
              where task_id = ?
            `,
            taskRow.id,
          ).map(toAgentRun),
        };
      }

      return { session: toSession(sessionRow), latestTask };
    });
  }

  async createTask(sessionId: string, prompt: string, mode: Task["mode"], judgeAgentId?: string | null) {
    const row: TaskRow = {
      id: createId(),
      sessionId,
      prompt,
      mode,
      judgeAgentId: judgeAgentId ?? null,
      createdAt: nowIso(),
    };

    this.run(
      `
        insert into tasks (id, session_id, prompt, mode, judge_agent_id, created_at)
        values (?, ?, ?, ?, ?, ?)
      `,
      row.id,
      row.sessionId,
      row.prompt,
      row.mode,
      row.judgeAgentId,
      row.createdAt,
    );

    await this.touchSession(sessionId);
    return toTask(row);
  }

  async createAgentRun(sessionId: string, taskId: string, agentId: string, metadata?: Record<string, unknown>) {
    const row: AgentRunRow = {
      id: createId(),
      sessionId,
      taskId,
      agentId,
      status: "queued",
      startedAt: null,
      finishedAt: null,
      exitCode: null,
      finalText: null,
      errorText: null,
      metadataJson: metadata ? JSON.stringify(metadata) : null,
    };

    this.run(
      `
        insert into agent_runs (
          id, session_id, task_id, agent_id, status, started_at, finished_at,
          exit_code, final_text, error_text, metadata_json
        )
        values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      row.id,
      row.sessionId,
      row.taskId,
      row.agentId,
      row.status,
      row.startedAt,
      row.finishedAt,
      row.exitCode,
      row.finalText,
      row.errorText,
      row.metadataJson,
    );

    return toAgentRun(row);
  }

  async updateAgentRun(runId: string, patch: Partial<AgentRun>) {
    const current = await this.getRun(runId);
    if (!current) {
      return;
    }

    this.run(
      `
        update agent_runs
        set
          status = ?,
          started_at = ?,
          finished_at = ?,
          exit_code = ?,
          final_text = ?,
          error_text = ?,
          metadata_json = ?
        where id = ?
      `,
      patch.status ?? current.status,
      patch.startedAt ?? current.startedAt ?? null,
      patch.finishedAt ?? current.finishedAt ?? null,
      patch.exitCode ?? current.exitCode ?? null,
      patch.finalText ?? current.finalText ?? null,
      patch.errorText ?? current.errorText ?? null,
      patch.metadata ? JSON.stringify(patch.metadata) : current.metadata ? JSON.stringify(current.metadata) : null,
      runId,
    );
  }

  async getRun(runId: string) {
    const row = this.get<AgentRunRow>(
      `
        select
          id,
          session_id as sessionId,
          task_id as taskId,
          agent_id as agentId,
          status,
          started_at as startedAt,
          finished_at as finishedAt,
          exit_code as exitCode,
          final_text as finalText,
          error_text as errorText,
          metadata_json as metadataJson
        from agent_runs
        where id = ?
      `,
      runId,
    );

    return row ? toAgentRun(row) : undefined;
  }

  async appendMessage(input: Omit<Message, "id" | "createdAt">) {
    const row: MessageRow = {
      id: createId(),
      sessionId: input.sessionId,
      taskId: input.taskId,
      agentRunId: input.agentRunId,
      agentId: input.agentId,
      role: input.role,
      content: input.content,
      isFinal: input.isFinal ? 1 : 0,
      createdAt: nowIso(),
    };

    this.run(
      `
        insert into messages (
          id, session_id, task_id, agent_run_id, agent_id, role, content, is_final, created_at
        )
        values (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      row.id,
      row.sessionId,
      row.taskId,
      row.agentRunId,
      row.agentId,
      row.role,
      row.content,
      row.isFinal,
      row.createdAt,
    );

    return toMessage(row);
  }

  async appendEvent(input: Omit<AgentEvent, "id" | "timestamp"> & { timestamp?: string }) {
    const row: EventRow = {
      id: createId(),
      sessionId: input.sessionId,
      taskId: input.taskId,
      agentRunId: input.agentRunId,
      agentId: input.agentId,
      type: input.type,
      payload: input.payload,
      sequence: input.sequence,
      timestamp: input.timestamp ?? nowIso(),
    };

    this.run(
      `
        insert into events (
          id, session_id, task_id, agent_run_id, agent_id, type, payload, sequence, timestamp
        )
        values (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      row.id,
      row.sessionId,
      row.taskId,
      row.agentRunId,
      row.agentId,
      row.type,
      row.payload,
      row.sequence,
      row.timestamp,
    );

    return toEvent(row);
  }

  async getSessionReplay(sessionId: string): Promise<SessionReplay | undefined> {
    const sessionRow = await this.getSession(sessionId);
    if (!sessionRow) {
      return undefined;
    }

    const taskRows = this.all<TaskRow>(
      `
        select
          id,
          session_id as sessionId,
          prompt,
          mode,
          judge_agent_id as judgeAgentId,
          created_at as createdAt
        from tasks
        where session_id = ?
        order by created_at
      `,
      sessionId,
    );

    const messageRows = this.all<MessageRow>(
      `
        select
          id,
          session_id as sessionId,
          task_id as taskId,
          agent_run_id as agentRunId,
          agent_id as agentId,
          role,
          content,
          is_final as isFinal,
          created_at as createdAt
        from messages
        where session_id = ?
        order by created_at
      `,
      sessionId,
    );

    const eventRows = this.all<EventRow>(
      `
        select
          id,
          session_id as sessionId,
          task_id as taskId,
          agent_run_id as agentRunId,
          agent_id as agentId,
          type,
          payload,
          sequence,
          timestamp
        from events
        where session_id = ?
        order by timestamp, sequence
      `,
      sessionId,
    );

    return {
      session: sessionRow,
      tasks: taskRows.map((taskRow) => ({
        task: toTask(taskRow),
        runs: this.all<AgentRunRow>(
          `
            select
              id,
              session_id as sessionId,
              task_id as taskId,
              agent_id as agentId,
              status,
              started_at as startedAt,
              finished_at as finishedAt,
              exit_code as exitCode,
              final_text as finalText,
              error_text as errorText,
              metadata_json as metadataJson
            from agent_runs
            where task_id = ?
          `,
          taskRow.id,
        ).map(toAgentRun),
      })),
      messages: messageRows.map(toMessage),
      events: eventRows.map(toEvent),
    };
  }

  async listSettings() {
    return this.all<SettingRow>(
      `
        select
          id,
          key,
          value,
          created_at as createdAt,
          updated_at as updatedAt
        from settings
        order by key
      `,
    ).map(toSetting);
  }

  async upsertSetting(key: string, value: string) {
    const existing = this.get<SettingRow>(
      `
        select
          id,
          key,
          value,
          created_at as createdAt,
          updated_at as updatedAt
        from settings
        where key = ?
      `,
      key,
    );

    if (existing) {
      const updatedAt = nowIso();
      this.run(`update settings set value = ?, updated_at = ? where key = ?`, value, updatedAt, key);
      return toSetting({ ...existing, value, updatedAt });
    }

    const timestamp = nowIso();
    const row: SettingRow = {
      id: createId(),
      key,
      value,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    this.run(
      `
        insert into settings (id, key, value, created_at, updated_at)
        values (?, ?, ?, ?, ?)
      `,
      row.id,
      row.key,
      row.value,
      row.createdAt,
      row.updatedAt,
    );

    return toSetting(row);
  }
}
