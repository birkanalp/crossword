import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../client';
import type { CrosswordLevel } from '@/domain/crossword/types';
import type { LevelProgress } from '@/domain/crossword/types';
import {
  adaptApiLevel,
  adaptProgressSnapshot,
  type GetLevelResponse,
} from '../adapters/levelAdapter';

// ─── checkWord ────────────────────────────────────────────────────────────────
// Contract: api.contract.json#/endpoints/checkWord
// Optional request_id, state_json, time_spent, hints_used, mistakes for
// idempotency and server-side progress persistence.

export interface CheckWordOptions {
  guestId?: string;
  authToken?: string;
  /** Per-action UUID to avoid coalescing distinct attempts (contract: request_id) */
  requestId?: string;
  /** Client snapshot for resume (contract: state_json) */
  stateJson?: Record<string, unknown>;
  timeSpent?: number;
  hintsUsed?: number;
  mistakes?: number;
}

export interface CheckWordResult {
  correct: boolean;
  error: string | null;
}

export async function checkWord(
  levelId: string,
  clueNumber: number,
  direction: 'across' | 'down',
  word: string,
  opts?: CheckWordOptions,
): Promise<CheckWordResult> {
  const body: Record<string, unknown> = {
    level_id: levelId,
    clue_number: clueNumber,
    direction,
    word,
  };
  if (opts?.requestId) body.request_id = opts.requestId;
  if (opts?.stateJson !== undefined) body.state_json = opts.stateJson;
  if (opts?.timeSpent !== undefined) body.time_spent = opts.timeSpent;
  if (opts?.hintsUsed !== undefined) body.hints_used = opts.hintsUsed;
  if (opts?.mistakes !== undefined) body.mistakes = opts.mistakes;

  const requestOpts: { method: 'POST'; body: Record<string, unknown>; guestId?: string; authToken?: string } = {
    method: 'POST',
    body,
  };
  if (opts?.guestId) requestOpts.guestId = opts.guestId;
  if (opts?.authToken) requestOpts.authToken = opts.authToken;

  const response = await apiRequest<{ correct: boolean }>('/checkWord', requestOpts);
  if (response.error || !response.data) {
    return { correct: false, error: response.error ?? 'Kelime doğrulanamadı.' };
  }
  return { correct: response.data.correct, error: null };
}

// ─── revealLetter ───────────────────────────────────────────────────────────────
// POST /revealLetter — returns single letter for hint flow (rewarded ad / coin spend).
// Backend has answers; client never receives full clues.

export interface RevealLetterOptions {
  guestId?: string;
  authToken?: string;
}

export async function revealLetter(
  levelId: string,
  row: number,
  col: number,
  opts?: RevealLetterOptions,
): Promise<{ letter: string } | null> {
  const requestOpts: { method: 'POST'; body: Record<string, unknown>; guestId?: string; authToken?: string } = {
    method: 'POST',
    body: { level_id: levelId, row, col },
  };
  if (opts?.guestId) requestOpts.guestId = opts.guestId;
  if (opts?.authToken) requestOpts.authToken = opts.authToken;

  const response = await apiRequest<{ letter: string }>('/revealLetter', requestOpts);
  if (response.error || !response.data?.letter) return null;
  return response.data;
}

// ─── Query Keys ───────────────────────────────────────────────────────────────

export const levelKeys = {
  all: ['levels'] as const,
  detail: (id: string) => [...levelKeys.all, 'detail', id] as const,
  daily: () => [...levelKeys.all, 'daily'] as const,
  list: (opts?: {
    difficulty?: string;
    difficulties?: string[];
    offset?: number;
    hide_completed?: boolean;
    sort?: string;
  }) =>
    [
      ...levelKeys.all,
      'list',
      opts?.difficulty ?? 'all',
      opts?.difficulties?.join(',') ?? '',
      opts?.offset ?? 0,
      opts?.hide_completed ?? false,
      opts?.sort ?? '',
    ] as const,
};

// ─── Return Types ─────────────────────────────────────────────────────────────

export interface LevelWithProgress {
  level: CrosswordLevel;
  progress: LevelProgress | null;
}

/** listLevels response item — api.contract.json#/endpoints/listLevels */
export interface LevelSummary {
  id: string;
  difficulty: 'easy' | 'medium' | 'hard' | 'expert';
  is_premium: boolean;
  progress: {
    completed_at: string | null;
    time_spent: number;
  } | null;
}

export interface ListLevelsResponse {
  levels: LevelSummary[];
  total: number;
}

