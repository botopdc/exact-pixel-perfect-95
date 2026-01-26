import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { CalculatorConfig, DEFAULT_CONFIG } from '@/lib/calculatorConfig';
import { openApi, CalculatorConfigApiResponse } from '@/lib/openApi';

export const CONFIG_QUERY_KEY = ['calculator-config'];

// Transform API response to CalculatorConfig format
// CRITICAL: Ensure all nested objects are always initialized to prevent null-safety crashes
const transformApiConfig = (apiConfig: CalculatorConfigApiResponse): CalculatorConfig => {
  // Ensure addons_brl.sql is always an object
  const addons_brl = apiConfig.addons_brl || {};
  const normalizedAddonsBrl = {
    antivirus_unit: typeof addons_brl.antivirus_unit === 'number' ? addons_brl.antivirus_unit : 0,
    firewall_pfsense: typeof addons_brl.firewall_pfsense === 'number' ? addons_brl.firewall_pfsense : 0,
    tsplus_unit: typeof addons_brl.tsplus_unit === 'number' ? addons_brl.tsplus_unit : 0,
    cal_unit: typeof addons_brl.cal_unit === 'number' ? addons_brl.cal_unit : 0,
    veeam_vm_unit: typeof addons_brl.veeam_vm_unit === 'number' ? addons_brl.veeam_vm_unit : 0,
    veeam_agent_unit: typeof addons_brl.veeam_agent_unit === 'number' ? addons_brl.veeam_agent_unit : 0,
    winserver_2vcpu_unit: typeof addons_brl.winserver_2vcpu_unit === 'number' ? addons_brl.winserver_2vcpu_unit : 45.0,
    // sql MUST always be an object, never undefined/null
    sql: (typeof addons_brl.sql === 'object' && addons_brl.sql !== null) 
      ? addons_brl.sql as Record<string, number>
      : {},
    // Serviços Especializados (ID 16) - mapped from API
    support_basic: typeof addons_brl.support_basic === 'number' ? addons_brl.support_basic : undefined,
    support_intermediate: typeof addons_brl.support_intermediate === 'number' ? addons_brl.support_intermediate : undefined,
    support_advanced: typeof addons_brl.support_advanced === 'number' ? addons_brl.support_advanced : undefined,
    consulting_hours: typeof addons_brl.consulting_hours === 'number' ? addons_brl.consulting_hours : undefined,
    dba_hours: typeof addons_brl.dba_hours === 'number' ? addons_brl.dba_hours : undefined,
  };

  return {
    meta: {
      name: "OPEN Calculator Config",
      version: "API"
    },
    fx_default: apiConfig.fx_default,
    discount: apiConfig.discount,
    gpu_usd: apiConfig.gpu_usd,
    vm_prices_brl: apiConfig.vm_prices_brl,
    baremetal: apiConfig.baremetal,
    addons_brl: normalizedAddonsBrl,
    // Fallback to DEFAULT_CONFIG if API returns empty backup tables
    backup_tables_brl_per_gb: Object.keys(apiConfig.backup_tables_brl_per_gb || {}).length > 0
      ? apiConfig.backup_tables_brl_per_gb
      : DEFAULT_CONFIG.backup_tables_brl_per_gb,
    open_saas_price_per_user: apiConfig.open_saas_price_per_user,
    storage_prices: apiConfig.storage_prices as unknown as CalculatorConfig['storage_prices'],
    storage_pricing: apiConfig.storage_pricing as unknown as CalculatorConfig['storage_pricing'],
    kubernetes_pricing: apiConfig.kubernetes_pricing as unknown as CalculatorConfig['kubernetes_pricing'],
    kubernetes_addons_pricing: apiConfig.kubernetes_addons_pricing as unknown as CalculatorConfig['kubernetes_addons_pricing'],
  };
};

// Fetch config from API - NO FALLBACKS, throw on error
const fetchConfig = async (): Promise<CalculatorConfig> => {
  console.log('[Config] Fetching config from API...');
  const apiConfig = await openApi.getCalculatorConfig();
  console.log('[Config] API config loaded successfully');
  return transformApiConfig(apiConfig);
};

export const useConfig = () => {
  return useQuery<CalculatorConfig>({
    queryKey: CONFIG_QUERY_KEY,
    queryFn: fetchConfig,
    // NO CACHE - Always fetch fresh data from API
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
    retry: 2,
    // NO placeholder - wait for real API data
  });
};

// Hook to get config with loading state
export const useConfigWithFallback = () => {
  const queryClient = useQueryClient();
  const { data, isLoading, error, refetch, isFetching } = useConfig();
  
  // Force refetch that invalidates cache first
  const forceRefetch = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: CONFIG_QUERY_KEY });
    return refetch();
  }, [queryClient, refetch]);
  
  return {
    // Only return data when it's actually loaded from API, otherwise undefined
    config: data,
    isLoading: isLoading || isFetching,
    error,
    refetch: forceRefetch,
  };
};
