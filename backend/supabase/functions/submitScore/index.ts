// =============================================================================
// Edge Function: submitScore
//
// POST /functions/v1/submitScore
// Body: SubmitScoreRequest (JSON)
//
// Flow:
//   1. Authenticate caller (must be a registered user; guests cannot submit)
//   2. Fetch level metadata (answer_hash, difficulty, version)
//   3. Run anti-cheat validation (hash + time + hint sanity)
//   4. Compute score server-side (client score is NEVER used)
//   5. Upsert leaderboard_entries (keep best score)
//   6. Mark user_progress as completed
//   7. Update streak + award coins
//   8. Return { score, rank, is_new_best }
// =============================================================================

import { handleCors, errorResponse, jsonResponse } from "../_shared/cors.ts";
import { getCallerIdentity, serviceClient } from "../_shared/auth.ts";
import { isValidUUID } from "../_shared/auth.ts";
import { validateSubmission } from "../_shared/anticheat.ts";
import { computeScore } from "../_shared/scoring.ts";
import type { SubmitScoreRequest, SubmitScoreResponse, Difficulty } from "../_shared/types.ts";

// Coins awarded per completion
const COINS_PER_COMPLETION: Record<Difficulty, number> = {
  easy:   10,
  medium: 20,
  hard:   35,
  expert: 50,
};

