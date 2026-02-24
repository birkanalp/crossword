// =============================================================================
// Edge Function: getDailyChallenge
//
// GET /functions/v1/getDailyChallenge
//
// Returns today's daily puzzle level + caller's progress.
// =============================================================================

import { handleCors, errorResponse, jsonResponse } from "../_shared/cors.ts";
import { getCallerIdentity, serviceClient } from "../_shared/auth.ts";
import type { LevelPayload } from "../_shared/types.ts";

Deno.serve(async (req: Request): Promise<Response> => {
  const cors = handleCors(req);
  if (cors) return cors;

  const identity = await getCallerIdentity(req);
  const db = serviceClient();

  // Today's date in UTC (YYYY-MM-DD)
  const today = new Date().toISOString().split("T")[0];

  // ── Find today's daily challenge ───────────────────────────────────────────
  const { data: challenge, error: challengeError } = await db
    .from("daily_challenges")
    .select("level_id")
    .eq("date", today)
    .single();

  if (challengeError || !challenge) {
    return errorResponse("No daily challenge found for today", 404);
  }

  // ── Fetch the level ────────────────────────────────────────────────────────
  const { data: level, error: levelError } = await db
    .from("levels")
    .select("id, version, difficulty, is_premium, grid_json, clues_json")
    .eq("id", challenge.level_id)
    .is("deleted_at", null)
    .single();

  if (levelError || !level) {
    return errorResponse("Daily challenge level not found", 404);
  }

  // Strip server-only "answer" field from every clue before sending.
  const stripAnswers = (clues: Record<string, unknown>[]) =>
    clues.map(({ answer: _a, ...rest }) => rest);

  const sanitizedCluesJson = {
    across: stripAnswers((level.clues_json as { across: Record<string, unknown>[] }).across ?? []),
    down: stripAnswers((level.clues_json as { down: Record<string, unknown>[] }).down ?? []),
  };

  const payload: LevelPayload = {
    id: level.id,
    version: level.version,
    difficulty: level.difficulty,
    is_premium: level.is_premium,
    grid_json: level.grid_json,
    clues_json: sanitizedCluesJson,
  };

  // ── Attach caller's progress ───────────────────────────────────────────────
  let progress = null;
  if (identity.isAuthenticated && identity.userId) {
    const { data } = await db
      .from("user_progress")
      .select("state_json, completed_at, time_spent, hints_used, mistakes")
      .eq("user_id", identity.userId)
      .eq("level_id", level.id)
      .maybeSingle();
    progress = data ?? null;
  } else if (identity.guestId) {
    const { data } = await db
      .from("user_progress")
      .select("state_json, completed_at, time_spent, hints_used, mistakes")
      .eq("guest_id", identity.guestId)
      .eq("level_id", level.id)
      .maybeSingle();
    progress = data ?? null;
  }

  return jsonResponse({ level: payload, progress });
});
