#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::Serialize;

#[derive(Clone, Serialize)]
struct RuntimeConfig {
    orchestrator_url: String,
    websocket_url: String,
}

#[tauri::command]
fn get_runtime_config() -> RuntimeConfig {
    let orchestrator_url =
        std::env::var("HIVECLI_ORCHESTRATOR_URL").unwrap_or_else(|_| "http://127.0.0.1:45231".into());
    let websocket_url =
        std::env::var("HIVECLI_ORCHESTRATOR_WS_URL").unwrap_or_else(|_| "ws://127.0.0.1:45231/ws".into());

    RuntimeConfig {
        orchestrator_url,
        websocket_url,
    }
}

#[tauri::command]
fn pick_directory() -> Option<String> {
    rfd::FileDialog::new()
        .pick_folder()
        .map(|path| path.to_string_lossy().into_owned())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![get_runtime_config, pick_directory])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
