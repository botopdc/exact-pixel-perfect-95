// ============================================================================
// CALCULATOR CONFIG SERVICE - CRUD operations for pricing configuration
// NOW USES: Supabase Edge Function /pricing-admin (Passo 4)
// ============================================================================

import pricingAdminService, { 
  CalculatorConfigRow, 
  ConfigItem as EdgeConfigItem 
} from './pricingAdminService';

// ============================================================================
// CONSTANTS
// ============================================================================

const AUTH_TOKEN_KEY = 'open_access_token';
const LEGACY_AUTH_TOKEN_KEY = 'open_api_token';
const ADMIN_PIN_KEY = 'open_admin_pin';

// Default PIN for development (should be set via localStorage in production)
const DEFAULT_ADMIN_PIN = '5678';

// ============================================================================
// TYPES (maintain backwards compatibility with existing UI)
// ============================================================================

/**
 * FLAT config item structure (backwards compatible)
 * Now mapped from Supabase calculator_configs table
 */
export interface CalculatorConfigFlatItem {
  id: number;
  label: string;
  value: number;
  meta: {
    category: string;
    section: string;
    by?: string;
    type?: string;
    region?: string;
    retention?: string;
    min?: number;
    max?: number;
    description?: string;
  };
  created_at?: string;
  updated_at?: string;
}

/**
 * Paginated response (backwards compatible interface)
 */
export interface PaginatedConfigResponse {
  current_page: number;
  data: CalculatorConfigFlatItem[];
  from: number;
  last_page: number;
  per_page: number;
  to: number;
  total: number;
}

/**
 * Config item structure for backwards compatibility (legacy grouped format)
 */
export interface ConfigItem {
  id?: number;
  label: string;
  by?: string;
  type?: string;
  value?: number;
  description?: string;
}

/**
 * Legacy grouped entry format (from Supabase calculator_configs)
 */
