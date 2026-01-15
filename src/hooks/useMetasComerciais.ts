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
    value: number | string;
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

// Config item type for API
interface ConfigItem {
  label: string;
  value: number;
  by: string;
  type: string;
}

// Parse config items from API response into YearGoalData
function parseConfigToYearData(config: ConfigItem[], year: number): YearGoalData {
  const data = createEmptyYearGoal(year);
  const executivesMap = new Map<number, Partial<ExecutiveGoal>>();

  for (const item of config) {
    const { label, value } = item;
    const numValue = typeof value === 'string' ? parseFloat(value) : (value || 0);

    // Global targets
    if (label === 'global_annual_target') {
      data.global.annualTarget = numValue;
    } else if (label === 'global_mrr_target') {
      data.global.globalMRRTarget = numValue;
    }
    // Quarter weights
    else if (label === 'q1_weight') {
      data.global.quarterWeights.Q1 = numValue;
    } else if (label === 'q2_weight') {
      data.global.quarterWeights.Q2 = numValue;
    } else if (label === 'q3_weight') {
      data.global.quarterWeights.Q3 = numValue;
    } else if (label === 'q4_weight') {
      data.global.quarterWeights.Q4 = numValue;
    }
    // Monthly targets
    else if (label.startsWith('month_')) {
      const month = label.replace('month_', '') as keyof MonthlyTargets;
      if (MONTH_KEYS.includes(month)) {
        data.global.monthlyTargets[month] = numValue;
      }
    }
    // Executive data: exec_<ID>_<field>
    else if (label.startsWith('exec_')) {
      const match = label.match(/^exec_(\d+)_(.+)$/);
      if (match) {
        const execId = parseInt(match[1], 10);
        const field = match[2];
        
        if (!executivesMap.has(execId)) {
          executivesMap.set(execId, {
            id: execId,
            name: '',
            email: '',
            teamType: 'interno',
            annualTarget: 0,
            monthlyMRRTarget: 0,
            monthlyTargets: { ...DEFAULT_MONTHLY_TARGETS },
            quarterTargets: { Q1: 0, Q2: 0, Q3: 0, Q4: 0 },
          });
        }
        
        const exec = executivesMap.get(execId)!;
        
        if (field === 'name' && typeof value === 'string') {
          exec.name = value;
        } else if (field === 'email' && typeof value === 'string') {
          exec.email = value;
        } else if (field === 'team') {
          exec.teamType = numValue === 1 ? 'externo' : 'interno';
        } else if (field === 'annual') {
          exec.annualTarget = numValue;
        } else if (field === 'mrr') {
          exec.monthlyMRRTarget = numValue;
        } else if (field.startsWith('m_')) {
          const month = field.replace('m_', '') as keyof MonthlyTargets;
          if (MONTH_KEYS.includes(month) && exec.monthlyTargets) {
            exec.monthlyTargets[month] = numValue;
          }
        } else if (field.startsWith('q')) {
          const q = field.toUpperCase() as keyof QuarterWeights;
          if (['Q1', 'Q2', 'Q3', 'Q4'].includes(q) && exec.quarterTargets) {
            exec.quarterTargets[q as keyof QuarterWeights] = numValue;
          }
        }
      }
    }
  }

  // Convert map to array
  data.executives = Array.from(executivesMap.values()) as ExecutiveGoal[];
  
  return data;
}

