# Bulmaca Admin Panel – Architecture (Claude Context)

## Purpose

Internal web tool for reviewing, editing, approving/rejecting AI-generated crossword puzzles and monitoring game metrics. Not a public-facing app — admin access only.

---

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript 5
- **UI:** React 18 + plain CSS (no UI library)
- **API Client:** @supabase/supabase-js 2
- **Port (dev):** 3001
- **Auth:** Supabase Email Auth + `app_metadata.role === 'admin'` check
- **Puzzle generation:** spawns `npx tsx scripts/tr/generate-crossword.ts` via child process

---

## Project Structure

```
admin/
├── app/
│   ├── api/
│   │   └── generate-puzzle/
│   │       └── route.ts          # Next.js API route – spawns generation script
│   ├── dashboard/
│   │   ├── layout.tsx
│   │   └── page.tsx              # Metrics dashboard
│   ├── puzzles/
│   │   ├── layout.tsx
│   │   ├── page.tsx              # Puzzle list with status filter + pagination
│   │   └── [id]/
│   │       └── page.tsx          # Puzzle review (grid + clues + approve/reject)
│   ├── layout.tsx                # Root layout – wraps with <AuthProvider>
│   ├── page.tsx                  # Login page (redirect to /dashboard if authed)
│   └── globals.css
├── components/
│   ├── AdminLayout.tsx           # Header nav (Dashboard / Puzzles) + logout
│   ├── LoginForm.tsx             # Email/password form
│   └── PuzzleGrid.tsx            # Memoized SVG grid with cell highlighting
├── contexts/
│   └── AuthContext.tsx           # Supabase session state + admin role gate
├── lib/
│   ├── supabase.ts               # Supabase browser client (singleton)
│   ├── api.ts                    # All admin API calls (typed)
│   └── puzzle-utils.ts           # Grid/clue building helpers
└── .env.local.example
```

---

## Routes

| Route | Purpose |
|---|---|
| `/` | Login page |
| `/dashboard` | Metrics overview (plays, users, daily chart) |
| `/puzzles` | List puzzles (filter: pending/approved/rejected, paginated) |
| `/puzzles/[id]` | Review a single puzzle – edit clues, approve, reject |

---

## Authentication

**Flow:**
1. User submits email + password via `LoginForm`
2. `supabase.auth.signInWithPassword()` called
3. `AuthContext` checks `session.user.app_metadata.role === 'admin'`
4. Non-admin users are immediately signed out and shown an error
5. `AdminLayout` redirects unauthenticated visitors to `/`

**Default dev credentials:** `admin@bulmaca.local` / `Admin123!`

**Creating admin user:** `npm run admin:create-user` from repo root

---

## API Client (`lib/api.ts`)

All calls go to Supabase Edge Functions via Kong gateway at `http://localhost:54321`.
Auth header: `Authorization: Bearer <supabase_access_token>`

### Key functions

```typescript
getPuzzles(status, page, limit)       → AdminPuzzleSummary[]
getPuzzle(id)                         → AdminLevel
updateClue(puzzleId, clueKey, patch)  → void   // PATCH clue text/answer/hint
submitDecision(puzzleId, decision)    → void   // approve | reject (+ notes)
getMetricsOverview()                  → MetricsOverview
getDailyMetrics(from, to)             → DailyMetricsPoint[]
```

### Types

```typescript
AdminPuzzleSummary { id, difficulty, language, status, created_at }
AdminLevel         { id, grid_json, clues_json, status, review_notes, ... }
MetricsOverview    { daily_plays, total_users, paid_users, active_now }
DailyMetricsPoint  { date, plays, completions }
```

---

## Puzzle Review Workflow

1. Admin opens `/puzzles` — filtered to `status=pending` by default
2. Clicks a puzzle → `/puzzles/[id]`
3. Reviews the SVG grid and clue list
4. Optionally edits individual clues (text / answer / hint) via inline forms
5. Can fill all answers or clear all
6. Submits **Approve** (instant) or **Reject** (requires rejection notes)
7. Decision POSTed to `/admin/puzzles/{id}/decision`
8. Redirects back to `/puzzles`

---

## Puzzle Generation Flow

1. Admin clicks "Yeni Bulmaca Üret" button on `/puzzles`, selects difficulty
2. Frontend POSTs to `/api/generate-puzzle` (local Next.js route)
3. Route validates admin JWT, then spawns:
   ```
   npx tsx scripts/tr/generate-crossword.ts --difficulty=<level>
   ```
   from the repo root (`/Users/birkanalp/Desktop/Bulmaca/`)
4. Script outputs JSON with `level_id`
5. Route returns `{ level_id, difficulty }` to frontend
6. Frontend redirects to `/puzzles/<level_id>` for immediate review

---

## Component Notes

### `PuzzleGrid`
- Renders crossword grid as SVG
- `memo()` wrapped — only re-renders when `grid_json` or `highlightedCells` change
- Clicking a cell calls `onCellClick(row, col)`
- Highlighted cells shown with blue background (`#6b9fff`)

### `AdminLayout`
- Must wrap every protected page
- Calls `useAuth()` — redirects to `/` if no session
- Header: logo, nav links, logout button

### `AuthContext`
- Provides `{ session, user, loading, signOut }`
- Listens to `supabase.auth.onAuthStateChange`
- Enforces `role === 'admin'` — non-admins get signed out immediately

---

## Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key from .env>
```

Copy `.env.local.example` → `.env.local` and fill in the anon key from the root `.env`.

---

## Running Locally

```bash
# From repo root — start Supabase stack first
npm run docker:up

# Then start admin dev server
npm run admin:dev        # → http://localhost:3001

# Or from admin/ directory
npm run dev
```

---

## Styling Conventions

- Dark theme throughout: background `#1a1a22`, text `#e8e8ed`
- Accent blue: `#6b9fff`
- No external CSS framework — plain CSS in `globals.css` + inline `style` props
- All UI strings are in **Turkish**
- Difficulty labels: Kolay / Orta / Zor / Uzman (Easy / Medium / Hard / Expert)

---

## Critical Rules

- Never expose admin routes or API to unauthenticated users — always check `role === 'admin'`
- Never modify `grid_json` structure — only `clues_json` fields are editable in review
- The generation script path is relative to repo root — the Next.js API route must `cwd` to repo root when spawning the process
- Admin panel only runs locally — not deployed; no production build needed
- All API errors should be surfaced to the admin user (no silent failures)
