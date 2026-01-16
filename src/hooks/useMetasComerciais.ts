/**
 * Metas Comerciais Hook - Manages yearly sales goals for executives
 * 
 * Now uses the dedicated /api/annual-goal endpoint instead of calculator/config
 * 
 * Each year has: global targets, monthly distribution, and executive-level goals
 */

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  annualGoalService,
  AnnualGoal,
  AnnualGoalGlobal,
  AnnualGoalExecutive,
  AnnualGoalStoreRequest,
} from '@/services/annualGoalService';

// Types - Re-export for backward compatibility
export interface QuarterWeights {
  Q1: number;
  Q2: number;
  Q3: number;
  Q4: number;
}

export interface MonthlyTargets {
  jan: number;
  feb: number;
  mar: number;
  apr: number;
  may: number;
  jun: number;
  jul: number;
  aug: number;
  sep: number;
  oct: number;
  nov: number;
  dec: number;
}

export interface ExecutiveGoal {
  id: number;
  name: string;
  email: string;
  teamType: 'interno' | 'externo';
  annualTarget: number;
  monthlyMRRTarget: number;
  monthlyTargets: MonthlyTargets;
  quarterTargets: QuarterWeights;
}

export interface GlobalGoal {
  annualTarget: number;
  globalMRRTarget: number;
  quarterWeights: QuarterWeights;
  monthlyTargets: MonthlyTargets;
}

export interface YearGoalData {
  year: number;
  global: GlobalGoal;
  executives: ExecutiveGoal[];
  updatedAt: string;
  apiId?: number; // ID from the API for updates
}

// Default values
export const DEFAULT_QUARTER_WEIGHTS: QuarterWeights = {
  Q1: 20,
  Q2: 25,
  Q3: 25,
  Q4: 30,
};

export const DEFAULT_MONTHLY_TARGETS: MonthlyTargets = {
  jan: 0, feb: 0, mar: 0, apr: 0, may: 0, jun: 0,
  jul: 0, aug: 0, sep: 0, oct: 0, nov: 0, dec: 0,
};

export function createEmptyYearGoal(year: number): YearGoalData {
  return {
    year,
    global: {
      annualTarget: 0,
      globalMRRTarget: 0,
      quarterWeights: { ...DEFAULT_QUARTER_WEIGHTS },
      monthlyTargets: { ...DEFAULT_MONTHLY_TARGETS },
    },
    executives: [],
    updatedAt: new Date().toISOString(),
  };
}

// Helper: calculate monthly targets from quarter weights
export function calculateMonthlyFromQuarters(
  annualTarget: number,
  quarterWeights: QuarterWeights
): MonthlyTargets {
  const q1Monthly = (annualTarget * (quarterWeights.Q1 / 100)) / 3;
  const q2Monthly = (annualTarget * (quarterWeights.Q2 / 100)) / 3;
  const q3Monthly = (annualTarget * (quarterWeights.Q3 / 100)) / 3;
  const q4Monthly = (annualTarget * (quarterWeights.Q4 / 100)) / 3;

  return {
    jan: q1Monthly, feb: q1Monthly, mar: q1Monthly,
    apr: q2Monthly, may: q2Monthly, jun: q2Monthly,
    jul: q3Monthly, aug: q3Monthly, sep: q3Monthly,
    oct: q4Monthly, nov: q4Monthly, dec: q4Monthly,
  };
}

// Helper: calculate quarter targets from annual and weights
export function calculateQuarterTargets(
  annualTarget: number,
  quarterWeights: QuarterWeights
): QuarterWeights {
  return {
    Q1: annualTarget * (quarterWeights.Q1 / 100),
    Q2: annualTarget * (quarterWeights.Q2 / 100),
    Q3: annualTarget * (quarterWeights.Q3 / 100),
    Q4: annualTarget * (quarterWeights.Q4 / 100),
  };
}

// Helper: sum monthly targets
export function sumMonthlyTargets(targets: MonthlyTargets): number {
  return Object.values(targets).reduce((sum, v) => sum + (v || 0), 0);
}

// Month labels
export const MONTH_LABELS: Record<keyof MonthlyTargets, string> = {
  jan: 'Jan', feb: 'Fev', mar: 'Mar', apr: 'Abr',
  may: 'Mai', jun: 'Jun', jul: 'Jul', aug: 'Ago',
  sep: 'Set', oct: 'Out', nov: 'Nov', dec: 'Dez',
};

export const MONTH_KEYS: (keyof MonthlyTargets)[] = [
  'jan', 'feb', 'mar', 'apr', 'may', 'jun',
  'jul', 'aug', 'sep', 'oct', 'nov', 'dec',
];

// Transform API response to local format
function apiToLocal(apiGoal: AnnualGoal): YearGoalData {
  return {
    year: apiGoal.year,
    apiId: apiGoal.id,
    global: {
      annualTarget: apiGoal.global?.annual_target || 0,
      globalMRRTarget: apiGoal.global?.global_mrr_target || 0,
      quarterWeights: apiGoal.global?.quarter_weights || { ...DEFAULT_QUARTER_WEIGHTS },
      monthlyTargets: apiGoal.global?.monthly_targets || { ...DEFAULT_MONTHLY_TARGETS },
    },
    executives: (apiGoal.executives || []).map((exec) => ({
      id: exec.id,
      name: exec.name || '',
      email: exec.email || '',
      teamType: exec.team_type || 'interno',
      annualTarget: exec.annual_target || 0,
      monthlyMRRTarget: exec.monthly_mrr_target || 0,
      monthlyTargets: exec.monthly_targets || { ...DEFAULT_MONTHLY_TARGETS },
      quarterTargets: exec.quarter_targets || { Q1: 0, Q2: 0, Q3: 0, Q4: 0 },
    })),
    updatedAt: apiGoal.updated_at,
  };
}

