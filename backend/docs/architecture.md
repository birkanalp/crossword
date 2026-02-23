# Backend Architecture — Crossword Puzzle Game
## Phase 1 Summary

---

## Directory Structure

```
backend/
├── supabase/
│   ├── migrations/
│   │   ├── 001_initial_schema.sql   — Tables, indexes, constraints, triggers
│   │   ├── 002_rls_policies.sql     — Row-Level Security + ranked views
│   │   └── 003_rpc_functions.sql    — DB-side RPC helpers
│   ├── functions/
│   │   ├── _shared/
│   │   │   ├── types.ts             — Shared TypeScript interfaces
│   │   │   ├── cors.ts              — CORS headers + response helpers
│   │   │   ├── auth.ts              — Identity extraction + Supabase clients
│   │   │   ├── scoring.ts           — Score formula
│   │   │   └── anticheat.ts         — Hash validation + time/hint bounds
│   │   ├── getLevel/index.ts        — Fetch level + caller progress
│   │   ├── submitScore/index.ts     — Validate + score + rank + streak + coins
│   │   └── mergeGuestProgress/index.ts — Guest → User migration
│   ├── seed/
│   │   └── sample_level.json
│   └── config.toml
└── docs/
    ├── architecture.md              — This file
    └── level_schema.md              — Level JSON spec
```

---

## Database Design Decisions

### 1. Soft Deletes on `levels`
Levels are versioned content. We never hard-delete or mutate a live level —
increment `version` and set `deleted_at`. This preserves historical progress rows
and allows rollback.

### 2. Exactly-one Owner Constraint on `user_progress`
```sql
CONSTRAINT chk_progress_owner CHECK (
  (user_id IS NOT NULL AND guest_id IS NULL) OR
  (user_id IS NULL     AND guest_id IS NOT NULL)
)
```
Prevents dual-ownership and simplifies merge logic.

### 3. Leaderboard Upsert Strategy
`ON CONFLICT (user_id, level_id)` with conditional update: only overwrite if the
new score is higher. This avoids a SELECT + UPDATE round-trip under load.

### 4. `increment_coins` RPC
Atomic coin increment via `INSERT … ON CONFLICT DO UPDATE SET balance = balance + X`.
This is a single statement — no read-modify-write race possible.

### 5. Leaderboard Ranking
Ranking uses `COUNT(*) + 1 WHERE score > my_score` rather than `RANK() OVER (...)`.
This avoids a full table scan for a single user's rank and uses the
`(level_id, score DESC)` index efficiently.

For top-N pages, `get_leaderboard()` RPC uses `RANK() OVER` in a single
`LIMIT`-bounded query. Both approaches avoid N+1 queries.

---

## Anti-Cheat Strategy

### Answer Hash
```
canonical = level_id + ":" + version + ":" + sorted_answers.join(":")
hash      = SHA-256(canonical)
```
- Stored in `levels.answer_hash` at level creation time (server only)
- Never returned to the client
- Validated in `submitScore` before any score is computed

### Time Bounds
| Difficulty | Min (s) | Max (s) |
|-----------|---------|---------|
| Easy      | 10      | 7,200   |
| Medium    | 30      | 14,400  |
| Hard      | 60      | 28,800  |

### What the server never trusts
- Client-provided score values
- Client-provided rank
- Answer correctness (only hash match is accepted)

---

## Scoring Formula
```
base_score   = difficulty_multiplier × 1000
time_penalty = time_spent × 2
hint_penalty = hints_used × 50
final_score  = max(0, base_score − time_penalty − hint_penalty)
```

| Difficulty | Multiplier | Base Score |
|-----------|-----------|-----------|
| Easy      | 1.0       | 1,000     |
| Medium    | 1.5       | 1,500     |
| Hard      | 2.0       | 2,000     |

---

## Guest → User Migration Flow

1. Client calls `mergeGuestProgress` with `guest_id` + Bearer JWT
2. Server fetches all guest rows for `guest_id`
3. For each level: compare with user's existing row
4. Conflict resolution:
   - Completed > in-progress
   - Later `updated_at` wins (tie-breaker)
5. Winning guest rows: `SET user_id = :uid, guest_id = NULL`
6. Losing guest rows: deleted

---

## RLS Principles

| Table               | Anon Read | Auth Read      | Write                       |
|--------------------|-----------|---------------|------------------------------|
| levels             | non-premium only | + premium if is_pro | service_role only   |
| user_progress      | ✗         | own rows only  | own rows (Edge Fn for guests)|
| daily_challenges   | ✓         | ✓              | service_role only            |
| leaderboard_entries| ✓         | ✓              | service_role (submitScore)   |
| entitlements       | ✗         | own row only   | service_role (RevenueCat wh) |
| streaks            | ✗         | own row only   | service_role (submitScore)   |
| coins              | ✗         | own row only   | service_role (submitScore)   |

---

## Known Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Hash collision fraud | SHA-256 with level_id+version salt makes preimage attacks infeasible |
| Time spoofing | Server records `completed_at`; time window enforced by bounds check |
| Guest ID spoofing | Guest operations limited to read/write of their own rows; merge requires valid JWT |
| Score inflation via repeated submit | Leaderboard only updates on improvement; coin award keyed to `is_new_best` |
| Premium bypass | Level fetch checks `entitlements` server-side; client flag is display-only |
| DoS on answer submission | Answer map capped at 200 keys; Edge Function has Deno timeout |
| Coin balance going negative | DB `CHECK (balance >= 0)` + atomic RPC prevent underflow |

---

## Phase 2 Backlog

- [ ] `verifyPurchase` Edge Function (RevenueCat webhook)
- [ ] `getLeaderboard` Edge Function (paginated, daily/all-time toggle)
- [ ] `getDailyChallenge` Edge Function
- [ ] Push notification triggers (streak reminders)
- [ ] Admin level upload + answer hash computation tool
- [ ] Rate limiting (Supabase Edge Function middleware)
- [ ] Sentry error integration
- [ ] PostHog analytics events
