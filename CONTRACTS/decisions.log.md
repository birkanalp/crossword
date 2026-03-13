## 2026-02-24 Contract Guardian Audit

- Scope: Phase-0 generation contract synchronization check (`db.schema.sql`, `004_phase0_generation_setup.sql`, `level.schema.json`, `getLevel`/`submitScore`/shared types).
- Critical: API contract drift detected. Runtime/backend difficulty now includes `expert` (`backend/supabase/functions/_shared/types.ts`, `submitScore/index.ts`, `anticheat.ts`) while `CONTRACTS/api.contract.json` `components.Level.properties.difficulty.enum` remains `easy|medium|hard` and still at `contractVersion: 1.0.0`.
- Warning: `CONTRACTS/db.schema.sql` omits several migration columns in new Phase-0 tables (`words.updated_at`, `word_usage.created_at/updated_at`, `level_words.id/created_at`, `difficulty_profiles.created_at/updated_at`), causing DB contract drift.
- Warning: Placeholder generator JSON shape is schema-valid but weakly mapped (grid cells lack `number`, while clues include numbers), risking clue-to-grid mapping ambiguity for clients.
- Review workflow semantics validated: generator writes `review_status='pending'` only, no approval path in generator function, reads are approved-only (`getLevel` + RLS policy), and admin review policies use JWT `app_metadata.role = 'admin'`.

## 2026-02-24 ADR: Contract Sync After Phase-0 Migration

- Context: Contract Guardian reported drift between contract files and already-migrated backend schema/runtime behavior.
- Source of truth decision: `backend/supabase/migrations/004_phase0_generation_setup.sql` and runtime types/validation are authoritative for already deployed/migrated fields and enum values.
- Decision:
  - Updated `CONTRACTS/api.contract.json` difficulty enum to include `expert`.
  - Updated `CONTRACTS/db.schema.sql` to include missing migrated columns for `words`, `word_usage`, `level_words`, and `difficulty_profiles`.
  - Updated `CONTRACTS/level.schema.json` notes to clarify that placeholder generation does not guarantee strict clue-number-to-`GridCell.number` mapping; `clue.start` is authoritative.
- Consequence: Contract files now align with current DB/runtime semantics while preserving existing Phase-0 API shapes.

## 2026-02-24 Contract Guardian Audit (Re-run)

- Scope: Re-validation after latest Phase-0 fixes (`api.contract.json`, `db.schema.sql`, `level.schema.json`, `status.backend.md`, migration `004`, backend function runtime surfaces).
- Result: Core Phase-0 schema sync is mostly aligned (`expert` difficulty now consistent across contract/runtime/migration; generation tables in `db.schema.sql` now cover migration `004` columns).
- Remaining drift:
  - `CONTRACTS/status.backend.md` still contains stale contract version references in the File Map (`api.contract.json`, `level.schema.json`, `events.contract.md`, `db.schema.sql` shown as `v1.0.0`).
  - Runtime has undocumented public functions (`getDailyChallenge`, `checkWord`) not declared under `CONTRACTS/api.contract.json#/endpoints`.
  - Placeholder generator (`run_generation_job_once`) emits a full-letter grid with only two clues, which conflicts with `level.schema.json` note `cellCoverage` expectation (semantic note drift, not JSON-schema structural break).

## 2026-02-24 ADR: Minimal Contract-Only Sync Fixes

- Context: Contract Guardian re-run reported residual contract drift after Phase-0 sync.
- Decision:
  - Added `getDailyChallenge` and `checkWord` endpoint definitions to `CONTRACTS/api.contract.json` based on current Edge Function behavior.
  - Bumped `api.contract.json` to `1.1.1` with changelog entry.
  - Updated stale contract version references in `CONTRACTS/status.backend.md` to current values.
  - Updated `CONTRACTS/level.schema.json` note `cellCoverage` to explicitly treat strict clue coverage as an approved-level invariant, while allowing Phase-0 placeholder drafts before review.
  - Bumped `level.schema.json` to `1.0.2` with changelog entry.
- Consequence: Contract artifacts now match currently implemented endpoints and documented Phase-0 placeholder semantics without changing runtime/backend code paths.

## 2026-02-24 Contract Guardian Audit (Re-run 17:15 +03)

