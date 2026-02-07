/**
 * Supabase Proposal Service
 * 
 * This service provides CRUD operations for proposals stored in Supabase.
 * It uses the RPC function save_calculator_proposal for transactional saves.
 * 
 * IMPORTANT: This is the SOURCE OF TRUTH for proposals - not the external API.
 */

import { supabase } from '@/integrations/supabase/client';
import type {
  CalculatorProposalRow,
  CalculatorProposalServerRow,
  CalculatorProposalAddonRow,
  CalculatorProposalFileRow,
  CalculatorProposalWithRelations,
  SaveProposalPayload,
  SaveProposalServer,
  SaveProposalAddon,
  ProposalListFilters,
  ProposalListResult,
} from '@/types/calculatorProposal';

// ============================================================================
// LIST PROPOSALS
// ============================================================================

export async function listProposals(filters: ProposalListFilters = {}): Promise<ProposalListResult> {
  const {
    status,
    search,
    channel_type,
    created_by,
    limit = 15,
    offset = 0,
  } = filters;

  let query = supabase
    .from('calculator_proposals')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false });

  // Apply filters
  if (status && status !== 'all') {
    query = query.eq('status', status);
  }
  if (channel_type) {
    query = query.eq('channel_type', channel_type);
  }
  if (created_by) {
    query = query.eq('created_by', created_by);
  }
  if (search) {
    // Search in name, company, email, display_id
    query = query.or(`name.ilike.%${search}%,company.ilike.%${search}%,email.ilike.%${search}%,display_id.ilike.%${search}%`);
  }

  // Pagination
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    console.error('[supabaseProposalService] listProposals error:', error);
    throw new Error(error.message);
  }

  const total = count || 0;
  const page = Math.floor(offset / limit) + 1;

  return {
    proposals: (data || []) as CalculatorProposalRow[],
    total,
    page,
    perPage: limit,
    totalPages: Math.ceil(total / limit),
  };
}

// ============================================================================
// GET SINGLE PROPOSAL WITH RELATIONS
// ============================================================================

export async function getProposal(proposalId: string): Promise<CalculatorProposalWithRelations | null> {
  // Fetch proposal
  const { data: proposal, error: proposalError } = await supabase
    .from('calculator_proposals')
    .select('*')
    .eq('id', proposalId)
    .maybeSingle();

  if (proposalError) {
    console.error('[supabaseProposalService] getProposal error:', proposalError);
    throw new Error(proposalError.message);
  }

  if (!proposal) {
    return null;
  }

  // Fetch servers
  const { data: servers, error: serversError } = await supabase
    .from('calculator_proposal_servers')
    .select('*')
    .eq('proposal_id', proposalId)
    .order('sort_order', { ascending: true });

  if (serversError) {
    console.error('[supabaseProposalService] getProposal servers error:', serversError);
  }

  // Fetch addons
  const { data: addons, error: addonsError } = await supabase
    .from('calculator_proposal_addons')
    .select('*')
    .eq('proposal_id', proposalId)
    .order('sort_order', { ascending: true });

  if (addonsError) {
    console.error('[supabaseProposalService] getProposal addons error:', addonsError);
  }

  // Fetch files
  const { data: files, error: filesError } = await supabase
    .from('calculator_proposal_files')
    .select('*')
    .eq('proposal_id', proposalId)
    .order('created_at', { ascending: false });

  if (filesError) {
    console.error('[supabaseProposalService] getProposal files error:', filesError);
  }

  return {
    ...(proposal as CalculatorProposalRow),
    servers: (servers || []) as CalculatorProposalServerRow[],
    addons: (addons || []) as CalculatorProposalAddonRow[],
    files: (files || []) as CalculatorProposalFileRow[],
  };
}

// ============================================================================
// GET PROPOSAL BY DISPLAY ID
// ============================================================================

