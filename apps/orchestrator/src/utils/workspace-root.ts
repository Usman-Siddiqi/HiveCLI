import fs from "node:fs/promises";
import path from "node:path";

import type { WorkspaceRootStatus } from "@hive/shared";

export async function getWorkspaceRootStatus(rootPath: string): Promise<WorkspaceRootStatus> {
  const trimmed = rootPath.trim();

  if (!trimmed) {
    return {
      rootPath,
      resolvedPath: null,
      exists: false,
      isDirectory: false,
      valid: false,
      error: "Project directory is not set.",
    };
  }

  const resolvedPath = path.resolve(trimmed);

  try {
    const stat = await fs.stat(resolvedPath);
    const isDirectory = stat.isDirectory();

    return {
      rootPath,
      resolvedPath,
      exists: true,
      isDirectory,
      valid: isDirectory,
      error: isDirectory ? null : "Project directory must point to a folder.",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Project directory could not be read.";

    return {
      rootPath,
      resolvedPath,
      exists: false,
      isDirectory: false,
      valid: false,
      error: message,
    };
  }
}

export async function requireWorkspaceRoot(rootPath: string) {
  const status = await getWorkspaceRootStatus(rootPath);

  if (!status.valid || !status.resolvedPath) {
    throw new Error(status.error ?? "Project directory is invalid.");
  }

  return status;
}
