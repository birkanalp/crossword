import { createHash } from "node:crypto";
import { createPool } from "./_shared";

type Difficulty = "easy" | "medium" | "hard" | "expert";
type Direction = "across" | "down";

type CliOptions = {
  difficulty?: Difficulty;
  daily: boolean;
  dryRun: boolean;
  count: number;
  json: boolean;
};

type DifficultyProfile = {
  name: Difficulty;
  ratios: Partial<Record<Difficulty, number>>;
  gridMin: number;
  gridMax: number;
  minWords: number;
  maxWords: number;
  cooldownDays: number;
  qualityThreshold: number;
};

type WordCandidate = {
  id: string;
  word: string;
  difficulty: Difficulty;
  length: number;
  freqScore: number;
  definition: string | null;
  usedCount: number;
  lastUsedAt: string | null;
};

type GridSlot = {
  letter: string;
  owners: number;
};

type Placement = {
  wordId: string;
  word: string;
  definition: string | null;
  difficulty: Difficulty;
  freqScore: number;
  direction: Direction;
  row: number;
  col: number;
  intersections: number;
};

type PlacementCandidate = {
  row: number;
  col: number;
  direction: Direction;
  intersections: number;
  score: number;
};

type NumberedCell = {
  row: number;
  col: number;
  type: "letter" | "black";
  number?: number;
};

type Clue = {
  number: number;
  clue: string;
  answer: string;
  answer_length: number;
  start: { row: number; col: number };
};

type GridJson = {
  rows: number;
  cols: number;
  cells: NumberedCell[];
};

type CluesJson = {
  across: Clue[];
  down: Clue[];
};

type FinalizedLevel = {
  gridJson: GridJson;
  cluesJson: CluesJson;
  answerMap: Record<string, string>;
};

type GenerationResult = {
  targetDifficulty: Difficulty;
  gridSize: number;
  placements: Placement[];
  qualityScore: number;
  computedDifficultyScore: number;
  wordsBreakdown: Record<Difficulty, number>;
  solutionHash: string;
  answerHash: string;
  finalized: FinalizedLevel;
};

type PersistedResult = {
  levelId: string;
  answerHash: string;
  solutionHash: string;
};

const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard", "expert"];
const DIRECTION_WEIGHT: Record<Direction, number> = { across: 1, down: -1 };
const GENERATOR_VERSION = "ts-crossword-v1";
const LANGUAGE = "tr";
const MAX_CANDIDATES_PER_DIFFICULTY = 700;
const MIN_INTERSECTION_BONUS = 80;
const FREQUENCY_WEIGHT = 15;
const CENTRALITY_WEIGHT = 8;
const BALANCE_WEIGHT = 9;
const MIN_WORD_LENGTH = 3;
const MAX_BUILD_ATTEMPTS_PER_GRID = 24;

function parseArgs(argv: string[]): CliOptions {
  let difficulty: Difficulty | undefined;
  let daily = false;
  let dryRun = false;
  let count = 1;
  let json = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--json") {
      json = true;
      continue;
    }
    if (arg === "--difficulty") {
      const value = argv[i + 1];
      if (!value || !DIFFICULTIES.includes(value as Difficulty)) {
        throw new Error("--difficulty expects one of: easy|medium|hard|expert");
      }
      difficulty = value as Difficulty;
      i += 1;
      continue;
    }
    if (arg === "--daily") {
      daily = true;
      continue;
    }
    if (arg === "--dryRun") {
      dryRun = true;
      continue;
    }
    if (arg === "--count") {
      const value = Number.parseInt(argv[i + 1] ?? "", 10);
      if (!Number.isFinite(value) || value <= 0) {
        throw new Error("--count must be a positive integer");
      }
      count = value;
      i += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return { difficulty, daily, dryRun, count, json };
}

function randomDifficulty(): Difficulty {
  return DIFFICULTIES[Math.floor(Math.random() * DIFFICULTIES.length)];
}

