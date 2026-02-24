// =============================================================================
// Edge Function: checkWord
//
// POST /functions/v1/checkWord
// Body: { level_id: string, clue_number: number, direction: "across" | "down", word: string }
//
// Returns { correct: boolean }
// The actual answers are never exposed to the client; only a boolean is returned.
// =============================================================================

import { handleCors, errorResponse, jsonResponse } from "../_shared/cors.ts";
import { isValidUUID, serviceClient } from "../_shared/auth.ts";

interface CheckWordBody {
  level_id: string;
  clue_number: number;
  direction: "across" | "down";
  word: string;
}

interface ClueRecord {
  number: number;
  answer?: string;
  [key: string]: unknown;
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

  let body: CheckWordBody;
  try {
    body = (await req.json()) as CheckWordBody;
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  const { level_id, clue_number, direction, word } = body;

  if (!isValidUUID(level_id)) {
    return errorResponse("Invalid level_id", 400);
  }
  if (typeof clue_number !== "number" || !["across", "down"].includes(direction)) {
    return errorResponse("Invalid clue_number or direction", 400);
  }
  if (typeof word !== "string" || word.length === 0) {
    return errorResponse("Invalid word", 400);
  }

  const db = serviceClient();

  const { data: level, error } = await db
    .from("levels")
    .select("clues_json")
    .eq("id", level_id)
    .is("deleted_at", null)
    .single();

  if (error || !level) {
    return errorResponse("Level not found", 404);
  }

  const cluesJson = level.clues_json as CluesJson;
  const clueList = direction === "across" ? cluesJson.across : cluesJson.down;
  const clue = clueList?.find((c) => c.number === clue_number);

  if (!clue?.answer) {
    return errorResponse("Clue not found", 404);
  }

  const correct = clue.answer.toUpperCase() === word.trim().toUpperCase();
  return jsonResponse({ correct });
});
