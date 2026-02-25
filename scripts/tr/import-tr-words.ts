import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  ROOT,
  TOKEN_ACCEPT_REGEX,
  normalizeTurkishWord,
  createPool,
  parseFrequencyCsv,
} from "./_shared";

type Difficulty = "easy" | "medium" | "hard" | "expert";
type DropReason =
  | "blacklist"
  | "stopword"
  | "non-letter"
  | "too-short"
  | "too-long"
  | "top-percentile"
  | "bottom-percentile";

type CliOptions = {
  dropTopPercent: number;
  dropBottomPercent: number;
};

type WordRow = {
  word: string;
  count: number;
  length: number;
  freqScore: number;
  difficulty: Difficulty;
  tags: Record<string, unknown>;
};

const FREQUENCY_PATH = resolve(ROOT, "data/tr_frequency.csv");
const BLACKLIST_PATH = resolve(ROOT, "data/tr_blacklist.txt");
const STOPWORDS_PATH = resolve(ROOT, "data/tr_stopwords.txt");

function parsePercent(raw: string, flag: string): number {
  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed >= 100) {
    throw new Error(`${flag} must be a number in range [0, 100). Received: ${raw}`);
  }
  return parsed;
}

function parseArgs(argv: string[]): CliOptions {
  let dropTopPercent = 1;
  let dropBottomPercent = 10;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dropTopPercent") {
      const value = argv[i + 1];
      if (!value) throw new Error("--dropTopPercent requires a value.");
      dropTopPercent = parsePercent(value, "--dropTopPercent");
      i += 1;
      continue;
    }
    if (arg === "--dropBottomPercent") {
      const value = argv[i + 1];
      if (!value) throw new Error("--dropBottomPercent requires a value.");
      dropBottomPercent = parsePercent(value, "--dropBottomPercent");
      i += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  return { dropTopPercent, dropBottomPercent };
}

