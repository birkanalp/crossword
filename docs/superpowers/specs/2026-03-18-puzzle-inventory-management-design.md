# Puzzle Inventory Management — Design Spec

**Date:** 2026-03-18
**Status:** Approved

---

## Problem

The game needs a continuous supply of approved puzzles for players. Two scenarios require automatic generation:

1. **Initial boot** — DB has zero approved puzzles; the game is unplayable.
2. **Low stock** — A difficulty's unviewed approved puzzle count drops below 10; players will run out of fresh content.

This must run entirely on the backend. No dependency on the admin panel or the mobile app.

---

## Solution Overview

Three coordinated changes:

1. **`has_viewed` column** on `levels` — tracks whether any player has ever opened a puzzle.
2. **`getLevel` edge function update** — sets `has_viewed = true` fire-and-forget when a level is fetched.
3. **`generation-worker` Docker service** — long-running Node.js process that seeds on startup and polls every 30 minutes.

---

## Data Layer

### Migration `028_has_viewed.sql`

```sql
ALTER TABLE levels ADD COLUMN has_viewed BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX idx_levels_unviewed_stock
  ON levels (target_difficulty, has_viewed)
  WHERE review_status = 'approved' AND deleted_at IS NULL;
```

- Default `false` — all existing puzzles start as unviewed.
- Partial index scoped to approved + non-deleted rows for fast stock queries.

### Stock Count Query

```sql
SELECT target_difficulty, COUNT(*) AS unviewed
FROM levels
WHERE review_status = 'approved'
  AND has_viewed = false
  AND deleted_at IS NULL
GROUP BY target_difficulty
```

Used by the worker on every interval tick and on startup.

### Seed Check Query (startup only)

```sql
SELECT target_difficulty, COUNT(*) AS total
FROM levels
WHERE review_status = 'approved'
  AND deleted_at IS NULL
GROUP BY target_difficulty
```

If any difficulty returns 0 (or is absent), 100 puzzles are generated for it.

---

## `has_viewed` Tracking

**Location:** `getLevel` Edge Function, after the level is successfully fetched and the response is built.

```typescript
// Fire-and-forget — does not delay the response
if (!level.has_viewed) {
  db.from("levels")
    .update({ has_viewed: true })
    .eq("id", levelId)
    .then(() => {});
}
```

- The `!level.has_viewed` guard avoids unnecessary writes for already-viewed puzzles.
- `getLevel` already selects from `levels` with service role — no permission changes needed.

---

## Shared Generation Utility

**New file:** `scripts/shared/triggerGeneration.ts`

Extracted from `admin/app/api/generate-puzzle/route.ts`. Accepts `{ difficulty, count }`, does:

1. Pre-allocate N UUIDs (`randomUUID`)
2. Batch INSERT placeholder rows into `levels` with `review_status = 'generating'`
3. Spawn `scripts/tr/generate-crossword.ts` with `--ids` and `--difficulties` flags (detached)
4. Return `{ ids }`

Both `route.ts` and `generation-worker.ts` import this utility. No duplication.

---

## Generation Worker

**New file:** `scripts/generation-worker.ts`

### Startup Flow

```
connect to DB
for each difficulty in [easy, medium, hard, expert]:
  count approved levels
  if count == 0:
    triggerGeneration(difficulty, 100)
wait for all seed spawns
start 30-minute interval
```

### Interval Flow (every 30 minutes)

```
for each difficulty in [easy, medium, hard, expert]:
  count approved + has_viewed=false levels
  if count < 10 AND NOT isGenerating[difficulty]:
    isGenerating[difficulty] = true
    triggerGeneration(difficulty, 50)
    // isGenerating cleared when generation script exits
```

**Concurrency guard:** Per-difficulty `isGenerating` flag prevents duplicate spawns if a previous generation run is still in progress when the next interval fires.

**Thresholds:**
- Seed threshold: 0 approved → generate 100
- Low-stock threshold: < 10 unviewed approved → generate 50

---

## Docker Service

Added to `docker-compose.yml`:

```yaml
generation-worker:
  image: node:20-alpine
  working_dir: /app
  volumes:
    - ./:/app
    - /app/node_modules
  command: sh -c "npm install --ignore-scripts && npx tsx scripts/generation-worker.ts"
  env_file: .env
  depends_on:
    db:
      condition: service_healthy
  restart: unless-stopped
```

- `depends_on: db: condition: service_healthy` — waits for Postgres to be ready before startup check runs.
- `restart: unless-stopped` — recovers from crashes automatically.
- Shares the same `.env` as the rest of the stack.

---

## Affected Files

| File | Change |
|---|---|
| `backend/supabase/migrations/028_has_viewed.sql` | New — `has_viewed` column + index |
| `backend/supabase/functions/getLevel/index.ts` | Fire-and-forget `has_viewed = true` update |
| `scripts/shared/triggerGeneration.ts` | New — shared generation trigger utility |
| `admin/app/api/generate-puzzle/route.ts` | Refactor to use shared utility |
| `scripts/generation-worker.ts` | New — Docker worker service |
| `docker-compose.yml` | Add `generation-worker` service |

---

## Non-Goals

- Per-user "have I seen this puzzle?" tracking — that is `user_progress`, not `has_viewed`.
- Admin panel changes — the kanban board already shows `generating` status cards; no new UI needed.
- Changing generation script internals — worker reuses existing `generate-crossword.ts` unchanged via `--ids`/`--difficulties` flags.
