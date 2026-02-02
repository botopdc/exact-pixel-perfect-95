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
