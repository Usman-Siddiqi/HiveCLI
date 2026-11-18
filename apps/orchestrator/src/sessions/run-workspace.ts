import { createHash } from "node:crypto";
import { createReadStream, constants } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { TextDecoder } from "node:util";

import { createTwoFilesPatch } from "diff";

const EXCLUDED_NAMES = new Set([
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
  ".ssh",
  ".aws",
  ".netrc",
  ".npmrc.local",
  ".envrc",
]);
const MAX_DIFF_BYTES = 200 * 1024;
const MAX_DIFF_FILES = 50;
const MAX_PATCH_CHARS = 24_000;
const MAX_INLINE_DIFF_PATHS = 30;

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

export function getWorkerDirectory(paths: RunWorkspacePaths, index: number) {
  return paths.workerDirs[index] ?? path.join(paths.runRootDir, `worker-${index + 1}`);
}

export async function prepareRunWorkspace(
  workspaceRoot: string,
  taskId: string,
  workerCount = 2,
  seedImplementer = false,
): Promise<PreparedRunWorkspace> {
  const paths = createRunWorkspacePaths(workspaceRoot, taskId);
  const warnings: string[] = [];

  await prepareOutputParent(paths.runRootDir);
  await fs.mkdir(paths.runRootDir);
  await fs.mkdir(paths.judgeDir);
  await fs.mkdir(paths.implementerDir);
  await copyTree(workspaceRoot, paths.sourceDir, warnings);
  for (let index = 0; index < workerCount; index += 1) {
    await copyTree(paths.sourceDir, getWorkerDirectory(paths, index), warnings);
  }
  if (seedImplementer) {
    await copyTree(paths.sourceDir, paths.implementerDir, warnings);
  }

  return { paths, warnings };
}

