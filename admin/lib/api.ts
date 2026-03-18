/**
 * Admin API client — CONTRACTS/api.contract.json admin endpoints
 */

import type { Todo, TodoStatus } from '@/lib/todos';

const getBaseUrl = () =>
  process.env.NEXT_PUBLIC_SUPABASE_URL
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1`
    : '';

export interface AdminPuzzleSummary {
  id: string;
  difficulty: string;
  language: string;
  review_status: 'generating' | 'ai_review' | 'pending' | 'approved' | 'rejected';
  created_at: string;
  ai_reviewed_at: string | null;
  ai_review_score: number | null;
  sort_order: number;
}

export interface AdminClue {
  number: number;
  clue: string;
  answer_length: number;
  start: { row: number; col: number };
  answer: string;
  hint: string;
}

export interface AdminLevel {
  id: string;
  version: number;
  difficulty: string;
  language: string;
  is_premium: boolean;
  grid_json: {
    rows: number;
    cols: number;
    cells: { row: number; col: number; type: 'letter' | 'black'; number?: number }[];
  };
  clues_json: { across: AdminClue[]; down: AdminClue[] };
  review_status: string;
  review_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  ai_review_notes: string | null;
  ai_reviewed_at: string | null;
  ai_review_score: number | null;
}

export interface MetricsOverview {
  daily_plays: number;
  total_users: number;
  paid_users: number;
  active_users_15min: number;
  ads_watched_today: number;
}

export interface DailyMetricsPoint {
  date: string;
  plays: number;
  completions: number;
}

async function adminFetch<T>(
  path: string,
  opts: { method?: string; body?: unknown; token: string }
): Promise<{ data: T | null; error: string | null }> {
  const base = getBaseUrl();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
  if (!base) return { data: null, error: 'API URL not configured' };

  const res = await fetch(`${base}${path}`, {
    method: opts.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${opts.token}`,
      ...(anonKey && { apikey: anonKey }),
    },
    body: opts.body != null ? JSON.stringify(opts.body) : undefined,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    return { data: null, error: err.error ?? `HTTP ${res.status}` };
  }

  if (res.status === 204) return { data: null as unknown as T, error: null };
  const raw = await res.json().catch(() => null);
  if (!raw || typeof raw !== 'object') return { data: null, error: 'Geçersiz API yanıtı' };
  const data = raw as T;
  return { data, error: null };
}

export async function adminListPuzzles(
  token: string,
  params?: { status?: string; page?: number; limit?: number }
): Promise<{ data: { items: AdminPuzzleSummary[]; total: number } | null; error: string | null }> {
  const q = new URLSearchParams();
  if (params?.status) q.set('status', params.status);
  if (params?.page) q.set('page', String(params.page));
  if (params?.limit) q.set('limit', String(params.limit));
  const query = q.toString();
  return adminFetch<{ items: AdminPuzzleSummary[]; total: number }>(
    `/admin/puzzles${query ? `?${query}` : ''}`,
    { token }
  );
}

export async function adminGetPuzzle(
  token: string,
  id: string
): Promise<{ data: { level: AdminLevel } | null; error: string | null }> {
  const out = await adminFetch<{ level?: AdminLevel; data?: { level?: AdminLevel } }>(
    `/admin/puzzles/${encodeURIComponent(id)}`,
    { token }
  );
  if (out.error) return { data: null, error: out.error };
  const level = out.data?.level ?? out.data?.data?.level;
  if (level) return { data: { level }, error: null };
  if (typeof window !== 'undefined' && out.data) {
    console.warn('[admin] Beklenmeyen API yanıtı (level yok):', Object.keys(out.data), out.data);
  }
  return { data: null, error: 'Bulmaca verisi alınamadı' };
}

export async function adminPatchClue(
  token: string,
  id: string,
  clueKey: string,
  body: { text?: string; answer?: string; hint?: string }
): Promise<{ data: { level: AdminLevel } | null; error: string | null }> {
  return adminFetch<{ level: AdminLevel }>(
    `/admin/puzzles/${id}/clues/${clueKey}`,
    { method: 'PATCH', body, token }
  );
}

export async function adminPuzzleDecision(
  token: string,
  id: string,
  body: { action: 'approve' | 'reject'; review_notes?: string }
): Promise<{ data: { success: boolean } | null; error: string | null }> {
  return adminFetch<{ success: boolean }>(`/admin/puzzles/${id}/decision`, {
    method: 'POST',
    body,
    token,
  });
}

