import { QueryClient } from '@tanstack/react-query';

// ─── Global TanStack Query Client ─────────────────────────────────────────────

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Retry once on failure before showing error state
      retry: 1,
      // Cache data for 5 minutes
      staleTime: 5 * 60 * 1000,
      // Keep unused data in cache for 10 minutes
      gcTime: 10 * 60 * 1000,
      // Don't refetch on window focus in a mobile app context
      refetchOnWindowFocus: false,
      // Allow offline play — don't error if network is unavailable
      networkMode: 'offlineFirst',
    },
    mutations: {
      retry: 1,
      networkMode: 'offlineFirst',
    },
  },
});
