import type { StreakState } from '../user/types';

// ─── Date Helpers ─────────────────────────────────────────────────────────────

function getTodayDateString(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function isYesterday(dateStr: string): boolean {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return yesterday.toISOString().slice(0, 10) === dateStr;
}

function isToday(dateStr: string): boolean {
  return getTodayDateString() === dateStr;
}

// ─── Streak Logic ─────────────────────────────────────────────────────────────

/**
 * Computes the new streak state after a successful daily completion.
 * Does NOT mutate the input.
 */
export function applyDailyCompletion(current: StreakState): StreakState {
  const today = getTodayDateString();

  // Already claimed today — idempotent
  if (current.isTodayClaimed && isToday(current.lastClaimedDate ?? '')) {
    return current;
  }

  const lastClaimed = current.lastClaimedDate;
  const isConsecutive = lastClaimed !== null && isYesterday(lastClaimed);

  const newStreak = isConsecutive ? current.currentStreak + 1 : 1;

  return {
    currentStreak: newStreak,
    longestStreak: Math.max(current.longestStreak, newStreak),
    lastClaimedDate: today,
    isTodayClaimed: true,
  };
}

/**
 * Resets streak check flags for a new day without modifying the count.
 * Called on app launch if the date has changed.
 */
export function refreshStreakForNewDay(current: StreakState): StreakState {
  const today = getTodayDateString();
  const isAlreadyToday = isToday(current.lastClaimedDate ?? '');
  if (isAlreadyToday) return current;

  const lastClaimed = current.lastClaimedDate;
  const wasYesterday = lastClaimed !== null && isYesterday(lastClaimed);

  return {
    ...current,
    // If they missed a day, streak resets to 0 (claimed today will set it to 1)
    currentStreak: wasYesterday ? current.currentStreak : 0,
    isTodayClaimed: false,
  };
}

/**
 * Streak milestone rewards. Returns coin bonus at each milestone.
 */
export function getStreakMilestoneBonus(streak: number): number {
  if (streak >= 30) return 200;
  if (streak >= 14) return 100;
  if (streak >= 7) return 50;
  if (streak >= 3) return 20;
  return 0;
}
