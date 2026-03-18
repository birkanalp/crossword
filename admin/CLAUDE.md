# Bulmaca Admin Panel – Architecture Context

## Purpose

Internal web tool (local only, not deployed) for reviewing/approving AI-generated crossword puzzles, managing game content, and monitoring metrics. Admin access only.

---

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript 5 (strict)
- **UI:** React 18 + plain CSS (`globals.css` + inline `style` props) — no UI library
- **API Client:** `lib/api.ts` using `adminFetch` (plain `fetch`, not Supabase JS client)
- **Auth Client:** `@supabase/supabase-js` (browser client in `lib/supabase.ts`) — only used for auth
- **Port (dev):** 3001

---

## Project Structure

```
admin/
├── app/
│   ├── api/
│   │   └── generate-puzzle/route.ts   # Spawns crossword generation script
│   ├── dashboard/page.tsx             # Metrics overview
│   ├── puzzles/
│   │   ├── page.tsx                   # Puzzle list: filter, sort order editing
│   │   └── [id]/page.tsx              # Puzzle review: grid, clues, approve/reject
│   ├── shop/page.tsx                  # Coin packages CRUD
│   ├── leaderboard/page.tsx           # Leaderboard stats + table + CSV export
│   ├── todos/page.tsx                 # Engineering task tracker
│   ├── delete-account/page.tsx        # Account deletion tool
│   ├── layout.tsx                     # Root layout — wraps with <AuthProvider>
│   ├── page.tsx                       # Login redirect
│   └── globals.css
├── components/
│   ├── AdminLayout.tsx                # Header nav + logout
│   ├── LoginForm.tsx
│   └── PuzzleGrid.tsx                 # Memoized SVG grid
├── contexts/
│   └── AuthContext.tsx                # Supabase session + admin role gate
├── lib/
│   ├── supabase.ts                    # Supabase browser client (auth only)
│   ├── api.ts                         # Typed admin API calls via adminFetch
│   ├── todos.ts                       # Todo types + status enum
│   └── todos-storage.ts              # localStorage-backed todo persistence
└── .env.local.example
```

---

## Routes

| Route | Purpose |
|---|---|
| `/` | Login page |
| `/dashboard` | Metrics overview (plays, users, ads, active users) |
| `/puzzles` | Puzzle list — filter by status, inline sort_order editing |
| `/puzzles/[id]` | Puzzle review — edit clues, approve/reject |
| `/shop` | Coin packages — create, edit, reorder, delete |
| `/leaderboard` | Leaderboard stats + entries table + CSV export |
| `/todos` | Engineering tasks (localStorage-backed) |
| `/delete-account` | Account deletion tool |

---

## Authentication

1. User submits email + password via `LoginForm`
2. `supabase.auth.signInWithPassword()` called
3. `AuthContext` checks `session.user.app_metadata.role === 'admin'`
4. Non-admin users are immediately signed out
5. `AdminLayout` redirects unauthenticated visitors to `/`

**Default dev credentials:** `admin@bulmaca.local` / `Admin123!`
**Creating admin user:** `npm run admin:create-user` from repo root

---

## API Client (`lib/api.ts`)

All data calls use `adminFetch` — a typed wrapper around `fetch` that sends the Supabase access token as `Authorization: Bearer` and the anon key as `apikey`.

Base URL: `process.env.NEXT_PUBLIC_SUPABASE_URL/functions/v1`

### Key Types

```typescript
AdminPuzzleSummary {
  id, difficulty, language,
  review_status: 'ai_review' | 'pending' | 'approved' | 'rejected',
  created_at, ai_reviewed_at, ai_review_score: number | null, sort_order: number
}

AdminLevel {
  id, version, difficulty, language, is_premium,
  grid_json: { rows, cols, cells[] },
  clues_json: { across: AdminClue[], down: AdminClue[] },
  review_status, review_notes, reviewed_by, reviewed_at,
  ai_review_notes, ai_reviewed_at, ai_review_score: number | null
}

MetricsOverview { daily_plays, total_users, paid_users, active_users_15min, ads_watched_today }
DailyMetricsPoint { date, plays, completions }
```

---

## Puzzle Review Workflow

1. `/puzzles` — default filter: `status=pending`; shows `ai_review_score` per row
2. Levels auto-approved if `ai_review_score >= 80`
3. Admin can edit inline `sort_order` values and save batch changes
4. `/puzzles/[id]` — edit clues, approve or reject (rejection requires notes)
5. Decision POSTed to `/admin/puzzles/{id}/decision`
6. Redirects back to `/puzzles`

---

## Puzzle Generation Flow

1. Admin clicks "Yeni Bulmaca Üret", selects difficulty
2. Frontend POSTs to `/api/generate-puzzle` (local Next.js route)
3. Route validates admin JWT, then spawns from repo root:
   ```
   npx tsx scripts/tr/generate-crossword.ts --difficulty=<level>
   ```
4. Script outputs JSON with `level_id`; route returns `{ level_id, difficulty }`
5. Frontend redirects to `/puzzles/<level_id>` for immediate review

---

## Styling Conventions

- Dark theme: background `#1a1a22`, text `#e8e8ed`
- Accent: `#6b9fff`
- No CSS framework — `globals.css` + inline `style` props
- All UI strings in **Turkish**
- Difficulty labels: Kolay / Orta / Zor / Uzman

---

## Critical Rules

- Always check `role === 'admin'` — never expose admin routes to unauthenticated users
- Never modify `grid_json` — only `clues_json` fields are editable in review
- Puzzle generation script must `cwd` to repo root when spawning
- All API errors must surface to the admin user — no silent failures
- Admin panel is local-only — no production deployment
