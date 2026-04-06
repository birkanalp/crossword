import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest } from '../client';
import { queryClient } from '../queryClient';
import type { UserProfile } from '@/domain/user/types';
import type { FilledCells, Clue } from '@/domain/crossword/types';
import { buildSubmitScoreBody } from '../adapters/scoreAdapter';

interface ApiProfileResponse {
  user_id: string;
  username: string | null;
  avatar_color: string | null;
  levels_completed: number;
  total_score: number;
  best_score: number;
  total_time_spent: number;
  total_entries: number;
  created_at: string | null;
}

function adaptProfileResponse(response: ApiProfileResponse): UserProfile {
  return {
    userId: response.user_id,
    totalScore: response.total_score,
    levelsCompleted: response.levels_completed,
    coins: 0,
    streak: 0,
    lastActiveDate: new Date().toISOString().slice(0, 10),
    isPremium: false,
    rank: response.total_entries > 0 ? response.total_entries : null,
    ...(response.username ? { username: response.username } : {}),
    ...(response.avatar_color ? { avatarColor: response.avatar_color } : {}),
  };
}

// ─── Query Keys ───────────────────────────────────────────────────────────────

export const profileKeys = {
  all: ['profile'] as const,
  detail: (userId: string) => [...profileKeys.all, userId] as const,
};

// ─── Hooks ────────────────────────────────────────────────────────────────────

/**
 * Fetches the authenticated user's profile.
 * Contract: GET /getProfile (api.contract.json#/endpoints/getProfile)
 * Requires Bearer JWT — disabled for guests.
 */
export function useProfile(userId: string | null, authToken?: string) {
  return useQuery({
    queryKey: profileKeys.detail(userId ?? ''),
    queryFn: async ({ signal }) => {
      if (!userId) throw new Error('No user ID');
      const response = await apiRequest<ApiProfileResponse>(
        '/getProfile',
        { ...(authToken ? { authToken } : {}), signal },
      );
      if (response.error || !response.data) throw new Error(response.error ?? 'No profile data');
      return adaptProfileResponse(response.data);
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

      if (response.error || !response.data) throw new Error(response.error ?? 'No data');
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
      if (response.error || !response.data) throw new Error(response.error ?? 'No data');
      return response.data;
    },
  });
}
