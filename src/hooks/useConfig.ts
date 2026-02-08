// ============================================================================
// HOOK: useConfig - Fetch calculator config from Supabase Edge Function
// PASSO 6: Migrado para usar calculatorConfigService (Edge Function)
// With DEDUPLICATION to prevent multiple requests on mount/StrictMode
// ============================================================================

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef } from 'react';
import { CalculatorConfig, DEFAULT_CONFIG } from '@/lib/calculatorConfig';
import { getCalculatorConfigs, CalculatorConfigEntry, ConfigItem } from '@/services/calculatorConfigService';

export const CONFIG_QUERY_KEY = ['calculator-config'];

// ============================================================================
// MODULE-LEVEL DEDUPLICATION (persists across hook instances)
// ============================================================================

let loadedOnce = false;
let inFlightPromise: Promise<CalculatorConfig> | null = null;
let cachedConfig: CalculatorConfig | null = null;

/**
 * Reset the module-level cache (useful for testing or forced refresh)
 */
export function resetConfigCache() {
  loadedOnce = false;
  inFlightPromise = null;
  cachedConfig = null;
}

// ============================================================================
// ADDON LABEL MAP - Technical keys for addons
// ============================================================================

const ADDON_LABEL_TO_KEY: Record<string, string> = {
  'Antivírus': 'antivirus_unit',
  'Antivirus': 'antivirus_unit',
  'Firewall pfSense': 'firewall_pfsense',
  'TSplus': 'tsplus_unit',
  'CAL': 'cal_unit',
  'Veeam VM': 'veeam_vm_unit',
  'Veeam Agent': 'veeam_agent_unit',
  'WinServer(2vCPU/unid.)': 'winserver_2vcpu_unit',
};

// ============================================================================
// NORMALIZER: Ensure config is always an array of ConfigItem
// Handles Storage SAS nested object format: { "Brasil": [...], "Estados Unidos": [...] }
// ============================================================================

function normalizeConfigToArray(config: any): ConfigItem[] {
  if (!config) return [];
  
  if (Array.isArray(config)) {
    return config;
  }
  
  if (typeof config === 'object' && config !== null) {
    // Handle nested object format (e.g., Storage SAS)
    // Don't flatten - return empty array and handle separately in transformer
    console.log('[useConfig] Config is nested object (Storage SAS format), preserving structure');
    return [];
  }
  
  console.warn('[useConfig] Unexpected config format:', typeof config);
  return [];
}

// ============================================================================
// ADAPTER: Transform Supabase rows to CalculatorConfig
// ============================================================================

/**
 * Transform CalculatorConfigEntry[] (from Supabase) to CalculatorConfig format
 * This adapter bridges the Edge Function response to the UI's expected shape
 */
