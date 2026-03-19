/**
 * proposalApi - Service to interact with proposals via Edge Functions
 * 
 * Phase 5: Uses Supabase JWT as primary auth token, legacy fallback.
 */

import { coreSupabase } from '@/integrations/supabase/coreClient';
import { getAuthTokenSync } from '@/lib/authToken';

// Get best available token (Supabase JWT first, legacy fallback)
function getCoreToken(): string | null {
  return getAuthTokenSync();
}

// ============================================================================
// TYPES
// ============================================================================

export interface ProposalListParams {
  search?: string;
  status?: string;
  clientName?: string;
  companyName?: string;
  dateFrom?: string;
  dateTo?: string;
  sortField?: string;
  sortDirection?: string;
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

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * List proposals with optional filters
 */
export async function listProposals(params: ProposalListParams = {}): Promise<ProposalListResult> {
  const token = getCoreToken();
  
  if (!token) {
    console.warn('[proposalApi.listProposals] No CORE token found');
  }

  const { data, error } = await coreSupabase.functions.invoke('proposal-list', {
    body: params,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (error) {
    console.error('[proposalApi.listProposals] Error:', error);
    return {
      success: false,
      proposals: [],
      total: 0,
      page: 1,
      limit: params.limit || 15,
      error: error.message,
    };
  }

  return data as ProposalListResult;
}

/**
 * Get a single proposal with servers and addons
 */
export async function getProposal(proposalId: string): Promise<ProposalGetResult> {
  const token = getCoreToken();
  
  if (!token) {
    console.warn('[proposalApi.getProposal] No CORE token found');
  }

  const { data, error } = await coreSupabase.functions.invoke('proposal-get', {
    body: { proposalId },
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (error) {
    console.error('[proposalApi.getProposal] Error:', error);
    return {
      success: false,
      proposal: {} as ProposalFull,
      servers: [],
      addons: [],
      error: error.message,
    };
  }

  return data as ProposalGetResult;
}

/**
 * Save (create or update) a proposal with servers and addons
 */
export async function saveProposal(payload: ProposalSavePayload): Promise<ProposalSaveResult> {
  const token = getCoreToken();
  
  if (!token) {
    console.warn('[proposalApi.saveProposal] No CORE token found');
  }

  const { data, error } = await coreSupabase.functions.invoke('proposal-save', {
    body: payload,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (error) {
    console.error('[proposalApi.saveProposal] Error:', error);
    return {
      success: false,
      proposalId: '',
      error: error.message,
    };
  }

  return data as ProposalSaveResult;
}

/**
 * Delete a proposal (and its servers/addons via cascade)
 */
export async function deleteProposal(proposalId: string): Promise<{ success: boolean; error?: string }> {
  const token = getCoreToken();
  
  console.log('[proposalApi.deleteProposal] Deleting:', proposalId);

  // For now, we'll use the save function concept, but we need a delete function
  // TODO: Create proposal-delete edge function
  // For MVP, this is a placeholder
  console.warn('[proposalApi.deleteProposal] Delete not yet implemented via Edge Function');
  
  return {
    success: false,
    error: 'Delete not yet implemented via Edge Function',
  };
}
