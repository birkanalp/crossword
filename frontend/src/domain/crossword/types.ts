// ─── Core Crossword Types ────────────────────────────────────────────────────

export type Direction = 'across' | 'down';

export interface GridPosition {
  row: number;
  col: number;
}

export interface CellData {
  row: number;
  col: number;
  /** null means black/blocked cell */
  letter: string | null;
  /** Number displayed in top-left corner of the cell, if any */
  cellNumber: number | null;
  isBlocked: boolean;
}

export interface Clue {
  id: string;
  number: number;
  direction: Direction;
  text: string;
  /** Starting grid position */
  startRow: number;
  startCol: number;
  /** Length of the answer (contract: answer_length) */
  length: number;
  /**
   * Correct answer letters.
   * NEVER populated from the real API (level.schema.json#/notes/serverOnly).
   * Only present in local test fixtures or after a future "check" endpoint CR is implemented.
   * All game logic MUST guard: `if (clue.answer) { ... }`
   */
  answer?: string;
  /** Optional extra hint text for the clue (used by "İpucu" feature) */
  hint?: string;
}

export interface CrosswordLevel {
  id: string;
  // title is not part of the backend Level component (api.contract.json#/components/Level).
  // Displayed as a derived label or left empty until a CR adds it.
  title: string;
  /** Contract: api.contract.json#/components/Level — enum: easy | medium | hard */
  difficulty: 'easy' | 'medium' | 'hard';
  rows: number;
  cols: number;
  grid: CellData[][];
  clues: Clue[];
  /** UTC timestamp the level was published */
  publishedAt: string;
  isPremium: boolean;
  coinReward: number;
  maxScore: number;
}

export interface DailyPuzzle extends CrosswordLevel {
  date: string; // YYYY-MM-DD
}

// ─── User Progress Types ─────────────────────────────────────────────────────

/**
 * Sparse map of "row-col" → letter entered by the user.
 * Key format: `${row}-${col}`
 */
export type FilledCells = Record<string, string>;

export interface LevelProgress {
  levelId: string;
  filledCells: FilledCells;
  elapsedTime: number;
  hintsUsed: number;
  mistakes: number;
  isCompleted: boolean;
  completedAt: string | null;
  score: number | null;
  savedAt: string;
}

// ─── Scoring Types ────────────────────────────────────────────────────────────

export interface ScoreBreakdown {
  baseScore: number;
  timePenalty: number;
  hintPenalty: number;
  finalScore: number;
}

// ─── Hint Types ───────────────────────────────────────────────────────────────

export type HintType = 'reveal_letter' | 'reveal_word' | 'clear_wrong';

export interface HintCost {
  type: HintType;
  coinCost: number;
}

export const HINT_COSTS: Record<HintType, number> = {
  reveal_letter: 20,
  reveal_word: 50,
  clear_wrong: 30,
};
