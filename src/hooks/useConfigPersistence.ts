// ============================================================================
// HOOK: useConfigPersistence - Manage pricing config with API persistence
// ============================================================================

import { useState, useCallback, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { CalculatorConfig, DEFAULT_CONFIG } from '@/lib/calculatorConfig';
import { useConfigWithFallback, CONFIG_QUERY_KEY } from '@/hooks/useConfig';
import {
  getCalculatorConfigs,
  createCalculatorConfig,
  updateCalculatorConfig,
  CalculatorConfigEntry,
  ConfigItem,
  CONFIG_MAPPINGS,
} from '@/services/calculatorConfigService';

// ============================================================================
// TYPES
// ============================================================================

interface ConfigPersistenceState {
  config: CalculatorConfig;
  apiEntries: CalculatorConfigEntry[];
  isLoading: boolean;
  isSaving: boolean;
  isDirty: boolean;
  error: string | null;
}

// ============================================================================
// STORAGE ADVANCED MAPPING (category: Storage, section: Storage Avançado)
// ============================================================================

const STORAGE_ADVANCED_MAPPING = {
  category: 'Storage',
  section: 'Storage Avançado',
};

// ============================================================================
// TRANSFORM: CalculatorConfig → API Entries
// ============================================================================

/**
 * Transform local CalculatorConfig back to API format for saving
 * CRITICAL: All items MUST have `value` field (not `price`)
 */
function configToApiPayloads(config: CalculatorConfig): Array<{
  category: string;
  section: string;
  config: ConfigItem[];
  existingId?: number;
}> {
  const payloads: Array<{
    category: string;
    section: string;
    config: ConfigItem[];
    existingId?: number;
  }> = [];

  // 1. Geral - Configurações Gerais (FX)
  const fxValue = Number(config.fx_default) || 0;
  payloads.push({
    category: CONFIG_MAPPINGS.GERAL_CONFIG.category,
    section: CONFIG_MAPPINGS.GERAL_CONFIG.section,
    config: [
      { label: 'FX Padrão', by: 'unit', type: 'USD', value: fxValue },
    ],
  });

  // 2. Geral - Descontos por Prazo
  const discountItems: ConfigItem[] = Object.entries(config.discount || {}).map(([months, rate]) => {
    const discountValue = Number((rate as number) * 100) || 0;
    return {
      label: months === '1' ? '1 mês' : `${months} meses`,
      by: 'percentage',
      type: 'PERCENTAGE',
      value: discountValue,
    };
  });
  if (discountItems.length > 0) {
    payloads.push({
      category: CONFIG_MAPPINGS.GERAL_DESCONTO.category,
      section: CONFIG_MAPPINGS.GERAL_DESCONTO.section,
      config: discountItems,
    });
  }

  // 3. VM Prices
  payloads.push({
    category: CONFIG_MAPPINGS.VM_PRICES.category,
    section: CONFIG_MAPPINGS.VM_PRICES.section,
    config: [
      { label: 'vCPU', by: 'unit', type: 'BRL', value: Number(config.vm_prices_brl.vcpu) || 0 },
      { label: 'RAM por GB', by: 'gb', type: 'BRL', value: Number(config.vm_prices_brl.ram_per_gb) || 0 },
      { label: 'NVMe por GB', by: 'gb', type: 'BRL', value: Number(config.vm_prices_brl.nvme_per_gb) || 0 },
      { label: 'IP Público', by: 'unit', type: 'BRL', value: Number(config.vm_prices_brl.ip_public) || 0 },
    ],
  });

  // 4. GPU Prices
  const gpuItems: ConfigItem[] = Object.entries(config.gpu_usd || {}).map(([name, price]) => {
    const gpuValue = Number(price) || 0;
    return {
      label: name,
      by: 'unit',
      type: 'USD',
      value: gpuValue,
    };
  });
  if (gpuItems.length > 0) {
    payloads.push({
      category: CONFIG_MAPPINGS.GPU_PRICES.category,
      section: CONFIG_MAPPINGS.GPU_PRICES.section,
      config: gpuItems,
    });
  }

  // 5. BareMetal - CPU Models
  const cpuItems: ConfigItem[] = config.baremetal.cpu_models.map((cpu) => {
    return {
      label: cpu.label,
      by: 'unit',
      type: 'BRL',
      value: Number(cpu.price) || 0,
    };
  });
  if (cpuItems.length > 0) {
    payloads.push({
      category: CONFIG_MAPPINGS.BAREMETAL_CPU.category,
      section: CONFIG_MAPPINGS.BAREMETAL_CPU.section,
      config: cpuItems,
    });
  }

  // 6. BareMetal - RAM Tiers
  const ramItems: ConfigItem[] = config.baremetal.ram_tiers.map((ram) => {
    return {
      label: ram.label,
      by: 'gb',
      type: 'BRL',
      value: Number(ram.price) || 0,
      gb: ram.gb,
    };
  });
  if (ramItems.length > 0) {
    payloads.push({
      category: CONFIG_MAPPINGS.BAREMETAL_RAM.category,
      section: CONFIG_MAPPINGS.BAREMETAL_RAM.section,
      config: ramItems,
    });
  }

  // 7. BareMetal - Disks
  const diskItems: ConfigItem[] = config.baremetal.disks.map((disk) => {
    return {
      label: disk.label,
      by: 'tb',
      type: 'BRL',
      value: Number(disk.price) || 0,
      tb: disk.tb,
    };
  });
  if (diskItems.length > 0) {
    payloads.push({
      category: CONFIG_MAPPINGS.BAREMETAL_DISK.category,
      section: CONFIG_MAPPINGS.BAREMETAL_DISK.section,
      config: diskItems,
    });
  }

  // 8. Add-ons (using visual labels for API, but reading from technical keys)
  const addonItems: ConfigItem[] = [];
  const addons = config.addons_brl;
  
  if (typeof addons.antivirus_unit === 'number') {
    addonItems.push({ label: 'Antivírus', by: 'unit', type: 'BRL', value: Number(addons.antivirus_unit) || 0 });
  }
  if (typeof addons.firewall_pfsense === 'number') {
    addonItems.push({ label: 'Firewall pfSense', by: 'unit', type: 'BRL', value: Number(addons.firewall_pfsense) || 0 });
  }
  if (typeof addons.tsplus_unit === 'number') {
    addonItems.push({ label: 'TSplus', by: 'unit', type: 'BRL', value: Number(addons.tsplus_unit) || 0 });
  }
  if (typeof addons.cal_unit === 'number') {
    addonItems.push({ label: 'CAL', by: 'unit', type: 'BRL', value: Number(addons.cal_unit) || 0 });
  }
  if (typeof addons.veeam_vm_unit === 'number') {
    addonItems.push({ label: 'Veeam VM', by: 'unit', type: 'BRL', value: Number(addons.veeam_vm_unit) || 0 });
  }
  if (typeof addons.veeam_agent_unit === 'number') {
    addonItems.push({ label: 'Veeam Agent', by: 'unit', type: 'BRL', value: Number(addons.veeam_agent_unit) || 0 });
  }
  
  if (addonItems.length > 0) {
    payloads.push({
      category: CONFIG_MAPPINGS.ADDONS.category,
      section: CONFIG_MAPPINGS.ADDONS.section,
      config: addonItems,
    });
  }

  // 9. SQL Server prices
  if (addons.sql && typeof addons.sql === 'object') {
    const sqlItems: ConfigItem[] = Object.entries(addons.sql).map(([edition, price]) => {
      return {
        label: edition === 'none' ? 'Nenhum' : edition.charAt(0).toUpperCase() + edition.slice(1),
        by: 'license',
        type: 'BRL',
        value: Number(price) || 0,
      };
    });
    if (sqlItems.length > 0) {
      payloads.push({
        category: CONFIG_MAPPINGS.SQL_SERVER.category,
        section: CONFIG_MAPPINGS.SQL_SERVER.section,
        config: sqlItems,
      });
    }
  }

  // 10. Storage Avançado (SAS BR, SAS USA, NVMe)
  if (config.storage_pricing) {
    const storageAdvancedItems: ConfigItem[] = [];
    const sp = config.storage_pricing;
    
    // SAS BR (5 tiers)
    if (sp.sas?.br) {
      storageAdvancedItems.push(
        { label: 'sas_br_pricePerTB_1_10', by: 'tb', type: 'BRL', value: Number(sp.sas.br.pricePerTB_1_10) || 0 },
        { label: 'sas_br_pricePerTB_11_100', by: 'tb', type: 'BRL', value: Number(sp.sas.br.pricePerTB_11_100) || 0 },
        { label: 'sas_br_pricePerTB_101_500', by: 'tb', type: 'BRL', value: Number(sp.sas.br.pricePerTB_101_500) || 0 },
        { label: 'sas_br_pricePerTB_501_1024', by: 'tb', type: 'BRL', value: Number(sp.sas.br.pricePerTB_501_1024) || 0 },
        { label: 'sas_br_pricePerTB_gt_1024', by: 'tb', type: 'BRL', value: Number(sp.sas.br.pricePerTB_gt_1024) || 0 },
      );
    }
    
    // SAS USA (5 tiers)
    if (sp.sas?.usa) {
      storageAdvancedItems.push(
        { label: 'sas_usa_pricePerTB_1_10', by: 'tb', type: 'BRL', value: Number(sp.sas.usa.pricePerTB_1_10) || 0 },
        { label: 'sas_usa_pricePerTB_11_100', by: 'tb', type: 'BRL', value: Number(sp.sas.usa.pricePerTB_11_100) || 0 },
        { label: 'sas_usa_pricePerTB_101_500', by: 'tb', type: 'BRL', value: Number(sp.sas.usa.pricePerTB_101_500) || 0 },
        { label: 'sas_usa_pricePerTB_501_1024', by: 'tb', type: 'BRL', value: Number(sp.sas.usa.pricePerTB_501_1024) || 0 },
        { label: 'sas_usa_pricePerTB_gt_1024', by: 'tb', type: 'BRL', value: Number(sp.sas.usa.pricePerTB_gt_1024) || 0 },
      );
    }
    
    // NVMe
    if (sp.nvme) {
      storageAdvancedItems.push(
        { label: 'nvme_pricePerGB', by: 'gb', type: 'BRL', value: Number(sp.nvme.pricePerGB) || 0 },
      );
    }
    
    if (storageAdvancedItems.length > 0) {
      payloads.push({
        category: STORAGE_ADVANCED_MAPPING.category,
        section: STORAGE_ADVANCED_MAPPING.section,
        config: storageAdvancedItems,
      });
    }
  }

  // 11. Kubernetes plans (type: 'plan')
  if (config.kubernetes_pricing) {
    const k8sItems: ConfigItem[] = Object.entries(config.kubernetes_pricing).map(([plan, data]) => {
      return {
        label: plan,
        by: 'plan',
        type: 'plan', // Differentiate from addons
        value: Number((data as any)?.basePriceMonthly) || 0,
      };
    });
    if (k8sItems.length > 0) {
      payloads.push({
        category: CONFIG_MAPPINGS.KUBERNETES_PLANS.category,
        section: CONFIG_MAPPINGS.KUBERNETES_PLANS.section,
        config: k8sItems,
      });
    }
  }

  // 12. Kubernetes add-ons (type: 'addon')
  if (config.kubernetes_addons_pricing) {
    const k8sAddonItems: ConfigItem[] = Object.entries(config.kubernetes_addons_pricing).map(([addon, price]) => {
      return {
        label: addon,
        by: 'unit',
        type: 'addon', // Differentiate from plans
        value: Number(price) || 0,
      };
    });
    if (k8sAddonItems.length > 0) {
      payloads.push({
        category: CONFIG_MAPPINGS.KUBERNETES_ADDONS.category,
        section: CONFIG_MAPPINGS.KUBERNETES_ADDONS.section,
        config: k8sAddonItems,
      });
    }
  }

  return payloads;
}

// ============================================================================
// HOOK: useConfigPersistence
// ============================================================================

export function useConfigPersistence() {
  const queryClient = useQueryClient();
  const { config: apiConfig, isLoading: isApiLoading, refetch } = useConfigWithFallback();
  
  // Local state
  const [localConfig, setLocalConfig] = useState<CalculatorConfig | null>(null);
  const [apiEntries, setApiEntries] = useState<CalculatorConfigEntry[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize local config from API
  useEffect(() => {
    if (apiConfig && !localConfig) {
      setLocalConfig(apiConfig);
    }
  }, [apiConfig, localConfig]);

  // Fetch raw API entries for mapping IDs
  const fetchApiEntries = useCallback(async () => {
    try {
      const entries = await getCalculatorConfigs();
      setApiEntries(entries);
    } catch (err) {
      console.warn('[ConfigPersistence] Failed to fetch API entries:', err);
    }
  }, []);

  // Initial fetch of API entries
  useEffect(() => {
    fetchApiEntries();
  }, [fetchApiEntries]);

  // The config to display/edit
  const config = localConfig || apiConfig || DEFAULT_CONFIG;

  // Update local config (marks as dirty)
  const updateConfig = useCallback((updater: (prev: CalculatorConfig) => CalculatorConfig) => {
    setLocalConfig(prev => {
      const newConfig = updater(prev || config);
      setIsDirty(true);
      return newConfig;
    });
  }, [config]);

  // Find existing entry ID by category/section
  const findEntryId = useCallback((category: string, section: string): number | undefined => {
    const entry = apiEntries.find(e => e.category === category && e.section === section);
    return entry?.id;
  }, [apiEntries]);

  // Save all changes to API
  const saveToApi = useCallback(async (): Promise<boolean> => {
    if (!localConfig) {
      toast({
        title: 'Erro',
        description: 'Nenhuma configuração para salvar.',
        variant: 'destructive',
      });
      return false;
    }

    setIsSaving(true);
    setError(null);

    try {
      // Convert local config to API payloads
      const payloads = configToApiPayloads(localConfig);
      
      console.log('[ConfigPersistence] Saving payloads:', payloads.map(p => `${p.category}/${p.section}`));
      
      // Process each payload
      for (const payload of payloads) {
        const existingId = findEntryId(payload.category, payload.section);
        
        if (existingId) {
          // Update existing entry
          await updateCalculatorConfig(existingId, {
            config: payload.config,
          });
          console.log(`[ConfigPersistence] Updated: ${payload.category}/${payload.section} (ID: ${existingId})`);
        } else {
          // Create new entry
          await createCalculatorConfig({
            category: payload.category,
            section: payload.section,
            config: payload.config,
          });
          console.log(`[ConfigPersistence] Created: ${payload.category}/${payload.section}`);
        }
      }

      // Refresh data from API
      await fetchApiEntries();
      await queryClient.invalidateQueries({ queryKey: CONFIG_QUERY_KEY });
      const result = await refetch();
      
      // Update local config with fresh API data
      if (result.data) {
        setLocalConfig(result.data);
      }

      setIsDirty(false);
      
      toast({
        title: 'Salvo na API com sucesso',
        description: 'As configurações de preços foram persistidas no banco de dados.',
      });
      
      return true;
    } catch (err: any) {
      console.error('[ConfigPersistence] Save failed:', err);
      
      const errorMessage = err?.response?.data?.message || err?.message || 'Erro ao salvar';
      setError(errorMessage);
      
      // Handle 401
      if (err?.response?.status === 401) {
        toast({
          title: 'Sessão expirada',
          description: 'Faça login novamente.',
          variant: 'destructive',
        });
        return false;
      }
      
      // Handle 422 validation
      if (err?.response?.status === 422) {
        const validationErrors = err?.response?.data?.errors;
        const errorDetails = validationErrors 
          ? Object.values(validationErrors).flat().join(', ')
          : errorMessage;
        
        toast({
          title: 'Erro de validação',
          description: errorDetails,
          variant: 'destructive',
        });
        return false;
      }
      
      toast({
        title: 'Erro ao salvar',
        description: errorMessage,
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [localConfig, findEntryId, fetchApiEntries, queryClient, refetch]);

  // Reset to API values (discard local changes)
  const resetToApi = useCallback(async () => {
    try {
      // Invalidate cache and refetch
      await queryClient.invalidateQueries({ queryKey: CONFIG_QUERY_KEY });
      const result = await refetch();
      
      if (result.data) {
        setLocalConfig(result.data);
      }
      
      setIsDirty(false);
      setError(null);
      
      // Also refresh API entries
      await fetchApiEntries();
      
      toast({
        title: 'Configuração restaurada',
        description: 'Valores carregados da API.',
      });
    } catch (err) {
      console.error('[ConfigPersistence] Reset failed:', err);
      toast({
        title: 'Erro',
        description: 'Falha ao carregar da API.',
        variant: 'destructive',
      });
    }
  }, [queryClient, refetch, fetchApiEntries]);

  // Refresh from API
  const refreshFromApi = useCallback(async () => {
    if (isDirty) {
      // Show confirmation would be handled by the component
      console.warn('[ConfigPersistence] Refresh requested with unsaved changes');
    }
    
    try {
      await queryClient.invalidateQueries({ queryKey: CONFIG_QUERY_KEY });
      const result = await refetch();
      
      if (result.data) {
        setLocalConfig(result.data);
      }
      
      setIsDirty(false);
      await fetchApiEntries();
      
      toast({
        title: 'Atualizado',
        description: 'Configurações carregadas da API.',
      });
    } catch (err) {
      console.error('[ConfigPersistence] Refresh failed:', err);
    }
  }, [isDirty, queryClient, refetch, fetchApiEntries]);

  return {
    config,
    isLoading: isApiLoading,
    isSaving,
    isDirty,
    error,
    updateConfig,
    saveToApi,
    resetToApi,
    refreshFromApi,
  };
}
