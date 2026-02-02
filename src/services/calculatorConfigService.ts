// ============================================================================
// CALCULATOR CONFIG SERVICE - CRUD operations for pricing configuration
// ============================================================================

import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
if (!API_BASE_URL) {
  throw new Error('VITE_API_BASE_URL não está definida. Configure a variável de ambiente.');
}
const AUTH_TOKEN_KEY = 'open_access_token';
const LEGACY_AUTH_TOKEN_KEY = 'open_api_token';

// Create axios client
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// Add auth interceptor
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem(AUTH_TOKEN_KEY) || localStorage.getItem(LEGACY_AUTH_TOKEN_KEY);
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  return config;
});

// ============================================================================
// TYPES (based on API OpenAPI spec - NEW FLAT FORMAT)
// ============================================================================

/**
 * FLAT config item structure from API
 * Each item is independent with its own id, label, value, and meta
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
 * Paginated response from GET /api/calculator/config
 * Returns array of flat items, not grouped entries
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
  id?: number;         // Unique ID of the config item
  label: string;
  by?: string;         // e.g., "unit", "GB", "TB", "month", "hour"
  type?: string;       // e.g., "BRL", "USD", "percentage"
  value?: number;
  description?: string;
}

/**
 * Legacy grouped entry format (for backwards compatibility)
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
 * Request payload for PUT /api/calculator/config/{id}
 * Updates a single config item directly
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
 * Request payload for POST /api/calculator/config
 * Creates a new config item
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
// SERVICE FUNCTIONS
// ============================================================================

/**
 * Fetch all calculator configurations from API
 * GET /api/calculator/config
 * Returns FLAT items directly from API
 */
export async function getCalculatorConfigsFlat(): Promise<CalculatorConfigFlatItem[]> {
  const response = await apiClient.get<PaginatedConfigResponse>('/calculator/config', {
    params: { __perPage: 500 }
  });
  return response.data.data || [];
}

/**
 * Fetch all calculator configurations grouped by category/section
 * For backwards compatibility - groups flat items into entries
 */
export async function getCalculatorConfigs(): Promise<CalculatorConfigEntry[]> {
  const flatItems = await getCalculatorConfigsFlat();
  return groupFlatItemsToEntries(flatItems);
}

/**
 * Group flat items into legacy entry format
 */
function groupFlatItemsToEntries(items: CalculatorConfigFlatItem[]): CalculatorConfigEntry[] {
  const groupMap = new Map<string, CalculatorConfigEntry>();
  
  for (const item of items) {
    const key = `${item.meta.category}/${item.meta.section}`;
    
    if (!groupMap.has(key)) {
      groupMap.set(key, {
        id: item.id, // Use first item's ID as group ID
        category: item.meta.category,
        section: item.meta.section,
        config: [],
        created_at: item.created_at || '',
        updated_at: item.updated_at || '',
        deleted_at: null,
      });
    }
    
    const entry = groupMap.get(key)!;
    entry.config.push({
      id: item.id,
      label: item.label,
      value: item.value,
      by: item.meta.by,
      type: item.meta.type,
      description: item.meta.description,
    });
  }
  
  return Array.from(groupMap.values());
}

/**
 * Fetch a single config by ID
 * GET /api/calculator/config/{id}
 */
export async function getCalculatorConfigById(id: number): Promise<CalculatorConfigFlatItem> {
  const response = await apiClient.get<CalculatorConfigFlatItem>(`/calculator/config/${id}`);
  return response.data;
}

/**
 * Update a single calculator configuration item
 * PUT /api/calculator/config/{id}
 * 
 * @param id - The config item ID (individual item, not group)
 * @param payload - { label?, value?, meta? }
 */
export async function updateCalculatorConfigItem(
  id: number,
  payload: CalculatorConfigUpdateRequest
): Promise<CalculatorConfigFlatItem> {
  const response = await apiClient.put<CalculatorConfigFlatItem>(`/calculator/config/${id}`, payload);
  return response.data;
}

/**
 * Create a new calculator configuration item
 * POST /api/calculator/config
 */
export async function createCalculatorConfigItem(
  payload: CalculatorConfigCreateRequest
): Promise<CalculatorConfigFlatItem> {
  const response = await apiClient.post<CalculatorConfigFlatItem>('/calculator/config', payload);
  return response.data;
}

/**
 * Delete a calculator configuration item
 * DELETE /api/calculator/config/{id}
 */
export async function deleteCalculatorConfigItem(id: number): Promise<void> {
  await apiClient.delete(`/calculator/config/${id}`);
}

/**
 * Update an existing calculator configuration (legacy grouped format)
 * For backwards compatibility - updates multiple items individually
 * 
 * @deprecated Use updateCalculatorConfigItem instead
 */
