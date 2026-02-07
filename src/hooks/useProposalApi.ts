/**
 * useProposalApi - React Query hooks for proposals via Edge Functions
 * 
 * Replaces direct Supabase queries with Edge Function calls that use Service Role.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import {
  listProposals,
  getProposal,
  saveProposal,
  deleteProposal,
  ProposalListParams,
  ProposalSavePayload,
} from '@/services/proposalApi';

// ============================================================================
// QUERY KEYS
// ============================================================================

export const PROPOSAL_API_KEYS = {
  all: ['proposals-api'] as const,
  lists: () => [...PROPOSAL_API_KEYS.all, 'list'] as const,
  list: (params: ProposalListParams) => [...PROPOSAL_API_KEYS.lists(), params] as const,
  details: () => [...PROPOSAL_API_KEYS.all, 'detail'] as const,
  detail: (id: string) => [...PROPOSAL_API_KEYS.details(), id] as const,
};

// ============================================================================
// LIST PROPOSALS HOOK
// ============================================================================

export function useProposalList(page: number = 1, params: Omit<ProposalListParams, 'offset'> = {}) {
  const perPage = params.limit || 15;
  const offset = (page - 1) * perPage;

  const fullParams: ProposalListParams = {
    ...params,
    limit: perPage,
    offset,
  };

  return useQuery({
    queryKey: PROPOSAL_API_KEYS.list(fullParams),
    queryFn: () => listProposals(fullParams),
    staleTime: 30 * 1000, // 30 seconds
  });
}

// ============================================================================
// GET SINGLE PROPOSAL HOOK
// ============================================================================

export function useProposalDetail(proposalId: string | undefined) {
  return useQuery({
    queryKey: PROPOSAL_API_KEYS.detail(proposalId || ''),
    queryFn: () => (proposalId ? getProposal(proposalId) : Promise.resolve(null)),
    enabled: !!proposalId,
    staleTime: 60 * 1000, // 1 minute
  });
}

// ============================================================================
// SAVE PROPOSAL MUTATION
// ============================================================================

export function useSaveProposal() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (payload: ProposalSavePayload) => saveProposal(payload),
    onSuccess: (result, variables) => {
      if (result.success) {
        // Invalidate lists
        queryClient.invalidateQueries({ queryKey: PROPOSAL_API_KEYS.lists() });
        
        // Invalidate specific proposal if updating
        if (variables.proposal.id) {
          queryClient.invalidateQueries({ 
            queryKey: PROPOSAL_API_KEYS.detail(variables.proposal.id as string) 
          });
        }

        toast({
          title: variables.proposal.id ? 'Proposta atualizada' : 'Proposta criada',
          description: `ID: ${result.proposalId.substring(0, 8)}...`,
        });
      } else {
        toast({
          title: 'Erro ao salvar proposta',
          description: result.error || 'Erro desconhecido',
          variant: 'destructive',
        });
      }
    },
    onError: (error: Error) => {
      console.error('[useSaveProposal] Error:', error);
      toast({
        title: 'Erro ao salvar proposta',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// ============================================================================
// DELETE PROPOSAL MUTATION
// ============================================================================

export function useDeleteProposal() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (proposalId: string) => deleteProposal(proposalId),
    onSuccess: (result, proposalId) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: PROPOSAL_API_KEYS.lists() });
        queryClient.removeQueries({ queryKey: PROPOSAL_API_KEYS.detail(proposalId) });

        toast({
          title: 'Proposta excluída',
          description: 'A proposta foi removida com sucesso.',
        });
      } else {
        toast({
          title: 'Erro ao excluir',
          description: result.error || 'Erro desconhecido',
          variant: 'destructive',
        });
      }
    },
    onError: (error: Error) => {
      console.error('[useDeleteProposal] Error:', error);
      toast({
        title: 'Erro ao excluir',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
