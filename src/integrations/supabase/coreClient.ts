// coreClient.ts — Re-export do cliente principal após migração para zkjrcenhemnnlmjiysbc
// O projeto core agora é o mesmo projeto Supabase principal.
// Mantém a API pública (coreSupabase) para não quebrar imports existentes.
export { supabase as coreSupabase } from '@/integrations/supabase/client';

// Base URL for edge function direct fetch calls
export const CORE_SUPABASE_URL_VALUE = import.meta.env.VITE_SUPABASE_URL as string;
