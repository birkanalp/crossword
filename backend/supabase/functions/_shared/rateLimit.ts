// =============================================================================
// Rate Limiting Middleware
//
// In-memory sliding window rate limiter for Supabase Edge Functions.
//
// LIMITATIONS:
//  - State is per-isolate (not shared across instances). For distributed
//    rate limiting, use a Redis/KV store. This is a first-layer defence.
//  - Effective for burst protection on a single warm instance.
//
// USAGE:
//   import { checkRateLimit } from "../_shared/rateLimit.ts";
//
//   const limited = checkRateLimit(req, { limit: 30, windowMs: 60_000 });
//   if (limited) return limited; // returns 429 Response
// =============================================================================

interface WindowState {
  count: number;
  windowStart: number;
}

// Map<key, WindowState>
const _store = new Map<string, WindowState>();

// Eviction: clear stale entries every 5 minutes to prevent unbounded growth
let _lastEviction = Date.now();
const EVICTION_INTERVAL_MS = 5 * 60_000;

function evictStaleEntries(windowMs: number): void {
  const now = Date.now();
  if (now - _lastEviction < EVICTION_INTERVAL_MS) return;
  _lastEviction = now;
  for (const [key, state] of _store) {
    if (now - state.windowStart > windowMs) {
      _store.delete(key);
    }
  }
}

/**
 * Extract the client IP from the request.
 * Supabase forwards the real IP in `x-real-ip` or `x-forwarded-for`.
 */
function getClientIp(req: Request): string {
  return (
    req.headers.get("x-real-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

interface RateLimitOptions {
  /** Maximum number of requests allowed in the window. Default: 60 */
  limit?: number;
  /** Window size in milliseconds. Default: 60 000 (1 minute) */
  windowMs?: number;
  /**
   * Custom key derivation. Defaults to IP address.
   * Use (req) => identity.userId to rate-limit per user.
   */
  keyFn?: (req: Request) => string;
}

/**
 * Check whether the caller has exceeded the rate limit.
 * Returns a 429 Response if limited, null otherwise.
 *
 * @example
 * ```ts
 * const limited = checkRateLimit(req, { limit: 30, windowMs: 60_000 });
 * if (limited) return limited;
 * ```
 */
export function checkRateLimit(
  req: Request,
  options: RateLimitOptions = {},
): Response | null {
  const limit = options.limit ?? 60;
  const windowMs = options.windowMs ?? 60_000;
  const key = options.keyFn ? options.keyFn(req) : getClientIp(req);

  evictStaleEntries(windowMs);

  const now = Date.now();
  const existing = _store.get(key);

  if (!existing || now - existing.windowStart > windowMs) {
    // New window
    _store.set(key, { count: 1, windowStart: now });
    return null;
  }

  existing.count += 1;

  if (existing.count > limit) {
    const retryAfterSec = Math.ceil(
      (existing.windowStart + windowMs - now) / 1000,
    );
    return new Response(
      JSON.stringify({ error: "Too many requests. Please try again later." }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(retryAfterSec),
          "X-RateLimit-Limit": String(limit),
          "X-RateLimit-Remaining": "0",
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  }

  return null;
}
