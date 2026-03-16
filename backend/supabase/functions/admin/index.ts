// =============================================================================
// Edge Function: admin
//
// Admin-only endpoints for puzzle moderation, metrics dashboard, coin shop,
// and leaderboard management.
// All routes require JWT with app_metadata.role = 'admin'.
//
// Routes:
//   GET    /admin/puzzles                        -> list puzzles (status, page, limit)
//   GET    /admin/puzzles/:id                    -> get puzzle detail (with answers/hints)
//   PATCH  /admin/puzzles/:id/clues/:clueKey     -> update clue text/answer/hint
//   POST   /admin/puzzles/:id/decision           -> approve or reject
//   GET    /admin/metrics/overview               -> daily_plays, total_users, paid_users, active_users_15min, ads_watched_today
//   GET    /admin/metrics/daily                  -> time series (from, to)
//   GET    /admin/coin-packages                  -> list all coin packages (incl. inactive)
//   POST   /admin/coin-packages                  -> create coin package
//   PUT    /admin/coin-packages/:id              -> update coin package
//   DELETE /admin/coin-packages/:id              -> delete coin package
//   PATCH  /admin/coin-packages/:id/toggle       -> toggle is_active
//   GET    /admin/todos                          -> list admin kanban todos
//   POST   /admin/todos                          -> create admin todo
//   PATCH  /admin/todos/:id                      -> update admin todo
//   DELETE /admin/todos/:id                      -> delete admin todo
//   PATCH  /admin/puzzles/:id/sort-order         -> update puzzle sort_order
//   GET    /admin/leaderboard                    -> paginated leaderboard (same params as public getLeaderboard)
//   GET    /admin/leaderboard/stats              -> aggregate leaderboard stats
// =============================================================================

import { handleCors, errorResponse, jsonResponse } from "../_shared/cors.ts";
import { requireAdmin, isValidUUID, serviceClient } from "../_shared/auth.ts";
import { computeLevelAnswerHash } from "../_shared/anticheat.ts";
import { fetchLeaderboardEntries } from "../getLeaderboard/index.ts";
import {
  runDeterministicChecks,
  runLlmAdvisoryReview,
  makeReviewDecision,
  type CluesJson as ReviewCluesJson,
  type GridJson as ReviewGridJson,
} from "../_shared/review.ts";

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

type TodoStatus = "backlog" | "ideas" | "in_progress" | "done" | "blocked";

interface AdminTodoRow {
  id: string;
  title: string;
  body: string | null;
  status: TodoStatus;
  created_at: string;
  updated_at: string;
}

