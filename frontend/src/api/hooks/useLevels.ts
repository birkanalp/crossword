import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../client';
import type { CrosswordLevel } from '@/domain/crossword/types';
import type { LevelProgress } from '@/domain/crossword/types';
import {
  adaptApiLevel,
  adaptProgressSnapshot,
  type GetLevelResponse,
} from '../adapters/levelAdapter';

// ─── checkWord ────────────────────────────────────────────────────────────────

export async function checkWord(
  levelId: string,
  clueNumber: number,
  direction: 'across' | 'down',
  word: string,
  opts?: { guestId?: string; authToken?: string },
): Promise<boolean> {
  const response = await apiRequest<{ correct: boolean }>('/checkWord', {
    method: 'POST',
    body: { level_id: levelId, clue_number: clueNumber, direction, word },
    guestId: opts?.guestId,
    authToken: opts?.authToken,
  });
  if (response.error) return false;
  return response.data.correct;
}

// ─── Query Keys ───────────────────────────────────────────────────────────────

export const levelKeys = {
  all: ['levels'] as const,
  detail: (id: string) => [...levelKeys.all, 'detail', id] as const,
  daily: () => [...levelKeys.all, 'daily'] as const,
};

// ─── Return Types ─────────────────────────────────────────────────────────────

export interface LevelWithProgress {
  level: CrosswordLevel;
  progress: LevelProgress | null;
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

/**
 * Fetches a single level and the caller's saved progress for it.
 *
 * Contract: GET /getLevel?id={uuid}
 * Response: { level, progress | null }
 * (api.contract.json#/endpoints/getLevel)
 */
export function useLevel(
  levelId: string | null,
  opts?: { guestId?: string; authToken?: string },
) {
  return useQuery({
    queryKey: levelKeys.detail(levelId ?? ''),
    queryFn: async (): Promise<LevelWithProgress> => {
      if (!levelId) throw new Error('No level ID');

      const response = await apiRequest<GetLevelResponse>(
        `/getLevel?id=${encodeURIComponent(levelId)}`,
        { guestId: opts?.guestId, authToken: opts?.authToken },
      );

      if (response.error) throw new Error(response.error);
      const { level: apiLevel, progress: apiProgress } = response.data;

      return {
        level: adaptApiLevel(apiLevel),
        progress: apiProgress
          ? adaptProgressSnapshot(levelId, apiProgress)
          : null,
      };
    },
    enabled: levelId !== null,
  });
}

/**
 * Fetches today's daily puzzle.
 *
 * NOTE: The backend getDailyChallenge endpoint is Phase 2 (status.backend.md #13).
 * This hook is a placeholder — it will 404 until the endpoint is deployed.
 * TODO: Update path to /getDailyChallenge once CR-003 is resolved.
 *
 * Contract gap: CR-003 in api.contract.json#/changeRequests
 */
export function useDailyPuzzle(opts?: { guestId?: string; authToken?: string }) {
  return useQuery({
    queryKey: levelKeys.daily(),
    queryFn: async (): Promise<LevelWithProgress> => {
      // TODO (CR-003): Replace with /getDailyChallenge once endpoint is live
      const response = await apiRequest<GetLevelResponse>(
        '/getDailyChallenge',
        { guestId: opts?.guestId, authToken: opts?.authToken },
      );

      if (response.error) throw new Error(response.error);
      const { level: apiLevel, progress: apiProgress } = response.data;
      const levelId = apiLevel.id;

      return {
        level: adaptApiLevel(apiLevel),
        progress: apiProgress
          ? adaptProgressSnapshot(levelId, apiProgress)
          : null,
      };
    },
    staleTime: 60 * 60 * 1000, // 1 hour — daily puzzle won't change mid-day
  });
}
