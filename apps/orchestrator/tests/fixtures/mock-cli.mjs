import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

function getArg(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) {
    return undefined;
  }

  return process.argv[index + 1];
}

const label = getArg("--label") ?? "agent";
const prompt = getArg("--prompt") ?? "no prompt";
const delay = Number(getArg("--delay") ?? "10");
const workingDir = getArg("--working-dir");
const decision = getArg("--decision") ?? "MERGE";

process.stdout.write(`[${label}] preparing\n`);

setTimeout(() => {
  process.stdout.write(`[${label}] prompt:${prompt}\n`);
}, delay);

setTimeout(async () => {
  if (workingDir && label !== "judge") {
    await fs.mkdir(workingDir, { recursive: true });
  }

  if (workingDir && label === "worker-a") {
    await fs.writeFile(path.join(workingDir, "worker-a.txt"), `A:${prompt}\n`);
  }

  if (workingDir && label === "worker-b") {
    await fs.writeFile(path.join(workingDir, "worker-b.txt"), `B:${prompt}\n`);
  }

  if (label === "implementer") {
    process.stdout.write(`DECISION: ${decision}\n`);
    process.stdout.write("RATIONALE: Fixture choice.\n");
  } else {
    process.stdout.write(`[${label}] done\n`);
  }

  process.exit(0);
}, delay * 2);
