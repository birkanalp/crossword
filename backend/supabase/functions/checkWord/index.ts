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
import { getCallerIdentity, isValidUUID, serviceClient } from "../_shared/auth.ts";
import type { CheckWordRequest } from "../_shared/types.ts";

interface ClueRecord {
  number: number;
  answer_length: number;
  start: { row: number; col: number };
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

  let body: CheckWordRequest;
  try {
    body = (await req.json()) as CheckWordRequest;
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  const { level_id, clue_number, direction, word, request_id, state_json, time_spent, hints_used, mistakes } = body;

  if (!isValidUUID(level_id)) {
    return errorResponse("Invalid level_id", 400);
  }
  if (!Number.isInteger(clue_number) || !["across", "down"].includes(direction)) {
    return errorResponse("Invalid clue_number or direction", 400);
  }
  if (typeof word !== "string" || word.trim().length === 0) {
    return errorResponse("Invalid word", 400);
  }
  if (request_id !== undefined && (!isValidUUID(request_id))) {
    return errorResponse("request_id must be a UUID v4", 400);
  }
  if (state_json !== undefined && (typeof state_json !== "object" || state_json === null || Array.isArray(state_json))) {
    return errorResponse("state_json must be an object", 400);
  }
  if (time_spent !== undefined && (!Number.isInteger(time_spent) || time_spent < 0)) {
    return errorResponse("time_spent must be a non-negative integer", 400);
  }
  if (hints_used !== undefined && (!Number.isInteger(hints_used) || hints_used < 0)) {
    return errorResponse("hints_used must be a non-negative integer", 400);
  }
  if (mistakes !== undefined && (!Number.isInteger(mistakes) || mistakes < 0)) {
    return errorResponse("mistakes must be a non-negative integer", 400);
  }

  const db = serviceClient();
  const identity = await getCallerIdentity(req);

  const { data: level, error } = await db
    .from("levels")
    .select("clues_json")
    .eq("id", level_id)
    .eq("review_status", "approved")
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

  const normalizedWord = word.trim().toUpperCase();
  const correct = clue.answer.trim().toUpperCase() === normalizedWord;

  if ((identity.userId || identity.guestId) && clue.start) {
    const ownerColumn = identity.userId ? "user_id" : "guest_id";
    const ownerValue = identity.userId ?? identity.guestId;
    const requestId = request_id ?? (await deterministicRequestId([
      ownerColumn,
      ownerValue ?? "",
      level_id,
      String(clue_number),
      direction,
      normalizedWord,
    ].join(":")));

    const { data: existingProgress } = await db
      .from("user_progress")
      .select("state_json, completed_at, time_spent, hints_used, mistakes")
      .eq(ownerColumn, ownerValue)
      .eq("level_id", level_id)
      .maybeSingle();

    const mergedState = buildMergedState({
      fallbackState: existingProgress?.state_json,
      clientState: state_json,
      clue,
      direction,
      normalizedWord,
      correct,
    });

    const { error: persistError } = await db.rpc("record_checkword_progress", {
      p_user_id: identity.userId,
      p_guest_id: identity.guestId,
      p_level_id: level_id,
      p_request_id: requestId,
      p_state_json: mergedState,
      p_time_spent: time_spent ?? existingProgress?.time_spent ?? 0,
      p_hints_used: hints_used ?? existingProgress?.hints_used ?? 0,
      p_mistakes: mistakes ?? existingProgress?.mistakes ?? 0,
      p_clue_number: clue_number,
      p_direction: direction,
      p_submitted_word: normalizedWord,
      p_is_correct: correct,
    });

    if (persistError) {
      console.error("[checkWord] Failed to persist check result:", persistError);
      return errorResponse("Failed to persist progress", 500);
    }
  }

  return jsonResponse({ correct });
});

function buildMergedState(params: {
  fallbackState: unknown;
  clientState: Record<string, unknown> | undefined;
  clue: ClueRecord;
  direction: "across" | "down";
  normalizedWord: string;
  correct: boolean;
}): Record<string, string> {
  const base = toFilledCells(params.clientState ?? params.fallbackState);
  if (!params.correct) {
    return base;
  }

  const letters = params.normalizedWord.split("");
  const expectedLength = params.clue.answer_length;
  const clueLength = Number.isInteger(expectedLength) && expectedLength > 0 ? expectedLength : letters.length;

  for (let i = 0; i < clueLength && i < letters.length; i++) {
    const row = params.clue.start.row + (params.direction === "down" ? i : 0);
    const col = params.clue.start.col + (params.direction === "across" ? i : 0);
    base[`${row}-${col}`] = letters[i] ?? "";
  }
  return base;
}

function toFilledCells(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  const entries = Object.entries(value as Record<string, unknown>);
  const cells: Record<string, string> = {};
  for (const [key, cellValue] of entries) {
    if (typeof cellValue === "string") {
      cells[key] = cellValue;
    }
  }
  return cells;
}

async function deterministicRequestId(seed: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(seed));
  const bytes = Array.from(new Uint8Array(digest)).slice(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}
