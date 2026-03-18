# Puzzle Inventory Management Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically seed 100 puzzles per difficulty on first backend boot and replenish any difficulty that drops below 10 unviewed approved puzzles — all without admin panel involvement.

**Architecture:** A `generation-worker` Docker service starts alongside the backend, queries DB counts directly on boot (seed if 0), then polls every 30 minutes and triggers generation via the existing `generate-crossword.ts` script when stock is low. A new `has_viewed` column on `levels` tracks first-play. The `getLevel` edge function sets it fire-and-forget. The `triggerGeneration` utility lives in `scripts/shared/` and is used exclusively by the worker (route.ts keeps its own inline logic with a targeted fix).

**Tech Stack:** Node.js 20 / tsx (CommonJS), PostgreSQL (pg), @supabase/supabase-js, Docker Compose, Deno (getLevel edge function)

**Spec:** `docs/superpowers/specs/2026-03-18-puzzle-inventory-management-design.md`

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `backend/supabase/migrations/028_has_viewed.sql` | Create | Adds `has_viewed` column + partial index |
| `backend/supabase/functions/getLevel/index.ts` | Modify | Fire-and-forget `has_viewed = true` after fetch |
| `admin/app/api/generate-puzzle/route.ts` | Modify | Fix `answer_hash` placeholder bug only (no structural refactor) |
| `scripts/shared/triggerGeneration.ts` | Create | Worker-only utility: allocate UUIDs, INSERT placeholders, spawn script |
| `scripts/generation-worker.ts` | Create | Long-running worker: boot seed + 30-min stock poll |
| `docker/generation-worker/Dockerfile` | Create | Docker image for the worker service |
| `docker-compose.yml` | Modify | Add `generation-worker` service |

> **Note on shared utility scope:** `scripts/shared/triggerGeneration.ts` is NOT imported by `admin/app/api/generate-puzzle/route.ts`. Admin's `tsconfig.json` (`"include": ["**/*.ts"]` relative to `admin/`) cannot resolve files above its root, and Next.js won't transpile outside its project boundary. Route.ts retains its inline logic with a targeted bug fix only. The shared utility exists for the worker, which runs outside the Next.js build system.

---

## Chunk 1: Data Layer

### Task 1: Migration — `has_viewed` column

**Files:**
- Create: `backend/supabase/migrations/028_has_viewed.sql`

- [ ] **Step 1: Create migration file**

```sql
-- =============================================================================
-- Migration: 028_has_viewed
-- Description: Tracks whether any player has ever opened a puzzle.
--   - has_viewed = false → fresh, unplayed content
--   - has_viewed = true  → at least one player opened this level
-- Used by: generation worker to measure unviewed approved stock per difficulty.
-- =============================================================================

ALTER TABLE levels ADD COLUMN IF NOT EXISTS has_viewed BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN levels.has_viewed IS
  'Set to true the first time any user fetches this level via getLevel. '
  'Default false for all new and existing levels. '
  'Used for low-stock detection: count approved+unviewed per difficulty.';

-- Partial index: only covers approved, non-deleted rows since those are the
-- only ones the stock query cares about.
CREATE INDEX IF NOT EXISTS idx_levels_unviewed_stock
  ON levels (target_difficulty, has_viewed)
  WHERE review_status = 'approved' AND deleted_at IS NULL;
```

- [ ] **Step 2: Apply migration via docker reset**

```bash
# From repo root
npm run docker:reset
# Wait for all services to start (~30s), then check db logs for errors
docker compose -p bulmaca logs db 2>&1 | grep -E "(error|ERROR|028)" | head -20
```

Expected: no errors. Migration 028 listed in output.

- [ ] **Step 3: Confirm column exists**

```bash
docker compose -p bulmaca exec db psql -U postgres -d postgres \
  -c "\d levels" | grep has_viewed
```

Expected: `has_viewed | boolean | not null | false`

- [ ] **Step 4: Commit**

```bash
git add backend/supabase/migrations/028_has_viewed.sql
git commit -m "feat: add has_viewed column to levels for inventory tracking"
```

---

