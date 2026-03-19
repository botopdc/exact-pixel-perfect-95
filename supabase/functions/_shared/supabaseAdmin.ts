// ============================================================================
// SHARED SUPABASE ADMIN CLIENT
// Uses SERVICE_ROLE_KEY for privileged database access
// ============================================================================

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

let supabaseAdmin: SupabaseClient | null = null;

/**
 * Get or create Supabase admin client with SERVICE_ROLE_KEY
 * This client bypasses RLS and should only be used in Edge Functions
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (supabaseAdmin) {
    return supabaseAdmin;
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return supabaseAdmin;
}

/**
 * Validate auth token — Supabase JWT first, external fallback.
 * 
 * Priority:
 * 1. Verify as Supabase JWT using SUPABASE_URL + SUPABASE_ANON_KEY
 * 2. If EXTERNAL_AUTH_URL is set, call external validation endpoint
 * 3. Reject otherwise (no more length-based stubs)
 */
export async function validateExternalToken(token: string): Promise<{ valid: boolean; error?: string; userId?: string }> {
  if (!token || token.length < 10) {
    return { valid: false, error: "Token missing or too short" };
  }

  // 1. Try Supabase JWT verification
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (supabaseUrl && anonKey) {
      const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.49.1");
      const sb = createClient(supabaseUrl, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const { data, error } = await sb.auth.getUser(token);
      if (!error && data?.user?.id) {
        return { valid: true, userId: data.user.id };
      }
      // Not a valid Supabase JWT — fall through to external validation
    }
  } catch {
    // Not a Supabase JWT — continue
  }

  // 2. External auth validation (legacy Laravel tokens)
  const externalAuthUrl = Deno.env.get("EXTERNAL_AUTH_URL");
  if (externalAuthUrl) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const response = await fetch(`${externalAuthUrl.replace(/\/$/, "")}/validate`, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (response.ok) {
        return { valid: true };
      }
      return { valid: false, error: "External auth validation failed" };
    } catch (err) {
      const error = err as Error;
      console.warn("[validateExternalToken] External validation error:", error.message);
      return { valid: false, error: "External auth service unavailable" };
    }
  }

  // 3. No validation method available — reject
  console.warn("[validateExternalToken] No validation method available. Set EXTERNAL_AUTH_URL or use Supabase JWT.");
  return { valid: false, error: "No auth validation method configured" };
}

/**
 * Validate admin PIN
 */
export function validateAdminPin(pin: string | null): boolean {
  const expectedPin = Deno.env.get("ADMIN_PIN") || "5678"; // fallback for dev
  return pin === expectedPin;
}