- Scope: Post-fix re-validation of `CONTRACTS/` + Edge Functions + frontend API/analytics usage.
- Critical: None detected in contract versioning or schema-level compatibility checks.
- Warnings:
  - Frontend still calls undocumented endpoint `GET /getProfile` from `frontend/src/api/hooks/useProfile.ts` while no `getProfile` endpoint exists in `CONTRACTS/api.contract.json#/endpoints` and no corresponding function exists under `backend/supabase/functions/`.
  - Analytics payload drift remains: `hint_type` includes/uses non-contracted values (`show_hint`, `clear_wrong`) in `frontend/src/lib/analytics.ts` and `frontend/app/game/level/[id].tsx`, while `CONTRACTS/events.contract.md` allows only `reveal_letter|reveal_word|check_letter`.
  - Multiple client-fired events declared in `CONTRACTS/events.contract.md` are not currently dispatched in frontend code paths (`app_opened`, `puzzle_abandoned`, `signup_completed`, `login_completed`, `guest_progress_merged`, `purchase_initiated`, `purchase_completed`, `purchase_failed`).
- Result: Contract sync improved and API endpoint coverage now aligned for `getDailyChallenge`/`checkWord`, but repository-wide contract synchronization is still not fully PASS due to remaining frontend/events mismatches.

## 2026-02-24 Contract Guardian Audit (Scoped: Phase-0 Generation Setup)

- Scope constrained to: `PUZZLE_GENERATION_SPEC.md` Phase-0 requirements, `CONTRACTS/db.schema.sql` vs `backend/supabase/migrations/004_phase0_generation_setup.sql`, Phase-0-linked `CONTRACTS/api.contract.json` updates, `CONTRACTS/level.schema.json` placeholder compatibility, and review/RLS semantics.
- Strict result: **FAIL** (scoped).
- In-scope mismatches:
  - `CONTRACTS/db.schema.sql` defines several enum-backed migration columns as `TEXT` rather than enum-backed types surfaced by `004_phase0_generation_setup.sql` (`levels.target_difficulty`, `levels.review_status`, `words.difficulty`, `level_words.direction`, `difficulty_profiles.name`, `generation_jobs.target_difficulty`). Contract includes enum comments, but column type declarations are still not type-aligned with migration truth.
  - Review workflow semantics are partially broader than spec intent: migration policy `"levels: admin update review fields"` allows admin updates to any `levels` columns via unrestricted `USING/WITH CHECK` role guard, not only review fields.
- In-scope checks that pass:
  - Generator persistence path inserts `review_status='pending'` and does not transition it.
  - Mobile-read path remains approved-only (`getLevel` explicit filter and matching RLS read policy semantics).
  - `api.contract.json` difficulty enum includes `expert` and is semver-bumped (`1.1.1`), matching Phase-0 enum extension.
  - `level.schema.json` notes are compatible with placeholder generator output semantics (anchor-first mapping and draft coverage relaxation before approval).

## 2026-02-24 ADR: Scoped Phase-0 Mismatch Hardening

- Context: Scoped Contract-Guardian re-run flagged two remaining in-scope mismatches for Phase-0 (`db.schema.sql` enum type drift and over-broad admin update scope in review policy).
- Decision:
  - Aligned contract column types in `CONTRACTS/db.schema.sql` with migration `004_phase0_generation_setup.sql` enum-backed truth for:
    - `levels.target_difficulty -> difficulty_level`
    - `levels.review_status -> level_review_status`
    - `words.difficulty -> difficulty_level`
    - `level_words.direction -> word_direction`
    - `difficulty_profiles.name -> difficulty_level`
    - `generation_jobs.target_difficulty -> difficulty_level`
  - Hardened admin review update scope in migration `004_phase0_generation_setup.sql` by adding `fn_levels_admin_review_update_only(levels)` and wiring it into policy `"levels: admin update review fields"` `WITH CHECK`, so non-review columns must remain unchanged for admin updates.
- Consequence:
  - Contract enum surfaces now type-align with migration schema.
  - Admin review workflow remains role-gated while now also field-scoped to review columns; existing rejected-notes constraint enforcement remains intact.
  - `service_role` behavior remains functional (bypasses RLS as before).

## 2026-02-24 Contract Guardian Audit (Scoped Re-run: Enum/Type + Admin Scope)

- Scope constrained to Phase-0 generation surfaces only (`CONTRACTS/db.schema.sql`, `backend/supabase/migrations/004_phase0_generation_setup.sql`, `CONTRACTS/api.contract.json`, `CONTRACTS/level.schema.json`, `backend/supabase/functions/getLevel/index.ts`, `backend/supabase/functions/_shared/types.ts`, `backend/supabase/functions/submitScore/index.ts`).
- Strict result: **PASS** (scoped).
- In-scope outcome:
  - Enum/type alignment is synchronized for previously drifting Phase-0 columns (`difficulty_level`, `level_review_status`, `word_direction`) between contract and migration.
  - Admin review policy is now field-scoped via `fn_levels_admin_review_update_only(levels)` and no longer permits unrestricted non-review column updates.
  - Runtime type surfaces are aligned with contract (`expert` difficulty present in API contract and backend shared/runtime scoring surfaces).
  - Approved-only player read semantics are consistent (`getLevel` filter + levels read policy).
