import { existsSync, readFileSync, createReadStream } from "node:fs";
import { resolve } from "node:path";
import { parse as csvParse } from "csv-parse";
import {
  ROOT,
  TOKEN_ACCEPT_REGEX,
  normalizeTurkishWord,
  createPool,
} from "./_shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type WordEntry = {
  word: string;
  definitions: string[];
  sources: string[];
  pos?: string;
};

type CliOptions = {
  minLen: number;
  maxLen: number;
  dryRun: boolean;
};

type SourceStats = {
  name: string;
  parsed: number;
  accepted: number;
  skippedProper: number;
  skippedMultiword: number;
  skippedLength: number;
  skippedNonLetter: number;
};

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv: string[]): CliOptions {
  let minLen = 3;
  let maxLen = 12;
  let dryRun = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--minLen") {
      minLen = Number.parseInt(argv[++i], 10);
      continue;
    }
    if (arg === "--maxLen") {
      maxLen = Number.parseInt(argv[++i], 10);
      continue;
    }
    if (arg === "--dryRun") {
      dryRun = true;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  return { minLen, maxLen, dryRun };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SOURCES_DIR = resolve(ROOT, "data/tr_sources");

function shouldAccept(
  raw: string,
  opts: CliOptions,
  stats: SourceStats,
  ozelMi?: string,
): string | null {
  // Skip multi-word entries
  if (raw.includes(" ")) {
    stats.skippedMultiword += 1;
    return null;
  }

  // Skip proper nouns from TDK
  if (ozelMi === "1") {
    stats.skippedProper += 1;
    return null;
  }

  const normalized = normalizeTurkishWord(raw);

  if (!TOKEN_ACCEPT_REGEX.test(normalized)) {
    stats.skippedNonLetter += 1;
    return null;
  }

  if (normalized.length < opts.minLen || normalized.length > opts.maxLen) {
    stats.skippedLength += 1;
    return null;
  }

  stats.accepted += 1;
  return normalized;
}

function mergeEntry(
  map: Map<string, WordEntry>,
  word: string,
  defs: string[],
  source: string,
  pos?: string,
): void {
  const existing = map.get(word);
  if (existing) {
    for (const d of defs) {
      if (d && !existing.definitions.includes(d)) {
        existing.definitions.push(d);
      }
    }
    if (!existing.sources.includes(source)) {
      existing.sources.push(source);
    }
    if (pos && !existing.pos) {
      existing.pos = pos;
    }
  } else {
    map.set(word, {
      word,
      definitions: defs.filter(Boolean),
      sources: [source],
      pos,
    });
  }
}

function initStats(name: string): SourceStats {
  return { name, parsed: 0, accepted: 0, skippedProper: 0, skippedMultiword: 0, skippedLength: 0, skippedNonLetter: 0 };
}

function printStats(s: SourceStats): void {
  console.log(
    `  ${s.name} → parsed: ${s.parsed}, accepted: ${s.accepted}, ` +
    `skipped(proper): ${s.skippedProper}, skipped(multiword): ${s.skippedMultiword}, ` +
    `skipped(length): ${s.skippedLength}, skipped(non-letter): ${s.skippedNonLetter}`,
  );
}

// ---------------------------------------------------------------------------
// Source 1: words_meanings_big.txt  (word**def1\ndef2%%  format)
// ---------------------------------------------------------------------------

function parseWordsMeaningsBig(
  opts: CliOptions,
  map: Map<string, WordEntry>,
): SourceStats {
  const filePath = resolve(SOURCES_DIR, "words_meanings_big.txt");
  const stats = initStats("words_meanings_big.txt");
  if (!existsSync(filePath)) {
    console.log(`  SKIP ${stats.name}: file not found`);
    return stats;
  }

  const content = readFileSync(filePath, "utf8");
  // Split by %% to get entries
  const entries = content.split("%%");

  for (const entry of entries) {
    const trimmed = entry.trim();
    if (!trimmed) continue;

    const starIdx = trimmed.indexOf("**");
    if (starIdx <= 0) continue;

    const rawWord = trimmed.slice(0, starIdx).trim();
    const rawMeanings = trimmed.slice(starIdx + 2).trim();
    stats.parsed += 1;

    const normalized = shouldAccept(rawWord, opts, stats);
    if (!normalized) continue;

    const defs = rawMeanings
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    mergeEntry(map, normalized, defs, "words_meanings_big");
  }

  return stats;
}

// ---------------------------------------------------------------------------
// Source 2: tdk_word_meaning_data.csv  (madde,anlam)
// ---------------------------------------------------------------------------

function parseTdkWordMeaning(
  opts: CliOptions,
  map: Map<string, WordEntry>,
): SourceStats {
  const filePath = resolve(SOURCES_DIR, "tdk_word_meaning_data.csv");
  const stats = initStats("tdk_word_meaning_data.csv");
  if (!existsSync(filePath)) {
    console.log(`  SKIP ${stats.name}: file not found`);
    return stats;
  }

  const lines = readFileSync(filePath, "utf8").split(/\r?\n/);

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line) continue;
    // Skip header
    if (i === 0 && line.toLowerCase().startsWith("madde,")) continue;

    const commaIdx = line.indexOf(",");
    if (commaIdx <= 0) continue;

    const rawWord = line.slice(0, commaIdx).trim();
    const rawMeaning = line.slice(commaIdx + 1).trim();
    stats.parsed += 1;

    const normalized = shouldAccept(rawWord, opts, stats);
    if (!normalized) continue;

    mergeEntry(map, normalized, [rawMeaning], "tdk_word_meaning");
  }

  return stats;
}

