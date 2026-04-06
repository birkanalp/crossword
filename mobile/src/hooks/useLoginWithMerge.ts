import { useCallback, useState } from 'react';
import { useUserStore } from '@/store/userStore';
import { apiRequest } from '@/api/client';
import type { AppUser, UserProfile } from '@/domain/user/types';

export interface MergeResult {
  merged_count: number;
  skipped_count: number;
}

/**
 * Handles the full login + guest progress merge flow.
 *
 * Usage:
 * 1. Authenticate the user with Apple/Google/Supabase Auth (external step).
 * 2. Call `loginWithMerge(authenticatedUser, profile)` from the sign-in handler.
 * 3. The hook will:
 *    a. Capture the current guest_id from the store.
 *    b. Call `loginUser` to replace the guest session with the authenticated session.
 *    c. POST /mergeGuestProgress with the old guest_id and the new JWT.
 *
 * If the merge API call fails it is silently swallowed — the login still
 * succeeds so the user is not blocked. Progress merge failures are logged to
 * the console for debugging.
 *
 * Contract: POST /mergeGuestProgress
 *   Body:    { guest_id: string }
 *   Auth:    Bearer <JWT>
 *   Response: { merged_count: number; skipped_count: number }
 */
export function useLoginWithMerge() {
  const setAuthenticatedUser = useUserStore((s) => s.setAuthenticatedUser);
  const currentUser = useUserStore((s) => s.user);
  const [isMerging, setIsMerging] = useState(false);
  const [mergeResult, setMergeResult] = useState<MergeResult | null>(null);

  const loginWithMerge = useCallback(
    async (newUser: AppUser, profile: UserProfile): Promise<void> => {
      // Capture guest ID before overwriting the store state
      const guestId =
        currentUser?.type === 'guest' ? currentUser.guestId : null;

      // Step 1: update the Zustand store (navigates away from guest session)
      setAuthenticatedUser(newUser, profile);

      // Step 2: merge guest progress if a guest session existed
      const jwt = newUser.type === 'authenticated' ? newUser.jwt : undefined;
      if (!guestId || !jwt) return;

      setIsMerging(true);
      try {
        const response = await apiRequest<MergeResult>('/mergeGuestProgress', {
          method: 'POST',
          body: { guest_id: guestId },
          authToken: jwt,
        });

        if (response.error) {
          console.warn('[loginWithMerge] merge failed:', response.error);
        } else if (response.data) {
          setMergeResult(response.data);
          console.log(
            `[loginWithMerge] merged ${response.data.merged_count} records, skipped ${response.data.skipped_count}`,
          );
        }
      } catch (err) {
        console.warn('[loginWithMerge] merge error:', err);
      } finally {
        setIsMerging(false);
      }
    },
    [currentUser, setAuthenticatedUser],
  );

  return { loginWithMerge, isMerging, mergeResult };
}
