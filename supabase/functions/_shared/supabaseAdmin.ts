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
 * Validate external auth token
 * 
 * If EXTERNAL_AUTH_URL env is set, calls ${EXTERNAL_AUTH_URL}/validate
 * Otherwise, accepts token with minimum length (MVP stub)
 * 
 * TODO: Replace MVP stub with real validation when EXTERNAL_AUTH_URL is configured
 */
export async function validateExternalToken(token: string): Promise<{ valid: boolean; error?: string }> {
  const externalAuthUrl = Deno.env.get("EXTERNAL_AUTH_URL");

  if (externalAuthUrl) {
    // Real validation via external API
    try {
      const response = await fetch(`${externalAuthUrl}/validate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        return { valid: false, error: "External auth validation failed" };
      }

      return { valid: true };
    } catch (err) {
      console.error("External auth validation error:", err);
      return { valid: false, error: "External auth service unavailable" };
    }
  }

  // MVP stub: accept token if it has minimum length
  // TODO: Implement real token validation when EXTERNAL_AUTH_URL is configured
  const MIN_TOKEN_LENGTH = 10;
  if (token.length >= MIN_TOKEN_LENGTH) {
    console.warn("[MVP] Token accepted via length check only. Configure EXTERNAL_AUTH_URL for real validation.");
    return { valid: true };
  }

  return { valid: false, error: "Token too short" };
}

/**
 * Validate admin PIN
 */
export function validateAdminPin(pin: string | null): boolean {
  const expectedPin = Deno.env.get("ADMIN_PIN") || "5678"; // fallback for dev
  return pin === expectedPin;
}
