// =============================================================================
// Scoring Formula
//
// base_score        = difficulty_multiplier * 1000
// time_penalty      = seconds_spent * 2
// hint_penalty      = hints_used * 50
// final_score       = max(0, base_score - time_penalty - hint_penalty)
// =============================================================================

import type { ScoreInput } from "./types.ts";

export function computeScore(input: ScoreInput): number {
  const base = Math.round(input.difficulty_multiplier * 1000);
  const timePenalty = input.time_spent * 2;
  const hintPenalty = input.hints_used * 50;
  return Math.max(0, base - timePenalty - hintPenalty);
}

// ---------------------------------------------------------------------------
// Difficulty multipliers (must match DB constraints)
// ---------------------------------------------------------------------------
export const DIFFICULTY_MULTIPLIER: Record<string, number> = {
  easy:   1.0,
  medium: 1.5,
  hard:   2.0,
  expert: 2.5,
};

// ---------------------------------------------------------------------------
// Streak bonus: +50 per day of active streak, capped at 500
// ---------------------------------------------------------------------------
export function streakBonus(currentStreak: number): number {
  return Math.min(currentStreak * 50, 500);
}
