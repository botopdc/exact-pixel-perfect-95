/**
 * Metas Comerciais Hook - Manages yearly sales goals for executives
 * 
 * Uses the dedicated /api/annual-goal endpoint with the correct API structure:
 * - manager_id, year, goal, mrr_goal, q1-q4, jan-dec
 * - executives[] with executive_id, role, goal, mrr_goal, q1-q4, jan-dec
 */

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  annualGoalService,
  AnnualGoal,
  AnnualGoalStoreRequest,
  AnnualGoalExecutiveRequest,
} from '@/services/annualGoalService';
import { openApi } from '@/lib/openApi';

// Month keys as used by the API
export type MonthKey = 'jan' | 'feb' | 'mar' | 'apr' | 'may' | 'jun' | 'jul' | 'aug' | 'sep' | 'oct' | 'nov' | 'dec';
export type QuarterKey = 'q1' | 'q2' | 'q3' | 'q4';

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

export interface QuarterTargets {
  q1: number;
  q2: number;
  q3: number;
  q4: number;
}

// Local format for UI - easier to work with
export interface ExecutiveGoal {
  id?: number; // ID from annual_goal_executives table (for existing records)
  executiveId: number; // User ID
  name: string;
  email: string;
  role: string;
  goal: number; // annual goal
  mrrGoal: number; // monthly MRR goal
  quarters: QuarterTargets;
  months: MonthlyTargets;
}

export interface YearGoalData {
  year: number;
  managerId: number;
  goal: number; // annual goal
  mrrGoal: number; // monthly MRR goal
  quarters: QuarterTargets;
  months: MonthlyTargets;
  executives: ExecutiveGoal[];
  updatedAt: string;
  apiId?: number; // ID from the API for updates
}

// Default values
export const DEFAULT_QUARTER_TARGETS: QuarterTargets = {
  q1: 0,
  q2: 0,
  q3: 0,
  q4: 0,
};

export const DEFAULT_MONTHLY_TARGETS: MonthlyTargets = {
  jan: 0, feb: 0, mar: 0, apr: 0, may: 0, jun: 0,
  jul: 0, aug: 0, sep: 0, oct: 0, nov: 0, dec: 0,
};

export function createEmptyYearGoal(year: number, managerId: number = 1): YearGoalData {
  return {
    year,
    managerId,
    goal: 0,
    mrrGoal: 0,
    quarters: { ...DEFAULT_QUARTER_TARGETS },
    months: { ...DEFAULT_MONTHLY_TARGETS },
    executives: [],
    updatedAt: new Date().toISOString(),
  };
}

// Helper: calculate quarters from months
export function calculateQuartersFromMonths(months: MonthlyTargets): QuarterTargets {
  return {
    q1: (months.jan || 0) + (months.feb || 0) + (months.mar || 0),
    q2: (months.apr || 0) + (months.may || 0) + (months.jun || 0),
    q3: (months.jul || 0) + (months.aug || 0) + (months.sep || 0),
    q4: (months.oct || 0) + (months.nov || 0) + (months.dec || 0),
  };
}

