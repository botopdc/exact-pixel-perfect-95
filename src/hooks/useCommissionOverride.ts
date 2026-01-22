/**
 * Hook para gerenciar overrides de comissão
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getCommissionOverride,
  getCommissionOverrides,
  getAllCommissionOverrides,
  upsertCommissionOverride,
  deleteCommissionOverride,
  CommissionOverride,
  UpsertCommissionOverrideParams,
} from '@/services/commissionOverrideService';

const QUERY_KEY = 'commission-overrides';

/**
 * Busca override de comissão para um usuário específico
 */
export function useCommissionOverride(externalUserId: number | null) {
  return useQuery({
    queryKey: [QUERY_KEY, externalUserId],
    queryFn: () => getCommissionOverride(externalUserId!),
    enabled: !!externalUserId,
    staleTime: 30_000, // 30 segundos
  });
}

/**
 * Busca overrides de comissão para múltiplos usuários
 */
export function useCommissionOverrides(externalUserIds: number[]) {
  return useQuery({
    queryKey: [QUERY_KEY, 'batch', externalUserIds.sort().join(',')],
    queryFn: () => getCommissionOverrides(externalUserIds),
    enabled: externalUserIds.length > 0,
    staleTime: 30_000,
  });
}

/**
 * Busca todos os overrides (para listagem admin)
 */
export function useAllCommissionOverrides() {
  return useQuery({
    queryKey: [QUERY_KEY, 'all'],
    queryFn: getAllCommissionOverrides,
    staleTime: 30_000,
  });
}

/**
 * Mutation para criar/atualizar override de comissão
 */
export function useUpsertCommissionOverride() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: UpsertCommissionOverrideParams) => upsertCommissionOverride(params),
    onSuccess: (_, variables) => {
      // Invalida queries relacionadas
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: ['executive-commissions'] });
    },
  });
}

/**
 * Mutation para remover override de comissão
 */
export function useDeleteCommissionOverride() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (externalUserId: number) => deleteCommissionOverride(externalUserId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: ['executive-commissions'] });
    },
  });
}

export type { CommissionOverride, UpsertCommissionOverrideParams };
