import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

export const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const windows = process.platform === "win32";

export function createLocalServices() {
  const processes = [];
  let shutdown;

  function start(label, args, overrides = {}) {
    if (shutdown) throw new Error("Local services are shutting down.");
    const pnpmArgs = ["--silent", ...args];
    const command = windows ? process.env.ComSpec ?? "cmd.exe" : "pnpm";
    const commandArgs = windows ? ["/d", "/s", "/c", `pnpm ${pnpmArgs.join(" ")}`] : pnpmArgs;
    const child = spawn(command, commandArgs, {
      cwd: repoRoot,
      detached: !windows,
      env: { ...process.env, ...overrides },
      stdio: "inherit",
    });
    const done = new Promise((resolve) => {
      child.once("error", (error) => resolve({ error }));
      child.once("exit", (code, signal) => resolve({ code, signal }));
    });
    const service = { label, child, done };
    processes.push(service);
    return service;
  }

  async function stopProcesses() {
    for (const { child } of processes) {
      if (!child.pid) continue;
      if (windows) {
        if (child.exitCode === null && child.signalCode === null) {
          spawnSync("taskkill", ["/pid", String(child.pid), "/t", "/f"], { stdio: "ignore" });
        }
      } else {
        killGroup(child.pid, "SIGTERM");
      }
    }

    await Promise.race([Promise.all(processes.map(({ done }) => done)), delay(1500, undefined, { ref: false })]);
    if (!windows) {
      for (const { child } of processes) {
        if (child.pid) killGroup(child.pid, "SIGKILL");
      }
    }
  }

  return {
    start,
    stop() {
      shutdown ??= stopProcesses();
      return shutdown;
    },
  };
}

function killGroup(pid, signal) {
  try {
    process.kill(-pid, signal);
  } catch (error) {
    if (error.code !== "ESRCH") throw error;
  }
}

export function processFailure({ label }, { error, code, signal }) {
  return new Error(error ? `${label}: ${error.message}` : `${label} exited with ${signal ?? `code ${code}`}.`);
}

export async function ensureSharedBuild(services) {
  const sharedEntry = new URL("../packages/shared/dist/index.js", import.meta.url);
  if (!existsSync(sharedEntry)) {
    const build = services.start("Shared package build", ["--filter", "@hive/shared", "build"]);
    const result = await build.done;
    if (result.code !== 0) throw processFailure(build, result);
  }
}

async function requestOk(url, matches) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(1200), redirect: "error" });
    return response.ok && await matches(response);
  } catch {
    return false;
  }
}

export const isOrchestrator = (url) => requestOk(
  `${url}/health`,
  async (response) => (await response.json()).ok === true,
);

export const isFrontend = (url) => requestOk(
  url,
  async (response) => (await response.text()).includes('<script type="module" src="/src/main.tsx"'),
);

export async function waitUntilReady(service, url, isReady) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    const result = await Promise.race([
      isReady(url).then((ready) => ({ ready })),
      service.done,
    ]);
    if (!("ready" in result)) throw processFailure(service, result);
    if (result.ready) return;
    await delay(200);
  }
  throw new Error(`Timed out waiting for ${service.label} at ${url}.`);
}
