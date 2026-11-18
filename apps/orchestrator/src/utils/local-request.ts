import type { IncomingMessage } from "node:http";

const trustedOrigins = new Set([
  "http://localhost:1420",
  "http://127.0.0.1:1420",
  "http://[::1]:1420",
  "tauri://localhost",
  "http://tauri.localhost",
  "https://tauri.localhost",
  ...(process.env.HIVECLI_ALLOWED_ORIGINS ?? "").split(",").map((origin) => origin.trim()).filter(Boolean),
]);

function hostname(value: string) {
  try {
    return new URL(value).hostname;
  } catch {
    return "";
  }
}

const trustedHosts = new Set([
  "localhost",
  "127.0.0.1",
  "[::1]",
  ...[...trustedOrigins].map(hostname).filter(Boolean),
]);

export function isTrustedLocalRequest({ headers }: IncomingMessage) {
  return trustedHosts.has(hostname(`http://${headers.host ?? ""}`)) &&
    (!headers.origin || trustedOrigins.has(headers.origin));
}