### Task 2: getLevel — fire-and-forget `has_viewed` update

**Files:**
- Modify: `backend/supabase/functions/getLevel/index.ts`

- [ ] **Step 1: Add `has_viewed` to the select query**

Change the `.select(...)` call from:

```typescript
    .select(
      "id, version, difficulty, is_premium, grid_json, clues_json, answer_hash, difficulty_multiplier, review_status",
    )
```

To:

```typescript
    .select(
      "id, version, difficulty, is_premium, grid_json, clues_json, answer_hash, difficulty_multiplier, review_status, has_viewed",
    )
```

- [ ] **Step 2: Add fire-and-forget update after payload is built**

After the `const payload: LevelPayload = { ... }` block and before the progress fetch section, insert:

```typescript
  // Mark as viewed — fire-and-forget, must not delay the response.
  // Guard on !level.has_viewed skips the write for already-viewed levels.
  if (!level.has_viewed) {
    db.from("levels")
      .update({ has_viewed: true })
      .eq("id", levelId)
      .then(() => {})
      .catch(() => {});
  }
```

- [ ] **Step 3: Restart functions and smoke-test**

```bash
docker compose -p bulmaca restart functions
sleep 5
curl -s http://localhost:54321/functions/v1/getLevel \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRFA0NiK7W9fDQALeQAAAuklFMRCUjhJZJHnA3KNIhw" \
  2>&1 | head -5
```

Expected: JSON error `"Invalid or missing level id"` — confirms function is running.

- [ ] **Step 4: Commit**

```bash
git add backend/supabase/functions/getLevel/index.ts
git commit -m "feat: set has_viewed=true on first getLevel fetch (fire-and-forget)"
```

---

### Task 3: Fix `answer_hash` bug in route.ts

**Files:**
- Modify: `admin/app/api/generate-puzzle/route.ts`

**Context:** The current placeholder INSERT uses `answer_hash: ''` and `solution_hash: ''`. The DB has `CHECK (answer_hash ~ '^[0-9a-f]{64}$')` — an empty string fails this constraint. This is a targeted bug fix only; no structural changes to route.ts.

- [ ] **Step 1: Fix the placeholder hash values**

Find the `placeholders` array construction in route.ts (around line 89). Change:

```typescript
    answer_hash: '',
    solution_hash: '',
```

To:

```typescript
    // Satisfies CHECK (answer_hash ~ '^[0-9a-f]{64}$') for placeholder rows.
    // The generation script overwrites these with real hashes on completion.
    answer_hash: '0'.repeat(64),
    solution_hash: '0'.repeat(64),
```

- [ ] **Step 2: Verify admin builds cleanly**

```bash
cd admin && npm run build 2>&1 | tail -10
```

Expected: build succeeds with no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add admin/app/api/generate-puzzle/route.ts
git commit -m "fix: use valid placeholder hash in generate-puzzle route (answer_hash constraint)"
```

---

## Chunk 2: Shared Generation Utility

### Task 4: Create `scripts/shared/triggerGeneration.ts`

**Files:**
- Create: `scripts/shared/triggerGeneration.ts`

**Context:** This utility is used exclusively by the generation worker. It encapsulates: UUID allocation, placeholder INSERT via Supabase client, and detached script spawn. It is NOT imported by the admin Next.js panel.

- [ ] **Step 1: Create `scripts/shared/triggerGeneration.ts`**

```typescript
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import path from "node:path";

type Difficulty = "easy" | "medium" | "hard" | "expert";

export interface TriggerOptions {
  difficulty: Difficulty;
  count: number;
  /** Full Supabase URL. Inside Docker: http://kong:8000 */
  supabaseUrl: string;
  serviceRoleKey: string;
  /** Absolute path to the repo root (where scripts/ lives) */
  projectRoot: string;
  isDaily?: boolean;
}

export interface TriggerResult {
  ids: string[];
}

/**
 * Allocates placeholder `levels` rows in the DB, then spawns the
 * generate-crossword.ts script in the background to fill them in.
 *
 * Throws if the placeholder INSERT fails (no point spawning the script).
 */
