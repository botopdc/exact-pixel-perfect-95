/**
 * Dashboard KPIs Hook
 * Fetches KPI data from OPEN API for the corporate dashboard
 */

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';

export interface GlobalKPIs {
  mrrTotal: number | null;
  novosClientes: number | null;
  churnRate: number | null;
  slaCompliance: number | null;
  npsScore: number | null;
}

export interface ComercialKPIs {
  pipeline: number | null;
  taxaConversao: number | null;
}

export interface CSKPIs {
  clientesRisco: number | null;
  renovacoes30Dias: number | null;
}

export interface SuporteKPIs {
  incidentesAbertos: number | null;
  tempoMedioResposta: number | null;
}

export interface FinanceiroKPIs {
  recebimentosMes: number | null;
  inadimplencia: number | null;
}

export interface LiderancaKPIs {
  metaVsRealizado: { meta: number; realizado: number } | null;
  topRiscos: Array<{ tipo: string; descricao: string }>;
}

export interface DashboardKPIsData {
  global: GlobalKPIs;
  comercial: ComercialKPIs;
  cs: CSKPIs;
  suporte: SuporteKPIs;
  financeiro: FinanceiroKPIs;
  lideranca: LiderancaKPIs;
}

const initialData: DashboardKPIsData = {
  global: {
    mrrTotal: null,
    novosClientes: null,
    churnRate: null,
    slaCompliance: null,
    npsScore: null,
  },
  comercial: {
    pipeline: null,
    taxaConversao: null,
  },
  cs: {
    clientesRisco: null,
    renovacoes30Dias: null,
  },
  suporte: {
    incidentesAbertos: null,
    tempoMedioResposta: null,
  },
  financeiro: {
    recebimentosMes: null,
    inadimplencia: null,
  },
  lideranca: {
    metaVsRealizado: null,
    topRiscos: [],
  },
};

export function useDashboardKPIs() {
  const [data, setData] = useState<DashboardKPIsData>(initialData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchKPIs = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch all KPIs in parallel
      // NOTE: These endpoints may not exist yet - we handle gracefully
      const results = await Promise.allSettled([
        fetchGlobalKPIs(),
        fetchComercialKPIs(),
        fetchCSKPIs(),
        fetchSuporteKPIs(),
        fetchFinanceiroKPIs(),
        fetchLiderancaKPIs(),
      ]);

      setData({
        global: results[0].status === 'fulfilled' ? results[0].value : initialData.global,
        comercial: results[1].status === 'fulfilled' ? results[1].value : initialData.comercial,
        cs: results[2].status === 'fulfilled' ? results[2].value : initialData.cs,
        suporte: results[3].status === 'fulfilled' ? results[3].value : initialData.suporte,
        financeiro: results[4].status === 'fulfilled' ? results[4].value : initialData.financeiro,
        lideranca: results[5].status === 'fulfilled' ? results[5].value : initialData.lideranca,
      });
    } catch (err) {
      console.error('[useDashboardKPIs] Error fetching KPIs:', err);
      setError('Falha ao carregar indicadores');
      toast.error('Falha ao carregar alguns indicadores');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKPIs();
  }, [fetchKPIs]);

  return {
    data,
    loading,
    error,
    refetch: fetchKPIs,
  };
}

// Individual fetch functions - return mock/placeholder data when API not available
// These can be replaced with real API calls as endpoints become available

async function fetchGlobalKPIs(): Promise<GlobalKPIs> {
  // TODO: Replace with real OPEN API calls when available
  // For now, return placeholder data to show UI is working
  return {
    mrrTotal: null, // Will show "Sem dados"
    novosClientes: null,
    churnRate: null,
    slaCompliance: null,
    npsScore: null,
  };
}

async function fetchComercialKPIs(): Promise<ComercialKPIs> {
  return {
    pipeline: null,
    taxaConversao: null,
  };
}

async function fetchCSKPIs(): Promise<CSKPIs> {
  return {
    clientesRisco: null,
    renovacoes30Dias: null,
  };
}

async function fetchSuporteKPIs(): Promise<SuporteKPIs> {
  return {
    incidentesAbertos: null,
    tempoMedioResposta: null,
  };
}

async function fetchFinanceiroKPIs(): Promise<FinanceiroKPIs> {
  return {
    recebimentosMes: null,
    inadimplencia: null,
  };
}

async function fetchLiderancaKPIs(): Promise<LiderancaKPIs> {
  return {
    metaVsRealizado: null,
    topRiscos: [],
  };
}
