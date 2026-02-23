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

// RFC 4122 UUID v4 pattern
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidUUID(value: string): boolean {
  return UUID_RE.test(value);
}