export async function updateCalculatorConfig(
  entryId: number,
  payload: { category?: string; section?: string; config?: ConfigItem[] }
): Promise<CalculatorConfigEntry> {
  // For the new FLAT API, we need to update each item individually
  // This is a compatibility shim - the caller should use updateCalculatorConfigItem
  
  if (payload.config && Array.isArray(payload.config)) {
    for (const item of payload.config) {
      if (item.id) {
        // Update existing item
        await updateCalculatorConfigItem(item.id, {
          label: item.label,
          value: item.value,
          meta: {
            category: payload.category,
            section: payload.section,
            by: item.by,
            type: item.type,
          }
        });
      } else {
        // Create new item
        await createCalculatorConfigItem({
          label: item.label,
          value: item.value ?? 0,
          meta: {
            category: payload.category || '',
            section: payload.section || '',
            by: item.by,
            type: item.type || 'BRL',
          }
        });
      }
    }
  }
  
  // Return updated entries grouped
  const entries = await getCalculatorConfigs();
  const entry = entries.find(e => 
    e.category.toLowerCase() === payload.category?.toLowerCase() && 
    e.section.toLowerCase() === payload.section?.toLowerCase()
  );
  
  return entry || {
    id: entryId,
    category: payload.category || '',
    section: payload.section || '',
    config: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deleted_at: null,
  };
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
// CATEGORY / SECTION MAPPING (aligned with actual database values from CSV)
// ============================================================================

/**
 * Standard category/section mappings used by the pricing configuration
 * IMPORTANT: These MUST match exactly the values in the database (calculator_configs table)
 * 
 * Database IDs:
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
export const CONFIG_MAPPINGS = {
  // General settings (IDs 12, 13, 14)
  GERAL_FX: { category: 'Geral', section: 'Taxa de Câmbio' },
  GERAL_DESCONTO: { category: 'Geral', section: 'Descontos por Vigência' },
  GERAL_SAAS: { category: 'Geral', section: 'OPEN SaaS' },
  
  // VM prices (ID 1)
  VM_PRICES: { category: 'VM', section: 'Preços de VM' },
  
  // GPU prices (ID 5)
  GPU_PRICES: { category: 'GPU', section: 'Preços de GPU' },
  
  // BareMetal (IDs 2, 3, 4)
  BAREMETAL_CPU: { category: 'BareMetal', section: 'Modelos de CPU' },
  BAREMETAL_RAM: { category: 'BareMetal', section: 'Opções de RAM' },
  BAREMETAL_DISK: { category: 'BareMetal', section: 'Opções de Disco' },
  
  // Add-ons (ID 6)
  ADDONS: { category: 'Add-ons', section: 'Add-ons' },
  
  // SQL Server (ID 7)
  SQL_SERVER: { category: 'SQL Server', section: 'SQL Server' },
  
  // Storage (IDs 8, 9)
  STORAGE_SAS: { category: 'Storage', section: 'Storage SAS' },
  STORAGE_NVME: { category: 'Storage', section: 'SSD NVMe' },
  
  // Kubernetes (IDs 10, 11)
  KUBERNETES_PLANS: { category: 'Kubernetes', section: 'Preços Base dos Planos' },
  KUBERNETES_ADDONS: { category: 'Kubernetes', section: 'Add-ons Kubernetes' },
  
  // Backup pricing by retention (ID 15 - 7/15/30 days)
  BACKUP: { category: 'Backup', section: 'Backup por Retenção' },
  
  // Serviços Especializados (ID 16)
  SPECIALIZED_SERVICES: { category: 'Add-ons', section: 'Serviços Especializados' },
  
  // Windows Server (ID 17) - Note: Also duplicated in ADDONS (ID 6) for compatibility
  WINDOWS_SERVER: { category: 'Add-ons', section: 'Windows Server' },
} as const;

export type ConfigMappingKey = keyof typeof CONFIG_MAPPINGS;

// ============================================================================
// CONFIG ID LOOKUP - Get config_id by category and label (FLAT API)
// ============================================================================

/**
 * Cache for flat config items - NO TTL, must be cleared explicitly
 * This ensures we always have fresh data when making proposals
 */
let cachedFlatItems: CalculatorConfigFlatItem[] | null = null;

/**
 * Load flat config items (direct from API, no caching by default)
 * Set useCache=true to use cached data (useful for multiple lookups in same operation)
 */
export async function loadFlatConfigs(useCache = false): Promise<CalculatorConfigFlatItem[]> {
  if (useCache && cachedFlatItems) {
    return cachedFlatItems;
  }
  
  cachedFlatItems = await getCalculatorConfigsFlat();
  console.log('[calculatorConfigService] Loaded', cachedFlatItems.length, 'flat config items from API');
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
 * Returns the ID from calculator_configs table
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
 * Returns { vcpu, ram, nvme, ip } IDs from calculator_configs
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
 * Searches across all categories with flexible matching
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
 * Get config_id for Backup by retention (7, 15, 30 days)
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
// ADDON CONFIG ID MAP - Map frontend codes to API config_ids
// ============================================================================

/**
 * Mapping of frontend addon codes to their expected API labels
 * UPDATED: Uses EXACT labels from calculator_configs table
 * Labels are matched case-insensitively for robustness
 */
const ADDON_CODE_TO_LABELS: Record<string, string[]> = {
  // Standard Add-ons - EXACT labels from API
  'antivirus': ['Antivirus', 'Antivírus'],
  'firewall': ['Firewall'],
  'tsplus': ['TSplus', 'TS PLUS', 'TS Plus'],
  'cal': ['CAL'],
  'veeam_vm': ['Veeam VM', 'Veeam Backup (VM)'],
  'veeam_agent': ['Veeam Agent', 'Veeam Agent (Workstation)'],
  'winserver': ['WinServer(2vCPU/unid.)', 'WinServer', 'Windows Server'],
  
  // SQL Server editions
  'sql_web': ['WEB (2vCPU)', 'SQL WEB', 'WEB'],
  'sql_std': ['STD (8vCPU)', 'SQL STD', 'STD', 'Standard'],
  'sql_standard': ['STD (8vCPU)', 'SQL STD', 'STD', 'Standard'],
  'sql_enterprise': ['Enterprise', 'SQL Enterprise'],
  
  // Backup plans (by retention days)
  'backup_7': ['Backup 7 dias', '7 dias', '7'],
  'backup_15': ['Backup 15 dias', '15 dias', '15'],
  'backup_30': ['Backup 30 dias', '30 dias', '30'],
  
  // Specialized Services - EXACT labels from API
  'support_basic': ['Suporte Básico', 'Básico'],
  'support_intermediate': ['Suporte Intermediário', 'Intermediário'],
  'support_advanced': ['Suporte Avançado', 'Avançado'],
  'consulting': ['Consultoria Técnica', 'Consultoria'],
  'dba': ['DBA'],
  
  // Independent products
  'storage_sas': ['Storage SAS'],
  'storage_nvme': ['SSD NVMe', 'NVMe'],
  'storage_s3': ['S3 Object Storage', 'S3'],
  'kubernetes': ['Kubernetes'],
  'open_saas': ['OPEN SaaS', 'OpenSaaS'],
};

/**
 * Get config_id for an addon by its frontend code
 * Uses the ADDON_CODE_TO_LABELS mapping to find the correct API config_id
 */
export async function getAddonConfigIdByCode(code: string): Promise<number | null> {
  const items = await loadFlatConfigs(true);
  const labels = ADDON_CODE_TO_LABELS[code];
  
  if (!labels || labels.length === 0) {
    console.warn(`[calculatorConfigService] No label mapping for addon code: ${code}`);
    return null;
  }
  
  // Try each label until we find a match
  for (const label of labels) {
    const labelLower = label.toLowerCase().trim();
    
    // Try exact match first
    let item = items.find(i => 
      i.label.toLowerCase().trim() === labelLower
    );
    
    // Try partial match
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
 * Returns a map of addon codes to their config_ids
 * 
 * IMPORTANT: This function MUST map every addon used in the calculator
 * to its correct config_id from the API
 */
export async function buildAddonConfigIdMap(): Promise<Record<string, number>> {
  const items = await loadFlatConfigs(false); // Force fresh load
  const map: Record<string, number> = {};
  const missingCodes: string[] = [];
  
  console.log('[calculatorConfigService] Building addon config ID map from', items.length, 'items');
  console.log('[calculatorConfigService] Available API labels:', items.map(i => `${i.id}:${i.label}`).join(', '));
  
  for (const [code, labels] of Object.entries(ADDON_CODE_TO_LABELS)) {
    let found = false;
    
    for (const label of labels) {
      const labelLower = label.toLowerCase().trim();
      
      // Try exact match first (case-insensitive)
      let item = items.find(i => 
        i.label.toLowerCase().trim() === labelLower
      );
      
      // If no exact match, try partial match (API label contains search term)
      if (!item) {
        item = items.find(i => 
          i.label.toLowerCase().includes(labelLower)
        );
      }
      
      // If still no match, try reverse partial match (search term contains API label)
      if (!item) {
        item = items.find(i => 
          labelLower.includes(i.label.toLowerCase().trim())
        );
      }
      
      if (item) {
        map[code] = item.id;
        console.log(`  ✓ [map] ${code} -> ${item.id} (API label: "${item.label}")`);
        found = true;
        break; // Found a match, move to next code
      }
    }
    
    if (!found) {
      missingCodes.push(code);
      console.warn(`  ✗ [map] ${code} -> NOT FOUND (tried labels: ${labels.join(', ')})`);
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
