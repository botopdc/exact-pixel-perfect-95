/**
 * Hook for contract operations
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { contractService } from '@/services/contractService';
import type { Contract, ContractFilters, ContractStatus } from '@/types/contract';
import { toast } from 'sonner';

const QUERY_KEY = 'contracts';

export function useContracts(filters?: ContractFilters) {
  return useQuery({
    queryKey: [QUERY_KEY, filters],
    queryFn: () => contractService.list(filters),
    staleTime: 0, // Sempre buscar dados frescos
  });
}

export function useContract(id: string | undefined) {
  return useQuery({
    queryKey: [QUERY_KEY, id],
    queryFn: () => (id ? contractService.get(id) : null),
    enabled: !!id,
    staleTime: 0,
  });
}

export function useContractByProposalId(proposalId: string | number | undefined) {
  return useQuery({
    queryKey: [QUERY_KEY, 'proposal', proposalId],
    queryFn: () => (proposalId ? contractService.getByProposalId(proposalId) : null),
    enabled: !!proposalId,
    staleTime: 0,
  });
}

export function useCreateContract() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: Omit<Contract, 'id' | 'created_at' | 'updated_at'>) =>
      contractService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
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
    mutationFn: ({ id, data }: { id: string; data: Partial<Contract> }) =>
      contractService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success('Contrato atualizado com sucesso');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao atualizar contrato');
    },
  });
}

export function useDeleteContract() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => contractService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
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
