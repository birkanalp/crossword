import { spawnSync } from "node:child_process";

type CliOptions = {
  dryRun: boolean;
  maxLen: number;
};

function parseArgs(argv: string[]): CliOptions {
  let dryRun = false;
  let maxLen = 12;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dryRun") {
      dryRun = true;
      continue;
    }
    if (arg === "--maxLen") {
      const value = Number.parseInt(argv[i + 1] ?? "", 10);
      if (!Number.isFinite(value) || value < 3 || value > 20) {
        throw new Error("--maxLen must be an integer in range [3, 20].");
      }
      maxLen = value;
      i += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return { dryRun, maxLen };
}

function run(command: string, args: string[]): void {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env: process.env,
    shell: false,
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function main(): void {
  const options = parseArgs(process.argv.slice(2));
  const ingestArgs = ["tsx", "scripts/tr/ingest-sources.ts", "--maxLen", String(options.maxLen)];
  const frequencyArgs = ["tsx", "scripts/tr/apply-frequency.ts"];

  if (options.dryRun) {
    ingestArgs.push("--dryRun");
    frequencyArgs.push("--dryRun");
  }

  run("npx", ingestArgs);
  run("npx", frequencyArgs);
}

main();
