import type { ScoreBreakdown } from './types';

// ─── Scoring Constants ────────────────────────────────────────────────────────

const BASE_SCORE = 1000;

/** Penalty points deducted per second elapsed */
const TIME_PENALTY_PER_SECOND = 0.5;

/** Penalty points deducted per hint used */
const HINT_PENALTY = 50;

/** Minimum score a player can receive (never go negative) */
const MIN_SCORE = 0;

// ─── Score Calculator ─────────────────────────────────────────────────────────

/**
 * Calculates a final score based on time and hints used.
 * All scoring validation must be re-verified on the backend.
 */
export function calculateScore(
  elapsedSeconds: number,
  hintsUsed: number,
): ScoreBreakdown {
  const timePenalty = Math.floor(elapsedSeconds * TIME_PENALTY_PER_SECOND);
  const hintPenalty = hintsUsed * HINT_PENALTY;

  const rawFinal = BASE_SCORE - timePenalty - hintPenalty;
  const finalScore = Math.max(rawFinal, MIN_SCORE);

  return {
    baseScore: BASE_SCORE,
    timePenalty,
    hintPenalty,
    finalScore,
  };
}

// ─── Coin Reward Calculator ───────────────────────────────────────────────────

export interface CoinReward {
  completionBonus: number;
  streakBonus: number;
  totalCoins: number;
}

export function calculateCoinReward(
  levelCoinReward: number,
  currentStreak: number,
): CoinReward {
  const streakBonus = Math.min(currentStreak * 5, 50); // Cap streak bonus at 50
  const totalCoins = levelCoinReward + streakBonus;

  return {
    completionBonus: levelCoinReward,
    streakBonus,
    totalCoins,
  };
}
