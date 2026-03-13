---
name: supabase-backend-core
description: Implements full Supabase backend foundation for a crossword mobile game including schema, RLS, edge functions, and contract-first workflow.
disable-model-invocation: true
argument-hint: <optional-focus-area>
---

# Supabase Backend Core

You are implementing the full Supabase backend foundation for a crossword puzzle mobile game.

## Step 1 — Read Contracts

Read the following contract files to understand the current API surface and data shapes:

- `CONTRACTS/api.contract.json`
- `CONTRACTS/level.schema.json`

If either file is missing, create it with sensible defaults and inform the user.

## Step 2 — Define or Update SQL Schema

Create or update migrations for these tables:

| Table | Purpose |
|---|---|
| `levels` | Crossword puzzle definitions (grid, clues, metadata) |
| `user_progress` | Per-user save state for each level |
| `daily_challenges` | One puzzle per day, linked to a level |
| `leaderboard_entries` | Scores per user per level/daily challenge |
| `entitlements` | IAP / subscription entitlements per user |

For each table:
- Add proper primary keys, foreign keys, and NOT NULL constraints.
- Add indexes on columns used in WHERE / JOIN / ORDER BY clauses.
- Use `timestamptz` for all timestamps, default to `now()`.
- Include `created_at` and `updated_at` columns where appropriate.

## Step 3 — Row-Level Security (RLS)

Enable RLS on every table. Apply least-privilege policies:

- **levels**: `SELECT` for all authenticated users. No insert/update/delete from client.
- **user_progress**: Users can only read/write their own rows (`auth.uid() = user_id`).
- **daily_challenges**: `SELECT` for all authenticated users. No insert/update/delete from client.
- **leaderboard_entries**: `SELECT` for all authenticated. `INSERT` only through edge functions (service role).
- **entitlements**: Users can only read their own rows. Writes via service role only.

## Step 4 — Edge Functions

Create or update these Supabase Edge Functions under `backend/supabase/functions/`:

### `getLevel`
- Input: `level_id` (uuid)
- Returns: full level data (grid, clues, metadata)
- Validate input. Return 400 on invalid ID.

### `submitScore`
- Input: `level_id`, `time_seconds`, `completed_cells`, `daily_challenge_id` (optional)
- **Never trust client score.** Validate `time_seconds > 0`, `completed_cells` makes sense for the level.
- Insert into `leaderboard_entries` using service role.
- Return the created entry and rank.

### `mergeGuestProgress`
- Input: `guest_progress[]` — array of `{ level_id, cell_state, elapsed_seconds }`
- Called after a guest signs up / logs in to merge anonymous progress.
- Validate each entry. Skip duplicates or entries where the user already has better progress.
- Use a transaction.

Each edge function must:
- Parse and validate all input (use Zod or manual checks).
- Return structured JSON responses with appropriate HTTP status codes.
- Use `supabaseClient` with service role key for privileged writes.
- Handle errors gracefully and never leak internal details.

## Step 5 — Contract-First Workflow

If any API change is needed (new endpoint, changed payload, etc.):
1. **Update `CONTRACTS/api.contract.json` FIRST** with the new/changed endpoint definition.
2. Then implement the change.
3. Never implement an endpoint that isn't described in the contract.

## Step 6 — Update Status

After execution, update `CONTRACTS/status.backend.md` with:
- Which tables were created/modified.
- Which edge functions were created/modified.
- Which RLS policies are in place.
- Any open TODOs or known gaps.

## Rules

- Use the Supabase MCP (`mcp__supabase__query`) for read-only DB operations (checking state, verifying schema).
- All schema changes must be **migration-safe**: use `CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, etc.
- Never use destructive DDL (`DROP TABLE`, `DROP COLUMN`) without explicit user confirmation.
- Add a short **architecture summary** at the end of your response describing what was built and how the pieces connect.

If `$ARGUMENTS` is provided, focus only on that area (e.g., `/supabase-backend-core schema` to only handle schema).
