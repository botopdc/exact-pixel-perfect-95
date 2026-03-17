/**
 * useSupabaseProposals - React Query hook for Supabase-based proposals
 * 
 * This hook provides CRUD operations for proposals using Supabase as the source of truth.
 * It replaces the API-based useProposals for the new proposal system.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import {
  supabaseProposalService,
  listProposals,
  getProposal,
  getProposalWithItems,
  saveProposal,
  deleteProposal,
  updateProposalStatus,
  uploadPdfToStorage,
  getPdfSignedUrl,
} from '@/services/supabaseProposalService';
import type {
  CalculatorProposalRow,
  CalculatorProposalWithRelations,
  SaveProposalPayload,
  ProposalListFilters,
  ProposalListResult,
} from '@/types/calculatorProposal';

// ============================================================================
// QUERY KEYS
// ============================================================================

export const SUPABASE_PROPOSAL_KEYS = {
  all: ['supabase-proposals'] as const,
  lists: () => [...SUPABASE_PROPOSAL_KEYS.all, 'list'] as const,
  list: (filters: ProposalListFilters) => [...SUPABASE_PROPOSAL_KEYS.lists(), filters] as const,
  details: () => [...SUPABASE_PROPOSAL_KEYS.all, 'detail'] as const,
  detail: (id: string) => [...SUPABASE_PROPOSAL_KEYS.details(), id] as const,
};

// ============================================================================
// LIST PROPOSALS HOOK
// ============================================================================

export function useSupabaseProposals(page: number = 1, filters: Omit<ProposalListFilters, 'offset'> = {}) {
  const perPage = filters.limit || 15;
  const offset = (page - 1) * perPage;

  const fullFilters: ProposalListFilters = {
    ...filters,
    limit: perPage,
    offset,
  };

  return useQuery({
    queryKey: SUPABASE_PROPOSAL_KEYS.list(fullFilters),
    queryFn: () => listProposals(fullFilters),
    staleTime: 30_000,
  });
}

// ============================================================================
// GET SINGLE PROPOSAL HOOK
// ============================================================================

export function useSupabaseProposal(proposalId: string | undefined) {
  return useQuery({
    queryKey: SUPABASE_PROPOSAL_KEYS.detail(proposalId || ''),
    queryFn: () => (proposalId ? getProposal(proposalId) : Promise.resolve(null)),
    enabled: !!proposalId,
    staleTime: 60 * 1000, // 1 minute
  });
}

// ============================================================================
// GET PROPOSAL WITH ITEMS HOOK (for edit mode)
// ============================================================================

export function useSupabaseProposalWithItems(proposalId: string | undefined) {
  return useQuery({
    queryKey: [...SUPABASE_PROPOSAL_KEYS.detail(proposalId || ''), 'with-items'],
    queryFn: async () => {
      if (!proposalId) return null;
      const result = await getProposalWithItems(proposalId);
      console.log('[useSupabaseProposalWithItems] Loaded:', {
        proposalId,
        serversCount: result?.servers?.length || 0,
        addonsCount: result?.addons?.length || 0,
      });
      return result;
    },
    enabled: !!proposalId,
    staleTime: 60 * 1000,
  });
}

// ============================================================================
// SAVE PROPOSAL MUTATION
// ============================================================================

export function useSaveSupabaseProposal() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (payload: SaveProposalPayload) => saveProposal(payload),
    onSuccess: (proposalId, variables) => {
      // Invalidate lists
      queryClient.invalidateQueries({ queryKey: SUPABASE_PROPOSAL_KEYS.lists() });
      
      // Invalidate specific proposal if updating
      if (variables.proposal.id) {
        queryClient.invalidateQueries({ queryKey: SUPABASE_PROPOSAL_KEYS.detail(variables.proposal.id) });
      }

      toast({
        title: variables.proposal.id ? 'Proposta atualizada' : 'Proposta criada',
        description: `ID: ${proposalId.substring(0, 8)}...`,
      });
    },
    onError: (error: Error) => {
      console.error('[useSaveSupabaseProposal] Error:', error);
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

export function useDeleteSupabaseProposal() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (proposalId: string) => deleteProposal(proposalId),
    onSuccess: (_, proposalId) => {
      queryClient.invalidateQueries({ queryKey: SUPABASE_PROPOSAL_KEYS.lists() });
      queryClient.removeQueries({ queryKey: SUPABASE_PROPOSAL_KEYS.detail(proposalId) });

      toast({
        title: 'Proposta excluída',
        description: 'A proposta foi removida com sucesso.',
      });
    },
    onError: (error: Error) => {
      console.error('[useDeleteSupabaseProposal] Error:', error);
      toast({
        title: 'Erro ao excluir',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// ============================================================================
// UPDATE STATUS MUTATION
// ============================================================================

export function useUpdateSupabaseProposalStatus() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ proposalId, status }: { proposalId: string; status: string }) =>
      updateProposalStatus(proposalId, status),
    onSuccess: (_, { proposalId, status }) => {
      queryClient.invalidateQueries({ queryKey: SUPABASE_PROPOSAL_KEYS.lists() });
      queryClient.invalidateQueries({ queryKey: SUPABASE_PROPOSAL_KEYS.detail(proposalId) });

      toast({
        title: 'Status atualizado',
        description: `Novo status: ${status}`,
      });
    },
    onError: (error: Error) => {
      console.error('[useUpdateSupabaseProposalStatus] Error:', error);
      toast({
        title: 'Erro ao atualizar status',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// ============================================================================
// UPLOAD PDF MUTATION
// ============================================================================

export function useUploadProposalPdf() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ proposalId, pdfBlob, fileName }: { proposalId: string; pdfBlob: Blob; fileName?: string }) =>
      uploadPdfToStorage(proposalId, pdfBlob, fileName),
    onSuccess: (result, { proposalId }) => {
      queryClient.invalidateQueries({ queryKey: SUPABASE_PROPOSAL_KEYS.detail(proposalId) });

      toast({
        title: 'PDF salvo',
        description: 'O PDF foi salvo no storage.',
      });
    },
    onError: (error: Error) => {
      console.error('[useUploadProposalPdf] Error:', error);
      toast({
        title: 'Erro ao salvar PDF',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// ============================================================================
// GET PDF SIGNED URL
// ============================================================================

export async function getProposalPdfUrl(storagePath: string): Promise<string> {
  return getPdfSignedUrl(storagePath);
}