export async function getProposalByDisplayId(displayId: string): Promise<CalculatorProposalWithRelations | null> {
  const { data: proposal, error } = await supabase
    .from('calculator_proposals')
    .select('*')
    .eq('display_id', displayId)
    .maybeSingle();

  if (error) {
    console.error('[supabaseProposalService] getProposalByDisplayId error:', error);
    throw new Error(error.message);
  }

  if (!proposal) {
    return null;
  }

  // Fetch relations using the UUID
  return getProposal(proposal.id);
}

// ============================================================================
// SAVE PROPOSAL (CREATE OR UPDATE) - TRANSACTIONAL VIA RPC
// ============================================================================

export async function saveProposal(payload: SaveProposalPayload): Promise<string> {
  console.log('[supabaseProposalService] saveProposal called:', {
    hasId: !!payload.proposal.id,
    serversCount: payload.servers.length,
    addonsCount: payload.addons.length,
  });

  // Normalize servers for RPC
  const normalizedServers = payload.servers.map((server) => ({
    server_type: server.server_type || server.type || 'vm',
    name: server.name || '',
    gpu: server.gpu || null,
    gpu_qty: server.gpu_qty ?? server.gpuQty ?? 0,
    vcpu: server.vcpu ?? 0,
    ram_gb: server.ram_gb ?? server.ramGb ?? 0,
    nvme_tb: server.nvme_tb ?? server.nvmeTb ?? 0,
    traffic_tb: server.traffic_tb ?? server.trafficTb ?? 0,
    ips: server.ips ?? 1,
    qty_servers: server.qty_servers ?? server.qtyServers ?? 1,
    bm_cpu: server.bm_cpu ?? server.bmCpu ?? null,
    bm_ram: server.bm_ram ?? server.bmRam ?? null,
    disks: server.disks ?? null,
    storage_type: server.storage_type ?? server.storageType ?? null,
    storage_region: server.storage_region ?? server.region ?? null,
    volume_tb: server.volume_tb ?? server.volumeTB ?? null,
    unit_price: server.unit_price ?? 0,
    total_price: server.total_price ?? 0,
    specs: server.specs ?? null,
  }));

  // Normalize addons for RPC
  const normalizedAddons = payload.addons.map((addon) => ({
    addon_key: addon.addon_key || addon.key || '',
    label: addon.label || '',
    enabled: addon.enabled ?? false,
    quantity: addon.quantity ?? 0,
    unit_price: addon.unit_price ?? 0,
    total_price: addon.total_price ?? 0,
    metadata: addon.metadata ?? null,
  }));

  const rpcPayload = {
    proposal: payload.proposal,
    servers: normalizedServers,
    addons: normalizedAddons,
  };

  console.log('[supabaseProposalService] Calling RPC with payload:', rpcPayload);

  const { data, error } = await supabase.rpc('save_calculator_proposal', {
    payload: rpcPayload,
  });

  if (error) {
    console.error('[supabaseProposalService] saveProposal RPC error:', error);
    throw new Error(error.message);
  }

  const proposalId = data as string;
  console.log('[supabaseProposalService] saveProposal success, ID:', proposalId);

  return proposalId;
}

// ============================================================================
// DELETE PROPOSAL
// ============================================================================

export async function deleteProposal(proposalId: string): Promise<void> {
  console.log('[supabaseProposalService] deleteProposal:', proposalId);

  const { error } = await supabase
    .from('calculator_proposals')
    .delete()
    .eq('id', proposalId);

  if (error) {
    console.error('[supabaseProposalService] deleteProposal error:', error);
    throw new Error(error.message);
  }

  console.log('[supabaseProposalService] deleteProposal success');
}

// ============================================================================
// UPDATE PROPOSAL STATUS
// ============================================================================

export async function updateProposalStatus(proposalId: string, status: string): Promise<void> {
  console.log('[supabaseProposalService] updateProposalStatus:', { proposalId, status });

  const { error } = await supabase
    .from('calculator_proposals')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', proposalId);

  if (error) {
    console.error('[supabaseProposalService] updateProposalStatus error:', error);
    throw new Error(error.message);
  }
}

