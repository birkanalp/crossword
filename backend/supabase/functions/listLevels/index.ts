// =============================================================================
// Edge Function: listLevels
//
// GET /functions/v1/listLevels
//
// Returns paginated list of approved level metadata with caller's progress.
// Used by the levels browser screen.
// Query params: difficulty, difficulties (comma-separated), hide_completed,
// sort (last_completed_first), limit (default 8), offset.
// =============================================================================

import { handleCors, errorResponse, jsonResponse } from "../_shared/cors.ts";
import { getCallerIdentity, serviceClient } from "../_shared/auth.ts";

const VALID_DIFFICULTIES = ["easy", "medium", "hard", "expert"] as const;

interface LevelRow {
  id: string;
  target_difficulty: string;
  is_premium: boolean;
  created_at: string;
}

interface ProgressRow {
  level_id: string;
  completed_at: string | null;
  time_spent: number;
  updated_at: string;
}

interface LevelWithProgress {
  id: string;
  difficulty: string;
  is_premium: boolean;
  created_at: string;
  progress: { completed_at: string | null; time_spent: number; updated_at?: string } | null;
}

Deno.serve(async (req: Request): Promise<Response> => {
  const cors = handleCors(req);
  if (cors) return cors;

  const identity = await getCallerIdentity(req);
  const db = serviceClient();

  const url = new URL(req.url);
  const difficulty = url.searchParams.get("difficulty") ?? undefined;
  const difficultiesParam = url.searchParams.get("difficulties") ?? undefined;
  const hideCompleted = url.searchParams.get("hide_completed") === "true";
  const sort = url.searchParams.get("sort") ?? undefined;
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "8", 10)));
  const offset = Math.max(0, parseInt(url.searchParams.get("offset") ?? "0", 10));

  if (difficulty && !VALID_DIFFICULTIES.includes(difficulty as (typeof VALID_DIFFICULTIES)[number])) {
    return errorResponse("Invalid difficulty filter", 400);
  }

  // Parse difficulties (comma-separated)
  let difficulties: string[] | undefined;
  if (difficultiesParam) {
    difficulties = difficultiesParam
      .split(",")
      .map((d) => d.trim().toLowerCase())
      .filter((d) => VALID_DIFFICULTIES.includes(d as (typeof VALID_DIFFICULTIES)[number]));
    if (difficulties.length === 0) difficulties = undefined;
  }

  // ── Fetch approved levels (no pagination yet — we need to sort in memory) ───
  const fetchLimit = Math.min(500, offset + limit + 100);
  let query = db
    .from("levels")
    .select("id, target_difficulty, is_premium, created_at", { count: "exact" })
    .eq("review_status", "approved")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(fetchLimit);

  if (difficulty) {
    query = query.eq("target_difficulty", difficulty);
  } else if (difficulties && difficulties.length > 0) {
    query = query.in("target_difficulty", difficulties);
  }

  const { data: levels, error: levelsError, count } = await query;

  if (levelsError) {
    console.error("[listLevels] levels query error:", levelsError);
    return errorResponse("Failed to fetch levels", 500);
  }

  const rows = (levels ?? []) as LevelRow[];
  const total = count ?? rows.length;

  const levelsWithDifficulty: LevelWithProgress[] = rows.map((r) => ({
    id: r.id,
    difficulty: r.target_difficulty ?? "medium",
    is_premium: r.is_premium ?? false,
    created_at: r.created_at,
    progress: null,
  }));

  if (levelsWithDifficulty.length === 0) {
    return jsonResponse({ levels: [], total });
  }

  const levelIds = levelsWithDifficulty.map((l) => l.id);

  // ── Fetch caller's progress for these levels ─────────────────────────────
  const progressMap: Record<string, { completed_at: string | null; time_spent: number; updated_at: string }> = {};

  if (identity.userId) {
    const { data: progressRows } = await db
      .from("user_progress")
      .select("level_id, completed_at, time_spent, updated_at")
      .eq("user_id", identity.userId)
      .in("level_id", levelIds);

    for (const p of (progressRows ?? []) as ProgressRow[]) {
      progressMap[p.level_id] = {
        completed_at: p.completed_at,
        time_spent: p.time_spent ?? 0,
        updated_at: p.updated_at ?? p.completed_at ?? p.level_id,
      };
    }
  } else if (identity.guestId) {
    const { data: progressRows } = await db
      .from("user_progress")
      .select("level_id, completed_at, time_spent, updated_at")
      .eq("guest_id", identity.guestId)
      .in("level_id", levelIds);

    for (const p of (progressRows ?? []) as ProgressRow[]) {
      progressMap[p.level_id] = {
        completed_at: p.completed_at,
        time_spent: p.time_spent ?? 0,
        updated_at: p.updated_at ?? p.completed_at ?? p.level_id,
      };
    }
  }

  // ── Attach progress and optionally filter ─────────────────────────────────
  let levelsWithProgress: LevelWithProgress[] = levelsWithDifficulty.map((l) => {
    const progress = progressMap[l.id];
    return {
      ...l,
      progress: progress
        ? { completed_at: progress.completed_at, time_spent: progress.time_spent }
        : null,
      ...(progress && { _updated_at: progress.updated_at } as { _updated_at?: string }),
    };
  });

  // Filter completed when hide_completed
  if (hideCompleted) {
    levelsWithProgress = levelsWithProgress.filter(
      (l) => !l.progress || l.progress.completed_at == null,
    );
  }

  // ── Sort: last_completed_first ───────────────────────────────────────────
  if (sort === "last_completed_first" && (identity.userId || identity.guestId)) {
    const withProgress = levelsWithProgress.map((l) => {
      const p = progressMap[l.id];
      return { ...l, _updated_at: p?.updated_at, _completed_at: p?.completed_at };
    });
    withProgress.sort((a, b) => {
      const aCompleted = a.progress?.completed_at != null;
      const bCompleted = b.progress?.completed_at != null;
      const aInProgress = a.progress && !aCompleted;
      const bInProgress = b.progress && !bCompleted;

      if (aCompleted && bCompleted) {
        return (b._completed_at ?? "").localeCompare(a._completed_at ?? "");
      }
      if (aCompleted) return -1;
      if (bCompleted) return 1;
      if (aInProgress && bInProgress) {
        return (b._updated_at ?? "").localeCompare(a._updated_at ?? "");
      }
      if (aInProgress) return -1;
      if (bInProgress) return 1;
      return (b.created_at ?? "").localeCompare(a.created_at ?? "");
    });
    levelsWithProgress = withProgress.map(({ _updated_at, _completed_at, ...rest }) => rest);
  }

  const totalFiltered = levelsWithProgress.length;
  const slice = levelsWithProgress.slice(offset, offset + limit);

  return jsonResponse({
    levels: slice.map(({ created_at, ...l }) => l),
    total: hideCompleted ? totalFiltered : total,
  });
});