// Helper: calculate monthly from quarter weights
export function calculateMonthlyFromQuarters(
  annualTarget: number,
  quarterWeights: { Q1: number; Q2: number; Q3: number; Q4: number }
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

// Helper: calculate quarter targets from annual and weights (for backward compat)
export function calculateQuarterTargets(
  annualTarget: number,
  quarterWeights: { Q1: number; Q2: number; Q3: number; Q4: number }
): { Q1: number; Q2: number; Q3: number; Q4: number } {
  return {
    Q1: annualTarget * (quarterWeights.Q1 / 100),
    Q2: annualTarget * (quarterWeights.Q2 / 100),
    Q3: annualTarget * (quarterWeights.Q3 / 100),
    Q4: annualTarget * (quarterWeights.Q4 / 100),
  };
}

// Backward compat type aliases
export type QuarterWeights = { Q1: number; Q2: number; Q3: number; Q4: number };

export const DEFAULT_QUARTER_WEIGHTS: QuarterWeights = {
  Q1: 20,
  Q2: 25,
  Q3: 25,
  Q4: 30,
};

// Helper: sum monthly targets
export function sumMonthlyTargets(targets: MonthlyTargets): number {
  return Object.values(targets).reduce((sum, v) => sum + (v || 0), 0);
}

// Month labels
export const MONTH_LABELS: Record<MonthKey, string> = {
  jan: 'Jan', feb: 'Fev', mar: 'Mar', apr: 'Abr',
  may: 'Mai', jun: 'Jun', jul: 'Jul', aug: 'Ago',
  sep: 'Set', oct: 'Out', nov: 'Nov', dec: 'Dez',
};

export const MONTH_KEYS: MonthKey[] = [
  'jan', 'feb', 'mar', 'apr', 'may', 'jun',
  'jul', 'aug', 'sep', 'oct', 'nov', 'dec',
];

export const QUARTER_KEYS: QuarterKey[] = ['q1', 'q2', 'q3', 'q4'];

// Transform API response to local format
function apiToLocal(apiGoal: AnnualGoal): YearGoalData {
  return {
    year: apiGoal.year,
    apiId: apiGoal.id,
    managerId: apiGoal.manager_id,
    goal: apiGoal.goal || 0,
    mrrGoal: apiGoal.mrr_goal || 0,
    quarters: {
      q1: apiGoal.q1 || 0,
      q2: apiGoal.q2 || 0,
      q3: apiGoal.q3 || 0,
      q4: apiGoal.q4 || 0,
    },
    months: {
      jan: apiGoal.jan || 0,
      feb: apiGoal.feb || 0,
      mar: apiGoal.mar || 0,
      apr: apiGoal.apr || 0,
      may: apiGoal.may || 0,
      jun: apiGoal.jun || 0,
      jul: apiGoal.jul || 0,
      aug: apiGoal.aug || 0,
      sep: apiGoal.sep || 0,
      oct: apiGoal.oct || 0,
      nov: apiGoal.nov || 0,
      dec: apiGoal.dec || 0,
    },
    executives: (apiGoal.executives || []).map((exec) => ({
      id: exec.id,
      executiveId: exec.executive_id,
      name: exec.executive?.name || '',
      email: exec.executive?.email || '',
      role: exec.role || '',
      goal: exec.goal || 0,
      mrrGoal: exec.mrr_goal || 0,
      quarters: {
        q1: exec.q1 || 0,
        q2: exec.q2 || 0,
        q3: exec.q3 || 0,
        q4: exec.q4 || 0,
      },
      months: {
        jan: exec.jan || 0,
        feb: exec.feb || 0,
        mar: exec.mar || 0,
        apr: exec.apr || 0,
        may: exec.may || 0,
        jun: exec.jun || 0,
        jul: exec.jul || 0,
        aug: exec.aug || 0,
        sep: exec.sep || 0,
        oct: exec.oct || 0,
        nov: exec.nov || 0,
        dec: exec.dec || 0,
      },
    })),
    updatedAt: apiGoal.updated_at || new Date().toISOString(),
  };
}

// Transform local format to API request
function localToApi(localData: YearGoalData): AnnualGoalStoreRequest {
  const executives: AnnualGoalExecutiveRequest[] = localData.executives.map((exec) => ({
    executive_id: exec.executiveId,
    role: exec.role || 'Comercial',
    goal: exec.goal || 0,
    mrr_goal: exec.mrrGoal || 0,
    q1: exec.quarters.q1 || 0,
    q2: exec.quarters.q2 || 0,
    q3: exec.quarters.q3 || 0,
    q4: exec.quarters.q4 || 0,
    jan: exec.months.jan || 0,
    feb: exec.months.feb || 0,
    mar: exec.months.mar || 0,
    apr: exec.months.apr || 0,
    may: exec.months.may || 0,
    jun: exec.months.jun || 0,
    jul: exec.months.jul || 0,
    aug: exec.months.aug || 0,
    sep: exec.months.sep || 0,
    oct: exec.months.oct || 0,
    nov: exec.months.nov || 0,
    dec: exec.months.dec || 0,
  }));

  return {
    manager_id: localData.managerId || 1,
    year: localData.year,
    goal: localData.goal || 0,
    mrr_goal: localData.mrrGoal || 0,
    q1: localData.quarters.q1 || 0,
    q2: localData.quarters.q2 || 0,
    q3: localData.quarters.q3 || 0,
    q4: localData.quarters.q4 || 0,
    jan: localData.months.jan || 0,
    feb: localData.months.feb || 0,
    mar: localData.months.mar || 0,
    apr: localData.months.apr || 0,
    may: localData.months.may || 0,
    jun: localData.months.jun || 0,
    jul: localData.months.jul || 0,
    aug: localData.months.aug || 0,
    sep: localData.months.sep || 0,
    oct: localData.months.oct || 0,
    nov: localData.months.nov || 0,
    dec: localData.months.dec || 0,
    executives,
  };
}

// Hook
export function useMetasComerciais() {
  const queryClient = useQueryClient();
  const [entryIds, setEntryIds] = useState<Map<number, number>>(new Map());
  const [currentManagerId, setCurrentManagerId] = useState<number>(1);

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
      // Get current user to use as manager_id default
      try {
        const user = await openApi.getCurrentUser();
        if (user?.id) setCurrentManagerId(user.id);
      } catch (e) {
        console.warn('Could not fetch current user for manager_id');
      }

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
      
      // Ensure manager_id is set
      const dataToSave = {
        ...yearData,
        managerId: yearData.managerId || currentManagerId || 1,
      };
      
      const payload = localToApi(dataToSave);

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
      return yearsData?.get(year) || createEmptyYearGoal(year, currentManagerId);
    },
    [yearsData, currentManagerId]
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
      const exec = yearData.executives.find((e) => e.executiveId === executiveId);
      return exec?.mrrGoal || 0;
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
    currentManagerId,
  };
}
