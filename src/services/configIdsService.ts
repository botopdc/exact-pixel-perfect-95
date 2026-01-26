/**
 * Config IDs Service
 * 
 * Provides mapping between config items and their API IDs for proposal creation.
 * Required since API v12+ where addons[] and servers[] require config_id + item_id.
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

// ============================================================================
// MAIN FUNCTIONS
// ============================================================================

/**
 * Load config ID mappings from API
 */
export async function loadConfigIds(): Promise<ConfigIdStore> {
  // Check cache
  if (cachedStore && (Date.now() - cacheTimestamp) < CACHE_TTL_MS) {
    return cachedStore;
  }
  
  console.log('[configIdsService] Loading config IDs from API...');
  const entries = await getCalculatorConfigs();
  
  // Build store
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
  
  // VM
  const vmEntry = findEntry(entries, 'VM', 'Preços de VM');
  if (vmEntry) store.vm = buildItemMap(vmEntry);
  
  // GPU
  const gpuEntry = findEntry(entries, 'GPU', 'Preços de GPU');
  if (gpuEntry) store.gpu = buildItemMap(gpuEntry);
  
  // Add-ons
  const addonsEntry = findEntry(entries, 'Add-ons', 'Add-ons');
  if (addonsEntry) store.addons = buildItemMap(addonsEntry);
  
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
  
  // Specialized Services (same as addons entry but explicit)
  const specializedEntry = findEntry(entries, 'Serviços Especializados', 'Serviços Especializados');
  if (specializedEntry) {
    store.specializedServices = buildItemMap(specializedEntry);
  } else {
    // Fallback: specialized services might be in Add-ons
    store.specializedServices = store.addons;
  }
  
  // Cache
  cachedStore = store;
  cacheTimestamp = Date.now();
  
  console.log('[configIdsService] Config IDs loaded:', {
    vm: store.vm?.configId,
    gpu: store.gpu?.configId,
    addons: store.addons?.configId,
    vmItems: store.vm ? Object.keys(store.vm.items).length : 0,
    addonItems: store.addons ? Object.keys(store.addons.items).length : 0,
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
 */
export function getVmItemIds(store: ConfigIdStore): {
  configId: number | undefined;
  vcpuItemId: number | undefined;
  ramItemId: number | undefined;
  storageItemId: number | undefined;
  ipItemId: number | undefined;
} {
  const vmMapping = store.vm;
  return {
    configId: vmMapping?.configId,
    vcpuItemId: getItemId(vmMapping, 'vCPU'),
    ramItemId: getItemId(vmMapping, 'RAM'),
    storageItemId: getItemId(vmMapping, 'NVMe'),
    ipItemId: getItemId(vmMapping, 'IP Público'),
  };
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
  
  // Code to label mapping
  const codeToLabel: Record<string, string[]> = {
    'antivirus': ['Antivírus', 'Antivirus', 'antivirus'],
    'firewall': ['Firewall pfSense', 'Firewall (qtd)', 'firewall'],
    'tsplus': ['TSplus', 'TS Plus', 'tsplus'],
    'cal': ['CAL', 'cal'],
    'veeam_vm': ['Veeam VM', 'veeam_vm'],
    'veeam_agent': ['Veeam Agent', 'veeam_agent'],
    'winserver_2vcpu_unit': ['WinServer(2vCPU/unid.)', 'Windows Server', 'winserver'],
    'support_basic': ['Suporte Básico', 'support_basic'],
    'support_intermediate': ['Suporte Intermediário', 'support_intermediate'],
    'support_advanced': ['Suporte Avançado', 'support_advanced'],
    'consulting_hours': ['Consultoria Técnica', 'consulting_hours'],
    'dba_hours': ['DBA', 'dba_hours'],
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
  const labels = [
    edition.toUpperCase(),
    `${edition.toUpperCase()} (2vCPU)`,
    `${edition.toUpperCase()} (8vCPU)`,
    `SQL ${edition.toUpperCase()}`,
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
