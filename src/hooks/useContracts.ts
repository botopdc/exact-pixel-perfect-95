/**
 * Hook for contract operations (Supabase-backed)
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { contractService, type CreateContractInput } from '@/services/contractService';
import type { ContractFilters, ContractStatus } from '@/types/contract';
import { toast } from 'sonner';

const QUERY_KEY = 'contracts';

export function useContracts(filters?: ContractFilters) {
  return useQuery({
    queryKey: [QUERY_KEY, filters],
    queryFn: () => contractService.list(filters),
    staleTime: 30_000,
  });
}

export function useContract(id: string | undefined) {
  return useQuery({
    queryKey: [QUERY_KEY, id],
    queryFn: () => (id ? contractService.get(id) : null),
    enabled: !!id,
  });
}

export function useContractByProposalId(proposalId: string | undefined) {
  return useQuery({
    queryKey: [QUERY_KEY, 'proposal', proposalId],
    queryFn: () => (proposalId ? contractService.getByProposalId(proposalId) : null),
    enabled: !!proposalId,
  });
}

export function useConvertedProposalIds(proposalIds: string[]) {
  return useQuery({
    queryKey: [QUERY_KEY, 'converted', proposalIds],
    queryFn: () => contractService.getConvertedProposalIds(proposalIds),
    enabled: proposalIds.length > 0,
    staleTime: 30_000,
  });
}

export function useCreateContract() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateContractInput) => contractService.create(input),
    onSuccess: () => {
      // Invalidate contracts list
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      // Invalidate proposals list so badges/actions refresh
      queryClient.invalidateQueries({ queryKey: ['proposals-api'] });
      toast.success('Contrato criado com sucesso');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao criar contrato');
    },
  });
}

export function useUpdateContract() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, any> }) =>
      contractService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success('Contrato atualizado');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao atualizar contrato');
    },
  });
}

export function useDeleteContract() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: contractService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      // Re-check eligible proposals after contract deletion
      queryClient.invalidateQueries({ queryKey: ['proposals-api'] });
      toast.success('Contrato excluído');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao excluir contrato');
    },
  });
}

export function useUpdateContractStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: ContractStatus }) =>
      contractService.updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success('Status atualizado');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao atualizar status');
    },
  });
}
