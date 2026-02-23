import Constants from 'expo-constants';

// ─── API Client ───────────────────────────────────────────────────────────────
// Targets Supabase Edge Functions.
// Base URL pattern: ${SUPABASE_URL}/functions/v1
// Contract: api.contract.json#/baseUrl

const SUPABASE_URL: string =
  (Constants.expoConfig?.extra?.supabaseUrl as string | undefined) ?? '';

export const API_BASE_URL = SUPABASE_URL
  ? `${SUPABASE_URL}/functions/v1`
  : '';

if (!SUPABASE_URL && !__DEV__) {
  console.error('[api/client] supabaseUrl is not configured in app.json extra');
}

// ─── Auth helpers ─────────────────────────────────────────────────────────────

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
}

// ─── Core request ─────────────────────────────────────────────────────────────

export async function apiRequest<T>(
  /** Path relative to baseUrl, e.g. "/getLevel" */
  path: string,
  options: RequestOptions = {},
): Promise<ApiResponse<T>> {
  const { method = 'GET', body, authToken, guestId } = options;

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

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

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
      return { data: null, error: message };
    }

    const data = (await response.json()) as T;
    return { data, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Network error';
    return { data: null, error: message };
  }
}
