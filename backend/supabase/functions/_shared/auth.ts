// =============================================================================
// Auth helpers — extract and validate caller identity
// =============================================================================

import { createClient, SupabaseClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Service-role client (bypasses RLS — use only for server-side writes)
export function serviceClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
  });
}

// User-scoped client (respects RLS)
export function userClient(jwt: string): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false },
  });
}

export interface CallerIdentity {
  userId: string | null;   // null if anonymous/guest
  guestId: string | null;  // null if authenticated
  jwt: string | null;
  isAuthenticated: boolean;
}

/**
 * Extract caller identity from request headers.
 * - Authenticated users: Bearer JWT in Authorization header.
 * - Guests: x-guest-id header (UUID validated format).
 */
export async function getCallerIdentity(
  req: Request,
): Promise<CallerIdentity> {
  const authHeader = req.headers.get("authorization") ?? "";
  const guestHeader = req.headers.get("x-guest-id") ?? "";

  // --- Authenticated path ---
  if (authHeader.startsWith("Bearer ")) {
    const jwt = authHeader.slice(7);
    const client = userClient(jwt);
    const { data: { user }, error } = await client.auth.getUser();
    if (error || !user) {
      return { userId: null, guestId: null, jwt: null, isAuthenticated: false };
    }
    return { userId: user.id, guestId: null, jwt, isAuthenticated: true };
  }

  // --- Guest path ---
  if (guestHeader && isValidUUID(guestHeader)) {
    return {
      userId: null,
      guestId: guestHeader,
      jwt: null,
      isAuthenticated: false,
    };
  }

  return { userId: null, guestId: null, jwt: null, isAuthenticated: false };
}

// UUID format (8-4-4-4-12 hex). Accepts v1–v5; levels/DB may use non-v4 IDs.
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUUID(value: string): boolean {
  return UUID_RE.test(value);
}

/**
 * Admin-only: verify Bearer JWT and that app_metadata.role === 'admin'.
 * Returns { userId } if valid admin, null otherwise.
 */
export async function requireAdmin(req: Request): Promise<{ userId: string } | null> {
  const authHeader = req.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return null;
  const jwt = authHeader.slice(7);
  const client = userClient(jwt);
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) return null;
  const role = (user.app_metadata as Record<string, unknown>)?.role;
  if (role !== "admin") return null;
  return { userId: user.id };
}