function normalizeRatios(raw: Partial<Record<Difficulty, number>>): Record<Difficulty, number> {
  const out: Record<Difficulty, number> = {
    easy: Math.max(0, Number(raw.easy ?? 0)),
    medium: Math.max(0, Number(raw.medium ?? 0)),
    hard: Math.max(0, Number(raw.hard ?? 0)),
    expert: Math.max(0, Number(raw.expert ?? 0)),
  };
  const sum = out.easy + out.medium + out.hard + out.expert;
  if (sum <= 0) {
    return { easy: 0.25, medium: 0.25, hard: 0.25, expert: 0.25 };
  }
  return {
    easy: out.easy / sum,
    medium: out.medium / sum,
    hard: out.hard / sum,
    expert: out.expert / sum,
  };
}

function shuffled<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function hashSha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

function naturalClueSort(a: string, b: string): number {
  const numA = Number.parseInt(a, 10);
  const numB = Number.parseInt(b, 10);
  if (numA !== numB) return numA - numB;
  return a.slice(-1).localeCompare(b.slice(-1));
}

function makeEmptyGrid(size: number): Array<Array<GridSlot | null>> {
  return Array.from({ length: size }, () => Array.from({ length: size }, () => null));
}

function directionDelta(direction: Direction): { dr: number; dc: number } {
  return direction === "across" ? { dr: 0, dc: 1 } : { dr: 1, dc: 0 };
}

function inBounds(size: number, row: number, col: number): boolean {
  return row >= 0 && row < size && col >= 0 && col < size;
}

function canPlaceWord(
  grid: Array<Array<GridSlot | null>>,
  word: string,
  row: number,
  col: number,
  direction: Direction,
  requireIntersection: boolean,
): { ok: boolean; intersections: number } {
  const size = grid.length;
  const { dr, dc } = directionDelta(direction);
  const beforeRow = row - dr;
  const beforeCol = col - dc;
  const afterRow = row + dr * word.length;
  const afterCol = col + dc * word.length;

  if (inBounds(size, beforeRow, beforeCol) && grid[beforeRow][beforeCol] !== null) {
    return { ok: false, intersections: 0 };
  }
  if (inBounds(size, afterRow, afterCol) && grid[afterRow][afterCol] !== null) {
    return { ok: false, intersections: 0 };
  }

  let intersections = 0;
  for (let i = 0; i < word.length; i += 1) {
    const r = row + dr * i;
    const c = col + dc * i;
    if (!inBounds(size, r, c)) return { ok: false, intersections: 0 };
    const existing = grid[r][c];
    const ch = word[i];

    if (existing) {
      if (existing.letter !== ch) return { ok: false, intersections: 0 };
      intersections += 1;
      continue;
    }

    if (direction === "across") {
      if (inBounds(size, r - 1, c) && grid[r - 1][c] !== null) return { ok: false, intersections: 0 };
      if (inBounds(size, r + 1, c) && grid[r + 1][c] !== null) return { ok: false, intersections: 0 };
    } else {
      if (inBounds(size, r, c - 1) && grid[r][c - 1] !== null) return { ok: false, intersections: 0 };
      if (inBounds(size, r, c + 1) && grid[r][c + 1] !== null) return { ok: false, intersections: 0 };
    }
  }

  if (requireIntersection && intersections === 0) return { ok: false, intersections: 0 };
  return { ok: true, intersections };
}

function placeWord(grid: Array<Array<GridSlot | null>>, word: string, row: number, col: number, direction: Direction): void {
  const { dr, dc } = directionDelta(direction);
  for (let i = 0; i < word.length; i += 1) {
    const r = row + dr * i;
    const c = col + dc * i;
    const existing = grid[r][c];
    if (existing) {
      existing.owners += 1;
    } else {
      grid[r][c] = { letter: word[i], owners: 1 };
    }
  }
}

function centralityScore(size: number, row: number, col: number, direction: Direction, len: number): number {
  const center = (size - 1) / 2;
  const endRow = row + (direction === "down" ? len - 1 : 0);
  const endCol = col + (direction === "across" ? len - 1 : 0);
  const midRow = (row + endRow) / 2;
  const midCol = (col + endCol) / 2;
  const dist = Math.abs(center - midRow) + Math.abs(center - midCol);
  return -dist;
}

