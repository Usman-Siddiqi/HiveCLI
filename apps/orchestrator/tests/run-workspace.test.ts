import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  generateJudgeArtifacts,
  parseImplementerDecision,
  prepareRunWorkspace,
} from "../src/sessions/run-workspace";
import { getWorkspaceRootStatus } from "../src/utils/workspace-root";

describe("run-workspace", () => {
  it("copies source while excluding hivecli folders and git metadata", async () => {
    const projectRoot = path.join(os.tmpdir(), `hivecli-copy-${Date.now()}`);
    await fs.mkdir(path.join(projectRoot, ".git"), { recursive: true });
    await fs.mkdir(path.join(projectRoot, ".hivecli"), { recursive: true });
    await fs.mkdir(path.join(projectRoot, "publish"), { recursive: true });
    await fs.writeFile(path.join(projectRoot, "app.ts"), "console.log('ok');\n");
    await fs.writeFile(path.join(projectRoot, ".git", "HEAD"), "ref: main\n");
    await fs.writeFile(path.join(projectRoot, ".hivecli", "state.txt"), "ignored\n");

    const prepared = await prepareRunWorkspace(projectRoot, "task-1");

    await expect(fs.stat(path.join(prepared.paths.sourceDir, "app.ts"))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(prepared.paths.sourceDir, ".git"))).rejects.toBeTruthy();
    await expect(fs.stat(path.join(prepared.paths.sourceDir, ".hivecli"))).rejects.toBeTruthy();
    await expect(fs.stat(path.join(prepared.paths.workerDirs[0], "app.ts"))).resolves.toBeTruthy();
  });

  it("builds judge artifacts from worker folder differences", async () => {
    const projectRoot = path.join(os.tmpdir(), `hivecli-diff-${Date.now()}`);
    await fs.mkdir(projectRoot, { recursive: true });
    await fs.writeFile(path.join(projectRoot, "index.ts"), "const value = 1;\n");

    const prepared = await prepareRunWorkspace(projectRoot, "task-2");
    await fs.writeFile(path.join(prepared.paths.workerDirs[0], "index.ts"), "const value = 2;\n");
    await fs.writeFile(path.join(prepared.paths.workerDirs[1], "new-file.ts"), "export const answer = 42;\n");

    const artifacts = await generateJudgeArtifacts(prepared.paths);

    expect(artifacts.workerManifests.workerA.modified).toContain("index.ts");
    expect(artifacts.workerManifests.workerB.added).toContain("new-file.ts");
    expect(artifacts.diffSummary).toContain("worker-a/index.ts");
    expect(artifacts.diffSummary).toContain("worker-b/new-file.ts");
  });

  it("parses implementer decisions and defaults to merge", () => {
    expect(parseImplementerDecision("DECISION: COPY_WORKER_B\nRATIONALE: Better tests.")).toBe("COPY_WORKER_B");
    expect(parseImplementerDecision("No structured block here.")).toBe("MERGE");
  });

  it("validates workspace root paths", async () => {
    const existingDir = path.join(os.tmpdir(), `hivecli-root-${Date.now()}`);
    await fs.mkdir(existingDir, { recursive: true });

    await expect(getWorkspaceRootStatus(existingDir)).resolves.toMatchObject({
      valid: true,
      isDirectory: true,
    });
    await expect(getWorkspaceRootStatus(path.join(existingDir, "missing"))).resolves.toMatchObject({
      valid: false,
      exists: false,
    });
  });
});
