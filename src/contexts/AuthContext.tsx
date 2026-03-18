// ============================================================================
// AUTH CONTEXT — Supabase-first authentication
// Uses Supabase Auth + public.profiles + public.user_roles
// ============================================================================

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User, Session } from '@supabase/supabase-js';
import type { UserRole } from '@/lib/rbac';

// ============================================================================
// TYPES
// ============================================================================

export interface UserProfile {
  id: string;
  legacy_user_id: number | null;
  name: string;
  email: string;
  level: number;
  role_code: string | null;
  entity_id: number | null;
  company_id: number | null;
  department: string | null;
  is_active: boolean;
  avatar_url: string | null;
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  /** Active user roles from public.user_roles */
  roles: UserRole[];
  isLoading: boolean;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// ============================================================================
// PROVIDER
// ============================================================================

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const initialised = useRef(false);

  // Load profile + roles
  const loadProfile = useCallback(async (userId: string): Promise<UserProfile | null> => {
    try {
      if (import.meta.env.DEV) {
        console.log('[AuthContext] Loading profile for:', userId);
      }

      const [profileRes, rolesRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, legacy_user_id, name, full_name, email, level, level_legacy, role_code, entity_id, company_id, department, is_active, avatar_url')
          .eq('id', userId)
          .maybeSingle(),
        (supabase as any)
          .from('user_roles')
          .select('id, role_slug')
          .eq('user_id', userId),
      ]);

      if (profileRes.error) {
        console.error('[AuthContext] Profile load error:', profileRes.error.message);
        return null;
      }

      if (!profileRes.data) {
        console.warn('[AuthContext] No profile found for user:', userId);
        return null;
      }

      const data = profileRes.data;
      const p: UserProfile = {
        id: data.id,
        legacy_user_id: data.legacy_user_id,
        name: data.name,
        email: data.email,
        level: data.level,
        role_code: data.role_code,
        entity_id: data.entity_id,
        company_id: data.company_id,
        department: data.department,
        is_active: data.is_active,
        avatar_url: data.avatar_url,
      };

      const userRoles: UserRole[] = (rolesRes.data || []).map((r: any) => ({
        role_id: r.role_id,
        role_code: (r.roles as any)?.code || '',
        is_active: r.is_active,
      }));

      if (import.meta.env.DEV) {
        console.log('[AuthContext] Profile loaded:', {
          id: p.id,
          email: p.email,
          level: p.level,
          legacy_user_id: p.legacy_user_id,
          roles: userRoles.map(r => r.role_code),
        });
      }

      setProfile(p);
      setRoles(userRoles);
      return p;
    } catch (err) {
      console.error('[AuthContext] Profile load exception:', err);
      return null;
    }
  }, []);

  // Initialize auth state
  useEffect(() => {
    // 1) Set up listener FIRST (per Supabase best practices)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        if (import.meta.env.DEV) {
          console.log('[AuthContext] Auth event:', event, {
            email: currentSession?.user?.email ?? 'none',
            initialised: initialised.current,
          });
        }

        setSession(currentSession);
        setUser(currentSession?.user ?? null);

        if (currentSession?.user) {
          // Use setTimeout to avoid Supabase deadlock (their recommendation)
          // but only for NON-initial events. Initial load is handled by getSession.
          if (initialised.current) {
            setTimeout(async () => {
              await loadProfile(currentSession.user.id);
            }, 0);
          }
        } else {
          setProfile(null);
          setRoles([]);
          // If already initialised, we can stop loading
          if (initialised.current) {
            setIsLoading(false);
          }
        }
      }
    );

    // 2) Restore existing session
    supabase.auth.getSession().then(async ({ data: { session: existingSession } }) => {
      if (import.meta.env.DEV) {
        console.log('[AuthContext] getSession result:', {
          hasSession: !!existingSession,
          email: existingSession?.user?.email ?? 'none',
        });
      }

      setSession(existingSession);
      setUser(existingSession?.user ?? null);

      if (existingSession?.user) {
        await loadProfile(existingSession.user.id);
      }

      initialised.current = true;
      setIsLoading(false);

      if (import.meta.env.DEV) {
        console.log('[AuthContext] Initialisation complete, isLoading=false');
      }
    });

    return () => subscription.unsubscribe();
  }, [loadProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase().trim(),
        password,
      });

      if (error) {
        console.error('[AuthContext] Sign in error:', error.message);
        return { success: false, error: error.message === 'Invalid login credentials'
          ? 'Email ou senha incorretos'
          : error.message };
      }

      if (!data.user) {
        return { success: false, error: 'Erro inesperado ao autenticar' };
      }

      // Proactively load profile so it's available immediately
      await loadProfile(data.user.id);

      if (import.meta.env.DEV) {
        console.log('[AuthContext] signIn success:', data.user.email);
      }

      return { success: true };
    } catch (err) {
      console.error('[AuthContext] Sign in exception:', err);
      return { success: false, error: 'Erro ao conectar. Tente novamente.' };
    }
  }, [loadProfile]);

  const signOut = useCallback(async () => {
    if (import.meta.env.DEV) {
      console.log('[AuthContext] signOut called');
    }
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setRoles([]);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) {
      await loadProfile(user.id);
    }
  }, [user, loadProfile]);

  const value: AuthContextValue = {
    user,
    session,
    profile,
    roles,
    isLoading,
    isAuthenticated: !!session && !!user,
    signIn,
    signOut,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ============================================================================
// HOOK
// ============================================================================

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