- Remaining in-scope mismatches: none.

## 2026-02-24 Contract Guardian Audit (Scoped: TR-only Phase-0.5)

- Scope constrained to: migration `005_phase05_tr_frequency_setup.sql`, `words.freq_score`/`words.tags` schema sync, TR-only default behavior docs/contracts, `CONTRACTS/db.schema.sql`, `CONTRACTS/status.backend.md`, and API-boundary drift introduced by this phase.
- Strict result: **FAIL** (scoped).
- Critical: none.
- Warnings (in-scope mismatches only):
  - `PUZZLE_GENERATION_SPEC.md` still declares a dual-language loop (`TR/EN`) while Phase-0.5 contract/status text declares TR-default behavior.
  - `CONTRACTS/status.backend.md` milestone `#4` still says "3 migration files" although the same file now lists `004` and `005` in the file map (total 5), creating status inconsistency for this phase snapshot.
  - Runtime default path is mixed: migration `005` sets `generation_jobs.language DEFAULT 'tr'`, but `run_generation_job_once` auto-job creation in migration `004` still alternates between `'tr'` and `'en'` when `p_language` is null.
- In-scope checks that pass:
  - `words.freq_score` and `words.tags` exist in migration `005` and are reflected in `CONTRACTS/db.schema.sql` with matching types/nullability intent (`freq_score NUMERIC(4,3)` nullable; `tags JSONB NOT NULL`).
  - Phase-0.5 introduces no new Edge Function endpoint and no new frontend API path drift attributable to this phase.

## 2026-02-24 Contract Guardian Audit (Scoped Re-run: TR-only Phase-0.5, post-fixes)

- Scope constrained to: TR-only behavior alignment across `PUZZLE_GENERATION_SPEC.md`, `CONTRACTS/`, and migrations `005`/`006`; consistency of `CONTRACTS/status.backend.md` with migration state; and API drift introduced by these fixes.
- Strict result: **FAIL** (scoped).
- Critical: none.
- Warnings (remaining in-scope mismatches):
  - TR-only behavior is defaulted but not strictly enforced in `run_generation_job_once`: migration `006_phase05_tr_only_generation_job_default.sql` sets auto-created jobs to `'tr'`, but queued-job pickup still allows any language when `p_language IS NULL` (`WHERE gj.status = 'queued' AND (p_language IS NULL OR gj.language = p_language)`), so preexisting `'en'` jobs can still be consumed.
  - `CONTRACTS/status.backend.md` is out of sync with current migration set: milestone `#4` says "5 migration files" and the File Map lists only through `005`, while repository now contains `001..006`.
  - `CONTRACTS/status.backend.md` still marks `getDailyChallenge` as pending in Phase 2 backlog although `api.contract.json` now declares it and backend function exists, creating endpoint-status drift in documentation.
- In-scope checks that pass:
  - `PUZZLE_GENERATION_SPEC.md` now explicitly states TR-only Phase-0.5 goal; this part of prior mismatch is resolved.
  - Migration `005` (`freq_score`, `tags`, TR default for `generation_jobs.language`) and migration `006` (TR-default auto-job creation path) are mutually consistent.
  - No new API endpoint drift introduced by these Phase-0.5 fixes (`api.contract.json` endpoint set matches implemented public function directories for declared endpoints).

## 2026-02-24 ADR: Final Scoped Fixes for TR-only Phase-0.5

- Context: Scoped re-run still reported three residual mismatches: non-TR queued pickup on null-language generator path, stale migration map/count in `status.backend.md`, and `getDailyChallenge` backlog drift.
- Decision:
  - Added migration `007_phase05_tr_only_pickup_enforcement.sql` to re-define `run_generation_job_once` so queued pickup is strict TR-only when `p_language IS NULL`, while preserving explicit `p_language` filtering behavior.
  - Updated `CONTRACTS/status.backend.md` migration count/file map through `006` and `007`.
  - Updated `CONTRACTS/status.backend.md` Phase-2 row for `getDailyChallenge` from pending to done, matching contracted+implemented backend state.
- Consequence: TR-only Phase-0.5 behavior is now consistently enforced in the null-language execution path and status documentation matches current backend reality.

## 2026-02-24 Contract Guardian Audit (Final Scoped: TR-only Phase-0.5)

- Scope constrained to: TR-only enforcement across `PUZZLE_GENERATION_SPEC.md`, `CONTRACTS/`, and migrations `005`/`006`/`007`; `status.backend.md` internal consistency for migration map/count and `getDailyChallenge`; and in-scope API/contract drift for this phase.
- Strict result: **FAIL** (scoped).
- Critical: none.
- Remaining in-scope mismatch:
  - API enum drift at frontend boundary: `CONTRACTS/api.contract.json#/components/Level/properties/difficulty` now includes `expert`, but frontend contract-facing types still constrain difficulty to `easy|medium|hard` in:
    - `frontend/src/api/adapters/levelAdapter.ts` (`ApiLevel.difficulty`)
    - `frontend/src/domain/crossword/types.ts` (`CrosswordLevel.difficulty`)
