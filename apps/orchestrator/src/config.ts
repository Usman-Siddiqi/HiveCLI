import path from "node:path";

const root = process.cwd();

export const config = {
  host: process.env.HIVECLI_HOST ?? "127.0.0.1",
  port: Number(process.env.HIVECLI_PORT ?? 45231),
  dataDir: process.env.HIVECLI_DATA_DIR ?? path.join(root, "apps", "orchestrator", "data"),
  databasePath:
    process.env.HIVECLI_DB_PATH ??
    path.join(root, "apps", "orchestrator", "data", "hivecli.db"),
};
