// =============================================================================
// Edge Function: getLevel
//
// GET /functions/v1/getLevel?id=<uuid>
//
// Returns level grid + clues. Strips answer_hash before responding.
// Enforces premium gating based on caller's entitlement.
// Supports both authenticated users and guests.
// =============================================================================

import { handleCors, errorResponse, jsonResponse } from "../_shared/cors.ts";
import { getCallerIdentity, serviceClient } from "../_shared/auth.ts";
import { isValidUUID } from "../_shared/auth.ts";
import type { LevelPayload } from "../_shared/types.ts";

Deno.serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  const cors = handleCors(req);
  if (cors) return cors;

  // ── Parse & validate input ─────────────────────────────────────────────────
  const url = new URL(req.url);
  const levelId = url.searchParams.get("id") ?? "";

  if (!isValidUUID(levelId)) {
    return errorResponse("Invalid or missing level id", 400);
  }

  // ── Identify caller ────────────────────────────────────────────────────────
  const identity = await getCallerIdentity(req);
  // Both guests and authenticated users may call this endpoint.
  // Guests cannot access premium levels.

  // ── Fetch level (service_role to read answer_hash for future use) ──────────
  const db = serviceClient();

  const { data: level, error } = await db
    .from("levels")
    .select(
      "id, version, difficulty, is_premium, grid_json, clues_json, answer_hash, difficulty_multiplier",
    )
    .eq("id", levelId)
    .is("deleted_at", null)
    .single();

  if (error || !level) {
    return errorResponse("Level not found", 404);
  }

  // ── Premium gate ───────────────────────────────────────────────────────────
  if (level.is_premium) {
    if (!identity.isAuthenticated) {
      return errorResponse("Premium level requires authentication", 403);
    }

    const { data: entitlement } = await db
      .from("entitlements")
      .select("is_pro, expires_at")
      .eq("user_id", identity.userId)
      .single();

    const hasPro =
      entitlement?.is_pro === true &&
      (entitlement.expires_at === null ||
        new Date(entitlement.expires_at) > new Date());

    if (!hasPro) {
      return errorResponse("Premium subscription required", 403);
    }
  }

  // ── Build response (NEVER include answer_hash or per-clue answers) ──────────
  // Strip the server-only "answer" field from every clue before sending.
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

  // ── Attach caller's progress (if any) ─────────────────────────────────────
  let progress = null;
  if (identity.isAuthenticated && identity.userId) {
    const { data } = await db
      .from("user_progress")
      .select("state_json, completed_at, time_spent, hints_used, mistakes")
      .eq("user_id", identity.userId)
      .eq("level_id", levelId)
      .maybeSingle();
    progress = data ?? null;
  } else if (identity.guestId) {
    const { data } = await db
      .from("user_progress")
      .select("state_json, completed_at, time_spent, hints_used, mistakes")
      .eq("guest_id", identity.guestId)
      .eq("level_id", levelId)
      .maybeSingle();
    progress = data ?? null;
  }

  return jsonResponse({ level: payload, progress });
});
