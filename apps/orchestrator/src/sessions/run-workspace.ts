import fs from "node:fs/promises";
import path from "node:path";
import { TextDecoder } from "node:util";

import { createTwoFilesPatch } from "diff";

const EXCLUDED_ROOT_NAMES = new Set([
  "hivecli-runs",
  "publish",
  ".hivecli",
  ".git",
  "node_modules",
  "dist",
  "build",
  ".turbo",
  ".vite",
  ".cache",
  "coverage",
  "target",
  ".next",
  ".nuxt",
  "out",
  "output",
]);
const MAX_DIFF_BYTES = 200 * 1024;
const MAX_DIFF_FILES = 50;

const textDecoder = new TextDecoder("utf-8", { fatal: true });

export interface RunWorkspacePaths {
  workspaceRoot: string;
  runRootDir: string;
  sourceDir: string;
  judgeDir: string;
  implementerDir: string;
  publishDir: string;
  workerDirs: [string, string];
}

export interface PreparedRunWorkspace {
  paths: RunWorkspacePaths;
  warnings: string[];
}

interface WorkerManifest {
  added: string[];
  modified: string[];
  deleted: string[];
  changedPaths: string[];
  unchangedCount: number;
}

export interface JudgeArtifacts {
  artifactPaths: string[];
  diffSummary: string;
  warnings: string[];
  workerManifests: {
    workerA: WorkerManifest;
    workerB: WorkerManifest;
  };
}

export type ImplementerDecision = "COPY_WORKER_A" | "COPY_WORKER_B" | "MERGE";

export function createRunWorkspacePaths(workspaceRoot: string, taskId: string): RunWorkspacePaths {
  const runRootDir = path.join(workspaceRoot, "hivecli-runs", taskId);

  return {
    workspaceRoot,
    runRootDir,
    sourceDir: path.join(runRootDir, "source"),
    judgeDir: path.join(runRootDir, "judge"),
    implementerDir: path.join(runRootDir, "implementer"),
    publishDir: path.join(workspaceRoot, "publish", taskId),
    workerDirs: [
      path.join(runRootDir, "worker-a"),
      path.join(runRootDir, "worker-b"),
    ],
  };
}

export async function prepareRunWorkspace(workspaceRoot: string, taskId: string): Promise<PreparedRunWorkspace> {
  const paths = createRunWorkspacePaths(workspaceRoot, taskId);
  const warnings: string[] = [];

  await fs.rm(paths.runRootDir, { recursive: true, force: true });
  await fs.mkdir(paths.runRootDir, { recursive: true });
  await fs.mkdir(paths.sourceDir, { recursive: true });
  await fs.mkdir(paths.judgeDir, { recursive: true });
  await fs.mkdir(paths.implementerDir, { recursive: true });

  await copyTree(workspaceRoot, paths.sourceDir, warnings, EXCLUDED_ROOT_NAMES);
  await copyTree(paths.sourceDir, paths.workerDirs[0], warnings);
  await copyTree(paths.sourceDir, paths.workerDirs[1], warnings);

  return { paths, warnings };
}

