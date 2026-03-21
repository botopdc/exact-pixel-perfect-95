// ============================================================================
// CALCULATOR CONFIG SERVICE - CRUD operations for pricing configuration
// USES: Supabase Edge Function /pricing-admin
// Phase 5: Supabase JWT first, legacy token fallback
// ============================================================================

import { getAuthTokenSync } from '@/lib/authToken';

// ============================================================================
// CONSTANTS
// ============================================================================

const SUPABASE_URL = import.meta.env.VITE_CORE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_URL_SOURCE = import.meta.env.VITE_CORE_SUPABASE_URL
  ? 'VITE_CORE_SUPABASE_URL'
  : import.meta.env.VITE_SUPABASE_URL
    ? 'VITE_SUPABASE_URL'
    : null;

if (!SUPABASE_URL) {
  console.error('[calculatorConfigService] Configuração Supabase ausente/inválida: VITE_CORE_SUPABASE_URL e VITE_SUPABASE_URL não estão definidas.');
} else if (import.meta.env.DEV) {
  console.log('[calculatorConfigService] Using Supabase URL from', SUPABASE_URL_SOURCE);
}

const ADMIN_PIN_KEY = 'open_admin_pin';
const LEGACY_ADMIN_PIN_KEY = 'OPEN_ADMIN_PIN';

// Default PIN - MUST match the PIN used in Precos.tsx
const DEFAULT_ADMIN_PIN = 'OPEN2026';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Row from Supabase calculator_configs table
 */
export interface CalculatorConfigRow {
  id: number;
  category: string;
  section: string;
  config: ConfigItem[];
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

/**
 * Individual config item within a section
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
 * FLAT config item structure (backwards compatible)
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
 * Legacy grouped entry format
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
 * Get Edge Function URL
 */
function getEdgeFunctionUrl(): string {
  if (!SUPABASE_URL) {
    throw new Error('Configuração Supabase ausente/inválida');
  }

  return `${SUPABASE_URL}/functions/v1/pricing-admin`;
}

/**
 * Get auth token — Supabase JWT first, legacy fallback
 */
function getAuthToken(): string {
  const token = getAuthTokenSync();
  if (!token) {
    throw new Error('Usuário não autenticado. Faça login novamente.');
  }
  return token;
}

/**
 * Get admin PIN from localStorage (or use default for dev)
 */
function getAdminPin(): string {
  const pin = localStorage.getItem(ADMIN_PIN_KEY) || localStorage.getItem(LEGACY_ADMIN_PIN_KEY) || DEFAULT_ADMIN_PIN;
  if (!pin) {
    console.warn('[calculatorConfigService] PIN ausente no localStorage');
  }
  return pin;
}

/**
 * Build headers for Edge Function calls
 */
function buildHeaders(token: string, pin: string): HeadersInit {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'X-Admin-PIN': pin,
  };
}

/**
 * Handle response errors
 */
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ error: 'Unknown error' }));
    const errorMessage = errorBody.error || `HTTP ${response.status}`;
    console.error('[calculatorConfigService] API Error:', errorMessage);
    throw new Error(errorMessage);
  }
  return response.json();
}

/**
 * Convert Supabase row to flat items (for backwards compatibility)
 */
