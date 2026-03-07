import type {
  CreateWorkspaceInput,
  SaveAgentInput,
  Session,
  SessionReplay,
  StartTaskInput,
  Workspace,
  WorkspaceDetail,
} from "@hive/shared";

import type { BootstrapPayload, RealtimePayload } from "@/types/app";

async function parseEnvelope<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  const json = (await response.json()) as { data: T };
  return json.data;
}

export class OrchestratorClient {
  constructor(private readonly baseUrl: string) {}

  get wsUrl(): string {
    return `${this.baseUrl.replace("http", "ws")}/ws`;
  }

  async bootstrap(): Promise<BootstrapPayload> {
    return parseEnvelope<BootstrapPayload>(await fetch(`${this.baseUrl}/api/bootstrap`));
  }

  async createWorkspace(input: CreateWorkspaceInput): Promise<Workspace> {
    return parseEnvelope<Workspace>(
      await fetch(`${this.baseUrl}/api/workspaces`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }),
    );
  }

  async getWorkspace(workspaceId: string): Promise<WorkspaceDetail> {
    return parseEnvelope<WorkspaceDetail>(await fetch(`${this.baseUrl}/api/workspaces/${workspaceId}`));
  }

  async listSessions(workspaceId: string): Promise<Session[]> {
    return parseEnvelope<Session[]>(await fetch(`${this.baseUrl}/api/workspaces/${workspaceId}/sessions`));
  }

  async saveAgent(input: SaveAgentInput) {
    const url = input.id
      ? `${this.baseUrl}/api/agents/${input.id}`
      : `${this.baseUrl}/api/agents`;
    const method = input.id ? "PUT" : "POST";

    return parseEnvelope(
      await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }),
    );
  }

  async deleteAgent(agentId: string): Promise<void> {
    await fetch(`${this.baseUrl}/api/agents/${agentId}`, { method: "DELETE" });
  }

  async createSession(workspaceId: string, title: string): Promise<Session> {
    return parseEnvelope<Session>(
      await fetch(`${this.baseUrl}/api/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, title }),
      }),
    );
  }

  async getSessionReplay(sessionId: string): Promise<SessionReplay> {
    return parseEnvelope<SessionReplay>(await fetch(`${this.baseUrl}/api/sessions/${sessionId}/replay`));
  }

  async startTask(input: StartTaskInput) {
    return parseEnvelope(
      await fetch(`${this.baseUrl}/api/sessions/${input.sessionId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }),
    );
  }

  connectRealtime(onMessage: (payload: RealtimePayload) => void): () => void {
    const socket = new WebSocket(this.wsUrl);
    socket.addEventListener("message", (event) => {
      const payload = JSON.parse(event.data as string) as RealtimePayload;
      onMessage(payload);
    });

    return () => socket.close();
  }
}
