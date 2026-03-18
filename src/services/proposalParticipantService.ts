/**
 * Proposal Participant Service
 * 
 * Manages participant relationships (EXECUTIVE, MANAGER, CS, ARCHITECT)
 * to proposals with their specific commission rates.
 * 
 * Note: Uses raw queries because the Supabase types may not be updated yet
 */

import { coreSupabase } from '@/integrations/supabase/coreClient';

// ============================================================================
// TYPES
// ============================================================================

export type ParticipantRole = 'EXECUTIVE' | 'MANAGER' | 'CS' | 'ARCHITECT';

export interface ProposalParticipant {
  id: string;
  proposal_id: string;
  external_user_id: number;
  role: ParticipantRole;
  commission_pct: number | null;
  created_at: string;
  updated_at: string;
}

export interface CreateParticipantInput {
  proposal_id: string;
  external_user_id: number;
  role: ParticipantRole;
  commission_pct?: number | null;
}

// ============================================================================
// ARCHITECT COMMISSION RULES
// ============================================================================

/**
 * Calculate architect commission percentage based on contract duration
 * - 12 months = 1% (0.01)
 * - 24/36/48 months = 0.5% (0.005)
 * - Other durations = 0
 */
export function getArchitectCommissionPct(contractDurationMonths: number): number {
  if (contractDurationMonths === 12) {
    return 0.01; // 1%
  }
  if ([24, 36, 48].includes(contractDurationMonths)) {
    return 0.005; // 0.5%
  }
  return 0; // No commission for other durations
}

/**
 * Format architect commission rule for display
 */
export function getArchitectCommissionRuleText(): string {
  return '12m = 1% do TCV | 24/36/48m = 0,5% do TCV | Pagamento em 3x';
}

// ============================================================================
// CRUD OPERATIONS
// ============================================================================

/**
 * Get all participants for a proposal
 */
export async function getProposalParticipants(proposalId: string): Promise<ProposalParticipant[]> {
  const { data, error } = await (supabase as any)
    .from('proposal_participants')
    .select('*')
    .eq('proposal_id', proposalId);

  if (error) {
    console.error('[proposalParticipantService] Error fetching participants:', error);
    throw error;
  }

  return (data || []) as ProposalParticipant[];
}

/**
 * Get participant by role for a proposal
 */
export async function getParticipantByRole(
  proposalId: string,
  role: ParticipantRole
): Promise<ProposalParticipant | null> {
  const { data, error } = await (supabase as any)
    .from('proposal_participants')
    .select('*')
    .eq('proposal_id', proposalId)
    .eq('role', role)
    .maybeSingle();

  if (error) {
    console.error('[proposalParticipantService] Error fetching participant:', error);
    throw error;
  }

  return data as ProposalParticipant | null;
}

/**
 * Get all proposals where a user is a participant with a specific role
 */
export async function getProposalsByParticipant(
  externalUserId: number,
  role?: ParticipantRole
): Promise<ProposalParticipant[]> {
  let query = (supabase as any)
    .from('proposal_participants')
    .select('*')
    .eq('external_user_id', externalUserId);

  if (role) {
    query = query.eq('role', role);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[proposalParticipantService] Error fetching user proposals:', error);
    throw error;
  }

  return (data || []) as ProposalParticipant[];
}

/**
 * Add or update a participant on a proposal
 * Uses upsert to handle both create and update in one operation
 */
export async function upsertParticipant(input: CreateParticipantInput): Promise<ProposalParticipant> {
  console.log('[proposalParticipantService] Upserting participant:', {
    proposal_id: input.proposal_id,
    external_user_id: input.external_user_id,
    role: input.role,
    commission_pct: input.commission_pct,
  });
  
  const { data, error } = await (supabase as any)
    .from('proposal_participants')
    .upsert(
      {
        proposal_id: input.proposal_id,
        external_user_id: input.external_user_id,
        role: input.role,
        commission_pct: input.commission_pct ?? null,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'proposal_id,external_user_id,role',
      }
    )
    .select()
    .single();

  if (error) {
    console.error('[proposalParticipantService] Error upserting participant:', error);
    throw error;
  }

  console.log('[proposalParticipantService] Participant upserted successfully:', data);
  return data as ProposalParticipant;
}

/**
 * Remove a participant from a proposal
 */
export async function removeParticipant(
  proposalId: string,
  role: ParticipantRole
): Promise<void> {
  const { error } = await (supabase as any)
    .from('proposal_participants')
    .delete()
    .eq('proposal_id', proposalId)
    .eq('role', role);

  if (error) {
    console.error('[proposalParticipantService] Error removing participant:', error);
    throw error;
  }
}

/**
 * Set commission percentage for a participant
 * Called during proposal approval to persist the commission rate
 */
export async function setParticipantCommission(
  proposalId: string,
  role: ParticipantRole,
  commissionPct: number
): Promise<void> {
  const { error } = await (supabase as any)
    .from('proposal_participants')
    .update({ commission_pct: commissionPct, updated_at: new Date().toISOString() })
    .eq('proposal_id', proposalId)
    .eq('role', role);

  if (error) {
    console.error('[proposalParticipantService] Error setting commission:', error);
    throw error;
  }
}

/**
 * Persist architect commission on proposal approval
 */
export async function persistArchitectCommission(
  proposalId: string,
  contractDurationMonths: number
): Promise<void> {
  // Check if there's an architect participant
  const architect = await getParticipantByRole(proposalId, 'ARCHITECT');
  
  if (!architect) {
    console.log('[proposalParticipantService] No architect on proposal, skipping commission');
    return;
  }

  const commissionPct = getArchitectCommissionPct(contractDurationMonths);
  
  await setParticipantCommission(proposalId, 'ARCHITECT', commissionPct);
  
  console.log('[proposalParticipantService] Architect commission persisted:', {
    proposalId,
    architectUserId: architect.external_user_id,
    contractDurationMonths,
    commissionPct,
  });
}

/**
 * Get architect participant for a proposal (shortcut function)
 */
export async function getArchitectParticipant(
  proposalId: string
): Promise<ProposalParticipant | null> {
  return getParticipantByRole(proposalId, 'ARCHITECT');
}

/**
 * Set architect for a proposal (shortcut function)
 */
export async function setArchitectParticipant(
  proposalId: string,
  architectUserId: number
): Promise<ProposalParticipant> {
  return upsertParticipant({
    proposal_id: proposalId,
    external_user_id: architectUserId,
    role: 'ARCHITECT',
  });
}

/**
 * Remove architect from a proposal (shortcut function)
 */
export async function removeArchitectParticipant(proposalId: string): Promise<void> {
  return removeParticipant(proposalId, 'ARCHITECT');
}