- In-scope checks that pass:
  - TR-only behavior is explicitly enforced in migration `007` for null-language queued pickup (`p_language IS NULL AND gj.language = 'tr'`) and preserved for explicit language requests.
  - TR default auto-job creation path remains aligned (`COALESCE(p_language, 'tr')`).
  - `CONTRACTS/status.backend.md` is internally consistent with migration set `001..007` and marks `getDailyChallenge` as done with matching contract path.
  - No additional TR-phase endpoint additions/removals detected; declared scoped endpoints are implemented.

## 2026-02-24 Contract Guardian Audit (Final Scoped Re-run: TR-only Phase-0.5, post-frontend type alignment)

- Scope constrained to previously reported in-scope mismatch set from the last TR-only Phase-0.5 audit, with explicit re-check of frontend contract-facing difficulty unions against `CONTRACTS/api.contract.json#/components/Level/properties/difficulty`.
- Strict result: **PASS** (scoped).
- Resolved mismatch:
  - Frontend boundary enum drift is resolved: `frontend/src/api/adapters/levelAdapter.ts` and `frontend/src/domain/crossword/types.ts` now include `expert` and align with `CONTRACTS/api.contract.json` (`easy|medium|hard|expert`).
- Remaining in-scope mismatches: none.

## 2026-02-25 Contract Guardian Audit (Scoped: checkWord history/resume)

- Scope: `checkWord` history persistence + resume behavior sync across `backend/supabase/functions/checkWord/index.ts`, `_shared/types.ts`, migration `009_checkword_progress_history.sql`, and contract docs (`CONTRACTS/api.contract.json`, `CONTRACTS/db.schema.sql`, `CONTRACTS/status.backend.md`).
- Result: **FAIL (scoped)**.
- Critical: none.
- Warnings:
  - `CONTRACTS/db.schema.sql` includes `user_answer_history` table columns but does not yet document migration-added operational contract surfaces from `009_checkword_progress_history.sql`: named indexes (`idx_answer_history_*`, `uidx_answer_history_*`), RPC function (`record_checkword_progress`), and RLS policy (`answer_history: users read own`).
  - Idempotency semantics are only partially documented: `api.contract.json` marks `request_id` as optional retry key, but runtime fallback in `checkWord/index.ts` derives deterministic `request_id` from owner+level+clue+direction+word, which deduplicates repeated identical guesses (not only transport retries).
- Passed checks:
  - `api.contract.json` is valid JSON, semver present (`1.1.2`), and `checkWord` request/response/error envelope aligns with runtime shape (`{ correct: boolean }`, error `{ error: string }`).
  - Migration `009` object names/columns align with runtime RPC call parameters and `CONTRACTS/status.backend.md` milestone/file-map references.

## 2026-02-25 Contract Guardian Audit (Scoped Re-run: checkWord history/resume, post-doc fixes)

- Scope: Alignment check across `backend/supabase/functions/checkWord/index.ts`, `backend/supabase/migrations/009_checkword_progress_history.sql`, `CONTRACTS/api.contract.json`, `CONTRACTS/db.schema.sql`, and `CONTRACTS/status.backend.md`.
- Result: **PASS (scoped)**.
- Critical: none.
- Warnings: none in scoped surface.
- Validation notes:
  - `api.contract.json` remains valid JSON with semver `contractVersion: 1.1.2` and `checkWord` request/response/error definitions aligned to runtime.
  - `009_checkword_progress_history.sql` RPC/table/index/RLS objects are reflected in `db.schema.sql` contract notes + table surface (`user_answer_history`).
  - `status.backend.md` milestone `#14` and file map versions are consistent with the scoped checkWord/doc state (`api.contract.json` v1.1.2, `db.schema.sql` v1.1.5).

## 2026-02-25 Contract Guardian Audit (Final: frontend resume integration)

- Scope: Final sync check for frontend resume integration across `checkWord`/`getLevel` runtime behavior, frontend API call chain (`useLevels`, `levelAdapter`, `gameStore`, `app/game/level/[id].tsx`), and contract docs (`api.contract.json`, `db.schema.sql`, `status.backend.md`, `status.frontend.md`).
- Result: **FAIL**.
- Critical:
  - Resume correctness derivation drift: backend persists client-provided `state_json` even on incorrect validations (`checkWord/buildMergedState` returns client snapshot when `correct=false`), but frontend resume logic still assumes persisted cells are correct-only and marks fully-filled clues as solved via `deriveCorrectClueIds`. This can falsely lock clues as completed after restore.
