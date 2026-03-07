import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { config } from "../config";

export function createDatabase(databasePath = config.databasePath) {
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  const sqlite = new DatabaseSync(databasePath);
  sqlite.exec("pragma journal_mode = WAL;");
  return { sqlite, db: sqlite };
}
