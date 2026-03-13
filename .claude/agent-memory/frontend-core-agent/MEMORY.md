# Frontend Core Agent Memory

## Admin Panel

- Location: `/Users/birkanalp/Desktop/Bulmaca/admin/`
- Framework: Next.js 14 App Router, TypeScript 5, React 18
- Port: 3001 (`npm run dev`)
- Auth: Supabase + `app_metadata.role === 'admin'` gate via `contexts/AuthContext.tsx`

### Tailwind Setup (added)
- `tailwind.config.ts` at admin root — custom color tokens mapped (bg-base, bg-surface, etc.)
- `postcss.config.js` at admin root
- `clsx` + `tailwind-merge` in **dependencies** (not devDependencies) — needed at runtime by `cn.ts`
- `tailwindcss`, `postcss`, `autoprefixer` in devDependencies

### UI Component Library (admin/components/ui/)
- `cn.ts` — twMerge + clsx utility
- `Button.tsx` — variants: primary/secondary/danger/ghost; sizes: sm/md/lg
- `Badge.tsx` — status: 'pending' | 'approved' | 'rejected' only (Turkish labels)
- `Card.tsx`, `CardHeader.tsx`, `CardBody.tsx` — accept className for overrides
- `Input.tsx` — label, error, className props
- `Spinner.tsx` — animate-spin, border-t-accent
- `MetricCard.tsx` — wraps Card+CardBody
- `EmptyState.tsx` — centered empty state with icon slot

### Known Type Fix in lib/api.ts
- `adminGetPuzzle` had `return out` on error path which broke return type
- Fix: change to `return { data: null, error: out.error }` (line ~111)

### Route Structure
- `/` → login page (app/page.tsx)
- `/dashboard` → metrics (app/dashboard/page.tsx, layout wraps AdminLayout)
- `/puzzles` → list with tabs (pending/approved/rejected) + generate button
- `/puzzles/[id]` → review page with grid, clue editor, approve/reject

### Design Tokens (Tailwind custom colors)
- bg-base: #0f0f14, bg-surface: #1a1a22, bg-elevated: #22222c, bg-active: #2a3a4a
- border: #2a2a35, border-focus: #6b9fff
- text-primary: #e8e8ed, text-secondary: #a0a0b0, text-tertiary: #6a6a7a
- accent: #6b9fff, accent-dark: #1e3a5f, accent-border: #2a4a7f
- success/error/warning with -bg and -border variants

## Frontend API Layer Pattern

- NO Supabase JS client in frontend — uses a plain `fetch` wrapper
- Client: `frontend/src/api/client.ts` exports `apiRequest(path, options)`
- `apiRequest` prepends `/functions/v1` to all paths — targets Supabase Edge Functions ONLY
- For PostgREST calls (e.g. `/rest/v1/profiles`) use raw `fetch` with SUPABASE_URL from Constants
- `apiRequest` returns `ApiResponse<T>` = `{ data: T; error: null } | { data: null; error: string }`
- Hooks must unwrap: `if (res.error || !res.data) throw new Error(res.error ?? 'fallback')`
- Files in `src/api/hooks/` import from `'../client'` (relative path)
- `adEvents.ts` uses `apiRequest('/logAdEvent', { method: 'POST', body: ... })`

## Coin Shop Screen (frontend/app/store.tsx)

- Full implementation as of 2026-03-02 (contract v1.2.5)
- Hook: `frontend/src/api/hooks/useCoinPackages.ts` — GET /getCoinPackages, no auth, staleTime 5min
- `expo-linear-gradient ~14.0.0` added to `frontend/package.json`
  - Must install: `npx expo install expo-linear-gradient` inside `/frontend`
- Components: `PackageCard` (React.memo), `FeaturedCard` (gradient), `RegularCard`
- Featured packages get LinearGradient card + purple shadow
- Discounted packages get green ribbon + green border
- Purchase modal: bottom-sheet via Modal + Pressable overlay; RevenueCat is a stub in `confirmPurchase`
- Coin balance: uses `useUserStore(selectCoins)` selector — NEVER use `getState().coins` in components

## userStore Selectors

- `selectUser`, `selectProfile`, `selectStreak`, `selectCoins`, `selectIsPremium`, `selectIsHydrated`
- Always use selector pattern: `useUserStore(selectCoins)` — reactive to state changes
- `spendCoins(amount)` returns boolean (false if insufficient)
- `updateProfile(patch)` accepts `Partial<UserProfile>` — UserProfile now has optional `username` and `avatarColor`

## AdMob Integration (react-native-google-mobile-ads)

- Package installed via `npx expo install react-native-google-mobile-ads`
- Plugin in `frontend/app.json` plugins array with `androidAppId` + `iosAppId` (test app IDs for dev)
- Extra fields for prod Ad Unit IDs: `admobRewardedIos`, `admobRewardedAndroid` (already in app.json)
- Implementation: `frontend/src/lib/admob.ts`
  - `showRewardedAd()` returns `Promise<{ rewarded: boolean }>`
  - `__DEV__` always uses `TestIds.REWARDED`; prod falls back to test ID if config is empty
  - Listens to EARNED_REWARD + CLOSED + ERROR events; resolves once CLOSED fires

