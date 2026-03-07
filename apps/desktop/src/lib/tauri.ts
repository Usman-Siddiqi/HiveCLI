export async function resolveOrchestratorUrl(): Promise<string> {
  if (typeof window === "undefined") {
    return "http://127.0.0.1:4317";
  }

  const override = (window as Window & { __HIVE_ORCHESTRATOR_URL__?: string }).__HIVE_ORCHESTRATOR_URL__;
  if (override) {
    return override;
  }

  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const value = await invoke<string>("get_orchestrator_url");
    if (value) {
      return value;
    }
  } catch {
    // Browser mode falls back to localhost.
  }

  return "http://127.0.0.1:4317";
}
