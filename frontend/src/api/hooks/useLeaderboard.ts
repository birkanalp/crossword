import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../client';

// ─── Types ────────────────────────────────────────────────────────────────────
// Matches api.contract.json#/endpoints/getLeaderboard (contract v1.3.0)

export type LeaderboardType = 'daily' | 'all_time' | 'puzzle';
export type LeaderboardSortBy = 'score' | 'time';

export interface LeaderboardEntry {
  rank: number;
  user_id: string;
  display_name: string;
  /** Hex colour string, e.g. "#6366F1" */
  avatar_color: string;
  score: number;
  /** Duration in seconds */
  completion_time: number;
  mistakes: number;
  hints_used: number;
  /** ISO 8601 */
  created_at: string;
}

export interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  total: number;
  page: number;
  my_entry: LeaderboardEntry | null;
}

export interface UseLeaderboardParams {
  type: LeaderboardType;
  sort_by?: LeaderboardSortBy;
  /** Required when type === 'puzzle' */
  level_id?: string;
  /** YYYY-MM-DD — defaults to today on the server when type === 'daily' */
  date?: string;
  limit?: number;
  page?: number;
  /** Set false to suspend the query (e.g. when modal not yet open) */
  enabled?: boolean;
  /** Optional auth token for authenticated users */
  authToken?: string;
  /** Optional guest ID for anonymous users */
  guestId?: string;
}

// ─── Query Keys ───────────────────────────────────────────────────────────────

export const leaderboardKeys = {
  all: ['leaderboard'] as const,
  list: (
    type: LeaderboardType,
    sortBy: LeaderboardSortBy,
    levelId: string | undefined,
    date: string | undefined,
    limit: number,
    page: number,
  ) =>
    [
      ...leaderboardKeys.all,
      type,
      sortBy,
      levelId ?? '',
      date ?? '',
      limit,
      page,
    ] as const,
};

// ─── Hook ─────────────────────────────────────────────────────────────────────
// Contract: GET /getLeaderboard
// Query params: type, sort_by, level_id (puzzle only), date (daily only), limit, page

export function useLeaderboard(params: UseLeaderboardParams) {
  const {
    type,
    sort_by = 'score',
    level_id,
    date,
    limit = 50,
    page = 0,
    enabled = true,
    authToken,
    guestId,
  } = params;

  // puzzle type requires level_id — guard at query level to avoid 400 errors
  const isReady = enabled && (type !== 'puzzle' || !!level_id);

  return useQuery<LeaderboardResponse, Error>({
    queryKey: leaderboardKeys.list(type, sort_by, level_id, date, limit, page),
    queryFn: async (): Promise<LeaderboardResponse> => {
      const searchParams = new URLSearchParams({
        type,
        sort_by,
        limit: String(limit),
        page: String(page),
      });
      if (level_id) searchParams.set('level_id', level_id);
      if (date) searchParams.set('date', date);

      const requestOpts: {
        authToken?: string;
        guestId?: string;
      } = {};
      if (authToken) requestOpts.authToken = authToken;
      if (guestId) requestOpts.guestId = guestId;

      const res = await apiRequest<LeaderboardResponse>(
        `/getLeaderboard?${searchParams.toString()}`,
        requestOpts,
      );

      if (res.error || !res.data) {
        throw new Error(res.error ?? 'Lider tablosu yüklenemedi');
      }
      return res.data;
    },
    enabled: isReady,
    // 1-minute stale time — rankings update frequently but not per-second
    staleTime: 60_000,
  });
}
