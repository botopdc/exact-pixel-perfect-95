import { useQuery } from '@tanstack/react-query';
import {
  fetchAndCalculateCommissions,
  CommissionCalculation,
  CommissionStats,
  ExecutiveCommissionSummary,
} from '@/services/executiveCommissionService';

export interface UseExecutiveCommissionsResult {
  commissions: CommissionCalculation[];
  stats: CommissionStats;
  executiveSummaries: ExecutiveCommissionSummary[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useExecutiveCommissions(): UseExecutiveCommissionsResult {
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['executive-commissions'],
    queryFn: fetchAndCalculateCommissions,
    // NO CACHE - Always fetch fresh data from API
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  return {
    commissions: data?.commissions ?? [],
    stats: data?.stats ?? {
      total_tcv: 0,
      total_comissao: 0,
      total_contratos: 0,
      total_executivos_ativos: 0,
      taxa_media_ponderada: 0,
    },
    executiveSummaries: data?.executiveSummaries ?? [],
    isLoading,
    isError,
    error: error as Error | null,
    refetch,
  };
}