Deno.serve(async (req: Request): Promise<Response> => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  // ── Auth: only registered users can submit scores ─────────────────────────
  const identity = await getCallerIdentity(req);
  if (!identity.isAuthenticated || !identity.userId) {
    return errorResponse("Authentication required to submit a score", 401);
  }
  const userId = identity.userId;

  // ── Parse body ─────────────────────────────────────────────────────────────
  let body: SubmitScoreRequest;
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  const { level_id, answers, time_spent, hints_used, mistakes } = body;

  // Basic input validation
  if (!isValidUUID(level_id)) return errorResponse("Invalid level_id", 400);
  if (typeof answers !== "object" || Array.isArray(answers) || answers === null) {
    return errorResponse("answers must be a key-value map", 400);
  }
  if (!Number.isInteger(time_spent) || time_spent <= 0) {
    return errorResponse("time_spent must be a positive integer", 400);
  }
  if (!Number.isInteger(hints_used) || hints_used < 0) {
    return errorResponse("hints_used must be a non-negative integer", 400);
  }
  if (!Number.isInteger(mistakes) || mistakes < 0) {
    return errorResponse("mistakes must be a non-negative integer", 400);
  }

  // Limit answer map size to prevent DoS
  if (Object.keys(answers).length > 200) {
    return errorResponse("Too many answers", 400);
  }

  const db = serviceClient();

  // ── Fetch level ────────────────────────────────────────────────────────────
  const { data: level, error: levelError } = await db
    .from("levels")
    .select("id, version, difficulty, is_premium, answer_hash, difficulty_multiplier, deleted_at")
    .eq("id", level_id)
    .single();

  if (levelError || !level || level.deleted_at) {
    return errorResponse("Level not found", 404);
  }

  // ── Anti-cheat ────────────────────────────────────────────────────────────
  const antiCheat = await validateSubmission({
    levelId: level.id,
    version: level.version,
    difficulty: level.difficulty as Difficulty,
    storedHash: level.answer_hash,
    clientAnswers: answers,
    timeSpent: time_spent,
    hintsUsed: hints_used,
    mistakes,
  });

  if (!antiCheat.valid) {
    console.warn(`[submitScore] Anti-cheat failed for user=${userId} level=${level_id}: ${antiCheat.reason}`);
    return errorResponse(`Submission rejected: ${antiCheat.reason}`, 422);
  }

  // ── Compute score server-side ──────────────────────────────────────────────
  const newScore = computeScore({
    difficulty_multiplier: Number(level.difficulty_multiplier),
    time_spent,
    hints_used,
  });

  // ── Check existing leaderboard entry ──────────────────────────────────────
  const { data: existingEntry } = await db
    .from("leaderboard_entries")
    .select("id, score")
    .eq("user_id", userId)
    .eq("level_id", level_id)
    .maybeSingle();

  const isNewBest = !existingEntry || newScore > existingEntry.score;

  // ── Upsert leaderboard entry (only on improvement) ────────────────────────
  if (isNewBest) {
    const { error: upsertError } = await db
      .from("leaderboard_entries")
      .upsert(
        {
          user_id:         userId,
          level_id:        level_id,
          score:           newScore,
          completion_time: time_spent,
          hints_used:      hints_used,
          mistakes:        mistakes,
        },
        { onConflict: "user_id,level_id" },
      );

    if (upsertError) {
      console.error("[submitScore] Leaderboard upsert failed:", upsertError);
      return errorResponse("Failed to record score", 500);
    }
  }

  // ── Mark progress as completed ────────────────────────────────────────────
  const now = new Date().toISOString();
  await db
    .from("user_progress")
    .upsert(
      {
        user_id:      userId,
        guest_id:     null,
        level_id:     level_id,
        state_json:   {},           // clear in-progress state on completion
        completed_at: now,
        time_spent:   time_spent,
        hints_used:   hints_used,
        mistakes:     mistakes,
        updated_at:   now,
      },
      { onConflict: "user_id,level_id" },
    );

  // ── Update streak ─────────────────────────────────────────────────────────
  await updateStreak(db, userId);

  // ── Award coins ───────────────────────────────────────────────────────────
  if (isNewBest) {
    const coinAmount = COINS_PER_COMPLETION[level.difficulty as Difficulty] ?? 10;
    await awardCoins(db, userId, coinAmount, level_id);
  }

  // ── Compute user rank ─────────────────────────────────────────────────────
  const rank = await getUserRank(db, level_id, newScore);

  const response: SubmitScoreResponse = {
    score:       newScore,
    rank,
    is_new_best: isNewBest,
  };

  return jsonResponse(response);
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function updateStreak(db: ReturnType<typeof serviceClient>, userId: string): Promise<void> {
  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

  const { data: streak } = await db
    .from("streaks")
    .select("current_streak, longest_streak, last_completed_date")
    .eq("user_id", userId)
    .maybeSingle();

  if (!streak) {
    // First ever completion
    await db.from("streaks").insert({
      user_id:             userId,
      current_streak:      1,
      longest_streak:      1,
      last_completed_date: today,
    });
    return;
  }

  const last = streak.last_completed_date;

  if (last === today) return; // already updated today

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split("T")[0];

  const newCurrent = last === yesterdayStr ? streak.current_streak + 1 : 1;
  const newLongest = Math.max(newCurrent, streak.longest_streak);

  await db
    .from("streaks")
    .update({
      current_streak:      newCurrent,
      longest_streak:      newLongest,
      last_completed_date: today,
    })
    .eq("user_id", userId);
}

async function awardCoins(
  db: ReturnType<typeof serviceClient>,
  userId: string,
  amount: number,
  levelId: string,
): Promise<void> {
  // Upsert coin wallet
  await db
    .from("coins")
    .upsert({ user_id: userId, balance: amount }, { onConflict: "user_id" });

  // If wallet already exists, increment balance
  await db.rpc("increment_coins", { p_user_id: userId, p_amount: amount });

  // Append to ledger
  await db.from("coin_transactions").insert({
    user_id:  userId,
    amount,
    type:     "earn",
    metadata: { source: "level_completion", level_id: levelId },
  });
}

async function getUserRank(
  db: ReturnType<typeof serviceClient>,
  levelId: string,
  score: number,
): Promise<number> {
  // Count how many users have a strictly higher score → rank = that count + 1
  const { count } = await db
    .from("leaderboard_entries")
    .select("*", { count: "exact", head: true })
    .eq("level_id", levelId)
    .gt("score", score);

  return (count ?? 0) + 1;
}