// Transform local format to API request
function localToApi(localData: YearGoalData): AnnualGoalStoreRequest {
  return {
    year: localData.year,
    global: {
      annual_target: localData.global.annualTarget || 0,
      global_mrr_target: localData.global.globalMRRTarget || 0,
      quarter_weights: localData.global.quarterWeights || { ...DEFAULT_QUARTER_WEIGHTS },
      monthly_targets: localData.global.monthlyTargets || { ...DEFAULT_MONTHLY_TARGETS },
    },
    executives: (localData.executives || []).map((exec) => ({
      id: exec.id,
      name: exec.name,
      email: exec.email,
      team_type: exec.teamType || 'interno',
      annual_target: exec.annualTarget || 0,
      monthly_mrr_target: exec.monthlyMRRTarget || 0,
      monthly_targets: exec.monthlyTargets || { ...DEFAULT_MONTHLY_TARGETS },
      quarter_targets: exec.quarterTargets || { Q1: 0, Q2: 0, Q3: 0, Q4: 0 },
    })),
  };
}

// Hook
export function useMetasComerciais() {
  const queryClient = useQueryClient();
  const [entryIds, setEntryIds] = useState<Map<number, number>>(new Map());

  // Query to fetch all years
  const {
    data: yearsData,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['metas-comerciais', 'annual-goals'],
    queryFn: async () => {
      const response = await annualGoalService.fetchAll({ __perPage: 100 });
      const idsMap = new Map<number, number>();
      const dataMap = new Map<number, YearGoalData>();

      for (const apiGoal of response.data || []) {
        const localData = apiToLocal(apiGoal);
        idsMap.set(apiGoal.year, apiGoal.id);
        dataMap.set(apiGoal.year, localData);
      }

      setEntryIds(idsMap);
      return dataMap;
    },
    staleTime: 5 * 60 * 1000,
  });

  // Mutation to save a year
  const saveMutation = useMutation({
    mutationFn: async (yearData: YearGoalData) => {
      const existingId = yearData.apiId || entryIds.get(yearData.year);
      const payload = localToApi(yearData);

      console.log('[MetasComerciais] Saving to /api/annual-goal:', JSON.stringify(payload, null, 2));

      if (existingId) {
        // PUT update
        console.log(`[MetasComerciais] PUT /api/annual-goal/${existingId}`);
        return await annualGoalService.update(existingId, payload);
      } else {
        // POST create
        console.log('[MetasComerciais] POST /api/annual-goal');
        return await annualGoalService.create(payload);
      }
    },
    onSuccess: (data, variables) => {
      // Update the ID map with the new/updated entry
      if (data.id) {
        setEntryIds((prev) => {
          const next = new Map(prev);
          next.set(data.year, data.id);
          return next;
        });
      }
      queryClient.invalidateQueries({ queryKey: ['metas-comerciais'] });
      toast.success(`Metas de ${variables.year} salvas com sucesso!`);
    },
    onError: (err: any) => {
      console.error('[MetasComerciais] Save error:', err);
      const message = err?.message || err?.response?.data?.message || 'Erro ao salvar metas';
      toast.error(message);
    },
  });

  // Get data for a specific year
  const getYearData = useCallback(
    (year: number): YearGoalData => {
      return yearsData?.get(year) || createEmptyYearGoal(year);
    },
    [yearsData]
  );

  // Get all available years
  const getAvailableYears = useCallback((): number[] => {
    if (!yearsData) return [new Date().getFullYear()];
    const years = Array.from(yearsData.keys()).sort((a, b) => a - b);
    return years.length > 0 ? years : [new Date().getFullYear()];
  }, [yearsData]);

  // Get executive's monthly MRR goal for a specific month
  const getExecutiveMRRGoal = useCallback(
    (year: number, executiveId: number): number => {
      const yearData = yearsData?.get(year);
      if (!yearData) return 0;
      const exec = yearData.executives.find((e) => e.id === executiveId);
      return exec?.monthlyMRRTarget || 0;
    },
    [yearsData]
  );

  // Get all executives with goals for a year
  const getExecutivesWithGoals = useCallback(
    (year: number): ExecutiveGoal[] => {
      const yearData = yearsData?.get(year);
      return yearData?.executives || [];
    },
    [yearsData]
  );

  return {
    yearsData: yearsData || new Map<number, YearGoalData>(),
    isLoading,
    isError,
    error: error as Error | null,
    refetch,
    getYearData,
    getAvailableYears,
    getExecutiveMRRGoal,
    getExecutivesWithGoals,
    saveYear: saveMutation.mutate,
    saveYearAsync: saveMutation.mutateAsync,
    isSaving: saveMutation.isPending,
    entryIds,
  };
}
