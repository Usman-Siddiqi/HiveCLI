import os from "node:os";
import fs from "node:fs/promises";
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

      const projectRoot = path.join(os.tmpdir(), `hivecli-project-${Date.now()}`);
      await fs.mkdir(projectRoot, { recursive: true });
      await fs.writeFile(path.join(projectRoot, "README.md"), "# fixture\n");

      const workspace = await repository.createWorkspace({
        name: "Fixture workspace",
        rootPath: projectRoot,
      });

      const scriptPath = path.join(process.cwd(), "tests", "fixtures", "mock-cli.mjs");
      const makeAgent = (name: string, label: string, canJudge = false, decision?: string) =>
        repository.createAgent({
          workspaceId: workspace.id,
          name,
          type: "cli",
          provider: label,
          command: process.execPath,
          args: [
            scriptPath,
            "--label",
            label,
            "--prompt",
            "{{prompt}}",
            "--working-dir",
            "{{workingDir}}",
            ...(decision ? ["--decision", decision] : []),
          ],
          cwd: process.cwd(),
          env: {},
          enabled: true,
          canJudge,
          shellAccess: true,
          model: null,
        });

      const codex = await makeAgent("Worker A", "worker-a");
      const gemini = await makeAgent("Worker B", "worker-b");
      const judge = await makeAgent("Judge", "judge", true);
      const implementer = await makeAgent("Implementer", "implementer", false, "COPY_WORKER_A");
      const token = "JUDGE-TRACE-TEST";

      const result = await service.runTask({
        workspaceId: workspace.id,
        prompt: `Return exactly ${token}`,
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
      expect(
        replay?.tasks[0]?.runs.some(
          (run) => run.agentId === judge.id && run.status === "completed" && run.finalText?.includes(token),
        ),
      ).toBe(true);
      expect(
        replay?.tasks[0]?.runs.some(
          (run) => run.agentId === implementer.id && run.status === "completed" && run.finalText?.includes(token),
        ),
      ).toBe(true);
      const runRoot = path.join(projectRoot, "hivecli-runs", result.taskId);
      await expect(fs.stat(path.join(runRoot, "source", "README.md"))).resolves.toBeTruthy();
      await expect(fs.stat(path.join(runRoot, "worker-a", "worker-a.txt"))).resolves.toBeTruthy();
      await expect(fs.stat(path.join(runRoot, "worker-b", "worker-b.txt"))).resolves.toBeTruthy();
      await expect(fs.stat(path.join(runRoot, "judge", "diff-summary.md"))).resolves.toBeTruthy();
      await expect(fs.stat(path.join(runRoot, "implementer", "worker-a.txt"))).resolves.toBeTruthy();
      await expect(fs.stat(path.join(projectRoot, "publish", result.taskId, "worker-a.txt"))).resolves.toBeTruthy();
      const implementerRun = replay?.tasks[0]?.runs.find((run) => run.agentId === implementer.id);
      expect(implementerRun?.metadata?.publishDir).toBe(path.join(projectRoot, "publish", result.taskId));
      expect(implementerRun?.metadata?.publishSource).toBe(path.join(runRoot, "implementer"));
      expect(events.length).toBeGreaterThan(0);
    },
    20000,
  );
});
