/**
 * Cron wrapper: checks app_settings.puzzle_generation_cron_enabled before running.
 * If disabled, exits 0. Otherwise runs the command passed as args.
 *
 * Usage:
 *   npx tsx scripts/cron/run-if-enabled.ts npx tsx scripts/tr/generate-crossword.ts --count 1 --json
 *   npx tsx scripts/cron/run-if-enabled.ts sh /app/docker/cron/run-daily.sh
 */
import { createPool } from "../tr/_shared";
import { spawnSync } from "child_process";
import { resolve } from "path";

async function main(): Promise<void> {
  const pool = createPool();
  try {
    const { rows } = await pool.query(
      "SELECT value FROM app_settings WHERE key = 'puzzle_generation_cron_enabled'"
    );
    const v = rows[0]?.value;
    const enabled = v === true || v === "true";
    if (!enabled) {
      process.exit(0);
    }
  } finally {
    await pool.end();
  }

  const args = process.argv.slice(2);
  if (args.length === 0) {
    process.exit(1);
  }

  const result = spawnSync(args[0], args.slice(1), {
    stdio: "inherit",
    cwd: resolve(__dirname, "../.."),
    env: process.env,
  });
  process.exit(result.status ?? 0);
}

main().catch(() => process.exit(1));
