import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type { AgentEvent } from "@hive/shared";
import { describe, expect, it, onTestFinished } from "vitest";

import { bootstrapDatabase } from "../src/db/bootstrap";
import { createDatabase } from "../src/db/client";
import { Repository } from "../src/db/repository";
import { TaskService } from "../src/sessions/task-service";
import type { EventHub } from "../src/ws/hub";

async function setup() {
  const database = createDatabase(":memory:");
  bootstrapDatabase(database.sqlite);
  const repository = new Repository(database.db);
  const events: AgentEvent[] = [];
  const hub = { broadcastEvent: (event: AgentEvent) => events.push(event) } as unknown as EventHub;
  const service = new TaskService(repository, hub);

  const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "hivecli-project-"));
  onTestFinished(async () => {
    database.sqlite.close();
    await fs.rm(projectRoot, { recursive: true, force: true });
  });
  await fs.writeFile(path.join(projectRoot, "README.md"), "# fixture\n");

  const workspace = await repository.createWorkspace({
    name: "Fixture workspace",
    rootPath: projectRoot,
  });
  const scriptPath = path.join(process.cwd(), "tests", "fixtures", "mock-cli.mjs");
  const makeAgent = (name: string, label: string, overrides: string[] = []) =>
    repository.createAgent({
      workspaceId: workspace.id,
      name,
      type: "cli",
      provider: label,
      command: process.execPath,
      args: [
        scriptPath,
        "--label", label,
        "--prompt", "{{prompt}}",
        "--working-dir", "{{workingDir}}",
        ...overrides,
      ],
      cwd: process.cwd(),
      enabled: true,
      canJudge: label === "judge",
      shellAccess: true,
    });

  return { service, repository, events, projectRoot, workspace, makeAgent };
}

describe("TaskService", () => {
  it("runs worker, judge, and implementer agents in council mode", async () => {
    const { service, repository, events, projectRoot, workspace, makeAgent } = await setup();
    const workerA = await makeAgent("Worker A", "worker-a");
    const workerB = await makeAgent("Worker B", "worker-b");
    const judge = await makeAgent("Judge", "judge");
    const implementer = await makeAgent("Implementer", "implementer", ["--decision", "COPY_WORKER_A"]);
    const token = "JUDGE-TRACE-TEST";

    const result = await service.runTask({
      workspaceId: workspace.id,
      prompt: `Return exactly ${token}`,
      mode: "council",
      agentIds: [workerA.id, workerB.id, judge.id, implementer.id],
      judgeAgentId: judge.id,
    });

    const replay = await repository.getSessionReplay(result.sessionId);
    expect(replay?.tasks).toHaveLength(1);
    const runs = replay?.tasks[0]?.runs ?? [];
    expect(runs).toHaveLength(4);
    expect(runs.map((run) => run.agentId).sort()).toEqual(
      [workerA.id, workerB.id, judge.id, implementer.id].sort(),
    );
    expect(runs.find((run) => run.agentId === judge.id)).toMatchObject({
      status: "completed",
      finalText: expect.stringContaining(token),
    });
    const runRoot = path.join(projectRoot, "hivecli-runs", result.taskId);
    const publishDir = path.join(projectRoot, "publish", result.taskId);
    await expect(fs.stat(path.join(runRoot, "source", "README.md"))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(runRoot, "worker-a", "worker-a.txt"))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(runRoot, "worker-b", "worker-b.txt"))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(runRoot, "judge", "diff-summary.md"))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(runRoot, "implementer", "README.md"))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(publishDir, "worker-a.txt"))).resolves.toBeTruthy();
    const implementerRun = runs.find((run) => run.agentId === implementer.id);
    expect(implementerRun).toMatchObject({
      status: "completed",
      finalText: expect.stringContaining(token),
      metadata: { publishDir, publishSource: path.join(runRoot, "worker-a") },
    });
    expect(events.filter((event) => event.agentId === implementer.id).at(-1)).toMatchObject({
      type: "status",
      payload: "completed",
    });
  }, 20_000);

  it.each(["worker", "judge", "implementer", "decision"] as const)(
    "keeps replay and withholds publication on %s failure",
    async (stage) => {
      const { service, repository, events, projectRoot, workspace, makeAgent } = await setup();
      const fail = ["--exit-code", "3"];
      const workerA = await makeAgent("Worker A", "worker-a", stage === "worker" ? fail : []);
      const workerB = await makeAgent("Worker B", "worker-b");
      const judge = await makeAgent("Judge", "judge", stage === "judge" ? fail : []);
      const implementer = await makeAgent("Implementer", "implementer", [
        "--decision", stage === "decision" ? "INVALID" : "COPY_WORKER_A",
        ...(stage === "implementer" ? fail : []),
      ]);

      const result = await service.runTask({
        workspaceId: workspace.id,
        prompt: "Test fixture run",
        mode: "council",
        agentIds: [workerA.id, workerB.id, judge.id, implementer.id],
        judgeAgentId: judge.id,
      });

      const replay = await repository.getSessionReplay(result.sessionId);
      const runs = replay?.tasks[0]?.runs ?? [];
      expect(runs).toHaveLength(4);
      expect(runs.some(({ status }) => status === "queued" || status === "running")).toBe(false);
      expect(runs.find((run) => run.agentId === implementer.id)).toMatchObject({
        status: "failed",
        errorText: expect.stringMatching(/before|code 3|publish decision/),
      });
      await expect(fs.stat(path.join(projectRoot, "publish", result.taskId))).rejects.toMatchObject({ code: "ENOENT" });
      const failedRunIds = new Set(runs.filter((run) => run.status === "failed").map((run) => run.id));
      for (const id of failedRunIds) {
        expect(events.filter((event) => event.agentRunId === id).at(-1)).toMatchObject({
          type: "status",
          payload: "failed",
        });
      }
    },
  );

  it("passes a Codex exec prompt through stdin and stores the CLI's final message", async () => {
    const { service, repository, projectRoot, workspace } = await setup();
    await fs.writeFile(path.join(projectRoot, "exec"), `
      const { readFileSync, writeFileSync } = require("node:fs");
      const output = process.argv[process.argv.indexOf("--output-last-message") + 1];
      if (process.argv.at(-1) !== "-") process.exit(4);
      process.stdout.write("ordinary CLI output\\n");
      writeFileSync(output, readFileSync(0, "utf8"));
    `);
    const agent = await repository.createAgent({
      workspaceId: workspace.id,
      name: "Codex fixture",
      type: "cli",
      provider: "codex",
      command: process.execPath,
      args: ["exec", "--", "{{prompt}}"],
      enabled: true,
      canJudge: false,
      shellAccess: true,
    });
    const prompt = "A literal {{workingDir}} and $&\n".repeat(1_000).trim();
    const result = await service.runTask({
      workspaceId: workspace.id,
      prompt,
      mode: "broadcast",
      agentIds: [agent.id],
    });

    const replay = await repository.getSessionReplay(result.sessionId);
    const run = replay?.tasks[0]?.runs[0];
    expect(run?.status).toBe("completed");
    expect(run?.finalText?.endsWith(prompt)).toBe(true);
    expect(replay?.events.some((event) => event.type === "stdout" && event.payload.includes("ordinary CLI output"))).toBe(true);
  });
});
