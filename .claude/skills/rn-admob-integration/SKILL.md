---
name: rn-admob-integration
description: Integrates AdMob interstitial and rewarded ads.
disable-model-invocation: true
argument-hint: <optional-focus-area>
---

# AdMob Integration

You are integrating Google AdMob (interstitial and rewarded ads) into a crossword puzzle mobile game built with Expo.

## Step 1 — Ad Service Wrapper

Create `frontend/src/services/adService.ts`:

A thin wrapper around the AdMob SDK that handles loading, showing, and error recovery.

```ts
interface AdService {
  init(): Promise<void>;
  preloadInterstitial(): Promise<void>;
  showInterstitial(): Promise<boolean>;  // true if shown
  preloadRewarded(): Promise<void>;
  showRewarded(): Promise<boolean>;      // true if reward earned
  isAdFree(): boolean;                    // check entitlement
}
```

- Use `react-native-google-mobile-ads` or equivalent Expo-compatible library.
- Ad unit IDs come from environment variables, never hardcoded.
- Use test ad IDs in development (`APP_ENV !== 'production'`).

## Step 2 — Interstitial Ads

### Preloading
- Preload the next interstitial after the current one is shown or dismissed.
- Preload on app start and after each display.
- If preload fails, retry with exponential backoff (max 3 retries).

### Showing
- Show interstitials at natural break points (e.g., after completing a level).
- **Never interrupt active gameplay.**
- If the ad isn't loaded yet, skip silently — do not block the user.
- Respect the `no_ads` entitlement — if the user has purchased ad removal, never show interstitials.

### Frequency Capping
- Do not show interstitials more than once every 3 minutes.
- Track last shown timestamp in memory.

## Step 3 — Rewarded Ads

### Use Case
- User watches a rewarded ad to earn a free hint.

### Flow
1. User taps "Watch ad for hint".
2. Check if rewarded ad is loaded.
3. If not loaded, show a brief loading indicator and attempt to load.
4. If load fails, show a graceful message ("Ad not available, try again later").
5. Show the rewarded ad.
6. On reward callback, grant the hint.
7. Emit `ad_watched` analytics event.
8. Preload the next rewarded ad.

### Important
- **Only grant the reward after the `onUserEarnedReward` callback.** Never grant on ad show.
- If the user dismisses early, no reward.

## Step 4 — Analytics Events

On ad completion, emit:
```ts
analytics.track({
  name: 'ad_watched',
  properties: {
    ad_type: 'interstitial' | 'rewarded',
    placement: 'level_complete' | 'hint_reward',
  }
});
```

Ensure this matches `CONTRACTS/events.contract.md` exactly.

## Step 5 — Graceful Failure

Ads must **never** break the app:

- Wrap all ad operations in try/catch.
- If AdMob SDK fails to initialize, disable ads for the session (don't crash).
- If an ad fails to load, skip it — the user continues normally.
- If an ad fails to show, resolve the promise with `false`.
- Log errors to Sentry for monitoring.
- Never show an error dialog to the user about ad failures.

## Step 6 — Update Status

Update `CONTRACTS/status.frontend.md` with:
- AdService implementation status.
- Interstitial flow status.
- Rewarded flow status.
- Analytics integration status.
- Any open TODOs.

## Rules

- **Never block the UI.** All ad operations are async and non-blocking. If an ad isn't ready, skip it.
- **Respect store policies.** Follow Google and Apple ad guidelines:
  - Don't incentivize clicks.
  - Don't show ads over content.
  - Clearly label rewarded ad prompts.
  - Respect user's ad removal purchase.
- Check `no_ads` entitlement before every interstitial show.
- Use test ad unit IDs in development to avoid policy violations.
- Keep the AdService decoupled — it should not import game logic directly.

If `$ARGUMENTS` is provided, focus only on that area (e.g., `/rn-admob-integration rewarded` for rewarded ads only).
