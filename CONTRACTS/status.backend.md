# Backend Status
**contractVersion:** 1.3.1
**lastUpdated:** 2026-03-13
**owner:** backend-agent

---

## Milestone Tracker

| # | Milestone | Status | Contract Impact | Notes |
|---|-----------|--------|----------------|-------|
| 1 | SQL schema (tables, indexes, constraints) | ✅ Done | `db.schema.sql` v1.1.1 | 8 tables, full RLS |
| 2 | Answer hashing strategy | ✅ Done | `api.contract.json` v1.1.1 | SHA-256 + level_id:version salt |
| 3 | Level JSON structure | ✅ Done | `level.schema.json` v1.0.3 | JSON Schema with `additionalProperties: false` |
| 4 | Migration SQL scripts | ✅ Done | — | 8 migration files (`001`-`008`) |
| 5 | Edge Function structure | ✅ Done | `api.contract.json` v1.1.1 | Shared _shared/ utilities |
| 6 | `getLevel` Edge Function | ✅ Done | `api.contract.json#/endpoints/getLevel` | Premium gate, progress attachment |
| 7 | `submitScore` Edge Function | ✅ Done | `api.contract.json#/endpoints/submitScore` | Anti-cheat + server scoring + streak + coins |
| 8 | `mergeGuestProgress` Edge Function | ✅ Done | `api.contract.json#/endpoints/mergeGuestProgress` | Completion-first conflict resolution |
| 9 | Anti-cheat validation | ✅ Done | — | Hash + time bounds + sanity checks |
| 10 | Leaderboard query strategy | ✅ Done | `db.schema.sql` leaderboard_entries | Index-backed rank, RPC functions |
| 11 | Phase-0 generation foundation (contracts + migration + runner) | ✅ Done | `db.schema.sql` v1.1.1 | Added generation tables, review workflow, seeded profiles, one-shot generator RPC |
| 12 | Phase-0.5 TR-only corpus import (`freq_score`, `tags`, scripts) | ✅ Done | `db.schema.sql` v1.1.3 | Added safe migration 005, TR frequency/import scripts, blacklist, TR-default generation path |
| 13 | Step 4 contract mismatch sync (`levels.clues_json` server-only `answer`) | ✅ Done | `level.schema.json` v1.0.3, `db.schema.sql` v1.1.4 | At-rest clue entries may include `answer`; public API responses continue stripping `answer` |
| 14 | checkWord progress/history persistence for resume | ✅ Done | `api.contract.json` v1.1.2, `db.schema.sql` v1.1.5 | checkWord now writes retry-safe answer history and upserts `user_progress` during validation |
| 15 | Levels playability backfill (`pending` normalize + min-2 approved/difficulty) | ✅ Done | — | Migration `010_levels_playability_backfill.sql` normalizes auto-generated pending levels to approved and backfills to at least 2 approved TR levels per difficulty |
| 16 | Phase 3 admin API contracts (puzzle review + metrics endpoints) | ✅ Done (Contracted) | `api.contract.json` v1.1.3, `db.schema.sql` v1.1.6 | Added admin-only endpoints with `app_metadata.role=admin` requirement; documented metrics query sources (no new tables) |
| 17 | Ad events system (rewarded ads tracking + admin metrics) | ✅ Done | `api.contract.json` v1.2.4, migration `017_ad_events.sql` | New `ad_events` table with RLS; `adminMetricsOverview` extended with `ads_watched_today` |
| 18 | Coin shop backend (coin_packages table + admin CRUD + public read) | ✅ Done | `api.contract.json` v1.2.5, migration `018_coin_packages.sql` | New `coin_packages` table; public `getCoinPackages` edge function; admin CRUD routes on `/admin/coin-packages`; `_shared/cors.ts` updated to allow PUT + DELETE |
| 19 | Leaderboard profiles table + display_name snapshot on leaderboard_entries | ✅ Done | `db.schema.sql` v1.2.0, migration `019_leaderboard_profiles.sql` | New `profiles` table (username, avatar_color, RLS); `display_name` column added to `leaderboard_entries` for fast leaderboard queries without joins |
| 20 | getLeaderboard Edge Function (daily/all_time/puzzle, score/time sort, pagination) | ✅ Done | `api.contract.json` v1.3.0, `backend/supabase/functions/getLeaderboard/index.ts` | Public endpoint with optional auth; supports 3 leaderboard types; my_entry populated when authenticated; CR-005 resolved |
| 21 | Admin leaderboard endpoints (GET /admin/leaderboard, GET /admin/leaderboard/stats) | ✅ Done | `api.contract.json` v1.3.0, `backend/supabase/functions/admin/index.ts` | Admin JWT required; stats returns total_entries, unique_players, avg_score, avg_completion_time, top_scorer |
| 22 | Scoring formula: mistake_penalty added (mistakes * 30) | ✅ Done | `_shared/scoring.ts` updated, `_shared/types.ts` ScoreInput.mistakes field added | formula: max(0, base - time*2 - hints*50 - mistakes*30) |
| 23 | submitScore: display_name snapshot from profiles at submission time | ✅ Done | `backend/supabase/functions/submitScore/index.ts` updated | Fetches profiles.username before upsert; stores as display_name on leaderboard_entries |
| 24 | Admin todo board persisted in DB (`admin_todos`) + CRUD endpoints | ✅ Done | `api.contract.json` v1.3.1, `db.schema.sql` v1.2.1, migration `022_admin_todos.sql` | Admin kanban board moved off browser localStorage to Postgres-backed `/admin/todos` endpoints |

---

## Phase 1 Complete ✅

All Phase 1 deliverables are implemented and contracted.

## Phase 0 Generation Setup ✅

