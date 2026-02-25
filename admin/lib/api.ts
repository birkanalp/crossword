/**
 * Admin API client — CONTRACTS/api.contract.json admin endpoints
 */

const getBaseUrl = () =>
  process.env.NEXT_PUBLIC_SUPABASE_URL
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1`
    : '';

export interface AdminPuzzleSummary {
  id: string;
  difficulty: string;
  language: string;
  review_status: 'pending' | 'approved' | 'rejected';
  created_at: string;
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
}

export interface MetricsOverview {
  daily_plays: number;
  total_users: number;
  paid_users: number;
  active_users_15min: number;
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
  if (out.error) return out;
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

export async function adminGeneratePuzzle(
  token: string,
  difficulty: GeneratePuzzleDifficulty
): Promise<{ data: { level_id: string; difficulty: string } | null; error: string | null }> {
  const res = await fetch('/api/generate-puzzle', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ difficulty }),
  });

  const raw = await res.json().catch(() => ({})) as { level_id?: string; difficulty?: string; error?: string };
  if (!res.ok) {
    return { data: null, error: raw.error ?? `HTTP ${res.status}` };
  }
  if (raw.level_id && raw.difficulty) {
    return { data: { level_id: raw.level_id, difficulty: raw.difficulty }, error: null };
  }
  return { data: null, error: raw.error ?? 'Geçersiz yanıt' };
}
