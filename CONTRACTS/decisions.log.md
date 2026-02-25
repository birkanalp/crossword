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