Phase-0 first-run setup is implemented:
- Contract-first update to `CONTRACTS/db.schema.sql` for generation and review surfaces.
- Migration `004_phase0_generation_setup.sql` with new tables, constraints/indexes, review workflow RLS, and seeded `difficulty_profiles`.
- One-shot generator transaction function (`run_generation_job_once`) and local script plumbing (`generate:one`).

---

## Phase 2 Backlog

| # | Milestone | Status | Contract Impact |
|---|-----------|--------|----------------|
| 11 | `verifyPurchase` Edge Function (RevenueCat webhook) | 🔜 Pending | `api.contract.json` — new endpoint needed |
| 12 | `getLeaderboard` Edge Function (paginated) | 🔜 Pending | `api.contract.json` — new endpoint needed |
| 13 | `getDailyChallenge` Edge Function | ✅ Done | `api.contract.json#/endpoints/getDailyChallenge` |
| 14 | `saveProgress` Edge Function (periodic client state sync) | 🔜 Pending | `api.contract.json` — new endpoint needed |
| 15 | Rate limiting middleware | 🔜 Pending | — |
| 16 | PostHog server-side SDK integration | 🔜 Pending | `events.contract.md` server events |
| 17 | Sentry error integration | 🔜 Pending | — |
| 18 | Admin level upload tool + answer_hash computation | 🔜 Pending | — |
| 19 | Push notification triggers (streak reminders) | 🔜 Pending | `events.contract.md` — new events |
| 20 | Apple / Google OAuth config in Supabase | 🔜 Pending | — |

---

## Phase 3 Admin Panel

| # | Milestone | Status | Contract Impact |
|---|-----------|--------|----------------|
| 21 | Admin endpoints contract definition (`/admin/puzzles*`, `/admin/metrics*`) | ✅ Done (Step 1) | `api.contract.json` v1.1.3 |
| 22 | Admin edge functions implementation + role guard enforcement | ✅ Done | `backend/supabase/functions/admin/index.ts` |
| 23 | Admin clue edit flow with answer hash recomputation | ✅ Done | PATCH /admin/puzzles/:id/clues/:clueKey |
| 24 | Admin metrics SQL/RPC optimization and indexes | 🔜 Optional | Current implementation uses existing tables |

---

## Contract Change Protocol

Before implementing any API or DB change:

1. **Update the relevant contract file(s) first** (`api.contract.json`, `level.schema.json`, `events.contract.md`, `db.schema.sql`)
2. **Bump `contractVersion`** according to semver:
   - Patch `x.y.Z` — additive, non-breaking (new optional field, new endpoint)
   - Minor `x.Y.0` — breaking (removing/renaming field, changing type, required fields)
   - Major `X.0.0` — architectural overhaul
3. **Add a changelog entry** to the contract file
4. **Update this status file** with the new milestone row
5. **Then implement** in `backend/supabase/`

Frontend agent must not assume stability of any field not listed in a contract file.

---

## Known Risks

| Risk | Severity | Mitigation | Phase |
|------|---------|-----------|-------|
| `verifyPurchase` webhook not yet implemented | High | RevenueCat webhook must be configured before launch | Phase 2 |
| No rate limiting on Edge Functions | High | Supabase Edge Functions have Deno isolate limits; explicit middleware in Phase 2 | Phase 2 |
| `increment_coins` RPC called even on repeat submits — `is_new_best` guards it | Medium | Guarded in submitScore; verify in integration test | Phase 2 |
| Time bounds are hardcoded constants in anticheat.ts | Medium | Move to DB config table per level type | Phase 2 |
| No `saveProgress` endpoint — client state is only persisted on completion | Medium | Phase 2; in-flight state loss on crash | Phase 2 |
| Guest users cannot submit leaderboard entries | Low | By design; displayed as CTA to create account | — |

---

## File Map

```
backend/supabase/
├── migrations/
│   ├── 001_initial_schema.sql
│   ├── 002_rls_policies.sql
│   ├── 003_rpc_functions.sql
│   ├── 004_phase0_generation_setup.sql
│   ├── 005_phase05_tr_frequency_setup.sql
│   ├── 006_phase05_tr_only_generation_job_default.sql
│   ├── 007_phase05_tr_only_pickup_enforcement.sql
│   ├── 008_freq_score_generator_filter.sql
│   ├── 009_checkword_progress_history.sql
│   ├── 010_levels_playability_backfill.sql
│   ├── 011_*.sql  (prior migrations)
│   ├── 012_ai_review_status.sql
│   ├── 013_fix_storage_admin_password.sql
│   ├── 014_pg_cron_puzzle_generation.sql
│   ├── 015_remove_pg_cron_puzzle_job.sql
│   ├── 016_app_settings_cron.sql
│   ├── 017_ad_events.sql
│   ├── 018_coin_packages.sql
│   ├── 019_leaderboard_profiles.sql
│   └── 022_admin_todos.sql
├── functions/
│   ├── _shared/
│   │   ├── types.ts
│   │   ├── cors.ts
│   │   ├── auth.ts
│   │   ├── scoring.ts
│   │   └── anticheat.ts
│   ├── getLevel/index.ts
│   ├── submitScore/index.ts
│   ├── mergeGuestProgress/index.ts
│   ├── getDailyChallenge/index.ts
│   ├── checkWord/index.ts
│   ├── getCoinPackages/index.ts
│   ├── getLeaderboard/index.ts
│   └── admin/index.ts
├── seed/sample_level.json
├── scripts/
│   └── generate_one.sql
└── config.toml

CONTRACTS/
├── api.contract.json        ← v1.3.1
├── level.schema.json        ← v1.0.3
├── events.contract.md       ← v1.0.0
├── db.schema.sql            ← v1.2.1
└── status.backend.md        ← this file
```