- Warnings:
  - Authenticated identity path is not wired in level screen: `authToken` is hardcoded `undefined`, so `getLevel`/`checkWord` are called without bearer token for logged-in users, preventing server-side user progress/history attachment expected by contract notes.
  - `status.frontend.md` contains stale statements relative to current contract/runtime (`difficulty limited to easy/medium/hard`; `CR-003 getDailyChallenge not yet live`), reducing status-file trust.
- Passed:
  - `api.contract.json` is valid and semver-bumped (`1.1.2`) with `checkWord` optional resume/idempotency fields.
  - `db.schema.sql` (`1.1.5`) aligns with migration `009` for `user_answer_history` surface and RPC/RLS notes.
  - Declared endpoint implementations exist for `getLevel`, `getDailyChallenge`, `checkWord`, `submitScore`, `mergeGuestProgress`.

## 2026-02-26 Contract Guardian Contract Update: AI Review Feature (v1.2.0)

- Action: Targeted contract update applied to `CONTRACTS/api.contract.json` for the AI Review feature. No source code modified.
- Changes applied:
  - Bumped `contractVersion` from `1.1.3` to `1.2.0`; updated `lastUpdated` to `2026-02-26`.
  - Added `1.2.0` changelog entry documenting AI review status, fields, and new endpoint.
  - Added `"ai_review"` to `endpoints.adminListPuzzles.queryParams.status.enum` (now `ai_review | pending | approved | rejected`).
  - Added `"ai_review"` to `components.AdminPuzzleSummary.review_status.enum` (now `ai_review | pending | approved | rejected`).
  - Added `"ai_review"` to `components.AdminLevel.properties.review_status.enum` (now `ai_review | pending | approved | rejected`).
  - Extended `components.AdminLevel.required` array with `ai_review_notes`, `ai_reviewed_at`, `ai_review_score`.
  - Added three new property definitions to `components.AdminLevel.properties`: `ai_review_notes` (string | null), `ai_reviewed_at` (string | null, date-time), `ai_review_score` (integer | null, 0-100).
  - Added new endpoint `adminAiReviewPuzzle`: `POST /admin/puzzles/:id/ai-review` with admin JWT requirement, 200 response shape (`passed`, `score`, `issues`, `feedback`, `review_status`), and error codes `400 | 401 | 403 | 404 | 500 | 503`.
- This is a minor version bump (1.1.3 -> 1.2.0): new required fields added to `AdminLevel` (breaking for consumers of that component), new enum value added, new endpoint added.

## 2026-02-27 Ad Events System (migration 017 + admin metrics extension)

- Context: Rewarded ad support added. Frontend will log ad lifecycle events (started, completed, skipped, failed) for reveal_letter and show_hint actions.
- Decision:
  - Created migration `017_ad_events.sql` with `ad_events` table supporting both authenticated users (`user_id`) and anonymous guests (`guest_id`). Columns: `event_type` (CHECK constraint), `action_type` (CHECK constraint), `level_id` (FK nullable), `ad_unit_id`, `platform`, `created_at`.
  - RLS: authenticated users can insert their own events and read their own events. Service role bypasses RLS for admin queries.
  - Indexes: `idx_ad_events_created_at`, `idx_ad_events_user_id`, `idx_ad_events_event_type`, plus a partial index `idx_ad_events_completed_today` on `(event_type, created_at DESC) WHERE event_type = 'completed'` for fast admin metrics queries.
  - Extended `handleMetricsOverview` in `backend/supabase/functions/admin/index.ts` to query `ad_events` count where `event_type='completed'` and `created_at >= today midnight UTC`, running in parallel with existing queries.
  - Added `ads_watched_today` (integer, minimum 0) to `adminMetricsOverview` response in `CONTRACTS/api.contract.json`. Now a required field — this is an additive breaking change for admin panel consumers.
  - Bumped contract version from `1.2.3` to `1.2.4`.
- Consequence:
  - Frontend must insert rows directly to `ad_events` via PostgREST (anon/bearer key) when rewarded ads complete — no new edge function needed.
  - Admin panel must handle the new `ads_watched_today` field in the overview response (non-breaking for display, but the field is now required in the contract).
  - Migration 017 is safe to re-run (all DDL uses IF NOT EXISTS).

## 2026-03-02 Leaderboard System (migration 019 + getLeaderboard + admin routes + scoring update)

