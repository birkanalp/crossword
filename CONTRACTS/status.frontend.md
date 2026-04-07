# Frontend Status
**contractVersion:** 1.3.1
**lastUpdated:** 2026-04-07
**owner:** frontend-agent

---

## Milestone Tracker

| # | Milestone | Status | Contract Ref | Notes |
|---|-----------|--------|-------------|-------|
| 1 | Expo project structure (SDK 52, expo-router 4, TypeScript strict) | ✅ Done | — | package.json, tsconfig.json, app.json, babel.config.js |
| 2 | Navigation routing (`app/` directory, all routes) | ✅ Done | — | Root, game, auth, profile, leaderboard, store |
| 3 | Domain types aligned to contract | ✅ Done | `level.schema.json`, `api.contract.json#/components/Level` | `answer?` optional; difficulty limited to easy/medium/hard |
| 4 | Zustand stores (gameStore, userStore, settingsStore) | ✅ Done | — | subscribeWithSelector; typed selectors exported |
| 5 | Guest user system | ✅ Done | `api.contract.json#/auth/schemes/guestId` | UUID v4, no prefix, stored in AsyncStorage |
| 6 | AsyncStorage persistence layer | ✅ Done | — | `src/persistence/` — progress, user, profile, streak, settings |
| 7 | Store auto-persistence subscriptions | ✅ Done | — | `storeSubscriptions.ts` — writes on every state change |
| 8 | API client targeting Supabase Edge Functions | ✅ Done | `api.contract.json#/baseUrl` | `${SUPABASE_URL}/functions/v1`; bearer + x-guest-id headers |
| 9 | Level adapter (contract schema → domain types) | ✅ Done | `api.contract.json#/components/Level`, `level.schema.json` | Flat cell list → 2D grid; across/down → unified Clue[] |
| 10 | Score adapter (FilledCells → answers map) | ✅ Done | `api.contract.json#/endpoints/submitScore/requestBody` | `{ "1A": "WORD", "3D": "..." }` format |
| 11 | `getLevel` hook | ✅ Done | `api.contract.json#/endpoints/getLevel` | GET `/getLevel?id=`, handles `{ level, progress }` envelope |
| 12 | `submitScore` mutation | ✅ Done | `api.contract.json#/endpoints/submitScore` | POST `/submitScore`; requires Bearer JWT |
| 13 | `mergeGuestProgress` mutation | ✅ Done | `api.contract.json#/endpoints/mergeGuestProgress` | POST `/mergeGuestProgress`; centralized in root auth state listener; retries while guestId is retained |
| 14 | Analytics events aligned to contract | ✅ Done | `events.contract.md` | `puzzle_started`, `puzzle_completed`, `puzzle_abandoned`, etc. |
| 15 | Sentry scaffold | ✅ Done | — | `src/lib/sentry.ts`; init in root layout |
| 16 | RevenueCat scaffold | ✅ Done | — | `src/lib/revenuecat.ts`; entitlement checks, purchase flow |
| 17 | AdMob scaffold | ✅ Done | — | `src/lib/admob.ts`; interstitial + rewarded (TODO wired) |
| 18 | Home screen | ✅ Done | — | Streak banner, daily card, level card, quick nav |
| 19 | Level screen skeleton | ✅ Done | — | Grid + clue panel + timer + auto-save |
| 20 | SVG grid renderer | ✅ Done | — | `CrosswordGrid` + `GridCell` (memoised); `buildCellStates()` |
| 21 | Clues panel with auto-scroll | ✅ Done | — | `CluesList`; measureLayout scroll-to-active |
| 22 | Auto-save hook | ✅ Done | — | 4s debounce + AppState background + unmount flush |
| 23 | Elapsed timer hook | ✅ Done | — | Zustand subscriber-driven, 1s tick |
| 24 | App boot sequence | ✅ Done | — | `useAppBoot`: settings → user restore → SDK init → splash hide |

---

## Phase 1 Complete ✅

All Phase 1 deliverables are implemented. Contract alignment audit completed 2026-02-21.

---

## Open Contract Gaps

These items are tracked as Change Requests in `api.contract.json#/changeRequests`.
The frontend has compensated with safe defaults where possible.

