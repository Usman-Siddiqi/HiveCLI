import { invoke } from "@tauri-apps/api/core";

function isTauriRuntime() {
  return "__TAURI_INTERNALS__" in window;
}

export async function pickDirectory() {
  if (!isTauriRuntime()) {
    return null;
  }

  try {
    const selected = await invoke<string | null>("pick_directory");
    return selected;
  } catch {
    return null;
  }
}
