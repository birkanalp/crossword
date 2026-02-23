// =============================================================================
// Edge Function: mergeGuestProgress
//
// POST /functions/v1/mergeGuestProgress
// Body: { guest_id: string }
// Auth: Bearer JWT (authenticated user only)
//
// Merges guest progress rows into the authenticated user's account.
//
// Algorithm (per level):
//   - If user has NO existing progress for a level → adopt the guest row
//   - If BOTH exist → keep whichever has the later updated_at
//     (or the completed one if the other is not completed)
//   - After merge → null out guest_id on adopted rows; delete leftovers
// =============================================================================

import { handleCors, errorResponse, jsonResponse } from "../_shared/cors.ts";
import { getCallerIdentity, serviceClient } from "../_shared/auth.ts";
import { isValidUUID } from "../_shared/auth.ts";
import type { MergeGuestRequest, MergeGuestResponse } from "../_shared/types.ts";

Deno.serve(async (req: Request): Promise<Response> => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  // ── Must be an authenticated user ─────────────────────────────────────────
  const identity = await getCallerIdentity(req);
  if (!identity.isAuthenticated || !identity.userId) {
    return errorResponse("Authentication required", 401);
  }
  const userId = identity.userId;

  // ── Parse body ─────────────────────────────────────────────────────────────
  let body: MergeGuestRequest;
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  const { guest_id } = body;
  if (!guest_id || !isValidUUID(guest_id)) {
    return errorResponse("Invalid or missing guest_id", 400);
  }

  const db = serviceClient();

  // ── Fetch guest progress rows ──────────────────────────────────────────────
  const { data: guestRows, error: guestError } = await db
    .from("user_progress")
    .select("*")
    .eq("guest_id", guest_id);

  if (guestError) {
    console.error("[mergeGuestProgress] Error fetching guest rows:", guestError);
    return errorResponse("Failed to fetch guest progress", 500);
  }

  if (!guestRows || guestRows.length === 0) {
    return jsonResponse({ merged_count: 0, skipped_count: 0 } satisfies MergeGuestResponse);
  }

  // ── Fetch user's existing progress for the same levels ────────────────────
  const guestLevelIds = guestRows.map((r) => r.level_id);

  const { data: userRows, error: userError } = await db
    .from("user_progress")
    .select("*")
    .eq("user_id", userId)
    .in("level_id", guestLevelIds);

  if (userError) {
    console.error("[mergeGuestProgress] Error fetching user rows:", userError);
    return errorResponse("Failed to fetch user progress", 500);
  }

  const userProgressByLevel = new Map(
    (userRows ?? []).map((r) => [r.level_id, r]),
  );

  let mergedCount = 0;
  let skippedCount = 0;

  const rowsToAdopt: string[] = [];   // guest row IDs to claim
  const rowsToDelete: string[] = [];  // guest row IDs to discard

  for (const guestRow of guestRows) {
    const userRow = userProgressByLevel.get(guestRow.level_id);

    if (!userRow) {
      // No conflict: adopt the guest row
      rowsToAdopt.push(guestRow.id);
      mergedCount++;
    } else {
      // Conflict resolution: prefer completed > in-progress, then newer updated_at
      const guestWins = shouldPreferGuest(guestRow, userRow);

      if (guestWins) {
        // Replace user row with guest data, then delete guest row
        await db
          .from("user_progress")
          .update({
            state_json:   guestRow.state_json,
            completed_at: guestRow.completed_at,
            time_spent:   guestRow.time_spent,
            mistakes:     guestRow.mistakes,
            hints_used:   guestRow.hints_used,
            updated_at:   new Date().toISOString(),
          })
          .eq("id", userRow.id);

        rowsToDelete.push(guestRow.id);
        mergedCount++;
      } else {
        // User row wins; discard guest row
        rowsToDelete.push(guestRow.id);
        skippedCount++;
      }
    }
  }

  // ── Bulk adopt: set user_id, clear guest_id ───────────────────────────────
  if (rowsToAdopt.length > 0) {
    const { error: adoptError } = await db
      .from("user_progress")
      .update({ user_id: userId, guest_id: null })
      .in("id", rowsToAdopt);

    if (adoptError) {
      console.error("[mergeGuestProgress] Adopt failed:", adoptError);
      return errorResponse("Failed during progress adoption", 500);
    }
  }

  // ── Bulk delete leftover guest rows ───────────────────────────────────────
  if (rowsToDelete.length > 0) {
    await db
      .from("user_progress")
      .delete()
      .in("id", rowsToDelete);
  }

  const response: MergeGuestResponse = { merged_count: mergedCount, skipped_count: skippedCount };
  return jsonResponse(response);
});

// ---------------------------------------------------------------------------
// Conflict resolution: returns true if guest row should win over user row
// ---------------------------------------------------------------------------
function shouldPreferGuest(
  guestRow: Record<string, unknown>,
  userRow: Record<string, unknown>,
): boolean {
  const guestCompleted = guestRow.completed_at !== null;
  const userCompleted  = userRow.completed_at  !== null;

  // A completed entry always beats an in-progress one
  if (guestCompleted && !userCompleted) return true;
  if (!guestCompleted && userCompleted)  return false;

  // Both same completion status → prefer the more recently updated
  const guestUpdated = new Date(guestRow.updated_at as string).getTime();
  const userUpdated  = new Date(userRow.updated_at  as string).getTime();
  return guestUpdated > userUpdated;
}