| CR | Title | Frontend Impact | Blocker? |
|----|-------|----------------|---------|
| CR-001 | Level missing title, publishedAt, coinReward, maxScore | Derived defaults in adapter | No |
| CR-002 | Answers never sent — client-side validation impossible | Wrong-cell highlight disabled; mistake count disabled | No (degrades UX) |
| CR-003 | `getDailyChallenge` endpoint not yet live | Daily puzzle screen returns error | **Yes — daily puzzle blocked** |
| CR-004 | `saveProgress` endpoint not yet live | Mid-game state only in AsyncStorage | No (offline fallback works) |
| CR-005 | `getLeaderboard` endpoint not yet live | Leaderboard screen is placeholder | No |
| CR-006 | `getProfile` endpoint not yet live | Profile screen uses local store only | No |
| CR-007 | `clear_wrong` hint type not in events contract | Frontend sends non-contracted event value | No (analytics only) |
| CR-008 | `expert` difficulty not in backend schema | Removed from frontend types | No |

---

## Phase 2 Backlog

| # | Milestone | Status | Contract Dependency |
|---|-----------|--------|-------------------|
| 25 | CrosswordKeyboard component | 🔜 Pending | — |
| 26 | Completion modal (score animation, rank reveal) | 🔜 Pending | CR-003 (rank from submitScore) |
| 27 | Hint purchase UI (coin deduction + rewarded ad fallback) | 🔜 Pending | CR-007 (hint_type alignment) |
| 28 | Apple / Google Sign-In | 🔜 Pending | Backend: milestone #20 |
| 29 | Post-completion submitScore call | 🔜 Pending | Requires authToken (milestone 28) |
| 30 | Interstitial ad after level | 🔜 Pending | Install react-native-google-mobile-ads |
| 31 | Rewarded ad for extra hints | 🔜 Pending | Same |
| 32 | Level browser screen (paginated) | ✅ In progress | Uses getDailyChallenge; full list blocked by CR-009 (listLevels) |
| 33 | Leaderboard UI | 🔜 Pending | CR-005 |
| 34 | Store / paywall UI — coin packages screen | ✅ Done | `api.contract.json#/endpoints/getCoinPackages` (contract v1.2.5) |
| 35 | Word-correct glow animation (Reanimated) | 🔜 Pending | CR-002 (need answer or check endpoint) |
| 36 | Wrong-answer shake animation | 🔜 Pending | CR-002 |
| 37 | Sound effects (expo-av) | 🔜 Pending | — |
| 38 | Push notification triggers (streak reminders) | 🔜 Pending | `events.contract.md` new server events |
| 39 | Offline-first sync: merge server + local progress on reconnect | 🔜 Pending | CR-004 |
| 40 | Answer-history persistence + resume-from-progress | ✅ Done | checkWord request_id/state_json; getLevel progress hydrate |

---

## Admin Panel (admin/)

Separate Next.js web app for puzzle moderation and metrics dashboard.

