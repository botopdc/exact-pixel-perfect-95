// ============================================================================
// AUTH CONTEXT — Supabase-first authentication
// Uses Supabase Auth + public.profiles as source of truth
// Maintains backward compatibility via legacy authService
// ============================================================================

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User, Session } from '@supabase/supabase-js';

// ============================================================================
// TYPES
// ============================================================================

export interface UserProfile {
  id: string;           // auth.users UUID
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
  /** Supabase Auth user (null if not logged in) */
  user: User | null;
  /** Supabase session */
  session: Session | null;
  /** Profile from public.profiles */
  profile: UserProfile | null;
  /** True while checking initial session */
  isLoading: boolean;
  /** True if authenticated via Supabase Auth */
  isAuthenticated: boolean;
  /** Sign in with email + password */
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  /** Sign out */
  signOut: () => Promise<void>;
  /** Reload profile from database */
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
  const [isLoading, setIsLoading] = useState(true);

  // Load profile from public.profiles
  const loadProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('[AuthContext] Profile load error:', error.message);
        return null;
      }

      if (!data) {
        console.warn('[AuthContext] No profile found for user:', userId);
        return null;
      }

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

      if (import.meta.env.DEV) {
        console.log('[AuthContext] Profile loaded:', {
          id: p.id,
          email: p.email,
          level: p.level,
          legacy_user_id: p.legacy_user_id,
        });
      }

      setProfile(p);
      return p;
    } catch (err) {
      console.error('[AuthContext] Profile load exception:', err);
      return null;
    }
  }, []);

  // Initialize auth state
  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        if (import.meta.env.DEV) {
          console.log('[AuthContext] Auth event:', event, currentSession?.user?.email);
        }

        setSession(currentSession);
        setUser(currentSession?.user ?? null);

        if (currentSession?.user) {
          // Use setTimeout to avoid potential deadlock with Supabase client
          setTimeout(() => loadProfile(currentSession.user.id), 0);
        } else {
          setProfile(null);
        }
      }
    );

    // THEN check existing session
    supabase.auth.getSession().then(({ data: { session: existingSession } }) => {
      setSession(existingSession);
      setUser(existingSession?.user ?? null);

      if (existingSession?.user) {
        loadProfile(existingSession.user.id).finally(() => setIsLoading(false));
      } else {
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [loadProfile]);

  // Sign in
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

      // Profile will be loaded by onAuthStateChange
      return { success: true };
    } catch (err) {
      console.error('[AuthContext] Sign in exception:', err);
      return { success: false, error: 'Erro ao conectar. Tente novamente.' };
    }
  }, []);

  // Sign out
  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
  }, []);

  // Refresh profile
  const refreshProfile = useCallback(async () => {
    if (user) {
      await loadProfile(user.id);
    }
  }, [user, loadProfile]);

  const value: AuthContextValue = {
    user,
    session,
    profile,
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
