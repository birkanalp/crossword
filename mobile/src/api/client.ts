import { captureError } from '@/lib/sentry';
import { runtimeConfig } from '@/config/runtime';

// ─── API Client ───────────────────────────────────────────────────────────────
// Targets Supabase Edge Functions.
// Base URL pattern: ${SUPABASE_URL}/functions/v1
// Contract: api.contract.json#/baseUrl

const SUPABASE_URL = runtimeConfig.supabaseUrl ?? '';

export const API_BASE_URL = SUPABASE_URL
  ? `${SUPABASE_URL}/functions/v1`
  : '';

if (!SUPABASE_URL && runtimeConfig.isReleaseLike) {
  console.error('[api/client] SUPABASE_URL is not configured for this release-like build');
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type ApiResponse<T> =
  | { data: T; error: null }
  | { data: null; error: string };

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Supabase JWT. Contract: api.contract.json#/auth/schemes/bearer */
  authToken?: string;
  /** UUID v4 guest ID. Contract: api.contract.json#/auth/schemes/guestId */
  guestId?: string;
  /**
   * AbortSignal from the caller (e.g. component unmount).
   * Merged with the internal 10s timeout signal so whichever fires first wins.
   */
  signal?: AbortSignal;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const REQUEST_TIMEOUT_MS = 10_000;
const MAX_RETRIES = 3;
/** Base delay for exponential backoff (ms). Attempt n waits BASE * 2^n. */
const RETRY_BASE_MS = 300;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isRetryableStatus(status: number): boolean {
  return status === 429 || (status >= 500 && status < 600);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Combines two AbortSignals so that aborting either one aborts the combined signal.
 * Falls back gracefully if AbortSignal.any is unavailable (older React Native runtimes).
 */
function combineSignals(a: AbortSignal, b: AbortSignal): AbortSignal {
  if (typeof AbortSignal.any === 'function') {
    return AbortSignal.any([a, b]);
  }
  const controller = new AbortController();
  const abort = () => controller.abort();
  a.addEventListener('abort', abort, { once: true });
  b.addEventListener('abort', abort, { once: true });
  return controller.signal;
}

// ─── Core request ─────────────────────────────────────────────────────────────

export async function apiRequest<T>(
  /** Path relative to baseUrl, e.g. "/getLevel" */
  path: string,
  options: RequestOptions = {},
): Promise<ApiResponse<T>> {
  const { method = 'GET', body, authToken, guestId, signal: callerSignal } = options;

  if (!API_BASE_URL) {
    return { data: null, error: 'API base URL not configured' };
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  if (authToken) {
    // Contract: api.contract.json#/auth/schemes/bearer
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  if (guestId) {
    // Contract: api.contract.json#/auth/schemes/guestId — header: x-guest-id
    headers['x-guest-id'] = guestId;
  }

  const url = `${API_BASE_URL}${path}`;
  const fetchInit: RequestInit = {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  };

  let lastError = 'Network error';

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    // Fresh timeout signal per attempt
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(
      () => timeoutController.abort(),
      REQUEST_TIMEOUT_MS,
    );

    const signal = callerSignal
      ? combineSignals(callerSignal, timeoutController.signal)
      : timeoutController.signal;

    try {
      const response = await fetch(url, { ...fetchInit, signal });

      clearTimeout(timeoutId);

      if (!response.ok) {
        // Contract: api.contract.json#/errorShape
        const text = await response.text();
        let message = `HTTP ${response.status}`;
        try {
          const parsed = JSON.parse(text) as { error?: string };
          if (parsed.error) message = parsed.error;
        } catch {
          if (text) message = text;
        }

        // Report 5xx errors to Sentry
        if (response.status >= 500) {
          captureError(new Error(`[api] ${method} ${path} → ${response.status}`), {
            path,
            status: response.status,
            attempt,
          });
        }

        if (isRetryableStatus(response.status) && attempt < MAX_RETRIES - 1) {
          lastError = message;
          await sleep(RETRY_BASE_MS * Math.pow(2, attempt));
          continue;
        }

        return { data: null, error: message };
      }

      const data = (await response.json()) as T;
      return { data, error: null };
    } catch (err) {
      clearTimeout(timeoutId);

      // If the caller's own signal aborted, bubble that up immediately
      if (callerSignal?.aborted) {
        return { data: null, error: 'Request cancelled' };
      }

      const isTimeout = timeoutController.signal.aborted;
      const message = isTimeout
        ? 'Request timed out'
        : err instanceof Error
          ? err.message
          : 'Network error';

      // Report network errors (not timeouts of user-cancelled) to Sentry
      if (!isTimeout) {
        captureError(err instanceof Error ? err : new Error(message), {
          path,
          attempt,
        });
      }

      lastError = message;

      if (attempt < MAX_RETRIES - 1) {
        await sleep(RETRY_BASE_MS * Math.pow(2, attempt));
        continue;
      }
    }
  }

  return { data: null, error: lastError };
}