- Context: Frontend leaderboard screen is a placeholder (CR-005). profiles table does not exist; leaderboard_entries lacks display names; no getLeaderboard edge function.
- Decision:
  - Created migration `019_leaderboard_profiles.sql`:
    - New `profiles` table: `user_id` (FK auth.users ON DELETE CASCADE, UNIQUE), `username` (2-20 chars, CHECK constraint), `avatar_color` (hex, default '#6366F1'). Case-insensitive uniqueness enforced via `idx_profiles_username_lower ON (LOWER(username))`.
    - RLS: `profiles_select_public` (SELECT for all including anon), `profiles_insert_own` (INSERT only own row), `profiles_update_own` (UPDATE only own row).
    - Added `display_name TEXT` column to `leaderboard_entries` for fast leaderboard display without joining profiles at query time. Null for pre-migration legacy entries — these fall back to 'Anonim' in API responses.
    - Added leaderboard query indexes: `idx_leaderboard_level_score` (level_id, score DESC), `idx_leaderboard_level_time` (level_id, completion_time ASC), `idx_leaderboard_user_score` (user_id, score DESC), `idx_leaderboard_date_score` (created_at DESC, score DESC).
  - Updated `_shared/scoring.ts`: added `mistake_penalty = mistakes * 30` to `computeScore`. Formula is now `max(0, base - time*2 - hints*50 - mistakes*30)`.
  - Updated `_shared/types.ts`: added `mistakes: number` field to `ScoreInput` interface (was already in `SubmitScoreRequest` but missing from `ScoreInput`).
  - Updated `backend/supabase/functions/submitScore/index.ts`: fetches `profiles.username` before upsert and stores as `display_name` on `leaderboard_entries`. Also passes `mistakes` to `computeScore` now that the field is on `ScoreInput`.
  - Created `backend/supabase/functions/getLeaderboard/index.ts`: public GET, optional auth. Supports `type=daily|all_time|puzzle`, `sort_by=score|time`, pagination via `page`/`limit`. For `all_time`, aggregates best entry per user in memory (acceptable for current scale; consider a DB view/RPC for large datasets). For `daily`, looks up `daily_challenges` by date and filters by that `level_id` and date window. For `puzzle`, filters directly by `level_id`. Returns `my_entry` when Bearer JWT is valid.
  - Extended `backend/supabase/functions/admin/index.ts`: added `leaderboard` and `leaderboard/stats` routes to `parseRoute`. `handleAdminLeaderboard` delegates to the same leaderboard logic (shared helper function). `handleAdminLeaderboardStats` runs `COUNT(*)`, `COUNT(DISTINCT user_id)`, `AVG(score)`, `AVG(completion_time)`, and top scorer via `ORDER BY score DESC LIMIT 1` in parallel.
  - Contract bumped from `1.2.5` to `1.3.0`. New components: `LeaderboardEntry`, `LeaderboardStatsResponse`. New endpoints: `getLeaderboard`, `adminLeaderboard`, `adminLeaderboardStats`. CR-005 resolved.
- Breaking changes: None for frontend. Scoring formula change (mistake_penalty) will lower scores for submissions with mistakes — this is intentional and anti-cheat aligned.
- Non-breaking: `display_name` is a new nullable column; old entries show 'Anonim'. `mistakes` in `ScoreInput` is additive.
- Frontend changes needed:
  - Implement `GET /functions/v1/getLeaderboard` with `type`, `sort_by`, `level_id`, `page`, `limit` params.
  - Implement profile creation flow (`POST` to profiles table via PostgREST with anon/bearer key, or a new `createProfile` edge function if input validation is needed).
  - Display `display_name` and `avatar_color` on leaderboard UI rows.
  - Admin panel: add leaderboard view at `/admin/leaderboard` and stats widget.

## 2026-03-02 Coin Shop Backend (migration 018 + getCoinPackages + admin CRUD)

- Context: Coin shop feature needs a backend to serve purchasable coin packages to the frontend shop screen and allow admin management.
- Decision:
  - Created migration `018_coin_packages.sql` with `coin_packages` table. Columns: `name`, `description`, `coin_amount`, `price_usd`, `original_price_usd`, `discount_percent`, `badge` (CHECK: popular|best_value|new|limited), `is_featured`, `is_active`, `sort_order`, `revenuecat_product_id`, `created_at`, `updated_at`.
  - RLS: `coin_packages_select_active_public` allows anon+authenticated to read `is_active=true` rows. `coin_packages_service_role_all` grants service_role unrestricted access. Table write path goes exclusively through admin edge function (service client bypasses RLS).
  - `updated_at` trigger uses existing `fn_set_updated_at()` function from migration 001 (moddatetime is not installed).
  - Seed: 5 example packages inserted only when table is empty (idempotent guard).
  - Created `backend/supabase/functions/getCoinPackages/index.ts` — public GET, no auth, returns active packages excluding `is_active`/admin fields.
  - Extended `backend/supabase/functions/admin/index.ts` with 5 new handlers: `handleListCoinPackages`, `handleCreateCoinPackage`, `handleUpdateCoinPackage`, `handleDeleteCoinPackage`, `handleToggleCoinPackage`. Route dispatch uses `parseRoute` pattern consistent with existing admin routes.
  - Updated `_shared/cors.ts` to add `PUT` and `DELETE` to `Access-Control-Allow-Methods` — previously only GET/POST/PATCH/OPTIONS were allowed, which would have caused preflight failures for the new admin routes.
  - Contract bumped from `1.2.4` to `1.2.5`. Added endpoints: `getCoinPackages`, `adminListCoinPackages`, `adminCreateCoinPackage`, `adminUpdateCoinPackage`, `adminDeleteCoinPackage`, `adminToggleCoinPackage`. Added components: `CoinPackage` (public), `CoinPackageAdmin` (full).
