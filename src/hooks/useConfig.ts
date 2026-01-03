import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect } from 'react';
import { CalculatorConfig, DEFAULT_CONFIG } from '@/lib/calculatorConfig';

export const CONFIG_QUERY_KEY = ['calculator-config'];
const LOCAL_CONFIG_KEY = 'open_precos_localConfig';

// Helper to load local config from localStorage
const loadLocalConfig = (): CalculatorConfig | null => {
  try {
    const stored = localStorage.getItem(LOCAL_CONFIG_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
};

// Fetch config from localStorage only (no API)
const fetchLocalConfig = async (): Promise<CalculatorConfig> => {
  const localConfig = loadLocalConfig();
  if (localConfig) {
    console.log('[Config] Using local config from localStorage');
    return localConfig;
  }
  
  // If no local config, use defaults
  console.log('[Config] No local config found, using defaults');
  return DEFAULT_CONFIG;
};

export const useConfig = () => {
  return useQuery<CalculatorConfig>({
    queryKey: CONFIG_QUERY_KEY,
    queryFn: fetchLocalConfig,
    staleTime: 0, // Always consider data stale to ensure fresh localStorage reads
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: true, // Refetch when returning to the page
    refetchOnMount: true, // Always refetch on mount
    retry: false,
    placeholderData: DEFAULT_CONFIG,
  });
};

// Hook to get config with loading state
export const useConfigWithFallback = () => {
  const queryClient = useQueryClient();
  const { data, isLoading, error, refetch } = useConfig();
  
  // Force refetch that invalidates cache first
  const forceRefetch = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: CONFIG_QUERY_KEY });
    return refetch();
  }, [queryClient, refetch]);

  // Listen for storage events (changes from other tabs/windows)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === LOCAL_CONFIG_KEY) {
        forceRefetch();
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [forceRefetch]);
  
  return {
    config: data || DEFAULT_CONFIG,
    isLoading,
    error,
    refetch: forceRefetch,
  };
};
