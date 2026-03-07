import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const orchestratorHealthUrl = "http://127.0.0.1:45231/health";
const useTauri = process.argv.includes("--tauri");
const children = [];

function prefixStream(stream, prefix) {
  let buffer = "";

  stream.setEncoding("utf8");
  stream.on("data", (chunk) => {
    buffer += chunk;
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.trim()) {
        continue;
      }
      console.log(`[${prefix}] ${line}`);
    }
  });

  stream.on("end", () => {
    if (buffer.trim()) {
      console.log(`[${prefix}] ${buffer}`);
    }
  });
}

function spawnPnpm(label, args) {
  const child =
    process.platform === "win32"
      ? spawn(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", `pnpm ${args.join(" ")}`], {
          cwd: repoRoot,
          env: process.env,
          stdio: ["ignore", "pipe", "pipe"],
          windowsHide: false,
        })
      : spawn("pnpm", args, {
          cwd: repoRoot,
          env: process.env,
          stdio: ["ignore", "pipe", "pipe"],
          windowsHide: false,
        });

  prefixStream(child.stdout, label);
  prefixStream(child.stderr, `${label}:err`);
  children.push(child);
  return child;
}

async function isHealthy() {
  try {
    const response = await fetch(orchestratorHealthUrl);
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForHealth(orchestrator, timeoutMs = 30000) {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    if (await isHealthy()) {
      return;
    }

    if (orchestrator.exitCode !== null) {
      throw new Error(`Orchestrator exited early with code ${orchestrator.exitCode}.`);
    }

    await delay(750);
  }

  throw new Error("Timed out waiting for the orchestrator to become ready on 127.0.0.1:45231.");
}

async function main() {
  if (await isHealthy()) {
    console.log("HiveCLI orchestrator already running on 127.0.0.1:45231");
  } else {
    console.log("Starting HiveCLI orchestrator...");
    const orchestrator = spawnPnpm("orchestrator", ["--filter", "@hive/orchestrator", "dev"]);
    await waitForHealth(orchestrator);
  }

  if (useTauri) {
    console.log("Starting HiveCLI desktop shell...");
    const desktop = spawnPnpm("desktop", ["--filter", "@hive/desktop", "dev:tauri"]);
    desktop.on("exit", (code) => {
      process.exit(code ?? 0);
    });
    return;
  }

  console.log("Starting HiveCLI frontend at http://localhost:1420 ...");
  const desktop = spawnPnpm("desktop", ["--filter", "@hive/desktop", "dev"]);
  desktop.on("exit", (code) => {
    process.exit(code ?? 0);
  });
}

function shutdown(signal) {
  for (const child of children) {
    if (child.exitCode === null) {
      child.kill(signal);
    }
  }
}

process.on("SIGINT", () => {
  shutdown("SIGINT");
  process.exit(130);
});

process.on("SIGTERM", () => {
  shutdown("SIGTERM");
  process.exit(143);
});

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  shutdown("SIGTERM");
  process.exit(1);
});
