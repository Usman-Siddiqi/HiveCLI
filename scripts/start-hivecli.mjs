import {
  createLocalServices,
  ensureSharedBuild,
  isFrontend,
  isOrchestrator,
  processFailure,
  waitUntilReady,
} from "./local-services.mjs";

const services = createLocalServices();
const useTauri = process.argv.includes("--tauri");
const desktopUrl = "http://127.0.0.1:1420";

async function main() {
  const port = Number(process.env.HIVECLI_PORT ?? 45231);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("HIVECLI_PORT must be an integer between 1 and 65535.");
  }

  const configuredHost = process.env.HIVECLI_HOST || "127.0.0.1";
  const host = configuredHost === "::" ? "::1" : configuredHost === "0.0.0.0" ? "127.0.0.1" : configuredHost;
  const address = host.includes(":") ? `[${host}]` : host;
  const orchestratorUrl = `http://${address}:${port}`;
  const runtimeEnv = {
    VITE_ORCHESTRATOR_URL: process.env.VITE_ORCHESTRATOR_URL ?? orchestratorUrl,
    VITE_ORCHESTRATOR_WS_URL: process.env.VITE_ORCHESTRATOR_WS_URL ?? `ws://${address}:${port}/ws`,
  };

  await ensureSharedBuild(services);
  const running = [];
  if (await isOrchestrator(orchestratorUrl)) {
    console.log(`HiveCLI orchestrator is already running at ${orchestratorUrl}.`);
  } else {
    const orchestrator = services.start("Orchestrator", ["--filter", "@hive/orchestrator", "dev"]);
    await waitUntilReady(orchestrator, orchestratorUrl, isOrchestrator);
    running.push(orchestrator);
  }

  if (useTauri) {
    running.push(services.start("Tauri shell", ["--filter", "@hive/desktop", "dev:tauri"], {
      ...runtimeEnv,
      HIVECLI_ORCHESTRATOR_URL: process.env.HIVECLI_ORCHESTRATOR_URL ?? runtimeEnv.VITE_ORCHESTRATOR_URL,
      HIVECLI_ORCHESTRATOR_WS_URL: process.env.HIVECLI_ORCHESTRATOR_WS_URL ?? runtimeEnv.VITE_ORCHESTRATOR_WS_URL,
    }));
  } else if (await isFrontend(desktopUrl)) {
    console.log(`HiveCLI frontend is already running at ${desktopUrl}.`);
  } else {
    const frontend = services.start("Frontend", ["--filter", "@hive/desktop", "dev"], runtimeEnv);
    await waitUntilReady(frontend, desktopUrl, isFrontend);
    running.push(frontend);
  }

  if (running.length === 0) return;
  const { service, result } = await Promise.race(
    running.map((service) => service.done.then((result) => ({ service, result }))),
  );
  if (service.label !== "Tauri shell" || result.code !== 0) {
    throw processFailure(service, result);
  }
}

let stopping = false;
async function stopOnSignal(exitCode) {
  if (stopping) return;
  stopping = true;
  await services.stop();
  process.exit(exitCode);
}

for (const [signal, code] of [["SIGHUP", 129], ["SIGINT", 130], ["SIGTERM", 143]]) {
  process.on(signal, () => void stopOnSignal(code));
}

try {
  await main();
} catch (error) {
  if (!stopping) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
} finally {
  if (!stopping) await services.stop();
}