// ─── UUID validation ─────────────────────────────────────────────────────────
// Contract: getLevel requires id as UUID (api.contract.json#/endpoints/getLevel/queryParams/id)

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidLevelId(id: string): boolean {
  return UUID_REGEX.test(id);
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

/**
 * Fetches a single level and the caller's saved progress for it.
 *
 * Contract: GET /getLevel?id={uuid}
 * Response: { level, progress | null }
 * (api.contract.json#/endpoints/getLevel)
 *
 * Safe guard: Does not request if id is not a valid UUID — avoids opaque 400/404.
 */
export function useLevel(
  levelId: string | null,
  opts?: { guestId?: string; authToken?: string },
) {
  const isValid = levelId !== null && isValidLevelId(levelId);

  return useQuery({
    queryKey: levelKeys.detail(levelId ?? ''),
    queryFn: async (): Promise<LevelWithProgress> => {
      if (!levelId) throw new Error('No level ID');
      if (!isValidLevelId(levelId)) {
        throw new Error('Geçersiz seviye kimliği. Lütfen seviye listesinden seçin.');
      }

      const requestOpts: { guestId?: string; authToken?: string } = {};
      if (opts?.guestId) requestOpts.guestId = opts.guestId;
      if (opts?.authToken) requestOpts.authToken = opts.authToken;

      const response = await apiRequest<GetLevelResponse>(
        `/getLevel?id=${encodeURIComponent(levelId)}`,
        requestOpts,
      );

      if (response.error || !response.data) throw new Error(response.error ?? 'No data');
      const { level: apiLevel, progress: apiProgress } = response.data;

      return {
        level: adaptApiLevel(apiLevel),
        progress: apiProgress
          ? adaptProgressSnapshot(levelId, apiProgress)
          : null,
      };
    },
    enabled: isValid,
  });
}

/**
 * Fetches today's daily puzzle.
 *
 * Contract: GET /getDailyChallenge
 * Response: { level: Level, progress: UserProgressSnapshot | null }
 * (api.contract.json#/endpoints/getDailyChallenge)
 */
export function useDailyPuzzle(opts?: { guestId?: string; authToken?: string }) {
  return useQuery({
    queryKey: levelKeys.daily(),
    queryFn: async (): Promise<LevelWithProgress> => {
      const requestOpts: { guestId?: string; authToken?: string } = {};
      if (opts?.guestId) requestOpts.guestId = opts.guestId;
      if (opts?.authToken) requestOpts.authToken = opts.authToken;

      const response = await apiRequest<GetLevelResponse>(
        '/getDailyChallenge',
        requestOpts,
      );

      if (response.error || !response.data) throw new Error(response.error ?? 'No data');
      const { level: apiLevel, progress: apiProgress } = response.data;
      const levelId = apiLevel.id;

      return {
        level: adaptApiLevel(apiLevel),
        progress: apiProgress
          ? adaptProgressSnapshot(levelId, apiProgress)
          : null,
      };
    },
    staleTime: 60 * 60 * 1000, // 1 hour — daily puzzle won't change mid-day
  });
}

/**
 * Fetches paginated list of approved levels with caller's progress.
 *
 * Contract: GET /listLevels?difficulty=&difficulties=&hide_completed=&sort=&limit=&offset=
 * Response: { levels: LevelSummary[], total }
 * (api.contract.json#/endpoints/listLevels)
 */
export function useListLevels(opts?: {
  guestId?: string;
  authToken?: string;
  difficulty?: 'easy' | 'medium' | 'hard' | 'expert';
  difficulties?: ('easy' | 'medium' | 'hard' | 'expert')[];
  hide_completed?: boolean;
  sort?: 'last_completed_first';
  limit?: number;
  offset?: number;
}) {
  const params = new URLSearchParams();
  if (opts?.difficulty) params.set('difficulty', opts.difficulty);
  if (opts?.difficulties?.length) params.set('difficulties', opts.difficulties.join(','));
  if (opts?.hide_completed) params.set('hide_completed', 'true');
  if (opts?.sort) params.set('sort', opts.sort);
  if (opts?.limit !== undefined) params.set('limit', String(opts.limit));
  if (opts?.offset !== undefined) params.set('offset', String(opts.offset));
  const query = params.toString();

  return useQuery({
    queryKey: levelKeys.list({
      ...(opts?.difficulty !== undefined ? { difficulty: opts.difficulty } : {}),
      ...(opts?.difficulties !== undefined ? { difficulties: opts.difficulties } : {}),
      offset: opts?.offset ?? 0,
      ...(opts?.hide_completed !== undefined ? { hide_completed: opts.hide_completed } : {}),
      ...(opts?.sort !== undefined ? { sort: opts.sort } : {}),
    }),
    queryFn: async (): Promise<ListLevelsResponse> => {
      const requestOpts: { guestId?: string; authToken?: string } = {};
      if (opts?.guestId) requestOpts.guestId = opts.guestId;
      if (opts?.authToken) requestOpts.authToken = opts.authToken;

      const path = query ? `/listLevels?${query}` : '/listLevels';
      const response = await apiRequest<ListLevelsResponse>(path, requestOpts);

      if (response.error || !response.data) {
        throw new Error(response.error ?? 'Seviyeler yüklenemedi');
      }
      return response.data;
    },
  });
}
