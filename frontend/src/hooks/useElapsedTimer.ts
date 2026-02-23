import { useEffect, useRef } from 'react';
import { useGameStore } from '@/store/gameStore';

// ─── Elapsed Timer Hook ───────────────────────────────────────────────────────
// Drives the 1-second game clock. Mount this once inside the level screen.

export function useElapsedTimer(): void {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const start = () => {
      intervalRef.current = setInterval(() => {
        useGameStore.getState().tickTimer();
      }, 1000);
    };

    const stop = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    // Subscribe to isTimerRunning changes
    const unsubscribe = useGameStore.subscribe(
      (state) => state.isTimerRunning,
      (isRunning) => {
        if (isRunning) {
          start();
        } else {
          stop();
        }
      },
      { fireImmediately: true },
    );

    return () => {
      stop();
      unsubscribe();
    };
  }, []);
}

// ─── Display Formatter ────────────────────────────────────────────────────────

/**
 * Formats elapsed seconds as MM:SS string.
 */
export function formatElapsedTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}
