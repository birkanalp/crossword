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

export async function checkWord(
  levelId: string,
  clueNumber: number,
  direction: 'across' | 'down',
  word: string,
  opts?: CheckWordOptions,
): Promise<boolean> {
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
  if (response.error || !response.data) return false;
  return response.data.correct;
}

// ─── Query Keys ───────────────────────────────────────────────────────────────

export const levelKeys = {
  all: ['levels'] as const,
  detail: (id: string) => [...levelKeys.all, 'detail', id] as const,
  daily: () => [...levelKeys.all, 'daily'] as const,
};

// ─── Return Types ─────────────────────────────────────────────────────────────

export interface LevelWithProgress {
  level: CrosswordLevel;
  progress: LevelProgress | null;
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
 * NOTE: The backend getDailyChallenge endpoint is Phase 2 (status.backend.md #13).
 * This hook is a placeholder — it will 404 until the endpoint is deployed.
 * TODO: Update path to /getDailyChallenge once CR-003 is resolved.
 *
 * Contract gap: CR-003 in api.contract.json#/changeRequests
 */
export function useDailyPuzzle(opts?: { guestId?: string; authToken?: string }) {
  return useQuery({
    queryKey: levelKeys.daily(),
    queryFn: async (): Promise<LevelWithProgress> => {
      // TODO (CR-003): Replace with /getDailyChallenge once endpoint is live
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
