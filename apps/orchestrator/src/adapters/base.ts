import type { AgentDefinition, AgentRunRequest } from "@hive/shared";

export interface AdapterEventHandlers {
  onStdout: (chunk: string) => void;
  onStderr: (chunk: string) => void;
  onStatus: (status: string) => void;
  onExit: (code: number | null) => void;
  onError: (error: Error) => void;
  onFinal: (finalText: string) => void;
}

export interface RunningAdapter {
  stop: () => Promise<void>;
  done: Promise<void>;
}

export interface AgentAdapter {
  validateConfig: (agent: AgentDefinition) => void;
  startRun: (
    agent: AgentDefinition,
    request: AgentRunRequest,
    handlers: AdapterEventHandlers,
  ) => RunningAdapter;
  serializeForReplay: (agent: AgentDefinition) => Record<string, unknown>;
}