- Non-breaking change: all additions, no existing endpoint or field removed or renamed.
- Frontend changes needed:
  - Shop screen: call `GET /functions/v1/getCoinPackages` with anon apikey. No auth header required.
  - Admin panel: use new `/admin/coin-packages` CRUD routes with admin JWT.
  - Use `revenuecat_product_id` to initiate RevenueCat purchase flow per package.

## 2026-03-02 Contract Guardian Audit — Coin Shop Feature (v1.2.5)

- Scope: Full cross-file sync check for the coin shop feature across `CONTRACTS/api.contract.json`, `backend/supabase/functions/getCoinPackages/index.ts`, `backend/supabase/functions/admin/index.ts`, `admin/lib/api.ts`, `frontend/src/api/hooks/useCoinPackages.ts`, and `frontend/app/store.tsx`. Migration `018_coin_packages.sql` included for schema alignment.
- Result: PASS with 1 critical and 1 warning.
- Critical:
  - `DELETE /admin/coin-packages/:id` — `CONTRACTS/api.contract.json` declares `404` as a possible error code for this endpoint. The implementation in `backend/supabase/functions/admin/index.ts` (`handleDeleteCoinPackage`, line 759–767) does NOT verify record existence before issuing the DELETE. A delete against a non-existent UUID returns PostgreSQL success (0 rows affected, no error), so the function always responds `204 No Content`. The 404 branch declared in the contract is unreachable. Consumers expecting 404 for missing IDs will receive 204 instead. (Non-breaking for current admin panel which ignores 404 vs 204 distinction, but constitutes a contract fidelity violation.)
- Warning:
  - `admin/lib/api.ts` exports `interface CoinPackage` (lines 271–286) that contains `is_active`, `created_at`, and `updated_at` — this is the full admin field set. The contract names this shape `CoinPackageAdmin` (under `components.CoinPackageAdmin`). The contract public shape `components.CoinPackage` excludes those three fields. The admin panel type is semantically `CoinPackageAdmin` but named `CoinPackage`, creating a naming conflict that could mislead future developers reusing the type. Fields themselves are correct; no runtime impact.
- Passed checks (10):
  1. `api.contract.json` is valid JSON; `contractVersion` is `1.2.5` (semver valid); all 6 coin shop endpoints declared.
  2. `getCoinPackages/index.ts` — method GET, no auth, response `{ packages: [] }`, `is_active=true` filter: all match contract.
  3. `getCoinPackages/index.ts` SELECT projection (11 fields) exactly matches `components.CoinPackage` field set; admin-only fields (`is_active`, `created_at`, `updated_at`) correctly excluded.
  4. `frontend/src/api/hooks/useCoinPackages.ts` `CoinPackage` interface (11 fields) exactly matches `components.CoinPackage` contract component; `badge` union `'popular'|'best_value'|'new'|'limited'|null` matches contract enum.
  5. `frontend/app/store.tsx` calls `/getCoinPackages` via the `useCoinPackages` hook; endpoint path is correct.
  6. `backend/supabase/functions/admin/index.ts` implements all 5 admin routes with correct HTTP methods: GET+POST on `/admin/coin-packages`, PUT+DELETE on `/admin/coin-packages/:id`, PATCH on `/admin/coin-packages/:id/toggle`.
  7. `admin/lib/api.ts` implements all 5 admin functions (`adminListCoinPackages`, `adminCreateCoinPackage`, `adminUpdateCoinPackage`, `adminDeleteCoinPackage`, `adminToggleCoinPackage`) targeting correct paths and HTTP methods.
  8. Migration `018_coin_packages.sql` column set matches all `CoinPackageAdmin` fields; types (`TEXT`, `INTEGER`, `NUMERIC(10,2)`, `BOOLEAN`, `TIMESTAMPTZ`), nullability, and `CHECK` constraints are consistent with contract field constraints.
  9. `badge` CHECK constraint (`popular|best_value|new|limited`) is consistent across migration DDL, backend validation in `handleCreateCoinPackage`/`handleUpdateCoinPackage`, contract enum, and all TypeScript union types.
  10. `handleToggleCoinPackage` correctly checks for existence via `.single()` before returning, returning 404 for missing IDs — consistent with contract.

