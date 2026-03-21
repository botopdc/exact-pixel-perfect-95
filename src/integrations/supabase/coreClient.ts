/**
 * Core-Open Supabase Client
 * 
 * Dedicated client for the core-open Supabase project.
 * Used EXCLUSIVELY for the proposals and pricing domain.
 * 
 * All other domains (auth, users, partners, etc.) continue using
 * the managed client from ./client.ts
 * 
 * Required env vars:
 *   VITE_CORE_SUPABASE_URL
 *   VITE_CORE_SUPABASE_ANON_KEY
 */

import { createClient } from '@supabase/supabase-js';

const CORE_SUPABASE_URL = import.meta.env.VITE_CORE_SUPABASE_URL || 'https://zkjrcenhemnnlmjiysbc.supabase.co';
const CORE_SUPABASE_ANON_KEY = import.meta.env.VITE_CORE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpranJjZW5oZW1ubmxtaml5c2JjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4NDEzMzcsImV4cCI6MjA4OTQxNzMzN30.vsjwi26RvTOuIaH9LDAQyhXD0PL7nWdCiVuKMlvtBG8';

if (!CORE_SUPABASE_URL) {
  console.warn('[coreClient] VITE_CORE_SUPABASE_URL is not set and no fallback available.');
}

if (!CORE_SUPABASE_ANON_KEY) {
  console.warn('[coreClient] VITE_CORE_SUPABASE_ANON_KEY is not set and no fallback available.');
}

/**
 * Supabase client pointing to the core-open project.
 * 
 * Usage:
 *   import { coreSupabase } from '@/integrations/supabase/coreClient';
 * 
 * This client does NOT share auth session with the managed project.
 * Edge Functions invoked via this client hit core-open's functions.
 */
export const coreSupabase = createClient(CORE_SUPABASE_URL, CORE_SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
  global: {
    headers: { 'X-Client-Info': 'core-open-client' },
  },
});

/**
 * Base URL for core-open (for direct fetch calls to edge functions)
 */
export const CORE_SUPABASE_URL_VALUE = CORE_SUPABASE_URL as string;
