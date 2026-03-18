# Bulmaca Backend – Architecture Context

## Tech Stack

- **Database:** PostgreSQL 15 via Supabase (local: port 54322)
- **Auth:** Supabase GoTrue (anonymous + email)
- **API:** Supabase Edge Functions (Deno TypeScript) behind Kong gateway (port 54321)
- **IAP Validation:** RevenueCat webhooks
- **Error Monitoring:** Sentry

---

## Edge Functions

All functions live in `backend/supabase/functions/`. Each has its own `index.ts`.

| Function | Method | Purpose |
|---|---|---|
| `main` | Various | Central router — delegates to sub-handlers |
| `listLevels` | GET | Returns approved levels with progression unlock state |
| `getLevel` | GET | Returns grid + clues for a single level |
| `getDailyChallenge` | GET | Returns today's daily puzzle |
| `submitScore` | POST | Validates completion server-side, inserts leaderboard entry |
| `getLeaderboard` | GET | `?type=daily\|all_time\|puzzle&sort_by=score\|time` |
| `getProfile` | GET | Returns user profile (username, avatar_color) |
| `checkWord` | POST | Server-side word validation (anti-cheat) |
| `revealLetter` | POST | Deducts coin, returns revealed letter |
| `logAdEvent` | POST | Records ad_watched event |
| `getCoinPackages` | GET | Returns active coin packages sorted by sort_order |
| `mergeGuestProgress` | POST | Merges guest progress into authenticated user on login |
| `deleteAccount` | POST | Hard-deletes user account + associated data |
| `cronTriggerAiReview` | POST | Cron-triggered AI review of pending puzzles |
| `admin` | Various | Internal admin endpoints (puzzles, metrics, leaderboard, shop) |

Shared utilities: `backend/supabase/functions/_shared/` (auth, leaderboard, rateLimit, etc.)

---

## Database Schema (key tables)

### `levels`
Core puzzle definitions. Never mutated after creation — increment `version` instead.

```
id uuid PK, version int, difficulty difficulty_level,
is_premium bool, grid_json jsonb, clues_json jsonb,
answer_hash text (SHA-256, server-side only),
difficulty_multiplier numeric(4,2),
review_status: 'ai_review' | 'pending' | 'approved' | 'rejected',
ai_review_score int | null, ai_review_notes text | null,
sort_order int | null (only set on approved levels, sequential),
language text, deleted_at timestamptz (soft delete)
```

### `user_progress`
One row per (user OR guest) × level. Exactly one of `user_id`/`guest_id` must be non-null.

```
id, user_id (nullable FK → auth.users), guest_id (nullable UUID),
level_id FK → levels, state_json jsonb, completed_at timestamptz | null,
time_spent int, mistakes int, hints_used int, updated_at
```

### `leaderboard_entries`
```
id, user_id FK → auth.users, level_id FK → levels,
score int, completion_time int, created_at,
display_name text (denormalized from profiles)
```

### `profiles`
```
id FK → auth.users PK, username text unique, avatar_color text, created_at, updated_at
```

### `entitlements`
```
id, user_id FK, is_pro bool, source purchase_source enum, updated_at
```

### `coin_packages`
```
id, name text, coins int, price_usd numeric, store_product_id text,
is_active bool, sort_order int, created_at, updated_at
```

### `ad_events`
```
id, user_id (nullable), guest_id (nullable), ad_type text, created_at
```

### `daily_challenges`
```
id, date date unique, level_id FK → levels, leaderboard_enabled bool
```

---

## Migrations

25 migrations in `backend/supabase/migrations/` (001–025). Auto-run on first db volume creation via `docker-entrypoint-initdb.d`. Notable:

- `001` — Initial schema (levels, user_progress, entitlements, coins, streaks)
- `009` — checkword progress history
- `012` — AI review status + score on levels
- `017` — ad_events table
- `018` — coin_packages table
- `019` — profiles table + display_name on leaderboard
- `022` — admin_todos table
- `024` — level progression (sort_order, unlock rules)
- `025` — fix sort_order to only number approved levels

---

## Auth & Identity

- Anonymous users get a `guest_id` (UUID) generated client-side and stored locally
- On sign-in, `mergeGuestProgress` migrates guest data to the authenticated user
- Admin role: `app_metadata.role === 'admin'` (set via service role key)
- Shared helper: `_shared/auth.ts` — extracts user from JWT or falls back to guest_id

---

## Scoring Formula

```
base_score         = difficulty_multiplier * 1000
time_penalty       = seconds_spent * 2
hint_penalty       = hints_used * 50
mistake_penalty    = mistakes * 30
final_score        = base_score - time_penalty - hint_penalty - mistake_penalty
```

Score validated server-side in `submitScore` — never trust the client value.

---

## Level Progression

- Only `approved` levels get a `sort_order` value (sequential, starting at 1)
- `listLevels` returns all approved levels with an `is_unlocked` flag
- A level unlocks when the previous level is completed (by `user_id` or `guest_id`)
- Level 1 (`sort_order = 1`) is always unlocked

---

## Anti-Cheat

- `answer_hash` stored in DB; never sent to client
- `submitScore` recomputes hash server-side and compares
- `checkWord` validates individual word submissions server-side
- Client score submissions are ignored — server recalculates from stored progress

---

## Admin Endpoints (`/admin/*`)

Protected by `role === 'admin'` check in every handler.

Key routes: `GET/POST /admin/puzzles`, `GET /admin/puzzles/:id`, `POST /admin/puzzles/:id/decision`, `PATCH /admin/puzzles/:id/sort-order`, `GET /admin/metrics/overview`, `GET /admin/metrics/daily`, `GET /admin/leaderboard`, `GET /admin/leaderboard/stats`, `GET/POST/PATCH/DELETE /admin/shop/coin-packages`

---

## Local Development

```bash
# From repo root
npm run docker:up      # Start full Supabase stack (waits for health)
npm run docker:down    # Stop containers
npm run docker:reset   # Wipe volumes + restart (reruns migrations)
npm run studio         # Supabase Studio → http://localhost:54323
```

Supabase CLI is NOT installed — use docker-compose directly.

---

## Critical Rules

- Never send `answer_hash` to the client
- Always validate at system boundaries — not in Deno guards alone
- Edge Functions share auth helpers from `_shared/` — don't duplicate auth logic
- New migrations must be additive (no destructive schema changes without a rollback plan)
- RLS policies are enforced at the database level — Edge Functions use service role key