export async function generateJudgeArtifacts(paths: RunWorkspacePaths): Promise<JudgeArtifacts> {
  const warnings: string[] = [];
  const workerA = await compareTrees(paths.sourceDir, paths.workerDirs[0], warnings);
  const workerB = await compareTrees(paths.sourceDir, paths.workerDirs[1], warnings);
  const pathsA = new Set(workerA.changedPaths);
  const pathsB = new Set(workerB.changedPaths);

  const overlap = {
    bothChanged: workerA.changedPaths.filter((value) => pathsB.has(value)),
    onlyWorkerA: workerA.changedPaths.filter((value) => !pathsB.has(value)),
    onlyWorkerB: workerB.changedPaths.filter((value) => !pathsA.has(value)),
  };

  const diffPaths = [...new Set([...workerA.changedPaths, ...workerB.changedPaths])].sort();
  const binaryOrLarge: string[] = [];
  const diffSections: string[] = [];
  const omittedPatches: string[] = [];
  const candidates = [
    { label: "worker-a", manifest: workerA, changedPaths: pathsA, workingDir: paths.workerDirs[0] },
    { label: "worker-b", manifest: workerB, changedPaths: pathsB, workingDir: paths.workerDirs[1] },
  ] as const;
  let patchChars = 0;

  for (const relativePath of diffPaths.slice(0, MAX_DIFF_FILES)) {
    for (const { label, manifest, changedPaths, workingDir } of candidates) {
      if (!changedPaths.has(relativePath)) continue;
      if (patchChars >= MAX_PATCH_CHARS) {
        omittedPatches.push(`- ${label}: ${relativePath}`);
        continue;
      }
      const section = await createTextDiffSection({
        relativePath,
        workerLabel: label,
        sourcePath: manifest.added.includes(relativePath) ? undefined : path.join(paths.sourceDir, relativePath),
        workingPath: manifest.deleted.includes(relativePath) ? undefined : path.join(workingDir, relativePath),
      });
      if (section.binarySummary) {
        binaryOrLarge.push(section.binarySummary);
      } else if (section.patch && patchChars + section.patch.length <= MAX_PATCH_CHARS) {
        diffSections.push(section.patch);
        patchChars += section.patch.length;
      } else {
        omittedPatches.push(`- ${label}: ${relativePath}`);
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
      ? `Diff previews are limited to ${MAX_DIFF_FILES} changed files. See the manifests for the full paths list.`
      : "Diff previews are included below for text files within the size and complexity limits.",
    "",
    "## Text Diffs",
    diffSections.length > 0 ? diffSections.join("\n\n") : "No text diffs were generated.",
    "",
    "## Binary / Large Files",
    binaryOrLarge.length > 0 ? binaryOrLarge.join("\n") : "No binary or oversized file changes detected.",
    "",
    "## Omitted Diff Previews",
    omittedPatches.length > 0
      ? omittedPatches.join("\n")
      : "None.",
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

export function parseImplementerDecision(finalText: string): ImplementerDecision | undefined {
  const match = [...finalText.matchAll(/^\s*DECISION:\s*(COPY_WORKER_A|COPY_WORKER_B|MERGE)\s*$/gim)].at(-1);
  return match?.[1].toUpperCase() as ImplementerDecision | undefined;
}

export async function publishRunOutput(paths: RunWorkspacePaths, decision: ImplementerDecision) {
  const sources: Record<ImplementerDecision, string> = {
    COPY_WORKER_A: paths.workerDirs[0],
    COPY_WORKER_B: paths.workerDirs[1],
    MERGE: paths.implementerDir,
  };

  const publishSource = sources[decision];
  await prepareOutputParent(paths.publishDir);
  const stagingDir = await fs.mkdtemp(path.join(path.dirname(paths.publishDir), ".hivecli-stage-"));
  try {
    await copyTree(publishSource, stagingDir, []);
    if (!(await directoryHasFiles(stagingDir))) {
      throw new Error("The selected result has no files to publish.");
    }
    await fs.rename(stagingDir, paths.publishDir);
  } finally {
    await fs.rm(stagingDir, { recursive: true, force: true });
  }

  return {
    publishSource,
    publishDir: paths.publishDir,
  };
}

async function prepareOutputParent(output: string) {
  const parent = path.dirname(output);
  try {
    await fs.mkdir(parent);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }
  if (!(await fs.lstat(parent)).isDirectory()) {
    throw new Error(`Run output must be a regular directory: ${parent}`);
  }
}

function isExcluded(name: string, relativePath: string) {
  if (EXCLUDED_NAMES.has(name)) return true;
  if (name === ".env" || name.startsWith(".env.")) {
    return !/\.(example|sample|template)$/.test(name);
  }
  return relativePath.split(path.sep).slice(-2).join("/") === ".codex/auth.json";
}

async function copyTree(
  sourceDir: string,
  targetDir: string,
  warnings: string[],
  relativePath = "",
): Promise<void> {
  if (!(await fs.lstat(sourceDir)).isDirectory()) {
    throw new Error(`Snapshot source must be a regular directory: ${sourceDir}`);
  }
  await fs.mkdir(targetDir, { recursive: true });
  const entries = await fs.readdir(sourceDir, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);
    const nextRelative = relativePath ? path.join(relativePath, entry.name) : entry.name;
    if (isExcluded(entry.name, nextRelative)) continue;

    if (entry.isSymbolicLink()) {
      warnings.push(`Skipped symlink or junction: ${nextRelative}`);
      continue;
    }

    if (entry.isDirectory()) {
      await copyTree(sourcePath, targetPath, warnings, nextRelative);
      continue;
    }

    if (entry.isFile()) {
      await fs.copyFile(sourcePath, targetPath, constants.COPYFILE_FICLONE);
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

    if (await filesMatch(sourcePath, workingPath)) {
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

async function filesMatch(sourcePath: string, workingPath: string) {
  const [source, working] = await Promise.all([fs.stat(sourcePath), fs.stat(workingPath)]);
  if (source.size !== working.size || (source.mode & 0o111) !== (working.mode & 0o111)) return false;

  if (source.size > MAX_DIFF_BYTES) {
    const [sourceHash, workingHash] = await Promise.all([hashFile(sourcePath), hashFile(workingPath)]);
    return sourceHash === workingHash;
  }
  const [sourceBuffer, workingBuffer] = await Promise.all([fs.readFile(sourcePath), fs.readFile(workingPath)]);
  return sourceBuffer.equals(workingBuffer);
}

async function hashFile(filePath: string) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest("hex");
}

async function listFiles(rootDir: string, warnings: string[], relativeDir = ""): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const currentDir = relativeDir ? path.join(rootDir, relativeDir) : rootDir;
  if (!relativeDir && !(await fs.lstat(currentDir)).isDirectory()) {
    throw new Error(`Diff source must be a regular directory: ${currentDir}`);
  }
  const entries = await fs.readdir(currentDir, { withFileTypes: true });

  for (const entry of entries) {
    const relativePath = relativeDir ? path.join(relativeDir, entry.name) : entry.name;
    const absolutePath = path.join(currentDir, entry.name);

    if (isExcluded(entry.name, relativePath)) continue;
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

async function createTextDiffSection({ sourcePath, workingPath, relativePath, workerLabel }: {
  sourcePath?: string;
  workingPath?: string;
  relativePath: string;
  workerLabel: "worker-a" | "worker-b";
}) {
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
    { timeout: 40, maxEditLength: 10_000 },
  );

  return {
    patch: patch ? ["```diff", patch.trim(), "```"].join("\n") : null,
    binarySummary: null,
  };
}

async function readFileForDiff(filePath?: string) {
  if (!filePath) return { kind: "missing" as const, text: "" };
  try {
    const stat = await fs.lstat(filePath);
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
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { kind: "missing" as const, text: "" };
    }
    throw error;
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
  if (paths.length === 0) return "none";
  const preview = paths.slice(0, MAX_INLINE_DIFF_PATHS).join(", ");
  const omitted = paths.length - MAX_INLINE_DIFF_PATHS;
  return omitted > 0 ? `${preview} (+${omitted} more in the manifest)` : preview;
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
