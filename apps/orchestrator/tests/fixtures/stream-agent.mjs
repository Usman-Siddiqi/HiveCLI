import process from "node:process";

const label = process.argv[2] ?? "agent";
const prompt = await new Promise((resolve) => {
  let value = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => {
    value += chunk;
  });
  process.stdin.on("end", () => resolve(value.trim()));
});

process.stdout.write(`[${label}] received prompt\n`);
await new Promise((resolve) => setTimeout(resolve, 25));
process.stdout.write(`[${label}] thinking...\n`);
await new Promise((resolve) => setTimeout(resolve, 25));
process.stdout.write(`[${label}] final: ${prompt}\n`);
