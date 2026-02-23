import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest } from '../client';
import { queryClient } from '../queryClient';
import type { UserProfile } from '@/domain/user/types';
import type { FilledCells, Clue } from '@/domain/crossword/types';
import { buildSubmitScoreBody } from '../adapters/scoreAdapter';

// ─── Query Keys ───────────────────────────────────────────────────────────────

export const profileKeys = {
  all: ['profile'] as const,
  detail: (userId: string) => [...profileKeys.all, userId] as const,
};

// ─── Hooks ────────────────────────────────────────────────────────────────────

/**
 * Fetches the authenticated user's profile.
 * TODO: No /getProfile endpoint in contract yet — CR-006.
 */
export function useProfile(userId: string | null) {
  return useQuery({
    queryKey: profileKeys.detail(userId ?? ''),
    queryFn: async () => {
      if (!userId) throw new Error('No user ID');
      // TODO (CR-006): Implement /getProfile endpoint on backend
      const response = await apiRequest<UserProfile>(`/getProfile?user_id=${userId}`);
      if (response.error) throw new Error(response.error);
      return response.data;
    },
    enabled: userId !== null,
  });
}

// ─── Submit Score ─────────────────────────────────────────────────────────────

export interface SubmitScoreParams {
  levelId: string;
  clues: Clue[];
  filledCells: FilledCells;
  timeSpent: number;
  hintsUsed: number;
  mistakes: number;
  authToken: string;
}

export interface SubmitScoreResult {
  score: number;
  rank: number;
  is_new_best: boolean;
}

/**
 * Submits a completed puzzle to the backend for authoritative scoring.
 *
 * Contract: POST /submitScore (api.contract.json#/endpoints/submitScore)
 * - Requires Bearer JWT (guests cannot submit to leaderboard)
 * - Body: { level_id, answers, time_spent, hints_used, mistakes }
 *   where answers format = { "1A": "WORD", "3D": "..." }
 * - Response: { score, rank, is_new_best }
 *
 * NOTE: The score returned by the server is authoritative.
 * Client-side calculateScore() is for UI preview only.
 */
export function useSubmitScore() {
  return useMutation({
    mutationFn: async (params: SubmitScoreParams): Promise<SubmitScoreResult> => {
      const body = buildSubmitScoreBody(
        params.levelId,
        params.clues,
        params.filledCells,
        params.timeSpent,
        params.hintsUsed,
        params.mistakes,
      );

      const response = await apiRequest<SubmitScoreResult>(
        '/submitScore',
        { method: 'POST', body, authToken: params.authToken },
      );

      if (response.error) throw new Error(response.error);
      return response.data;
    },
    onSuccess: (_, variables) => {
      // Invalidate leaderboard cache so it refreshes after a new score
      void queryClient.invalidateQueries({
        queryKey: ['leaderboard', 'level', variables.levelId],
      });
    },
  });
}

// ─── Merge Guest Progress ─────────────────────────────────────────────────────

export interface MergeGuestProgressResult {
  merged_count: number;
  skipped_count: number;
}

/**
 * Migrates progress from a guest_id to the authenticated user.
 * Call immediately after sign-up / login.
 *
 * Contract: POST /mergeGuestProgress (api.contract.json#/endpoints/mergeGuestProgress)
 */
export function useMergeGuestProgress() {
  return useMutation({
    mutationFn: async (params: {
      guestId: string;
      authToken: string;
    }): Promise<MergeGuestProgressResult> => {
      const response = await apiRequest<MergeGuestProgressResult>(
        '/mergeGuestProgress',
        {
          method: 'POST',
          body: { guest_id: params.guestId },
          authToken: params.authToken,
        },
      );
      if (response.error) throw new Error(response.error);
      return response.data;
    },
  });
}
