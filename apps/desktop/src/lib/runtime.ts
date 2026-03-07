import { invoke } from "@tauri-apps/api/core";

import type { RuntimeConfig } from "@/types/tauri";

const browserFallback = {
  orchestratorUrl:
    import.meta.env.VITE_ORCHESTRATOR_URL ?? "http://127.0.0.1:45231",
  websocketUrl:
    import.meta.env.VITE_ORCHESTRATOR_WS_URL ?? "ws://127.0.0.1:45231/ws",
} satisfies RuntimeConfig;

export async function getRuntimeConfig(): Promise<RuntimeConfig> {
  if (!("__TAURI_INTERNALS__" in window)) {
    return browserFallback;
  }

  try {
    return await invoke<RuntimeConfig>("get_runtime_config");
  } catch {
    return browserFallback;
  }
}
