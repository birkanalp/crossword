import path from "node:path";
import { createPool } from "./tr/_shared";
import { triggerGeneration } from "./shared/triggerGeneration";

type Difficulty = "easy" | "medium" | "hard" | "expert";

const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard", "expert"];
const SEED_THRESHOLD = 0;         // generate if approved count equals this
const SEED_COUNT = 100;           // how many to generate on first boot
const LOW_STOCK_THRESHOLD = 10;   // generate if unviewed approved < this
const LOW_STOCK_COUNT = 50;       // how many to generate when low
const POLL_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
const GENERATING_LOCK_TTL_MS = 10 * 60 * 1000; // 10 minutes

const supabaseUrl = process.env.SUPABASE_URL ?? "";
const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.SERVICE_ROLE_KEY ??
  "";
// __dirname works correctly in CommonJS (no "type":"module" in package.json)
const projectRoot = path.resolve(__dirname, "..");

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    "[worker] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required",
  );
  process.exit(1);
}

// Per-difficulty lock: prevents duplicate spawns if a previous generation
// run is still in progress when the next interval fires.
const isGenerating: Record<Difficulty, boolean> = {
  easy: false,
  medium: false,
  hard: false,
  expert: false,
};

// ── DB helpers ────────────────────────────────────────────────────────────────

async function getApprovedCounts(): Promise<Record<Difficulty, number>> {
  const pool = createPool();
  try {
    const { rows } = await pool.query<{
      target_difficulty: Difficulty;
      total: string;
    }>(`
      SELECT target_difficulty, COUNT(*) AS total
      FROM levels
      WHERE review_status = 'approved'
        AND deleted_at IS NULL
      GROUP BY target_difficulty
    `);
    const result: Record<Difficulty, number> = {
      easy: 0,
      medium: 0,
      hard: 0,
      expert: 0,
    };
    for (const row of rows) {
      result[row.target_difficulty] = parseInt(row.total, 10);
    }
    return result;
  } finally {
    await pool.end();
  }
}

async function getUnviewedCounts(): Promise<Record<Difficulty, number>> {
  const pool = createPool();
  try {
    const { rows } = await pool.query<{
      target_difficulty: Difficulty;
      unviewed: string;
    }>(`
      SELECT target_difficulty, COUNT(*) AS unviewed
      FROM levels
      WHERE review_status = 'approved'
        AND has_viewed = false
        AND deleted_at IS NULL
      GROUP BY target_difficulty
    `);
    const result: Record<Difficulty, number> = {
      easy: 0,
      medium: 0,
      hard: 0,
      expert: 0,
    };
    for (const row of rows) {
      result[row.target_difficulty] = parseInt(row.unviewed, 10);
    }
    return result;
  } finally {
    await pool.end();
  }
}

// ── Generation trigger ────────────────────────────────────────────────────────

async function generate(difficulty: Difficulty, count: number): Promise<void> {
  isGenerating[difficulty] = true;
  console.log(
    `[worker] triggering generation: difficulty=${difficulty} count=${count}`,
  );
  try {
    const { ids } = await triggerGeneration({
      difficulty,
      count,
      supabaseUrl,
      serviceRoleKey,
      projectRoot,
    });
    console.log(
      `[worker] spawned ${difficulty}: ${ids.length} placeholder(s) created`,
    );
  } catch (err) {
    console.error(`[worker] triggerGeneration failed for ${difficulty}:`, err);
  } finally {
    // Generation script runs detached. Release the lock after GENERATING_LOCK_TTL_MS
    // so the next interval can re-check if something went wrong.
    setTimeout(() => {
      isGenerating[difficulty] = false;
      console.log(`[worker] generation lock cleared for ${difficulty}`);
    }, GENERATING_LOCK_TTL_MS);
  }
}

// ── Startup seed check ────────────────────────────────────────────────────────

async function runSeedCheck(): Promise<void> {
  console.log("[worker] running startup seed check...");
  let counts: Record<Difficulty, number>;
  try {
    counts = await getApprovedCounts();
  } catch (err) {
    console.error("[worker] seed check failed to query DB:", err);
    return;
  }

  for (const difficulty of DIFFICULTIES) {
    const total = counts[difficulty];
    console.log(
      `[worker] seed check: ${difficulty} approved=${total}`,
    );
    if (total === SEED_THRESHOLD) {
      await generate(difficulty, SEED_COUNT);
    }
  }
  console.log("[worker] seed check complete");
}

// ── 30-minute stock poll ──────────────────────────────────────────────────────

async function runStockPoll(): Promise<void> {
  console.log("[worker] running stock poll...");
  let counts: Record<Difficulty, number>;
  try {
    counts = await getUnviewedCounts();
  } catch (err) {
    console.error("[worker] stock poll failed to query DB:", err);
    return;
  }

  for (const difficulty of DIFFICULTIES) {
    const unviewed = counts[difficulty];
    console.log(
      `[worker] stock poll: ${difficulty} unviewed_approved=${unviewed}`,
    );
    if (unviewed < LOW_STOCK_THRESHOLD && !isGenerating[difficulty]) {
      await generate(difficulty, LOW_STOCK_COUNT);
    }
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

console.log("[worker] Bulmaca generation worker starting...");
console.log(`[worker] poll interval: ${POLL_INTERVAL_MS / 60000} minutes`);
console.log(`[worker] seed: approved=0 → generate ${SEED_COUNT}`);
console.log(`[worker] low-stock: unviewed<${LOW_STOCK_THRESHOLD} → generate ${LOW_STOCK_COUNT}`);

// Graceful shutdown: clear the interval before the process exits.
let pollInterval: ReturnType<typeof setInterval> | null = null;

process.on("SIGTERM", () => {
  console.log("[worker] received SIGTERM, shutting down gracefully");
  if (pollInterval) clearInterval(pollInterval);
  process.exit(0);
});

// Start polling only after seed check completes. The isGenerating flags set
// during seed check have a 10-minute TTL — the first poll fires at 30 minutes,
// well after the locks are cleared. No risk of double-triggering.
runSeedCheck().then(() => {
  pollInterval = setInterval(runStockPoll, POLL_INTERVAL_MS);
  console.log("[worker] polling started");
});
