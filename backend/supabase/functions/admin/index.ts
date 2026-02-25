// =============================================================================
// Edge Function: admin
//
// Admin-only endpoints for puzzle moderation and metrics dashboard.
// All routes require JWT with app_metadata.role = 'admin'.
//
// Routes:
//   GET  /admin/puzzles              -> list puzzles (status, page, limit)
//   GET  /admin/puzzles/:id          -> get puzzle detail (with answers/hints)
//   PATCH /admin/puzzles/:id/clues/:clueKey -> update clue text/answer/hint
//   POST /admin/puzzles/:id/decision  -> approve or reject
//   GET  /admin/metrics/overview      -> daily_plays, total_users, paid_users, active_users_15min
//   GET  /admin/metrics/daily         -> time series (from, to)
// =============================================================================

import { handleCors, errorResponse, jsonResponse } from "../_shared/cors.ts";
import { requireAdmin, isValidUUID, serviceClient } from "../_shared/auth.ts";
import { computeLevelAnswerHash } from "../_shared/anticheat.ts";

interface ClueRecord {
  number: number;
  clue: string;
  answer_length: number;
  start: { row: number; col: number };
  answer?: string;
  hint?: string;
}

interface CluesJson {
  across: ClueRecord[];
  down: ClueRecord[];
}

function extractSubPath(pathname: string): string {
  const m = pathname.match(/\/admin(?:\/(.*))?$/);
  return m ? "/" + (m[1] ?? "") : "/";
}

function parseRoute(pathname: string): { route: string; id?: string; clueKey?: string } {
  const sub = extractSubPath(pathname).replace(/^\//, "");
  const parts = sub ? sub.split("/") : [];
  if (parts[0] === "puzzles") {
    if (parts[1] && isValidUUID(parts[1])) {
      if (parts[2] === "clues" && parts[3]) return { route: "patchClue", id: parts[1], clueKey: parts[3] };
      if (parts[2] === "decision") return { route: "decision", id: parts[1] };
      return { route: "getPuzzle", id: parts[1] };
    }
    return { route: "listPuzzles" };
  }
  if (parts[0] === "metrics") {
    if (parts[1] === "overview") return { route: "metricsOverview" };
    if (parts[1] === "daily") return { route: "metricsDaily" };
  }
  return { route: "unknown" };
}

Deno.serve(async (req: Request): Promise<Response> => {
  const cors = handleCors(req);
  if (cors) return cors;

  const admin = await requireAdmin(req);
  if (!admin) {
    return errorResponse("Admin role required", 403);
  }

  const url = new URL(req.url);
  const { route, id, clueKey } = parseRoute(url.pathname);

  try {
    if (route === "listPuzzles" && req.method === "GET") {
      return await handleListPuzzles(url);
    }
    if (route === "getPuzzle" && req.method === "GET" && id) {
      return await handleGetPuzzle(id);
    }
    if (route === "patchClue" && req.method === "PATCH" && id && clueKey) {
      return await handlePatchClue(id, clueKey, req);
    }
    if (route === "decision" && req.method === "POST" && id) {
      return await handleDecision(id, req);
    }
    if (route === "metricsOverview" && req.method === "GET") {
      return await handleMetricsOverview();
    }
    if (route === "metricsDaily" && req.method === "GET") {
      return await handleMetricsDaily(url);
    }
  } catch (e) {
    console.error("[admin]", e);
    return errorResponse("Internal server error", 500);
  }

  return errorResponse("Not found", 404);
});

// ---------------------------------------------------------------------------
// GET /admin/puzzles
// ---------------------------------------------------------------------------
async function handleListPuzzles(url: URL): Promise<Response> {
  const status = url.searchParams.get("status") ?? undefined;
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "20", 10)));
  const offset = (page - 1) * limit;

  const db = serviceClient();
  let query = db
    .from("levels")
    .select("id, difficulty, language, review_status, created_at", { count: "exact" })
    .is("deleted_at", null);

  if (status && ["pending", "approved", "rejected"].includes(status)) {
    query = query.eq("review_status", status);
  }

  const { data: rows, error, count } = await query
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error("[admin] listPuzzles:", error);
    return errorResponse("Failed to fetch puzzles", 500);
  }

  const items = (rows ?? []).map((r) => ({
    id: r.id,
    difficulty: r.difficulty,
    language: r.language ?? "tr",
    review_status: r.review_status,
    created_at: r.created_at,
  }));

  return jsonResponse({ items, total: count ?? 0 });
}

