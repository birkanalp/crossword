import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import path from "node:path";

type Difficulty = "easy" | "medium" | "hard" | "expert";

export interface TriggerOptions {
  difficulty: Difficulty;
  count: number;
  /** Full Supabase URL. Inside Docker: http://kong:8000 */
  supabaseUrl: string;
  serviceRoleKey: string;
  /** Absolute path to the repo root (where scripts/ lives) */
  projectRoot: string;
  isDaily?: boolean;
}

export interface TriggerResult {
  ids: string[];
}

/**
 * Allocates placeholder `levels` rows in the DB, then spawns the
 * generate-crossword.ts script in the background to fill them in.
 *
 * Throws if the placeholder INSERT fails (no point spawning the script).
 */
export async function triggerGeneration(
  opts: TriggerOptions,
): Promise<TriggerResult> {
  if (opts.count < 1 || opts.count > 200) {
    throw new Error(`count must be between 1 and 200, got ${opts.count}`);
  }

  const ids: string[] = Array.from({ length: opts.count }, () => randomUUID());

  const client = createClient(opts.supabaseUrl, opts.serviceRoleKey, {
    auth: { persistSession: false },
  });

  // answer_hash constraint: CHECK (answer_hash ~ '^[0-9a-f]{64}$')
  // 64 zero-chars satisfy the regex and are overwritten by the script.
  const PLACEHOLDER_HASH = "0".repeat(64);

  const DIFFICULTY_SCORE: Record<Difficulty, number> = {
    easy: 25,
    medium: 50,
    hard: 75,
    expert: 100,
  };

  const placeholders = ids.map((id, i) => ({
    id,
    target_difficulty: opts.difficulty,
    difficulty: opts.difficulty,
    language: "tr",
    review_status: "generating",
    version: 1,
    auto_generated: true,
    clues_json: { across: [], down: [] },
    grid_json: { rows: 0, cols: 0, cells: [] },
    answer_hash: PLACEHOLDER_HASH,
    solution_hash: PLACEHOLDER_HASH,
    word_count: 0,
    grid_size: 0,
    generator_version: "placeholder",
    is_premium: false,
    difficulty_multiplier: 1.0,
    computed_difficulty_score: DIFFICULTY_SCORE[opts.difficulty],
    words_breakdown: {},
    quality_score: 0,
  }));

  const { error } = await client.from("levels").insert(placeholders);
  if (error) {
    throw new Error(`Failed to insert placeholder records: ${error.message}`);
  }

  const scriptPath = path.join(
    opts.projectRoot,
    "scripts",
    "tr",
    "generate-crossword.ts",
  );

  const scriptArgs = [
    "tsx",
    scriptPath,
    "--ids",
    ids.join(","),
    "--difficulties",
    Array(opts.count).fill(opts.difficulty).join(","),
    "--json",
  ];
  if (opts.isDaily) {
    scriptArgs.push("--daily");
  }

  const child = spawn("npx", scriptArgs, {
    cwd: opts.projectRoot,
    env: { ...process.env },
    detached: true,
    stdio: "ignore",
  });
  child.unref();

  return { ids };
}