## 2026-03-03 Contract Guardian Audit — Leaderboard Feature (v1.3.0)

- Scope: Full post-implementation sync check for the leaderboard system across `CONTRACTS/api.contract.json` (v1.3.0), `CONTRACTS/db.schema.sql` (v1.2.0), `backend/supabase/functions/getLeaderboard/index.ts`, `backend/supabase/functions/admin/index.ts`, `backend/supabase/migrations/019_leaderboard_profiles.sql`, `frontend/src/api/hooks/useLeaderboard.ts`, and `admin/app/leaderboard/page.tsx`.
- Result: PASS with 1 warning.
- Warning:
  - `getLeaderboard/index.ts` always returns `avatar_color: "#6366F1"` (hardcoded constant `DEFAULT_AVATAR_COLOR`, line 23/93) regardless of the user's actual profile color stored in `profiles.avatar_color`. The contract defines `LeaderboardEntry.avatar_color` as the user's profile color. No JOIN or lookup against the `profiles` table occurs in `fetchLeaderboardEntries`. Effect: all avatar circles render with the default indigo color regardless of user customization. Not a breaking change (field is present and is a valid string), but constitutes a contract fidelity gap. The same hardcoding is present in `handleAdminLeaderboard` (line 844 of `admin/index.ts`).
- Passed checks (10):
  1. `api.contract.json` contractVersion is `1.3.0` (semver valid); `getLeaderboard`, `adminLeaderboard`, and `adminLeaderboardStats` endpoints are present with correct methods and paths.
  2. `db.schema.sql` v1.2.0: `profiles` table declared with all 6 columns (`id`, `user_id`, `username`, `avatar_color`, `created_at`, `updated_at`); `leaderboard_entries.display_name` declared as nullable TEXT. Both match `019_leaderboard_profiles.sql` DDL exactly.
  3. `getLeaderboard/index.ts` response shape `{entries, total, page, my_entry}` matches contract `getLeaderboard.response.200` exactly; `LeaderboardEntry` interface (9 fields) is field-for-field identical to `components.LeaderboardEntry`.
  4. `admin/index.ts` routes: `leaderboard` (GET `/admin/leaderboard`) and `leaderboardStats` (GET `/admin/leaderboard/stats`) are registered at lines 128–129; routing logic at lines 75–77 is correct.
  5. `handleAdminLeaderboard` response shape `{entries, total, page, my_entry: null}` matches `adminLeaderboard.response.200`; delegates to `fetchLeaderboardEntries` (shared with public endpoint) — consistent.
  6. `handleAdminLeaderboardStats` response fields (`total_entries`, `unique_players`, `avg_score`, `avg_completion_time`, `top_scorer`) exactly match `components.LeaderboardStatsResponse` required fields.
  7. `019_leaderboard_profiles.sql`: `profiles` table, `idx_profiles_username_lower` unique index, RLS policies (`profiles_select_public`, `profiles_insert_own`, `profiles_update_own`), `display_name` column on `leaderboard_entries`, and 4 leaderboard performance indexes — all present and consistent with `db.schema.sql` contract notes.
  8. `frontend/src/api/hooks/useLeaderboard.ts`: `LeaderboardEntry` interface (9 fields) and `LeaderboardResponse` interface (`entries`, `total`, `page`, `my_entry`) are field-for-field identical to contract. Endpoint path `/getLeaderboard` matches contract. Comment at line 5 explicitly references contract v1.3.0.
  9. `admin/app/leaderboard/page.tsx`: file exists; calls `/admin/leaderboard` and `/admin/leaderboard/stats`; `LeaderboardEntry` (9 fields) and `LeaderboardStats` (5 fields) local interfaces match contract shapes exactly.
  10. No breaking changes without version bump detected. `contractVersion` was correctly bumped to `1.3.0` to accompany the new endpoints and schema surfaces.

## 2026-02-26 AI Review: Claude → Ollama Migration

- Context: Replace Anthropic Claude API with local Ollama for puzzle quality review.
- Decision:
  - Added `ollama` service to `docker-compose.yml` with init script (`docker/ollama/entrypoint.sh`) that pulls `qwen2.5:3b` on first start.
  - Updated `backend/supabase/functions/admin/index.ts` to call Ollama `/api/generate` with JSON schema format instead of Claude API.
  - Replaced `ANTHROPIC_API_KEY` with `OLLAMA_BASE_URL` and `OLLAMA_MODEL` env vars.
  - Contract `adminAiReviewPuzzle` description updated (Claude → Ollama); API shape unchanged.
  - Added `docs/OLLAMA_SETUP.md` for setup and troubleshooting.
- Consequence: No external API key required; AI review runs fully local via Docker.
