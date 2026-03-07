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

process.stdout.write(`[${label}] preparing\n`);

setTimeout(() => {
  process.stdout.write(`[${label}] prompt:${prompt}\n`);
}, delay);

setTimeout(() => {
  process.stdout.write(`[${label}] done\n`);
  process.exit(0);
}, delay * 2);
