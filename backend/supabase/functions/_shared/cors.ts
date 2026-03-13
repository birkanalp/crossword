// =============================================================================
// CORS Headers — allow Supabase Dashboard + mobile clients
//
// Strategy:
//  - Native mobile (React Native / Expo) apps do NOT send an Origin header,
//    so CORS is not enforced by the browser. Wildcard is safe for them.
//  - Browser requests (admin panel, web) DO send Origin. We validate the
//    origin against an allowlist and reflect it back only if allowed.
//  - ALLOWED_ORIGINS is read from env CORS_ALLOWED_ORIGINS (comma-separated).
//    Falls back to wildcard when the env var is absent (local dev default).
// =============================================================================

const ALLOWED_ORIGINS_RAW =
  Deno.env.get("CORS_ALLOWED_ORIGINS") ?? "";

// Parse the allowlist; empty → unrestricted (local dev mode)
const ALLOWED_ORIGINS: string[] = ALLOWED_ORIGINS_RAW
  ? ALLOWED_ORIGINS_RAW.split(",").map((o) => o.trim()).filter(Boolean)
  : [];

function resolveOrigin(requestOrigin: string | null): string {
  if (!requestOrigin) return "*"; // Native mobile — no origin header
  if (ALLOWED_ORIGINS.length === 0) return "*"; // Dev mode
  if (ALLOWED_ORIGINS.includes(requestOrigin)) return requestOrigin;
  return "null"; // Blocked — browser will reject
}

const COMMON_HEADERS = {
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-guest-id",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
};

function makeCorsHeaders(requestOrigin: string | null): Record<string, string> {
  const origin = resolveOrigin(requestOrigin);
  const headers: Record<string, string> = {
    ...COMMON_HEADERS,
    "Access-Control-Allow-Origin": origin,
  };
  // Vary: Origin is required when reflecting a specific origin (not wildcard)
  if (origin !== "*") {
    headers["Vary"] = "Origin";
  }
  return headers;
}

/** Handle preflight OPTIONS requests */
export function handleCors(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    const headers = makeCorsHeaders(req.headers.get("origin"));
    return new Response(null, { headers, status: 204 });
  }
  return null;
}

/** Attach CORS headers to any Response */
export function withCors(res: Response, req?: Request): Response {
  const headers = new Headers(res.headers);
  const corsHeaders = makeCorsHeaders(req?.headers.get("origin") ?? null);
  for (const [k, v] of Object.entries(corsHeaders)) {
    headers.set(k, v);
  }
  return new Response(res.body, { status: res.status, headers });
}

/** Convenience: return a JSON error with CORS */
export function errorResponse(
  message: string,
  status = 400,
  req?: Request,
): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      ...makeCorsHeaders(req?.headers.get("origin") ?? null),
      "Content-Type": "application/json",
    },
  });
}

/** Convenience: return a JSON success payload with CORS */
export function jsonResponse(
  data: unknown,
  status = 200,
  req?: Request,
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...makeCorsHeaders(req?.headers.get("origin") ?? null),
      "Content-Type": "application/json",
    },
  });
}