function collectLetterPositions(grid: Array<Array<GridSlot | null>>): Map<string, Array<{ row: number; col: number }>> {
  const map = new Map<string, Array<{ row: number; col: number }>>();
  for (let r = 0; r < grid.length; r += 1) {
    for (let c = 0; c < grid.length; c += 1) {
      const slot = grid[r][c];
      if (!slot) continue;
      const arr = map.get(slot.letter) ?? [];
      arr.push({ row: r, col: c });
      map.set(slot.letter, arr);
    }
  }
  return map;
}

function bestPlacementForWord(
  grid: Array<Array<GridSlot | null>>,
  word: WordCandidate,
  placements: Placement[],
): PlacementCandidate | null {
  const letterPositions = collectLetterPositions(grid);
  const acrossCount = placements.filter((p) => p.direction === "across").length;
  const downCount = placements.filter((p) => p.direction === "down").length;
  let best: PlacementCandidate | null = null;

  const dirs: Direction[] = ["across", "down"];
  for (const direction of dirs) {
    const { dr, dc } = directionDelta(direction);
    const dirBalance = direction === "across" ? downCount - acrossCount : acrossCount - downCount;
    const balanceBoost = dirBalance * BALANCE_WEIGHT * DIRECTION_WEIGHT[direction] * -1;

    for (let i = 0; i < word.word.length; i += 1) {
      const ch = word.word[i];
      const targets = letterPositions.get(ch);
      if (!targets || targets.length === 0) continue;
      for (const t of targets) {
        const row = t.row - dr * i;
        const col = t.col - dc * i;
        const check = canPlaceWord(grid, word.word, row, col, direction, true);
        if (!check.ok) continue;

        const score =
          check.intersections * MIN_INTERSECTION_BONUS +
          centralityScore(grid.length, row, col, direction, word.word.length) * CENTRALITY_WEIGHT +
          word.freqScore * FREQUENCY_WEIGHT +
          balanceBoost;
        if (!best || score > best.score) {
          best = { row, col, direction, intersections: check.intersections, score };
        }
      }
    }
  }

  return best;
}

function pickTargetWordCount(profile: DifficultyProfile): number {
  if (profile.minWords === profile.maxWords) return profile.minWords;
  const span = profile.maxWords - profile.minWords + 1;
  return profile.minWords + Math.floor(Math.random() * span);
}

function buildDesiredCounts(profile: DifficultyProfile, targetWords: number): Record<Difficulty, number> {
  const ratios = normalizeRatios(profile.ratios);
  const raw = DIFFICULTIES.map((d) => ({ d, v: ratios[d] * targetWords }));
  const floored = raw.map((x) => ({ d: x.d, v: Math.floor(x.v), rem: x.v - Math.floor(x.v) }));
  const out: Record<Difficulty, number> = { easy: 0, medium: 0, hard: 0, expert: 0 };
  let used = 0;
  for (const x of floored) {
    out[x.d] = x.v;
    used += x.v;
  }
  let remaining = targetWords - used;
  const byRemainder = [...floored].sort((a, b) => b.rem - a.rem);
  let idx = 0;
  while (remaining > 0) {
    out[byRemainder[idx % byRemainder.length].d] += 1;
    idx += 1;
    remaining -= 1;
  }
  return out;
}

