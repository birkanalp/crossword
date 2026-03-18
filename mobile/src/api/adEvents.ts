import { Platform } from 'react-native';
import { apiRequest } from './client';

// ─── Ad Event Logging ─────────────────────────────────────────────────────────
// Fire-and-forget: logs ad interaction events to the backend.
// Network errors are swallowed so they never block the game UI.

export type AdEventType = 'started' | 'completed' | 'skipped' | 'failed';
export type AdActionType = 'reveal_letter' | 'show_hint';

export type AdEventPayload = {
  event_type: AdEventType;
  action_type: AdActionType;
  level_id?: string;
  ad_unit_id: string;
  user_id?: string | null;
  guest_id?: string | null;
};

/**
 * Log an ad lifecycle event.
 * Uses the project's `apiRequest` helper (Supabase Edge Function target).
 * Silently discards errors — analytics must never block the user.
 */
export async function logAdEvent(payload: AdEventPayload): Promise<void> {
  try {
    await apiRequest('/logAdEvent', {
      method: 'POST',
      body: {
        ...payload,
        platform: Platform.OS === 'ios' ? 'ios' : 'android',
      },
    });
  } catch {
    // Fire-and-forget: intentional no-op on network failure
  }
}
