import type { CrosswordLevel, CellData, Clue, FilledCells } from '@/domain/crossword/types';
import type { LevelProgress } from '@/domain/crossword/types';

// ─── Contract-shaped types (as returned by getLevel) ─────────────────────────
// Source: api.contract.json#/components/Level
//         level.schema.json#/definitions/GridJson
//         level.schema.json#/definitions/CluesJson

interface ApiGridCell {
  row: number;
  col: number;
  type: 'letter' | 'black';
  number?: number;
}

interface ApiClue {
  number: number;
  clue: string;
  answer_length: number;
  start: { row: number; col: number };
}

interface ApiCluesJson {
  across: ApiClue[];
  down: ApiClue[];
}

interface ApiGridJson {
  rows: number;
  cols: number;
  cells: ApiGridCell[];
}

export interface ApiLevel {
  id: string;
  version: number;
  difficulty: 'easy' | 'medium' | 'hard' | 'expert';
  is_premium: boolean;
  grid_json: ApiGridJson;
  clues_json: ApiCluesJson;
}

/** getLevel response envelope — api.contract.json#/endpoints/getLevel/response/200 */
export interface GetLevelResponse {
  level: ApiLevel;
  progress: ApiUserProgressSnapshot | null;
}

/** api.contract.json#/components/UserProgressSnapshot */
export interface ApiUserProgressSnapshot {
  state_json: Record<string, unknown>;
  completed_at: string | null;
  time_spent: number;
  hints_used: number;
  mistakes: number;
}

// ─── Adapter: ApiLevel → CrosswordLevel ───────────────────────────────────────

/**
 * Converts the backend-shaped Level (flat cell list, separate clue arrays)
 * into the frontend CrosswordLevel domain type (2D grid, unified clue list).
 *
 * KEY DIFFERENCES:
 * - grid_json.cells is a flat array → we build a 2D CellData[][]
 * - clues_json has separate across/down arrays → merged into Clue[] with direction
 * - answer is never sent by the server → Clue.answer remains undefined
 * - title, coinReward, maxScore are not in the contract → defaults used (CR-001)
 */
export function adaptApiLevel(apiLevel: ApiLevel): CrosswordLevel {
  const { grid_json, clues_json } = apiLevel;

  // Build 2D grid
  const grid = build2DGrid(grid_json);

  // Merge across + down clues into a single typed array
  const clues: Clue[] = [
    ...clues_json.across.map((c) => adaptClue(c, 'across')),
    ...clues_json.down.map((c) => adaptClue(c, 'down')),
  ];

  return {
    id: apiLevel.id,
    title: difficultyLabel(apiLevel.difficulty),  // CR-001: no title in contract
    difficulty: apiLevel.difficulty,
    rows: grid_json.rows,
    cols: grid_json.cols,
    grid,
    clues,
    publishedAt: new Date().toISOString(),         // CR-001: not in contract
    isPremium: apiLevel.is_premium,
    coinReward: difficultyToCoinReward(apiLevel.difficulty), // CR-005: not in contract
    maxScore: 1000,
  };
}

/**
 * Sanitizes state_json to FilledCells (row-col → letter). Backend stores verbatim;
 * we only keep string values for safety.
 */
function toFilledCells(raw: Record<string, unknown> | null | undefined): FilledCells {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const result: FilledCells = {};
  for (const [key, val] of Object.entries(raw)) {
    if (typeof val === 'string') result[key] = val;
  }
  return result;
}

/**
 * Converts the server's UserProgressSnapshot into the frontend LevelProgress type.
 * state_json is treated as FilledCells (the client owns this format per the contract).
 */
export function adaptProgressSnapshot(
  levelId: string,
  snapshot: ApiUserProgressSnapshot,
): LevelProgress {
  const filledCells = toFilledCells(snapshot.state_json as Record<string, unknown>);

  return {
    levelId,
    filledCells,
    elapsedTime: snapshot.time_spent,
    hintsUsed: snapshot.hints_used,
    mistakes: snapshot.mistakes,
    isCompleted: snapshot.completed_at !== null,
    completedAt: snapshot.completed_at,
    score: null,
    savedAt: new Date().toISOString(),
  };
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function build2DGrid(gridJson: ApiGridJson): CellData[][] {
  const grid: CellData[][] = Array.from({ length: gridJson.rows }, (_, r) =>
    Array.from({ length: gridJson.cols }, (_, c): CellData => ({
      row: r,
      col: c,
      letter: null,
      cellNumber: null,
      isBlocked: true, // default — override below
    })),
  );

  for (const cell of gridJson.cells) {
    const domainCell: CellData = {
      row: cell.row,
      col: cell.col,
      letter: cell.type === 'letter' ? '' : null,
      cellNumber: cell.number ?? null,
      isBlocked: cell.type === 'black',
    };
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    grid[cell.row]![cell.col] = domainCell;
  }

  return grid;
}

function adaptClue(apiClue: ApiClue, direction: 'across' | 'down'): Clue {
  return {
    // Synthetic stable ID for React keys and store lookups
    id: `${apiClue.number}${direction === 'across' ? 'A' : 'D'}`,
    number: apiClue.number,
    direction,
    text: apiClue.clue,
    startRow: apiClue.start.row,
    startCol: apiClue.start.col,
    length: apiClue.answer_length,
    // answer intentionally omitted — backend never sends it (level.schema.json#/notes/serverOnly)
  };
}

function difficultyLabel(difficulty: ApiLevel['difficulty']): string {
  return { easy: 'Kolay', medium: 'Orta', hard: 'Zor', expert: 'Uzman' }[difficulty];
}

function difficultyToCoinReward(difficulty: ApiLevel['difficulty']): number {
  return { easy: 20, medium: 40, hard: 70, expert: 100 }[difficulty];
}