## Rewarded Ad / Hint Action Flow

- `HintActionModal`: `frontend/src/components/game/HintActionModal.tsx`
- `adEvents.ts`: `frontend/src/api/adEvents.ts` (fire-and-forget, uses `apiRequest`)
- Level screen: `frontend/app/game/level/[id].tsx`
- Flow: button tap -> `HintActionModal` -> user picks "Reklam İzle" or "X Coin Harca"
  - Watch Ad: close modal, `showRewardedAd()`, if rewarded: `logAdEvent` + `executePendingHintAction(action)`
  - Spend Coins: `useUserStore.getState().spendCoins(cost)`, if spent: `executePendingHintAction(action)`
- Hint column buttons no longer gated by coin balance (modal shows "Yetersiz Bakiye" gracefully)
- State: `pendingAction: 'show_hint' | 'reveal_letter' | null`, `hintActionVisible: boolean`

## Admin Shop Page

- Route: `/shop` → `admin/app/shop/page.tsx` + `admin/app/shop/layout.tsx`
- API functions: `adminListCoinPackages`, `adminCreateCoinPackage`, `adminUpdateCoinPackage`, `adminDeleteCoinPackage`, `adminToggleCoinPackage` in `admin/lib/api.ts` (lines ~271-322)
- Types: `CoinPackage`, `CoinPackageInput` (exported from `admin/lib/api.ts`)
- Endpoints: `GET/POST /admin/coin-packages`, `PUT/DELETE /admin/coin-packages/{id}`, `PATCH /admin/coin-packages/{id}/toggle`
- Backend edge function NOT yet implemented — needs contract + migration + Deno function

### Route Structure (updated)
- `/shop` → coin package management (admin/app/shop/page.tsx)

## Leaderboard System (contract v1.3.0)

- Hook: `frontend/src/api/hooks/useLeaderboard.ts`
  - `useLeaderboard(params)` — GET /getLeaderboard, types: daily|all_time|puzzle
  - Query key: `['leaderboard', type, sort_by, level_id, date, limit, page]`
  - staleTime: 60_000 (1 min). puzzle type requires level_id or query stays disabled.
- Full screen: `frontend/app/leaderboard.tsx`
  - Route: `/leaderboard` — also accepts `?type=puzzle&level_id=<uuid>` params
  - 3 tabs: Günlük (daily/score), Tüm Zamanlar (all_time/score), En Hızlı (all_time/time)
  - Gradient header (#1a0533 to #2d1b69), pill tab bar, FlatList with getItemLayout (ITEM_HEIGHT=66)
  - Skeleton rows during first load. My entry pinned at bottom when outside visible window.
  - Pull-to-refresh resets page cursor for active tab
- Compact component: `frontend/src/components/game/PuzzleLeaderboard.tsx`
  - Used inside level completion modal. Props: levelId, authToken?, guestId?
  - Sort toggle (Puan|Süre), top-10 FlatList (scrollEnabled=false, maxHeight=300)
  - "Tam Lider Tablosu" button navigates to /leaderboard?type=puzzle&level_id=
- Profile setup: `frontend/src/components/ProfileSetupModal.tsx`
  - Shown on first completion when profile.username is undefined
  - POST to /rest/v1/profiles via raw fetch (NOT apiRequest — different base URL)
  - 8 preset avatar colours, TextInput validation (2-20 chars, [a-zA-Z0-9_])
  - onComplete(username, avatarColor) calls userStore.updateProfile()
- Level screen integration (`frontend/app/game/level/[id].tsx`):
  - LevelTopBar gets `onLeaderboard` prop — trophy button (trophy emoji) in header
  - Completion modal (slide-up Modal) appears 700ms after isCompleted, shows scoreBreakdown + PuzzleLeaderboard
  - ProfileSetupModal shown alongside completion if profile.username is falsy
- Colour palette used across leaderboard UI:
  - bg: #0f0617, card: #1e1035, accent: #7c3aed, gold: #fbbf24, silver: #9ca3af, bronze: #d97706
  - text: #f3f0ff, subtext: #9b8abf

## Domain Types

- `UserProfile` (`frontend/src/domain/user/types.ts`) now has optional `username?: string` and `avatarColor?: string`
  - These are populated by ProfileSetupModal -> updateProfile()
  - Used to check "has user set up a display name" before showing setup modal again

## Utility Helpers

- `frontend/src/utils/format.ts`:
  - `formatTime(seconds)` — "M:SS" display string
  - `getInitials(name)` — first 2 chars uppercased, fallback "??"
  - `formatScore(score)` — "1.2k" above 999, else raw string

## See Also
- `patterns.md` for component patterns
