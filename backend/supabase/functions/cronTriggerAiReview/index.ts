// =============================================================================
// Edge Function: cronTriggerAiReview
//
// POST /functions/v1/cronTriggerAiReview
// Auth: x-cron-secret header must match CRON_SECRET env.
// Body: { level_id: string }
//
// Triggers AI review for a level using the shared two-phase review pipeline:
//   Phase 1 — deterministic structural checks (no OpenAI call required)
//   Phase 2 — OpenAI advisory per-clue scoring (model scores clues; code decides pass/fail)
//
// The pass/fail decision is NEVER delegated to the model.
// =============================================================================

import { handleCors, errorResponse, jsonResponse } from "../_shared/cors.ts";
import { serviceClient, isValidUUID } from "../_shared/auth.ts";
import {
  runDeterministicChecks,
  runOpenAIReview,
  makeReviewDecision,
  type CluesJson as ReviewCluesJson,
  type GridJson as ReviewGridJson,
  type PuzzleReviewResult,
} from "../_shared/review.ts";

Deno.serve(async (req: Request): Promise<Response> => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  const secret = req.headers.get("x-cron-secret");
  const expectedSecret = Deno.env.get("CRON_SECRET");
  if (!expectedSecret || secret !== expectedSecret) {
    return errorResponse("Unauthorized", 401);
  }

  let body: { level_id?: string };
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  const levelId = body?.level_id;
  if (!levelId || typeof levelId !== "string" || !isValidUUID(levelId)) {
    return errorResponse("level_id (UUID) required", 400);
  }

  return await runAiReview(levelId);
});

