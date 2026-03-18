// ─── Analytics Module ─────────────────────────────────────────────────────────
// Event names and property shapes are CONTRACTED in CONTRACTS/events.contract.md.
// Do NOT add or rename events without bumping the contract version.
//
// PostHog React Native SDK — lazy singleton.
// Configure POSTHOG_API_KEY in app.json extra.posthogApiKey.
// Configure POSTHOG_HOST in app.json extra.posthogHost (optional, defaults to posthog.com).

import Constants from 'expo-constants';

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
  | { name: 'hint_used'; level_id: string; hint_type: 'reveal_letter' | 'reveal_word' | 'check_letter' | 'clear_wrong' | 'show_hint'; clue_key?: string }

  // Auth
  | { name: 'signup_completed'; method: 'email' | 'apple' | 'google' | 'anonymous'; had_guest_progress: boolean }
  | { name: 'login_completed'; method: 'email' | 'apple' | 'google' }
  | { name: 'guest_progress_merged'; merged_count: number; skipped_count: number }

  // Purchases
  | { name: 'purchase_initiated'; product_id: string; source: 'paywall' | 'premium_level_gate' | 'settings' }
  | { name: 'purchase_completed'; product_id: string; source: 'paywall' | 'premium_level_gate' | 'settings' }
  | { name: 'purchase_failed'; product_id: string; reason: 'cancelled' | 'payment_declined' | 'unknown' };

// ─── PostHog singleton ────────────────────────────────────────────────────────

// Lazily import so Expo Go / test runners don't crash if the native module
// is unavailable. PostHog RN requires no native code — pure JS — so this is
// mainly a safety net for build-time tree-shaking and test isolation.

let _posthog: import('posthog-react-native').PostHog | null = null;
let _isInitialised = false;

function getPostHog(): import('posthog-react-native').PostHog | null {
  return _posthog;
}

// ─── Init ─────────────────────────────────────────────────────────────────────

/**
 * Call once after guest/user session is established.
 * Reads posthogApiKey (required) and posthogHost (optional) from app.json extra.
 */
export function initAnalytics(userId: string): void {
  if (_isInitialised) {
    // Already initialised — just update the identified user
    _posthog?.identify(userId);
    return;
  }

  const apiKey =
    (Constants.expoConfig?.extra?.posthogApiKey as string | undefined) ?? '';
  const host =
    (Constants.expoConfig?.extra?.posthogHost as string | undefined) ??
    'https://us.i.posthog.com';

  if (!apiKey || apiKey.startsWith('phc_YOUR')) {
    if (__DEV__) {
      console.warn('[Analytics] PostHog API key not configured — events will be logged locally only.');
    }
    _isInitialised = true; // Mark as init so __DEV__ logging works
    return;
  }

  try {
    const { PostHog } = require('posthog-react-native') as typeof import('posthog-react-native');
    _posthog = new PostHog(apiKey, {
      host,
      // Disable in development to avoid noise in PostHog dashboards
      disabled: __DEV__,
    });
    _posthog.identify(userId);
    _isInitialised = true;
    if (__DEV__) console.log('[Analytics] PostHog initialised for user:', userId);
  } catch (err) {
    console.warn('[Analytics] PostHog init failed:', err);
    _isInitialised = true; // Fallback to no-op to prevent repeated init attempts
  }
}

// ─── Track ────────────────────────────────────────────────────────────────────

/**
 * Track a typed analytics event.
 * All event names and shapes are contracted in CONTRACTS/events.contract.md.
 */
export function track(event: AnalyticsEvent): void {
  const { name, ...properties } = event;

  if (__DEV__) {
    console.log('[Analytics]', name, properties);
  }

  if (!_isInitialised) return;

  getPostHog()?.capture(name, properties);
}

// ─── User properties ─────────────────────────────────────────────────────────

/**
 * Update a user property (e.g. isPremium, totalCoins).
 */
export function setUserProperty(key: string, value: string | number | boolean): void {
  if (!_isInitialised) return;
  getPostHog()?.setPersonProperties({ [key]: value });
}

/**
 * Reset analytics identity (e.g. on logout).
 */
export function resetAnalytics(): void {
  getPostHog()?.reset();
}