export async function generateJudgeArtifacts(paths: RunWorkspacePaths): Promise<JudgeArtifacts> {
  const warnings: string[] = [];
  const workerA = await compareTrees(paths.sourceDir, paths.workerDirs[0], warnings);
  const workerB = await compareTrees(paths.sourceDir, paths.workerDirs[1], warnings);

  const overlap = {
    bothChanged: workerA.changedPaths.filter((value) => workerB.changedPaths.includes(value)),
    onlyWorkerA: workerA.changedPaths.filter((value) => !workerB.changedPaths.includes(value)),
    onlyWorkerB: workerB.changedPaths.filter((value) => !workerA.changedPaths.includes(value)),
  };

  const diffPaths = [...new Set([...workerA.changedPaths, ...workerB.changedPaths])].sort();
  const binaryOrLarge: string[] = [];
  const diffSections: string[] = [];

  for (const relativePath of diffPaths.slice(0, MAX_DIFF_FILES)) {
    if (workerA.changedPaths.includes(relativePath)) {
      const section = await createTextDiffSection(paths.sourceDir, paths.workerDirs[0], relativePath, "worker-a");
      if (section.binarySummary) {
        binaryOrLarge.push(section.binarySummary);
      } else if (section.patch) {
        diffSections.push(section.patch);
      }
    }

    if (workerB.changedPaths.includes(relativePath)) {
      const section = await createTextDiffSection(paths.sourceDir, paths.workerDirs[1], relativePath, "worker-b");
      if (section.binarySummary) {
        binaryOrLarge.push(section.binarySummary);
      } else if (section.patch) {
        diffSections.push(section.patch);
      }
    }
  }

  const diffSummary = [
    "# Judge Diff Summary",
    "",
    "## Worker A",
    summarizeManifest(workerA),
    "",
    "## Worker B",
    summarizeManifest(workerB),
    "",
    "## Overlap",
    `Both changed: ${formatPaths(overlap.bothChanged)}`,
    `Only Worker A: ${formatPaths(overlap.onlyWorkerA)}`,
    `Only Worker B: ${formatPaths(overlap.onlyWorkerB)}`,
    "",
    diffPaths.length > MAX_DIFF_FILES
      ? `Only the first ${MAX_DIFF_FILES} changed files are expanded inline. ${diffPaths.length - MAX_DIFF_FILES} additional changed files were omitted.`
      : "All changed files are included below when they were text-like and within the size cap.",
    "",
    "## Text Diffs",
    diffSections.length > 0 ? diffSections.join("\n\n") : "No text diffs were generated.",
    "",
    "## Binary / Large Files",
    binaryOrLarge.length > 0 ? binaryOrLarge.join("\n") : "No binary or oversized file changes detected.",
    "",
    "## Warnings",
    warnings.length > 0 ? warnings.join("\n") : "No warnings.",
  ].join("\n");

  const workerAManifestPath = path.join(paths.judgeDir, "worker-a-manifest.json");
  const workerBManifestPath = path.join(paths.judgeDir, "worker-b-manifest.json");
  const overlapPath = path.join(paths.judgeDir, "overlap-summary.json");
  const diffSummaryPath = path.join(paths.judgeDir, "diff-summary.md");

  await fs.writeFile(workerAManifestPath, JSON.stringify(workerA, null, 2));
  await fs.writeFile(workerBManifestPath, JSON.stringify(workerB, null, 2));
  await fs.writeFile(overlapPath, JSON.stringify(overlap, null, 2));
  await fs.writeFile(diffSummaryPath, diffSummary);

  return {
    artifactPaths: [workerAManifestPath, workerBManifestPath, overlapPath, diffSummaryPath],
    diffSummary,
    warnings,
    workerManifests: {
      workerA,
      workerB,
    },
  };
}

export function parseImplementerDecision(finalText: string): ImplementerDecision {
  const match = finalText.match(/^\s*DECISION:\s*(COPY_WORKER_A|COPY_WORKER_B|MERGE)\s*$/im);
  return (match?.[1] as ImplementerDecision | undefined) ?? "MERGE";
}

export async function publishRunOutput(paths: RunWorkspacePaths, decision: ImplementerDecision) {
  let publishSource = paths.implementerDir;

  if (decision === "COPY_WORKER_A" || decision === "COPY_WORKER_B") {
    const workerSource = decision === "COPY_WORKER_A" ? paths.workerDirs[0] : paths.workerDirs[1];
    await fs.rm(paths.implementerDir, { recursive: true, force: true });
    await copyTree(workerSource, paths.implementerDir, []);
    publishSource = paths.implementerDir;
  }

  const implementerHasFiles = await directoryHasFiles(paths.implementerDir);
  if (!implementerHasFiles) {
    throw new Error("Implementer folder is empty. No publishable output was produced.");
  }

  await fs.rm(paths.publishDir, { recursive: true, force: true });
  await copyTree(publishSource, paths.publishDir, []);

  return {
    publishSource,
    publishDir: paths.publishDir,
  };
}

async function copyTree(
  sourceDir: string,
  targetDir: string,
  warnings: string[],
  excludedNames = new Set<string>(),
  relativePath = "",
): Promise<void> {
  await fs.mkdir(targetDir, { recursive: true });
  const entries = await fs.readdir(sourceDir, { withFileTypes: true });

  for (const entry of entries) {
    if (excludedNames.has(entry.name)) {
      continue;
    }

    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);
    const nextRelative = relativePath ? path.join(relativePath, entry.name) : entry.name;

    if (entry.isSymbolicLink()) {
      warnings.push(`Skipped symlink or junction: ${nextRelative}`);
      continue;
    }

    if (entry.isDirectory()) {
      await copyTree(sourcePath, targetPath, warnings, excludedNames, nextRelative);
      continue;
    }

    if (entry.isFile()) {
      await fs.mkdir(path.dirname(targetPath), { recursive: true });
      await fs.copyFile(sourcePath, targetPath);
    }
  }
}