export async function adminUpdatePuzzleSortOrder(
  token: string,
  id: string,
  sortOrder: number,
): Promise<void> {
  const base = getBaseUrl();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
  const res = await fetch(`${base}/admin/puzzles/${encodeURIComponent(id)}/sort-order`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(anonKey && { apikey: anonKey }),
    },
    body: JSON.stringify({ sort_order: sortOrder }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? 'Failed to update sort order');
  }
}

export async function adminMetricsOverview(
  token: string
): Promise<{ data: MetricsOverview | null; error: string | null }> {
  return adminFetch<MetricsOverview>('/admin/metrics/overview', { token });
}

export async function adminMetricsDaily(
  token: string,
  from: string,
  to: string
): Promise<{ data: { series: DailyMetricsPoint[] } | null; error: string | null }> {
  return adminFetch<{ series: DailyMetricsPoint[] }>(
    `/admin/metrics/daily?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    { token }
  );
}

export type GeneratePuzzleDifficulty = 'easy' | 'medium' | 'hard' | 'expert';

export type GeneratePuzzleResponse = {
  level_id?: string;
  level_ids?: string[];
  difficulty: string;
  /** Batch mode: accepted for background generation, no level_ids yet */
  accepted?: boolean;
  count?: number;
};

export async function adminGeneratePuzzle(
  token: string,
  difficulty: GeneratePuzzleDifficulty,
  count: number = 1
): Promise<{ data: GeneratePuzzleResponse | null; error: string | null }> {
  const body: { difficulty: string; count?: number } = { difficulty };
  if (count > 1) body.count = count;

  const res = await fetch('/api/generate-puzzle', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const raw = await res.json().catch(() => ({})) as {
    level_id?: string;
    level_ids?: string[];
    difficulty?: string;
    error?: string;
    accepted?: boolean;
    count?: number;
  };
  if (!res.ok) {
    return { data: null, error: raw.error ?? `HTTP ${res.status}` };
  }
  // 202 Accepted: batch mode, fire-and-forget
  if (res.status === 202 && raw.accepted && raw.difficulty) {
    return {
      data: { difficulty: raw.difficulty, accepted: true, count: raw.count ?? count },
      error: null,
    };
  }
  if (raw.difficulty) {
    const data: GeneratePuzzleResponse = {
      difficulty: raw.difficulty,
      ...(raw.level_ids?.length ? { level_ids: raw.level_ids } : raw.level_id ? { level_id: raw.level_id } : {}),
    };
    if (data.level_id || (data.level_ids && data.level_ids.length > 0)) {
      return { data, error: null };
    }
  }
  return { data: null, error: raw.error ?? 'Geçersiz yanıt' };
}

export interface AiReviewResult {
  passed: boolean;
  score: number;
  issues: string[];
  feedback: string;
  review_status: string;
}

export async function adminTriggerAiReview(
  token: string,
  id: string
): Promise<{ data: AiReviewResult | null; error: string | null }> {
  return adminFetch<AiReviewResult>(
    `/admin/puzzles/${encodeURIComponent(id)}/ai-review`,
    { method: 'POST', token }
  );
}

export async function adminGenerateHints(
  token: string,
  id: string
): Promise<{ data: { updated: number } | null; error: string | null }> {
  return adminFetch<{ updated: number }>(
    `/admin/puzzles/${encodeURIComponent(id)}/generate-hints`,
    { method: 'POST', token }
  );
}

export async function adminGetCronEnabled(
  token: string
): Promise<{ data: { enabled: boolean } | null; error: string | null }> {
  return adminFetchLocal<{ enabled: boolean }>('/api/cron-settings', { token });
}

export async function adminSetCronEnabled(
  token: string,
  enabled: boolean
): Promise<{ data: { enabled: boolean } | null; error: string | null }> {
  return adminFetchLocal<{ enabled: boolean }>('/api/cron-settings', {
    method: 'PATCH',
    body: { enabled },
    token,
  });
}

export async function adminStartAllAiReview(
  token: string
): Promise<{ data: { updated: number; ids: string[] } | null; error: string | null }> {
  return adminFetch<{ updated: number; ids: string[] }>('/admin/ai-review/start-all', { method: 'POST', token });
}

export async function adminGetAiReviewCronEnabled(
  token: string
): Promise<{ data: { enabled: boolean } | null; error: string | null }> {
  return adminFetch<{ enabled: boolean }>('/admin/settings/ai-review-cron-enabled', { token });
}

export async function adminSetAiReviewCronEnabled(
  token: string,
  enabled: boolean
): Promise<{ data: { enabled: boolean } | null; error: string | null }> {
  return adminFetch<{ enabled: boolean }>('/admin/settings/ai-review-cron-enabled', {
    method: 'PATCH',
    body: { enabled },
    token,
  });
}

export interface AdminTodoInput {
  title: string;
  body: string;
  status: TodoStatus;
}

export async function adminListTodos(
  token: string
): Promise<{ data: { todos: Todo[] } | null; error: string | null }> {
  return adminFetch<{ todos: Todo[] }>('/admin/todos', { token });
}

export async function adminCreateTodo(
  token: string,
  body: AdminTodoInput
): Promise<{ data: { todo: Todo } | null; error: string | null }> {
  return adminFetch<{ todo: Todo }>('/admin/todos', { method: 'POST', body, token });
}

export async function adminUpdateTodo(
  token: string,
  id: string,
  body: Partial<AdminTodoInput>
): Promise<{ data: { todo: Todo } | null; error: string | null }> {
  return adminFetch<{ todo: Todo }>(`/admin/todos/${id}`, { method: 'PATCH', body, token });
}

export async function adminDeleteTodo(
  token: string,
  id: string
): Promise<{ data: null; error: string | null }> {
  return adminFetch<null>(`/admin/todos/${id}`, { method: 'DELETE', token });
}

// ─── Coin Packages ────────────────────────────────────────────────────────────

export interface CoinPackageAdmin {
  id: string;
  name: string;
  description: string | null;
  coin_amount: number;
  price_usd: number;
  original_price_usd: number | null;
  discount_percent: number;
  badge: 'popular' | 'best_value' | 'new' | 'limited' | null;
  is_featured: boolean;
  is_active: boolean;
  sort_order: number;
  revenuecat_product_id: string | null;
  created_at: string;
  updated_at: string;
}

export type CoinPackageInput = Omit<CoinPackageAdmin, 'id' | 'created_at' | 'updated_at'>;

export async function adminListCoinPackages(
  token: string
): Promise<{ data: { packages: CoinPackageAdmin[] } | null; error: string | null }> {
  return adminFetch<{ packages: CoinPackageAdmin[] }>('/admin/coin-packages', { token });
}

export async function adminCreateCoinPackage(
  token: string,
  body: CoinPackageInput
): Promise<{ data: { package: CoinPackageAdmin } | null; error: string | null }> {
  return adminFetch<{ package: CoinPackageAdmin }>('/admin/coin-packages', { method: 'POST', body, token });
}

export async function adminUpdateCoinPackage(
  token: string,
  id: string,
  body: Partial<CoinPackageInput>
): Promise<{ data: { package: CoinPackageAdmin } | null; error: string | null }> {
  return adminFetch<{ package: CoinPackageAdmin }>(`/admin/coin-packages/${id}`, { method: 'PUT', body, token });
}

export async function adminDeleteCoinPackage(
  token: string,
  id: string
): Promise<{ data: null; error: string | null }> {
  return adminFetch<null>(`/admin/coin-packages/${id}`, { method: 'DELETE', token });
}

export async function adminToggleCoinPackage(
  token: string,
  id: string
): Promise<{ data: { package: CoinPackageAdmin } | null; error: string | null }> {
  return adminFetch<{ package: CoinPackageAdmin }>(`/admin/coin-packages/${id}/toggle`, { method: 'PATCH', token });
}

async function adminFetchLocal<T>(
  path: string,
  opts: { method?: string; body?: unknown; token: string }
): Promise<{ data: T | null; error: string | null }> {
  const res = await fetch(path, {
    method: opts.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${opts.token}`,
    },
    body: opts.body != null ? JSON.stringify(opts.body) : undefined,
  });

  const raw = await res.json().catch(() => null);
  if (!res.ok) {
    const err = (raw as { error?: string })?.error ?? `HTTP ${res.status}`;
    return { data: null, error: err };
  }
  return { data: raw as T, error: null };
}
