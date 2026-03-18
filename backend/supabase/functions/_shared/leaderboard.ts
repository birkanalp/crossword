// ---------------------------------------------------------------------------
// Shared leaderboard query logic
// Used by getLeaderboard (public endpoint) and admin routes.
// Extracted here to avoid importing from another function's index.ts,
// which would trigger that function's Deno.serve and register the wrong handler.
// ---------------------------------------------------------------------------

import { serviceClient } from "./auth.ts";

export interface FetchParams {
  db:      ReturnType<typeof serviceClient>;
  type:    string;
  sortBy:  string;
  levelId: string | null;
  date:    string;
  limit:   number;
  page:    number;
}

export interface RawRow {
  user_id:         string;
  display_name:    string | null;
  score:           number;
  completion_time: number;
  mistakes:        number;
  hints_used:      number;
  created_at:      string;
  level_id?:       string;
}

export async function fetchLeaderboardEntries(
  p: FetchParams,
): Promise<{ entries: RawRow[]; total: number }> {
  const { db, type, sortBy, levelId, date, limit, page } = p;
  const offset = page * limit;
  const orderCol = sortBy === "time" ? "completion_time" : "score";

  if (type === "all_time") {
    const { data: allRows, error } = await db
      .from("leaderboard_entries")
      .select("user_id, display_name, score, completion_time, mistakes, hints_used, created_at")
      .order(orderCol, { ascending: sortBy === "time" });

    if (error) throw error;

    const userBest = new Map<string, RawRow>();
    for (const row of allRows ?? []) {
      const existing = userBest.get(row.user_id);
      if (!existing) {
        userBest.set(row.user_id, row as RawRow);
      } else if (sortBy === "score" && row.score > existing.score) {
        userBest.set(row.user_id, row as RawRow);
      } else if (sortBy === "time" && row.completion_time < existing.completion_time) {
        userBest.set(row.user_id, row as RawRow);
      }
    }

    const sorted = Array.from(userBest.values()).sort((a, b) =>
      sortBy === "time"
        ? a.completion_time - b.completion_time
        : b.score - a.score,
    );

    return {
      total:   sorted.length,
      entries: sorted.slice(offset, offset + limit),
    };
  }

  if (type === "daily") {
    const { data: challenge } = await db
      .from("daily_challenges")
      .select("level_id")
      .eq("date", date)
      .maybeSingle();

    if (!challenge) {
      return { entries: [], total: 0 };
    }

    const { data, error, count } = await db
      .from("leaderboard_entries")
      .select("user_id, display_name, score, completion_time, mistakes, hints_used, created_at", {
        count: "exact",
      })
      .eq("level_id", challenge.level_id)
      .gte("created_at", `${date}T00:00:00Z`)
      .lte("created_at", `${date}T23:59:59Z`)
      .order(orderCol, { ascending: sortBy === "time" })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return { entries: (data ?? []) as RawRow[], total: count ?? 0 };
  }

  // type === "puzzle"
  const { data, error, count } = await db
    .from("leaderboard_entries")
    .select("user_id, display_name, score, completion_time, mistakes, hints_used, created_at", {
      count: "exact",
    })
    .eq("level_id", levelId!)
    .order(orderCol, { ascending: sortBy === "time" })
    .range(offset, offset + limit - 1);

  if (error) throw error;

  return { entries: (data ?? []) as RawRow[], total: count ?? 0 };
}
