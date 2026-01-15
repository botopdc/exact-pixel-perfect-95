/**
 * MRR Goals Hook - Manages MRR targets for executives
 * 
 * Stores goals in calculator/config with:
 * - category: "Comissões"
 * - section: "Metas MRR Executivos"
 * 
 * Each executive's goal is stored as: { label: "exec_<ID>", value: <meta_mrr>, by: "month", type: "BRL" }
 */

import { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://apiv2.opendata.center/api';
const AUTH_TOKEN_KEY = 'open_access_token';
const LEGACY_AUTH_TOKEN_KEY = 'open_api_token';

const MRR_GOALS_CATEGORY = 'Comissões';
const MRR_GOALS_SECTION = 'Metas MRR Executivos';

// Types
interface MRRGoalConfigItem {
  label: string; // e.g., "exec_123"
  by: string;    // "month"
  type: string;  // "BRL"
  value: number; // The MRR goal value
}

interface MRRGoalEntry {
  id: number;
  category: string;
  section: string;
  config: MRRGoalConfigItem[];
  created_at: string;
  updated_at: string;
}

interface PaginatedResponse {
  data: MRRGoalEntry[];
  total: number;
}

export interface ExecutiveMRRGoal {
  executiveId: number;
  metaMRR: number;
}

function getToken(): string | null {
  return localStorage.getItem(AUTH_TOKEN_KEY) || localStorage.getItem(LEGACY_AUTH_TOKEN_KEY);
}

// API Functions
async function fetchMRRGoalsEntry(): Promise<MRRGoalEntry | null> {
  const token = getToken();
  const response = await axios.get<PaginatedResponse>(`${API_BASE_URL}/calculator/config`, {
    params: { __perPage: 200 },
    headers: { Authorization: token ? `Bearer ${token}` : '' },
  });
  
  const entries = response.data.data || [];
  const found = entries.find(
    (e) => e.category === MRR_GOALS_CATEGORY && e.section === MRR_GOALS_SECTION
  );
  
  return found || null;
}

async function saveMRRGoalsEntry(
  goals: ExecutiveMRRGoal[],
  existingId?: number
): Promise<MRRGoalEntry> {
  const token = getToken();
  const headers = { Authorization: token ? `Bearer ${token}` : '' };
  
  const config: MRRGoalConfigItem[] = goals.map((g) => ({
    label: `exec_${g.executiveId}`,
    by: 'month',
    type: 'BRL',
    value: g.metaMRR,
  }));
  
  const payload = {
    category: MRR_GOALS_CATEGORY,
    section: MRR_GOALS_SECTION,
    config,
  };
  
  if (existingId) {
    // PUT update
    const response = await axios.put<MRRGoalEntry>(
      `${API_BASE_URL}/calculator/config/${existingId}`,
      payload,
      { headers }
    );
    return response.data;
  } else {
    // POST create
    const response = await axios.post<MRRGoalEntry>(
      `${API_BASE_URL}/calculator/config`,
      payload,
      { headers }
    );
    return response.data;
  }
}

// Hook
export function useMRRGoals() {
  const queryClient = useQueryClient();
  const [entryId, setEntryId] = useState<number | undefined>(undefined);
  
  // Query to fetch goals
  const {
    data: goalsData,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['mrr-goals'],
    queryFn: async () => {
      const entry = await fetchMRRGoalsEntry();
      if (entry) {
        setEntryId(entry.id);
        // Parse config into ExecutiveMRRGoal[]
        const goals: ExecutiveMRRGoal[] = (entry.config || [])
          .filter((c) => c.label.startsWith('exec_'))
          .map((c) => {
            const idStr = c.label.replace('exec_', '');
            return {
              executiveId: parseInt(idStr, 10),
              metaMRR: c.value || 0,
            };
          })
          .filter((g) => !isNaN(g.executiveId));
        return goals;
      }
      return [];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
  
  // Mutation to save goals
  const saveMutation = useMutation({
    mutationFn: async (goals: ExecutiveMRRGoal[]) => {
      return saveMRRGoalsEntry(goals, entryId);
    },
    onSuccess: (data) => {
      setEntryId(data.id);
      queryClient.invalidateQueries({ queryKey: ['mrr-goals'] });
      toast.success('Metas MRR salvas com sucesso!');
    },
    onError: (err: any) => {
      console.error('[MRRGoals] Save error:', err);
      toast.error(err?.response?.data?.message || 'Erro ao salvar metas');
    },
  });
  
  // Helper to get goal for a specific executive
  const getGoalForExecutive = useCallback((executiveId: number): number => {
    const goal = goalsData?.find((g) => g.executiveId === executiveId);
    return goal?.metaMRR || 0;
  }, [goalsData]);
  
  // Helper to update a single executive's goal (locally, needs save after)
  const updateGoal = useCallback((executiveId: number, metaMRR: number): ExecutiveMRRGoal[] => {
    const current = goalsData || [];
    const existing = current.find((g) => g.executiveId === executiveId);
    if (existing) {
      return current.map((g) =>
        g.executiveId === executiveId ? { ...g, metaMRR } : g
      );
    } else {
      return [...current, { executiveId, metaMRR }];
    }
  }, [goalsData]);
  
  return {
    goals: goalsData || [],
    isLoading,
    isError,
    error: error as Error | null,
    refetch,
    getGoalForExecutive,
    updateGoal,
    saveGoals: saveMutation.mutate,
    isSaving: saveMutation.isPending,
    entryId,
  };
}
