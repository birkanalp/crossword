// =============================================================================
// Shared Types — Crossword Puzzle Game Backend
// =============================================================================

export type Difficulty = "easy" | "medium" | "hard" | "expert";

// ---------------------------------------------------------------------------
// Level JSON structures (stored in DB; returned to client without answer_hash)
// ---------------------------------------------------------------------------

export interface GridCell {
  row: number;
  col: number;
  /** "letter" = playable cell; "black" = blocked cell */
  type: "letter" | "black";
  /** Clue number shown in corner (only on first cell of a word) */
  number?: number;
}

export interface GridJson {
  rows: number;
  cols: number;
  cells: GridCell[];
}

export interface Clue {
  number: number;
  clue: string;
  answer_length: number;
  start: { row: number; col: number };
}

export interface CluesJson {
  across: Clue[];
  down: Clue[];
}

// What the client receives (answer_hash is NEVER included)
export interface LevelPayload {
  id: string;
  version: number;
  difficulty: Difficulty;
  is_premium: boolean;
  grid_json: GridJson;
  clues_json: CluesJson;
}

// ---------------------------------------------------------------------------
// Score submission from client
// ---------------------------------------------------------------------------
export interface SubmitScoreRequest {
  level_id: string;
  /** Answers keyed by "<number><direction>", e.g. "1A", "3D" */
  answers: Record<string, string>;
  time_spent: number;  // seconds
  hints_used: number;
  mistakes: number;
}

export interface SubmitScoreResponse {
  score: number;
  rank: number;
  is_new_best: boolean;
}

export interface CheckWordRequest {
  level_id: string;
  clue_number: number;
  direction: "across" | "down";
  word: string;
  request_id?: string;
  state_json?: Record<string, unknown>;
  time_spent?: number;
  hints_used?: number;
  mistakes?: number;
}

// ---------------------------------------------------------------------------
// Guest progress merge
// ---------------------------------------------------------------------------
export interface MergeGuestRequest {
  guest_id: string;
}

export interface MergeGuestResponse {
  merged_count: number;
  skipped_count: number;
}

// ---------------------------------------------------------------------------
// Anti-cheat validation result
// ---------------------------------------------------------------------------
export interface AntiCheatResult {
  valid: boolean;
  reason?: string;
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------
export interface ScoreInput {
  difficulty_multiplier: number;
  time_spent: number;
  hints_used: number;
}