const TODO_STATUSES: TodoStatus[] = ["backlog", "ideas", "in_progress", "done", "blocked"];

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
      if (parts[2] === "ai-review") return { route: "aiReview", id: parts[1] };
      if (parts[2] === "generate-hints") return { route: "generateHints", id: parts[1] };
      if (parts[2] === "sort-order") return { route: "updatePuzzleSortOrder", id: parts[1] };
      return { route: "getPuzzle", id: parts[1] };
    }
    return { route: "listPuzzles" };
  }
  if (parts[0] === "metrics") {
    if (parts[1] === "overview") return { route: "metricsOverview" };
    if (parts[1] === "daily") return { route: "metricsDaily" };
  }
  if (parts[0] === "settings") {
    if (parts[1] === "cron-enabled") return { route: "cronEnabled" };
    if (parts[1] === "ai-review-cron-enabled") return { route: "aiReviewCronEnabled" };
  }
  if (parts[0] === "ai-review") {
    if (parts[1] === "start-all") return { route: "aiReviewStartAll" };
  }
  if (parts[0] === "coin-packages") {
    if (parts[1] && isValidUUID(parts[1])) {
      if (parts[2] === "toggle") return { route: "toggleCoinPackage", id: parts[1] };
      return { route: "updateCoinPackage", id: parts[1] };
    }
    return { route: "listCoinPackages" };
  }
  if (parts[0] === "todos") {
    if (parts[1] && isValidUUID(parts[1])) {
      return { route: "todo", id: parts[1] };
    }
    return { route: "todos" };
  }
  if (parts[0] === "leaderboard") {
    if (parts[1] === "stats") return { route: "leaderboardStats" };
    return { route: "leaderboard" };
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
    if (route === "aiReview" && req.method === "POST" && id) {
      return await handleAiReview(id);
    }
    if (route === "generateHints" && req.method === "POST" && id) {
      return await handleGenerateHints(id);
    }
    if (route === "updatePuzzleSortOrder" && req.method === "PATCH" && id) {
      return await handleUpdatePuzzleSortOrder(id, req);
    }
    if (route === "metricsOverview" && req.method === "GET") {
      return await handleMetricsOverview();
    }
    if (route === "metricsDaily" && req.method === "GET") {
      return await handleMetricsDaily(url);
    }
    if (route === "cronEnabled") {
      if (req.method === "GET") return await handleGetCronEnabled();
      if (req.method === "PATCH") return await handlePatchCronEnabled(req);
    }
    if (route === "aiReviewCronEnabled") {
      if (req.method === "GET") return await handleGetAiReviewCronEnabled();
      if (req.method === "PATCH") return await handlePatchAiReviewCronEnabled(req);
    }
    if (route === "aiReviewStartAll" && req.method === "POST") return await handleAiReviewStartAll();
    if (route === "listCoinPackages" && req.method === "GET") return await handleListCoinPackages();
    if (route === "listCoinPackages" && req.method === "POST") return await handleCreateCoinPackage(req);
    if (route === "updateCoinPackage" && req.method === "PUT" && id) return await handleUpdateCoinPackage(id, req);
    if (route === "updateCoinPackage" && req.method === "DELETE" && id) return await handleDeleteCoinPackage(id);
    if (route === "toggleCoinPackage" && req.method === "PATCH" && id) return await handleToggleCoinPackage(id);
    if (route === "todos" && req.method === "GET") return await handleListTodos();
    if (route === "todos" && req.method === "POST") return await handleCreateTodo(req);
    if (route === "todo" && req.method === "PATCH" && id) return await handleUpdateTodo(id, req);
    if (route === "todo" && req.method === "DELETE" && id) return await handleDeleteTodo(id);
    if (route === "leaderboard" && req.method === "GET") return await handleAdminLeaderboard(url);
    if (route === "leaderboardStats" && req.method === "GET") return await handleAdminLeaderboardStats(url);
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
    .select("id, difficulty, language, review_status, created_at, ai_reviewed_at, ai_review_score, sort_order", { count: "exact" })
    .is("deleted_at", null);

  if (status && ["pending", "approved", "rejected", "ai_review"].includes(status)) {
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
    ai_reviewed_at: r.ai_reviewed_at ?? null,
    ai_review_score: r.ai_review_score ?? null,
    sort_order: r.sort_order ?? 0,
  }));

  return jsonResponse({ items, total: count ?? 0 });
}

