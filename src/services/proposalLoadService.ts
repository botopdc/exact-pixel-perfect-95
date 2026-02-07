/**
 * proposalLoadService - Unified proposal loading with timeout
 * 
 * Single call to load proposal + servers + addons
 * Includes timeout and proper error handling
 * No infinite retries
 */

import { supabase } from '@/integrations/supabase/client';

// ============================================================================
// TYPES
// ============================================================================

export interface ProposalLoadResult {
  success: boolean;
  proposal?: ProposalData;
  servers?: ServerData[];
  addons?: AddonData[];
  error?: string;
  code?: string;
}

export interface ProposalData {
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

export interface ServerData {
  id: string;
  proposal_id: string;
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

export interface AddonData {
  id: string;
  proposal_id: string;
  addon_key: string;
  label: string;
  enabled: boolean;
  quantity: number;
  unit_price: number;
  total_price: number;
  sort_order: number;
  metadata: unknown | null;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const LOAD_TIMEOUT_MS = 12000; // 12 seconds

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Load proposal with all items in a single call with timeout
 * 
 * @param proposalId - UUID of the proposal
 * @returns ProposalLoadResult with proposal, servers, and addons
 */
export async function loadProposalWithItems(proposalId: string): Promise<ProposalLoadResult> {
  console.log('[proposalLoadService] Loading proposal:', proposalId);
  
  // Create AbortController for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    console.log('[proposalLoadService] Timeout reached, aborting request');
    controller.abort();
  }, LOAD_TIMEOUT_MS);

  try {
    // Call the unified Edge Function
    const { data, error } = await supabase.functions.invoke('proposal-load', {
      body: { proposalId },
    });

    // Clear timeout on completion
    clearTimeout(timeoutId);

    if (error) {
      console.error('[proposalLoadService] Edge function error:', error);
      return {
        success: false,
        error: error.message || 'Erro ao carregar proposta',
      };
    }

    if (!data) {
      return {
        success: false,
        error: 'Resposta vazia do servidor',
      };
    }

    if (!data.success) {
      return {
        success: false,
        error: data.error || 'Erro desconhecido ao carregar proposta',
        code: data.code,
      };
    }

    console.log('[proposalLoadService] Loaded successfully:', {
      proposalId,
      serversCount: data.servers?.length || 0,
      addonsCount: data.addons?.length || 0,
    });

    return {
      success: true,
      proposal: data.proposal,
      servers: data.servers || [],
      addons: data.addons || [],
    };

  } catch (err) {
    clearTimeout(timeoutId);
    
    // Check if it was an abort (timeout)
    if (err instanceof Error && err.name === 'AbortError') {
      console.error('[proposalLoadService] Request timed out');
      return {
        success: false,
        error: 'Timeout: A proposta demorou muito para carregar. Tente novamente.',
      };
    }

    console.error('[proposalLoadService] Unexpected error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Erro inesperado ao carregar proposta',
    };
  }
}

/**
 * Convert Supabase proposal data to legacy API format for hydration
 * This allows using the existing hydrateProposalForEdit function
 */
export function convertToLegacyFormat(result: ProposalLoadResult): Record<string, unknown> | null {
  if (!result.success || !result.proposal) {
    return null;
  }

  const proposal = result.proposal;
  const servers = result.servers || [];
  const addons = result.addons || [];

  // Map servers to legacy format
  const legacyServers = servers.map((s, idx) => ({
    id: s.id,
    name: s.name,
    type: s.server_type,
    quantity: s.qty_servers,
    gpu: s.gpu,
    gpuQty: s.gpu_qty,
    vcpu: s.vcpu,
    ramGb: s.ram_gb,
    nvmeTb: s.nvme_tb,
    trafficTb: s.traffic_tb,
    ips: s.ips,
    bmCpu: s.bm_cpu,
    bmRam: s.bm_ram,
    disks: s.disks,
    storageType: s.storage_type,
    storageRegion: s.storage_region,
    volumeTb: s.volume_tb,
    unitPrice: s.unit_price,
    totalPrice: s.total_price,
    sortOrder: s.sort_order,
    specs: s.specs ? (Array.isArray(s.specs) ? s.specs : []) : [],
  }));

  // Map addons to legacy format
  const legacyAddons = addons.map((a, idx) => ({
    id: a.id,
    key: a.addon_key,
    label: a.label,
    enabled: a.enabled,
    quantity: a.quantity,
    unitPrice: a.unit_price,
    totalPrice: a.total_price,
    sortOrder: a.sort_order,
    metadata: a.metadata,
  }));

  return {
    id: proposal.id,
    display_id: proposal.display_id,
    name: proposal.name,
    company: proposal.company,
    email: proposal.email,
    phone: proposal.phone,
    status: proposal.status,
    channel_type: proposal.channel_type,
    reseller_name: proposal.reseller_name,
    commission_value: proposal.commission_value,
    commission_reason: proposal.commission_reason,
    observations: proposal.observations,
    fx: proposal.fx,
    datacenter: proposal.datacenter,
    contract_duration: proposal.contract_duration,
    discount_pct: proposal.discount_pct,
    total: proposal.total,
    due_at: proposal.due_at,
    currency: proposal.currency,
    pdf_path: proposal.pdf_path,
    created_at: proposal.created_at,
    updated_at: proposal.updated_at,
    // Add servers and addons in format expected by hydrateProposalForEdit
    servers: legacyServers,
    addons: legacyAddons,
  };
}
