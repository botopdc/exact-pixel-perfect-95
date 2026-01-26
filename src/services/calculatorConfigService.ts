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
// TYPES (based on API OpenAPI spec)
// ============================================================================

/**
 * Config item structure for GET/PUT requests
 * Based on CalculatorConfig schema from API docs
 * 
 * IMPORTANT (API v12+): Each item now has a unique `id` for identification.
 * When updating, send the item `id` to update by ID.
 * When creating proposals, use `config_id` (entry ID) + `item_id` for pricing.
 */
export interface ConfigItem {
  id?: number;         // Unique ID of the config item (API v12+)
  label: string;
  by?: string;         // e.g., "unit", "GB", "TB", "month", "hour"
  type?: string;       // e.g., "BRL", "USD", "percentage"
  value?: number;
  description?: string; // Used in Kubernetes plans
}

/**
 * API response for a single config entry
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
 * Paginated response from GET /api/calculator/config
 */
export interface PaginatedConfigResponse {
  current_page: number;
  data: CalculatorConfigEntry[];
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
  category: string;
  section: string;
  config: ConfigItem[];
}

/**
 * Request payload for PUT /api/calculator/config/{id}
 */
export interface CalculatorConfigUpdateRequest {
  category?: string;
  section?: string;
  config?: ConfigItem[];
}

// ============================================================================
// SERVICE FUNCTIONS
// ============================================================================

/**
 * Fetch all calculator configurations from API
 * GET /api/calculator/config
 */
export async function getCalculatorConfigs(): Promise<CalculatorConfigEntry[]> {
  const response = await apiClient.get<PaginatedConfigResponse>('/calculator/config', {
    params: { __perPage: 200 }
  });
  return response.data.data || [];
}

/**
 * Fetch a single config by ID
 * GET /api/calculator/config/{id}
 */
export async function getCalculatorConfigById(id: number): Promise<CalculatorConfigEntry> {
  const response = await apiClient.get<CalculatorConfigEntry>(`/calculator/config/${id}`);
  return response.data;
}

/**
 * Update an existing calculator configuration
 * PUT /api/calculator/config/{id}
 * 
 * NOTE: API only supports updating existing configs. 
 * There is NO POST endpoint to create new configs.
 */
export async function updateCalculatorConfig(
  id: number,
  payload: CalculatorConfigUpdateRequest
): Promise<CalculatorConfigEntry> {
  const response = await apiClient.put<CalculatorConfigEntry>(`/calculator/config/${id}`, payload);
  return response.data;
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
  
  // Backup pricing by retention (7/15/30 days)
  BACKUP: { category: 'Backup', section: 'Tabela de Preços' },
} as const;

export type ConfigMappingKey = keyof typeof CONFIG_MAPPINGS;