// Convert YearGoalData to config items for API
function yearDataToConfig(yearData: YearGoalData): ConfigItem[] {
  const config: ConfigItem[] = [];
  const { global, executives, year } = yearData;

  // Year identifier
  config.push({ label: 'year', value: year, by: 'year', type: 'BRL' });

  // Global targets
  config.push({ label: 'global_annual_target', value: global.annualTarget || 0, by: 'year', type: 'BRL' });
  config.push({ label: 'global_mrr_target', value: global.globalMRRTarget || 0, by: 'month', type: 'BRL' });

  // Quarter weights
  config.push({ label: 'q1_weight', value: global.quarterWeights.Q1 || 0, by: 'percent', type: 'BRL' });
  config.push({ label: 'q2_weight', value: global.quarterWeights.Q2 || 0, by: 'percent', type: 'BRL' });
  config.push({ label: 'q3_weight', value: global.quarterWeights.Q3 || 0, by: 'percent', type: 'BRL' });
  config.push({ label: 'q4_weight', value: global.quarterWeights.Q4 || 0, by: 'percent', type: 'BRL' });

  // Monthly targets
  for (const month of MONTH_KEYS) {
    config.push({ label: `month_${month}`, value: global.monthlyTargets[month] || 0, by: 'month', type: 'BRL' });
  }

  // Executives - each field as separate item (fallback approach for API compatibility)
  for (const exec of executives || []) {
    const prefix = `exec_${exec.id}`;
    
    // Store numeric values only (API doesn't accept string in value)
    config.push({ label: `${prefix}_annual`, value: exec.annualTarget || 0, by: 'year', type: 'BRL' });
    config.push({ label: `${prefix}_mrr`, value: exec.monthlyMRRTarget || 0, by: 'month', type: 'BRL' });
    config.push({ label: `${prefix}_team`, value: exec.teamType === 'externo' ? 1 : 0, by: 'meta', type: 'BRL' });
    
    // Monthly targets per executive
    for (const month of MONTH_KEYS) {
      config.push({ label: `${prefix}_m_${month}`, value: exec.monthlyTargets?.[month] || 0, by: 'month', type: 'BRL' });
    }
    
    // Quarter targets per executive
    config.push({ label: `${prefix}_q1`, value: exec.quarterTargets?.Q1 || 0, by: 'quarter', type: 'BRL' });
    config.push({ label: `${prefix}_q2`, value: exec.quarterTargets?.Q2 || 0, by: 'quarter', type: 'BRL' });
    config.push({ label: `${prefix}_q3`, value: exec.quarterTargets?.Q3 || 0, by: 'quarter', type: 'BRL' });
    config.push({ label: `${prefix}_q4`, value: exec.quarterTargets?.Q4 || 0, by: 'quarter', type: 'BRL' });
  }

  return config;
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
      const configItems = (entry.config || []) as unknown as ConfigItem[];
      
      // Find the year from config
      const yearItem = configItems.find(c => c.label === 'year');
      const year = yearItem ? (typeof yearItem.value === 'number' ? yearItem.value : parseInt(String(yearItem.value), 10)) : null;
      
      if (year && !isNaN(year)) {
        const data = parseConfigToYearData(configItems, year);
        result.set(year, { entryId: entry.id, data });
      }
    }
  }

  return result;
}

/**
 * Save metas entry - ONLY updates existing configs via PUT.
 * API does NOT support POST to create new configs.
 * If no existing entry is found, we throw an error.
 */
async function saveMetasEntry(
  yearData: YearGoalData,
  existingEntryId?: number
): Promise<MetasConfigEntry> {
  const token = getToken();
  const headers = { 
    Authorization: token ? `Bearer ${token}` : '',
    'Content-Type': 'application/json',
  };

  const config = yearDataToConfig(yearData);

  const payload = {
    category: METAS_CATEGORY,
    section: METAS_SECTION,
    config,
  };

  console.log('[MetasComerciais] Saving payload:', JSON.stringify(payload, null, 2));

  // API only supports PUT for existing entries
  if (!existingEntryId) {
    // Try to find an existing entry for Metas/Comercial
    const entriesMap = await fetchMetasEntries();
    const existingEntry = entriesMap.get(yearData.year);
    
    if (existingEntry) {
      existingEntryId = existingEntry.entryId;
    } else {
      // Check if there's any Metas/Comercial entry we can reuse
      const allEntries = await fetchAllMetasConfigEntries();
      const metasEntry = allEntries.find(e => 
        e.category === METAS_CATEGORY && e.section === METAS_SECTION
      );
      
      if (metasEntry) {
        existingEntryId = metasEntry.id;
      } else {
        throw new Error(
          'API atual não permite criar novas configurações (somente leitura). ' +
          'Entre em contato com o administrador para criar uma entrada de Metas/Comercial no banco.'
        );
      }
    }
  }

  try {
    console.log(`[MetasComerciais] PUT /calculator/config/${existingEntryId}`);
    const response = await axios.put<MetasConfigEntry>(
      `${API_BASE_URL}/calculator/config/${existingEntryId}`,
      payload,
      { headers }
    );
    return response.data;
  } catch (err: any) {
    const status = err.response?.status;
    console.error('[MetasComerciais] API Error:', status, err.response?.data);
    
    if (status === 405) {
      throw new Error(
        'API atual não permite salvar configurações (somente leitura). ' +
        'Verifique se o endpoint de escrita está disponível.'
      );
    }
    throw err;
  }
}

/**
 * Fetch all config entries (not just parsed metas) to find any Metas entry
 */
async function fetchAllMetasConfigEntries(): Promise<MetasConfigEntry[]> {
  const token = getToken();
  const response = await axios.get<PaginatedResponse>(`${API_BASE_URL}/calculator/config`, {
    params: { 
      __perPage: 200,
      category: METAS_CATEGORY,
      section: METAS_SECTION,
    },
    headers: { Authorization: token ? `Bearer ${token}` : '' },
  });
  return response.data.data || [];
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
