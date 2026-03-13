// =============================================================================
// Edge Function: getProfile
//
// GET /functions/v1/getProfile
//
// Returns the authenticated user's profile (username, stats, coins, streak).
// Requires Bearer JWT. Guests cannot fetch a profile.
// =============================================================================

import { handleCors, errorResponse, jsonResponse } from "../_shared/cors.ts";
import { getCallerIdentity, serviceClient } from "../_shared/auth.ts";

Deno.serve(async (req: Request): Promise<Response> => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== "GET") {
    return errorResponse("Method not allowed", 405);
  }

  const identity = await getCallerIdentity(req);
  if (!identity.isAuthenticated || !identity.userId) {
    return errorResponse("Authentication required", 401);
  }

  const db = serviceClient();
  const userId = identity.userId;

  // ── Fetch profile row ─────────────────────────────────────────────────────
  const { data: profile, error: profileError } = await db
    .from("profiles")
    .select("username, avatar_color, created_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (profileError) {
    return errorResponse("Failed to fetch profile", 500);
  }

  // ── Aggregate stats from user_progress ───────────────────────────────────
  const { data: progressRows, error: progressError } = await db
    .from("user_progress")
    .select("completed_at, time_spent, hints_used, mistakes")
    .eq("user_id", userId);

  if (progressError) {
    return errorResponse("Failed to fetch progress", 500);
  }

  const completedRows = (progressRows ?? []).filter((r) => r.completed_at != null);
  const levelsCompleted = completedRows.length;
  const totalTimeSpent = completedRows.reduce((acc, r) => acc + (r.time_spent ?? 0), 0);

  // ── Best leaderboard score ────────────────────────────────────────────────
  const { data: bestScore } = await db
    .from("leaderboard_entries")
    .select("score")
    .eq("user_id", userId)
    .order("score", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { count: totalScoreSum } = await db
    .from("leaderboard_entries")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);

  // ── Total score sum ───────────────────────────────────────────────────────
  const { data: scoreRows } = await db
    .from("leaderboard_entries")
    .select("score")
    .eq("user_id", userId);

  const totalScore = (scoreRows ?? []).reduce((acc, r) => acc + (r.score ?? 0), 0);

  // ── Response ──────────────────────────────────────────────────────────────
  return jsonResponse({
    user_id: userId,
    username: profile?.username ?? null,
    avatar_color: profile?.avatar_color ?? "#6366F1",
    levels_completed: levelsCompleted,
    total_score: totalScore,
    best_score: bestScore?.score ?? 0,
    total_time_spent: totalTimeSpent,
    total_entries: totalScoreSum ?? 0,
    created_at: profile?.created_at ?? null,
  });
});
