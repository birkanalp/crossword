// ─── Analytics Module ─────────────────────────────────────────────────────────
// Event names and property shapes are CONTRACTED in CONTRACTS/events.contract.md.
// Do NOT add or rename events without bumping the contract version.
// TODO: Wire up to analytics provider (PostHog recommended per events.contract.md).

// ─── Client-Fired Event Types ─────────────────────────────────────────────────
// Source: CONTRACTS/events.contract.md — Section 1. Client-Fired Events

export type AnalyticsEvent =
  // App lifecycle
  | { name: 'app_opened'; is_guest: boolean; guest_id?: string }

  // Puzzle
  | { name: 'puzzle_started'; level_id: string; difficulty: string; is_premium: boolean; is_daily: boolean; is_guest: boolean }
  | { name: 'puzzle_completed'; level_id: string; difficulty: string; score: number; rank: number; is_new_best: boolean; time_spent: number; hints_used: number; mistakes: number; is_daily: boolean }
  | { name: 'puzzle_abandoned'; level_id: string; difficulty: string; time_spent: number; progress_pct: number }

  // Hints — contract: hint_type enum is reveal_letter | reveal_word | check_letter
  // NOTE: Frontend uses 'clear_wrong' which is not in the contract — CR-007
  | { name: 'hint_used'; level_id: string; hint_type: 'reveal_letter' | 'reveal_word' | 'check_letter' | 'clear_wrong'; clue_key?: string }

  // Auth
  | { name: 'signup_completed'; method: 'email' | 'apple' | 'google' | 'anonymous'; had_guest_progress: boolean }
  | { name: 'login_completed'; method: 'email' | 'apple' | 'google' }
  | { name: 'guest_progress_merged'; merged_count: number; skipped_count: number }

  // Purchases
  | { name: 'purchase_initiated'; product_id: string; source: 'paywall' | 'premium_level_gate' | 'settings' }
  | { name: 'purchase_completed'; product_id: string; source: 'paywall' | 'premium_level_gate' | 'settings' }
  | { name: 'purchase_failed'; product_id: string; reason: 'cancelled' | 'payment_declined' | 'unknown' };

// ─── Init ─────────────────────────────────────────────────────────────────────

let _isInitialised = false;

/**
 * Call once after guest/user session is established.
 * TODO: Replace with real PostHog SDK init.
 */
export function initAnalytics(userId: string): void {
  _isInitialised = true;
  // TODO: posthog.identify(userId);
  if (__DEV__) console.log('[Analytics] Initialised for user:', userId);
}

// ─── Track ────────────────────────────────────────────────────────────────────

/**
 * Track a typed analytics event.
 * All event names and shapes are contracted in CONTRACTS/events.contract.md.
 */
export function track(event: AnalyticsEvent): void {
  if (!_isInitialised) return;
  const { name, ...properties } = event;
  // TODO: posthog.capture(name, properties);
  if (__DEV__) console.log('[Analytics]', name, properties);
}

/**
 * Update a user property (e.g. isPremium, totalCoins).
 * TODO: posthog.setPersonProperties({ [key]: value });
 */
export function setUserProperty(key: string, value: string | number | boolean): void {
  if (!_isInitialised) return;
  // TODO: posthog.setPersonProperties({ [key]: value });
}