function qualityScoreFor(
  gridSize: number,
  placements: Placement[],
  profile: DifficultyProfile,
  targetWords: number,
): number {
  const intersectionCount = placements.reduce((acc, p) => acc + p.intersections, 0);
  const lettersPlaced = placements.reduce((acc, p) => acc + p.word.length, 0);
  const fillRatio = lettersPlaced / (gridSize * gridSize);
  const avgFreq = placements.reduce((acc, p) => acc + p.freqScore, 0) / Math.max(placements.length, 1);
  const across = placements.filter((p) => p.direction === "across").length;
  const down = placements.filter((p) => p.direction === "down").length;
  const directionBalance = 1 - Math.abs(across - down) / Math.max(placements.length, 1);
  const completionRatio = placements.length / Math.max(targetWords, 1);

  const raw =
    completionRatio * 45 +
    Math.min(1, fillRatio / 0.7) * 20 +
    Math.min(1, intersectionCount / Math.max(placements.length, 1)) * 20 +
    avgFreq * 10 +
    directionBalance * 5;
  return Math.max(profile.qualityThreshold, Math.min(100, Math.round(raw)));
}

function difficultyToScore(difficulty: Difficulty): number {
  if (difficulty === "easy") return 25;
  if (difficulty === "medium") return 50;
  if (difficulty === "hard") return 75;
  return 100;
}

function difficultyMultiplier(difficulty: Difficulty): number {
  if (difficulty === "easy") return 1.0;
  if (difficulty === "medium") return 1.5;
  if (difficulty === "hard") return 2.0;
  return 2.5;
}

function createClueText(word: string, definition: string | null): string {
  const cleaned = (definition ?? "").trim();
  if (cleaned.length > 0) return cleaned;
  return `Tanım: "${word}"`;
}

function hasBothDirections(placements: Placement[]): boolean {
  let hasAcross = false;
  let hasDown = false;
  for (const p of placements) {
    if (p.direction === "across") hasAcross = true;
    if (p.direction === "down") hasDown = true;
    if (hasAcross && hasDown) return true;
  }
  return false;
}

function finalizeLevel(size: number, placements: Placement[]): FinalizedLevel {
  const grid = makeEmptyGrid(size);
  for (const p of placements) {
    placeWord(grid, p.word, p.row, p.col, p.direction);
  }

  const cells: NumberedCell[] = [];
  const clueNumberMap = new Map<string, number>();
  let nextNumber = 1;

  const startsAcross = new Set(placements.filter((p) => p.direction === "across").map((p) => `${p.row}:${p.col}`));
  const startsDown = new Set(placements.filter((p) => p.direction === "down").map((p) => `${p.row}:${p.col}`));

  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      const slot = grid[r][c];
      if (!slot) {
        cells.push({ row: r, col: c, type: "black" });
        continue;
      }
      const key = `${r}:${c}`;
      const isStart = startsAcross.has(key) || startsDown.has(key);
      if (isStart) {
        clueNumberMap.set(key, nextNumber);
        cells.push({ row: r, col: c, type: "letter", number: nextNumber });
        nextNumber += 1;
      } else {
        cells.push({ row: r, col: c, type: "letter" });
      }
    }
  }

  const across: Clue[] = [];
  const down: Clue[] = [];

  for (const p of placements) {
    const key = `${p.row}:${p.col}`;
    const number = clueNumberMap.get(key);
    if (!number) continue;
    const clue: Clue = {
      number,
      clue: createClueText(p.word, p.definition),
      answer: p.word,
      answer_length: p.word.length,
      start: { row: p.row, col: p.col },
    };
    if (p.direction === "across") across.push(clue);
    else down.push(clue);
  }

  across.sort((a, b) => a.number - b.number);
  down.sort((a, b) => a.number - b.number);

  const answerMap: Record<string, string> = {};
  for (const clue of across) answerMap[`${clue.number}A`] = clue.answer.toUpperCase();
  for (const clue of down) answerMap[`${clue.number}D`] = clue.answer.toUpperCase();

  return {
    gridJson: { rows: size, cols: size, cells },
    cluesJson: { across, down },
    answerMap,
  };
}

