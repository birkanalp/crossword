// =============================================================================
// Anti-Cheat Validation
//
// Strategy:
//   1. Answer hash verification  — client answers must produce the stored SHA-256
//   2. Time bounds check         — completion time must be plausible
//   3. Hint/mistake sanity       — values must be within sane limits
//
// The server NEVER trusts client-provided scores.
// Scores are computed entirely server-side after validation passes.
// =============================================================================

import type { AntiCheatResult, Difficulty } from "./types.ts";

// ---------------------------------------------------------------------------
// Time bounds per difficulty (seconds)
// MIN: fastest humanly possible; MAX: session timeout threshold
// ---------------------------------------------------------------------------
const TIME_BOUNDS: Record<Difficulty, { min: number; max: number }> = {
  easy:   { min: 10,   max: 7_200  },  // 10s – 2h
  medium: { min: 30,   max: 14_400 },  // 30s – 4h
  hard:   { min: 60,   max: 28_800 },  // 60s – 8h
  expert: { min: 90,   max: 43_200 },  // 90s – 12h
};

const MAX_HINTS   = 20;
const MAX_MISTAKES = 500;

// ---------------------------------------------------------------------------
// Build the canonical answer string for hashing
//
// Format: "<level_id>:<version>:<ANS1>:<ANS2>:..."
//   - answers are uppercased and trimmed
//   - sorted by key ("1A" < "1D" < "2A" < "2D" ...) using natural sort
// ---------------------------------------------------------------------------
export function buildCanonicalAnswerString(
  levelId: string,
  version: number,
  answers: Record<string, string>,
): string {
  const sorted = Object.keys(answers)
    .sort(naturalSort)
    .map((k) => answers[k].trim().toUpperCase());

  return [levelId, String(version), ...sorted].join(":");
}

/** Natural-sort comparator for clue keys like "1A", "10D", "2A" */
function naturalSort(a: string, b: string): number {
  const numA = parseInt(a, 10);
  const numB = parseInt(b, 10);
  if (numA !== numB) return numA - numB;
  // Same number — direction: A before D
  return a.slice(-1).localeCompare(b.slice(-1));
}

// ---------------------------------------------------------------------------
// SHA-256 via Web Crypto API (available in Deno)
// ---------------------------------------------------------------------------
export async function sha256Hex(input: string): Promise<string> {
  const encoded = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ---------------------------------------------------------------------------
// Main validation entry point
// ---------------------------------------------------------------------------
export async function validateSubmission(params: {
  levelId: string;
  version: number;
  difficulty: Difficulty;
  storedHash: string;
  clientAnswers: Record<string, string>;
  timeSpent: number;
  hintsUsed: number;
  mistakes: number;
}): Promise<AntiCheatResult> {
  const {
    levelId, version, difficulty, storedHash,
    clientAnswers, timeSpent, hintsUsed, mistakes,
  } = params;

  // 1. Validate answer hash
  const canonical = buildCanonicalAnswerString(levelId, version, clientAnswers);
  const computedHash = await sha256Hex(canonical);
  if (computedHash !== storedHash) {
    return { valid: false, reason: "answer_hash_mismatch" };
  }

  // 2. Time bounds
  const bounds = TIME_BOUNDS[difficulty];
  if (timeSpent < bounds.min) {
    return { valid: false, reason: `time_too_short (min=${bounds.min}s)` };
  }
  if (timeSpent > bounds.max) {
    return { valid: false, reason: `time_too_long (max=${bounds.max}s)` };
  }

  // 3. Sanity checks on hints and mistakes
  if (hintsUsed < 0 || hintsUsed > MAX_HINTS) {
    return { valid: false, reason: `hints_out_of_range (0–${MAX_HINTS})` };
  }
  if (mistakes < 0 || mistakes > MAX_MISTAKES) {
    return { valid: false, reason: `mistakes_out_of_range (0–${MAX_MISTAKES})` };
  }

  return { valid: true };
}

// ---------------------------------------------------------------------------
// Utility: compute answer_hash to store when creating a level
// ---------------------------------------------------------------------------
export async function computeLevelAnswerHash(
  levelId: string,
  version: number,
  correctAnswers: Record<string, string>,
): Promise<string> {
  const canonical = buildCanonicalAnswerString(levelId, version, correctAnswers);
  return sha256Hex(canonical);
}
