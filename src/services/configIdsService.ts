/**
 * Config IDs Service - Nova estrutura FLAT (Janeiro 2026)
 * 
 * BREAKING CHANGE: A estrutura de calculator_configs agora é PLANA
 * - Cada linha = um único item de preço
 * - Referência direta pelo ID (config_id)
 * - Sem hierarquia: cada item é independente
 * 
 * Servidores usam specs[]:
 *   { config_id: 1, value: 16 }  // 16 vCPUs do config ID 1
 * 
 * Addons usam config_id + quantity:
 *   { config_id: 28, quantity: 2 }  // 2x do config ID 28
 */

import { getCalculatorConfigs, CalculatorConfigItem } from './calculatorConfigService';

// ============================================================================
// TYPES
// ============================================================================

export interface ConfigIdMapping {
  configId: number;       // ID direto do item na tabela
  label: string;
  value: number;
  category: string;
  section?: string;
  by?: string;
  type?: string;
}

export interface ConfigIdStore {
  // All configs indexed by ID for quick lookup
  byId: Map<number, ConfigIdMapping>;
  
  // Configs grouped by category for UI display
  byCategory: Map<string, ConfigIdMapping[]>;
  
  // Quick lookup by normalized label within category
  byLabelInCategory: Map<string, Map<string, ConfigIdMapping>>;
  