// ---------------------------------------------------------------------------
// GET /admin/puzzles/:id
// ---------------------------------------------------------------------------
async function handleGetPuzzle(id: string): Promise<Response> {
  const db = serviceClient();
  const { data: level, error } = await db
    .from("levels")
    .select(
      "id, version, difficulty, language, is_premium, grid_json, clues_json, review_status, review_notes, reviewed_by, reviewed_at",
    )
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (error || !level) {
    return errorResponse("Level not found", 404);
  }

  const clues = level.clues_json as CluesJson;
  const ensureClue = (c: ClueRecord): ClueRecord & { answer: string; hint: string } => ({
    ...c,
    answer: c.answer?.trim() || "—",
    hint: (c.hint?.trim() || "—"),
  });

  const adminLevel = {
    id: level.id,
    version: level.version,
    difficulty: level.difficulty,
    language: level.language ?? "tr",
    is_premium: level.is_premium ?? false,
    grid_json: level.grid_json,
    clues_json: {
      across: (clues?.across ?? []).map(ensureClue),
      down: (clues?.down ?? []).map(ensureClue),
    },
    review_status: level.review_status,
    review_notes: level.review_notes ?? null,
    reviewed_by: level.reviewed_by ?? null,
    reviewed_at: level.reviewed_at ?? null,
  };

  return jsonResponse({ level: adminLevel });
}

// ---------------------------------------------------------------------------
// PATCH /admin/puzzles/:id/clues/:clueKey
// ---------------------------------------------------------------------------
async function handlePatchClue(id: string, clueKey: string, req: Request): Promise<Response> {
  if (!/^[1-9][0-9]*[AD]$/i.test(clueKey)) {
    return errorResponse("Invalid clueKey format (e.g. 1A, 3D)", 400);
  }

  let body: { text?: string; answer?: string; hint?: string };
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }
  if (!body || typeof body !== "object" || Object.keys(body).length === 0) {
    return errorResponse("At least one of text, answer, hint required", 400);
  }

  const db = serviceClient();
  const { data: level, error: fetchErr } = await db
    .from("levels")
    .select("id, version, clues_json")
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (fetchErr || !level) {
    return errorResponse("Level not found", 404);
  }

  const clues = level.clues_json as CluesJson;
  const dir = clueKey.toUpperCase().endsWith("A") ? "across" : "down";
  const num = parseInt(clueKey.replace(/[AD]$/i, ""), 10);
  const list = dir === "across" ? clues?.across ?? [] : clues?.down ?? [];
  const idx = list.findIndex((c) => c.number === num);
  if (idx < 0) {
    return errorResponse("Clue not found", 404);
  }

  const updated = { ...list[idx] };
  if (body.text !== undefined) updated.clue = body.text.trim();
  if (body.answer !== undefined) updated.answer = body.answer.trim().toUpperCase();
  if (body.hint !== undefined) updated.hint = body.hint.trim();

  const newList = [...list];
  newList[idx] = updated;
  const newClues = { ...clues, [dir]: newList };

  const answers: Record<string, string> = {};
  for (const c of newClues.across ?? []) {
    if (c.answer) answers[`${c.number}A`] = c.answer;
  }
  for (const c of newClues.down ?? []) {
    if (c.answer) answers[`${c.number}D`] = c.answer;
  }

  const answerHash = await computeLevelAnswerHash(level.id, level.version, answers);

  const { error: updateErr } = await db
    .from("levels")
    .update({ clues_json: newClues, answer_hash: answerHash })
    .eq("id", id);

  if (updateErr) {
    console.error("[admin] patchClue:", updateErr);
    return errorResponse("Failed to update clue", 500);
  }

  return await handleGetPuzzle(id);
}

// ---------------------------------------------------------------------------
// POST /admin/puzzles/:id/decision
// ---------------------------------------------------------------------------
async function handleDecision(id: string, req: Request): Promise<Response> {
  let body: { action: string; review_notes?: string };
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  const action = body?.action;
  if (action !== "approve" && action !== "reject") {
    return errorResponse("action must be 'approve' or 'reject'", 400);
  }
  if (action === "reject" && (!body.review_notes || !String(body.review_notes).trim())) {
    return errorResponse("review_notes required when rejecting", 400);
  }

  const db = serviceClient();
  const admin = await requireAdmin(req);
  if (!admin) return errorResponse("Admin required", 403);

  const update: Record<string, unknown> = {
    review_status: action,
    reviewed_by: admin.userId,
    reviewed_at: new Date().toISOString(),
  };
  if (action === "reject") {
    update.review_notes = String(body.review_notes).trim();
  } else {
    update.review_notes = null;
  }

  const { error } = await db
    .from("levels")
    .update(update)
    .eq("id", id)
    .is("deleted_at", null);

  if (error) {
    console.error("[admin] decision:", error);
    return errorResponse("Failed to update review status", 500);
  }

  return jsonResponse({ success: true });
}