function renderGrid(gridJson: GridJson, cluesJson: CluesJson): string {
  const size = gridJson.rows;
  const matrix = Array.from({ length: size }, () => Array.from({ length: size }, () => "#"));
  const numberMatrix = Array.from({ length: size }, () => Array.from({ length: size }, () => ""));
  const clueByKey = new Map<string, Clue>();
  for (const clue of [...cluesJson.across, ...cluesJson.down]) {
    clueByKey.set(`${clue.start.row}:${clue.start.col}`, clue);
  }

  for (const cell of gridJson.cells) {
    if (cell.type === "black") continue;
    matrix[cell.row][cell.col] = ".";
    if (cell.number) numberMatrix[cell.row][cell.col] = String(cell.number);
  }

  const lines: string[] = [];
  lines.push("Grid:");
  for (let r = 0; r < size; r += 1) {
    const row = matrix[r].map((v, c) => {
      const n = numberMatrix[r][c];
      if (v === "#") return "###";
      return n ? n.padStart(2, "0") : " ..";
    });
    lines.push(row.join(" "));
  }

  lines.push("");
  lines.push("Across:");
  for (const clue of cluesJson.across) {
    lines.push(`  ${clue.number}. (${clue.answer_length}) ${clue.clue} [${clue.answer}]`);
  }
  lines.push("");
  lines.push("Down:");
  for (const clue of cluesJson.down) {
    lines.push(`  ${clue.number}. (${clue.answer_length}) ${clue.clue} [${clue.answer}]`);
  }
  return lines.join("\n");
}

function generateForProfile(
  profile: DifficultyProfile,
  candidatesByDifficulty: Record<Difficulty, WordCandidate[]>,
): { gridSize: number; placements: Placement[]; targetWords: number } | null {
  const gridSizes = shuffled(
    Array.from({ length: profile.gridMax - profile.gridMin + 1 }, (_, idx) => profile.gridMin + idx),
  );

  for (const gridSize of gridSizes) {
    for (let attempt = 0; attempt < MAX_BUILD_ATTEMPTS_PER_GRID; attempt += 1) {
      const targetWords = pickTargetWordCount(profile);
      const desired = buildDesiredCounts(profile, targetWords);
      const chosen: WordCandidate[] = [];
      const used = new Set<string>();

      for (const diff of DIFFICULTIES) {
        const pool = shuffled(candidatesByDifficulty[diff]).filter((w) => w.length <= gridSize && !used.has(w.id));
        for (const w of pool.slice(0, desired[diff])) {
          chosen.push(w);
          used.add(w.id);
        }
      }

      if (chosen.length < profile.minWords) {
        const topUpPool = shuffled(
          DIFFICULTIES.flatMap((d) => candidatesByDifficulty[d]).filter(
            (w) => w.length <= gridSize && !used.has(w.id),
          ),
        );
        for (const w of topUpPool) {
          chosen.push(w);
          used.add(w.id);
          if (chosen.length >= profile.minWords) break;
        }
      }

      if (chosen.length < profile.minWords) continue;

      const sortedForSeed = [...chosen].sort((a, b) => {
        if (b.length !== a.length) return b.length - a.length;
        return b.freqScore - a.freqScore;
      });
      const seed = sortedForSeed[0];
      const grid = makeEmptyGrid(gridSize);
      const placements: Placement[] = [];

      const seedDir: Direction = Math.random() > 0.5 ? "across" : "down";
      const center = Math.floor(gridSize / 2);
      const seedRow = seedDir === "across" ? center : Math.max(0, center - Math.floor(seed.length / 2));
      const seedCol = seedDir === "across" ? Math.max(0, center - Math.floor(seed.length / 2)) : center;
      const seedCheck = canPlaceWord(grid, seed.word, seedRow, seedCol, seedDir, false);
      if (!seedCheck.ok) continue;

      placeWord(grid, seed.word, seedRow, seedCol, seedDir);
      placements.push({
        wordId: seed.id,
        word: seed.word,
        definition: seed.definition,
        difficulty: seed.difficulty,
        freqScore: seed.freqScore,
        direction: seedDir,
        row: seedRow,
        col: seedCol,
        intersections: 0,
      });

      const queue = shuffled(sortedForSeed.slice(1));
      for (const word of queue) {
        const candidate = bestPlacementForWord(grid, word, placements);
        if (!candidate) continue;
        placeWord(grid, word.word, candidate.row, candidate.col, candidate.direction);
        placements.push({
          wordId: word.id,
          word: word.word,
          definition: word.definition,
          difficulty: word.difficulty,
          freqScore: word.freqScore,
          direction: candidate.direction,
          row: candidate.row,
          col: candidate.col,
          intersections: candidate.intersections,
        });
        if (placements.length >= targetWords) break;
      }

      // CONTRACT: clues_json requires both across and down arrays with minItems: 1.
      // If an attempt yields only one direction, keep retrying another candidate grid.
      if (placements.length >= profile.minWords && hasBothDirections(placements)) {
        return { gridSize, placements, targetWords };
      }
    }
  }
  return null;
}

