import fs from "node:fs";
import path from "node:path";

function resolveRepoRoot(startDir = process.cwd()) {
  let current = path.resolve(startDir);

  while (true) {
    if (fs.existsSync(path.join(current, "pnpm-workspace.yaml"))) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return path.resolve(startDir);
    }

    current = parent;
  }
}

const root = resolveRepoRoot();

export const config = {
  host: process.env.HIVECLI_HOST ?? "127.0.0.1",
  port: Number(process.env.HIVECLI_PORT ?? 45231),
  dataDir: process.env.HIVECLI_DATA_DIR ?? path.join(root, "apps", "orchestrator", "data"),
  databasePath:
    process.env.HIVECLI_DB_PATH ??
    path.join(root, "apps", "orchestrator", "data", "hivecli.db"),
};