export async function triggerGeneration(
  opts: TriggerOptions,
): Promise<TriggerResult> {
  const ids: string[] = Array.from({ length: opts.count }, () => randomUUID());
  const difficulties: Difficulty[] = Array.from(
    { length: opts.count },
    () => opts.difficulty,
  );

  const client = createClient(opts.supabaseUrl, opts.serviceRoleKey, {
    auth: { persistSession: false },
  });

  // answer_hash constraint: CHECK (answer_hash ~ '^[0-9a-f]{64}$')
  // 64 zero-chars satisfy the regex and are overwritten by the script.
  const PLACEHOLDER_HASH = "0".repeat(64);

  const placeholders = ids.map((id, i) => ({
    id,
    target_difficulty: difficulties[i],
    difficulty: difficulties[i],
    language: "tr",
    review_status: "generating",
    version: 1,
    auto_generated: true,
    clues_json: { across: [], down: [] },
    grid_json: { rows: 0, cols: 0, cells: [] },
    answer_hash: PLACEHOLDER_HASH,
    solution_hash: PLACEHOLDER_HASH,
    word_count: 0,
    grid_size: 0,
    generator_version: "placeholder",
    is_premium: false,
    difficulty_multiplier: 1.0,
  }));

  const { error } = await client.from("levels").insert(placeholders);
  if (error) {
    throw new Error(`Failed to insert placeholder records: ${error.message}`);
  }

  const scriptPath = path.join(
    opts.projectRoot,
    "scripts",
    "tr",
    "generate-crossword.ts",
  );

  const scriptArgs = [
    "tsx",
    scriptPath,
    "--ids",
    ids.join(","),
    "--difficulties",
    difficulties.join(","),
    "--json",
  ];
  if (opts.isDaily) {
    scriptArgs.push("--daily");
  }

  const child = spawn("npx", scriptArgs, {
    cwd: opts.projectRoot,
    env: { ...process.env },
    detached: true,
    stdio: "ignore",
  });
  child.unref();

  return { ids };
}
```

- [ ] **Step 2: Commit**

```bash
git add scripts/shared/triggerGeneration.ts
git commit -m "feat: add triggerGeneration shared utility for generation worker"
```

---

## Chunk 3: Generation Worker

### Task 5: Create `scripts/generation-worker.ts`

**Files:**
- Create: `scripts/generation-worker.ts`

**Context:**
- Root `package.json` has no `"type": "module"` → tsx runs files as CommonJS. Use `__dirname` for path resolution, not `import.meta.dirname`.
- `@supabase/supabase-js` is a devDependency in root `package.json` (the Dockerfile section handles this).
- `createPool` is imported from `./tr/_shared` — same pattern as `generate-crossword.ts`.

**Logic:**
1. On startup: for each difficulty, count total approved levels. If any is 0 → generate 100.
2. After seed spawns, start 30-minute interval.
3. Interval: count unviewed approved per difficulty. If < 10 and not already generating → generate 50.
4. Per-difficulty `isGenerating` flag with a 10-minute auto-clear prevents duplicate spawns.

- [ ] **Step 1: Write the file**

```typescript
import path from "node:path";
import { createPool } from "./tr/_shared";
import { triggerGeneration } from "./shared/triggerGeneration";

type Difficulty = "easy" | "medium" | "hard" | "expert";

const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard", "expert"];
const SEED_THRESHOLD = 0;         // generate if approved count equals this
const SEED_COUNT = 100;           // how many to generate on first boot
const LOW_STOCK_THRESHOLD = 10;   // generate if unviewed approved < this
const LOW_STOCK_COUNT = 50;       // how many to generate when low
const POLL_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
const GENERATING_LOCK_TTL_MS = 10 * 60 * 1000; // 10 minutes

const supabaseUrl = process.env.SUPABASE_URL ?? "";
const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.SERVICE_ROLE_KEY ??
  "";
// __dirname works correctly in CommonJS (no "type":"module" in package.json)
const projectRoot = path.resolve(__dirname, "..");

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    "[worker] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required",
  );
  process.exit(1);
}

