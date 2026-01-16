/**
 * MRR Goals Hook - Manages MRR targets for executives
 * 
 * Now uses the /api/annual-goal endpoint via useMetasComerciais
 * This is a compatibility wrapper that provides a simplified interface
 * for components that only need MRR goals per executive.
 */

import { useCallback, useMemo } from 'react';
import { useMetasComerciais, ExecutiveGoal } from './useMetasComerciais';

export interface ExecutiveMRRGoal {
  executiveId: number;
  metaMRR: number;
}

// Hook
export function useMRRGoals() {
  const currentYear = new Date().getFullYear();
  
  const {
    yearsData,
    isLoading,
    isError,
    error,
    refetch,
    getExecutivesWithGoals,
    saveYear,
    isSaving,
  } = useMetasComerciais();

  // Convert executives to simple MRR goals format
  const goalsData = useMemo((): ExecutiveMRRGoal[] => {
    const yearData = yearsData.get(currentYear);
    if (!yearData) return [];
    
    return yearData.executives.map((exec) => ({
      executiveId: exec.id,
      metaMRR: exec.monthlyMRRTarget || 0,
    }));
  }, [yearsData, currentYear]);

  // Helper to get goal for a specific executive
  const getGoalForExecutive = useCallback((executiveId: number): number => {
    const goal = goalsData.find((g) => g.executiveId === executiveId);
    return goal?.metaMRR || 0;
  }, [goalsData]);

  // Helper to update a single executive's goal (returns updated array, needs save after)
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

  // Save goals - this updates the year data with new MRR goals for executives
  const saveGoals = useCallback((goals: ExecutiveMRRGoal[]) => {
    const yearData = yearsData.get(currentYear);
    if (!yearData) {
      console.warn('[useMRRGoals] No year data found for current year, cannot save');
      return;
    }

    // Update executives with new MRR goals
    const updatedExecutives = yearData.executives.map((exec) => {
      const goal = goals.find((g) => g.executiveId === exec.id);
      if (goal) {
        return { ...exec, monthlyMRRTarget: goal.metaMRR };
      }
      return exec;
    });

    // Add new executives that don't exist yet
    goals.forEach((goal) => {
      if (!updatedExecutives.some((e) => e.id === goal.executiveId)) {
        updatedExecutives.push({
          id: goal.executiveId,
          name: '',
          email: '',
          teamType: 'interno',
          annualTarget: 0,
          monthlyMRRTarget: goal.metaMRR,
          monthlyTargets: { jan: 0, feb: 0, mar: 0, apr: 0, may: 0, jun: 0, jul: 0, aug: 0, sep: 0, oct: 0, nov: 0, dec: 0 },
          quarterTargets: { Q1: 0, Q2: 0, Q3: 0, Q4: 0 },
        });
      }
    });

    // Save the updated year data
    saveYear({
      ...yearData,
      executives: updatedExecutives,
    });
  }, [yearsData, currentYear, saveYear]);

  return {
    goals: goalsData,
    isLoading,
    isError,
    error: error as Error | null,
    refetch,
    getGoalForExecutive,
    updateGoal,
    saveGoals,
    isSaving,
  };
}
