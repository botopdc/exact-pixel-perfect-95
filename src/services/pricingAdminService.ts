// ============================================================================
// PRICING ADMIN SERVICE - Client for Edge Function /pricing-admin
// Uses Supabase Edge Function with SERVICE_ROLE_KEY (server-side only)
// ============================================================================

import { getAuthTokenSync } from '@/lib/authToken';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL) {
  throw new Error('VITE_SUPABASE_URL não está definida.');
}

// ============================================================================
// TYPES
// ============================================================================

/**
 * Config entry as stored in Supabase calculator_configs table
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
 * Payload for creating a new config
 */
export interface CreateConfigPayload {
  category: string;
  section: string;
  config: ConfigItem[];
}

/**
 * Payload for updating an existing config
 */
export interface UpdateConfigPayload {
  category?: string;
  section?: string;
  config?: ConfigItem[];
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get auth token — Supabase JWT first, legacy fallback
 */
function getAuthToken(): string | null {
  return getAuthTokenSync();
}

/**
 * Build Edge Function URL
 */
function getEdgeFunctionUrl(path: string = ''): string {
  return `${SUPABASE_URL}/functions/v1/pricing-admin${path}`;
}

/**
 * Build headers for Edge Function calls
 */
function buildHeaders(adminPin: string): HeadersInit {
  const token = getAuthToken();
  
  if (!token) {
    throw new Error('Usuário não autenticado. Faça login novamente.');
  }
  
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'apikey': SUPABASE_ANON_KEY,
    'x-admin-pin': adminPin,
  };
}

/**
 * Handle response errors
 */
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ error: 'Unknown error' }));
    const errorMessage = errorBody.error || `HTTP ${response.status}`;
    throw new Error(errorMessage);
  }
  return response.json();
}

/**
 * Fetch with timeout using AbortController
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number = 7000
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return response;
  } catch (err) {
    clearTimeout(timeout);
    const error = err as Error;
    if (error.name === 'AbortError') {
      throw new Error('Timeout ao chamar pricing-admin. Tente novamente.');
    }
    throw error;
  }
}

// ============================================================================
// SERVICE FUNCTIONS
// ============================================================================

/**
 * Fetch all calculator configurations from Supabase
 * GET /pricing-admin
 * 
 * @param adminPin - Admin PIN for authorization
 * @param filters - Optional filters (category, section)
 */
export async function getAllConfigs(
  adminPin: string,
  filters?: { category?: string; section?: string }
): Promise<CalculatorConfigRow[]> {
  const url = new URL(getEdgeFunctionUrl());
  
  if (filters?.category) {
    url.searchParams.set('category', filters.category);
  }
  if (filters?.section) {
    url.searchParams.set('section', filters.section);
  }
  
  const response = await fetchWithTimeout(url.toString(), {
    method: 'GET',
    headers: buildHeaders(adminPin),
  });
  
  const data = await handleResponse<CalculatorConfigRow[]>(response);
  return data;
}

/**
 * Create a new calculator configuration
 * POST /pricing-admin
 * 
 * @param adminPin - Admin PIN for authorization
 * @param payload - New config data
 */
export async function createConfig(
  adminPin: string,
  payload: CreateConfigPayload
): Promise<CalculatorConfigRow> {
  const response = await fetchWithTimeout(getEdgeFunctionUrl(), {
    method: 'POST',
    headers: buildHeaders(adminPin),
    body: JSON.stringify(payload),
  });
  
  return handleResponse<CalculatorConfigRow>(response);
}

/**
 * Update an existing calculator configuration
 * PUT /pricing-admin?id=X
 * 
 * @param adminPin - Admin PIN for authorization
 * @param id - Config ID to update
 * @param payload - Updated config data
 */
export async function updateConfig(
  adminPin: string,
  id: number,
  payload: UpdateConfigPayload
): Promise<CalculatorConfigRow> {
  const url = new URL(getEdgeFunctionUrl());
  url.searchParams.set('id', id.toString());
  
  const response = await fetchWithTimeout(url.toString(), {
    method: 'PUT',
    headers: buildHeaders(adminPin),
    body: JSON.stringify(payload),
  });
  
  return handleResponse<CalculatorConfigRow>(response);
}

/**
 * Soft delete a calculator configuration
 * DELETE /pricing-admin?id=X
 * 
 * @param adminPin - Admin PIN for authorization
 * @param id - Config ID to delete
 */
export async function deleteConfig(
  adminPin: string,
  id: number
): Promise<{ success: boolean; message: string }> {
  const url = new URL(getEdgeFunctionUrl());
  url.searchParams.set('id', id.toString());
  
  const response = await fetchWithTimeout(url.toString(), {
    method: 'DELETE',
    headers: buildHeaders(adminPin),
  });
  
  await handleResponse<{ ok: boolean; deleted: CalculatorConfigRow }>(response);
  return { success: true, message: 'Config deleted successfully' };
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Fetch a specific config by category and section
 * Returns null if not found
 */
export async function getConfigByPath(
  adminPin: string,
  category: string,
  section: string
): Promise<CalculatorConfigRow | null> {
  const configs = await getAllConfigs(adminPin, { category, section });
  return configs.length > 0 ? configs[0] : null;
}

/**
 * Upsert a config (create if not exists, update if exists)
 */
export async function upsertConfig(
  adminPin: string,
  category: string,
  section: string,
  config: ConfigItem[]
): Promise<CalculatorConfigRow> {
  // Try to find existing
  const existing = await getConfigByPath(adminPin, category, section);
  
  if (existing) {
    // Update existing
    return updateConfig(adminPin, existing.id, { config });
  } else {
    // Create new
    return createConfig(adminPin, { category, section, config });
  }
}

/**
 * Validate admin PIN format
 */
export function isValidPin(pin: string): boolean {
  return pin.length === 4 && /^\d+$/.test(pin);
}

// ============================================================================
// EXPORT DEFAULT OBJECT FOR CONVENIENCE
// ============================================================================

const pricingAdminService = {
  getAllConfigs,
  createConfig,
  updateConfig,
  deleteConfig,
  getConfigByPath,
  upsertConfig,
  isValidPin,
};

export default pricingAdminService;
