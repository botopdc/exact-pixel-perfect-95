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
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  return {
    commissions: data?.commissions ?? [],
    stats: data?.stats ?? {
      total_previsto: 0,
      total_a_pagar: 0,
      total_pago: 0,
      total_executivos_ativos: 0,
      propostas_com_cap: 0,
      economia_cap: 0,
    },
    executiveSummaries: data?.executiveSummaries ?? [],
    isLoading,
    isError,
    error: error as Error | null,
    refetch,
  };
}
