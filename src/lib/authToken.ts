// ============================================================================
// AUTH TOKEN HELPER — Unified token resolution for service layer
// Phase 5: Supabase JWT first, legacy localStorage fallback
// ============================================================================

import { supabase } from '@/integrations/supabase/client';

const AUTH_TOKEN_KEY = 'open_access_token';
const LEGACY_AUTH_TOKEN_KEY = 'open_api_token';
const LEGACY_TOKEN_KEYS = ['open_token', 'auth_token', 'token'];

/**
 * Get the best available auth token (synchronous).
 * Priority: Supabase JWT > open_access_token > open_api_token > other legacy keys
 */
export function getAuthTokenSync(): string | null {
  // 1. Try Supabase session (stored in localStorage by supabase-js)
  try {
    const sbKey = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
    if (sbKey) {
      const raw = localStorage.getItem(sbKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        const token = parsed?.access_token;
        if (token && typeof token === 'string' && token.length > 20) {
          return token;
        }
      }
    }
  } catch { /* ignore */ }

  // 2. Try legacy keys
  const legacy = localStorage.getItem(AUTH_TOKEN_KEY) || localStorage.getItem(LEGACY_AUTH_TOKEN_KEY);
  if (legacy) return legacy;

  // 3. Try other legacy keys (used by proposalApi)
  for (const key of LEGACY_TOKEN_KEYS) {
    const val = localStorage.getItem(key);
    if (val) return val;
  }

  return null;
}

/**
 * Get the best available auth token (async — more reliable).
 * Uses supabase.auth.getSession() for guaranteed fresh token.
 */
export async function getAuthTokenAsync(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    if (data.session?.access_token) {
      return data.session.access_token;
    }
  } catch { /* ignore */ }

  // Fallback to sync
  return getAuthTokenSync();
}

/**
 * Build Authorization header from best available token.
 */
export function buildAuthHeaders(): Record<string, string> {
  const token = getAuthTokenSync();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
