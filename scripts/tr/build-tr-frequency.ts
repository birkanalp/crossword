import { createReadStream, existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(process.cwd());
const INPUT_CANDIDATES = [
  resolve(ROOT, "data/tr_corpus.txt"),
  resolve(ROOT, "data/tr_wikipedia_tokens.txt"),
];
const OUTPUT_PATH = resolve(ROOT, "data/tr_frequency.csv");
const STOPWORDS_PATH = resolve(ROOT, "data/tr_stopwords.txt");
const RAW_TOKEN_REGEX = /[^\s]+/g;
const TOKEN_ACCEPT_REGEX = /^[a-zçğıöşü]+$/;
const FILE_EXT_TOKEN_REGEX = /^(?:jpg|jpeg|png|svg|gif|webp|pdf|ogg|mp3|mp4|webm|bmp|tif|tiff|ico)$/;
const FILE_EXT_WITH_DOT_REGEX = /\.(?:jpg|jpeg|png|svg|gif|webp|pdf|ogg|mp3|mp4|webm|bmp|tif|tiff|ico)$/;

type DropReason =
  | "entity"
  | "file-ext"
  | "stopword"
  | "non-letter"
  | "too-short"
  | "too-long"
  | "empty"
  | "total-raw";

function normalizeToken(raw: string): string {
  const lowered = raw.normalize("NFKC").toLocaleLowerCase("tr-TR");
  return lowered.replace(/^[^a-zçğıöşü]+|[^a-zçğıöşü]+$/g, "");
}

function loadStopwords(): Set<string> {
  if (!existsSync(STOPWORDS_PATH)) return new Set<string>();
  const lines = readFileSync(STOPWORDS_PATH, "utf8").split(/\r?\n/);
  const stopwords = new Set<string>();
  for (const line of lines) {
    const cleaned = line.replace(/#.*/, "").trim();
    if (!cleaned) continue;
    const normalized = normalizeToken(cleaned);
    if (!normalized || !TOKEN_ACCEPT_REGEX.test(normalized)) continue;
    stopwords.add(normalized);
  }
  return stopwords;
}

function resolveInputPath(): string {
  const input = INPUT_CANDIDATES.find((candidate) => existsSync(candidate));
  if (!input) {
    throw new Error(
      `No TR corpus file found. Expected one of: ${INPUT_CANDIDATES.map((path) => path.replace(`${ROOT}/`, "")).join(", ")}`,
    );
  }
  return input;
}

function toCsvRows(counts: Map<string, number>): string[] {
  const entries = [...counts.entries()].sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return a[0].localeCompare(b[0], "tr");
  });

  return entries.map(([word, count]) => `${word},${count}`);
}

function logTopTokens(counts: Map<string, number>, limit: number): void {
  const sorted = [...counts.entries()].sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return a[0].localeCompare(b[0], "tr");
  });
  console.log(`Top ${Math.min(limit, sorted.length)} tokens after filtering:`);
  for (const [word, count] of sorted.slice(0, limit)) {
    console.log(`  ${word},${count}`);
  }
}

function processToken(
  rawToken: string,
  stopwords: Set<string>,
  counts: Map<string, number>,
  dropped: Record<DropReason, number>,
): void {
  dropped["total-raw"] += 1;

  const trimmedRaw = rawToken.trim();
  if (!trimmedRaw) {
    dropped.empty += 1;
    return;
  }
  if (/^&[a-zA-Z#0-9]+;$/.test(trimmedRaw)) {
    dropped.entity += 1;
    return;
  }
  const normalized = normalizeToken(trimmedRaw);
  if (!normalized) {
    dropped.empty += 1;
    return;
  }
  if (FILE_EXT_WITH_DOT_REGEX.test(normalized) || FILE_EXT_TOKEN_REGEX.test(normalized)) {
    dropped["file-ext"] += 1;
    return;
  }
  if (!TOKEN_ACCEPT_REGEX.test(normalized)) {
    dropped["non-letter"] += 1;
    return;
  }
  if (normalized.length < 3) {
    dropped["too-short"] += 1;
    return;
  }
  if (normalized.length > 20) {
    dropped["too-long"] += 1;
    return;
  }
  if (stopwords.has(normalized)) {
    dropped.stopword += 1;
    return;
  }
  counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
}

function processChunk(
  chunk: string,
  carry: string,
  stopwords: Set<string>,
  counts: Map<string, number>,
  dropped: Record<DropReason, number>,
): string {
  const content = carry + chunk;
  const endsWithWhitespace = /\s$/.test(content);
  const rawTokens = content.match(RAW_TOKEN_REGEX) ?? [];

  if (rawTokens.length === 0) return endsWithWhitespace ? "" : content;

  const tokensToProcess = endsWithWhitespace ? rawTokens : rawTokens.slice(0, -1);
  for (const rawToken of tokensToProcess) {
    processToken(rawToken, stopwords, counts, dropped);
  }

  return endsWithWhitespace ? "" : rawTokens[rawTokens.length - 1] ?? "";
}

async function main(): Promise<void> {
  const inputPath = resolveInputPath();
  const stopwords = loadStopwords();
  const counts = new Map<string, number>();
  const dropped: Record<DropReason, number> = {
    "total-raw": 0,
    entity: 0,
    "file-ext": 0,
    stopword: 0,
    "non-letter": 0,
    "too-short": 0,
    "too-long": 0,
    empty: 0,
  };

  let carry = "";
  const stream = createReadStream(inputPath, { encoding: "utf8" });
  for await (const chunk of stream) {
    carry = processChunk(chunk, carry, stopwords, counts, dropped);
  }
  if (carry) {
    processToken(carry, stopwords, counts, dropped);
  }

  const rows = toCsvRows(counts);
  const csv = ["word,count", ...rows].join("\n");
  writeFileSync(OUTPUT_PATH, `${csv}\n`, "utf8");

  console.log(`Input file: ${inputPath.replace(`${ROOT}/`, "")}`);
  console.log(`Stopwords loaded: ${stopwords.size}`);
  console.log(
    `Dropped counts by reason -> stopword:${dropped.stopword}, non-letter:${dropped["non-letter"]}, entity:${dropped.entity}, file-ext:${dropped["file-ext"]}, too-short:${dropped["too-short"]}, too-long:${dropped["too-long"]}, empty:${dropped.empty}`,
  );
  logTopTokens(counts, 30);
  console.log(`Unique tokens written: ${rows.length}`);
  console.log(`Output file: ${OUTPUT_PATH.replace(`${ROOT}/`, "")}`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`TR frequency build failed: ${message}`);
  process.exit(1);
});
