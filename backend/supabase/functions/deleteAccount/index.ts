// =============================================================================
// Edge Function: deleteAccount
//
// DELETE /functions/v1/deleteAccount
//
// Permanently deletes the authenticated user's account and all associated data.
// Complies with Apple App Store Review Guideline 5.1.1(v) and Google Play
// account deletion requirements.
//
// What gets deleted:
//  - user_progress rows (user_id = caller)
//  - leaderboard_entries rows (user_id = caller)
//  - profiles row (user_id = caller — cascaded by FK on DELETE CASCADE)
//  - auth.users record (via Supabase Admin API — triggers all cascade deletes)
// =============================================================================

import { handleCors, errorResponse, jsonResponse } from "../_shared/cors.ts";
import { getCallerIdentity, serviceClient } from "../_shared/auth.ts";
import { checkRateLimit } from "../_shared/rateLimit.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (req: Request): Promise<Response> => {
  const cors = handleCors(req);
  if (cors) return cors;

  // Rate limit: 3 delete attempts per minute per IP
  const limited = checkRateLimit(req, { limit: 3, windowMs: 60_000 });
  if (limited) return limited;

  if (req.method !== "DELETE") {
    return errorResponse("Method not allowed. Use DELETE.", 405);
  }

  const identity = await getCallerIdentity(req);
  if (!identity.isAuthenticated || !identity.userId) {
    return errorResponse("Authentication required", 401);
  }

  const userId = identity.userId;
  const db = serviceClient();

  // ── Delete user data (belt + suspenders alongside FK cascades) ───────────
  // These may already cascade from the auth.users deletion below, but
  // explicit deletes ensure data is gone even if FK cascade is misconfigured.

  await db.from("leaderboard_entries").delete().eq("user_id", userId);
  await db.from("user_progress").delete().eq("user_id", userId);
  // profiles has ON DELETE CASCADE from auth.users FK — will be removed below

  // ── Delete the auth user (requires service role) ─────────────────────────
  // The Admin API deletes the auth.users record which cascades to profiles.
  const adminClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);

  if (deleteError) {
    console.error("[deleteAccount] Failed to delete auth user:", deleteError);
    return errorResponse("Failed to delete account. Please try again later.", 500);
  }

  return jsonResponse({ deleted: true, user_id: userId });
});
