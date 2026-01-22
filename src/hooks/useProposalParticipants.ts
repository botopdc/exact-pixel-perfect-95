/**
 * Proposal Participants Hook
 * 
 * React Query hooks for managing proposal participants
 * (EXECUTIVE, MANAGER, CS, ARCHITECT)
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ProposalParticipant,
  ParticipantRole,
  getProposalParticipants,
  getParticipantByRole,
  getProposalsByParticipant,
  upsertParticipant,
  removeParticipant,
  setParticipantCommission,
  persistArchitectCommission,
  getArchitectParticipant,
  setArchitectParticipant,
  removeArchitectParticipant,
} from '@/services/proposalParticipantService';

// ============================================================================
// QUERY KEYS
// ============================================================================

const PARTICIPANTS_KEY = 'proposal-participants';
const USER_PROPOSALS_KEY = 'user-proposal-participations';

// ============================================================================
// QUERY HOOKS
// ============================================================================

/**
 * Get all participants for a proposal
 */
export function useProposalParticipants(proposalId: string | null | undefined) {
  return useQuery({
    queryKey: [PARTICIPANTS_KEY, proposalId],
    queryFn: () => getProposalParticipants(proposalId!),
    enabled: !!proposalId,
    staleTime: 30_000, // 30 seconds
  });
}

/**
 * Get architect participant for a proposal
 */
export function useArchitectParticipant(proposalId: string | null | undefined) {
  return useQuery({
    queryKey: [PARTICIPANTS_KEY, proposalId, 'ARCHITECT'],
    queryFn: () => getArchitectParticipant(proposalId!),
    enabled: !!proposalId,
    staleTime: 30_000,
  });
}

/**
 * Get all proposals where a user participates (optionally filtered by role)
 */
export function useUserProposalParticipations(
  externalUserId: number | null | undefined,
  role?: ParticipantRole
) {
  return useQuery({
    queryKey: [USER_PROPOSALS_KEY, externalUserId, role],
    queryFn: () => getProposalsByParticipant(externalUserId!, role),
    enabled: !!externalUserId,
    staleTime: 30_000,
  });
}

// ============================================================================
// MUTATION HOOKS
// ============================================================================

/**
 * Add or update a participant on a proposal
 */
export function useUpsertParticipant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: upsertParticipant,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [PARTICIPANTS_KEY, data.proposal_id] });
      queryClient.invalidateQueries({ queryKey: [USER_PROPOSALS_KEY, data.external_user_id] });
    },
  });
}

/**
 * Remove a participant from a proposal
 */
export function useRemoveParticipant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ proposalId, role }: { proposalId: string; role: ParticipantRole }) =>
      removeParticipant(proposalId, role),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [PARTICIPANTS_KEY, variables.proposalId] });
      queryClient.invalidateQueries({ queryKey: [USER_PROPOSALS_KEY] });
    },
  });
}

/**
 * Set architect for a proposal
 */
export function useSetArchitect() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ proposalId, architectUserId }: { proposalId: string; architectUserId: number }) =>
      setArchitectParticipant(proposalId, architectUserId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [PARTICIPANTS_KEY, data.proposal_id] });
      queryClient.invalidateQueries({ queryKey: [USER_PROPOSALS_KEY, data.external_user_id] });
    },
  });
}

/**
 * Remove architect from a proposal
 */
export function useRemoveArchitect() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (proposalId: string) => removeArchitectParticipant(proposalId),
    onSuccess: (_, proposalId) => {
      queryClient.invalidateQueries({ queryKey: [PARTICIPANTS_KEY, proposalId] });
      queryClient.invalidateQueries({ queryKey: [USER_PROPOSALS_KEY] });
    },
  });
}

/**
 * Persist architect commission during approval
 */
export function usePersistArchitectCommission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ proposalId, contractDurationMonths }: { proposalId: string; contractDurationMonths: number }) =>
      persistArchitectCommission(proposalId, contractDurationMonths),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [PARTICIPANTS_KEY, variables.proposalId] });
    },
  });
}

// Re-export types
export type { ProposalParticipant, ParticipantRole };
