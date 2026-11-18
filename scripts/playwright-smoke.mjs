import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright";

import {
  createLocalServices,
  ensureSharedBuild,
  isFrontend,
  isOrchestrator,
  repoRoot,
  waitUntilReady,
} from "./local-services.mjs";

const host = "127.0.0.1";
const fixture = path.join(repoRoot, "scripts", "fixtures", "release-notes-agent.mjs");
const roles = [
  ["worker-a", "Worker A"],
  ["worker-b", "Worker B"],
  ["judge", "Judge"],
  ["implementer", "Implementer"],
];
const prompt = "Draft release notes that explain how council runs preserve the original project.";
const screenshotPath = path.resolve(repoRoot, process.env.HIVECLI_UI_SCREENSHOT || ".hivecli/playwright-smoke.png");
const services = createLocalServices();
let sandbox;
let browser;

async function getAvailablePorts() {
  const listeners = [net.createServer(), net.createServer()];
  try {
    return await Promise.all(listeners.map((server) => new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, host, () => resolve(server.address().port));
    })));
  } finally {
    await Promise.all(listeners.map((server) => new Promise((resolve) => server.close(resolve))));
  }
}

async function createRecord(base, endpoint, data) {
  const response = await fetch(base + endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(data),
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) {
    throw new Error(`POST ${endpoint} returned ${response.status}: ${await response.text()}`);
  }
  return response.json();
}

async function seedWorkspace(apiUrl, projectDir) {
  const workspace = await createRecord(apiUrl, "/api/workspaces", {
    name: "Release notes",
    rootPath: projectDir,
  });

  for (const [role, name] of roles) {
    await createRecord(apiUrl, "/api/agents", {
      workspaceId: workspace.id,
      name,
      type: "cli",
      provider: "fixture",
      command: process.execPath,
      args: [fixture, role, "{{workingDir}}", "{{prompt}}"],
      canJudge: role === "judge",
      shellAccess: true,
    });
  }
}

async function main() {
  await ensureSharedBuild(services);
  sandbox = await mkdtemp(path.join(os.tmpdir(), "hivecli-smoke-"));
  const projectDir = path.join(sandbox, "project");
  await mkdir(projectDir);
  const source = "# Local council fixture\n";
  await writeFile(path.join(projectDir, "README.md"), source);
  const [apiPort, webPort] = await getAvailablePorts();
  const apiUrl = `http://${host}:${apiPort}`;
  const webUrl = `http://${host}:${webPort}`;

  const orchestrator = services.start("Smoke orchestrator", ["--filter", "@hive/orchestrator", "exec",
    "tsx", "src/index.ts"], {
    NODE_ENV: "development",
    HIVECLI_HOST: host,
    HIVECLI_PORT: String(apiPort),
    HIVECLI_DB_PATH: path.join(sandbox, "hivecli.db"),
    HIVECLI_DATA_DIR: sandbox,
    HIVECLI_ALLOWED_ORIGINS: webUrl,
  });
  await waitUntilReady(orchestrator, apiUrl, isOrchestrator);
  await seedWorkspace(apiUrl, projectDir);

  const frontend = services.start("Smoke frontend", ["--filter", "@hive/desktop", "dev",
    "--host", host, "--port", String(webPort)], {
    VITE_ORCHESTRATOR_URL: apiUrl,
    VITE_ORCHESTRATOR_WS_URL: `ws://${host}:${apiPort}/ws`,
  });
  await waitUntilReady(frontend, webUrl, isFrontend);
  browser = await chromium.launch({
    headless: true,
    executablePath: process.env.HIVECLI_CHROMIUM_EXECUTABLE || undefined,
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.setDefaultTimeout(15000);
  await page.goto(webUrl, { waitUntil: "domcontentloaded" });
  await page.getByTestId("workspace-root-path").waitFor({ state: "visible" });
  await page.getByTestId("prompt-input").fill(prompt);
  const [taskResponse] = await Promise.all([
    page.waitForResponse((response) =>
      response.url() === apiUrl + "/api/tasks/run" && response.request().method() === "POST"),
    page.getByTestId("prompt-send").click(),
  ]);
  if (!taskResponse.ok()) {
    throw new Error(`Council run failed: ${await taskResponse.text()}`);
  }
  const { taskId, sessionId } = await taskResponse.json();

  await page.waitForFunction((labels) => labels.every((label) => {
    const status = document.querySelector(`[data-testid="status-${label}"]`);
    return (status?.dataset.status ?? status?.textContent?.trim().toLowerCase()) === "completed";
  }), roles.map(([label]) => label));

  const runPath = path.join(projectDir, "hivecli-runs", taskId);
  const publishPath = path.join(projectDir, "publish", taskId);
  await Promise.all([
    page.getByTestId("current-run-path").filter({ hasText: /hivecli-runs/i }).waitFor(),
    page.getByTestId("publish-path").filter({ hasText: /publish/i }).waitFor(),
  ]);

  const replayResponse = await fetch(apiUrl + "/api/sessions/" + sessionId, {
    signal: AbortSignal.timeout(5000),
  });
  assert(replayResponse.ok, "The completed session can be reopened.");
  const { tasks } = await replayResponse.json();
  const replay = tasks.find(({ task }) => task.id === taskId);
  assert.equal(replay?.task.prompt, prompt);
  const runs = replay.runs;
  assert.equal(runs?.length, roles.length);
  assert(runs.every((run) => run.status === "completed"), "All four fixture agents completed.");

  assert.equal(await readFile(path.join(projectDir, "README.md"), "utf8"), source);
  assert.equal(await readFile(path.join(runPath, "source", "README.md"), "utf8"), source);
  await assert.rejects(readFile(path.join(projectDir, "release-notes.md")), { code: "ENOENT" });
  const [workerA, workerB, published] = await Promise.all([
    path.join(runPath, "worker-a", "release-notes.md"),
    path.join(runPath, "worker-b", "release-notes.md"),
    path.join(publishPath, "release-notes.md"),
  ].map((file) => readFile(file, "utf8")));
  assert.notEqual(workerA, workerB, "Workers wrote different drafts.");
  assert.equal(published, workerA, "The published file matches the chosen draft.");

  await page.getByRole("link", { name: "Run history" }).click();
  await page.getByRole("heading", { name: prompt, exact: true }).waitFor();
  const savedWorker = page.locator(".history-task details").filter({
    has: page.locator("summary").getByText("Worker A", { exact: true }),
  });
  await savedWorker.locator("summary").click();
  await savedWorker.getByRole("button", { name: "Terminal" }).click();
  await savedWorker.locator(".xterm").waitFor();
  await page.getByRole("link", { name: "Council", exact: true }).click();
  await page.getByTestId("status-implementer").filter({ hasText: /completed/i }).waitFor();

  await mkdir(path.dirname(screenshotPath), { recursive: true });
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log("Playwright smoke passed. Four local fixture agents completed and the published result was verified.");
  console.log(`Screenshot: ${screenshotPath}`);
}

async function cleanup() {
  try {
    await browser?.close();
  } finally {
    await services.stop();
    if (sandbox) await rm(sandbox, { recursive: true, force: true });
  }
}

for (const [signal, code] of [["SIGHUP", 129], ["SIGINT", 130], ["SIGTERM", 143]]) {
  process.once(signal, () => void cleanup().finally(() => process.exit(code)));
}

try {
  await main();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await cleanup();
}
