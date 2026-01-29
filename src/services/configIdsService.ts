/**
 * Config IDs Service - NO CACHE, NO FALLBACKS
 * 
 * Fetches config and item IDs directly from the API every time.
 * Required since API v12+ where addons[] and servers[] require config_id + item_id.
 * 
 * CRITICAL: IDs must come from the API. There are NO hardcoded fallbacks.
 * If the API doesn't return the expected IDs, the proposal will fail to save.
 */

import { getCalculatorConfigs, CalculatorConfigEntry, ConfigItem } from './calculatorConfigService';

// ============================================================================
// TYPES
// ============================================================================

export interface ConfigIdMapping {
  configId: number;       // ID of the calculator config entry (category/section)
  category: string;
  section: string;
  items: Record<string, number>; // Map of item label (normalized) -> item_id
}

export interface ConfigIdStore {
  vm: ConfigIdMapping | null;
  gpu: ConfigIdMapping | null;
  addons: ConfigIdMapping | null;
  sqlServer: ConfigIdMapping | null;
  backup: ConfigIdMapping | null;
  storage: {
    sas: ConfigIdMapping | null;
    nvme: ConfigIdMapping | null;
  };
  kubernetes: {
    plans: ConfigIdMapping | null;
    addons: ConfigIdMapping | null;
  };
  baremetal: {
    cpu: ConfigIdMapping | null;
    ram: ConfigIdMapping | null;
    disk: ConfigIdMapping | null;
  };
  specializedServices: ConfigIdMapping | null;
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

/**
 * Build item ID map from config entry
 */
function buildItemMap(entry: CalculatorConfigEntry): ConfigIdMapping {
  const items: Record<string, number> = {};
  
  if (Array.isArray(entry.config)) {
    for (const item of entry.config) {
      if (item.id && item.label) {
        // Store with normalized label
        items[normalizeLabel(item.label)] = item.id;
        // Also store with original label for exact matches
        items[item.label] = item.id;
      }
    }
  }
  
  console.log(`[configIdsService] Built item map for ${entry.category}/${entry.section}:`, items);
  
  return {
    configId: entry.id,
    category: entry.category,
    section: entry.section,
    items,
  };
}

/**
 * Find config entry by category and section (case-insensitive)
 */
function findEntry(entries: CalculatorConfigEntry[], category: string, section: string): CalculatorConfigEntry | undefined {
  const catLower = category.toLowerCase().trim();
  const secLower = section.toLowerCase().trim();
  return entries.find(e => 
    e.category.toLowerCase().trim() === catLower && 
    e.section.toLowerCase().trim() === secLower
  );
}

// ============================================================================
// MAIN FUNCTIONS
// ============================================================================

/**
 * Load config ID mappings from API - NO CACHE
 * Always fetches fresh data from the API.
 * Returns null mappings if API doesn't return expected data.
 */
export async function loadConfigIds(): Promise<ConfigIdStore> {
  console.log('[configIdsService] Loading config IDs from API (no cache)...');
  
  // Initialize store with null values - NO FALLBACKS
  const store: ConfigIdStore = {
    vm: null,
    gpu: null,
    addons: null,
    sqlServer: null,
    backup: null,
    storage: {
      sas: null,
      nvme: null,
    },
    kubernetes: {
      plans: null,
      addons: null,
    },
    baremetal: {
      cpu: null,
      ram: null,
      disk: null,
    },
    specializedServices: null,
  };
  
  try {
    const entries = await getCalculatorConfigs();
    console.log('[configIdsService] Loaded', entries.length, 'config entries from API');
    
    // Debug: log all entries with their IDs
    entries.forEach(e => {
      const itemCount = Array.isArray(e.config) ? e.config.length : 0;
      const itemsWithIds = Array.isArray(e.config) ? e.config.filter((i: ConfigItem) => i.id).length : 0;
      console.log(`[configIdsService] Entry ID=${e.id}: ${e.category}/${e.section} (${itemsWithIds}/${itemCount} items with IDs)`);
      
      // Log each item with its ID for debugging
      if (Array.isArray(e.config)) {
        e.config.forEach((item: ConfigItem) => {
          if (item.id) {
            console.log(`  - [${item.id}] ${item.label}: ${item.value}`);
          }
        });
      }
    });
    
    // VM
    const vmEntry = findEntry(entries, 'VM', 'Preços de VM');
    if (vmEntry) {
      store.vm = buildItemMap(vmEntry);
      console.log('[configIdsService] VM config loaded: configId=', store.vm.configId, 'items=', Object.keys(store.vm.items).length);
    } else {
      console.error('[configIdsService] VM config NOT FOUND in API response!');
    }
    
    // GPU
    const gpuEntry = findEntry(entries, 'GPU', 'Preços de GPU');
    if (gpuEntry) {
      store.gpu = buildItemMap(gpuEntry);
    }
    
    // Add-ons
    const addonsEntry = findEntry(entries, 'Add-ons', 'Add-ons');
    if (addonsEntry) {
      store.addons = buildItemMap(addonsEntry);
      console.log('[configIdsService] Add-ons config loaded: configId=', store.addons.configId, 'items=', Object.keys(store.addons.items));
    }
    
    // SQL Server
    const sqlEntry = findEntry(entries, 'SQL Server', 'SQL Server');
    if (sqlEntry) {
      store.sqlServer = buildItemMap(sqlEntry);
    }
    
    // Backup - Try different section names
    const backupEntry = findEntry(entries, 'Backup', 'Tabela de Preços') 
      || findEntry(entries, 'Backup', 'Backup por Retenção');
    if (backupEntry) {
      store.backup = buildItemMap(backupEntry);
    }
    
    // Storage
    const sasEntry = findEntry(entries, 'Storage', 'Storage SAS');
    if (sasEntry) store.storage.sas = buildItemMap(sasEntry);
    
    const nvmeEntry = findEntry(entries, 'Storage', 'SSD NVMe');
    if (nvmeEntry) store.storage.nvme = buildItemMap(nvmeEntry);
    
    // Kubernetes
    const k8sPlansEntry = findEntry(entries, 'Kubernetes', 'Preços Base dos Planos');
    if (k8sPlansEntry) store.kubernetes.plans = buildItemMap(k8sPlansEntry);
    
    const k8sAddonsEntry = findEntry(entries, 'Kubernetes', 'Add-ons Kubernetes');
    if (k8sAddonsEntry) store.kubernetes.addons = buildItemMap(k8sAddonsEntry);
    
    // BareMetal
    const bmCpuEntry = findEntry(entries, 'BareMetal', 'Modelos de CPU');
    if (bmCpuEntry) store.baremetal.cpu = buildItemMap(bmCpuEntry);
    
    const bmRamEntry = findEntry(entries, 'BareMetal', 'Opções de RAM');
    if (bmRamEntry) store.baremetal.ram = buildItemMap(bmRamEntry);
    
    const bmDiskEntry = findEntry(entries, 'BareMetal', 'Opções de Disco');
    if (bmDiskEntry) store.baremetal.disk = buildItemMap(bmDiskEntry);
    
    // Specialized Services
    const specializedEntry = findEntry(entries, 'Add-ons', 'Serviços Especializados');
    if (specializedEntry) {
      store.specializedServices = buildItemMap(specializedEntry);
    } else {
      // Fallback: specialized services might be in the main Add-ons config
      store.specializedServices = store.addons;
    }
    
  } catch (error) {
    console.error('[configIdsService] Failed to load config IDs from API:', error);
    throw error; // Re-throw - don't silently fail with fallbacks
  }
  
  console.log('[configIdsService] Config IDs loaded:', {
    vmConfigId: store.vm?.configId,
    vmItemsCount: store.vm ? Object.keys(store.vm.items).length : 0,
    gpuConfigId: store.gpu?.configId,
    addonsConfigId: store.addons?.configId,
    addonItemsCount: store.addons ? Object.keys(store.addons.items).length : 0,
  });
  
  return store;
}

/**
 * Get item ID from a mapping by label (with fuzzy matching)
 */
export function getItemId(
  mapping: ConfigIdMapping | null,
  label: string
): number | undefined {
  if (!mapping) return undefined;
  
  // Try exact match first
  if (mapping.items[label] !== undefined) return mapping.items[label];
  
  // Try normalized match
  const normalized = normalizeLabel(label);
  if (mapping.items[normalized] !== undefined) return mapping.items[normalized];
  
  // Try partial match (for labels like "vCPU" matching "vcpu")
  for (const [key, id] of Object.entries(mapping.items)) {
    if (normalizeLabel(key) === normalized) return id;
  }
  
  return undefined;
}

/**
 * Get VM component IDs for server payload
 * Returns the config_id and item_ids for vCPU, RAM, and Storage
 * Returns undefined for missing IDs - NO FALLBACKS
 */
export function getVmItemIds(store: ConfigIdStore): {
  configId: number | undefined;
  vcpuItemId: number | undefined;
  ramItemId: number | undefined;
  storageItemId: number | undefined;
  ipItemId: number | undefined;
} {
  const vmMapping = store.vm;
  
  const result = {
    configId: vmMapping?.configId,
    vcpuItemId: getItemId(vmMapping, 'vCPU') ?? getItemId(vmMapping, 'vcpu'),
    ramItemId: getItemId(vmMapping, 'RAM') ?? getItemId(vmMapping, 'ram'),
    storageItemId: getItemId(vmMapping, 'NVMe') ?? getItemId(vmMapping, 'nvme') ?? getItemId(vmMapping, 'storage'),
    ipItemId: getItemId(vmMapping, 'IP Público') ?? getItemId(vmMapping, 'ip_publico') ?? getItemId(vmMapping, 'IP'),
  };
  
  console.log('[configIdsService] getVmItemIds:', result);
  return result;
}

/**
 * Get addon item ID by code
 * Maps common addon codes to their item IDs
 * Returns undefined for missing IDs - NO FALLBACKS
 */
export function getAddonItemId(
  store: ConfigIdStore,
  code: string
): { configId: number | undefined; itemId: number | undefined } {
  const addonsMapping = store.addons;
  const specializedMapping = store.specializedServices;
  
  // Code to label mapping - add variations for better matching
  const codeToLabel: Record<string, string[]> = {
    'antivirus': ['Antivírus', 'Antivirus', 'antivirus'],
    'firewall': ['Firewall pfSense', 'Firewall (qtd)', 'firewall', 'Firewall'],
    'tsplus': ['TSplus', 'TS Plus', 'tsplus', 'TS PLUS'],
    'cal': ['CAL', 'cal', 'CAL / TS-CAL'],
    'veeam_vm': ['Veeam VM', 'veeam_vm', 'Veeam Backup (VM)'],
    'veeam_agent': ['Veeam Agent', 'veeam_agent', 'Veeam Agent (Workstation)'],
    'winserver_2vcpu_unit': ['WinServer(2vCPU/unid.)', 'Windows Server', 'winserver', 'WinServer 2vCPU', 'winserver_2vcpu_unit'],
    'support_basic': ['Suporte Básico', 'support_basic', 'Suporte basic'],
    'support_intermediate': ['Suporte Intermediário', 'support_intermediate', 'Suporte intermediate'],
    'support_advanced': ['Suporte Avançado', 'support_advanced', 'Suporte advanced'],
    'consulting_hours': ['Consultoria Técnica', 'consulting_hours', 'Consultoria'],
    'dba_hours': ['DBA', 'dba_hours'],
    // Independent products
    'storage': ['Storage', 'storage'],
    'kubernetes': ['Kubernetes', 'kubernetes', 'K8s'],
    'open_saas': ['OPEN SaaS', 'open_saas', 'OpenSaaS'],
  };
  
  const possibleLabels = codeToLabel[code] || [code];
  
  // Try addons mapping first
  for (const label of possibleLabels) {
    const itemId = getItemId(addonsMapping, label);
    if (itemId !== undefined) {
      return { configId: addonsMapping?.configId, itemId };
    }
  }
  
  // Try specialized services mapping
  for (const label of possibleLabels) {
    const itemId = getItemId(specializedMapping, label);
    if (itemId !== undefined) {
      return { configId: specializedMapping?.configId, itemId };
    }
  }
  
  // No ID found - return undefined (no fallbacks)
  console.warn('[configIdsService] Could not find item_id for addon code:', code);
  return { configId: addonsMapping?.configId, itemId: undefined };
}

/**
 * Get backup item ID by plan
 */
export function getBackupItemId(
  store: ConfigIdStore,
  plan: string
): { configId: number | undefined; itemId: number | undefined } {
  const backupMapping = store.backup;
  
  // Try variations
  const labels = [
    `${plan} dias`,
    `backup_${plan}`,
    plan,
    `Backup ${plan} dias`,
    `${plan}d`,
  ];
  
  for (const label of labels) {
    const itemId = getItemId(backupMapping, label);
    if (itemId !== undefined) {
      return { configId: backupMapping?.configId, itemId };
    }
  }
  
  return { configId: backupMapping?.configId, itemId: undefined };
}

/**
 * Get SQL Server item ID by edition
 */
export function getSqlItemId(
  store: ConfigIdStore,
  edition: string
): { configId: number | undefined; itemId: number | undefined } {
  const sqlMapping = store.sqlServer;
  
  // Normalize edition
  const editionUpper = edition.toUpperCase();
  const labels = [
    edition,
    editionUpper,
    `${editionUpper} (2vCPU)`,
    `${editionUpper} (8vCPU)`,
    `SQL ${editionUpper}`,
    `Licença SQL (${editionUpper})`,
    `SQL WEB`,
    `SQL STD`,
  ];
  
  for (const label of labels) {
    const itemId = getItemId(sqlMapping, label);
    if (itemId !== undefined) {
      return { configId: sqlMapping?.configId, itemId };
    }
  }
  
  return { configId: sqlMapping?.configId, itemId: undefined };
}

/**
 * Get GPU item ID by model name
 */
export function getGpuItemId(
  store: ConfigIdStore,
  model: string
): { configId: number | undefined; itemId: number | undefined } {
  const gpuMapping = store.gpu;
  const itemId = getItemId(gpuMapping, model);
  return { configId: gpuMapping?.configId, itemId };
}

/**
 * Get Kubernetes plan item ID
 */
export function getKubernetesPlanItemId(
  store: ConfigIdStore,
  plan: string
): { configId: number | undefined; itemId: number | undefined } {
  const k8sMapping = store.kubernetes.plans;
  const itemId = getItemId(k8sMapping, plan);
  return { configId: k8sMapping?.configId, itemId };
}

/**
 * Get Storage item ID by type
 */
export function getStorageItemId(
  store: ConfigIdStore,
  storageType: string
): { configId: number | undefined; itemId: number | undefined } {
  // Determine which storage mapping to use
  const storageTypeLower = storageType.toLowerCase();
  let mapping: ConfigIdMapping | null = null;
  
  if (storageTypeLower.includes('sas') || storageTypeLower.includes('s3')) {
    mapping = store.storage.sas;
  } else if (storageTypeLower.includes('nvme') || storageTypeLower.includes('ssd')) {
    mapping = store.storage.nvme;
  } else {
    // Default to SAS for Storage SAN / generic storage
    mapping = store.storage.sas;
  }
  
  const itemId = getItemId(mapping, storageType);
  return { configId: mapping?.configId, itemId };
}

/**
 * Get BareMetal CPU item ID
 */
export function getBaremetalCpuItemId(
  store: ConfigIdStore,
  cpuModel: string
): { configId: number | undefined; itemId: number | undefined } {
  const mapping = store.baremetal.cpu;
  const itemId = getItemId(mapping, cpuModel);
  return { configId: mapping?.configId, itemId };
}

/**
 * Get BareMetal RAM item ID
 */
export function getBaremetalRamItemId(
  store: ConfigIdStore,
  ramTier: string
): { configId: number | undefined; itemId: number | undefined } {
  const mapping = store.baremetal.ram;
  const itemId = getItemId(mapping, ramTier);
  return { configId: mapping?.configId, itemId };
}

/**
 * Get BareMetal Disk item ID
 */
export function getBaremetalDiskItemId(
  store: ConfigIdStore,
  diskType: string
): { configId: number | undefined; itemId: number | undefined } {
  const mapping = store.baremetal.disk;
  const itemId = getItemId(mapping, diskType);
  return { configId: mapping?.configId, itemId };
}