async function loadProfiles(client: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[] }> }): Promise<
  Record<Difficulty, DifficultyProfile>
> {
  const res = await client.query(
    `SELECT name, ratios, grid_min, grid_max, min_words, max_words, cooldown_days, quality_threshold
     FROM difficulty_profiles`,
  );
  const out = {} as Record<Difficulty, DifficultyProfile>;
  for (const row of res.rows) {
    const name = row.name as Difficulty;
    if (!DIFFICULTIES.includes(name)) continue;
    out[name] = {
      name,
      ratios: (row.ratios ?? {}) as Partial<Record<Difficulty, number>>,
      gridMin: Number(row.grid_min),
      gridMax: Number(row.grid_max),
      minWords: Number(row.min_words),
      maxWords: Number(row.max_words),
      cooldownDays: Number(row.cooldown_days),
      qualityThreshold: Number(row.quality_threshold),
    };
  }
  for (const d of DIFFICULTIES) {
    if (!out[d]) {
      throw new Error(`Missing difficulty profile in DB: ${d}`);
    }
  }
  return out;
}

async function loadEligibleWords(
  client: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[] }> },
  profile: DifficultyProfile,
): Promise<Record<Difficulty, WordCandidate[]>> {
  const result: Record<Difficulty, WordCandidate[]> = { easy: [], medium: [], hard: [], expert: [] };
  for (const diff of DIFFICULTIES) {
    const res = await client.query(
      `SELECT
         w.id,
         w.word,
         w.difficulty,
         w.length,
         w.freq_score,
         w.definition,
         COALESCE(wu.used_count, 0) AS used_count,
         wu.last_used_at
       FROM words w
       LEFT JOIN word_usage wu ON wu.word_id = w.id
       WHERE w.language = $1
         AND w.difficulty = $2::difficulty_level
         AND w.freq_score IS NOT NULL
         AND w.length BETWEEN $3 AND $4
         AND COALESCE(wu.locked, FALSE) = FALSE
         AND (wu.cooldown_until IS NULL OR wu.cooldown_until <= now())
       ORDER BY COALESCE(wu.used_count, 0) ASC, wu.last_used_at ASC NULLS FIRST, w.freq_score DESC, random()
       LIMIT $5`,
      [LANGUAGE, diff, MIN_WORD_LENGTH, profile.gridMax, MAX_CANDIDATES_PER_DIFFICULTY],
    );

    result[diff] = res.rows
      .map(
        (r): WordCandidate => ({
          id: String(r.id),
          word: String(r.word).toLocaleUpperCase("tr-TR"),
          difficulty: r.difficulty as Difficulty,
          length: Number(r.length),
          freqScore: Number(r.freq_score),
          definition: r.definition ? String(r.definition) : null,
          usedCount: Number(r.used_count),
          lastUsedAt: r.last_used_at ? String(r.last_used_at) : null,
        }),
      )
      .filter((w) => w.word.length >= MIN_WORD_LENGTH && w.length <= profile.gridMax);
  }
  return result;
}