// Per-difficulty lock: prevents duplicate spawns if a previous generation
// run is still in progress when the next interval fires.
const isGenerating: Record<Difficulty, boolean> = {
  easy: false,
  medium: false,
  hard: false,
  expert: false,
};

// ── DB helpers ────────────────────────────────────────────────────────────────

async function getApprovedCounts(): Promise<Record<Difficulty, number>> {
  const pool = createPool();
  try {
    const { rows } = await pool.query<{
      target_difficulty: Difficulty;
      total: string;
    }>(`
      SELECT target_difficulty, COUNT(*) AS total
      FROM levels
      WHERE review_status = 'approved'
        AND deleted_at IS NULL
      GROUP BY target_difficulty
    `);
    const result: Record<Difficulty, number> = {
      easy: 0,
      medium: 0,
      hard: 0,
      expert: 0,
    };
    for (const row of rows) {
      result[row.target_difficulty] = parseInt(row.total, 10);
    }
    return result;
  } finally {
    await pool.end();
  }
}

async function getUnviewedCounts(): Promise<Record<Difficulty, number>> {
  const pool = createPool();
  try {
    const { rows } = await pool.query<{
      target_difficulty: Difficulty;
      unviewed: string;
    }>(`
      SELECT target_difficulty, COUNT(*) AS unviewed
      FROM levels
      WHERE review_status = 'approved'
        AND has_viewed = false
        AND deleted_at IS NULL
      GROUP BY target_difficulty
    `);
    const result: Record<Difficulty, number> = {
      easy: 0,
      medium: 0,
      hard: 0,
      expert: 0,
    };
    for (const row of rows) {
      result[row.target_difficulty] = parseInt(row.unviewed, 10);
    }
    return result;
  } finally {
    await pool.end();
  }
}

// ── Generation trigger ────────────────────────────────────────────────────────

async function generate(difficulty: Difficulty, count: number): Promise<void> {
  isGenerating[difficulty] = true;
  console.log(
    `[worker] triggering generation: difficulty=${difficulty} count=${count}`,
  );
  try {
    const { ids } = await triggerGeneration({
      difficulty,
      count,
      supabaseUrl,
      serviceRoleKey,
      projectRoot,
    });
    console.log(
      `[worker] spawned ${difficulty}: ${ids.length} placeholder(s) created`,
    );
  } catch (err) {
    console.error(`[worker] triggerGeneration failed for ${difficulty}:`, err);
  } finally {
    // Generation script runs detached. Release the lock after GENERATING_LOCK_TTL_MS
    // so the next interval can re-check if something went wrong.
    setTimeout(() => {
      isGenerating[difficulty] = false;
      console.log(`[worker] generation lock cleared for ${difficulty}`);
    }, GENERATING_LOCK_TTL_MS);
  }
}

// ── Startup seed check ────────────────────────────────────────────────────────

async function runSeedCheck(): Promise<void> {
  console.log("[worker] running startup seed check...");
  let counts: Record<Difficulty, number>;
  try {
    counts = await getApprovedCounts();
  } catch (err) {
    console.error("[worker] seed check failed to query DB:", err);
    return;
  }

  for (const difficulty of DIFFICULTIES) {
    const total = counts[difficulty];
    console.log(
      `[worker] seed check: ${difficulty} approved=${total}`,
    );
    if (total <= SEED_THRESHOLD) {
      await generate(difficulty, SEED_COUNT);
    }
  }
  console.log("[worker] seed check complete");
}

// ── 30-minute stock poll ──────────────────────────────────────────────────────