function rowToFlatItems(row: CalculatorConfigRow): CalculatorConfigFlatItem[] {
  const items: CalculatorConfigFlatItem[] = [];
  
  if (!row.config || !Array.isArray(row.config)) {
    return items;
  }
  
  for (const item of row.config) {
    items.push({
      id: item.id ?? row.id,
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
 * Normalize config to array - handles both array and object formats
 * Storage SAS comes as object: { "Brasil": [...], "Estados Unidos": [...] }
 */
function normalizeConfigToItems(config: any): ConfigItem[] {
  // If null/undefined, return empty array
  if (!config) return [];
  
  // If already array, validate and return
  if (Array.isArray(config)) {
    return config.map((item: ConfigItem) => ({
      id: item.id,
      label: item.label,
      value: item.value,
      by: item.by,
      type: item.type,
      description: item.description,
    }));
  }
  
  // If object (e.g., Storage SAS nested format), don't flatten here
  // The UI adapter will handle it separately
  // Return empty array to avoid crash - the raw config is preserved in entry
  if (typeof config === 'object' && config !== null) {
    console.log('[calculatorConfigService] Config is nested object, preserving for UI adapter');
    return [];
  }
  
  console.warn('[calculatorConfigService] Unexpected config format:', typeof config);
  return [];
}

/**
 * Convert Supabase rows to CalculatorConfigEntry format
 * Preserves the raw config data in the entry for UI adapter to process
 */
function rowsToEntries(rows: CalculatorConfigRow[]): CalculatorConfigEntry[] {
  return rows.map(row => {
    // Normalize config items safely
    const configItems = normalizeConfigToItems(row.config);
    
    // For nested object configs (like Storage SAS), we return an extended entry
    // that includes the raw config for the UI adapter
    const entry: any = {
      id: row.id,
      category: row.category,
      section: row.section,
      config: configItems,
      created_at: row.created_at,
      updated_at: row.updated_at,
      deleted_at: row.deleted_at,
    };
    
    // Preserve raw config if it was an object (for Storage SAS handling)
    if (row.config && typeof row.config === 'object' && !Array.isArray(row.config)) {
      entry._rawConfig = row.config;
    }
    
    return entry as CalculatorConfigEntry;
  });
}

// ============================================================================
// CORE API FUNCTIONS - Direct fetch to Edge Function /pricing-admin
// ============================================================================

/**
 * GET /pricing-admin - List all configs
 * Includes guards for missing token/pin
 */
export async function getCalculatorConfigsRaw(
  token?: string,
  pin?: string
): Promise<CalculatorConfigRow[]> {
  // GET does not require auth or PIN — Edge Function accepts GET without them
  // Token and PIN are optional for reads, required only for writes
  const authToken = token || getAuthTokenSync() || '';
  const adminPin = pin || localStorage.getItem(ADMIN_PIN_KEY) || localStorage.getItem(LEGACY_ADMIN_PIN_KEY) || '';
  
  if (import.meta.env.DEV) {
    console.debug('[calculatorConfigService] GET /pricing-admin - token:', !!authToken, 'pin:', !!adminPin);
  }
  
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
  if (adminPin) headers['X-Admin-PIN'] = adminPin;
  
  const response = await fetch(getEdgeFunctionUrl(), {
    method: 'GET',
    headers,
  });
  
  const result = await handleResponse<any>(response);
  
  // Normalize: accept direct array OR { data: array } for backwards compatibility
  const rows: CalculatorConfigRow[] = Array.isArray(result)
    ? result
    : (Array.isArray(result?.data) ? result.data : []);
  
  if (import.meta.env.DEV) {
    console.debug('[calculatorConfigService] Loaded', rows.length, 'rows from Edge Function');
  }
  
  return rows;
}

/**
 * POST /pricing-admin - Upsert by category+section
 */
export async function upsertCalculatorConfig(
  token: string,
  pin: string,
  payload: { category: string; section: string; config: ConfigItem[] }
): Promise<CalculatorConfigRow> {
  const response = await fetch(getEdgeFunctionUrl(), {
    method: 'POST',
    headers: buildHeaders(token, pin),
    body: JSON.stringify(payload),
  });
  
  return handleResponse<CalculatorConfigRow>(response);
}

/**
 * PUT /pricing-admin?id=X - Update by ID
 */
export async function updateCalculatorConfigById(
  token: string,
  pin: string,
  id: number,
  patch: { category?: string; section?: string; config?: ConfigItem[] }
): Promise<CalculatorConfigRow> {
  const url = `${getEdgeFunctionUrl()}?id=${id}`;
  
  const response = await fetch(url, {
    method: 'PUT',
    headers: buildHeaders(token, pin),
    body: JSON.stringify(patch),
  });
  
  return handleResponse<CalculatorConfigRow>(response);
}

/**
 * DELETE /pricing-admin?id=X - Soft delete by ID
 */
export async function softDeleteCalculatorConfig(
  token: string,
  pin: string,
  id: number
): Promise<{ ok: boolean; deleted: CalculatorConfigRow }> {
  const url = `${getEdgeFunctionUrl()}?id=${id}`;
  
  const response = await fetch(url, {
    method: 'DELETE',
    headers: buildHeaders(token, pin),
  });
  
  return handleResponse<{ ok: boolean; deleted: CalculatorConfigRow }>(response);
}

// ============================================================================
// SERVICE FUNCTIONS - Backwards compatible with existing UI
// ============================================================================

/**
 * Fetch all calculator configurations as FLAT items
 */
export async function getCalculatorConfigsFlat(): Promise<CalculatorConfigFlatItem[]> {
  try {
    const rows = await getCalculatorConfigsRaw();
    
    const flatItems: CalculatorConfigFlatItem[] = [];
    for (const row of rows) {
      flatItems.push(...rowToFlatItems(row));
    }
    
    if (import.meta.env.DEV) {
      console.debug('[calculatorConfigService] Loaded', flatItems.length, 'flat config items');
    }
    return flatItems;
  } catch (error) {
    console.error('[calculatorConfigService] Error fetching configs:', error);
    throw error;
  }
}

/**
 * Fetch all calculator configurations grouped by category/section
 */
export async function getCalculatorConfigs(): Promise<CalculatorConfigEntry[]> {
  try {
    const rows = await getCalculatorConfigsRaw();
    const entries = rowsToEntries(rows);
    
    if (import.meta.env.DEV) {
      console.debug('[calculatorConfigService] Converted', entries.length, 'entries');
    }
    return entries;
  } catch (error) {
    console.error('[calculatorConfigService] Error fetching configs:', error);
    throw error;
  }
}

/**
 * Fetch a single config by ID
 */
export async function getCalculatorConfigById(id: number): Promise<CalculatorConfigFlatItem> {
  try {
    const rows = await getCalculatorConfigsRaw();
    
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
 */
export async function updateCalculatorConfigItem(
  id: number,
  payload: CalculatorConfigUpdateRequest
): Promise<CalculatorConfigFlatItem> {
  try {
    const token = getAuthToken();
    const pin = getAdminPin();
    const rows = await getCalculatorConfigsRaw(token, pin);
    
    let targetRow: CalculatorConfigRow | undefined;
    let itemIndex = -1;
    
    for (const row of rows) {
      const idx = (row.config || []).findIndex((item: ConfigItem) => item.id === id);
      if (idx >= 0) {
        targetRow = row;
        itemIndex = idx;
        break;
      }
    }
    
    if (!targetRow || itemIndex < 0) {
      throw new Error(`Config item with ID ${id} not found`);
    }
    
    const updatedConfig = [...(targetRow.config || [])];
    updatedConfig[itemIndex] = {
      ...updatedConfig[itemIndex],
      label: payload.label ?? updatedConfig[itemIndex].label,
      value: payload.value ?? updatedConfig[itemIndex].value,
      by: payload.meta?.by ?? updatedConfig[itemIndex].by,
      type: payload.meta?.type ?? updatedConfig[itemIndex].type,
      description: payload.meta?.description ?? updatedConfig[itemIndex].description,
    };
    
    const category = payload.meta?.category ?? targetRow.category;
    const section = payload.meta?.section ?? targetRow.section;
    
    await upsertCalculatorConfig(token, pin, { category, section, config: updatedConfig });
    
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
 */
export async function createCalculatorConfigItem(
  payload: CalculatorConfigCreateRequest
): Promise<CalculatorConfigFlatItem> {
  try {
    const token = getAuthToken();
    const pin = getAdminPin();
    const { category, section, by, type, description } = payload.meta;
    
    const rows = await getCalculatorConfigsRaw(token, pin);
    const existing = rows.find(r => r.category === category && r.section === section);
    
    const newItem: ConfigItem = {
      id: Date.now(),
      label: payload.label,
      value: payload.value,
      by,
      type,
      description,
    };
    
    const config = existing ? [...(existing.config || []), newItem] : [newItem];
    
    await upsertCalculatorConfig(token, pin, { category, section, config });
    
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
 */
export async function deleteCalculatorConfigItem(id: number): Promise<void> {
  try {
    const token = getAuthToken();
    const pin = getAdminPin();
    const rows = await getCalculatorConfigsRaw(token, pin);
    
    let targetRow: CalculatorConfigRow | undefined;
    
    for (const row of rows) {
      const hasItem = (row.config || []).some((item: ConfigItem) => item.id === id);
      if (hasItem) {
        targetRow = row;
        break;
      }
    }
    
    if (!targetRow) {
      throw new Error(`Config item with ID ${id} not found`);
    }
    
    const updatedConfig = (targetRow.config || []).filter((item: ConfigItem) => item.id !== id);
    
    await upsertCalculatorConfig(token, pin, {
      category: targetRow.category,
      section: targetRow.section,
      config: updatedConfig,
    });
  } catch (error) {
    console.error('[calculatorConfigService] Error deleting config item:', error);
    throw error;
  }
}

/**
 * Update an existing calculator configuration (legacy grouped format)
 */
export async function updateCalculatorConfig(
  entryId: number,
  payload: { category?: string; section?: string; config?: ConfigItem[] }
): Promise<CalculatorConfigEntry> {
  try {
    const token = getAuthToken();
    const pin = getAdminPin();
    const { category, section, config } = payload;
    
    if (!category || !section) {
      throw new Error('category and section are required');
    }
    
    const result = await upsertCalculatorConfig(token, pin, {
      category,
      section,
      config: config || [],
    });
    
    return {
      id: result.id,
      category: result.category,
      section: result.section,
      config: (result.config || []).map((item: ConfigItem) => ({
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
// CATEGORY / SECTION MAPPING
// ============================================================================

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
// CONFIG ID LOOKUP
// ============================================================================

let cachedFlatItems: CalculatorConfigFlatItem[] | null = null;

export async function loadFlatConfigs(useCache = false): Promise<CalculatorConfigFlatItem[]> {
  if (useCache && cachedFlatItems) {
    return cachedFlatItems;
  }
  
  cachedFlatItems = await getCalculatorConfigsFlat();
  console.log('[calculatorConfigService] Loaded', cachedFlatItems.length, 'flat config items');
  return cachedFlatItems;
}

export function clearConfigCache(): void {
  cachedFlatItems = null;
}

export function getCachedFlatItems(): CalculatorConfigFlatItem[] | null {
  return cachedFlatItems;
}

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
  
  return { vcpu, ram, nvme, ip };
}

export async function getAddonConfigId(label: string): Promise<number | null> {
  const items = await loadFlatConfigs(true);
  const labelLower = label.toLowerCase().trim();
  
  let item = items.find(i => 
    i.meta.category.toLowerCase() === 'add-ons' &&
    i.label.toLowerCase().trim() === labelLower
  );
  
  if (!item) {
    item = items.find(i => 
      i.meta.category.toLowerCase() === 'add-ons' &&
      i.label.toLowerCase().includes(labelLower)
    );
  }
  
  if (!item) {
    item = items.find(i => 
      i.label.toLowerCase().includes(labelLower) ||
      labelLower.includes(i.label.toLowerCase())
    );
  }
  
  return item?.id ?? null;
}

export async function getGpuConfigId(model: string): Promise<number | null> {
  const items = await loadFlatConfigs(true);
  const modelLower = model.toLowerCase().trim();
  
  const item = items.find(i => 
    i.meta.category.toLowerCase() === 'gpu' &&
    i.label.toLowerCase().trim() === modelLower
  );
  
  return item?.id ?? null;
}

export async function getSqlConfigId(edition: string): Promise<number | null> {
  const items = await loadFlatConfigs(true);
  const editionLower = edition.toLowerCase().trim();
  
  const item = items.find(i => 
    i.meta.category.toLowerCase() === 'sql server' &&
    i.label.toLowerCase().includes(editionLower)
  );
  
  return item?.id ?? null;
}

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
      return item.id;
    }
  }
  
  console.warn(`[calculatorConfigService] Could not find config_id for addon code: ${code}`);
  return null;
}

export async function buildAddonConfigIdMap(): Promise<Record<string, number>> {
  const items = await loadFlatConfigs(false);
  const map: Record<string, number> = {};
  
  for (const [code, labels] of Object.entries(ADDON_CODE_TO_LABELS)) {
    for (const label of labels) {
      const labelLower = label.toLowerCase().trim();
      
      let item = items.find(i => i.label.toLowerCase().trim() === labelLower);
      
      if (!item) {
        item = items.find(i => i.label.toLowerCase().includes(labelLower));
      }
      
      if (item) {
        map[code] = item.id;
        break;
      }
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
  
  return map;
}
