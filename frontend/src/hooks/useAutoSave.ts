import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useGameStore } from '@/store/gameStore';
import { saveProgress, saveCompletedProgress } from '@/persistence/progressStorage';

// ─── Auto-Save Hook ───────────────────────────────────────────────────────────
// Triggers a save every SAVE_INTERVAL_MS, on app backgrounding, and on completion.

const SAVE_INTERVAL_MS = 4000; // 4 seconds

export function useAutoSave(): void {
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const flush = () => {
    const state = useGameStore.getState();
    const { currentLevel, filledCells, elapsedTime, hintsUsed, mistakes, isCompleted, scoreBreakdown } = state;

    if (!currentLevel) return;

    if (isCompleted && scoreBreakdown) {
      void saveCompletedProgress(
        currentLevel.id,
        filledCells,
        elapsedTime,
        hintsUsed,
        mistakes,
        scoreBreakdown.finalScore,
      );
    } else {
      void saveProgress(currentLevel.id, filledCells, elapsedTime, hintsUsed, mistakes);
    }
  };

  useEffect(() => {
    // Periodic save
    timerRef.current = setInterval(flush, SAVE_INTERVAL_MS);

    // Save on app background
    const subscription = AppState.addEventListener(
      'change',
      (nextState: AppStateStatus) => {
        if (nextState === 'background' || nextState === 'inactive') {
          flush();
        }
      },
    );

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      subscription.remove();
      // Final save on unmount (level exit)
      flush();
    };
    // flush is stable — no deps needed
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