// ---------------------------------------------------------------------------
// GET /admin/metrics/overview
// ---------------------------------------------------------------------------
async function handleMetricsOverview(): Promise<Response> {
  const db = serviceClient();
  const today = new Date().toISOString().split("T")[0];
  const since15 = new Date(Date.now() - 15 * 60 * 1000).toISOString();

  const [dailyPlaysRes, paidUsersRes, upRes, leRes, totalRes] = await Promise.all([
    db.from("leaderboard_entries").select("id", { count: "exact", head: true }).gte("created_at", today + "T00:00:00Z"),
    db
      .from("entitlements")
      .select("id", { count: "exact", head: true })
      .eq("is_pro", true)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`),
    db.from("user_progress").select("user_id").gte("updated_at", since15).not("user_id", "is", null),
    db.from("leaderboard_entries").select("user_id").gte("created_at", since15),
    db.from("leaderboard_entries").select("user_id"),
  ]);

  const totalIds = new Set<string>();
  for (const r of totalRes.data ?? []) totalIds.add(r.user_id);
  const { data: upData } = await db.from("user_progress").select("user_id").not("user_id", "is", null);
  for (const r of upData ?? []) if (r.user_id) totalIds.add(r.user_id);
  const { data: entData } = await db.from("entitlements").select("user_id");
  for (const r of entData ?? []) totalIds.add(r.user_id);

  const activeIds = new Set<string>();
  for (const r of upRes.data ?? []) if (r.user_id) activeIds.add(r.user_id);
  for (const r of leRes.data ?? []) activeIds.add(r.user_id);

  return jsonResponse({
    daily_plays: dailyPlaysRes.count ?? 0,
    total_users: totalIds.size,
    paid_users: paidUsersRes.count ?? 0,
    active_users_15min: activeIds.size,
  });
}

// ---------------------------------------------------------------------------
// GET /admin/metrics/daily
// ---------------------------------------------------------------------------
async function handleMetricsDaily(url: URL): Promise<Response> {
  const fromStr = url.searchParams.get("from");
  const toStr = url.searchParams.get("to");
  if (!fromStr || !toStr) {
    return errorResponse("from and to query params required (YYYY-MM-DD)", 400);
  }
  const fromDate = new Date(fromStr + "T00:00:00Z");
  const toDate = new Date(toStr + "T23:59:59Z");
  if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime()) || fromDate > toDate) {
    return errorResponse("Invalid from/to date range", 400);
  }

  const db = serviceClient();

  const { data: entries } = await db
    .from("leaderboard_entries")
    .select("created_at")
    .gte("created_at", fromStr + "T00:00:00Z")
    .lte("created_at", toStr + "T23:59:59Z");

  const { data: progressRows } = await db
    .from("user_progress")
    .select("updated_at, completed_at")
    .gte("updated_at", fromStr + "T00:00:00Z")
    .lte("updated_at", toStr + "T23:59:59Z");

  const playsByDate: Record<string, number> = {};
  const completionsByDate: Record<string, number> = {};

  for (const e of entries ?? []) {
    const d = (e.created_at as string).slice(0, 10);
    playsByDate[d] = (playsByDate[d] ?? 0) + 1;
    completionsByDate[d] = (completionsByDate[d] ?? 0) + 1;
  }

  for (const p of progressRows ?? []) {
    const d = (p.updated_at as string).slice(0, 10);
    playsByDate[d] = (playsByDate[d] ?? 0) + 1;
    if (p.completed_at) {
      const cd = (p.completed_at as string).slice(0, 10);
      completionsByDate[cd] = (completionsByDate[cd] ?? 0) + 1;
    }
  }

  const series: { date: string; plays: number; completions: number }[] = [];
  const cur = new Date(fromDate);
  while (cur <= toDate) {
    const d = cur.toISOString().slice(0, 10);
    series.push({
      date: d,
      plays: playsByDate[d] ?? 0,
      completions: completionsByDate[d] ?? 0,
    });
    cur.setDate(cur.getDate() + 1);
  }

  return jsonResponse({ series });
}
