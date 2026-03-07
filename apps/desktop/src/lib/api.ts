import type {
  AgentDefinition,
  AppSettings,
  RunTaskInput,
  SessionReplay,
  SessionSnapshot,
  Workspace,
  WorkspaceDetail,
} from "@hive/shared";

import { getRuntimeConfig } from "./runtime";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const runtime = await getRuntimeConfig();
  const response = await fetch(`${runtime.orchestratorUrl}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json() as Promise<T>;
}

export const api = {
  listWorkspaces: () => request<Workspace[]>("/api/workspaces"),
  createWorkspace: (body: Pick<Workspace, "name" | "rootPath">) =>
    request<Workspace>("/api/workspaces", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  getWorkspace: (id: string) => request<WorkspaceDetail>(`/api/workspaces/${id}`),
  listSessions: (workspaceId: string) =>
    request<SessionSnapshot[]>(`/api/workspaces/${workspaceId}/sessions`),
  getSession: (id: string) => request<SessionReplay>(`/api/sessions/${id}`),
  createAgent: (body: Omit<AgentDefinition, "id" | "createdAt" | "updatedAt">) =>
    request<AgentDefinition>("/api/agents", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateAgent: (id: string, body: Partial<AgentDefinition>) =>
    request<AgentDefinition>(`/api/agents/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  deleteAgent: (id: string) =>
    request<{ ok: true }>(`/api/agents/${id}`, {
      method: "DELETE",
    }),
  runTask: (body: RunTaskInput) =>
    request<{ sessionId: string; taskId: string }>("/api/tasks/run", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  listSettings: () => request<AppSettings[]>("/api/settings"),
  setSetting: (key: string, value: string) =>
    request<AppSettings>(`/api/settings/${key}`, {
      method: "PUT",
      body: JSON.stringify({ value }),
    }),
};
