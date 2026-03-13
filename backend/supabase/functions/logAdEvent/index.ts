// =============================================================================
// Edge Function: logAdEvent
//
// Fire-and-forget ad event logging endpoint.
// Accepts POST from mobile clients and inserts into ad_events table.
// No auth required — supports both authenticated users and anonymous guests.
// Always returns 200 to prevent client retry storms.
// =============================================================================

import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { getCallerIdentity, isValidUUID, serviceClient } from "../_shared/auth.ts";

const VALID_EVENT_TYPES = new Set(["started", "completed", "skipped", "failed"]);
const VALID_ACTION_TYPES = new Set(["reveal_letter", "show_hint"]);
const VALID_PLATFORMS = new Set(["ios", "android"]);

Deno.serve(async (req: Request): Promise<Response> => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method not allowed" }, 405);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json() as Record<string, unknown>;
  } catch {
    return jsonResponse({ ok: false, error: "Invalid JSON body" }, 400);
  }

  // Validate required fields
  const eventType = body.event_type as string | undefined;
  const actionType = body.action_type as string | undefined;
  const adUnitId = body.ad_unit_id as string | undefined;

  if (!eventType || !VALID_EVENT_TYPES.has(eventType)) {
    return jsonResponse({ ok: false, error: "Invalid event_type" }, 400);
  }
  if (!actionType || !VALID_ACTION_TYPES.has(actionType)) {
    return jsonResponse({ ok: false, error: "Invalid action_type" }, 400);
  }
  if (!adUnitId || typeof adUnitId !== "string") {
    return jsonResponse({ ok: false, error: "ad_unit_id required" }, 400);
  }

  // Optional fields
  const levelId = (typeof body.level_id === "string" && isValidUUID(body.level_id))
    ? body.level_id
    : null;
  const platform = (typeof body.platform === "string" && VALID_PLATFORMS.has(body.platform))
    ? body.platform
    : null;

  // Resolve caller identity
  const caller = await getCallerIdentity(req);
  const userId = caller.userId ?? null;
  const guestId = caller.guestId ?? (
    typeof body.guest_id === "string" && isValidUUID(body.guest_id)
      ? body.guest_id
      : null
  );

  // Insert using service role (bypasses RLS for simplicity; caller verified above)
  const db = serviceClient();
  await db.from("ad_events").insert({
    user_id: userId,
    guest_id: guestId,
    event_type: eventType,
    action_type: actionType,
    level_id: levelId,
    ad_unit_id: adUnitId,
    platform,
  });

  // Always return 200 — fire-and-forget; client does not need to retry
  return jsonResponse({ ok: true });
});
