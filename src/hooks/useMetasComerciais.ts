/**
 * Metas Comerciais Hook - Manages yearly sales goals for executives
 * 
 * Stores goals in calculator/config with:
 * - category: "Metas"
 * - section: "Comercial"
 * - label: "year_<YEAR>"
 * 
 * Each year has: global targets, monthly distribution, and executive-level goals
 */

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://apiv2.opendata.center/api';
const AUTH_TOKEN_KEY = 'open_access_token';
const LEGACY_AUTH_TOKEN_KEY = 'open_api_token';

const METAS_CATEGORY = 'Metas';
const METAS_SECTION = 'Comercial';

// Types
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
}

interface MetasConfigEntry {
  id: number;
  category: string;
  section: string;
  config: Array<{
    label: string;
    by: string;
    type: string;
    value: YearGoalData | string;
  }>;
  created_at: string;
  updated_at: string;
}

interface PaginatedResponse {
  data: MetasConfigEntry[];
  total: number;
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

function getToken(): string | null {
  return localStorage.getItem(AUTH_TOKEN_KEY) || localStorage.getItem(LEGACY_AUTH_TOKEN_KEY);
}

// API Functions
async function fetchMetasEntries(): Promise<Map<number, { entryId: number; data: YearGoalData }>> {
  const token = getToken();
  const response = await axios.get<PaginatedResponse>(`${API_BASE_URL}/calculator/config`, {
    params: { __perPage: 200 },
    headers: { Authorization: token ? `Bearer ${token}` : '' },
  });

  const entries = response.data.data || [];
  const result = new Map<number, { entryId: number; data: YearGoalData }>();

  for (const entry of entries) {
    if (entry.category === METAS_CATEGORY && entry.section === METAS_SECTION) {
      for (const item of entry.config || []) {
        if (item.label.startsWith('year_')) {
          const yearStr = item.label.replace('year_', '');
          const year = parseInt(yearStr, 10);
          if (!isNaN(year)) {
            let data: YearGoalData;
            if (typeof item.value === 'string') {
              try {
                data = JSON.parse(item.value);
              } catch {
                data = createEmptyYearGoal(year);
              }
            } else {
              data = item.value as YearGoalData;
            }
            result.set(year, { entryId: entry.id, data });
          }
        }
      }
    }
  }

  return result;
}

async function saveMetasEntry(
  yearData: YearGoalData,
  existingEntryId?: number
): Promise<MetasConfigEntry> {
  const token = getToken();
  const headers = { Authorization: token ? `Bearer ${token}` : '' };

  const config = [
    {
      label: `year_${yearData.year}`,
      by: 'year',
      type: 'JSON',
      value: JSON.stringify(yearData),
    },
  ];

  const payload = {
    category: METAS_CATEGORY,
    section: METAS_SECTION,
    config,
  };

  if (existingEntryId) {
    const response = await axios.put<MetasConfigEntry>(
      `${API_BASE_URL}/calculator/config/${existingEntryId}`,
      payload,
      { headers }
    );
    return response.data;
  } else {
    const response = await axios.post<MetasConfigEntry>(
      `${API_BASE_URL}/calculator/config`,
      payload,
      { headers }
    );
    return response.data;
  }
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
    queryKey: ['metas-comerciais'],
    queryFn: async () => {
      const entries = await fetchMetasEntries();
      const idsMap = new Map<number, number>();
      const dataMap = new Map<number, YearGoalData>();

      entries.forEach((val, year) => {
        idsMap.set(year, val.entryId);
        dataMap.set(year, val.data);
      });

      setEntryIds(idsMap);
      return dataMap;
    },
    staleTime: 5 * 60 * 1000,
  });

  // Mutation to save a year
  const saveMutation = useMutation({
    mutationFn: async (yearData: YearGoalData) => {
      const existingId = entryIds.get(yearData.year);
      return saveMetasEntry(yearData, existingId);
    },
    onSuccess: (data, variables) => {
      // Extract new ID from response
      if (data.id) {
        setEntryIds((prev) => {
          const next = new Map(prev);
          next.set(variables.year, data.id);
          return next;
        });
      }
      queryClient.invalidateQueries({ queryKey: ['metas-comerciais'] });
      toast.success(`Metas de ${variables.year} salvas com sucesso!`);
    },
    onError: (err: any) => {
      console.error('[MetasComerciais] Save error:', err);
      toast.error(err?.response?.data?.message || 'Erro ao salvar metas');
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
    if (!yearsData) return [2026];
    const years = Array.from(yearsData.keys()).sort((a, b) => a - b);
    return years.length > 0 ? years : [2026];
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