// ---------------------------------------------------------------------------
// Source 3: words.json  ([{word, meanings}])
// ---------------------------------------------------------------------------

function parseWordsJson(
  opts: CliOptions,
  map: Map<string, WordEntry>,
): SourceStats {
  const filePath = resolve(SOURCES_DIR, "words.json");
  const stats = initStats("words.json");
  if (!existsSync(filePath)) {
    console.log(`  SKIP ${stats.name}: file not found`);
    return stats;
  }

  const data: Array<{ word: string; meanings: string[] }> = JSON.parse(
    readFileSync(filePath, "utf8"),
  );

  for (const item of data) {
    stats.parsed += 1;
    const normalized = shouldAccept(item.word, opts, stats);
    if (!normalized) continue;

    mergeEntry(map, normalized, item.meanings ?? [], "words_json");
  }

  return stats;
}

// ---------------------------------------------------------------------------
// Source 4: tdk_word_data_all.csv  (streaming CSV with anlamlarListe)
// ---------------------------------------------------------------------------

function parsePythonRepr(raw: string): any[] {
  if (!raw || raw === "[]") return [];
  const json = raw
    .replace(/'/g, '"')
    .replace(/None/g, "null")
    .replace(/True/g, "true")
    .replace(/False/g, "false");
  try {
    return JSON.parse(json);
  } catch {
    return [];
  }
}

const POS_MAP: Record<string, string> = {
  "isim": "isim",
  "sıfat": "sıfat",
  "fiil": "fiil",
  "zarf": "zarf",
  "zamir": "zamir",
  "edat": "edat",
  "bağlaç": "bağlaç",
  "ünlem": "ünlem",
};

async function parseTdkWordDataAll(
  opts: CliOptions,
  map: Map<string, WordEntry>,
): Promise<SourceStats> {
  const filePath = resolve(SOURCES_DIR, "tdk_word_data_all.csv");
  const stats = initStats("tdk_word_data_all.csv");
  let reprFailures = 0;

  if (!existsSync(filePath)) {
    console.log(`  SKIP ${stats.name}: file not found`);
    return stats;
  }

  return new Promise((resolvePromise, reject) => {
    const parser = createReadStream(filePath, "utf8").pipe(
      csvParse({
        columns: true,
        skip_empty_lines: true,
        relax_column_count: true,
        relax_quotes: true,
      }),
    );

    parser.on("data", (row: Record<string, string>) => {
      const rawWord = row.madde?.trim();
      const ozelMi = row.ozel_mi?.trim();
      const anlamlarRaw = row.anlamlarListe?.trim();
      if (!rawWord) return;

      stats.parsed += 1;
      const normalized = shouldAccept(rawWord, opts, stats, ozelMi);
      if (!normalized) return;

      // Extract definitions from anlamlarListe
      const defs: string[] = [];
      if (anlamlarRaw) {
        const parsed = parsePythonRepr(anlamlarRaw);
        if (parsed.length === 0 && anlamlarRaw !== "[]") {
          reprFailures += 1;
        }
        for (const item of parsed) {
          if (item?.anlam) {
            defs.push(item.anlam);
          }
        }
      }

      // Extract POS
      let pos: string | undefined;
      if (anlamlarRaw) {
        const parsed = parsePythonRepr(anlamlarRaw);
        for (const item of parsed) {
          const ozList = item?.ozelliklerListe;
          if (Array.isArray(ozList)) {
            for (const oz of ozList) {
              const tamAdi = oz?.tam_adi?.toLowerCase();
              if (tamAdi && POS_MAP[tamAdi]) {
                pos = POS_MAP[tamAdi];
                break;
              }
            }
          }
          if (pos) break;
        }
      }

      mergeEntry(map, normalized, defs, "tdk_word_data_all", pos);
    });

    parser.on("end", () => {
      if (reprFailures > 0) {
        console.log(`  anlamlarListe parse failures: ${reprFailures}`);
      }
      resolvePromise(stats);
    });

    parser.on("error", reject);
  });
}

// ---------------------------------------------------------------------------
// DB upsert
// ---------------------------------------------------------------------------

async function upsertWords(map: Map<string, WordEntry>): Promise<void> {
  const pool = createPool();
  const client = await pool.connect();
  const BATCH_SIZE = 500;
  const entries = [...map.values()];
  let upserted = 0;

  try {
    for (let i = 0; i < entries.length; i += BATCH_SIZE) {
      const batch = entries.slice(i, i + BATCH_SIZE);
      await client.query("BEGIN");

      for (const entry of batch) {
        const definition =
          entry.definitions.length > 0
            ? entry.definitions.reduce((a, b) => (b.length > a.length ? b : a), "")
            : null;

        const tags: Record<string, unknown> = { sources: entry.sources };
        if (entry.pos) tags.pos = entry.pos;

        await client.query(
          `INSERT INTO words (language, word, length, difficulty, tags, definition, clue_source)
           VALUES ('tr', $1, $2, 'medium'::difficulty_level, $3::jsonb, $4, 'definition')
           ON CONFLICT (language, word) DO UPDATE SET
             definition = CASE WHEN LENGTH(EXCLUDED.definition) > LENGTH(COALESCE(words.definition,''))
                               THEN EXCLUDED.definition ELSE words.definition END,
             tags = words.tags || EXCLUDED.tags,
             clue_source = COALESCE(words.clue_source, EXCLUDED.clue_source),
             updated_at = now()`,
          [entry.word, entry.word.length, JSON.stringify(tags), definition],
        );
      }

      await client.query("COMMIT");
      upserted += batch.length;

      if ((i + BATCH_SIZE) % 5000 < BATCH_SIZE) {
        console.log(`  upserted ${upserted} / ${entries.length}...`);
      }
    }

    console.log(`Upserted total: ${upserted}`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  const map = new Map<string, WordEntry>();

  console.log(`\nIngesting TR sources from ${SOURCES_DIR}`);
  console.log(`Filters: minLen=${opts.minLen}, maxLen=${opts.maxLen}, dryRun=${opts.dryRun}\n`);

  // Processing order: least → most rich (richer definitions win via mergeEntry)
  const allStats: SourceStats[] = [];

  // 1. words_meanings_big.txt
  allStats.push(parseWordsMeaningsBig(opts, map));

  // 2. tdk_word_meaning_data.csv
  allStats.push(parseTdkWordMeaning(opts, map));

  // 3. words.json
  allStats.push(parseWordsJson(opts, map));

  // 4. tdk_word_data_all.csv (streaming, async)
  allStats.push(await parseTdkWordDataAll(opts, map));

  // Print stats
  console.log("\n--- Source stats ---");
  for (const s of allStats) printStats(s);
  console.log(`  SKIPPED: tr_wordlist.csv (English word list)`);
  console.log(`  SKIPPED: dictionary.json (English→Turkish, no TR definitions)`);
  console.log(`\nTotal unique words: ${map.size}`);

  // Definition coverage
  let withDef = 0;
  for (const e of map.values()) {
    if (e.definitions.length > 0) withDef += 1;
  }
  console.log(`Words with definitions: ${withDef} (${((withDef / map.size) * 100).toFixed(1)}%)`);

  if (opts.dryRun) {
    console.log("\n--dryRun: skipping DB writes.");
    return;
  }

  console.log("\nUpserting to DB...");
  await upsertWords(map);
  console.log("Done.");
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`TR ingest failed: ${message}`);
  process.exit(1);
});
