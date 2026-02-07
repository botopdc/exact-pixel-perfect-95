/**
 * proposalGateway - Gateway service for proposal operations via Edge Functions
 * 
 * All proposal CRUD operations go through Edge Functions with Service Role.
 * Client sends CORE JWT token for authentication.
 * 
 * IMPORTANT: Never use supabase.from('calculator_*') directly in client code!
 */

import { supabase } from '@/integrations/supabase/client';

// ============================================================================
// TOKEN MANAGEMENT
// ============================================================================

const CORE_TOKEN_KEY = 'open_access_token';

/**
 * Get CORE JWT token from localStorage
 */
export function getCoreToken(): string | null {
  // Primary key
  let token = localStorage.getItem(CORE_TOKEN_KEY);
  
  // Fallback keys (in case CORE uses different storage)
  if (!token) {
    token = localStorage.getItem('open_token') 
      || localStorage.getItem('auth_token')
      || localStorage.getItem('token');
  }
  
  return token;
}

/**
 * Check if user has a valid token stored
 */
export function hasToken(): boolean {
  return !!getCoreToken();
}

// ============================================================================
// TYPES
// ============================================================================

export interface ProposalListParams {
  search?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

export interface ProposalListResult {
  success: boolean;
  proposals: ProposalRow[];
  total: number;
  page: number;
  limit: number;
  error?: string;
}

export interface ProposalRow {
  id: string;
  display_id: string | null;
  name: string;
  company: string;
  email: string;
  phone: string;
  status: string;
  total: number;
  datacenter: string;
  channel_type: string;
  created_at: string;
  updated_at: string;
}

export interface ProposalFull {
  id: string;
  display_id: string | null;
  name: string;
  company: string;
  email: string;
  phone: string;
  status: string;
  channel_type: string;
  reseller_name: string | null;
  commission_value: number | null;
  commission_reason: string | null;
  observations: string | null;
  fx: number;
  datacenter: string;
  contract_duration: number;
  discount_pct: number;
  total: number;
  due_at: string;
  currency: string;
  pdf_path: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProposalServer {
  id?: string;
  proposal_id?: string;
  server_type: string;
  name: string;
  gpu: string | null;
  gpu_qty: number;
  vcpu: number;
  ram_gb: number;
  nvme_tb: number;
  traffic_tb: number;
  ips: number;
  qty_servers: number;
  bm_cpu: string | null;
  bm_ram: string | null;
  disks: unknown | null;
  storage_type: string | null;
  storage_region: string | null;
  volume_tb: number | null;
  unit_price: number;
  total_price: number;
  sort_order: number;
  specs: unknown | null;
}

export interface ProposalAddon {
  id?: string;
  proposal_id?: string;
  addon_key: string;
  label: string;
  enabled: boolean;
  quantity: number;
  unit_price: number;
  total_price: number;
  sort_order: number;
  metadata: unknown | null;
}

export interface ProposalGetResult {
  success: boolean;
  proposal: ProposalFull;
  servers: ProposalServer[];
  addons: ProposalAddon[];
  error?: string;
}

export interface ProposalSavePayload {
  proposal: Partial<ProposalFull>;
  servers: Partial<ProposalServer>[];
  addons: Partial<ProposalAddon>[];
}

export interface ProposalSaveResult {
  success: boolean;
  proposalId: string;
  message?: string;
  error?: string;
}

export interface ProposalDeleteResult {
  success: boolean;
  message?: string;
  error?: string;
}

// ============================================================================
// INTERNAL HELPER
// ============================================================================

async function invokeFunction<T>(
  functionName: string,
  body: unknown,
  logPrefix: string
): Promise<T> {
  const token = getCoreToken();
  
  console.log(`[${logPrefix}] Calling ${functionName}`, body);

  if (!token) {
    console.error(`[${logPrefix}] No CORE token found`);
    throw new Error('Não autenticado. Faça login no CORE.');
  }

  const { data, error } = await supabase.functions.invoke(functionName, {
    body,
    headers: { Authorization: `Bearer ${token}` },
  });

  if (error) {
    console.error(`[${logPrefix}] Error:`, error);
    throw new Error(error.message || 'Erro ao chamar Edge Function');
  }

  if (data && !data.success && data.error) {
    console.error(`[${logPrefix}] API Error:`, data.error);
    throw new Error(data.error);
  }

  console.log(`[${logPrefix}] Result:`, data);
  return data as T;
}

// ============================================================================
// PUBLIC API
// ============================================================================

export const proposalGateway = {
  /**
   * List proposals with optional filters
   */
  async listProposals(params: ProposalListParams = {}): Promise<ProposalListResult> {
    try {
      return await invokeFunction<ProposalListResult>(
        'proposal-list',
        params,
        'proposalGateway.list'
      );
    } catch (err) {
      return {
        success: false,
        proposals: [],
        total: 0,
        page: 1,
        limit: params.limit || 15,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },

  /**
   * Get a single proposal with servers and addons
   */
  async getProposalWithItems(proposalId: string): Promise<ProposalGetResult> {
    try {
      return await invokeFunction<ProposalGetResult>(
        'proposal-get',
        { proposalId },
        'proposalGateway.get'
      );
    } catch (err) {
      return {
        success: false,
        proposal: {} as ProposalFull,
        servers: [],
        addons: [],
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },

  /**
   * Save (create or update) a proposal with servers and addons
   */
  async saveProposal(payload: ProposalSavePayload): Promise<ProposalSaveResult> {
    try {
      return await invokeFunction<ProposalSaveResult>(
        'proposal-save',
        payload,
        'proposalGateway.save'
      );
    } catch (err) {
      return {
        success: false,
        proposalId: '',
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },

  /**
   * Delete a proposal (and its servers/addons)
   */
  async deleteProposal(proposalId: string): Promise<ProposalDeleteResult> {
    try {
      return await invokeFunction<ProposalDeleteResult>(
        'proposal-delete',
        { proposalId },
        'proposalGateway.delete'
      );
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },
};

// Default export for convenience
export default proposalGateway;