function transformSupabaseConfigToCalculatorConfig(entries: CalculatorConfigEntry[]): CalculatorConfig {
  const config: CalculatorConfig = {
    meta: {
      name: "OPEN Calculator Config",
      version: "Supabase"
    },
    fx_default: 5.0, // Default FX rate
    discount: { '1': 0, '12': 0.05, '24': 0.10, '36': 0.12, '48': 0.15 },
    gpu_usd: {},
    vm_prices_brl: { vcpu: 0, ram_per_gb: 0, nvme_per_gb: 0, ip_public: 0 },
    baremetal: { cpu_models: [], ram_tiers: [], disks: [] },
    addons_brl: {
      antivirus_unit: 0,
      firewall_pfsense: 0,
      tsplus_unit: 0,
      cal_unit: 0,
      sql: {},
      veeam_vm_unit: 0,
      veeam_agent_unit: 0,
      winserver_2vcpu_unit: 45.0,
    },
    backup_tables_brl_per_gb: DEFAULT_CONFIG.backup_tables_brl_per_gb,
    storage_pricing: {
      sas: {
        br: { pricePerTB_1_10: 0, pricePerTB_11_100: 0, pricePerTB_101_500: 0, pricePerTB_501_1024: 0, pricePerTB_gt_1024: 0 },
        usa: { pricePerTB_1_10: 0, pricePerTB_11_100: 0, pricePerTB_101_500: 0, pricePerTB_501_1024: 0, pricePerTB_gt_1024: 0 },
      },
      nvme: { pricePerGB: 0 },
    },
  };

  console.log('[useConfig] Transforming', entries.length, 'Supabase entries to CalculatorConfig');

  for (const entry of entries) {
    try {
      const category = String(entry.category || '').trim().toLowerCase();
      const section = String(entry.section || '').trim().toLowerCase();
      
      // Safely get items - handle both array and object formats
      const items: ConfigItem[] = normalizeConfigToArray(entry.config);
      
      // Handle special nested object format for Storage SAS
      const configData = entry.config as any;

      switch (category) {
        case 'geral':
          if (section === 'taxa de câmbio') {
            const fxItem = items.find(i => i.label === 'Cotação Padrão');
            if (fxItem) config.fx_default = Number(fxItem.value) || 5.0;
          }
          if (section === 'descontos por vigência') {
            for (const item of items) {
              const months = String(item.label || '').replace(' meses', '').replace(' mês', '');
              if (months) {
                config.discount[months] = (Number(item.value) || 0) / 100;
              }
            }
          }
          if (section === 'open saas') {
            const saasItem = items.find(i => i.label === 'Preço por Usuário');
            if (saasItem) config.open_saas_price_per_user = Number(saasItem.value) || 0;
          }
          break;

        case 'vm':
          if (section === 'preços de vm') {
            for (const item of items) {
              const value = Number(item.value) || 0;
              if (item.label === 'vCPU') config.vm_prices_brl.vcpu = value;
              if (item.label === 'RAM') config.vm_prices_brl.ram_per_gb = value;
              if (item.label === 'NVMe') config.vm_prices_brl.nvme_per_gb = value;
              if (item.label === 'IP Público') config.vm_prices_brl.ip_public = value;
            }
          }
          break;

        case 'gpu':
          if (section === 'preços de gpu') {
            for (const item of items) {
              if (item.label) {
                config.gpu_usd[item.label] = Number(item.value) || 0;
              }
            }
          }
          break;

        case 'baremetal':
          if (section === 'modelos de cpu') {
            config.baremetal.cpu_models = items.map((item, idx) => ({
              id: String(item.id ?? idx),
              label: item.label || '',
              price: Number(item.value) || 0,
            }));
          }
          if (section === 'opções de ram') {
            config.baremetal.ram_tiers = items.map((item, idx) => {
              let gb = 0;
              const match = String(item.label || '').match(/^(\d+)GB$/i);
              if (match) gb = parseInt(match[1], 10);
              
              return {
                id: String(item.id ?? idx),
                label: item.label || '',
                gb,
                price: Number(item.value) || 0,
              };
            });
          }
          if (section === 'opções de disco') {
            config.baremetal.disks = items.map((item, idx) => {
              let tb = 0;
              const match = String(item.label || '').match(/^(\d+)TB/i);
              if (match) tb = parseInt(match[1], 10);
              
              return {
                id: String(item.id ?? idx),
                label: item.label || '',
                tb,
                price: Number(item.value) || 0,
              };
            });
          }
          break;

        case 'add-ons':
          if (section === 'add-ons') {
            for (const item of items) {
              const technicalKey = ADDON_LABEL_TO_KEY[item.label || ''] || item.label;
              const value = Number(item.value) || 0;
              if (technicalKey && technicalKey !== 'sql') {
                (config.addons_brl as any)[technicalKey] = value;
              }
            }
          }
          break;

        case 'sql server':
          if (section === 'sql server') {
            for (const item of items) {
              const sqlKey = (item.label || '').toLowerCase() === 'nenhum' ? 'none' : (item.label || '').toLowerCase();
              config.addons_brl.sql[sqlKey] = Number(item.value) || 0;
            }
          }
          break;

        case 'storage':
          if (section === 'storage sas') {
            // Use _rawConfig if available (preserved from nested object format)
            const rawConfig = (entry as any)._rawConfig || configData;
            
            if (rawConfig && typeof rawConfig === 'object' && !Array.isArray(rawConfig)) {
              const brItems: ConfigItem[] = rawConfig['Brasil'] || [];
              const usaItems: ConfigItem[] = rawConfig['Estados Unidos'] || [];
              
              const parseTier = (label: string): string | null => {
                if (label === '1-10 TB') return 'pricePerTB_1_10';
                if (label === '11-100 TB') return 'pricePerTB_11_100';
                if (label === '101-500 TB') return 'pricePerTB_101_500';
                if (label === '501-1024 TB') return 'pricePerTB_501_1024';
                if (label === '>1024 TB') return 'pricePerTB_gt_1024';
                return null;
              };
              
              for (const item of brItems) {
                const tier = parseTier(item.label || '');
                if (tier && config.storage_pricing?.sas?.br) {
                  (config.storage_pricing.sas.br as any)[tier] = Number(item.value) || 0;
                }
              }
              
              for (const item of usaItems) {
                const tier = parseTier(item.label || '');
                if (tier && config.storage_pricing?.sas?.usa) {
                  (config.storage_pricing.sas.usa as any)[tier] = Number(item.value) || 0;
                }
              }
            }
          }
          if (section === 'ssd nvme') {
            const nvmeItem = items.find(i => i.label === 'Preço por GB');
            if (nvmeItem && config.storage_pricing?.nvme) {
              config.storage_pricing.nvme.pricePerGB = Number(nvmeItem.value) || 0;
            }
          }
          break;

        case 'kubernetes':
          if (section === 'preços base dos planos') {
            for (const item of items) {
              const value = Number(item.value) || 0;
              const label = (item.label || '').toUpperCase();
              
              if (!config.kubernetes_pricing) {
                config.kubernetes_pricing = {
                  k8s_small: { basePriceMonthly: 0 },
                  k8s_medium: { basePriceMonthly: 0 },
                  k8s_large: { basePriceMonthly: 0 },
                };
              }
              
              if (label === 'SMALL') config.kubernetes_pricing.k8s_small = { basePriceMonthly: value };
              if (label === 'MEDIUM') config.kubernetes_pricing.k8s_medium = { basePriceMonthly: value };
              if (label === 'LARGE') config.kubernetes_pricing.k8s_large = { basePriceMonthly: value };
            }
          }
          if (section === 'add-ons kubernetes') {
            if (!config.kubernetes_addons_pricing) {
              config.kubernetes_addons_pricing = {
                support_24x7: 0,
                backup_velero: 0,
                dr_multisite: 0,
                observability: 0,
                cicd_managed: 0,
                devops_hours: 0,
              };
            }
            
            for (const item of items) {
              const value = Number(item.value) || 0;
              const label = (item.label || '').toLowerCase();
              
              if (label.includes('suporte 24x7') || label.includes('24x7')) config.kubernetes_addons_pricing.support_24x7 = value;
              if (label.includes('backup') || label.includes('velero')) config.kubernetes_addons_pricing.backup_velero = value;
              if (label.includes('dr') || label.includes('multi-site')) config.kubernetes_addons_pricing.dr_multisite = value;
              if (label.includes('observabilidade') || label.includes('observability')) config.kubernetes_addons_pricing.observability = value;
              if (label.includes('ci/cd') || label.includes('cicd')) config.kubernetes_addons_pricing.cicd_managed = value;
              if (label.includes('horas devops') || label.includes('devops')) config.kubernetes_addons_pricing.devops_hours = value;
            }
          }
          break;
      }
    } catch (err) {
      // Log but don't break on individual entry errors
      console.error('[useConfig] Error processing entry:', entry.category, entry.section, err);
    }
  }

  return config;
}