// ---------------------------------------------------------------------------
// PATCH /admin/puzzles/:id/sort-order
// ---------------------------------------------------------------------------
async function handleUpdatePuzzleSortOrder(id: string, req: Request): Promise<Response> {
  let body: { sort_order?: unknown };
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON", 400);
  }

  const sortOrder = Number(body.sort_order);
  if (!Number.isInteger(sortOrder) || sortOrder < 1) {
    return errorResponse("sort_order must be an integer >= 1", 400);
  }

  const db = serviceClient();

  const { data: puzzleRow, error: fetchError } = await db
    .from("levels")
    .select("id, difficulty")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (fetchError || !puzzleRow) {
    return errorResponse("Puzzle not found", 404);
  }

  const { error: updateError } = await db
    .from("levels")
    .update({ sort_order: sortOrder, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (updateError) {
    console.error("[admin] updatePuzzleSortOrder error:", updateError);
    if (updateError.code === "23505") {
      return errorResponse(`sort_order ${sortOrder} already used in this difficulty`, 409);
    }
    return errorResponse("Failed to update sort_order", 500);
  }

  return jsonResponse({ success: true, sort_order: sortOrder });
}

// ---------------------------------------------------------------------------
// GET /admin/puzzles/:id
// ---------------------------------------------------------------------------
async function handleGetPuzzle(id: string): Promise<Response> {
  const db = serviceClient();
  const { data: level, error } = await db
    .from("levels")
    .select(
      "id, version, difficulty, language, is_premium, grid_json, clues_json, review_status, review_notes, reviewed_by, reviewed_at, ai_review_notes, ai_reviewed_at, ai_review_score",
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
    ai_review_notes: level.ai_review_notes ?? null,
    ai_reviewed_at: level.ai_reviewed_at ?? null,
    ai_review_score: level.ai_review_score ?? null,
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

  const reviewStatus = action === "approve" ? "approved" : "rejected";

  const update: Record<string, unknown> = {
    review_status: reviewStatus,
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

  // Midnight UTC of today as ISO string for ad_events query
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const [dailyPlaysRes, paidUsersRes, upRes, leRes, totalRes, adsRes] = await Promise.all([
    db.from("leaderboard_entries").select("id", { count: "exact", head: true }).gte("created_at", today + "T00:00:00Z"),
    db
      .from("entitlements")
      .select("id", { count: "exact", head: true })
      .eq("is_pro", true)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`),
    db.from("user_progress").select("user_id").gte("updated_at", since15).not("user_id", "is", null),
    db.from("leaderboard_entries").select("user_id").gte("created_at", since15),
    db.from("leaderboard_entries").select("user_id"),
    db
      .from("ad_events")
      .select("id", { count: "exact", head: true })
      .eq("event_type", "completed")
      .gte("created_at", todayStart.toISOString()),
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
    ads_watched_today: adsRes.count ?? 0,
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

// ---------------------------------------------------------------------------
// GET /admin/settings/cron-enabled
// PATCH /admin/settings/cron-enabled
// ---------------------------------------------------------------------------
async function handleGetCronEnabled(): Promise<Response> {
  const db = serviceClient();
  const { data: row, error } = await db
    .from("app_settings")
    .select("value")
    .eq("key", "puzzle_generation_cron_enabled")
    .single();

  if (error || !row) {
    return jsonResponse({ enabled: true });
  }
  const v = row.value;
  const enabled = v === true || v === "true";
  return jsonResponse({ enabled });
}

async function handlePatchCronEnabled(req: Request): Promise<Response> {
  let body: { enabled?: boolean };
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }
  const enabled = body?.enabled;
  if (typeof enabled !== "boolean") {
    return errorResponse("enabled must be boolean", 400);
  }

  const db = serviceClient();
  const { error } = await db
    .from("app_settings")
    .upsert(
      { key: "puzzle_generation_cron_enabled", value: enabled, updated_at: new Date().toISOString() },
      { onConflict: "key" }
    );

  if (error) {
    console.error("[admin] cron settings update error:", error);
    return errorResponse("Failed to update settings", 500);
  }
  return jsonResponse({ enabled });
}

// ---------------------------------------------------------------------------
// GET /admin/settings/ai-review-cron-enabled
// PATCH /admin/settings/ai-review-cron-enabled
// ---------------------------------------------------------------------------
async function handleGetAiReviewCronEnabled(): Promise<Response> {
  const db = serviceClient();
  const { data: row, error } = await db
    .from("app_settings")
    .select("value")
    .eq("key", "ai_review_cron_enabled")
    .single();

  if (error || !row) {
    return jsonResponse({ enabled: true });
  }
  const v = row.value;
  const enabled = v === true || v === "true";
  return jsonResponse({ enabled });
}

async function handlePatchAiReviewCronEnabled(req: Request): Promise<Response> {
  let body: { enabled?: boolean };
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }
  const enabled = body?.enabled;
  if (typeof enabled !== "boolean") {
    return errorResponse("enabled must be boolean", 400);
  }

  const db = serviceClient();
  const { error } = await db
    .from("app_settings")
    .upsert(
      { key: "ai_review_cron_enabled", value: enabled, updated_at: new Date().toISOString() },
      { onConflict: "key" }
    );

  if (error) {
    console.error("[admin] ai-review cron settings update error:", error);
    return errorResponse("Failed to update settings", 500);
  }
  return jsonResponse({ enabled });
}

function isTodoStatus(value: unknown): value is TodoStatus {
  return typeof value === "string" && TODO_STATUSES.includes(value as TodoStatus);
}

function mapTodo(row: AdminTodoRow) {
  return {
    id: row.id,
    title: row.title,
    body: row.body ?? "",
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getNextTodoSortOrder(db: ReturnType<typeof serviceClient>, status: TodoStatus): Promise<number> {
  const { data, error } = await db
    .from("admin_todos")
    .select("sort_order")
    .eq("status", status)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data?.sort_order ?? 0) + 10;
}

// ---------------------------------------------------------------------------
// GET /admin/todos
// ---------------------------------------------------------------------------
async function handleListTodos(): Promise<Response> {
  const { data, error } = await serviceClient()
    .from("admin_todos")
    .select("id, title, body, status, created_at, updated_at, sort_order")
    .order("status")
    .order("sort_order")
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("[admin] listTodos:", error);
    return errorResponse("Failed to fetch todos", 500);
  }

  return jsonResponse({ todos: (data ?? []).map((row) => mapTodo(row as AdminTodoRow)) });
}

// ---------------------------------------------------------------------------
// POST /admin/todos
// ---------------------------------------------------------------------------
async function handleCreateTodo(req: Request): Promise<Response> {
  let body: { title?: string; body?: string; status?: TodoStatus };
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  const title = body?.title?.trim();
  const content = typeof body?.body === "string" ? body.body.trim() : "";
  const status = body?.status;

  if (!title) {
    return errorResponse("title is required", 400);
  }
  if (!isTodoStatus(status)) {
    return errorResponse("status must be one of backlog, ideas, in_progress, done, blocked", 400);
  }

  const db = serviceClient();
  const sortOrder = await getNextTodoSortOrder(db, status);

  const { data, error } = await db
    .from("admin_todos")
    .insert({ title, body: content, status, sort_order: sortOrder })
    .select("id, title, body, status, created_at, updated_at")
    .single();

  if (error || !data) {
    console.error("[admin] createTodo:", error);
    return errorResponse("Failed to create todo", 500);
  }

  return jsonResponse({ todo: mapTodo(data as AdminTodoRow) }, 201);
}

// ---------------------------------------------------------------------------
// PATCH /admin/todos/:id
// ---------------------------------------------------------------------------
async function handleUpdateTodo(id: string, req: Request): Promise<Response> {
  let body: { title?: string; body?: string; status?: TodoStatus };
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  if (!body || typeof body !== "object" || Object.keys(body).length === 0) {
    return errorResponse("At least one of title, body, status required", 400);
  }

  const db = serviceClient();
  const { data: existing, error: fetchErr } = await db
    .from("admin_todos")
    .select("id, status")
    .eq("id", id)
    .maybeSingle();

  if (fetchErr) {
    console.error("[admin] updateTodo fetch:", fetchErr);
    return errorResponse("Failed to fetch todo", 500);
  }
  if (!existing) {
    return errorResponse("Todo not found", 404);
  }

  const update: Record<string, unknown> = {};

  if ("title" in body) {
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title) {
      return errorResponse("title must be a non-empty string", 400);
    }
    update.title = title;
  }

  if ("body" in body) {
    if (typeof body.body !== "string") {
      return errorResponse("body must be a string", 400);
    }
    update.body = body.body.trim();
  }

  if ("status" in body) {
    if (!isTodoStatus(body.status)) {
      return errorResponse("status must be one of backlog, ideas, in_progress, done, blocked", 400);
    }
    update.status = body.status;
    if (body.status !== existing.status) {
      update.sort_order = await getNextTodoSortOrder(db, body.status);
    }
  }

  if (Object.keys(update).length === 0) {
    return errorResponse("No valid fields provided", 400);
  }

  const { data, error } = await db
    .from("admin_todos")
    .update(update)
    .eq("id", id)
    .select("id, title, body, status, created_at, updated_at")
    .single();

  if (error || !data) {
    console.error("[admin] updateTodo:", error);
    return errorResponse("Failed to update todo", 500);
  }

  return jsonResponse({ todo: mapTodo(data as AdminTodoRow) });
}

// ---------------------------------------------------------------------------
// DELETE /admin/todos/:id
// ---------------------------------------------------------------------------
async function handleDeleteTodo(id: string): Promise<Response> {
  const db = serviceClient();
  const { data: existing, error: fetchErr } = await db
    .from("admin_todos")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (fetchErr) {
    console.error("[admin] deleteTodo fetch:", fetchErr);
    return errorResponse("Failed to fetch todo", 500);
  }
  if (!existing) {
    return errorResponse("Todo not found", 404);
  }

  const { error } = await db
    .from("admin_todos")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("[admin] deleteTodo:", error);
    return errorResponse("Failed to delete todo", 500);
  }

  return new Response(null, { status: 204 });
}

// ---------------------------------------------------------------------------
// POST /admin/ai-review/start-all
// Bulk-move all pending (ai_reviewed_at IS NULL) puzzles → ai_review status.
// ---------------------------------------------------------------------------
async function handleAiReviewStartAll(): Promise<Response> {
  const db = serviceClient();

  const { data: rows, error: fetchErr } = await db
    .from("levels")
    .select("id")
    .eq("review_status", "pending")
    .is("ai_reviewed_at", null)
    .is("deleted_at", null);

  if (fetchErr) {
    console.error("[admin] aiReviewStartAll fetch error:", fetchErr);
    return errorResponse("Failed to fetch pending levels", 500);
  }

  const ids = (rows ?? []).map((r) => r.id);
  if (ids.length === 0) {
    return jsonResponse({ updated: 0, ids: [] });
  }

  const { error: updateErr } = await db
    .from("levels")
    .update({ review_status: "ai_review", updated_at: new Date().toISOString() })
    .in("id", ids);

  if (updateErr) {
    console.error("[admin] aiReviewStartAll update error:", updateErr);
    return errorResponse("Failed to update levels", 500);
  }

  return jsonResponse({ updated: ids.length, ids });
}

// ---------------------------------------------------------------------------
// POST /admin/puzzles/:id/ai-review
// ---------------------------------------------------------------------------
async function handleAiReview(id: string): Promise<Response> {
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
    `[admin] ai-review ${id}: deterministic ${detResult.passed ? "PASS" : "FAIL"} — ` +
    `${detResult.failures.length} failures`,
  );

  if (!detResult.passed) {
    // Reject immediately, no LLM call needed
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
      `[admin] ai-review ${id}: LLM avg=${llmResult.avgScore} low=${llmResult.lowCount} ` +
      `→ ${llmResult.passed ? "PASS" : "FAIL"}`,
    );
  } catch (e) {
    console.error("[admin] LLM advisory review error:", e);
    // On LLM failure, revert to pending — do not permanently reject
    await db.from("levels").update({ review_status: "pending" }).eq("id", id);
    return errorResponse("AI review service unavailable", 503);
  }

  const decision = makeReviewDecision(detResult, llmResult);
  // %80 ve üzeri puan → otomatik onay; altı → insan incelemesi bekler
  const newStatus = !decision.passed ? "rejected" : decision.score >= 80 ? "approved" : "pending";
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
    console.error("[admin] AI review update error:", updateErr);
    return errorResponse("Failed to save AI review result", 500);
  }

  return jsonResponse({
    passed: decision.passed,
    score: decision.score,
    issues: decision.issues,
    feedback: decision.feedback,
    review_status: newStatus,
    auto_approved: newStatus === "approved",
    rejected_by: decision.rejectedBy ?? null,
  });
}

// ---------------------------------------------------------------------------
// Coin Packages — shared interface
// ---------------------------------------------------------------------------
interface CoinPackage {
  id: string;
  name: string;
  description: string | null;
  coin_amount: number;
  price_usd: number;
  original_price_usd: number | null;
  discount_percent: number;
  badge: string | null;
  is_featured: boolean;
  is_active: boolean;
  sort_order: number;
  revenuecat_product_id: string | null;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// GET /admin/coin-packages
// ---------------------------------------------------------------------------
async function handleListCoinPackages(): Promise<Response> {
  const { data, error } = await serviceClient()
    .from("coin_packages")
    .select("*")
    .order("sort_order");
  if (error) return errorResponse(error.message, 500);
  return jsonResponse({ packages: data ?? [] });
}

// ---------------------------------------------------------------------------
// POST /admin/coin-packages
// ---------------------------------------------------------------------------
async function handleCreateCoinPackage(req: Request): Promise<Response> {
  let body: Partial<CoinPackage>;
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  const { name, description, coin_amount, price_usd, original_price_usd,
          discount_percent, badge, is_featured, is_active, sort_order,
          revenuecat_product_id } = body ?? {};

  if (!name || !coin_amount || price_usd === undefined || price_usd === null) {
    return errorResponse("name, coin_amount, price_usd required", 400);
  }

  const VALID_BADGES = ["popular", "best_value", "new", "limited"];
  if (badge !== undefined && badge !== null && !VALID_BADGES.includes(badge)) {
    return errorResponse(`badge must be one of: ${VALID_BADGES.join(", ")} or null`, 400);
  }

  const { data, error } = await serviceClient()
    .from("coin_packages")
    .insert({
      name,
      description: description ?? null,
      coin_amount,
      price_usd,
      original_price_usd: original_price_usd ?? null,
      discount_percent: discount_percent ?? 0,
      badge: badge ?? null,
      is_featured: is_featured ?? false,
      is_active: is_active ?? true,
      sort_order: sort_order ?? 0,
      revenuecat_product_id: revenuecat_product_id ?? null,
    })
    .select()
    .single();

  if (error) return errorResponse(error.message, 500);
  return jsonResponse({ package: data }, 201);
}

// ---------------------------------------------------------------------------
// PUT /admin/coin-packages/:id
// ---------------------------------------------------------------------------
async function handleUpdateCoinPackage(id: string, req: Request): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  const allowed = [
    "name", "description", "coin_amount", "price_usd", "original_price_usd",
    "discount_percent", "badge", "is_featured", "is_active", "sort_order",
    "revenuecat_product_id",
  ];
  const update: Record<string, unknown> = {};
  for (const k of allowed) {
    if (k in body) update[k] = body[k];
  }

  if (Object.keys(update).length === 0) {
    return errorResponse("No updatable fields provided", 400);
  }

  const VALID_BADGES = ["popular", "best_value", "new", "limited"];
  if ("badge" in update && update["badge"] !== null && !VALID_BADGES.includes(update["badge"] as string)) {
    return errorResponse(`badge must be one of: ${VALID_BADGES.join(", ")} or null`, 400);
  }

  const { data, error } = await serviceClient()
    .from("coin_packages")
    .update(update)
    .eq("id", id)
    .select()
    .single();

  if (error) return errorResponse(error.message, 500);
  if (!data) return errorResponse("Not found", 404);
  return jsonResponse({ package: data });
}

// ---------------------------------------------------------------------------
// DELETE /admin/coin-packages/:id
// ---------------------------------------------------------------------------
async function handleDeleteCoinPackage(id: string): Promise<Response> {
  const { data: existing, error: fetchErr } = await serviceClient()
    .from("coin_packages")
    .select("id")
    .eq("id", id)
    .single();

  if (fetchErr || !existing) return errorResponse("Not found", 404);

  const { error } = await serviceClient()
    .from("coin_packages")
    .delete()
    .eq("id", id);

  if (error) return errorResponse(error.message, 500);
  return new Response(null, { status: 204 });
}

// ---------------------------------------------------------------------------
// PATCH /admin/coin-packages/:id/toggle
// ---------------------------------------------------------------------------
async function handleToggleCoinPackage(id: string): Promise<Response> {
  const { data: current, error: fetchErr } = await serviceClient()
    .from("coin_packages")
    .select("is_active")
    .eq("id", id)
    .single();

  if (fetchErr || !current) return errorResponse("Not found", 404);

  const { data, error } = await serviceClient()
    .from("coin_packages")
    .update({ is_active: !current.is_active })
    .eq("id", id)
    .select()
    .single();

  if (error) return errorResponse(error.message, 500);
  return jsonResponse({ package: data });
}

// ---------------------------------------------------------------------------
// GET /admin/leaderboard
// Admin view of the leaderboard — identical query surface to the public
// getLeaderboard endpoint but requires admin JWT.
// ---------------------------------------------------------------------------
async function handleAdminLeaderboard(url: URL): Promise<Response> {
  const typeParam = url.searchParams.get("type");
  const type    = typeParam && ["daily", "all_time", "puzzle"].includes(typeParam) ? typeParam : "all_time";
  const sortBy  = url.searchParams.get("sort_by") ?? "score";
  const levelId = url.searchParams.get("level_id");
  const date    = url.searchParams.get("date") ?? new Date().toISOString().split("T")[0];
  const limit   = Math.min(Math.max(parseInt(url.searchParams.get("limit") ?? "50", 10) || 50, 1), 100);
  const page    = Math.max(parseInt(url.searchParams.get("page") ?? "0", 10) || 0, 0);

  if (!["score", "time"].includes(sortBy)) {
    return errorResponse("sort_by must be score | time", 400);
  }
  if (type === "puzzle" && !levelId) {
    return errorResponse("level_id is required when type=puzzle", 400);
  }

  const db = serviceClient();

  const { entries, total } = await fetchLeaderboardEntries({
    db, type, sortBy, levelId, date, limit, page,
  });

  const offset = page * limit;
  const rankedEntries = entries.map((row, idx) => ({
    rank:            offset + idx + 1,
    user_id:         row.user_id,
    display_name:    row.display_name || "Anonim",
    avatar_color:    "#6366F1",
    score:           row.score,
    completion_time: row.completion_time,
    mistakes:        row.mistakes ?? 0,
    hints_used:      row.hints_used ?? 0,
    created_at:      row.created_at,
  }));

  return jsonResponse({ entries: rankedEntries, total, page, my_entry: null });
}

// ---------------------------------------------------------------------------
// GET /admin/leaderboard/stats
// Aggregate statistics over leaderboard_entries for admin dashboard.
// Supports optional type/level_id/date filtering consistent with other endpoints.
// ---------------------------------------------------------------------------
async function handleAdminLeaderboardStats(url: URL): Promise<Response> {
  const type    = url.searchParams.get("type");
  const levelId = url.searchParams.get("level_id");
  const date    = url.searchParams.get("date");

  const db = serviceClient();

  // Build the base query with optional filters
  type QueryBuilder = ReturnType<typeof db.from>;

  const buildQuery = () => {
    let q = db.from("leaderboard_entries").select(
      "user_id, score, completion_time, display_name, created_at",
    );

    if (type === "puzzle" && levelId) {
      q = q.eq("level_id", levelId);
    } else if (type === "daily" && date) {
      q = q.gte("created_at", `${date}T00:00:00Z`)
           .lte("created_at", `${date}T23:59:59Z`);
    }
    // all_time has no additional filter

    return q;
  };

  const { data: rows, error } = await buildQuery();
  if (error) {
    console.error("[admin] leaderboard stats:", error);
    return errorResponse("Failed to fetch leaderboard stats", 500);
  }

  const allRows = rows ?? [];

  if (allRows.length === 0) {
    return jsonResponse({
      total_entries:       0,
      unique_players:      0,
      avg_score:           0,
      avg_completion_time: 0,
      top_scorer:          null,
    });
  }

  const totalEntries = allRows.length;
  const uniquePlayers = new Set(allRows.map((r) => r.user_id)).size;
  const avgScore = allRows.reduce((sum, r) => sum + (r.score ?? 0), 0) / totalEntries;
  const avgTime  = allRows.reduce((sum, r) => sum + (r.completion_time ?? 0), 0) / totalEntries;

  // Top scorer
  const top = allRows.reduce<typeof allRows[0] | null>((best, r) => {
    if (!best || r.score > best.score) return r;
    return best;
  }, null);

  return jsonResponse({
    total_entries:       totalEntries,
    unique_players:      uniquePlayers,
    avg_score:           Math.round(avgScore * 100) / 100,
    avg_completion_time: Math.round(avgTime * 100) / 100,
    top_scorer: top ? { display_name: top.display_name || "Anonim", score: top.score } : null,
  });
}

// ---------------------------------------------------------------------------
// POST /admin/puzzles/:id/generate-hints
// Generates AI hints for clues that have none. Only for pending/approved levels.
// ---------------------------------------------------------------------------
async function handleGenerateHints(id: string): Promise<Response> {
  const db = serviceClient();

  const { data: level, error: fetchErr } = await db
    .from("levels")
    .select("id, version, clues_json, review_status")
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (fetchErr || !level) {
    return errorResponse("Level not found", 404);
  }

  if (!["pending", "approved"].includes(level.review_status)) {
    return errorResponse("Level must be pending or approved to generate hints", 400);
  }

  const clues = level.clues_json as CluesJson;
  const entries: { key: string; clue: string; answer: string }[] = [];

  for (const c of clues?.across ?? []) {
    const hint = (c.hint ?? "").trim();
    if (!hint && c.clue && c.answer) {
      entries.push({ key: `${c.number}A`, clue: c.clue, answer: c.answer });
    }
  }
  for (const c of clues?.down ?? []) {
    const hint = (c.hint ?? "").trim();
    if (!hint && c.clue && c.answer) {
      entries.push({ key: `${c.number}D`, clue: c.clue, answer: c.answer });
    }
  }

  if (entries.length === 0) {
    return jsonResponse({ updated: 0, message: "All clues already have hints" });
  }

  const lines = entries.map((e) => `[${e.key}] Soru: "${e.clue}" | Cevap: "${e.answer}"`).join("\n");

  const promptText = `Sen bir Türkçe bulmaca ipucu yazarısın. Her soru-cevap çifti için kısa bir ipucu üret.
İpucu: Cevabı doğrudan verme, oyuncuyu yönlendir (1-2 cümle, Türkçe).
Aile dostu ve net olsun.

Soru-Cevap listesi:
${lines}

SADECE geçerli JSON döndür (başka hiçbir şey ekleme). Her anahtar için ipucu metni:
{ "hints": { "1A": "ipucu metni", "2D": "ipucu metni", ... } }`;

  const ollamaBaseUrl = Deno.env.get("OLLAMA_BASE_URL") ?? "http://ollama:11434";
  const ollamaModel = Deno.env.get("OLLAMA_MODEL") ?? "qwen2.5:3b";

  let hintsResult: { hints: Record<string, string> };
  try {
    const ollamaRes = await fetch(`${ollamaBaseUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: ollamaModel,
        prompt: promptText,
        stream: false,
        format: {
          type: "object",
          properties: {
            hints: {
              type: "object",
              additionalProperties: { type: "string" },
            },
          },
          required: ["hints"],
        },
      }),
    });

    if (!ollamaRes.ok) {
      console.error("[admin] Ollama hints API error:", ollamaRes.status);
      return errorResponse("AI hint service unavailable", 503);
    }

    const ollamaData = await ollamaRes.json();
    const content = (ollamaData.response ?? "") as string;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in Ollama response");
    hintsResult = JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.error("[admin] AI hints error:", e);
    return errorResponse("AI hint generation failed", 503);
  }

  const hintsMap = hintsResult.hints ?? {};
  let updatedCount = 0;

  const updateClueHint = (list: ClueRecord[], dir: "across" | "down") => {
    const newList = [...list];
    for (let i = 0; i < newList.length; i++) {
      const c = newList[i];
      const key = `${c.number}${dir === "across" ? "A" : "D"}`;
      const hint = typeof hintsMap[key] === "string" ? String(hintsMap[key]).trim() : "";
      if (hint && !(c.hint ?? "").trim()) {
        newList[i] = { ...c, hint };
        updatedCount++;
      }
    }
    return newList;
  };

  const newClues = {
    across: updateClueHint(clues?.across ?? [], "across"),
    down: updateClueHint(clues?.down ?? [], "down"),
  };

  const answers: Record<string, string> = {};
  for (const c of newClues.across) {
    if (c.answer) answers[`${c.number}A`] = c.answer;
  }
  for (const c of newClues.down) {
    if (c.answer) answers[`${c.number}D`] = c.answer;
  }

  const answerHash = await computeLevelAnswerHash(level.id, level.version, answers);

  const { error: updateErr } = await db
    .from("levels")
    .update({ clues_json: newClues, answer_hash: answerHash })
    .eq("id", id);

  if (updateErr) {
    console.error("[admin] hints update error:", updateErr);
    return errorResponse("Failed to save hints", 500);
  }

  return jsonResponse({ updated: updatedCount });
}
