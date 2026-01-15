// ============================================================================
// CALCULATOR CONFIG SERVICE - CRUD operations for pricing configuration
// ============================================================================

import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://apiv2.opendata.center/api';
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
 * Config item structure for POST/PUT
 * Based on CalculatorConfigStoreRequest schema
 */
export interface ConfigItem {
  label: string;
  by?: string;  // e.g., "unit", "gb", "tb"
  type?: string; // e.g., "BRL", "USD", "PERCENTAGE"
  value?: number;
  price?: number; // Alternative to value (API may use either)
  gb?: number;    // For RAM items
  tb?: number;    // For disk items
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
 */
export async function getCalculatorConfigs(): Promise<CalculatorConfigEntry[]> {
  const response = await apiClient.get<PaginatedConfigResponse>('/calculator/config', {
    params: { __limit: 200 }
  });
  return response.data.data || [];
}

/**
 * Fetch a single config by ID
 */
export async function getCalculatorConfigById(id: number): Promise<CalculatorConfigEntry> {
  const response = await apiClient.get<CalculatorConfigEntry>(`/calculator/config/${id}`);
  return response.data;
}

/**
 * Create a new calculator configuration
 */
export async function createCalculatorConfig(
  payload: CalculatorConfigStoreRequest
): Promise<CalculatorConfigEntry> {
  const response = await apiClient.post<CalculatorConfigEntry>('/calculator/config', payload);
  return response.data;
}

/**
 * Update an existing calculator configuration
 */
export async function updateCalculatorConfig(
  id: number,
  payload: CalculatorConfigUpdateRequest
): Promise<CalculatorConfigEntry> {
  const response = await apiClient.put<CalculatorConfigEntry>(`/calculator/config/${id}`, payload);
  return response.data;
}

/**
 * Delete a calculator configuration (if supported by API)
 */
export async function deleteCalculatorConfig(id: number): Promise<void> {
  await apiClient.delete(`/calculator/config/${id}`);
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

/**
 * Standard category/section mappings used by the pricing configuration
 */
export const CONFIG_MAPPINGS = {
  // General settings
  GERAL_CONFIG: { category: 'Geral', section: 'Configurações Gerais' },
  GERAL_DESCONTO: { category: 'Geral', section: 'Descontos por Prazo' },
  
  // VM prices
  VM_PRICES: { category: 'VM', section: 'Preços de VM' },
  
  // GPU prices
  GPU_PRICES: { category: 'GPU', section: 'Preços de GPU' },
  
  // BareMetal
  BAREMETAL_CPU: { category: 'BareMetal', section: 'Modelos de CPU' },
  BAREMETAL_RAM: { category: 'BareMetal', section: 'Tiers de RAM' },
  BAREMETAL_DISK: { category: 'BareMetal', section: 'Discos' },
  
  // Add-ons
  ADDONS: { category: 'Add-ons', section: 'Preços de Add-ons' },
  
  // SQL Server (part of add-ons)
  SQL_SERVER: { category: 'SQL Server', section: 'Licenças SQL' },
  
  // Storage
  STORAGE: { category: 'Storage', section: 'Preços de Storage' },
  
  // Kubernetes
  KUBERNETES_PLANS: { category: 'Kubernetes', section: 'Planos Kubernetes' },
  KUBERNETES_ADDONS: { category: 'Kubernetes', section: 'Add-ons Kubernetes' },
} as const;

export type ConfigMappingKey = keyof typeof CONFIG_MAPPINGS;