async function persistGeneratedLevel(
  client: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount?: number }> },
  generated: GenerationResult,
  profile: DifficultyProfile,
  dailyDate: string | null,
): Promise<PersistedResult> {
  const levelId = crypto.randomUUID();
  const version = 1;

  const sortedWordIds = [...generated.placements.map((p) => p.wordId)].sort();
  const solutionHash = hashSha256(sortedWordIds.join("|"));
  const answerKeys = Object.keys(generated.finalized.answerMap).sort(naturalClueSort);
  const sortedAnswers = answerKeys.map((k) => generated.finalized.answerMap[k]).join(":");
  const answerHash = hashSha256(`${levelId}:${version}:${sortedAnswers}`);
  const wordsBreakdown = generated.wordsBreakdown;

  await client.query("BEGIN");
  try {
    await client.query(
      `INSERT INTO levels (
         id, version, difficulty, target_difficulty, computed_difficulty_score, language, grid_size, word_count,
         words_breakdown, quality_score, grid_json, clues_json, answer_hash, solution_hash, auto_generated,
         review_status, generator_version, is_premium, difficulty_multiplier
       )
       VALUES (
         $1, $2, $3::difficulty_level, $4::difficulty_level, $5, $6, $7, $8,
         $9::jsonb, $10, $11::jsonb, $12::jsonb, $13, $14, TRUE,
         'pending', $15, FALSE, $16
       )`,
      [
        levelId,
        version,
        generated.targetDifficulty,
        generated.targetDifficulty,
        generated.computedDifficultyScore,
        LANGUAGE,
        generated.gridSize,
        generated.placements.length,
        JSON.stringify(wordsBreakdown),
        generated.qualityScore,
        JSON.stringify(generated.finalized.gridJson),
        JSON.stringify(generated.finalized.cluesJson),
        answerHash,
        solutionHash,
        GENERATOR_VERSION,
        difficultyMultiplier(generated.targetDifficulty),
      ],
    );

    for (const placement of generated.placements) {
      await client.query(
        `INSERT INTO level_words (level_id, word_id, direction, start_x, start_y, length)
         VALUES ($1, $2, $3::word_direction, $4, $5, $6)`,
        [levelId, placement.wordId, placement.direction, placement.col, placement.row, placement.word.length],
      );
    }

    await client.query(
      `INSERT INTO word_usage (word_id, used_count, last_used_at, cooldown_until, locked)
       SELECT
         x.word_id::uuid,
         1,
         now(),
         now() + make_interval(days => $2::int),
         FALSE
       FROM unnest($1::text[]) AS x(word_id)
       ON CONFLICT (word_id) DO UPDATE
       SET used_count = word_usage.used_count + 1,
           last_used_at = EXCLUDED.last_used_at,
           cooldown_until = EXCLUDED.cooldown_until,
           updated_at = now()`,
      [sortedWordIds, profile.cooldownDays],
    );

    if (dailyDate) {
      await client.query(
        `INSERT INTO daily_challenges (id, date, level_id, leaderboard_enabled, created_at)
         VALUES (gen_random_uuid(), $1::date, $2::uuid, TRUE, now())
         ON CONFLICT (date)
         DO UPDATE SET
           level_id = EXCLUDED.level_id,
           leaderboard_enabled = EXCLUDED.leaderboard_enabled`,
        [dailyDate, levelId],
      );
    }

    await client.query("COMMIT");
    return { levelId, answerHash, solutionHash };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

function buildGenerationResult(
  targetDifficulty: Difficulty,
  profile: DifficultyProfile,
  gridSize: number,
  placements: Placement[],
  targetWords: number,
): GenerationResult {
  const finalized = finalizeLevel(gridSize, placements);
  const wordsBreakdown: Record<Difficulty, number> = { easy: 0, medium: 0, hard: 0, expert: 0 };
  for (const p of placements) wordsBreakdown[p.difficulty] += 1;

  const sortedWordIds = [...placements.map((p) => p.wordId)].sort();
  const solutionHash = hashSha256(sortedWordIds.join("|"));
  const tempLevelId = "00000000-0000-0000-0000-000000000000";
  const answerKeys = Object.keys(finalized.answerMap).sort(naturalClueSort);
  const sortedAnswers = answerKeys.map((k) => finalized.answerMap[k]).join(":");
  const answerHash = hashSha256(`${tempLevelId}:1:${sortedAnswers}`);
  const qualityScore = qualityScoreFor(gridSize, placements, profile, targetWords);
  const computedDifficultyScore =
    placements.reduce((acc, p) => acc + difficultyToScore(p.difficulty), 0) / Math.max(placements.length, 1);

  return {
    targetDifficulty,
    gridSize,
    placements,
    qualityScore,
    computedDifficultyScore: Number(computedDifficultyScore.toFixed(2)),
    wordsBreakdown,
    solutionHash,
    answerHash,
    finalized,
  };
}

function ymdFromDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const log = options.json ? () => {} : (msg: string) => console.log(msg);

  log(
    `generate-crossword options -> difficulty:${options.difficulty ?? "random"}, daily:${options.daily}, dryRun:${options.dryRun}, count:${options.count}`,
  );

  const pool = createPool();
  const client = await pool.connect();
  try {
    const profiles = await loadProfiles(client);
    const runResults: Array<{ generated: GenerationResult; persisted: PersistedResult | null; dailyDate: string | null }> = [];

    for (let i = 0; i < options.count; i += 1) {
      const targetDifficulty = options.difficulty ?? randomDifficulty();
      const profile = profiles[targetDifficulty];
      const candidatesByDifficulty = await loadEligibleWords(client, profile);
      const totalEligible = DIFFICULTIES.reduce((acc, d) => acc + candidatesByDifficulty[d].length, 0);
      if (totalEligible < profile.minWords) {
        throw new Error(
          `Not enough eligible words for ${targetDifficulty}: found ${totalEligible}, need at least ${profile.minWords}`,
        );
      }

      const build = generateForProfile(profile, candidatesByDifficulty);
      if (!build) {
        throw new Error(`Failed to generate playable crossword for ${targetDifficulty} after retries`);
      }

      const generated = buildGenerationResult(targetDifficulty, profile, build.gridSize, build.placements, build.targetWords);
      const dailyDate = options.daily ? ymdFromDate(new Date(Date.now() + i * 86_400_000)) : null;
      const persisted = options.dryRun ? null : await persistGeneratedLevel(client, generated, profile, dailyDate);
      runResults.push({ generated, persisted, dailyDate });
    }

    for (let i = 0; i < runResults.length; i += 1) {
      const item = runResults[i];
      const g = item.generated;
      const intersectionCount = g.placements.reduce((acc, p) => acc + p.intersections, 0);
      log(`\n=== Generated #${i + 1} ===`);
      log(
        `difficulty=${g.targetDifficulty} grid=${g.gridSize} words=${g.placements.length} quality=${g.qualityScore} difficultyScore=${g.computedDifficultyScore.toFixed(2)} intersections=${intersectionCount}`,
      );
      log(
        `words_breakdown easy=${g.wordsBreakdown.easy} medium=${g.wordsBreakdown.medium} hard=${g.wordsBreakdown.hard} expert=${g.wordsBreakdown.expert}`,
      );
      if (item.dailyDate) log(`daily_date=${item.dailyDate}`);
      if (item.persisted) {
        log(`level_id=${item.persisted.levelId}`);
        log(`solution_hash=${item.persisted.solutionHash}`);
        log(`answer_hash=${item.persisted.answerHash}`);
      } else {
        log(`dry_solution_hash=${g.solutionHash}`);
        log(`dry_answer_hash_placeholder_level=${g.answerHash}`);
      }
      log(renderGrid(g.finalized.gridJson, g.finalized.cluesJson));
    }

    if (options.json) {
      const last = runResults[runResults.length - 1]!;
      const out: Record<string, unknown> = {
        success: true,
        difficulty: last.generated.targetDifficulty,
        level_id: last.persisted?.levelId ?? null,
      };
      if (options.dryRun) out.dry_run = true;
      console.log(JSON.stringify(out));
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  const jsonMode = process.argv.includes("--json");
  if (jsonMode) {
    console.log(JSON.stringify({ success: false, error: message }));
  } else {
    console.error(`Crossword generation failed: ${message}`);
  }
  process.exit(1);
});
