import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { bootstrapDatabase } from "../src/db/bootstrap";
import { createDatabase } from "../src/db/client";
import { Repository } from "../src/db/repository";
import { TaskService } from "../src/sessions/task-service";

describe("TaskService", () => {
  it(
    "runs worker, judge, and implementer agents in council mode",
    async () => {
      const databasePath = path.join(os.tmpdir(), `hivecli-${Date.now()}.db`);
      const database = createDatabase(databasePath);
      bootstrapDatabase(database.sqlite);

      const repository = new Repository(database.db);
      const events: unknown[] = [];
      const hub = { broadcastEvent: (event: unknown) => events.push(event) } as any;
      const service = new TaskService(repository, hub);

      const workspace = await repository.createWorkspace({
        name: "Fixture workspace",
        rootPath: process.cwd(),
      });

      const scriptPath = path.join(process.cwd(), "tests", "fixtures", "mock-cli.mjs");
      const makeAgent = (name: string, label: string, canJudge = false) =>
        repository.createAgent({
          workspaceId: workspace.id,
          name,
          type: "cli",
          provider: label,
          command: process.execPath,
          args: [scriptPath, "--label", label, "--prompt", "{{prompt}}"],
          cwd: process.cwd(),
          env: {},
          enabled: true,
          canJudge,
          shellAccess: true,
          model: null,
        });

      const codex = await makeAgent("Codex CLI", "codex");
      const gemini = await makeAgent("Gemini CLI", "gemini");
      const judge = await makeAgent("Judge", "judge", true);
      const implementer = await makeAgent("Implementer", "implementer");

      const result = await service.runTask({
        workspaceId: workspace.id,
        prompt: "ship it",
        mode: "council",
        agentIds: [codex.id, gemini.id, judge.id, implementer.id],
        judgeAgentId: judge.id,
      });

      const replay = await repository.getSessionReplay(result.sessionId);
      expect(replay?.tasks).toHaveLength(1);
      expect(replay?.tasks[0]?.runs).toHaveLength(4);
      expect(replay?.tasks[0]?.runs.map((run) => run.agentId).sort()).toEqual(
        [codex.id, gemini.id, judge.id, implementer.id].sort(),
      );
      expect(events.length).toBeGreaterThan(0);
    },
    20000,
  );
});