| # | Milestone | Status | Contract Ref |
|---|-----------|--------|--------------|
| 1 | Admin app scaffold (Next.js 14, Supabase auth) | ✅ Done | — |
| 2 | Admin API client (admin endpoints) | ✅ Done | `api.contract.json` admin* |
| 3 | Dashboard (metrics overview + daily series) | ✅ Done | GET /admin/metrics/* |
| 4 | Puzzle list (status filter, pagination) | ✅ Done | GET /admin/puzzles |
| 5 | Puzzle approval detail (grid, clues, fill/clear, edit, approve/reject) | ✅ Done | GET/PATCH/POST /admin/puzzles/* |

---

## Contract Change Protocol

Before implementing any screen or hook that touches the API:

1. Check `api.contract.json` for the endpoint shape
2. If the endpoint doesn't exist, add a CR to `api.contract.json#/changeRequests` and build a placeholder
3. If a contract field is missing, add a CR — do not invent field names
4. After backend resolves a CR, update this file (remove from Open Gaps, tick off backlog milestone)
5. Bump this file's `lastUpdated` and add a changelog entry

---

## Changelog

| Date | Version | Notes |
|------|---------|-------|
| 2026-04-07 | 1.3.1 | Guest → login merge hardening: dashboard remains first screen, root auth listener is the single merge owner, authenticated level/daily/list/checkWord requests send Bearer JWT, and successful merge invalidates progress-sensitive query caches. |
| 2026-03-02 | 1.2.5 | Coin shop screen: `app/store.tsx` fully implemented (featured/regular/discount cards, dark mode, bottom-sheet purchase modal). `useCoinPackages` hook wired to GET /getCoinPackages. `expo-linear-gradient ~14.0.0` added to dependencies. RevenueCat purchase step is a placeholder stub. |
| 2026-02-25 | 1.0.1 | Fixed non-UUID level navigation: home → /game/levels; useLevel UUID guard; level screen error handling + retry. CR-009 listLevels. |
| 2026-02-21 | 1.0.0 | Phase 1 complete. Initial audit vs. backend contracts. 8 CRs filed. |
| 2026-02-25 | 1.1.2 | Answer-history + resume: loadLevel accepts full LevelProgress; checkWord sends request_id, state_json, time_spent, hints_used, mistakes; deriveCorrectClueIds for resume; toFilledCells sanitization in adapter. |

---

## File Map

```
frontend/
├── app/
│   ├── _layout.tsx                  ← root: Sentry + store subscriptions + boot
│   ├── index.tsx                    ← Home screen
│   ├── (auth)/login.tsx             ← Login skeleton (Apple/Google TODO)
│   ├── game/
│   │   ├── _layout.tsx
│   │   ├── levels.tsx               ← level browser (getDailyChallenge; listLevels CR-009)
│   │   ├── daily.tsx                ← daily bridge → level/[id]
│   │   └── level/[id].tsx           ← Level screen
│   ├── profile.tsx
│   ├── leaderboard.tsx              ← placeholder (blocked: CR-005)
│   └── store.tsx                    ← coin packages shop (full implementation)
└── src/
    ├── api/
    │   ├── client.ts                ← Supabase Edge Functions base URL
    │   ├── queryClient.ts           ← TanStack Query, offlineFirst
    │   ├── adapters/
    │   │   ├── levelAdapter.ts      ← ApiLevel → CrosswordLevel (fills CR-001 gaps)
    │   │   └── scoreAdapter.ts      ← FilledCells → { "1A": "WORD" } format
    │   └── hooks/
    │       ├── useLevels.ts         ← getLevel, getDailyChallenge
    │       ├── useCoinPackages.ts   ← GET /getCoinPackages (contract v1.2.5)
    │       ├── useLeaderboard.ts    ← placeholder (CR-005)
    │       └── useProfile.ts        ← getProfile (CR-006), submitScore, mergeGuestProgress
    ├── domain/
    │   ├── crossword/
    │   │   ├── types.ts             ← answer?: string (CR-002)
    │   │   ├── logic.ts             ← guards on optional answer
    │   │   └── scoring.ts
    │   ├── user/
    │   │   ├── types.ts
    │   │   └── guest.ts             ← pure UUID v4 (no prefix)
    │   └── streak/logic.ts
    ├── store/
    │   ├── gameStore.ts
    │   ├── userStore.ts
    │   ├── settingsStore.ts
    │   └── storeSubscriptions.ts
    ├── persistence/
    │   ├── keys.ts
    │   ├── storage.ts
    │   ├── progressStorage.ts
    │   └── userStorage.ts
    ├── components/
    │   ├── grid/
    │   │   ├── CrosswordGrid.tsx
    │   │   ├── GridCell.tsx
    │   │   └── types.ts
    │   ├── clues/CluesList.tsx
    │   └── ui/Button.tsx
    ├── hooks/
    │   ├── useAppBoot.ts
    │   ├── useAutoSave.ts
    │   ├── useElapsedTimer.ts
    │   └── useHaptics.ts
    ├── lib/
    │   ├── sentry.ts
    │   ├── analytics.ts             ← events aligned to events.contract.md
    │   ├── revenuecat.ts
    │   └── admob.ts
    └── constants/
        ├── colors.ts
        └── config.ts
```