async function runStockPoll(): Promise<void> {
  console.log("[worker] running stock poll...");
  let counts: Record<Difficulty, number>;
  try {
    counts = await getUnviewedCounts();
  } catch (err) {
    console.error("[worker] stock poll failed to query DB:", err);
    return;
  }

  for (const difficulty of DIFFICULTIES) {
    const unviewed = counts[difficulty];
    console.log(
      `[worker] stock poll: ${difficulty} unviewed_approved=${unviewed}`,
    );
    if (unviewed < LOW_STOCK_THRESHOLD && !isGenerating[difficulty]) {
      await generate(difficulty, LOW_STOCK_COUNT);
    }
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

console.log("[worker] Bulmaca generation worker starting...");
console.log(`[worker] poll interval: ${POLL_INTERVAL_MS / 60000} minutes`);
console.log(`[worker] seed: approved=0 → generate ${SEED_COUNT}`);
console.log(`[worker] low-stock: unviewed<${LOW_STOCK_THRESHOLD} → generate ${LOW_STOCK_COUNT}`);

runSeedCheck().then(() => {
  setInterval(runStockPoll, POLL_INTERVAL_MS);
  console.log("[worker] polling started");
});
```

> **Note:** `runSeedCheck().then(...)` is used instead of top-level `await` because the file runs as CommonJS (no `"type": "module"` in root `package.json`). Top-level await is not available in CommonJS.

- [ ] **Step 2: Verify TypeScript compiles**

```bash
# From repo root
npx tsc --noEmit --strict --target ES2020 --module commonjs \
  --moduleResolution node --esModuleInterop \
  scripts/generation-worker.ts 2>&1 | head -30
```

Expected: no type errors (may see warnings about missing @types/node — acceptable).

- [ ] **Step 3: Commit**

```bash
git add scripts/generation-worker.ts
git commit -m "feat: add generation worker with boot seed and 30-min stock poll"
```

---

## Chunk 4: Docker Integration

### Task 6: Dockerfile for generation worker

**Files:**
- Create: `docker/generation-worker/Dockerfile`

> **Design note:** This uses the `build`/Dockerfile approach rather than the volume-mount pattern shown in the spec. The Dockerfile approach produces an immutable, self-contained image that is consistent across environments — preferable for a service that runs continuously. The existing `cron` service uses the same Dockerfile pattern.

> **devDependency note:** `@supabase/supabase-js` is listed under `devDependencies` in root `package.json`. The Dockerfile uses `npm ci --include=dev` to ensure it's available inside the container.

- [ ] **Step 1: Create Dockerfile**

```dockerfile
# Generation worker — seeds puzzles on boot, replenishes low stock every 30 min.
# Build from repo root: docker build -f docker/generation-worker/Dockerfile .
FROM node:20-alpine
WORKDIR /app

COPY package.json package-lock.json* ./
# --include=dev required: @supabase/supabase-js is in devDependencies
RUN npm ci --include=dev

COPY scripts scripts/

CMD ["npx", "tsx", "scripts/generation-worker.ts"]
```

- [ ] **Step 2: Add `generation-worker` service to `docker-compose.yml`**

In the top comment block, add to the Services list:
```
#   generation-worker → Puzzle inventory management (seeds on boot, polls every 30 min)
```

Add the service definition after the `cron:` block (before `inbucket:`):

```yaml
  # ── Generation worker ────────────────────────────────────────────────────────
  # Seeds 100 puzzles per difficulty on first boot (when approved count = 0).
  # Polls every 30 min: generates 50 more for any difficulty with <10 unviewed.
  generation-worker:
    build:
      context: .
      dockerfile: docker/generation-worker/Dockerfile
    restart: unless-stopped
    depends_on:
      db:
        condition: service_healthy
      kong:
        # Kong defines a healthcheck (CMD: kong health) so service_healthy works.
        condition: service_healthy
    environment:
      DATABASE_URL: postgresql://postgres:${POSTGRES_PASSWORD:-your-super-secret-and-long-postgres-password}@db:5432/${POSTGRES_DB:-postgres}
      SUPABASE_URL: http://kong:8000
      SUPABASE_SERVICE_ROLE_KEY: ${SERVICE_ROLE_KEY:-eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hj04zWl196z2-SBc0}
      CRON_TRIGGER_AI_URL: http://kong:8000/functions/v1/cronTriggerAiReview
      CRON_SECRET: ${CRON_SECRET:-cron-trigger-ai-secret}
```

- [ ] **Step 3: Build the image**

```bash
docker compose -p bulmaca build generation-worker
```

Expected: build completes successfully, image ready.

- [ ] **Step 4: Start all services and check worker logs**

```bash
npm run docker:up
sleep 15
docker compose -p bulmaca logs generation-worker --tail=50
```

Expected log output (on fresh DB):
```
[worker] Bulmaca generation worker starting...
[worker] poll interval: 30 minutes
[worker] seed: approved=0 → generate 100
[worker] low-stock: unviewed<10 → generate 50
[worker] running startup seed check...
[worker] seed check: easy approved=0
[worker] triggering generation: difficulty=easy count=100
[worker] spawned easy: 100 placeholder(s) created
[worker] seed check: medium approved=0
[worker] triggering generation: difficulty=medium count=100
[worker] spawned medium: 100 placeholder(s) created
[worker] seed check: hard approved=0
[worker] triggering generation: difficulty=hard count=100
[worker] spawned hard: 100 placeholder(s) created
[worker] seed check: expert approved=0
[worker] triggering generation: difficulty=expert count=100
[worker] spawned expert: 100 placeholder(s) created
[worker] seed check complete
[worker] polling started
```

- [ ] **Step 5: Verify placeholder rows in DB**

```bash
docker compose -p bulmaca exec db psql -U postgres -d postgres \
  -c "SELECT target_difficulty, review_status, COUNT(*) FROM levels GROUP BY target_difficulty, review_status ORDER BY 1, 2;"
```

Expected: rows for all 4 difficulties with `generating` status, 100 each.

- [ ] **Step 6: Commit**

```bash
git add docker/generation-worker/Dockerfile docker-compose.yml
git commit -m "feat: add generation-worker Docker service for automatic puzzle inventory"
```

---

## Chunk 5: Verification

### Task 7: End-to-end verification

> **Timing note for Step 2:** The low-stock simulation requires approved puzzles. After `docker:reset`, all puzzles start in `generating` status. They become `approved` only after the generation script completes AND the AI reviewer approves them — which takes hours for 400 puzzles. For a quick test, manually insert a few approved puzzles into the DB, or wait for at least one generation+review cycle to complete.

- [ ] **Step 1: Full reset and confirm worker boots cleanly**

```bash
npm run docker:reset
sleep 15
docker compose -p bulmaca ps
docker compose -p bulmaca logs generation-worker --tail=20
```

Expected: `generation-worker` shows `running`, seed check output visible.

- [ ] **Step 2: Verify `has_viewed` is set by getLevel**

```bash
# Get an approved level ID (run this after at least one puzzle is approved)
LEVEL_ID=$(docker compose -p bulmaca exec db psql -U postgres -d postgres -t -c \
  "SELECT id FROM levels WHERE review_status='approved' LIMIT 1;" | tr -d ' \n')

echo "Testing level: $LEVEL_ID"

# Fetch via getLevel
curl -s "http://localhost:54321/functions/v1/getLevel?id=$LEVEL_ID" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRFA0NiK7W9fDQALeQAAAuklFMRCUjhJZJHnA3KNIhw" | jq '.level.id'

# Wait 1s then confirm has_viewed flipped
sleep 1
docker compose -p bulmaca exec db psql -U postgres -d postgres \
  -c "SELECT id, has_viewed FROM levels WHERE id = '$LEVEL_ID';"
```

Expected: `has_viewed = true`.

- [ ] **Step 3: Simulate low-stock and verify worker responds (requires approved puzzles)**

```bash
# Mark all easy approved puzzles as viewed
docker compose -p bulmaca exec db psql -U postgres -d postgres -c "
  UPDATE levels SET has_viewed = true
  WHERE review_status = 'approved'
    AND target_difficulty = 'easy'
    AND deleted_at IS NULL;
"

# Restart worker to trigger immediate stock poll (instead of waiting 30 min)
docker compose -p bulmaca restart generation-worker
sleep 5
docker compose -p bulmaca logs generation-worker --tail=20
```

Expected: worker logs `easy unviewed_approved=0`, then `triggering generation: difficulty=easy count=50`.

- [ ] **Step 4: Final commit**

```bash
git status  # confirm no unexpected changes
git log --oneline -8
```

All implementation commits should be visible and the working tree clean.