async function compareTrees(sourceDir: string, workingDir: string, warnings: string[]): Promise<WorkerManifest> {
  const sourceFiles = await listFiles(sourceDir, warnings);
  const workingFiles = await listFiles(workingDir, warnings);
  const allPaths = [...new Set([...sourceFiles.keys(), ...workingFiles.keys()])].sort();

  const added: string[] = [];
  const modified: string[] = [];
  const deleted: string[] = [];
  let unchangedCount = 0;

  for (const relativePath of allPaths) {
    const sourcePath = sourceFiles.get(relativePath);
    const workingPath = workingFiles.get(relativePath);

    if (!sourcePath && workingPath) {
      added.push(relativePath);
      continue;
    }

    if (sourcePath && !workingPath) {
      deleted.push(relativePath);
      continue;
    }

    if (!sourcePath || !workingPath) {
      continue;
    }

    const [sourceBuffer, workingBuffer] = await Promise.all([
      fs.readFile(sourcePath),
      fs.readFile(workingPath),
    ]);

    if (Buffer.compare(sourceBuffer, workingBuffer) === 0) {
      unchangedCount += 1;
    } else {
      modified.push(relativePath);
    }
  }

  return {
    added,
    modified,
    deleted,
    changedPaths: [...added, ...modified, ...deleted].sort(),
    unchangedCount,
  };
}

async function listFiles(rootDir: string, warnings: string[], relativeDir = ""): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const currentDir = relativeDir ? path.join(rootDir, relativeDir) : rootDir;
  const entries = await fs.readdir(currentDir, { withFileTypes: true });

  for (const entry of entries) {
    const relativePath = relativeDir ? path.join(relativeDir, entry.name) : entry.name;
    const absolutePath = path.join(currentDir, entry.name);

    if (entry.isSymbolicLink()) {
      warnings.push(`Skipped symlink or junction during diff: ${relativePath}`);
      continue;
    }

    if (entry.isDirectory()) {
      const nested = await listFiles(rootDir, warnings, relativePath);
      for (const [nestedRelativePath, nestedAbsolutePath] of nested) {
        result.set(nestedRelativePath, nestedAbsolutePath);
      }
      continue;
    }

    if (entry.isFile()) {
      result.set(relativePath, absolutePath);
    }
  }

  return result;
}

async function createTextDiffSection(
  sourceDir: string,
  workingDir: string,
  relativePath: string,
  workerLabel: "worker-a" | "worker-b",
) {
  const sourcePath = path.join(sourceDir, relativePath);
  const workingPath = path.join(workingDir, relativePath);

  const sourceInfo = await readFileForDiff(sourcePath);
  const workingInfo = await readFileForDiff(workingPath);

  if (sourceInfo.kind === "binary" || sourceInfo.kind === "large" || workingInfo.kind === "binary" || workingInfo.kind === "large") {
    return {
      patch: null,
      binarySummary: `- ${workerLabel}: ${relativePath} (${sourceInfo.kind === "missing" ? "created/deleted" : sourceInfo.kind}/${workingInfo.kind})`,
    };
  }

  const patch = createTwoFilesPatch(
    `source/${relativePath}`,
    `${workerLabel}/${relativePath}`,
    sourceInfo.text,
    workingInfo.text,
    "source",
    workerLabel,
  ).trim();

  return {
    patch: ["```diff", patch, "```"].join("\n"),
    binarySummary: null,
  };
}

async function readFileForDiff(filePath: string) {
  try {
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) {
      return { kind: "missing" as const, text: "" };
    }

    if (stat.size > MAX_DIFF_BYTES) {
      return { kind: "large" as const, text: "" };
    }

    const buffer = await fs.readFile(filePath);
    if (!isUtf8Text(buffer)) {
      return { kind: "binary" as const, text: "" };
    }

    return { kind: "text" as const, text: buffer.toString("utf8") };
  } catch {
    return { kind: "missing" as const, text: "" };
  }
}

function isUtf8Text(buffer: Buffer) {
  if (buffer.includes(0)) {
    return false;
  }

  try {
    textDecoder.decode(buffer);
    return true;
  } catch {
    return false;
  }
}

function summarizeManifest(manifest: WorkerManifest) {
  return [
    `Added: ${formatPaths(manifest.added)}`,
    `Modified: ${formatPaths(manifest.modified)}`,
    `Deleted: ${formatPaths(manifest.deleted)}`,
    `Unchanged files: ${manifest.unchangedCount}`,
  ].join("\n");
}

function formatPaths(paths: string[]) {
  return paths.length > 0 ? paths.join(", ") : "none";
}

async function directoryHasFiles(rootDir: string): Promise<boolean> {
  const entries = await fs.readdir(rootDir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isFile()) {
      return true;
    }

    if (entry.isDirectory()) {
      if (await directoryHasFiles(path.join(rootDir, entry.name))) {
        return true;
      }
    }
  }

  return false;
}
