// ============================================================================
// useSession — Compatibility bridge from authService to Supabase Auth
// Phase 4: UUID is the primary identity. legacy_user_id is kept as a bridge.
// ============================================================================

import { useAuth } from '@/contexts/AuthContext';
import { getEffectiveRoles } from '@/lib/rbac';

export interface SessionData {
  /** Supabase Auth UUID — primary identity */
  userId: string;
  /** Legacy integer user ID (from profiles.legacy_user_id) — bridge only */
  legacyUserId: number | null;
  email: string;
  name: string;
  level: number;
  role: string;
  roles: string[];
  effectiveRoles: string[];
  isAuthenticated: boolean;
  isLoading: boolean;
}

/**
 * useSession — Supabase-first session hook.
 * Phase 4: userId is always the Supabase UUID.
 * legacyUserId is available separately for services that still need integer IDs.
 */
export function useSession() {
  const { user, profile, roles, session, isLoading, isAuthenticated, signOut } = useAuth();

  const effectiveRoles = getEffectiveRoles(roles, profile);

  const sessionData: SessionData = {
    userId: profile?.id || user?.id || '',
    legacyUserId: profile?.legacy_user_id ?? null,
    email: profile?.email || user?.email || '',
    name: profile?.name || profile?.full_name || '',
    level: profile?.level ?? 0,
    role: profile?.role_code || '',
    roles: roles.map(r => r.role_slug),
    effectiveRoles,
    isAuthenticated,
    isLoading,
  };

  return {
    ...sessionData,
    user,
    profile,
    session,
    signOut,
    // Role-based helpers
    isAdmin: effectiveRoles.includes('admin'),
    hasLevel: (required: number) => (profile?.level ?? 0) >= required,
    hasRole: (slug: string) => effectiveRoles.includes(slug),
    hasAnyRole: (slugs: string[]) => slugs.some(s => effectiveRoles.includes(s)),
  };
}
