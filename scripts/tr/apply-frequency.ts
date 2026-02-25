import { resolve } from "node:path";
import { ROOT, createPool, parseFrequencyCsv } from "./_shared";

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

type CliOptions = {
  freqFile: string;
  dryRun: boolean;
};

function parseArgs(argv: string[]): CliOptions {
  let freqFile = resolve(ROOT, "data/tr_frequency.csv");
  let dryRun = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--freqFile") {
      freqFile = resolve(argv[++i]);
      continue;
    }
    if (arg === "--dryRun") {
      dryRun = true;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  return { freqFile, dryRun };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  console.log(`\nApplying frequency data from: ${opts.freqFile}`);
  console.log(`dryRun: ${opts.dryRun}\n`);

  const freqMap = parseFrequencyCsv(opts.freqFile);
  console.log(`Freq CSV rows: ${freqMap.size}`);

  if (opts.dryRun) {
    console.log("--dryRun: skipping DB operations.");
    return;
  }

  const pool = createPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Phase 1: Stage frequency into temp table
    console.log("Phase 1: Staging frequency data...");
    await client.query(`CREATE TEMP TABLE _freq_staging (word TEXT PRIMARY KEY, count BIGINT)`);

    const BATCH_SIZE = 1000;
    const entries = [...freqMap.entries()];
    for (let i = 0; i < entries.length; i += BATCH_SIZE) {
      const batch = entries.slice(i, i + BATCH_SIZE);
      const values: string[] = [];
      const params: (string | number)[] = [];
      let paramIdx = 1;

      for (const [word, count] of batch) {
        values.push(`($${paramIdx}, $${paramIdx + 1})`);
        params.push(word, count);
        paramIdx += 2;
      }

      await client.query(
        `INSERT INTO _freq_staging (word, count) VALUES ${values.join(",")}
         ON CONFLICT (word) DO UPDATE SET count = EXCLUDED.count`,
        params,
      );
    }
    console.log(`  Staged ${freqMap.size} frequency entries`);

    // Phase 2: Update freq_score + difficulty
    console.log("Phase 2: Updating freq_score + difficulty...");
    const updateResult = await client.query(`
      WITH matched AS (
        SELECT w.id, fs.count,
          LN(fs.count + 1) AS log_count,
          ROW_NUMBER() OVER (ORDER BY fs.count DESC) AS rank,
          COUNT(*) OVER () AS total
        FROM _freq_staging fs
        JOIN words w ON w.word = fs.word AND w.language = 'tr'
      ),
      scored AS (
        SELECT id, count,
          ROUND(((log_count - MIN(log_count) OVER()) /
            NULLIF(MAX(log_count) OVER() - MIN(log_count) OVER(), 0))::numeric, 3) AS freq_score,
          rank::NUMERIC / total AS pct
        FROM matched
      )
      UPDATE words w SET
        freq_score = s.freq_score,
        difficulty = CASE
          WHEN s.pct <= 0.20 THEN 'easy'
          WHEN s.pct <= 0.70 THEN 'medium'
          WHEN s.pct <= 0.95 THEN 'hard'
          ELSE 'expert' END::difficulty_level,
        tags = w.tags || jsonb_build_object('corpus_count', s.count),
        updated_at = now()
      FROM scored s WHERE w.id = s.id
    `);
    console.log(`  Updated ${updateResult.rowCount} words with frequency data`);

    // Phase 3: Lock words without frequency
    console.log("Phase 3: Locking words without frequency...");
    const lockResult = await client.query(`
      INSERT INTO word_usage (word_id, locked)
      SELECT w.id, TRUE FROM words w
      WHERE w.language = 'tr' AND w.freq_score IS NULL
      ON CONFLICT (word_id) DO UPDATE SET locked = TRUE
    `);
    console.log(`  Locked ${lockResult.rowCount} words (no freq match)`);

    // Phase 4: Unlock words that gained frequency
    console.log("Phase 4: Unlocking words with frequency...");
    const unlockResult = await client.query(`
      UPDATE word_usage wu SET locked = FALSE
      FROM words w WHERE wu.word_id = w.id
        AND w.language = 'tr' AND w.freq_score IS NOT NULL AND wu.locked = TRUE
    `);
    console.log(`  Unlocked ${unlockResult.rowCount} words`);

    await client.query("COMMIT");

    // Stats
    const diffStats = await client.query(`
      SELECT difficulty, COUNT(*) as cnt
      FROM words WHERE language = 'tr'
      GROUP BY difficulty ORDER BY difficulty
    `);
    console.log("\n--- Difficulty distribution ---");
    for (const row of diffStats.rows) {
      console.log(`  ${row.difficulty}: ${row.cnt}`);
    }

    const lockedCount = await client.query(`
      SELECT COUNT(*) as cnt FROM word_usage WHERE locked = TRUE
    `);
    console.log(`\nTotal locked (no freq): ${lockedCount.rows[0].cnt}`);

  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }

  console.log("\nDone.");
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Apply frequency failed: ${message}`);
  process.exit(1);
});
