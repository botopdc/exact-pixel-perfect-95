// ============================================================================
// CALCULATOR CONFIG SERVICE - CRUD operations for FLAT pricing configuration
// Nova estrutura: id, label, value, meta (JSON)
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
// TYPES (based on NEW FLAT structure - January 2026)
// ============================================================================

/**
 * Meta object for calculator config items
 */
export interface ConfigMeta {
  category: string;         // VM, BareMetal, GPU, Add-ons, SQL Server, Storage, Backup, Kubernetes, Geral
  section?: string;         // Preços de VM, Modelos de CPU, etc.
  by?: string;              // unit, GB, TB, month, hour
  type?: string;            // BRL, percentage
  region?: string;          // Brasil, Estados Unidos
  retention?: string;       // 7 dias, 15 dias, 30 dias
  min?: number;             // Minimum range value
  max?: number;             // Maximum range value
  description?: string;     // Description (for Kubernetes plans)
}

/**
 * Single flat config item - NEW STRUCTURE
 * Each row is an independent price item
 */
export interface CalculatorConfigItem {
  id: number;               // Unique ID in database (PK, auto-increment)
  label: string;            // Item name/description
  value: number;            // Price/value (DECIMAL 12,4)
  meta: ConfigMeta;         // JSON metadata
  created_at?: string;
  updated_at?: string;
}

/**
 * Paginated response from GET /api/calculator/config
 */
export interface PaginatedConfigResponse {
  current_page: number;
  data: CalculatorConfigItem[];
  from: number;
  last_page: number;
  per_page: number;
  to: number;
  total: number;
}

/**
 * Request payload for POST /api/calculator/config
 */
export interface CalculatorConfigStoreRequest {
  label: string;
  value: number;
  meta: ConfigMeta;
}

/**
 * Request payload for PUT /api/calculator/config/{id}
 */
export interface CalculatorConfigUpdateRequest {
  label?: string;
  value?: number;
  meta?: ConfigMeta;
}

// ============================================================================
// LEGACY TYPES (for backward compatibility during migration)
// ============================================================================

/** @deprecated Use CalculatorConfigItem instead */
export interface ConfigItem {
  id?: number;
  label: string;
  by?: string;
  type?: string;
  value?: number;
  description?: string;
}

