/**
 * trigger-ai-reviews.ts
 *
 * Daily cron script that:
 * 1. Checks ai_review_cron_enabled in app_settings (defaults to enabled if missing)
 * 2. Bulk-moves pending (ai_reviewed_at IS NULL) puzzles → ai_review
 * 3. Fetches all ai_review puzzles and calls cronTriggerAiReview for each sequentially
 *
 * Usage: npx tsx scripts/cron/trigger-ai-reviews.ts
 * Scheduled via docker/cron/crontab at 03:00 daily.
 */

import { createPool } from "../tr/_shared";

const pool = createPool();

async function main() {
  const client = await pool.connect();
  try {
    // 1. Check ai_review_cron_enabled setting
    const settingRes = await client.query<{ value: unknown }>(
      "SELECT value FROM app_settings WHERE key = 'ai_review_cron_enabled'"
    );
    const settingValue = settingRes.rows[0]?.value;
    if (settingValue === false || settingValue === "false") {
      console.log("[ai-review-cron] Disabled via app_settings. Exiting.");
      return;
    }

    // 2. Bulk-move pending (never reviewed) → ai_review
    const moveRes = await client.query(
      `UPDATE levels
       SET review_status = 'ai_review', updated_at = now()
       WHERE review_status = 'pending'
         AND ai_reviewed_at IS NULL
         AND deleted_at IS NULL`
    );
    console.log(`[ai-review-cron] Moved ${moveRes.rowCount ?? 0} pending → ai_review`);

    // 3. Fetch all ai_review puzzles (including ones already in that state before this run)
    const puzzlesRes = await client.query<{ id: string }>(
      `SELECT id FROM levels
       WHERE review_status = 'ai_review'
         AND deleted_at IS NULL
       ORDER BY created_at ASC`
    );
    const puzzles = puzzlesRes.rows;
    console.log(`[ai-review-cron] Processing ${puzzles.length} puzzles`);

    if (puzzles.length === 0) {
      return;
    }

    const url =
      process.env.CRON_TRIGGER_AI_URL ??
      "http://kong:8000/functions/v1/cronTriggerAiReview";
    const secret = process.env.CRON_SECRET ?? "cron-trigger-ai-secret";

    // 4. Process each puzzle sequentially to avoid overwhelming Ollama
    for (const { id } of puzzles) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-cron-secret": secret,
          },
          body: JSON.stringify({ level_id: id }),
        });
        console.log(`[ai-review-cron] ${id} → HTTP ${res.status}`);
      } catch (e) {
        console.error(`[ai-review-cron] ${id} failed:`, e);
      }
      // Pause between calls to avoid overwhelming Ollama
      await new Promise((r) => setTimeout(r, 3000));
    }

    console.log("[ai-review-cron] Done.");
  } finally {
    client.release();
  }
}

main()
  .catch(console.error)
  .finally(() => pool.end());
