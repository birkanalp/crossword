import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../client';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  avatarUrl: string | null;
  score: number;
  completionTime: number;
  isCurrentUser: boolean;
}

export interface Leaderboard {
  entries: LeaderboardEntry[];
  currentUserRank: number | null;
  totalEntries: number;
}

// ─── Query Keys ───────────────────────────────────────────────────────────────

export const leaderboardKeys = {
  all: ['leaderboard'] as const,
  daily: (date: string) => [...leaderboardKeys.all, 'daily', date] as const,
  level: (levelId: string) => [...leaderboardKeys.all, 'level', levelId] as const,
};

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useDailyLeaderboard(date: string) {
  return useQuery({
    queryKey: leaderboardKeys.daily(date),
    queryFn: async () => {
      const response = await apiRequest<Leaderboard>(`/leaderboard/daily/${date}`);
      if (response.error) throw new Error(response.error);
      return response.data;
    },
    staleTime: 2 * 60 * 1000, // Refresh every 2 minutes
  });
}

export function useLevelLeaderboard(levelId: string | null) {
  return useQuery({
    queryKey: leaderboardKeys.level(levelId ?? ''),
    queryFn: async () => {
      if (!levelId) throw new Error('No level ID');
      const response = await apiRequest<Leaderboard>(`/leaderboard/level/${levelId}`);
      if (response.error) throw new Error(response.error);
      return response.data;
    },
    enabled: levelId !== null,
  });
}