// ============================================================================
// FETCH CONFIG FROM SUPABASE EDGE FUNCTION (with deduplication)
// ============================================================================

const fetchConfig = async (forceRefresh = false): Promise<CalculatorConfig> => {
  // If we've already loaded and have cached data, return it immediately
  if (!forceRefresh && loadedOnce && cachedConfig) {
    if (import.meta.env.DEV) {
      console.debug('[useConfig] Returning cached config (loadedOnce=true)');
    }
    return cachedConfig;
  }
  
  // If a request is already in flight, wait for it
  if (inFlightPromise) {
    if (import.meta.env.DEV) {
      console.debug('[useConfig] Request in flight, waiting...');
    }
    return inFlightPromise;
  }
  
  // GUARD: Check token availability
  const token = localStorage.getItem('open_access_token') || localStorage.getItem('token');
  if (!token) {
    const error = new Error('Sessão expirada. Faça login novamente.');
    console.error('[useConfig] Token ausente - sessão expirada');
    throw error;
  }
  
  // GUARD: Check PIN availability
  const pin = localStorage.getItem('open_admin_pin') || localStorage.getItem('OPEN_ADMIN_PIN');
  if (!pin) {
    const error = new Error('PIN admin ausente. Ative o Modo Admin antes de acessar preços.');
    console.error('[useConfig] PIN ausente (open_admin_pin)');
    throw error;
  }
  
  if (import.meta.env.DEV) {
    console.debug('[useConfig] Fetching config from Supabase Edge Function...');
  }
  
  // Create and store the promise
  inFlightPromise = (async () => {
    try {
      const entries = await getCalculatorConfigs();
      
      // GUARD: Validate response is array
      if (!Array.isArray(entries)) {
        console.error('[useConfig] API response is not an array:', typeof entries);
        throw new Error('Resposta inválida do servidor (esperava array)');
      }
      
      if (import.meta.env.DEV) {
        console.debug('[useConfig] Received', entries.length, 'entries from Edge Function');
      }
      
      if (entries.length === 0) {
        console.warn('[useConfig] No entries returned from Edge Function, using defaults');
        cachedConfig = DEFAULT_CONFIG;
        return DEFAULT_CONFIG;
      }
      
      const config = transformSupabaseConfigToCalculatorConfig(entries);
      
      if (import.meta.env.DEV) {
        console.debug('[useConfig] Config transformed successfully');
      }
      
      // Cache the result
      cachedConfig = config;
      loadedOnce = true;
      
      return config;
    } catch (error) {
      console.error('[useConfig] Error fetching config:', error);
      throw error;
    } finally {
      inFlightPromise = null;
    }
  })();
  
  return inFlightPromise;
};

// ============================================================================
// HOOKS
// ============================================================================

export const useConfig = () => {
  return useQuery<CalculatorConfig>({
    queryKey: CONFIG_QUERY_KEY,
    queryFn: () => fetchConfig(false),
    // Minimal refetching - let the deduplication handle it
    staleTime: 30000, // 30 seconds
    gcTime: 60000, // 1 minute
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: 2,
  });
};

// Hook to get config with loading state
export const useConfigWithFallback = () => {
  const queryClient = useQueryClient();
  const { data, isLoading, error, refetch, isFetching } = useConfig();
  
  // Force refetch that invalidates cache first
  const forceRefetch = useCallback(async () => {
    // Reset module-level cache to force fresh fetch
    resetConfigCache();
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
