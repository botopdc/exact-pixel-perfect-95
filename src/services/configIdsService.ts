/**
 * Config IDs Service
 * 
 * Provides mapping between config items and their API IDs for proposal creation.
 * Required since API v12+ where addons[] and servers[] require config_id + item_id.
 * 
 * Database IDs (from calculator_configs table):
 * 1  - VM / Preços de VM
 * 2  - BareMetal / Modelos de CPU
 * 3  - BareMetal / Opções de RAM
 * 4  - BareMetal / Opções de Disco
 * 5  - GPU / Preços de GPU
 * 6  - Add-ons / Add-ons
 * 7  - SQL Server / SQL Server
 * 8  - Storage / Storage SAS
 * 9  - Storage / SSD NVMe
 * 10 - Kubernetes / Preços Base dos Planos
 * 11 - Kubernetes / Add-ons Kubernetes
 * 12 - Geral / Taxa de Câmbio
 * 13 - Geral / Descontos por Vigência
 * 14 - Geral / OPEN SaaS
 */

import { getCalculatorConfigs, CalculatorConfigEntry, ConfigItem } from './calculatorConfigService';

// ============================================================================
// KNOWN CONFIG IDS (fallback when API doesn't return them)
// These match the database IDs from calculator_configs table
// ============================================================================

const KNOWN_CONFIG_IDS = {
  VM: 1,
  BAREMETAL_CPU: 2,
  BAREMETAL_RAM: 3,
  BAREMETAL_DISK: 4,
  GPU: 5,
  ADDONS: 6,
  SQL_SERVER: 7,
  STORAGE_SAS: 8,
  STORAGE_NVME: 9,
  KUBERNETES_PLANS: 10,
  KUBERNETES_ADDONS: 11,
  GERAL_FX: 12,
  GERAL_DESCONTO: 13,
  GERAL_SAAS: 14,
  BACKUP: 15, // Assuming backup is ID 15, adjust if needed
  SPECIALIZED_SERVICES: 16, // Assuming specialized services
} as const;

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
// SINGLETON CACHE
// ============================================================================

let cachedStore: ConfigIdStore | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

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

/**
 * Create a fallback mapping with known config ID but empty items
 * The items will be populated by the actual API response, but at least config_id will be valid
 */
function createFallbackMapping(configId: number, category: string, section: string): ConfigIdMapping {
  return {
    configId,
    category,
    section,
    items: {},
  };
}

// ============================================================================
// MAIN FUNCTIONS
// ============================================================================

/**
 * Load config ID mappings from API
 * Falls back to known config IDs if API fails
 */