// ============================================================================
// UPDATE PDF PATH
// ============================================================================

export async function updatePdfPath(proposalId: string, pdfPath: string): Promise<void> {
  console.log('[supabaseProposalService] updatePdfPath:', { proposalId, pdfPath });

  const { error } = await supabase
    .from('calculator_proposals')
    .update({ pdf_path: pdfPath, updated_at: new Date().toISOString() })
    .eq('id', proposalId);

  if (error) {
    console.error('[supabaseProposalService] updatePdfPath error:', error);
    throw new Error(error.message);
  }
}

// ============================================================================
// ADD FILE RECORD
// ============================================================================

export async function addProposalFile(
  proposalId: string,
  filePath: string,
  fileType: string = 'application/pdf',
  fileName?: string
): Promise<CalculatorProposalFileRow> {
  console.log('[supabaseProposalService] addProposalFile:', { proposalId, filePath });

  const { data, error } = await supabase
    .from('calculator_proposal_files')
    .insert({
      proposal_id: proposalId,
      file_path: filePath,
      file_type: fileType,
      file_name: fileName,
    })
    .select()
    .single();

  if (error) {
    console.error('[supabaseProposalService] addProposalFile error:', error);
    throw new Error(error.message);
  }

  return data as CalculatorProposalFileRow;
}

// ============================================================================
// UPLOAD PDF TO STORAGE
// ============================================================================

export async function uploadPdfToStorage(
  proposalId: string,
  pdfBlob: Blob,
  fileName?: string
): Promise<{ path: string; signedUrl: string }> {
  const timestamp = Date.now();
  const finalFileName = fileName || `proposal_${proposalId}_${timestamp}.pdf`;
  const storagePath = `proposals/${proposalId}/${finalFileName}`;

  console.log('[supabaseProposalService] uploadPdfToStorage:', storagePath);

  // Upload to storage
  const { error: uploadError } = await supabase.storage
    .from('proposal-files')
    .upload(storagePath, pdfBlob, {
      contentType: 'application/pdf',
      upsert: true,
    });

  if (uploadError) {
    console.error('[supabaseProposalService] uploadPdfToStorage error:', uploadError);
    throw new Error(uploadError.message);
  }

  // Generate signed URL (7 days)
  const { data: signedUrlData, error: signedUrlError } = await supabase.storage
    .from('proposal-files')
    .createSignedUrl(storagePath, 60 * 60 * 24 * 7); // 7 days

  if (signedUrlError) {
    console.error('[supabaseProposalService] createSignedUrl error:', signedUrlError);
    throw new Error(signedUrlError.message);
  }

  // Update proposal pdf_path
  await updatePdfPath(proposalId, storagePath);

  // Add file record
  await addProposalFile(proposalId, storagePath, 'application/pdf', finalFileName);

  return {
    path: storagePath,
    signedUrl: signedUrlData.signedUrl,
  };
}

// ============================================================================
// GET SIGNED URL FOR PDF
// ============================================================================

export async function getPdfSignedUrl(storagePath: string, expiresInSeconds: number = 60 * 60 * 24): Promise<string> {
  const { data, error } = await supabase.storage
    .from('proposal-files')
    .createSignedUrl(storagePath, expiresInSeconds);

  if (error) {
    console.error('[supabaseProposalService] getPdfSignedUrl error:', error);
    throw new Error(error.message);
  }

  return data.signedUrl;
}

// ============================================================================
// EXPORT ALL
// ============================================================================

export const supabaseProposalService = {
  listProposals,
  getProposal,
  getProposalByDisplayId,
  saveProposal,
  deleteProposal,
  updateProposalStatus,
  updatePdfPath,
  addProposalFile,
  uploadPdfToStorage,
  getPdfSignedUrl,
};

export default supabaseProposalService;