async function runAiReview(id: string): Promise<Response> {
  const db = serviceClient();

  const { data: level, error: fetchErr } = await db
    .from("levels")
    .select("id, version, difficulty, grid_json, clues_json, review_status")
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (fetchErr || !level) {
    return errorResponse("Level not found", 404);
  }

  if (!["pending", "ai_review"].includes(level.review_status)) {
    return errorResponse("Level must be in pending or ai_review status", 400);
  }

  // Atomic status lock: only update if status is still pending/ai_review
  const { data: locked } = await db
    .from("levels")
    .update({ review_status: "ai_review", updated_at: new Date().toISOString() })
    .eq("id", id)
    .in("review_status", ["pending", "ai_review"])
    .select("id")
    .single();

  if (!locked) {
    return errorResponse("Level is being reviewed by another process", 409);
  }

  const clues         = level.clues_json as ReviewCluesJson;
  const grid          = level.grid_json as ReviewGridJson;
  const openaiApiKey  = Deno.env.get("OPENAI_API_KEY") ?? "";
  const openaiModel   = Deno.env.get("OPENAI_REVIEW_MODEL") ?? "gpt-4o-mini";

  if (!openaiApiKey) {
    console.error("[cronTriggerAiReview] OPENAI_API_KEY not set");
    await db.from("levels").update({ review_status: "pending" }).eq("id", id);
    return errorResponse("AI review not configured: OPENAI_API_KEY missing", 503);
  }

  // ── Phase 1: Deterministic checks ────────────────────────────────────────
  const detResult = runDeterministicChecks(clues, grid);
  console.log(
    `[cronTriggerAiReview] ${id}: deterministic ${detResult.passed ? "PASS" : "FAIL"} — ` +
    `${detResult.failures.length} failures`,
  );

  if (!detResult.passed) {
    // Reject immediately — no OpenAI call
    const decision = makeReviewDecision(detResult, null);
    await db.from("levels").update({
      review_status:          "rejected",
      ai_review_notes:        decision.feedback,
      ai_reviewed_at:         new Date().toISOString(),
      ai_review_score:        0,
      deterministic_failures: detResult.failures,
      llm_raw_response:       null,
      llm_clue_scores:        null,
      llm_clue_reviews:       null,
      review_rejected_by:     "deterministic",
      needs_human_review:     false,
      ai_auto_fix_count:      0,
    }).eq("id", id);

    return jsonResponse({
      passed:        false,
      score:         0,
      issues:        decision.issues,
      feedback:      decision.feedback,
      review_status: "rejected",
      rejected_by:   "deterministic",
    });
  }

  // ── Phase 2: OpenAI advisory review ──────────────────────────────────────
  let reviewResult: PuzzleReviewResult;
  try {
    reviewResult = await runOpenAIReview(clues, {
      apiKey:    openaiApiKey,
      model:     openaiModel,
      timeoutMs: 90_000,
    });
    console.log(
      `[cronTriggerAiReview] ${id}: OpenAI score=${reviewResult.puzzleScore} ` +
      `fixes=${reviewResult.autoFixCount} humanReview=${reviewResult.needsHumanReview} ` +
      `hints=${reviewResult.hintGenerationEnabled} → ${reviewResult.passed ? "PASS" : "FAIL"}`,
    );
  } catch (e) {
    console.error("[cronTriggerAiReview] OpenAI advisory error:", e);
    // On OpenAI failure, revert to pending — do not permanently reject
    await db.from("levels").update({ review_status: "pending" }).eq("id", id);
    return errorResponse("AI review service unavailable", 503);
  }

  const decision  = makeReviewDecision(detResult, reviewResult);
  const newStatus = decision.passed ? "pending" : "rejected";
  const aiNotes   =
    decision.feedback +
    (decision.issues.length > 0
      ? "\n\nSorunlar: " + decision.issues.slice(0, 5).join(", ")
      : "");

  // Apply auto-fixed clue texts and generated hints back to clues_json
  const newCluesJson = applyReviewToCluesJson(clues, reviewResult);

  const { error: updateErr } = await db.from("levels").update({
    review_status:          newStatus,
    ai_review_notes:        aiNotes,
    ai_reviewed_at:         new Date().toISOString(),
    ai_review_score:        decision.score,
    deterministic_failures: detResult.failures,
    llm_raw_response:       null,            // no longer stored; use llm_clue_reviews
    llm_clue_scores:        decision.llmClueScores ?? null,
    llm_clue_reviews:       reviewResult.items,
    review_rejected_by:     decision.rejectedBy ?? null,
    needs_human_review:     decision.needsHumanReview,
    ai_auto_fix_count:      decision.autoFixCount,
    clues_json:             newCluesJson,
  }).eq("id", id);

  if (updateErr) {
    console.error("[cronTriggerAiReview] update error:", updateErr);
    return errorResponse("Failed to save AI review result", 500);
  }

  return jsonResponse({
    passed:             decision.passed,
    score:              decision.score,
    issues:             decision.issues,
    feedback:           decision.feedback,
    review_status:      newStatus,
    rejected_by:        decision.rejectedBy ?? null,
    needs_human_review: decision.needsHumanReview,
    auto_fix_count:     decision.autoFixCount,
    hint_count:         reviewResult.items.filter((r) => r.hint !== null).length,
  });
}

/**
 * Apply auto-fixed clue texts and generated hints back to the clues_json structure.
 * Returns a new object — does NOT mutate the input.
 */
function applyReviewToCluesJson(
  clues: ReviewCluesJson,
  review: PuzzleReviewResult,
): ReviewCluesJson {
  const reviewMap = new Map(review.items.map((r) => [r.clueId, r]));

  const applyDir = (
    list: ReviewCluesJson["across"],
    suffix: "A" | "D",
  ): ReviewCluesJson["across"] =>
    list.map((c) => {
      const r = reviewMap.get(`${c.number}${suffix}`);
      if (!r) return c;
      const updated: typeof c = { ...c };
      if (r.fixedClue) updated.question = r.fixedClue;
      if (r.hint)      updated.hint     = r.hint;
      return updated;
    });

  return {
    across: applyDir(clues.across ?? [], "A"),
    down:   applyDir(clues.down   ?? [], "D"),
  };
}