  // Raw items from API
  items: CalculatorConfigItem[];
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Normalize a label for matching (lowercase, remove accents, trim)
 */
function normalizeLabel(label: string): string {
  return label
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_')
    .trim();
}

// ============================================================================
// MAIN FUNCTIONS
// ============================================================================

/**
 * Load config ID mappings from API - NO CACHE
 * Always fetches fresh data from the API.
 */
export async function loadConfigIds(): Promise<ConfigIdStore> {
  console.log('[configIdsService] Loading config IDs from API (flat structure)...');
  
  const store: ConfigIdStore = {
    byId: new Map(),
    byCategory: new Map(),
    byLabelInCategory: new Map(),
    items: [],
  };
  
  try {
    const items = await getCalculatorConfigs();
    console.log('[configIdsService] Loaded', items.length, 'config items from API');
    
    store.items = items;
    
    for (const item of items) {
      const mapping: ConfigIdMapping = {
        configId: item.id,
        label: item.label,
        value: item.value,
        category: item.meta.category || 'Unknown',
        section: item.meta.section,
        by: item.meta.by,
        type: item.meta.type,
      };
      
      // Index by ID
      store.byId.set(item.id, mapping);
      
      // Group by category
      const category = mapping.category;
      if (!store.byCategory.has(category)) {
        store.byCategory.set(category, []);
      }
      store.byCategory.get(category)!.push(mapping);
      
      // Index by label within category for quick lookup
      if (!store.byLabelInCategory.has(category)) {
        store.byLabelInCategory.set(category, new Map());
      }
      const categoryMap = store.byLabelInCategory.get(category)!;
      
      // Store with normalized label
      categoryMap.set(normalizeLabel(item.label), mapping);
      // Also store with original label
      categoryMap.set(item.label, mapping);
    }
    
    // Log category summary
    const categorySummary: Record<string, number> = {};
    store.byCategory.forEach((items, category) => {
      categorySummary[category] = items.length;
    });
    console.log('[configIdsService] Config items by category:', categorySummary);
    
  } catch (error) {
    console.error('[configIdsService] Failed to load config IDs from API:', error);
    throw error;
  }
  
  return store;
}

/**
 * Get config by ID
 */
export function getConfigById(
  store: ConfigIdStore,
  id: number
): ConfigIdMapping | undefined {
  return store.byId.get(id);
}

/**
 * Get all configs for a category
 */
export function getConfigsByCategory(
  store: ConfigIdStore,
  category: string
): ConfigIdMapping[] {
  return store.byCategory.get(category) || [];
}

/**
 * Find config by label in a category (with fuzzy matching)
 */
export function findConfigByLabel(
  store: ConfigIdStore,
  category: string,
  label: string
): ConfigIdMapping | undefined {
  const categoryMap = store.byLabelInCategory.get(category);
  if (!categoryMap) return undefined;
  
  // Try exact match first
  if (categoryMap.has(label)) return categoryMap.get(label);
  
  // Try normalized match
  const normalized = normalizeLabel(label);
  if (categoryMap.has(normalized)) return categoryMap.get(normalized);
  
  // Try partial match
  for (const [key, mapping] of categoryMap) {
    if (normalizeLabel(key) === normalized) return mapping;
  }
  
  return undefined;
}

/**
 * Find config by multiple possible labels (first match wins)
 */
export function findConfigByLabels(
  store: ConfigIdStore,
  category: string,
  ...labels: string[]
): ConfigIdMapping | undefined {
  for (const label of labels) {
    const found = findConfigByLabel(store, category, label);
    if (found) return found;
  }
  return undefined;
}

// ============================================================================
// SPECIALIZED LOOKUP FUNCTIONS (for backward compatibility)
// ============================================================================

/**
 * Get VM component config IDs
 */
export function getVmConfigIds(store: ConfigIdStore): {
  vcpu?: ConfigIdMapping;
  ram?: ConfigIdMapping;
  storage?: ConfigIdMapping;
  ip?: ConfigIdMapping;
} {
  return {
    vcpu: findConfigByLabels(store, 'VM', 'vCPU', 'vcpu', 'CPU'),
    ram: findConfigByLabels(store, 'VM', 'RAM', 'ram', 'Memória'),
    storage: findConfigByLabels(store, 'VM', 'NVMe', 'nvme', 'Storage', 'Disco', 'SSD'),
    ip: findConfigByLabels(store, 'VM', 'IP Público', 'IP', 'ip'),
  };
}

/**
 * Get addon config by code
 */
export function getAddonConfig(
  store: ConfigIdStore,
  code: string
): ConfigIdMapping | undefined {
  const codeToLabels: Record<string, string[]> = {
    'antivirus': ['Antivírus', 'Antivirus'],
    'firewall': ['Firewall pfSense', 'Firewall', 'Firewall (qtd)'],
    'tsplus': ['TSplus', 'TS Plus'],
    'cal': ['CAL', 'CAL / TS-CAL'],
    'veeam_vm': ['Veeam VM', 'Veeam Backup (VM)'],
    'veeam_agent': ['Veeam Agent', 'Veeam Agent (Workstation)'],
    'winserver': ['WinServer(2vCPU/unid.)', 'Windows Server', 'WinServer 2vCPU'],
    'support_basic': ['Suporte Básico'],
    'support_intermediate': ['Suporte Intermediário'],
    'support_advanced': ['Suporte Avançado'],
    'consulting': ['Consultoria Técnica', 'Consultoria'],
    'dba': ['DBA'],
  };
  
  const labels = codeToLabels[code] || [code];
  return findConfigByLabels(store, 'Add-ons', ...labels);
}

/**
 * Get SQL config by edition
 */
export function getSqlConfig(
  store: ConfigIdStore,
  edition: string
): ConfigIdMapping | undefined {
  const editionUpper = edition.toUpperCase();
  const labels = [
    edition,
    `${editionUpper} (2vCPU)`,
    `${editionUpper} (8vCPU)`,
    `SQL ${editionUpper}`,
    `WEB (2vCPU)`,
    `STD (8vCPU)`,
  ];
  return findConfigByLabels(store, 'SQL Server', ...labels);
}

/**
 * Get backup config by retention plan
 */
export function getBackupConfig(
  store: ConfigIdStore,
  plan: string
): ConfigIdMapping | undefined {
  const labels = [
    `${plan} dias`,
    `backup_${plan}`,
    plan,
    `Backup ${plan} dias`,
    `${plan}d`,
  ];
  return findConfigByLabels(store, 'Backup', ...labels);
}

/**
 * Get GPU config by model
 */
export function getGpuConfig(
  store: ConfigIdStore,
  model: string
): ConfigIdMapping | undefined {
  return findConfigByLabel(store, 'GPU', model);
}

/**
 * Get BareMetal CPU config
 */
export function getBaremetalCpuConfig(
  store: ConfigIdStore,
  cpuModel: string
): ConfigIdMapping | undefined {
  return findConfigByLabel(store, 'BareMetal', cpuModel);
}

/**
 * Get BareMetal RAM config
 */
export function getBaremetalRamConfig(
  store: ConfigIdStore,
  ramTier: string
): ConfigIdMapping | undefined {
  return findConfigByLabel(store, 'BareMetal', ramTier);
}

/**
 * Get BareMetal Disk config
 */
export function getBaremetalDiskConfig(
  store: ConfigIdStore,
  diskType: string
): ConfigIdMapping | undefined {
  return findConfigByLabel(store, 'BareMetal', diskType);
}

/**
 * Get Kubernetes plan config
 */
export function getKubernetesPlanConfig(
  store: ConfigIdStore,
  plan: string
): ConfigIdMapping | undefined {
  return findConfigByLabel(store, 'Kubernetes', plan);
}

/**
 * Get Storage config by type
 */
export function getStorageConfig(
  store: ConfigIdStore,
  storageType: string
): ConfigIdMapping | undefined {
  return findConfigByLabel(store, 'Storage', storageType);
}

// ============================================================================
// LEGACY COMPATIBILITY - Will be removed in future versions
// ============================================================================

/**
 * @deprecated Use findConfigByLabel instead
 */
export function getItemId(
  mapping: ConfigIdMapping | null | undefined,
  _label: string
): number | undefined {
  return mapping?.configId;
}

/**
 * @deprecated Use getVmConfigIds instead
 */
export function getVmItemIds(store: ConfigIdStore): {
  configId: number | undefined;
  vcpuItemId: number | undefined;
  ramItemId: number | undefined;
  storageItemId: number | undefined;
  ipItemId: number | undefined;
} {
  const vmConfigs = getVmConfigIds(store);
  return {
    configId: vmConfigs.vcpu?.configId,  // Use vCPU as "config" for legacy compatibility
    vcpuItemId: vmConfigs.vcpu?.configId,
    ramItemId: vmConfigs.ram?.configId,
    storageItemId: vmConfigs.storage?.configId,
    ipItemId: vmConfigs.ip?.configId,
  };
}

/**
 * @deprecated Use getAddonConfig instead
 */
export function getAddonItemId(
  store: ConfigIdStore,
  code: string
): { configId: number | undefined; itemId: number | undefined } {
  const config = getAddonConfig(store, code);
  return {
    configId: config?.configId,
    itemId: config?.configId,  // In flat structure, configId IS the itemId
  };
}

/**
 * @deprecated Use getBackupConfig instead
 */
export function getBackupItemId(
  store: ConfigIdStore,
  plan: string
): { configId: number | undefined; itemId: number | undefined } {
  const config = getBackupConfig(store, plan);
  return {
    configId: config?.configId,
    itemId: config?.configId,
  };
}

/**
 * @deprecated Use getSqlConfig instead
 */
export function getSqlItemId(
  store: ConfigIdStore,
  edition: string
): { configId: number | undefined; itemId: number | undefined } {
  const config = getSqlConfig(store, edition);
  return {
    configId: config?.configId,
    itemId: config?.configId,
  };
}

/**
 * @deprecated Use getGpuConfig instead
 */
export function getGpuItemId(
  store: ConfigIdStore,
  model: string
): { configId: number | undefined; itemId: number | undefined } {
  const config = getGpuConfig(store, model);
  return {
    configId: config?.configId,
    itemId: config?.configId,
  };
}

/**
 * @deprecated Use getKubernetesPlanConfig instead
 */
export function getKubernetesPlanItemId(
  store: ConfigIdStore,
  plan: string
): { configId: number | undefined; itemId: number | undefined } {
  const config = getKubernetesPlanConfig(store, plan);
  return {
    configId: config?.configId,
    itemId: config?.configId,
  };
}

/**
 * @deprecated Use getStorageConfig instead
 */
export function getStorageItemId(
  store: ConfigIdStore,
  storageType: string
): { configId: number | undefined; itemId: number | undefined } {
  const config = getStorageConfig(store, storageType);
  return {
    configId: config?.configId,
    itemId: config?.configId,
  };
}
