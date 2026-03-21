// ============================================================================
// AUTH TOKEN HELPER — Unified token resolution for service layer
// Phase 5: Supabase JWT first, legacy localStorage fallback
// ============================================================================

import { supabase } from '@/integrations/supabase/client';

const LEGACY_TOKEN_KEYS = [
  'open_access_token',
  'open_api_token',
  'open_token',
  'auth_token',
  'token',
];

// In-memory cache from last successful getSession / onAuthStateChange
let _cachedAccessToken: string | null = null;

/**
 * Called by AuthContext whenever session changes so sync callers always
 * have the freshest token without scanning localStorage.
 */
export function setCachedAccessToken(token: string | null) {
  _cachedAccessToken = token;
}

/**
 * Get the best available auth token (synchronous).
 * Priority: in-memory cache > Supabase localStorage > legacy keys
 */
export function getAuthTokenSync(): string | null {
  // 1. In-memory token set by AuthContext (fastest, always fresh)
  if (_cachedAccessToken) return _cachedAccessToken;

  // 2. Scan Supabase session keys in localStorage
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          const token = parsed?.access_token;
          if (token && typeof token === 'string' && token.length > 20) {
            _cachedAccessToken = token; // cache it
            return token;
          }
        }
      }
    }
  } catch { /* ignore */ }

  // 3. Legacy keys
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
