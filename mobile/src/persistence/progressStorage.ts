import { storageGet, storageSet, storageRemove } from './storage';
import { STORAGE_KEYS } from './keys';
import type { LevelProgress, FilledCells } from '@/domain/crossword/types';

// ─── Level Progress Persistence ───────────────────────────────────────────────

export async function saveProgress(
  levelId: string,
  filledCells: FilledCells,
  elapsedTime: number,
  hintsUsed: number,
  mistakes: number,
): Promise<void> {
  const progress: LevelProgress = {
    levelId,
    filledCells,
    elapsedTime,
    hintsUsed,
    mistakes,
    isCompleted: false,
    completedAt: null,
    score: null,
    savedAt: new Date().toISOString(),
  };
  await storageSet(STORAGE_KEYS.levelProgress(levelId), progress);
}

export async function saveCompletedProgress(
  levelId: string,
  filledCells: FilledCells,
  elapsedTime: number,
  hintsUsed: number,
  mistakes: number,
  score: number,
): Promise<void> {
  const progress: LevelProgress = {
    levelId,
    filledCells,
    elapsedTime,
    hintsUsed,
    mistakes,
    isCompleted: true,
    completedAt: new Date().toISOString(),
    score,
    savedAt: new Date().toISOString(),
  };
  await storageSet(STORAGE_KEYS.levelProgress(levelId), progress);
}

export async function loadProgress(levelId: string): Promise<LevelProgress | null> {
  return storageGet<LevelProgress>(STORAGE_KEYS.levelProgress(levelId));
}

export async function clearProgress(levelId: string): Promise<void> {
  await storageRemove(STORAGE_KEYS.levelProgress(levelId));
}

// ─── Completed Levels Registry ────────────────────────────────────────────────

export async function loadCompletedLevelIds(): Promise<string[]> {
  return (await storageGet<string[]>(STORAGE_KEYS.COMPLETED_LEVELS)) ?? [];
}

export async function markLevelCompleted(levelId: string): Promise<void> {
  const existing = await loadCompletedLevelIds();
  if (existing.includes(levelId)) return;
  await storageSet(STORAGE_KEYS.COMPLETED_LEVELS, [...existing, levelId]);
}
