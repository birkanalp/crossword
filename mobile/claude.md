# Bulmaca Frontend – Architecture Context

## Tech Stack

- **Framework:** Expo ~52 (React Native) + expo-router ~4
- **Language:** TypeScript (strict)
- **State:** Zustand v5
- **Data Fetching:** TanStack Query v5
- **Grid Rendering:** react-native-svg
- **Storage:** AsyncStorage (progress, guest_id)
- **IAP:** RevenueCat SDK
- **Ads:** react-native-google-mobile-ads (AdMob)
- **Error Monitoring:** Sentry
- **Styling:** NativeWind

---

## File Structure

```
frontend/
├── app/                          # Expo Router screens
│   ├── (auth)/                   # Auth-gated layout
│   ├── game/
│   │   ├── levels.tsx            # Level browser with progression lock UI
│   │   └── [id].tsx              # Game screen
│   ├── leaderboard.tsx           # Tabs: Günlük / Tüm Zamanlar / En Hızlı
│   ├── index.tsx                 # Home screen
│   └── _layout.tsx
├── src/
│   ├── api/
│   │   ├── client.ts             # Plain fetch wrapper (apiRequest)
│   │   └── hooks/
│   │       ├── useLevels.ts      # Level list + unlock state
│   │       ├── useLevel.ts       # Single level data
│   │       ├── useLeaderboard.ts
│   │       └── ...
│   ├── store/                    # Zustand stores
│   ├── components/               # Reusable UI components
│   └── hooks/
│       ├── useNetworkStatus.ts   # Fetch-based connectivity check (no native module)
│       └── ...
```

---

## API Client

All API calls go through `src/api/client.ts` → `apiRequest`. **No Supabase JS client** — plain `fetch` only. Base URL: `EXPO_PUBLIC_SUPABASE_URL/functions/v1`.

Auth: `Authorization: Bearer <token>` (Supabase access token) + `apikey: <anon_key>`.

For guest users: `X-Guest-Id: <uuid>` header.

---

## Navigation Structure (Expo Router)

```
/ (index)           → Home
/game/levels        → Level browser
/game/[id]          → Puzzle game screen
/leaderboard        → Leaderboard tabs
/(auth)/login       → Login / register
/(auth)/profile     → Profile setup
```

---

## Game State (Zustand)

```typescript
{
  currentLevel, selectedCell, selectedClue,
  direction: 'across' | 'down',
  filledCells, elapsedTime, hintsUsed, mistakes, isCompleted
}
```

Auto-save on: every 3–5s (debounced), app background, exit level.

---

## Level Progression

`useLevels` hook receives `is_unlocked` flag from backend per level. Levels are ordered by `sort_order`. A level is locked if the previous one isn't completed. Locked levels display with a lock icon but preserve their difficulty color.

---

## Guest Flow

1. First launch → generate `guest_id` (UUID) → store in AsyncStorage
2. All API requests include `X-Guest-Id` header
3. On login → call `mergeGuestProgress` → TanStack Query cache invalidation

---

## Monetization

- **RevenueCat:** entitlement checks for premium content, purchase flows
- **AdMob:** rewarded ads for extra hints (`HintActionModal`), banner ads
  - Test App IDs in `app.json`; prod IDs go in `extra.admobRewardedIos/Android`
- `logAdEvent` called after each ad watch

---

## Connectivity

`useNetworkStatus` uses a `fetch`-based probe (not `expo-network`) with a 2-strike + 3s delay mechanism to avoid false-positive offline banners on boot.

---

## Analytics Events

`level_start`, `level_complete`, `hint_used`, `mistake_made`, `ad_watched`, `purchase_made`, `streak_increment`

---

## Critical Rules

- Never block UI on network — all data fetches are async with loading/error states
- Always allow offline play — restore last session from AsyncStorage
- API client uses plain `fetch` — do not introduce Supabase JS client in frontend
- Never trust client score — backend validates and recalculates
- Test layout changes on both iOS and Android
