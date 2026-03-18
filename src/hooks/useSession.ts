// ============================================================================
// useSession — Compatibility bridge from authService to Supabase Auth
// 
// Drop-in replacement for `authService.getSession()` and `authService.getCurrentUser()`.
// Reads identity from useAuth() (Supabase), NOT localStorage.
// 
// Usage:
//   import { useSession } from '@/hooks/useSession';
//   const { session, user, level, isAuthenticated, isAdmin } = useSession();
// ============================================================================

import { useAuth } from '@/contexts/AuthContext';

export interface SessionData {
  userId: string;
  email: string;
  name: string;
  level: number;
  role: string;
  roles: string[];
  isAuthenticated: boolean;
  isLoading: boolean;
}

/**
 * useSession — Supabase-first session hook.
 * Replaces authService.getSession() / authService.getCurrentUser().
 */
export function useSession() {
  const { user, profile, roles, session, isLoading, isAuthenticated, signOut } = useAuth();

  const sessionData: SessionData = {
    userId: profile?.id || '',
    email: profile?.email || user?.email || '',
    name: profile?.name || profile?.full_name || '',
    level: profile?.level ?? 0,
    role: profile?.role_code || '',
    roles: roles.map(r => r.role_slug),
    isAuthenticated,
    isLoading,
  };

  return {
    ...sessionData,
    user,
    profile,
    session,
    signOut,
    // Helpers matching authService interface
    isAdmin: (profile?.level ?? 0) >= 1000 || roles.some(r => r.role_slug === 'admin'),
    hasLevel: (required: number) => (profile?.level ?? 0) >= required,
    hasRole: (slug: string) => roles.some(r => r.role_slug === slug),
    hasAnyRole: (slugs: string[]) => slugs.some(s => roles.some(r => r.role_slug === s)),
  };
}
