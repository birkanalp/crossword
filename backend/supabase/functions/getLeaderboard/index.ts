// =============================================================================
// Edge Function: getLeaderboard
//
// GET /functions/v1/getLeaderboard
//
// Public endpoint (auth optional). Returns a ranked, paginated leaderboard.
//
// Query params:
//   type      daily | all_time | puzzle  (required)
//   sort_by   score | time               (default: score)
//   level_id  UUID                       (required when type=puzzle)
//   date      YYYY-MM-DD                 (default today UTC, used for type=daily)
//   limit     1-100                      (default 50)
//   page      >= 0                       (default 0; offset = page * limit)
//
// Response: GetLeaderboardResponse
//   { entries: LeaderboardEntry[], total: number, page: number, my_entry: LeaderboardEntry | null }
// =============================================================================

import { handleCors, errorResponse, jsonResponse } from "../_shared/cors.ts";
import { serviceClient } from "../_shared/auth.ts";
import { fetchLeaderboardEntries } from "../_shared/leaderboard.ts";

const DEFAULT_AVATAR_COLOR = "#6366F1";
const ANON_DISPLAY_NAME = "Anonim";

interface LeaderboardEntry {
  rank:            number;
  user_id:         string;
  display_name:    string;
  avatar_color:    string;
  score:           number;
  completion_time: number;
  mistakes:        number;
  hints_used:      number;
  created_at:      string;
}

Deno.serve(async (req: Request): Promise<Response> => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== "GET") {
    return errorResponse("Method not allowed", 405);
  }

  const url = new URL(req.url);
  const type    = url.searchParams.get("type");
  const sortBy  = url.searchParams.get("sort_by") ?? "score";
  const levelId = url.searchParams.get("level_id");
  const date    = url.searchParams.get("date") ?? new Date().toISOString().split("T")[0];
  const limit   = Math.min(Math.max(parseInt(url.searchParams.get("limit") ?? "50", 10) || 50, 1), 100);
  const page    = Math.max(parseInt(url.searchParams.get("page") ?? "0", 10) || 0, 0);

  // ── Validate params ────────────────────────────────────────────────────────
  if (!type || !["daily", "all_time", "puzzle"].includes(type)) {
    return errorResponse("type must be daily | all_time | puzzle", 400);
  }
  if (!["score", "time"].includes(sortBy)) {
    return errorResponse("sort_by must be score | time", 400);
  }
  if (type === "puzzle" && !levelId) {
    return errorResponse("level_id is required when type=puzzle", 400);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return errorResponse("date must be YYYY-MM-DD", 400);
  }

  const db = serviceClient();

  // ── Resolve caller identity (best-effort — no hard auth requirement) ───────
  let callerId: string | null = null;
  const authHeader = req.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    try {
      const token = authHeader.replace("Bearer ", "");
      const { data } = await db.auth.getUser(token);
      callerId = data.user?.id ?? null;
    } catch {
      // Ignore — auth is optional for this endpoint
    }
  }

  try {
    const { entries, total } = await fetchLeaderboardEntries({
      db, type, sortBy, levelId, date, limit, page,
    });

    // Batch-fetch avatar colors from profiles for the returned user set
    const userIds = [...new Set(entries.map((r) => r.user_id))];
    const avatarColorMap = new Map<string, string>();
    if (userIds.length > 0) {
      const { data: profiles } = await db
        .from("profiles")
        .select("user_id, avatar_color")
        .in("user_id", userIds);
      for (const p of profiles ?? []) {
        avatarColorMap.set(p.user_id, p.avatar_color);
      }
    }

    const offset = page * limit;
    const rankedEntries: LeaderboardEntry[] = entries.map((row, idx) => ({
      rank:            offset + idx + 1,
      user_id:         row.user_id,
      display_name:    row.display_name || ANON_DISPLAY_NAME,
      avatar_color:    avatarColorMap.get(row.user_id) ?? DEFAULT_AVATAR_COLOR,
      score:           row.score,
      completion_time: row.completion_time,
      mistakes:        row.mistakes ?? 0,
      hints_used:      row.hints_used ?? 0,
      created_at:      row.created_at,
    }));

    // Find the caller's entry within the current page
    let myEntry: LeaderboardEntry | null = null;
    if (callerId) {
      const idx = rankedEntries.findIndex((e) => e.user_id === callerId);
      if (idx >= 0) myEntry = rankedEntries[idx];
    }

    return jsonResponse({ entries: rankedEntries, total, page, my_entry: myEntry });
  } catch (err) {
    console.error("[getLeaderboard] error:", err);
    return errorResponse("Internal server error", 500);
  }
});

