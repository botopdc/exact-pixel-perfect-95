// ============================================================================
// BACKFILL SERVICE — Phase 6: Dynamic import from legacy API + onboarding
// ============================================================================

import { supabase } from '@/integrations/supabase/client';
import { openApi, type ApiUser } from '@/lib/openApi';

export interface LegacyUserPayload {
  id: number;
  name: string;
  email: string;
  level: number;
  entity_id?: number | null;
  company_id?: number | null;
  is_active?: boolean;
}

export interface UserReport {
  email: string;
  legacy_id: number;
  level: number;
  status: string;
  reason?: string;
  roles_to_assign: string[];
  existing_profile_id?: string;
  conflict_details?: string;
}

export interface BackfillResult {
  total_analysed: number;
  eligible: number;
  already_exist: number;
  invalid_emails: number;
  duplicates: number;
  legacy_id_conflicts: number;
  created: number;
  invited: number;
  errors: { email: string; reason: string }[];
  roles_assigned: { email: string; roles: string[] }[];
  user_reports: UserReport[];
}

export interface ReconcileCheckResult {
  email: string;
  legacy_id: number;
  has_auth_user: boolean;
  has_profile: boolean;
  has_internal_role: boolean;
  profile_level: number | null;
  legacy_user_id_in_profile: number | null;
  level_match: boolean;
  legacy_id_match: boolean;
  has_level_legacy: boolean;
  has_full_name: boolean;
  issues: string[];
}

// ============================================================================
// FETCH LEGACY USERS — from legacy API
// ============================================================================

export async function fetchLegacyUsers(opts?: {
  levelMin?: number;
  perPage?: number;
}): Promise<LegacyUserPayload[]> {
  const { levelMin = 600, perPage = 500 } = opts || {};

  console.log('[backfill] Fetching users from legacy API...');
  const response = await openApi.getUsers({ __perPage: perPage });

  const internal = response.data.filter((u: ApiUser) => u.level >= levelMin);
  console.log(`[backfill] Found ${internal.length} internal users (level >= ${levelMin})`);

  return internal.map((u: ApiUser) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    level: u.level,
    entity_id: u.entity_id || null,
    company_id: null,
    is_active: u.deleted_at == null,
  }));
}

// ============================================================================
// DRY RUN
// ============================================================================

export async function runDryRun(opts: {
  pin: string;
  users: LegacyUserPayload[];
}): Promise<BackfillResult> {
  const { data, error } = await supabase.functions.invoke('user-backfill', {
    body: { pin: opts.pin, dry_run: true, assign_roles: true, users: opts.users },
  });
  if (error) throw new Error(error.message);
  if (!data?.success) throw new Error(data?.error || 'Dry run falhou');
  return data.result as BackfillResult;
}

// ============================================================================
// RECONCILE CHECK
// ============================================================================

export async function runReconcileCheck(opts: {
  pin: string;
  users: LegacyUserPayload[];
}): Promise<ReconcileCheckResult[]> {
  const { data, error } = await supabase.functions.invoke('user-backfill', {
    body: { pin: opts.pin, action: 'reconcile_check', users: opts.users },
  });
  if (error) throw new Error(error.message);
  return data?.results || [];
}

// ============================================================================
// RECONCILE FIX
// ============================================================================

export async function runReconcileFix(opts: {
  pin: string;
  fixType: string;
  user: LegacyUserPayload;
}): Promise<{ success: boolean; message?: string; error?: string }> {
  const { data, error } = await supabase.functions.invoke('user-backfill', {
    body: { pin: opts.pin, action: 'reconcile_fix', fix_type: opts.fixType, user: opts.user },
  });
  if (error) throw new Error(error.message);
  return data;
}

// ============================================================================
// REAL BACKFILL
// ============================================================================

export async function runRealBackfill(opts: {
  pin: string;
  users: LegacyUserPayload[];
  sendInvites?: boolean;
}): Promise<BackfillResult> {
  const { data, error } = await supabase.functions.invoke('user-backfill', {
    body: {
      pin: opts.pin,
      dry_run: false,
      assign_roles: true,
      send_invites: opts.sendInvites ?? false,
      users: opts.users,
    },
  });
  if (error) throw new Error(error.message);
  if (!data?.success) throw new Error(data?.error || 'Backfill falhou');
  return data.result as BackfillResult;
}

// ============================================================================
// SEND INVITE (individual)
// ============================================================================

export async function sendInvite(opts: {
  pin: string;
  email: string;
}): Promise<{ success: boolean; message?: string; error?: string }> {
  const { data, error } = await supabase.functions.invoke('user-backfill', {
    body: { pin: opts.pin, action: 'send_invite', email: opts.email },
  });
  if (error) throw new Error(error.message);
  return data;
}