/** @deprecated Use CalculatorConfigItem instead */
export interface CalculatorConfigEntry {
  id: number;
  category: string;
  section: string;
  config: ConfigItem[];
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

// ============================================================================
// SERVICE FUNCTIONS (API calls)
// ============================================================================

/**
 * Fetch all calculator configurations from API (FLAT structure)
 * GET /api/calculator/config
 * 
 * @returns Array of flat config items
 */
export async function getCalculatorConfigs(): Promise<CalculatorConfigItem[]> {
  const response = await apiClient.get<PaginatedConfigResponse>('/calculator/config', {
    params: { __perPage: 500 } // Get all items
  });
  return response.data.data || [];
}

/**
 * Fetch configs filtered by category
 * GET /api/calculator/config?meta.category=VM
 */
export async function getConfigsByCategory(category: string): Promise<CalculatorConfigItem[]> {
  const response = await apiClient.get<PaginatedConfigResponse>('/calculator/config', {
    params: { 
      '__perPage': 500,
      'meta.category': category,
    }
  });
  return response.data.data || [];
}

/**
 * Fetch a single config by ID
 * GET /api/calculator/config/{id}
 */
export async function getCalculatorConfigById(id: number): Promise<CalculatorConfigItem> {
  const response = await apiClient.get<CalculatorConfigItem>(`/calculator/config/${id}`);
  return response.data;
}

/**
 * Create a new calculator configuration item
 * POST /api/calculator/config
 */
export async function createCalculatorConfig(
  payload: CalculatorConfigStoreRequest
): Promise<CalculatorConfigItem> {
  const response = await apiClient.post<CalculatorConfigItem>('/calculator/config', payload);
  return response.data;
}

/**
 * Update an existing calculator configuration item
 * PUT /api/calculator/config/{id}
 */
export async function updateCalculatorConfig(
  id: number,
  payload: CalculatorConfigUpdateRequest
): Promise<CalculatorConfigItem> {
  const response = await apiClient.put<CalculatorConfigItem>(`/calculator/config/${id}`, payload);
  return response.data;
}

/**
 * Delete a calculator configuration item
 * DELETE /api/calculator/config/{id}
 */
export async function deleteCalculatorConfig(id: number): Promise<void> {
  await apiClient.delete(`/calculator/config/${id}`);
}

// ============================================================================
// CATEGORY CONSTANTS
// ============================================================================

export const CONFIG_CATEGORIES = {
  VM: 'VM',
  BAREMETAL: 'BareMetal',
  GPU: 'GPU',
  ADDONS: 'Add-ons',
  SQL_SERVER: 'SQL Server',
  STORAGE: 'Storage',
  BACKUP: 'Backup',
  KUBERNETES: 'Kubernetes',
  GERAL: 'Geral',
} as const;

export type ConfigCategory = typeof CONFIG_CATEGORIES[keyof typeof CONFIG_CATEGORIES];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Group flat config items by category
 */
export function groupConfigsByCategory(
  items: CalculatorConfigItem[]
): Record<string, CalculatorConfigItem[]> {
  const grouped: Record<string, CalculatorConfigItem[]> = {};
  
  for (const item of items) {
    const category = item.meta?.category || 'Unknown';
    if (!grouped[category]) {
      grouped[category] = [];
    }
    grouped[category].push(item);
  }
  
  return grouped;
}

/**
 * Group flat config items by category and section
 */
export function groupConfigsByCategoryAndSection(
  items: CalculatorConfigItem[]
): Record<string, Record<string, CalculatorConfigItem[]>> {
  const grouped: Record<string, Record<string, CalculatorConfigItem[]>> = {};
  
  for (const item of items) {
    const category = item.meta?.category || 'Unknown';
    const section = item.meta?.section || 'Default';
    
    if (!grouped[category]) {
      grouped[category] = {};
    }
    if (!grouped[category][section]) {
      grouped[category][section] = [];
    }
    grouped[category][section].push(item);
  }
  
  return grouped;
}

/**
 * Find config item by label in a list
 */
export function findConfigByLabel(
  items: CalculatorConfigItem[],
  label: string
): CalculatorConfigItem | undefined {
  const normalized = label.toLowerCase().trim();
  return items.find(
    item => item.label.toLowerCase().trim() === normalized
  );
}

/**
 * Find config item by label in a category
 */
export function findConfigByLabelInCategory(
  items: CalculatorConfigItem[],
  category: string,
  label: string
): CalculatorConfigItem | undefined {
  const normalized = label.toLowerCase().trim();
  return items.find(
    item => 
      (item.meta?.category || '').toLowerCase() === category.toLowerCase() &&
      item.label.toLowerCase().trim() === normalized
  );
}

// ============================================================================
// LEGACY MAPPINGS (for backward compatibility)
// @deprecated These will be removed in future versions
// ============================================================================

export const CONFIG_MAPPINGS = {
  GERAL_FX: { category: 'Geral', section: 'Taxa de Câmbio' },
  GERAL_DESCONTO: { category: 'Geral', section: 'Descontos por Vigência' },
  GERAL_SAAS: { category: 'Geral', section: 'OPEN SaaS' },
  VM_PRICES: { category: 'VM', section: 'Preços de VM' },
  GPU_PRICES: { category: 'GPU', section: 'Preços de GPU' },
  BAREMETAL_CPU: { category: 'BareMetal', section: 'Modelos de CPU' },
  BAREMETAL_RAM: { category: 'BareMetal', section: 'Opções de RAM' },
  BAREMETAL_DISK: { category: 'BareMetal', section: 'Opções de Disco' },
  ADDONS: { category: 'Add-ons', section: 'Add-ons' },
  SQL_SERVER: { category: 'SQL Server', section: 'SQL Server' },
  STORAGE_SAS: { category: 'Storage', section: 'Storage SAS' },
  STORAGE_NVME: { category: 'Storage', section: 'SSD NVMe' },
  KUBERNETES_PLANS: { category: 'Kubernetes', section: 'Preços Base dos Planos' },
  KUBERNETES_ADDONS: { category: 'Kubernetes', section: 'Add-ons Kubernetes' },
  BACKUP: { category: 'Backup', section: 'Backup por Retenção' },
  SPECIALIZED_SERVICES: { category: 'Add-ons', section: 'Serviços Especializados' },
  WINDOWS_SERVER: { category: 'Add-ons', section: 'Windows Server' },
} as const;

export type ConfigMappingKey = keyof typeof CONFIG_MAPPINGS;

/** @deprecated Use findConfigByLabelInCategory instead */
export function findConfigEntry(
  entries: CalculatorConfigEntry[],
  category: string,
  section: string
): CalculatorConfigEntry | undefined {
  return entries.find(e => e.category === category && e.section === section);
}