function parseBlacklist(): Set<string> {
  if (!existsSync(BLACKLIST_PATH)) return new Set<string>();

  const lines = readFileSync(BLACKLIST_PATH, "utf8").split(/\r?\n/);
  const set = new Set<string>();

  for (const rawLine of lines) {
    const stripped = rawLine.replace(/#.*/, "").trim();
    if (!stripped) continue;
    const normalized = normalizeTurkishWord(stripped);
    if (normalized) set.add(normalized);
  }

  return set;
}

function parseStopwords(): Set<string> {
  if (!existsSync(STOPWORDS_PATH)) return new Set<string>();

  const lines = readFileSync(STOPWORDS_PATH, "utf8").split(/\r?\n/);
  const set = new Set<string>();

  for (const rawLine of lines) {
    const stripped = rawLine.replace(/#.*/, "").trim();
    if (!stripped) continue;
    const normalized = normalizeTurkishWord(stripped);
    if (!normalized || !TOKEN_ACCEPT_REGEX.test(normalized)) continue;
    set.add(normalized);
  }

  return set;
}

function mapDifficulty(rankRatio: number): Difficulty {
  if (rankRatio <= 0.2) return "easy";
  if (rankRatio <= 0.7) return "medium";
  if (rankRatio <= 0.95) return "hard";
  return "expert";
}

function buildRows(
  counts: Map<string, number>,
  blacklist: Set<string>,
  stopwords: Set<string>,
  options: CliOptions,
): { rows: WordRow[]; dropped: Record<DropReason, number> } {
  const dropped: Record<DropReason, number> = {
    blacklist: 0,
    stopword: 0,
    "non-letter": 0,
    "too-short": 0,
    "too-long": 0,
    "top-percentile": 0,
    "bottom-percentile": 0,
  };

  const baseFiltered = [...counts.entries()]
    .filter(([word]) => {
      if (blacklist.has(word)) {
        dropped.blacklist += 1;
        return false;
      }
      if (stopwords.has(word)) {
        dropped.stopword += 1;
        return false;
      }
      if (!TOKEN_ACCEPT_REGEX.test(word)) {
        dropped["non-letter"] += 1;
        return false;
      }
      if (word.length < 3) {
        dropped["too-short"] += 1;
        return false;
      }
      if (word.length > 20) {
        dropped["too-long"] += 1;
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0].localeCompare(b[0], "tr");
    });

  const total = baseFiltered.length;
  if (total === 0) return { rows: [], dropped };

  const topCut = options.dropTopPercent > 0 ? Math.max(1, Math.floor((total * options.dropTopPercent) / 100)) : 0;
  let bottomCut =
    options.dropBottomPercent > 0 ? Math.max(1, Math.floor((total * options.dropBottomPercent) / 100)) : 0;
  if (topCut + bottomCut >= total) {
    bottomCut = Math.max(0, total - topCut - 1);
  }

  const percentileFiltered: Array<[string, number]> = [];
  for (let idx = 0; idx < total; idx += 1) {
    const entry = baseFiltered[idx];
    if (topCut > 0 && idx < topCut) {
      dropped["top-percentile"] += 1;
      continue;
    }
    if (bottomCut > 0 && idx >= total - bottomCut) {
      dropped["bottom-percentile"] += 1;
      continue;
    }
    percentileFiltered.push(entry);
  }

  const finalTotal = percentileFiltered.length;
  if (finalTotal === 0) return { rows: [], dropped };

  const rows = percentileFiltered.map(([word, count], idx) => {
    const rankRatio = (idx + 1) / finalTotal;
    const denominator = Math.max(finalTotal - 1, 1);
    const freqScore = Number((1 - idx / denominator).toFixed(3));
    const difficulty = mapDifficulty(rankRatio);

    return {
      word,
      count,
      length: word.length,
      freqScore,
      difficulty,
      tags: {
        source: "tr_frequency",
        phase: "0.5",
        corpus_count: count,
        filters: {
          drop_top_percent: options.dropTopPercent,
          drop_bottom_percent: options.dropBottomPercent,
        },
      },
    };
  });

  return { rows, dropped };
}

async function importRows(rows: WordRow[]): Promise<void> {
  const pool = createPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const sql = `
      INSERT INTO words (language, word, length, freq_score, difficulty, tags)
      VALUES ('tr', $1, $2, $3, $4::difficulty_level, $5::jsonb)
      ON CONFLICT (language, word)
      DO UPDATE
      SET
        length = EXCLUDED.length,
        freq_score = EXCLUDED.freq_score,
        difficulty = EXCLUDED.difficulty,
        tags = COALESCE(words.tags, '{}'::jsonb) || EXCLUDED.tags,
        updated_at = now();
    `;

    const difficultyCounts: Record<Difficulty, number> = {
      easy: 0,
      medium: 0,
      hard: 0,
      expert: 0,
    };

    for (const row of rows) {
      await client.query(sql, [
        row.word,
        row.length,
        row.freqScore,
        row.difficulty,
        JSON.stringify(row.tags),
      ]);
      difficultyCounts[row.difficulty] += 1;
    }

    await client.query("COMMIT");

    console.log(`Imported rows: ${rows.length}`);
    console.log(
      `Difficulty counts -> easy:${difficultyCounts.easy}, medium:${difficultyCounts.medium}, hard:${difficultyCounts.hard}, expert:${difficultyCounts.expert}`,
    );
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const counts = parseFrequencyCsv(FREQUENCY_PATH);
  const blacklist = parseBlacklist();
  const stopwords = parseStopwords();
  const { rows, dropped } = buildRows(counts, blacklist, stopwords, options);

  if (rows.length === 0) {
    throw new Error("No valid TR words to import after normalization, stopword, blacklist, length, and percentile filters.");
  }

  console.log(
    `Filtering config -> dropTopPercent:${options.dropTopPercent}, dropBottomPercent:${options.dropBottomPercent}`,
  );
  console.log(`Stopwords loaded: ${stopwords.size}`);
  console.log(
    `Dropped counts by reason -> stopword:${dropped.stopword}, non-letter:${dropped["non-letter"]}, too-short:${dropped["too-short"]}, too-long:${dropped["too-long"]}, top-percentile:${dropped["top-percentile"]}, bottom-percentile:${dropped["bottom-percentile"]}, blacklist:${dropped.blacklist}`,
  );
  console.log(`Top 30 tokens after filtering:`);
  for (const row of rows.slice(0, 30)) {
    console.log(`  ${row.word},${row.count}`);
  }

  await importRows(rows);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`TR import failed: ${message}`);
  process.exit(1);
});