export async function loadConfigIds(): Promise<ConfigIdStore> {
  // Check cache
  if (cachedStore && (Date.now() - cacheTimestamp) < CACHE_TTL_MS) {
    console.log('[configIdsService] Returning cached config IDs');
    return cachedStore;
  }
  
  console.log('[configIdsService] Loading config IDs from API...');
  
  // Initialize store with fallback values
  const store: ConfigIdStore = {
    vm: createFallbackMapping(KNOWN_CONFIG_IDS.VM, 'VM', 'Preços de VM'),
    gpu: createFallbackMapping(KNOWN_CONFIG_IDS.GPU, 'GPU', 'Preços de GPU'),
    addons: createFallbackMapping(KNOWN_CONFIG_IDS.ADDONS, 'Add-ons', 'Add-ons'),
    sqlServer: createFallbackMapping(KNOWN_CONFIG_IDS.SQL_SERVER, 'SQL Server', 'SQL Server'),
    backup: createFallbackMapping(KNOWN_CONFIG_IDS.BACKUP, 'Backup', 'Tabela de Preços'),
    storage: {
      sas: createFallbackMapping(KNOWN_CONFIG_IDS.STORAGE_SAS, 'Storage', 'Storage SAS'),
      nvme: createFallbackMapping(KNOWN_CONFIG_IDS.STORAGE_NVME, 'Storage', 'SSD NVMe'),
    },
    kubernetes: {
      plans: createFallbackMapping(KNOWN_CONFIG_IDS.KUBERNETES_PLANS, 'Kubernetes', 'Preços Base dos Planos'),
      addons: createFallbackMapping(KNOWN_CONFIG_IDS.KUBERNETES_ADDONS, 'Kubernetes', 'Add-ons Kubernetes'),
    },
    baremetal: {
      cpu: createFallbackMapping(KNOWN_CONFIG_IDS.BAREMETAL_CPU, 'BareMetal', 'Modelos de CPU'),
      ram: createFallbackMapping(KNOWN_CONFIG_IDS.BAREMETAL_RAM, 'BareMetal', 'Opções de RAM'),
      disk: createFallbackMapping(KNOWN_CONFIG_IDS.BAREMETAL_DISK, 'BareMetal', 'Opções de Disco'),
    },
    specializedServices: createFallbackMapping(KNOWN_CONFIG_IDS.ADDONS, 'Add-ons', 'Add-ons'), // Usually same as addons
  };
  
  try {
    const entries = await getCalculatorConfigs();
    console.log('[configIdsService] Loaded', entries.length, 'config entries from API');
    
    // Debug: log all entries
    entries.forEach(e => {
      const itemCount = Array.isArray(e.config) ? e.config.length : 0;
      const itemsWithIds = Array.isArray(e.config) ? e.config.filter((i: ConfigItem) => i.id).length : 0;
      console.log(`[configIdsService] Entry ${e.id}: ${e.category}/${e.section} (${itemsWithIds}/${itemCount} items with IDs)`);
    });
    
    // VM
    const vmEntry = findEntry(entries, 'VM', 'Preços de VM');
    if (vmEntry) {
      store.vm = buildItemMap(vmEntry);
      console.log('[configIdsService] VM config loaded:', store.vm.configId, 'with', Object.keys(store.vm.items).length, 'items');
    }
    
    // GPU
    const gpuEntry = findEntry(entries, 'GPU', 'Preços de GPU');
    if (gpuEntry) store.gpu = buildItemMap(gpuEntry);
    
    // Add-ons
    const addonsEntry = findEntry(entries, 'Add-ons', 'Add-ons');
    if (addonsEntry) {
      store.addons = buildItemMap(addonsEntry);
      console.log('[configIdsService] Add-ons config loaded:', store.addons.configId, 'with', Object.keys(store.addons.items).length, 'items');
      console.log('[configIdsService] Add-on items:', Object.keys(store.addons.items));
    }
    
    // SQL Server
    const sqlEntry = findEntry(entries, 'SQL Server', 'SQL Server');
    if (sqlEntry) store.sqlServer = buildItemMap(sqlEntry);
    
    // Backup
    const backupEntry = findEntry(entries, 'Backup', 'Tabela de Preços');
    if (backupEntry) store.backup = buildItemMap(backupEntry);
    
    // Storage
    const sasSasEntry = findEntry(entries, 'Storage', 'Storage SAS');
    if (sasSasEntry) store.storage.sas = buildItemMap(sasSasEntry);
    
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
    
    // Specialized Services (often same as addons or in a dedicated section)
    const specializedEntry = findEntry(entries, 'Serviços Especializados', 'Serviços Especializados');
    if (specializedEntry) {
      store.specializedServices = buildItemMap(specializedEntry);
    } else {
      // Fallback: specialized services are in Add-ons
      store.specializedServices = store.addons;
    }
    
  } catch (error) {
    console.warn('[configIdsService] Failed to load from API, using fallback IDs:', error);
  }
  
  // Cache
  cachedStore = store;
  cacheTimestamp = Date.now();
  
  console.log('[configIdsService] Config IDs ready:', {
    vm: store.vm?.configId,
    gpu: store.gpu?.configId,
    addons: store.addons?.configId,
    vmItemsCount: store.vm ? Object.keys(store.vm.items).length : 0,
    addonItemsCount: store.addons ? Object.keys(store.addons.items).length : 0,
  });
  
  return store;
}

/**
 * Get cached store (will load if not available)
 */
export function getConfigIdStore(): ConfigIdStore | null {
  return cachedStore;
}

/**
 * Clear cached store
 */
export function clearConfigIdCache(): void {
  cachedStore = null;
  cacheTimestamp = 0;
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
    ipItemId: getItemId(vmMapping, 'IP Público') ?? getItemId(vmMapping, 'ip_publico'),
  };
  
  console.log('[configIdsService] getVmItemIds:', result);
  return result;
}

/**
 * Get addon item ID by code
 * Maps common addon codes to their item IDs
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
    'winserver_2vcpu_unit': ['WinServer(2vCPU/unid.)', 'Windows Server', 'winserver', 'WinServer 2vCPU'],
    'support_basic': ['Suporte Básico', 'support_basic'],
    'support_intermediate': ['Suporte Intermediário', 'support_intermediate'],
    'support_advanced': ['Suporte Avançado', 'support_advanced'],
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
  
  // Fallback: return config_id without item_id
  // API will fail but at least we have something
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
    mapping = store.storage.sas; // Default to SAS
  }
  
  const itemId = getItemId(mapping, storageType);
  return { configId: mapping?.configId, itemId };
}
