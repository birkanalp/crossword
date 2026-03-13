// =============================================================================
// Edge Function: revealLetter
//
// POST /functions/v1/revealLetter
// Body: { level_id: string, row: number, col: number }
//
// Returns { letter: string } — the correct letter at the given cell.
// Used by the hint flow (rewarded ad or coin spend) — client never receives
// full answers; only this single letter for the chosen cell.
// =============================================================================

import { handleCors, errorResponse, jsonResponse } from "../_shared/cors.ts";
import { isValidUUID, serviceClient } from "../_shared/auth.ts";
import { toTurkishUpper } from "../_shared/text.ts";

interface ClueRecord {
  number: number;
  answer_length: number;
  start: { row: number; col: number };
  answer?: string;
}

interface CluesJson {
  across: ClueRecord[];
  down: ClueRecord[];
}

Deno.serve(async (req: Request): Promise<Response> => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  let body: { level_id?: string; row?: number; col?: number };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  const { level_id, row, col } = body;
  if (!isValidUUID(level_id ?? "")) {
    return errorResponse("Invalid level_id", 400);
  }
  if (!Number.isInteger(row) || !Number.isInteger(col) || row! < 0 || col! < 0) {
    return errorResponse("Invalid row or col (must be non-negative integers)", 400);
  }

  const db = serviceClient();
  const { data: level, error } = await db
    .from("levels")
    .select("clues_json")
    .eq("id", level_id!)
    .eq("review_status", "approved")
    .is("deleted_at", null)
    .single();

  if (error || !level) {
    return errorResponse("Level not found", 404);
  }

  const cluesJson = level.clues_json as CluesJson;
  const r = row!;
  const c = col!;

  for (const clue of [...(cluesJson.across ?? []), ...(cluesJson.down ?? [])]) {
    if (!clue.answer || !clue.start) continue;

    const { row: sr, col: sc } = clue.start;
    const len = clue.answer_length ?? clue.answer.length;

    let idx = -1;
    if (r === sr && c >= sc && c < sc + len) {
      idx = c - sc;
    } else if (c === sc && r >= sr && r < sr + len) {
      idx = r - sr;
    }
    if (idx >= 0 && idx < clue.answer.length) {
      const letter = toTurkishUpper(clue.answer[idx]!);
      return jsonResponse({ letter });
    }
  }

  return errorResponse("Cell not found in any clue", 404);
});
