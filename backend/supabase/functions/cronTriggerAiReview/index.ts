// =============================================================================
// Edge Function: cronTriggerAiReview
//
// POST /functions/v1/cronTriggerAiReview
// Auth: x-cron-secret header must match CRON_SECRET env.
// Body: { level_id: string }
//
// Triggers AI review for a level using the shared two-phase review pipeline:
//   Phase 1 — deterministic structural checks (no LLM required)
//   Phase 2 — LLM advisory per-clue scoring (LLM scores clues; code decides pass/fail)
//
// The pass/fail decision is NEVER delegated to the LLM.
// =============================================================================

import { handleCors, errorResponse, jsonResponse } from "../_shared/cors.ts";
import { serviceClient, isValidUUID } from "../_shared/auth.ts";
import {
  runDeterministicChecks,
  runLlmAdvisoryReview,
  makeReviewDecision,
  type CluesJson as ReviewCluesJson,
  type GridJson as ReviewGridJson,
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

  const clues = level.clues_json as ReviewCluesJson;
  const grid = level.grid_json as ReviewGridJson;
  const ollamaBaseUrl = Deno.env.get("OLLAMA_BASE_URL") ?? "http://ollama:11434";
  const ollamaModel = Deno.env.get("OLLAMA_MODEL") ?? "qwen2.5:3b";

  // ── Phase 1: Deterministic checks ────────────────────────────────────────
  const detResult = runDeterministicChecks(clues, grid);
  console.log(
    `[cronTriggerAiReview] ${id}: deterministic ${detResult.passed ? "PASS" : "FAIL"} — ` +
    `${detResult.failures.length} failures`,
  );

  if (!detResult.passed) {
    // Reject immediately — no LLM call
    const decision = makeReviewDecision(detResult, null);
    await db.from("levels").update({
      review_status: "rejected",
      ai_review_notes: decision.feedback,
      ai_reviewed_at: new Date().toISOString(),
      ai_review_score: 0,
      deterministic_failures: detResult.failures,
      llm_raw_response: null,
      llm_clue_scores: null,
      review_rejected_by: "deterministic",
    }).eq("id", id);

    return jsonResponse({
      passed: false,
      score: 0,
      issues: decision.issues,
      feedback: decision.feedback,
      review_status: "rejected",
      rejected_by: "deterministic",
    });
  }

  // ── Phase 2: LLM advisory review ─────────────────────────────────────────
  let llmResult;
  try {
    llmResult = await runLlmAdvisoryReview(clues, ollamaBaseUrl, ollamaModel, 240_000);
    console.log(
      `[cronTriggerAiReview] ${id}: LLM avg=${llmResult.avgScore} low=${llmResult.lowCount} ` +
      `→ ${llmResult.passed ? "PASS" : "FAIL"}`,
    );
  } catch (e) {
    console.error("[cronTriggerAiReview] LLM advisory error:", e);
    // On LLM failure, revert to pending — do not permanently reject
    await db.from("levels").update({ review_status: "pending" }).eq("id", id);
    return errorResponse("AI review service unavailable", 503);
  }

  const decision = makeReviewDecision(detResult, llmResult);
  const newStatus = decision.passed ? "pending" : "rejected";
  const aiNotes =
    decision.feedback +
    (decision.issues.length > 0
      ? "\n\nSorunlar: " + decision.issues.slice(0, 5).join(", ")
      : "");

  const { error: updateErr } = await db.from("levels").update({
    review_status: newStatus,
    ai_review_notes: aiNotes,
    ai_reviewed_at: new Date().toISOString(),
    ai_review_score: decision.score,
    deterministic_failures: detResult.failures,
    llm_raw_response: llmResult.rawResponse ?? null,
    llm_clue_scores: llmResult.clueScores ?? null,
    review_rejected_by: decision.rejectedBy ?? null,
  }).eq("id", id);

  if (updateErr) {
    console.error("[cronTriggerAiReview] update error:", updateErr);
    return errorResponse("Failed to save AI review result", 500);
  }

  return jsonResponse({
    passed: decision.passed,
    score: decision.score,
    issues: decision.issues,
    feedback: decision.feedback,
    review_status: newStatus,
    rejected_by: decision.rejectedBy ?? null,
  });
}
