// ============================================================================
// HOOK: useConfigPersistence - Manage pricing config with FLAT API structure
// Nova estrutura: id, label, value, meta (JSON)
// ============================================================================

import { useState, useCallback, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { CalculatorConfig, DEFAULT_CONFIG } from '@/lib/calculatorConfig';
import { useConfigWithFallback, CONFIG_QUERY_KEY } from '@/hooks/useConfig';
import {
  getCalculatorConfigs,
  createCalculatorConfig,
  updateCalculatorConfig,
  deleteCalculatorConfig,
  CalculatorConfigItem,
  ConfigMeta,
  CONFIG_CATEGORIES,
  findConfigByLabelInCategory,
  groupConfigsByCategory,
} from '@/services/calculatorConfigService';
import { normalizeConfigValues, validateConfigValues } from '@/lib/parseBRNumber';

// ============================================================================
// TYPES
// ============================================================================

// Pending operation for batch processing
interface PendingOperation {
  type: 'create' | 'update' | 'delete';
  item: CalculatorConfigItem | Omit<CalculatorConfigItem, 'id'>;
  originalId?: number;
}

// ============================================================================
// HELPER: Transform CalculatorConfig to flat API items
// ============================================================================

function configToFlatItems(
  config: CalculatorConfig,
  existingItems: CalculatorConfigItem[]
): PendingOperation[] {
  const operations: PendingOperation[] = [];
  const processedIds = new Set<number>();

  // Helper to find existing item by label and category
  const findExisting = (category: string, label: string): CalculatorConfigItem | undefined => {
    return findConfigByLabelInCategory(existingItems, category, label);
  };

  // Helper to create or update item
  const addOperation = (
    category: string,
    label: string,
    value: number,
    meta: Partial<ConfigMeta>
  ) => {
    const fullMeta: ConfigMeta = {
      category,
      ...meta,
    };

    const existing = findExisting(category, label);
    if (existing) {
      processedIds.add(existing.id);
      // Only update if value changed
      if (existing.value !== value) {
        operations.push({
          type: 'update',
          item: { ...existing, value, meta: { ...existing.meta, ...fullMeta } },
          originalId: existing.id,
        });
      }
    } else {
      operations.push({
        type: 'create',
        item: { label, value, meta: fullMeta } as any,
      });
    }
  };

  // 1. VM Prices
  addOperation(CONFIG_CATEGORIES.VM, 'vCPU', config.vm_prices_brl.vcpu, { section: 'Preços de VM', by: 'unit', type: 'BRL' });
  addOperation(CONFIG_CATEGORIES.VM, 'RAM', config.vm_prices_brl.ram_per_gb, { section: 'Preços de VM', by: 'GB', type: 'BRL' });
  addOperation(CONFIG_CATEGORIES.VM, 'NVMe', config.vm_prices_brl.nvme_per_gb, { section: 'Preços de VM', by: 'GB', type: 'BRL' });
  addOperation(CONFIG_CATEGORIES.VM, 'IP Público', config.vm_prices_brl.ip_public, { section: 'Preços de VM', by: 'unit', type: 'BRL' });

  // 2. GPU Prices
  for (const [gpuName, price] of Object.entries(config.gpu_usd || {})) {
    addOperation(CONFIG_CATEGORIES.GPU, gpuName, price, { section: 'Preços de GPU', type: 'BRL' });
  }

  // 3. BareMetal CPU Models
  for (const cpu of config.baremetal?.cpu_models || []) {
    addOperation(CONFIG_CATEGORIES.BAREMETAL, cpu.label, cpu.price, { section: 'Modelos de CPU', type: 'BRL' });
  }

  // 4. BareMetal RAM Tiers
  for (const ram of config.baremetal?.ram_tiers || []) {
    addOperation(CONFIG_CATEGORIES.BAREMETAL, ram.label, ram.price, { section: 'Opções de RAM', type: 'BRL' });
  }

  // 5. BareMetal Disks
  for (const disk of config.baremetal?.disks || []) {
    addOperation(CONFIG_CATEGORIES.BAREMETAL, disk.label, disk.price, { section: 'Opções de Disco', by: 'unit', type: 'BRL' });
  }

  // 6. Add-ons
  const addons = config.addons_brl;
  if (typeof addons.antivirus_unit === 'number') {
    addOperation(CONFIG_CATEGORIES.ADDONS, 'Antivirus', addons.antivirus_unit, { section: 'Add-ons', by: 'unit', type: 'BRL' });
  }
  if (typeof addons.firewall_pfsense === 'number') {
    addOperation(CONFIG_CATEGORIES.ADDONS, 'Firewall pfSense', addons.firewall_pfsense, { section: 'Add-ons', by: 'unit', type: 'BRL' });
  }
  if (typeof addons.tsplus_unit === 'number') {
    addOperation(CONFIG_CATEGORIES.ADDONS, 'TSplus', addons.tsplus_unit, { section: 'Add-ons', by: 'unit', type: 'BRL' });
  }
  if (typeof addons.cal_unit === 'number') {
    addOperation(CONFIG_CATEGORIES.ADDONS, 'CAL', addons.cal_unit, { section: 'Add-ons', by: 'unit', type: 'BRL' });
  }
  if (typeof addons.veeam_vm_unit === 'number') {
    addOperation(CONFIG_CATEGORIES.ADDONS, 'Veeam VM', addons.veeam_vm_unit, { section: 'Add-ons', by: 'unit', type: 'BRL' });
  }
  if (typeof addons.veeam_agent_unit === 'number') {
    addOperation(CONFIG_CATEGORIES.ADDONS, 'Veeam Agent', addons.veeam_agent_unit, { section: 'Add-ons', by: 'unit', type: 'BRL' });
  }
  if (typeof addons.winserver_2vcpu_unit === 'number') {
    addOperation(CONFIG_CATEGORIES.ADDONS, 'WinServer(2vCPU/unid.)', addons.winserver_2vcpu_unit, { section: 'Add-ons', by: 'unit', type: 'BRL' });
  }

  // 7. SQL Server
  if (addons.sql && typeof addons.sql === 'object') {
    for (const [edition, price] of Object.entries(addons.sql)) {
      let label = edition;
      if (edition === 'none') label = 'Nenhum';
      else if (edition === 'web') label = 'WEB';
      else if (edition === 'std') label = 'STD';
      else label = edition.toUpperCase();
      
      addOperation(CONFIG_CATEGORIES.SQL_SERVER, label, price, { section: 'SQL Server', type: 'BRL' });
    }
  }

  // 8. Geral - Descontos
  for (const [months, rate] of Object.entries(config.discount || {})) {
    const discountValue = Number((rate as number) * 100) || 0;
    const label = months === '1' ? '1 mês' : `${months} meses`;
    addOperation(CONFIG_CATEGORIES.GERAL, label, discountValue, { section: 'Descontos por Vigência', type: 'percentage' });
  }

  // 9. Storage SAS (Brasil)
  if (config.storage_pricing?.sas?.br) {
    const br = config.storage_pricing.sas.br;
    addOperation(CONFIG_CATEGORIES.STORAGE, '1-10 TB Brasil', br.pricePerTB_1_10, { section: 'Storage SAS', by: 'TB', type: 'BRL', region: 'Brasil' });
    addOperation(CONFIG_CATEGORIES.STORAGE, '11-100 TB Brasil', br.pricePerTB_11_100, { section: 'Storage SAS', by: 'TB', type: 'BRL', region: 'Brasil' });
    addOperation(CONFIG_CATEGORIES.STORAGE, '101-500 TB Brasil', br.pricePerTB_101_500, { section: 'Storage SAS', by: 'TB', type: 'BRL', region: 'Brasil' });
    addOperation(CONFIG_CATEGORIES.STORAGE, '501-1024 TB Brasil', br.pricePerTB_501_1024, { section: 'Storage SAS', by: 'TB', type: 'BRL', region: 'Brasil' });
    addOperation(CONFIG_CATEGORIES.STORAGE, '>1024 TB Brasil', br.pricePerTB_gt_1024, { section: 'Storage SAS', by: 'TB', type: 'BRL', region: 'Brasil' });
  }

  // 10. Storage SAS (Estados Unidos)
  if (config.storage_pricing?.sas?.usa) {
    const usa = config.storage_pricing.sas.usa;
    addOperation(CONFIG_CATEGORIES.STORAGE, '1-10 TB Estados Unidos', usa.pricePerTB_1_10, { section: 'Storage SAS', by: 'TB', type: 'BRL', region: 'Estados Unidos' });
    addOperation(CONFIG_CATEGORIES.STORAGE, '11-100 TB Estados Unidos', usa.pricePerTB_11_100, { section: 'Storage SAS', by: 'TB', type: 'BRL', region: 'Estados Unidos' });
    addOperation(CONFIG_CATEGORIES.STORAGE, '101-500 TB Estados Unidos', usa.pricePerTB_101_500, { section: 'Storage SAS', by: 'TB', type: 'BRL', region: 'Estados Unidos' });
    addOperation(CONFIG_CATEGORIES.STORAGE, '501-1024 TB Estados Unidos', usa.pricePerTB_501_1024, { section: 'Storage SAS', by: 'TB', type: 'BRL', region: 'Estados Unidos' });
    addOperation(CONFIG_CATEGORIES.STORAGE, '>1024 TB Estados Unidos', usa.pricePerTB_gt_1024, { section: 'Storage SAS', by: 'TB', type: 'BRL', region: 'Estados Unidos' });
  }

  // 11. Storage NVMe
  if (config.storage_pricing?.nvme) {
    addOperation(CONFIG_CATEGORIES.STORAGE, 'Preço por GB', config.storage_pricing.nvme.pricePerGB, { section: 'SSD NVMe', by: 'GB', type: 'BRL' });
  }

  // 12. Kubernetes Plans
  if (config.kubernetes_pricing) {
    for (const [plan, data] of Object.entries(config.kubernetes_pricing)) {
      const planData = data as any;
      addOperation(CONFIG_CATEGORIES.KUBERNETES, plan, planData?.basePriceMonthly || 0, { section: 'Preços Base dos Planos', by: 'month', type: 'BRL' });
    }
  }

  // 13. Kubernetes Add-ons
  if (config.kubernetes_addons_pricing) {
    for (const [addon, price] of Object.entries(config.kubernetes_addons_pricing)) {
      let by = 'month';
      if (addon.toLowerCase().includes('horas') || addon.toLowerCase().includes('devops')) {
        by = 'hour';
      }
      addOperation(CONFIG_CATEGORIES.KUBERNETES, addon, price, { section: 'Add-ons Kubernetes', by, type: 'BRL' });
    }
  }

  // 14. Backup pricing
  if (config.backup_tables_brl_per_gb) {
    for (const [retention, ranges] of Object.entries(config.backup_tables_brl_per_gb)) {
      for (const range of ranges) {
        const maxLabel = range.max >= 999999 ? 'plus' : String(range.max);
        const label = `${retention}_dias_${range.min}_${maxLabel}`;
        addOperation(CONFIG_CATEGORIES.BACKUP, label, range.price, { 
          section: 'Backup por Retenção', 
          by: 'GB', 
          type: 'BRL',
          retention: `${retention} dias`,
          min: range.min,
          max: range.max,
        });
      }
    }
  }

  // 15. Serviços Especializados
  if (typeof addons.support_basic === 'number') {
    addOperation(CONFIG_CATEGORIES.ADDONS, 'support_basic', addons.support_basic, { section: 'Serviços Especializados', by: 'month', type: 'BRL' });
  }
  if (typeof addons.support_intermediate === 'number') {
    addOperation(CONFIG_CATEGORIES.ADDONS, 'support_intermediate', addons.support_intermediate, { section: 'Serviços Especializados', by: 'month', type: 'BRL' });
  }
  if (typeof addons.support_advanced === 'number') {
    addOperation(CONFIG_CATEGORIES.ADDONS, 'support_advanced', addons.support_advanced, { section: 'Serviços Especializados', by: 'month', type: 'BRL' });
  }
  if (typeof addons.consulting_hours === 'number') {
    addOperation(CONFIG_CATEGORIES.ADDONS, 'consulting_hours', addons.consulting_hours, { section: 'Serviços Especializados', by: 'hour', type: 'BRL' });
  }
  if (typeof addons.dba_hours === 'number') {
    addOperation(CONFIG_CATEGORIES.ADDONS, 'dba_hours', addons.dba_hours, { section: 'Serviços Especializados', by: 'hour', type: 'BRL' });
  }

  return operations;
}

// ============================================================================
// HOOK: useConfigPersistence
// ============================================================================

export function useConfigPersistence() {
  const queryClient = useQueryClient();
  const { config: apiConfig, isLoading: isApiLoading, refetch } = useConfigWithFallback();
  
  // Local state
  const [localConfig, setLocalConfig] = useState<CalculatorConfig | null>(null);
  const [flatItems, setFlatItems] = useState<CalculatorConfigItem[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Track if we've initialized from API data
  const hasInitializedRef = useRef(false);

  // Initialize local config from API
  useEffect(() => {
    if (apiConfig) {
      if (!isDirty) {
        console.log('[ConfigPersistence] Syncing local config from API');
        setLocalConfig(apiConfig);
        hasInitializedRef.current = true;
      } else if (!hasInitializedRef.current) {
        console.log('[ConfigPersistence] Initial sync from API');
        setLocalConfig(apiConfig);
        hasInitializedRef.current = true;
      }
    }
  }, [apiConfig, isDirty]);

  // Fetch flat API items
  const fetchFlatItems = useCallback(async () => {
    try {
      const items = await getCalculatorConfigs();
      setFlatItems(items);
      console.log('[ConfigPersistence] Fetched', items.length, 'flat config items');
    } catch (err) {
      console.warn('[ConfigPersistence] Failed to fetch flat items:', err);
    }
  }, []);

  // Initial fetch of flat items
  useEffect(() => {
    fetchFlatItems();
  }, [fetchFlatItems]);

  // The config to display/edit
  const config = localConfig || apiConfig;

  // Update local config (marks as dirty)
  const updateConfig = useCallback((updater: (prev: CalculatorConfig) => CalculatorConfig) => {
    setLocalConfig(prev => {
      const newConfig = updater(prev || config);
      setIsDirty(true);
      return newConfig;
    });
  }, [config]);

  // Save to API using new flat CRUD
  const saveToApi = useCallback(async (options: { allowEmptyGpuSave?: boolean } = {}): Promise<boolean> => {
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
      // Refresh flat items before calculating operations
      await fetchFlatItems();
      
      // Get pending operations
      const operations = configToFlatItems(localConfig, flatItems);
      
      if (operations.length === 0) {
        toast({
          title: 'Nenhuma alteração',
          description: 'Não há mudanças para salvar.',
        });
        setIsSaving(false);
        return true;
      }

      console.log('[ConfigPersistence] Executing', operations.length, 'operations');

      let savedCount = 0;
      let createdCount = 0;

      // Execute operations
      for (const op of operations) {
        try {
          if (op.type === 'create') {
            const payload = {
              label: (op.item as any).label,
              value: (op.item as any).value,
              meta: (op.item as any).meta,
            };
            await createCalculatorConfig(payload);
            createdCount++;
          } else if (op.type === 'update' && op.originalId) {
            await updateCalculatorConfig(op.originalId, {
              value: (op.item as CalculatorConfigItem).value,
              meta: (op.item as CalculatorConfigItem).meta,
            });
            savedCount++;
          } else if (op.type === 'delete' && op.originalId) {
            await deleteCalculatorConfig(op.originalId);
          }
        } catch (err: any) {
          console.error('[ConfigPersistence] Operation failed:', op, err);
          throw err;
        }
      }

      // Refresh data from API
      await fetchFlatItems();
      await queryClient.invalidateQueries({ queryKey: CONFIG_QUERY_KEY });
      const result = await refetch();

      if (result.data) {
        setLocalConfig(result.data);
      }

      setIsDirty(false);

      toast({
        title: 'Preços salvos com sucesso',
        description: `${savedCount} atualização(ões), ${createdCount} criação(ões).`,
      });

      return true;
    } catch (err: any) {
      console.error('[ConfigPersistence] Save failed:', err);

      const errorMessage = err?.response?.data?.message || err?.message || 'Erro ao salvar';
      setError(errorMessage);

      if (err?.response?.status === 401) {
        toast({
          title: 'Sessão expirada',
          description: 'Faça login novamente.',
          variant: 'destructive',
        });
        return false;
      }

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
        description: errorMessage,
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [localConfig, flatItems, fetchFlatItems, queryClient, refetch]);

  // Reset to API values
  const resetToApi = useCallback(async () => {
    try {
      await queryClient.invalidateQueries({ queryKey: CONFIG_QUERY_KEY });
      const result = await refetch();
      
      if (result.data) {
        setLocalConfig(result.data);
      }
      
      setIsDirty(false);
      setError(null);
      
      await fetchFlatItems();
      
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
  }, [queryClient, refetch, fetchFlatItems]);

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
      
      setIsDirty(false);
      await fetchFlatItems();
      
      toast({
        title: 'Atualizado',
        description: 'Configurações carregadas da API.',
      });
    } catch (err) {
      console.error('[ConfigPersistence] Refresh failed:', err);
    }
  }, [isDirty, queryClient, refetch, fetchFlatItems]);

  // Direct CRUD operations for flat items
  const createConfigItem = useCallback(async (
    label: string,
    value: number,
    meta: ConfigMeta
  ): Promise<CalculatorConfigItem | null> => {
    try {
      const item = await createCalculatorConfig({ label, value, meta });
      await fetchFlatItems();
      await queryClient.invalidateQueries({ queryKey: CONFIG_QUERY_KEY });
      await refetch();
      return item;
    } catch (err) {
      console.error('[ConfigPersistence] Create failed:', err);
      return null;
    }
  }, [fetchFlatItems, queryClient, refetch]);

  const updateConfigItem = useCallback(async (
    id: number,
    updates: { label?: string; value?: number; meta?: ConfigMeta }
  ): Promise<CalculatorConfigItem | null> => {
    try {
      const item = await updateCalculatorConfig(id, updates);
      await fetchFlatItems();
      await queryClient.invalidateQueries({ queryKey: CONFIG_QUERY_KEY });
      await refetch();
      return item;
    } catch (err) {
      console.error('[ConfigPersistence] Update failed:', err);
      return null;
    }
  }, [fetchFlatItems, queryClient, refetch]);

  const deleteConfigItem = useCallback(async (id: number): Promise<boolean> => {
    try {
      await deleteCalculatorConfig(id);
      await fetchFlatItems();
      await queryClient.invalidateQueries({ queryKey: CONFIG_QUERY_KEY });
      await refetch();
      return true;
    } catch (err) {
      console.error('[ConfigPersistence] Delete failed:', err);
      return false;
    }
  }, [fetchFlatItems, queryClient, refetch]);

  return {
    config,
    flatItems,
    isLoading: isApiLoading || !config,
    isSaving,
    isDirty,
    error,
    updateConfig,
    saveToApi,
    resetToApi,
    refreshFromApi,
    // Direct flat item CRUD
    createConfigItem,
    updateConfigItem,
    deleteConfigItem,
    // Utility
    refetchFlatItems: fetchFlatItems,
  };
}
