// ============================================================================
// HOOK: useConfigPersistence - Manage pricing config with API persistence
// ============================================================================

import { useState, useCallback, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { CalculatorConfig, DEFAULT_CONFIG } from '@/lib/calculatorConfig';
import { useConfigWithFallback, CONFIG_QUERY_KEY } from '@/hooks/useConfig';
import {
  getCalculatorConfigs,
  updateCalculatorConfig,
  CalculatorConfigEntry,
  ConfigItem,
  CONFIG_MAPPINGS,
} from '@/services/calculatorConfigService';

// ============================================================================
// TYPES
// ============================================================================

// Keys that identify each config type (category/section combined)
type ConfigKey = string;

// Track which sections have been modified
interface ModifiedSections {
  [key: ConfigKey]: boolean;
}

// ============================================================================
// STORAGE MAPPINGS (aligned with CSV IDs 8 and 9)
// Storage SAS (ID 8) uses a special nested object format for Brasil/Estados Unidos
// SSD NVMe (ID 9) uses standard array format
// ============================================================================

const STORAGE_SAS_MAPPING = {
  category: 'Storage',
  section: 'Storage SAS',
};

const STORAGE_NVME_MAPPING = {
  category: 'Storage',
  section: 'SSD NVMe',
};

// ============================================================================
// HELPER: Create config key from category/section
// ============================================================================

function makeConfigKey(category: string, section: string): ConfigKey {
  return `${category.toLowerCase().trim()}/${section.toLowerCase().trim()}`;
}

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
  configKey: ConfigKey;
}> {
  const payloads: Array<{
    category: string;
    section: string;
    config: ConfigItem[];
    configKey: ConfigKey;
  }> = [];

  // 1. Geral - Taxa de Câmbio (ID 12)
  const fxValue = Number(config.fx_default) || 0;
  payloads.push({
    category: CONFIG_MAPPINGS.GERAL_FX.category,
    section: CONFIG_MAPPINGS.GERAL_FX.section,
    configKey: makeConfigKey(CONFIG_MAPPINGS.GERAL_FX.category, CONFIG_MAPPINGS.GERAL_FX.section),
    config: [
      { label: 'Cotação Padrão', type: 'BRL', value: fxValue },
    ],
  });

  // 2. Geral - Descontos por Vigência (ID 13)
  const discountItems: ConfigItem[] = Object.entries(config.discount || {}).map(([months, rate]) => {
    const discountValue = Number((rate as number) * 100) || 0;
    return {
      label: months === '1' ? '1 mês' : `${months} meses`,
      type: 'percentage',
      value: discountValue,
    };
  });
  if (discountItems.length > 0) {
    payloads.push({
      category: CONFIG_MAPPINGS.GERAL_DESCONTO.category,
      section: CONFIG_MAPPINGS.GERAL_DESCONTO.section,
      configKey: makeConfigKey(CONFIG_MAPPINGS.GERAL_DESCONTO.category, CONFIG_MAPPINGS.GERAL_DESCONTO.section),
      config: discountItems,
    });
  }

  // 3. VM Prices (ID 1) - Labels must match CSV exactly
  payloads.push({
    category: CONFIG_MAPPINGS.VM_PRICES.category,
    section: CONFIG_MAPPINGS.VM_PRICES.section,
    configKey: makeConfigKey(CONFIG_MAPPINGS.VM_PRICES.category, CONFIG_MAPPINGS.VM_PRICES.section),
    config: [
      { label: 'vCPU', by: 'unit', type: 'BRL', value: Number(config.vm_prices_brl.vcpu) || 0 },
      { label: 'RAM', by: 'GB', type: 'BRL', value: Number(config.vm_prices_brl.ram_per_gb) || 0 },
      { label: 'NVMe', by: 'GB', type: 'BRL', value: Number(config.vm_prices_brl.nvme_per_gb) || 0 },
      { label: 'IP Público', by: 'unit', type: 'BRL', value: Number(config.vm_prices_brl.ip_public) || 0 },
    ],
  });

  // 4. GPU Prices (ID 5) - NOW BRL (removed USD)
  const gpuItems: ConfigItem[] = Object.entries(config.gpu_usd || {})
    .map(([name, price]) => {
      const v = Number(price);
      return {
        label: String(name).trim(),
        type: 'BRL',
        value: v,
      };
    })
    .filter((i) => i.label && Number.isFinite(i.value ?? NaN));

  // Always include GPU payload (even if empty) so the API can persist clears
  payloads.push({
    category: CONFIG_MAPPINGS.GPU_PRICES.category,
    section: CONFIG_MAPPINGS.GPU_PRICES.section,
    configKey: makeConfigKey(CONFIG_MAPPINGS.GPU_PRICES.category, CONFIG_MAPPINGS.GPU_PRICES.section),
    config: gpuItems,
  });

  // 5. BareMetal - CPU Models (ID 2) - no 'by' field in CSV
  const cpuItems: ConfigItem[] = config.baremetal.cpu_models.map((cpu) => {
    return {
      label: cpu.label,
      type: 'BRL',
      value: Number(cpu.price) || 0,
    };
  });
  if (cpuItems.length > 0) {
    payloads.push({
      category: CONFIG_MAPPINGS.BAREMETAL_CPU.category,
      section: CONFIG_MAPPINGS.BAREMETAL_CPU.section,
      configKey: makeConfigKey(CONFIG_MAPPINGS.BAREMETAL_CPU.category, CONFIG_MAPPINGS.BAREMETAL_CPU.section),
      config: cpuItems,
    });
  }

  // 6. BareMetal - RAM Options (ID 3) - no 'by' field in CSV
  const ramItems: ConfigItem[] = config.baremetal.ram_tiers.map((ram) => {
    return {
      label: ram.label,
      type: 'BRL',
      value: Number(ram.price) || 0,
    };
  });
  if (ramItems.length > 0) {
    payloads.push({
      category: CONFIG_MAPPINGS.BAREMETAL_RAM.category,
      section: CONFIG_MAPPINGS.BAREMETAL_RAM.section,
      configKey: makeConfigKey(CONFIG_MAPPINGS.BAREMETAL_RAM.category, CONFIG_MAPPINGS.BAREMETAL_RAM.section),
      config: ramItems,
    });
  }

  // 7. BareMetal - Disk Options (ID 4) - has 'by: unit' in CSV
  const diskItems: ConfigItem[] = config.baremetal.disks.map((disk) => {
    return {
      label: disk.label,
      by: 'unit',
      type: 'BRL',
      value: Number(disk.price) || 0,
    };
  });
  if (diskItems.length > 0) {
    payloads.push({
      category: CONFIG_MAPPINGS.BAREMETAL_DISK.category,
      section: CONFIG_MAPPINGS.BAREMETAL_DISK.section,
      configKey: makeConfigKey(CONFIG_MAPPINGS.BAREMETAL_DISK.category, CONFIG_MAPPINGS.BAREMETAL_DISK.section),
      config: diskItems,
    });
  }

  // 8. Add-ons (ID 6) - Labels must match CSV exactly: "Antivirus", "Firewall pfSense", etc.
  const addonItems: ConfigItem[] = [];
  const addons = config.addons_brl;
  
  if (typeof addons.antivirus_unit === 'number') {
    addonItems.push({ label: 'Antivirus', by: 'unit', type: 'BRL', value: Number(addons.antivirus_unit) || 0 });
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
  if (typeof addons.winserver_2vcpu_unit === 'number') {
    addonItems.push({ label: 'WinServer(2vCPU/unid.)', by: 'unit', type: 'BRL', value: Number(addons.winserver_2vcpu_unit) || 0 });
  }
  
  if (addonItems.length > 0) {
    payloads.push({
      category: CONFIG_MAPPINGS.ADDONS.category,
      section: CONFIG_MAPPINGS.ADDONS.section,
      configKey: makeConfigKey(CONFIG_MAPPINGS.ADDONS.category, CONFIG_MAPPINGS.ADDONS.section),
      config: addonItems,
    });
  }

  // 9. SQL Server prices (ID 7) - Labels: "Nenhum", "WEB", "STD"
  if (addons.sql && typeof addons.sql === 'object') {
    const sqlItems: ConfigItem[] = Object.entries(addons.sql)
      .filter(([edition]) => edition !== 'we') // Remove WE if present
      .map(([edition, price]) => {
      // Map edition keys to exact CSV labels
      let label = edition;
      if (edition === 'none') label = 'Nenhum';
      else if (edition === 'web') label = 'WEB';
      else if (edition === 'std') label = 'STD';
      else label = edition.toUpperCase();
      
      return {
        label,
        type: 'BRL',
        value: Number(price) || 0,
      };
    });
    if (sqlItems.length > 0) {
      payloads.push({
        category: CONFIG_MAPPINGS.SQL_SERVER.category,
        section: CONFIG_MAPPINGS.SQL_SERVER.section,
        configKey: makeConfigKey(CONFIG_MAPPINGS.SQL_SERVER.category, CONFIG_MAPPINGS.SQL_SERVER.section),
        config: sqlItems,
      });
    }
  }

  // 10. Storage SAS (ID 8) - Uses nested object format: {Brasil: [...], Estados Unidos: [...]}
  // 11. Storage NVMe (ID 9) - Uses array format: [{label, by, type, value}]
  if (config.storage_pricing) {
    const sp = config.storage_pricing;
    
    // Storage SAS - Build the nested object format as per CSV
    if (sp.sas?.br || sp.sas?.usa) {
      const sasConfig: any = {};
      
      if (sp.sas?.br) {
        sasConfig['Brasil'] = [
          { label: '1-10 TB', by: 'TB', type: 'BRL', value: Number(sp.sas.br.pricePerTB_1_10) || 0 },
          { label: '11-100 TB', by: 'TB', type: 'BRL', value: Number(sp.sas.br.pricePerTB_11_100) || 0 },
          { label: '101-500 TB', by: 'TB', type: 'BRL', value: Number(sp.sas.br.pricePerTB_101_500) || 0 },
          { label: '501-1024 TB', by: 'TB', type: 'BRL', value: Number(sp.sas.br.pricePerTB_501_1024) || 0 },
          { label: '>1024 TB', by: 'TB', type: 'BRL', value: Number(sp.sas.br.pricePerTB_gt_1024) || 0 },
        ];
      }
      
      if (sp.sas?.usa) {
        sasConfig['Estados Unidos'] = [
          { label: '1-10 TB', by: 'TB', type: 'BRL', value: Number(sp.sas.usa.pricePerTB_1_10) || 0 },
          { label: '11-100 TB', by: 'TB', type: 'BRL', value: Number(sp.sas.usa.pricePerTB_11_100) || 0 },
          { label: '101-500 TB', by: 'TB', type: 'BRL', value: Number(sp.sas.usa.pricePerTB_101_500) || 0 },
          { label: '501-1024 TB', by: 'TB', type: 'BRL', value: Number(sp.sas.usa.pricePerTB_501_1024) || 0 },
          { label: '>1024 TB', by: 'TB', type: 'BRL', value: Number(sp.sas.usa.pricePerTB_gt_1024) || 0 },
        ];
      }
      
      // Note: Storage SAS uses a special object format, not an array
      payloads.push({
        category: STORAGE_SAS_MAPPING.category,
        section: STORAGE_SAS_MAPPING.section,
        configKey: makeConfigKey(STORAGE_SAS_MAPPING.category, STORAGE_SAS_MAPPING.section),
        config: sasConfig as any, // Special nested format
      });
    }
    
    // Storage NVMe (ID 9) - Standard array format
    if (sp.nvme) {
      payloads.push({
        category: STORAGE_NVME_MAPPING.category,
        section: STORAGE_NVME_MAPPING.section,
        configKey: makeConfigKey(STORAGE_NVME_MAPPING.category, STORAGE_NVME_MAPPING.section),
        config: [
          { label: 'Preço por GB', by: 'GB', type: 'BRL', value: Number(sp.nvme.pricePerGB) || 0 },
        ],
      });
    }
  }

  // 12. Kubernetes plans (ID 10) - Format: {label, description, type, by, value}
  if (config.kubernetes_pricing) {
    const k8sItems: ConfigItem[] = Object.entries(config.kubernetes_pricing).map(([plan, data]) => {
      const planData = data as any;
      return {
        label: plan,
        description: planData?.description || '',
        type: 'BRL',
        by: 'month',
        value: Number(planData?.basePriceMonthly) || 0,
      };
    });
    if (k8sItems.length > 0) {
      payloads.push({
        category: CONFIG_MAPPINGS.KUBERNETES_PLANS.category,
        section: CONFIG_MAPPINGS.KUBERNETES_PLANS.section,
        configKey: makeConfigKey(CONFIG_MAPPINGS.KUBERNETES_PLANS.category, CONFIG_MAPPINGS.KUBERNETES_PLANS.section),
        config: k8sItems,
      });
    }
  }

  // 13. Kubernetes add-ons (ID 11) - Format: {label, type, by, value}
  if (config.kubernetes_addons_pricing) {
    const k8sAddonItems: ConfigItem[] = Object.entries(config.kubernetes_addons_pricing).map(([addon, price]) => {
      // Determine the 'by' field based on addon type
      let by = 'month';
      if (addon.toLowerCase().includes('horas') || addon.toLowerCase().includes('devops')) {
        by = 'hour';
      }
      return {
        label: addon,
        type: 'BRL',
        by,
        value: Number(price) || 0,
      };
    });
    if (k8sAddonItems.length > 0) {
      payloads.push({
        category: CONFIG_MAPPINGS.KUBERNETES_ADDONS.category,
        section: CONFIG_MAPPINGS.KUBERNETES_ADDONS.section,
        configKey: makeConfigKey(CONFIG_MAPPINGS.KUBERNETES_ADDONS.category, CONFIG_MAPPINGS.KUBERNETES_ADDONS.section),
        config: k8sAddonItems,
      });
    }
  }

  // 14. Backup pricing table (7/15/30 days with volume ranges) - ID 15
  if (config.backup_tables_brl_per_gb) {
    // Transform backup_tables_brl_per_gb to API format
    // Each retention period becomes an item with nested ranges
    const backupItems: ConfigItem[] = [];
    
    for (const [retention, ranges] of Object.entries(config.backup_tables_brl_per_gb)) {
      // Create one config item per range in each retention period
      for (const range of ranges) {
        // Use "_plus" suffix for unlimited ranges (max >= 999999)
        const maxLabel = range.max >= 999999 ? 'plus' : String(range.max);
        backupItems.push({
          label: `${retention}_dias_${range.min}_${maxLabel}`,
          by: 'GB',
          type: 'BRL',
          value: Number(range.price) || 0,
          description: `Retenção ${retention} dias, ${range.min}-${range.max >= 999999 ? '∞' : range.max} GB`,
        });
      }
    }
    
    if (backupItems.length > 0) {
      payloads.push({
        category: CONFIG_MAPPINGS.BACKUP.category,
        section: CONFIG_MAPPINGS.BACKUP.section,
        configKey: makeConfigKey(CONFIG_MAPPINGS.BACKUP.category, CONFIG_MAPPINGS.BACKUP.section),
        config: backupItems,
      });
    }
  }

  // 15. Serviços Especializados (ID 16)
  const specializedItems: ConfigItem[] = [];
  if (typeof config.addons_brl.support_basic === 'number') {
    specializedItems.push({ label: 'support_basic', description: 'Suporte Básico', type: 'BRL', by: 'month', value: config.addons_brl.support_basic });
  }
  if (typeof config.addons_brl.support_intermediate === 'number') {
    specializedItems.push({ label: 'support_intermediate', description: 'Suporte Intermediário', type: 'BRL', by: 'month', value: config.addons_brl.support_intermediate });
  }
  if (typeof config.addons_brl.support_advanced === 'number') {
    specializedItems.push({ label: 'support_advanced', description: 'Suporte Avançado', type: 'BRL', by: 'month', value: config.addons_brl.support_advanced });
  }
  if (typeof config.addons_brl.consulting_hours === 'number') {
    specializedItems.push({ label: 'consulting_hours', description: 'Consultoria Técnica', type: 'BRL', by: 'hour', value: config.addons_brl.consulting_hours });
  }
  if (typeof config.addons_brl.dba_hours === 'number') {
    specializedItems.push({ label: 'dba_hours', description: 'DBA', type: 'BRL', by: 'hour', value: config.addons_brl.dba_hours });
  }
  
  if (specializedItems.length > 0) {
    payloads.push({
      category: CONFIG_MAPPINGS.SPECIALIZED_SERVICES.category,
      section: CONFIG_MAPPINGS.SPECIALIZED_SERVICES.section,
      configKey: makeConfigKey(CONFIG_MAPPINGS.SPECIALIZED_SERVICES.category, CONFIG_MAPPINGS.SPECIALIZED_SERVICES.section),
      config: specializedItems,
    });
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
  
  // Track which sections have been modified
  const modifiedSectionsRef = useRef<ModifiedSections>({});

  // Track if we've initialized from API data (to distinguish first load from subsequent updates)
  const hasInitializedRef = useRef(false);

  // Initialize local config from API - ALWAYS sync when apiConfig changes
  useEffect(() => {
    if (apiConfig) {
      // If not dirty (user hasn't made changes), always sync from API
      if (!isDirty) {
        console.log('[ConfigPersistence] Syncing local config from API');
        setLocalConfig(apiConfig);
        modifiedSectionsRef.current = {};
        hasInitializedRef.current = true;
      } else if (!hasInitializedRef.current) {
        // First initialization even if somehow dirty
        console.log('[ConfigPersistence] Initial sync from API');
        setLocalConfig(apiConfig);
        modifiedSectionsRef.current = {};
        hasInitializedRef.current = true;
      }
    }
  }, [apiConfig, isDirty]);

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

  // The config to display/edit - NO DEFAULTS, only real API data
  const config = localConfig || apiConfig;

  // All possible config keys for fallback when no specific keys provided
  const ALL_CONFIG_KEYS: ConfigKey[] = [
    makeConfigKey(CONFIG_MAPPINGS.GERAL_FX.category, CONFIG_MAPPINGS.GERAL_FX.section),
    makeConfigKey(CONFIG_MAPPINGS.GERAL_DESCONTO.category, CONFIG_MAPPINGS.GERAL_DESCONTO.section),
    makeConfigKey(CONFIG_MAPPINGS.VM_PRICES.category, CONFIG_MAPPINGS.VM_PRICES.section),
    makeConfigKey(CONFIG_MAPPINGS.GPU_PRICES.category, CONFIG_MAPPINGS.GPU_PRICES.section),
    makeConfigKey(CONFIG_MAPPINGS.BAREMETAL_CPU.category, CONFIG_MAPPINGS.BAREMETAL_CPU.section),
    makeConfigKey(CONFIG_MAPPINGS.BAREMETAL_RAM.category, CONFIG_MAPPINGS.BAREMETAL_RAM.section),
    makeConfigKey(CONFIG_MAPPINGS.BAREMETAL_DISK.category, CONFIG_MAPPINGS.BAREMETAL_DISK.section),
    makeConfigKey(CONFIG_MAPPINGS.ADDONS.category, CONFIG_MAPPINGS.ADDONS.section),
    makeConfigKey(CONFIG_MAPPINGS.SQL_SERVER.category, CONFIG_MAPPINGS.SQL_SERVER.section),
    makeConfigKey(STORAGE_SAS_MAPPING.category, STORAGE_SAS_MAPPING.section),
    makeConfigKey(STORAGE_NVME_MAPPING.category, STORAGE_NVME_MAPPING.section),
    makeConfigKey(CONFIG_MAPPINGS.KUBERNETES_PLANS.category, CONFIG_MAPPINGS.KUBERNETES_PLANS.section),
    makeConfigKey(CONFIG_MAPPINGS.KUBERNETES_ADDONS.category, CONFIG_MAPPINGS.KUBERNETES_ADDONS.section),
    makeConfigKey(CONFIG_MAPPINGS.BACKUP.category, CONFIG_MAPPINGS.BACKUP.section),
    makeConfigKey(CONFIG_MAPPINGS.SPECIALIZED_SERVICES.category, CONFIG_MAPPINGS.SPECIALIZED_SERVICES.section),
  ];

  // Helper to mark a section as modified
  const markSectionModified = useCallback((sectionKeys: ConfigKey[]) => {
    sectionKeys.forEach(key => {
      modifiedSectionsRef.current[key] = true;
    });
  }, []);

  // Mark all sections as modified (fallback for backwards compatibility)
  const markAllSectionsModified = useCallback(() => {
    ALL_CONFIG_KEYS.forEach(key => {
      modifiedSectionsRef.current[key] = true;
    });
  }, []);

  // Update local config (marks as dirty)
  // If no specific keys are provided, marks ALL sections as modified for backwards compatibility
  const updateConfig = useCallback((updater: (prev: CalculatorConfig) => CalculatorConfig, modifiedKeys?: ConfigKey[]) => {
    setLocalConfig(prev => {
      const newConfig = updater(prev || config);
      setIsDirty(true);
      
      // If specific keys provided, mark them as modified
      // Otherwise, mark ALL sections as modified (backwards compatible behavior)
      if (modifiedKeys && modifiedKeys.length > 0) {
        markSectionModified(modifiedKeys);
      } else {
        // No specific keys = assume any section could have changed
        markAllSectionsModified();
      }
      
      return newConfig;
    });
  }, [config, markSectionModified, markAllSectionsModified]);

  // Wrapper to update VM prices and mark section modified
  const updateVmPrices = useCallback((updater: (prev: CalculatorConfig) => CalculatorConfig) => {
    const key = makeConfigKey(CONFIG_MAPPINGS.VM_PRICES.category, CONFIG_MAPPINGS.VM_PRICES.section);
    updateConfig(updater, [key]);
  }, [updateConfig]);

  // Wrapper to update GPU prices and mark section modified
  const updateGpuPrices = useCallback((updater: (prev: CalculatorConfig) => CalculatorConfig) => {
    const key = makeConfigKey(CONFIG_MAPPINGS.GPU_PRICES.category, CONFIG_MAPPINGS.GPU_PRICES.section);
    updateConfig(updater, [key]);
  }, [updateConfig]);

  // Wrapper to update BareMetal and mark sections modified
  const updateBaremetal = useCallback((updater: (prev: CalculatorConfig) => CalculatorConfig, section: 'cpu' | 'ram' | 'disk') => {
    let key: ConfigKey;
    if (section === 'cpu') {
      key = makeConfigKey(CONFIG_MAPPINGS.BAREMETAL_CPU.category, CONFIG_MAPPINGS.BAREMETAL_CPU.section);
    } else if (section === 'ram') {
      key = makeConfigKey(CONFIG_MAPPINGS.BAREMETAL_RAM.category, CONFIG_MAPPINGS.BAREMETAL_RAM.section);
    } else {
      key = makeConfigKey(CONFIG_MAPPINGS.BAREMETAL_DISK.category, CONFIG_MAPPINGS.BAREMETAL_DISK.section);
    }
    updateConfig(updater, [key]);
  }, [updateConfig]);

  // Wrapper to update Add-ons and mark section modified
  const updateAddons = useCallback((updater: (prev: CalculatorConfig) => CalculatorConfig, includeSql?: boolean) => {
    const keys = [makeConfigKey(CONFIG_MAPPINGS.ADDONS.category, CONFIG_MAPPINGS.ADDONS.section)];
    if (includeSql) {
      keys.push(makeConfigKey(CONFIG_MAPPINGS.SQL_SERVER.category, CONFIG_MAPPINGS.SQL_SERVER.section));
    }
    updateConfig(updater, keys);
  }, [updateConfig]);

  // Wrapper to update Storage and mark sections modified
  const updateStorage = useCallback((updater: (prev: CalculatorConfig) => CalculatorConfig, type: 'sas' | 'nvme' | 'both') => {
    const keys: ConfigKey[] = [];
    if (type === 'sas' || type === 'both') {
      keys.push(makeConfigKey(STORAGE_SAS_MAPPING.category, STORAGE_SAS_MAPPING.section));
    }
    if (type === 'nvme' || type === 'both') {
      keys.push(makeConfigKey(STORAGE_NVME_MAPPING.category, STORAGE_NVME_MAPPING.section));
    }
    updateConfig(updater, keys);
  }, [updateConfig]);

  // Wrapper to update Kubernetes and mark sections modified
  const updateKubernetes = useCallback((updater: (prev: CalculatorConfig) => CalculatorConfig, type: 'plans' | 'addons' | 'both') => {
    const keys: ConfigKey[] = [];
    if (type === 'plans' || type === 'both') {
      keys.push(makeConfigKey(CONFIG_MAPPINGS.KUBERNETES_PLANS.category, CONFIG_MAPPINGS.KUBERNETES_PLANS.section));
    }
    if (type === 'addons' || type === 'both') {
      keys.push(makeConfigKey(CONFIG_MAPPINGS.KUBERNETES_ADDONS.category, CONFIG_MAPPINGS.KUBERNETES_ADDONS.section));
    }
    updateConfig(updater, keys);
  }, [updateConfig]);

  // Wrapper to update general settings (FX, discounts)
  const updateGeneral = useCallback((updater: (prev: CalculatorConfig) => CalculatorConfig, type: 'fx' | 'discount') => {
    const key = type === 'fx' 
      ? makeConfigKey(CONFIG_MAPPINGS.GERAL_FX.category, CONFIG_MAPPINGS.GERAL_FX.section)
      : makeConfigKey(CONFIG_MAPPINGS.GERAL_DESCONTO.category, CONFIG_MAPPINGS.GERAL_DESCONTO.section);
    updateConfig(updater, [key]);
  }, [updateConfig]);

  // Wrapper to update Backup and mark section modified
  const updateBackup = useCallback((updater: (prev: CalculatorConfig) => CalculatorConfig) => {
    const key = makeConfigKey(CONFIG_MAPPINGS.BACKUP.category, CONFIG_MAPPINGS.BACKUP.section);
    updateConfig(updater, [key]);
  }, [updateConfig]);

  // Wrapper to update Serviços Especializados and mark section modified
  const updateSpecializedServices = useCallback((updater: (prev: CalculatorConfig) => CalculatorConfig) => {
    const key = makeConfigKey(CONFIG_MAPPINGS.SPECIALIZED_SERVICES.category, CONFIG_MAPPINGS.SPECIALIZED_SERVICES.section);
    updateConfig(updater, [key]);
  }, [updateConfig]);

  // Find existing entry ID by category/section (case-insensitive)
  const findEntryId = useCallback((category: string, section: string): number | undefined => {
    const c = String(category).trim().toLowerCase();
    const s = String(section).trim().toLowerCase();
    const entry = apiEntries.find(
      (e) => String(e.category).trim().toLowerCase() === c && String(e.section).trim().toLowerCase() === s
    );
    return entry?.id;
  }, [apiEntries]);

  type SaveOptions = {
    allowEmptyGpuSave?: boolean;
  };

  // Save only MODIFIED changes to API
  const saveToApi = useCallback(async (options: SaveOptions = {}): Promise<boolean> => {
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

    const gpuKey = makeConfigKey(CONFIG_MAPPINGS.GPU_PRICES.category, CONFIG_MAPPINGS.GPU_PRICES.section);
    const modifiedKeys = Object.keys(modifiedSectionsRef.current).filter(k => modifiedSectionsRef.current[k]);

    if (modifiedKeys.length === 0) {
      toast({
        title: 'Nenhuma alteração',
        description: 'Não há mudanças para salvar.',
      });
      setIsSaving(false);
      return true;
    }

    console.log('[ConfigPersistence] Sections modified:', modifiedKeys);

    try {
      // Convert local config to API payloads
      const allPayloads = configToApiPayloads(localConfig);
      
      // Filter only modified payloads
      const payloadsToSave = allPayloads.filter(p => modifiedKeys.includes(p.configKey));

      console.log('[ConfigPersistence] Saving ONLY modified payloads:', payloadsToSave.map(p => p.configKey));

      // Safety: block empty GPU save unless explicitly allowed
      const gpuPayload = payloadsToSave.find((p) => p.configKey === gpuKey);
      if (gpuPayload && Array.isArray(gpuPayload.config) && gpuPayload.config.length === 0 && !options.allowEmptyGpuSave) {
        toast({
          title: 'Configuração vazia de GPU',
          description: 'Você está prestes a salvar uma configuração vazia de GPU. Confirme para continuar.',
          variant: 'destructive',
        });
        setIsSaving(false);
        return false;
      }

      const validateArrayItems = (items: ConfigItem[], ctx: string) => {
        for (const it of items) {
          if (!it || typeof it !== 'object') {
            throw new Error(`Item inválido em ${ctx}`);
          }
          if (!it.label || String(it.label).trim().length === 0) {
            throw new Error(`Item sem label em ${ctx}`);
          }
          if (typeof it.value !== 'number' || !Number.isFinite(it.value)) {
            throw new Error(`Valor inválido (NaN/undefined) em ${ctx}: ${it.label}`);
          }
        }
      };

      const expectedGpuCount = Object.keys(localConfig.gpu_usd || {}).length;
      let savedCount = 0;

      // Process each modified payload - ONLY UPDATE existing entries (no POST/create)
      for (const payload of payloadsToSave) {
        const ctx = `${payload.category}/${payload.section}`;
        const isGpu = payload.configKey === gpuKey;

        // GPU config MUST be an array
        if (isGpu && !Array.isArray(payload.config)) {
          throw new Error('Configuração de GPU inválida (config não é array).');
        }

        // Validate array payloads to avoid persisting NaN/undefined
        if (Array.isArray(payload.config)) {
          validateArrayItems(payload.config, ctx);
        }

        const existingId = findEntryId(payload.category, payload.section);

        // For GPU, missing ID is a hard error
        if (isGpu && !existingId) {
          throw new Error('Configuração de GPU não encontrada na API (sem ID para atualizar).');
        }

        if (existingId) {
          const entry = apiEntries.find((e) => e.id === existingId);
          const requestBody = {
            category: entry?.category ?? payload.category,
            section: entry?.section ?? payload.section,
            config: payload.config,
          };

          console.log('[ConfigPersistence] PUT payload:', { id: existingId, ...requestBody });
          const updated = await updateCalculatorConfig(existingId, requestBody);
          console.log('[ConfigPersistence] PUT response:', updated);
          savedCount++;
        } else {
          // Config not found in database - skip with warning
          console.warn(`[ConfigPersistence] Skipped: ${ctx} - not found in database (no POST available)`);
        }
      }

      // Refresh data from API
      await fetchApiEntries();
      await queryClient.invalidateQueries({ queryKey: CONFIG_QUERY_KEY });
      const result = await refetch();

      // Update local config with fresh API data
      if (result.data) {
        const apiGpuCount = Object.keys(result.data.gpu_usd || {}).length;

        if (expectedGpuCount > 0 && apiGpuCount === 0 && modifiedKeys.includes(gpuKey)) {
          console.error('[ConfigPersistence] GPU config came back empty after save', {
            expectedGpuCount,
            apiGpuCount,
          });

          toast({
            title: 'Erro ao salvar preços de GPU',
            description: 'Nenhuma alteração foi persistida.',
            variant: 'destructive',
          });

          return false;
        }

        setLocalConfig(result.data);
      }

      // Clear modified sections and dirty flag
      modifiedSectionsRef.current = {};
      setIsDirty(false);

      toast({
        title: 'Preços salvos com sucesso',
        description: `${savedCount} configuração(ões) atualizada(s) no banco de dados.`,
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
        title: 'Erro ao salvar preços',
        description: 'Nenhuma alteração foi persistida.',
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [localConfig, findEntryId, fetchApiEntries, queryClient, refetch, apiEntries]);

  // Reset to API values (discard local changes)
  const resetToApi = useCallback(async () => {
    try {
      // Invalidate cache and refetch
      await queryClient.invalidateQueries({ queryKey: CONFIG_QUERY_KEY });
      const result = await refetch();
      
      if (result.data) {
        setLocalConfig(result.data);
      }
      
      // Clear modified sections
      modifiedSectionsRef.current = {};
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
      console.warn('[ConfigPersistence] Refresh requested with unsaved changes');
    }
    
    try {
      await queryClient.invalidateQueries({ queryKey: CONFIG_QUERY_KEY });
      const result = await refetch();
      
      if (result.data) {
        setLocalConfig(result.data);
      }
      
      modifiedSectionsRef.current = {};
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
    // isLoading is true when API is loading OR config is not yet available
    isLoading: isApiLoading || !config,
    isSaving,
    isDirty,
    error,
    updateConfig,
    // Section-specific update helpers
    updateVmPrices,
    updateGpuPrices,
    updateBaremetal,
    updateAddons,
    updateStorage,
    updateKubernetes,
    updateGeneral,
    updateBackup,
    updateSpecializedServices,
    // API operations
    saveToApi,
    resetToApi,
    refreshFromApi,
    // Utility to mark sections as modified externally
    markSectionModified: (keys: string[]) => markSectionModified(keys as ConfigKey[]),
  };
}
