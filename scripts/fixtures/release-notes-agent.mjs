import { writeFile } from "node:fs/promises";
import path from "node:path";

const [role, workingDir] = process.argv.slice(2);
const outputFile = "release-notes.md";

switch (role) {
  case "worker-a":
    await writeFile(path.join(workingDir, outputFile), [
      "# Council runs",
      "",
      "HiveCLI gives each worker its own copy of your project. The judge compares both copies and sends its recommendation to the implementer.",
      "",
      "Review the finished result under `publish/<task-id>`. Your original project stays in place.",
      "",
    ].join("\n"));
    console.log("Drafted release-notes.md with separate sections for worker copies and reviewing published results.");
    break;
  case "worker-b":
    await writeFile(path.join(workingDir, outputFile),
      "# Council runs\n\nWorkers edit separate copies. Open the published folder to review the result.\n");
    console.log("Wrote a shorter release note focused on the isolated copies and published result.");
    break;
  case "judge":
    console.log("Worker A names the publish path and explains when the implementer comes in. Use that version.");
    break;
  case "implementer":
    console.log("DECISION: COPY_WORKER_A");
    console.log("RATIONALE: Worker A tells readers where to find the result and what happens to the original project.");
    break;
  default:
    throw new Error(`Unknown fixture role: ${role}`);
}
