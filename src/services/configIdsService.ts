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
      const category = item.meta?.category || 'Unknown';
      const section = item.meta?.section;
      const by = item.meta?.by;
      const type = item.meta?.type;
      
      const mapping: ConfigIdMapping = {
        configId: item.id,
        label: item.label,
        value: item.value,
        category,
        section,
        by,
        type,
      };
      
      // Index by ID
      store.byId.set(item.id, mapping);
      
      // Group by category
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
  
  // Try partial match - check if API label contains search OR vice versa
  for (const [key, mapping] of categoryMap) {
    const keyNormalized = normalizeLabel(key);
    
    // Exact normalized match
    if (keyNormalized === normalized) return mapping;
    
    // Partial match (bidirectional)
    if (keyNormalized.includes(normalized) || normalized.includes(keyNormalized)) {
      return mapping;
    }
  }
  
  return undefined;
}

/**
 * Find config by multiple possible labels (first match wins)
 * Also tries a global fallback across all categories if not found in specified category
 */
export function findConfigByLabels(
  store: ConfigIdStore,
  category: string,
  ...labels: string[]
): ConfigIdMapping | undefined {
  // First try in the specified category
  for (const label of labels) {
    const found = findConfigByLabel(store, category, label);
    if (found) return found;
  }
  
  // Fallback: search ALL categories for any matching label
  for (const label of labels) {
    const normalized = normalizeLabel(label);
    for (const [cat, configs] of store.byCategory) {
      for (const config of configs) {
        const configNormalized = normalizeLabel(config.label);
        if (configNormalized === normalized || 
            configNormalized.includes(normalized) || 
            normalized.includes(configNormalized)) {
          return config;
        }
      }
    }
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
 * NOTE: Some addons are in 'Serviços Especializados' category/section (Support, Consulting, DBA)
 */
export function getAddonConfig(
  store: ConfigIdStore,
  code: string
): ConfigIdMapping | undefined {
  // Comprehensive mapping of code → possible labels in API
  // CRITICAL: These labels must match EXACTLY what the API returns
  const codeToLabels: Record<string, string[]> = {
    // Standard Add-ons
    'antivirus': ['Antivírus', 'Antivirus', 'Antivírus (unid.)', 'Antivirus (unid.)'],
    'firewall': ['Firewall pfSense', 'Firewall', 'Firewall (qtd)', 'pfSense'],
    'tsplus': ['TSplus', 'TS Plus', 'TSPlus', 'TSplus (unid.)'],
    'cal': ['CAL', 'CAL / TS-CAL', 'TS-CAL', 'CAL (unid.)'],
    'veeam_vm': ['Veeam VM', 'Veeam Backup (VM)', 'Veeam (VM)', 'Veeam VM (unid.)'],
    'veeam_agent': ['Veeam Agent', 'Veeam Agent (Workstation)', 'Veeam (Agent)', 'Veeam Agent (unid.)'],
    // Windows Server - multiple possible labels
    'winserver': ['WinServer(2vCPU/unid.)', 'WinServer 2vCPU/unid.', 'Windows Server', 'WinServer', 'WinServer (2vCPU)', 'Win Server'],
    'winserver_2vcpu_unit': ['WinServer(2vCPU/unid.)', 'WinServer 2vCPU/unid.', 'Windows Server', 'WinServer', 'WinServer (2vCPU)'],
    // Serviços Especializados - Support
    'support_basic': ['Suporte Básico', 'Suporte Basico', 'Suporte (Básico)', 'Suporte (Basico)', 'Support Basic'],
    'support_intermediate': ['Suporte Intermediário', 'Suporte Intermediario', 'Suporte (Intermediário)', 'Suporte (Intermediario)', 'Support Intermediate'],
    'support_advanced': ['Suporte Avançado', 'Suporte Avancado', 'Suporte (Avançado)', 'Suporte (Avancado)', 'Support Advanced'],
    // Serviços Especializados - Consulting & DBA
    'consulting': ['Consultoria Técnica (horas)', 'Consultoria Técnica', 'Consultoria Tecnica (horas)', 'Consultoria Tecnica', 'Consultoria', 'Horas de Consultoria', 'Consulting'],
    'consulting_hours': ['Consultoria Técnica (horas)', 'Consultoria Técnica', 'Consultoria Tecnica (horas)', 'Consultoria Tecnica', 'Consultoria', 'Horas de Consultoria'],
    'dba': ['DBA (horas)', 'DBA', 'Horas de DBA', 'DBA Remoto', 'DBA as a Service'],
    'dba_hours': ['DBA (horas)', 'DBA', 'Horas de DBA', 'DBA Remoto'],
    // Independent products
    'storage': ['Storage', 'Storage SAS', 'Storage NVMe', 'Bucket S3'],
    'kubernetes': ['Kubernetes', 'K8s', 'Container'],
    'open_saas': ['OPEN SaaS', 'Open SaaS', 'SaaS', 'OpenSaaS'],
  };
  
  // Items that should be searched in Serviços Especializados first
  const servicosEspecializadosCodes = ['support_basic', 'support_intermediate', 'support_advanced', 'consulting', 'consulting_hours', 'dba', 'dba_hours'];
  
  const labels = codeToLabels[code] || [code];
  
  // Try Serviços Especializados first for specialized services
  if (servicosEspecializadosCodes.includes(code)) {
    // Try as category "Serviços Especializados"
    let result = findConfigByLabels(store, 'Serviços Especializados', ...labels);
    if (result) {
      console.log(`[configIdsService] Found ${code} in 'Serviços Especializados':`, result.configId, result.label);
      return result;
    }
    
    // Try in Add-ons category but with section "Serviços Especializados"
    // (some configs have category=Add-ons, section=Serviços Especializados)
    const allConfigs = getConfigsByCategory(store, 'Add-ons');
    for (const config of allConfigs) {
      if (config.section && config.section.toLowerCase().includes('especializado')) {
        const normalizedLabel = config.label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        for (const label of labels) {
          const normalizedSearch = label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          if (normalizedLabel === normalizedSearch || normalizedLabel.includes(normalizedSearch) || normalizedSearch.includes(normalizedLabel)) {
            console.log(`[configIdsService] Found ${code} in Add-ons/Serviços Especializados:`, config.configId, config.label);
            return config;
          }
        }
      }
    }
    
    // Also try Geral category
    result = findConfigByLabels(store, 'Geral', ...labels);
    if (result) {
      console.log(`[configIdsService] Found ${code} in 'Geral':`, result.configId, result.label);
      return result;
    }
  }
  
  // Try Add-ons category
  let result = findConfigByLabels(store, 'Add-ons', ...labels);
  if (result) {
    console.log(`[configIdsService] Found ${code} in 'Add-ons':`, result.configId, result.label);
    return result;
  }
  
  // Fallback: search ALL categories for the labels (global search)
  for (const [category, configs] of store.byCategory) {
    for (const config of configs) {
      const normalizedConfigLabel = config.label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      for (const label of labels) {
        const normalizedSearch = label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        if (normalizedConfigLabel === normalizedSearch || normalizedConfigLabel.includes(normalizedSearch) || normalizedSearch.includes(normalizedConfigLabel)) {
          console.log(`[configIdsService] Found ${code} via global search in '${category}':`, config.configId, config.label);
          return config;
        }
      }
    }
  }
  
  console.warn(`[configIdsService] Addon NOT FOUND: ${code}, searched labels:`, labels);
  return undefined;
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
 * Searches for labels matching the retention plan (7, 15, 30 days)
 * 
 * IMPORTANT: Backup labels in API may have various formats:
 * - "7 dias", "7_dias", "7d"
 * - "7_dias_1_100" (retention + volume range)
 * - "Backup 7 dias"
 */
export function getBackupConfig(
  store: ConfigIdStore,
  plan: string
): ConfigIdMapping | undefined {
  console.log(`[getBackupConfig] Searching for backup plan: "${plan}"`);
  
  // Comprehensive label search list for backup plans
  const labels = [
    // Exact matches
    `${plan} dias`, `${plan}d`, `${plan}_dias`, `${plan}`,
    // With backup prefix
    `Backup ${plan} dias`, `Backup ${plan}d`, `backup_${plan}`, `Backup ${plan}`,
    // Volume ranges (common API format)
    `${plan}_dias_1_100`, `${plan}_dias_101_500`, `${plan}_dias_501_1000`,
    `${plan}_dias_1001_2000`, `${plan}_dias_2001`,
    // Legacy formats
    `plano_${plan}`, `Plano ${plan} dias`, `retencao_${plan}`, `Retenção ${plan} dias`,
    `Retencao ${plan} dias`,
    // Additional formats seen in APIs
    `${plan}dias`, `backup${plan}`, `${plan}dias_1_100`, `retenção ${plan}`,
    `retencao${plan}dias`
  ];
  
  // Try Backup category first
  let result = findConfigByLabels(store, 'Backup', ...labels);
  if (result) {
    console.log(`[getBackupConfig] ✓ Found Backup ${plan} in 'Backup' category:`, result.configId, result.label);
    return result;
  }
  
  // Fallback: search in Add-ons
  result = findConfigByLabels(store, 'Add-ons', ...labels);
  if (result) {
    console.log(`[getBackupConfig] ✓ Found Backup ${plan} in 'Add-ons' category:`, result.configId, result.label);
    return result;
  }
  
  // Fallback: search globally for any item with the plan number in a Backup-related category/label
  for (const [category, configs] of store.byCategory) {
    const categoryLower = category.toLowerCase();
    if (categoryLower.includes('backup')) {
      for (const config of configs) {
        const labelLower = config.label.toLowerCase();
        if (labelLower.includes(plan)) {
          console.log(`[getBackupConfig] ✓ Found Backup ${plan} via broad search in '${category}':`, config.configId, config.label);
          return config;
        }
      }
    }
  }
  
  // More aggressive fallback: search ALL categories for labels containing the plan number
  // This catches cases where Backup might be in an unexpected category
  for (const [category, configs] of store.byCategory) {
    for (const config of configs) {
      const labelLower = config.label.toLowerCase();
      const sectionLower = (config.section || '').toLowerCase();
      
      // Check if this looks like a backup config
      const isBackupLike = labelLower.includes('dias') || 
                           labelLower.includes('backup') || 
                           labelLower.includes('retenc') ||
                           sectionLower.includes('backup') ||
                           sectionLower.includes('retenc');
      
      if (isBackupLike && labelLower.includes(plan)) {
        console.log(`[getBackupConfig] ✓ Found Backup ${plan} via GLOBAL search in '${category}':`, config.configId, config.label);
        return config;
      }
    }
  }
  
  // ULTIMATE fallback: If plan is "7", "15", or "30", search for any config with that exact number
  // AND contains "dias" or "d" after the number
  const planNum = parseInt(plan, 10);
  if ([7, 15, 30].includes(planNum)) {
    for (const [category, configs] of store.byCategory) {
      for (const config of configs) {
        const labelLower = config.label.toLowerCase();
        // Match patterns like "7 dias", "15dias", "30_dias", etc.
        const pattern = new RegExp(`\\b${plan}\\s*(dias?|d|_dias)`, 'i');
        if (pattern.test(config.label)) {
          console.log(`[getBackupConfig] ✓ Found Backup ${plan} via REGEX in '${category}':`, config.configId, config.label);
          return config;
        }
      }
    }
  }
  
  console.warn(`[getBackupConfig] ❌ Backup NOT FOUND: plan=${plan}`);
  console.warn(`[getBackupConfig] Searched labels:`, labels.slice(0, 10), '...');
  console.warn(`[getBackupConfig] Available categories:`, Array.from(store.byCategory.keys()));
  
  // Dump first 5 items from each backup-related category for debugging
  for (const [category, configs] of store.byCategory) {
    if (category.toLowerCase().includes('backup')) {
      console.warn(`[getBackupConfig] Items in '${category}':`, configs.slice(0, 5).map(c => ({ id: c.configId, label: c.label })));
    }
  }
  
  return undefined;
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