export interface CalculatorConfigEntry {
  id: number;
  category: string;
  section: string;
  config: ConfigItem[];
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

/**
 * Request payload for PUT (backwards compatible)
 */
export interface CalculatorConfigUpdateRequest {
  label?: string;
  value?: number;
  meta?: {
    category?: string;
    section?: string;
    by?: string;
    type?: string;
    region?: string;
    retention?: string;
    min?: number;
    max?: number;
    description?: string;
  };
}

/**
 * Request payload for POST (backwards compatible)
 */
export interface CalculatorConfigCreateRequest {
  label: string;
  value: number;
  meta: {
    category: string;
    section: string;
    by?: string;
    type?: string;
    region?: string;
    retention?: string;
    min?: number;
    max?: number;
    description?: string;
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get auth token from localStorage
 */
function getAuthToken(): string {
  const token = localStorage.getItem(AUTH_TOKEN_KEY) || localStorage.getItem(LEGACY_AUTH_TOKEN_KEY);
  if (!token) {
    throw new Error('Usuário não autenticado. Faça login novamente.');
  }
  return token;
}

/**
 * Get admin PIN from localStorage (or use default for dev)
 */
function getAdminPin(): string {
  return localStorage.getItem(ADMIN_PIN_KEY) || DEFAULT_ADMIN_PIN;
}

/**
 * Convert Supabase row to flat items (for backwards compatibility)
 * Each row in calculator_configs has a config JSONB array
 */
function rowToFlatItems(row: CalculatorConfigRow): CalculatorConfigFlatItem[] {
  const items: CalculatorConfigFlatItem[] = [];
  
  if (!row.config || !Array.isArray(row.config)) {
    return items;
  }
  
  for (const item of row.config) {
    items.push({
      id: item.id ?? row.id, // Use item.id if available, fallback to row.id
      label: item.label || '',
      value: item.value ?? 0,
      meta: {
        category: row.category,
        section: row.section,
        by: item.by,
        type: item.type,
        description: item.description,
      },
      created_at: row.created_at,
      updated_at: row.updated_at,
    });
  }
  
  return items;
}

/**
 * Convert Supabase rows to CalculatorConfigEntry format
 */
function rowsToEntries(rows: CalculatorConfigRow[]): CalculatorConfigEntry[] {
  return rows.map(row => ({
    id: row.id,
    category: row.category,
    section: row.section,
    config: (row.config || []).map((item: EdgeConfigItem) => ({
      id: item.id,
      label: item.label,
      value: item.value,
      by: item.by,
      type: item.type,
      description: item.description,
    })),
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at,
  }));
}

// ============================================================================
// SERVICE FUNCTIONS - Using Edge Function /pricing-admin
// ============================================================================

/**
 * Fetch all calculator configurations as FLAT items
 * GET /pricing-admin
 */
export async function getCalculatorConfigsFlat(): Promise<CalculatorConfigFlatItem[]> {
  try {
    const pin = getAdminPin();
    const rows = await pricingAdminService.getAllConfigs(pin);
    
    // Flatten all rows into flat items
    const flatItems: CalculatorConfigFlatItem[] = [];
    for (const row of rows) {
      flatItems.push(...rowToFlatItems(row));
    }
    
    console.log('[calculatorConfigService] Loaded', flatItems.length, 'flat config items from Supabase');
    return flatItems;
  } catch (error) {
    console.error('[calculatorConfigService] Error fetching configs:', error);
    throw error;
  }
}

/**
 * Fetch all calculator configurations grouped by category/section
 * For backwards compatibility with existing UI
 */
export async function getCalculatorConfigs(): Promise<CalculatorConfigEntry[]> {
  try {
    const pin = getAdminPin();
    const rows = await pricingAdminService.getAllConfigs(pin);
    return rowsToEntries(rows);
  } catch (error) {
    console.error('[calculatorConfigService] Error fetching configs:', error);
    throw error;
  }
}

/**
 * Fetch a single config by ID
 * GET /pricing-admin?id=X
 */
export async function getCalculatorConfigById(id: number): Promise<CalculatorConfigFlatItem> {
  try {
    const pin = getAdminPin();
    const rows = await pricingAdminService.getAllConfigs(pin);
    
    // Find the row and item with matching ID
    for (const row of rows) {
      const items = rowToFlatItems(row);
      const found = items.find(item => item.id === id);
      if (found) return found;
    }
    
    throw new Error(`Config item with ID ${id} not found`);
  } catch (error) {
    console.error('[calculatorConfigService] Error fetching config by ID:', error);
    throw error;
  }
}

/**
 * Update a single calculator configuration item
 * Uses POST (upsert) to update the entire config array for the category/section
 */
export async function updateCalculatorConfigItem(
  id: number,
  payload: CalculatorConfigUpdateRequest
): Promise<CalculatorConfigFlatItem> {
  try {
    const pin = getAdminPin();
    const rows = await pricingAdminService.getAllConfigs(pin);
    
    // Find the row containing this item
    let targetRow: CalculatorConfigRow | undefined;
    let itemIndex = -1;
    
    for (const row of rows) {
      const idx = (row.config || []).findIndex((item: EdgeConfigItem) => item.id === id);
      if (idx >= 0) {
        targetRow = row;
        itemIndex = idx;
        break;
      }
    }
    
    if (!targetRow || itemIndex < 0) {
      throw new Error(`Config item with ID ${id} not found`);
    }
    
    // Update the item in the config array
    const updatedConfig = [...(targetRow.config || [])];
    updatedConfig[itemIndex] = {
      ...updatedConfig[itemIndex],
      label: payload.label ?? updatedConfig[itemIndex].label,
      value: payload.value ?? updatedConfig[itemIndex].value,
      by: payload.meta?.by ?? updatedConfig[itemIndex].by,
      type: payload.meta?.type ?? updatedConfig[itemIndex].type,
      description: payload.meta?.description ?? updatedConfig[itemIndex].description,
    };
    
    // Use upsert to save the updated config array
    const category = payload.meta?.category ?? targetRow.category;
    const section = payload.meta?.section ?? targetRow.section;
    
    await pricingAdminService.upsertConfig(pin, category, section, updatedConfig);
    
    // Return the updated item
    return {
      id,
      label: updatedConfig[itemIndex].label,
      value: updatedConfig[itemIndex].value ?? 0,
      meta: {
        category,
        section,
        by: updatedConfig[itemIndex].by,
        type: updatedConfig[itemIndex].type,
        description: updatedConfig[itemIndex].description,
      },
      updated_at: new Date().toISOString(),
    };
  } catch (error) {
    console.error('[calculatorConfigService] Error updating config item:', error);
    throw error;
  }
}

/**
 * Create a new calculator configuration item
 * Uses POST (upsert) to add item to the config array
 */
export async function createCalculatorConfigItem(
  payload: CalculatorConfigCreateRequest
): Promise<CalculatorConfigFlatItem> {
  try {
    const pin = getAdminPin();
    const { category, section, by, type, description } = payload.meta;
    
    // Get existing row for this category/section
    const existing = await pricingAdminService.getConfigByPath(pin, category, section);
    
    // Create new item with auto-generated ID
    const newItem: EdgeConfigItem = {
      id: Date.now(), // Temporary ID, could be improved
      label: payload.label,
      value: payload.value,
      by,
      type,
      description,
    };
    
    // Add to existing config or create new
    const config = existing ? [...(existing.config || []), newItem] : [newItem];
    
    await pricingAdminService.upsertConfig(pin, category, section, config);
    
    return {
      id: newItem.id!,
      label: newItem.label,
      value: newItem.value ?? 0,
      meta: {
        category,
        section,
        by: newItem.by,
        type: newItem.type,
        description: newItem.description,
      },
      created_at: new Date().toISOString(),
    };
  } catch (error) {
    console.error('[calculatorConfigService] Error creating config item:', error);
    throw error;
  }
}

/**
 * Delete a calculator configuration item
 * Removes item from config array and uses upsert to save
 */
export async function deleteCalculatorConfigItem(id: number): Promise<void> {
  try {
    const pin = getAdminPin();
    const rows = await pricingAdminService.getAllConfigs(pin);
    
    // Find the row containing this item
    let targetRow: CalculatorConfigRow | undefined;
    
    for (const row of rows) {
      const hasItem = (row.config || []).some((item: EdgeConfigItem) => item.id === id);
      if (hasItem) {
        targetRow = row;
        break;
      }
    }
    
    if (!targetRow) {
      throw new Error(`Config item with ID ${id} not found`);
    }
    
    // Remove the item from config array
    const updatedConfig = (targetRow.config || []).filter((item: EdgeConfigItem) => item.id !== id);
    
    // Save updated config
    await pricingAdminService.upsertConfig(pin, targetRow.category, targetRow.section, updatedConfig);
  } catch (error) {
    console.error('[calculatorConfigService] Error deleting config item:', error);
    throw error;
  }
}

/**
 * Update an existing calculator configuration (legacy grouped format)
 * For backwards compatibility - saves entire config array at once
 */
export async function updateCalculatorConfig(
  entryId: number,
  payload: { category?: string; section?: string; config?: ConfigItem[] }
): Promise<CalculatorConfigEntry> {
  try {
    const pin = getAdminPin();
    const { category, section, config } = payload;
    
    if (!category || !section) {
      throw new Error('category and section are required');
    }
    
    // Convert ConfigItem[] to EdgeConfigItem[]
    const edgeConfig: EdgeConfigItem[] = (config || []).map(item => ({
      id: item.id,
      label: item.label,
      value: item.value,
      by: item.by,
      type: item.type,
      description: item.description,
    }));
    
    // Use upsert to save the entire config array
    const result = await pricingAdminService.upsertConfig(pin, category, section, edgeConfig);
    
    return {
      id: result.id,
      category: result.category,
      section: result.section,
      config: (result.config || []).map((item: EdgeConfigItem) => ({
        id: item.id,
        label: item.label,
        value: item.value,
        by: item.by,
        type: item.type,
        description: item.description,
      })),
      created_at: result.created_at,
      updated_at: result.updated_at,
      deleted_at: result.deleted_at,
    };
  } catch (error) {
    console.error('[calculatorConfigService] Error updating config:', error);
    throw error;
  }
}

// ============================================================================
// HELPER - Find config entry by category and section
// ============================================================================

export function findConfigEntry(
  entries: CalculatorConfigEntry[],
  category: string,
  section: string
): CalculatorConfigEntry | undefined {
  return entries.find(e => e.category === category && e.section === section);
}

// ============================================================================
// CATEGORY / SECTION MAPPING (aligned with actual database values)
// ============================================================================

/**
 * Standard category/section mappings used by the pricing configuration
 * IMPORTANT: These MUST match exactly the values in the database (calculator_configs table)
 */
export const CONFIG_MAPPINGS = {
  // General settings
  GERAL_FX: { category: 'Geral', section: 'Taxa de Câmbio' },
  GERAL_DESCONTO: { category: 'Geral', section: 'Descontos por Vigência' },
  GERAL_SAAS: { category: 'Geral', section: 'OPEN SaaS' },
  
  // VM prices
  VM_PRICES: { category: 'VM', section: 'Preços de VM' },
  
  // GPU prices
  GPU_PRICES: { category: 'GPU', section: 'Preços de GPU' },
  
  // BareMetal
  BAREMETAL_CPU: { category: 'BareMetal', section: 'Modelos de CPU' },
  BAREMETAL_RAM: { category: 'BareMetal', section: 'Opções de RAM' },
  BAREMETAL_DISK: { category: 'BareMetal', section: 'Opções de Disco' },
  
  // Add-ons
  ADDONS: { category: 'Add-ons', section: 'Add-ons' },
  
  // SQL Server
  SQL_SERVER: { category: 'SQL Server', section: 'SQL Server' },
  
  // Storage
  STORAGE_SAS: { category: 'Storage', section: 'Storage SAS' },
  STORAGE_NVME: { category: 'Storage', section: 'SSD NVMe' },
  
  // Kubernetes
  KUBERNETES_PLANS: { category: 'Kubernetes', section: 'Preços Base dos Planos' },
  KUBERNETES_ADDONS: { category: 'Kubernetes', section: 'Add-ons Kubernetes' },
  
  // Backup pricing by retention
  BACKUP: { category: 'Backup', section: 'Backup por Retenção' },
  
  // Serviços Especializados
  SPECIALIZED_SERVICES: { category: 'Add-ons', section: 'Serviços Especializados' },
  
  // Windows Server
  WINDOWS_SERVER: { category: 'Add-ons', section: 'Windows Server' },
} as const;

export type ConfigMappingKey = keyof typeof CONFIG_MAPPINGS;

// ============================================================================
// CONFIG ID LOOKUP - Get config_id by category and label
// ============================================================================

/**
 * Cache for flat config items
 */
let cachedFlatItems: CalculatorConfigFlatItem[] | null = null;

/**
 * Load flat config items (with optional caching)
 */
export async function loadFlatConfigs(useCache = false): Promise<CalculatorConfigFlatItem[]> {
  if (useCache && cachedFlatItems) {
    return cachedFlatItems;
  }
  
  cachedFlatItems = await getCalculatorConfigsFlat();
  console.log('[calculatorConfigService] Loaded', cachedFlatItems.length, 'flat config items from Supabase');
  return cachedFlatItems;
}

/**
 * Clear the config cache
 */
export function clearConfigCache(): void {
  cachedFlatItems = null;
}

/**
 * Get cached flat items (returns null if not loaded)
 */
export function getCachedFlatItems(): CalculatorConfigFlatItem[] | null {
  return cachedFlatItems;
}

/**
 * Find config_id by category and label
 */
export async function findConfigId(
  category: string,
  label: string
): Promise<number | null> {
  const items = await loadFlatConfigs();
  const catLower = category.toLowerCase().trim();
  const labelLower = label.toLowerCase().trim();
  
  const item = items.find(i => 
    i.meta.category.toLowerCase().trim() === catLower &&
    i.label.toLowerCase().trim() === labelLower
  );
  
  return item?.id ?? null;
}

/**
 * Get all config IDs for VM components
 */
export async function getVmConfigIds(): Promise<{
  vcpu: number | null;
  ram: number | null;
  nvme: number | null;
  ip: number | null;
}> {
  const items = await loadFlatConfigs();
  const vmItems = items.filter(i => 
    i.meta.category.toLowerCase() === 'vm' && 
    i.meta.section.toLowerCase().includes('preços')
  );
  
  let vcpu: number | null = null;
  let ram: number | null = null;
  let nvme: number | null = null;
  let ip: number | null = null;
  
  for (const item of vmItems) {
    const labelLower = item.label.toLowerCase();
    if (labelLower === 'vcpu') vcpu = item.id;
    else if (labelLower === 'ram') ram = item.id;
    else if (labelLower === 'nvme') nvme = item.id;
    else if (labelLower.includes('ip')) ip = item.id;
  }
  
  console.log('[calculatorConfigService] VM Config IDs:', { vcpu, ram, nvme, ip });
  return { vcpu, ram, nvme, ip };
}

/**
 * Get config_id for a specific addon by label
 */
export async function getAddonConfigId(label: string): Promise<number | null> {
  const items = await loadFlatConfigs(true);
  const labelLower = label.toLowerCase().trim();
  
  // Try exact match first in Add-ons category
  let item = items.find(i => 
    i.meta.category.toLowerCase() === 'add-ons' &&
    i.label.toLowerCase().trim() === labelLower
  );
  
  // Try partial match in Add-ons
  if (!item) {
    item = items.find(i => 
      i.meta.category.toLowerCase() === 'add-ons' &&
      i.label.toLowerCase().includes(labelLower)
    );
  }
  
  // Try global search with partial match
  if (!item) {
    item = items.find(i => 
      i.label.toLowerCase().includes(labelLower) ||
      labelLower.includes(i.label.toLowerCase())
    );
  }
  
  return item?.id ?? null;
}

/**
 * Get config_id for GPU by model name
 */
export async function getGpuConfigId(model: string): Promise<number | null> {
  const items = await loadFlatConfigs(true);
  const modelLower = model.toLowerCase().trim();
  
  const item = items.find(i => 
    i.meta.category.toLowerCase() === 'gpu' &&
    i.label.toLowerCase().trim() === modelLower
  );
  
  return item?.id ?? null;
}

/**
 * Get config_id for SQL Server by edition
 */
export async function getSqlConfigId(edition: string): Promise<number | null> {
  const items = await loadFlatConfigs(true);
  const editionLower = edition.toLowerCase().trim();
  
  const item = items.find(i => 
    i.meta.category.toLowerCase() === 'sql server' &&
    i.label.toLowerCase().includes(editionLower)
  );
  
  return item?.id ?? null;
}

/**
 * Get config_id for Backup by retention
 */
export async function getBackupConfigId(retention: string): Promise<number | null> {
  const items = await loadFlatConfigs(true);
  const retentionLower = retention.toLowerCase().trim();
  
  const item = items.find(i => 
    i.meta.category.toLowerCase() === 'backup' &&
    (i.label.toLowerCase().includes(retentionLower) || 
     i.meta.retention?.toLowerCase() === retentionLower)
  );
  
  return item?.id ?? null;
}

// ============================================================================
// ADDON CONFIG ID MAP
// ============================================================================

const ADDON_CODE_TO_LABELS: Record<string, string[]> = {
  'antivirus': ['Antivirus', 'Antivírus'],
  'firewall': ['Firewall'],
  'tsplus': ['TSplus', 'TS PLUS', 'TS Plus'],
  'cal': ['CAL'],
  'veeam_vm': ['Veeam VM', 'Veeam Backup (VM)'],
  'veeam_agent': ['Veeam Agent', 'Veeam Agent (Workstation)'],
  'winserver': ['WinServer(2vCPU/unid.)', 'WinServer', 'Windows Server'],
  'sql_web': ['WEB (2vCPU)', 'SQL WEB', 'WEB'],
  'sql_std': ['STD (8vCPU)', 'SQL STD', 'STD', 'Standard'],
  'sql_standard': ['STD (8vCPU)', 'SQL STD', 'STD', 'Standard'],
  'sql_enterprise': ['Enterprise', 'SQL Enterprise'],
  'backup_7': ['Backup 7 dias', '7 dias', '7'],
  'backup_15': ['Backup 15 dias', '15 dias', '15'],
  'backup_30': ['Backup 30 dias', '30 dias', '30'],
  'support_basic': ['Suporte Básico', 'Básico'],
  'support_intermediate': ['Suporte Intermediário', 'Intermediário'],
  'support_advanced': ['Suporte Avançado', 'Avançado'],
  'consulting': ['Consultoria Técnica', 'Consultoria'],
  'dba': ['DBA'],
  'storage_sas': ['Storage SAS'],
  'storage_nvme': ['SSD NVMe', 'NVMe'],
  'storage_s3': ['S3 Object Storage', 'S3'],
  'kubernetes': ['Kubernetes'],
  'open_saas': ['OPEN SaaS', 'OpenSaaS'],
};

/**
 * Get config_id for an addon by its frontend code
 */
export async function getAddonConfigIdByCode(code: string): Promise<number | null> {
  const items = await loadFlatConfigs(true);
  const labels = ADDON_CODE_TO_LABELS[code];
  
  if (!labels || labels.length === 0) {
    console.warn(`[calculatorConfigService] No label mapping for addon code: ${code}`);
    return null;
  }
  
  for (const label of labels) {
    const labelLower = label.toLowerCase().trim();
    
    let item = items.find(i => i.label.toLowerCase().trim() === labelLower);
    
    if (!item) {
      item = items.find(i => 
        i.label.toLowerCase().includes(labelLower) ||
        labelLower.includes(i.label.toLowerCase())
      );
    }
    
    if (item) {
      console.log(`[calculatorConfigService] Found config_id ${item.id} for code "${code}" (label: "${item.label}")`);
      return item.id;
    }
  }
  
  console.warn(`[calculatorConfigService] Could not find config_id for addon code: ${code}, tried labels:`, labels);
  return null;
}

/**
 * Build a complete addon config ID map for proposal serialization
 */
export async function buildAddonConfigIdMap(): Promise<Record<string, number>> {
  const items = await loadFlatConfigs(false);
  const map: Record<string, number> = {};
  const missingCodes: string[] = [];
  
  console.log('[calculatorConfigService] Building addon config ID map from', items.length, 'items');
  
  for (const [code, labels] of Object.entries(ADDON_CODE_TO_LABELS)) {
    let found = false;
    
    for (const label of labels) {
      const labelLower = label.toLowerCase().trim();
      
      let item = items.find(i => i.label.toLowerCase().trim() === labelLower);
      
      if (!item) {
        item = items.find(i => i.label.toLowerCase().includes(labelLower));
      }
      
      if (!item) {
        item = items.find(i => labelLower.includes(i.label.toLowerCase().trim()));
      }
      
      if (item) {
        map[code] = item.id;
        found = true;
        break;
      }
    }
    
    if (!found) {
      missingCodes.push(code);
    }
  }
  
  // Also add VM component IDs
  const vmItems = items.filter(i => 
    i.meta.category.toLowerCase() === 'vm' && 
    i.meta.section.toLowerCase().includes('preços')
  );
  
  for (const item of vmItems) {
    const labelLower = item.label.toLowerCase();
    if (labelLower === 'vcpu') map['vcpu'] = item.id;
    else if (labelLower === 'ram') map['ram'] = item.id;
    else if (labelLower === 'nvme') map['nvme'] = item.id;
    else if (labelLower.includes('ip')) map['ip'] = item.id;
  }
  
  console.log('[calculatorConfigService] Addon config ID map built:', map);
  
  if (missingCodes.length > 0) {
    console.error('[calculatorConfigService] WARNING: Missing config_ids for codes:', missingCodes);
  }
  
  return map;
}
