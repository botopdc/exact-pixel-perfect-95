/**
 * Public Approval Service — 100% Supabase
 * 
 * Handles:
 * - Token generation and persistence
 * - Public proposal loading by token
 * - Accept/Reject decisions
 * - PDF signed URL for public access
 * 
 * ZERO dependency on legacy API.
 */

import { supabase } from '@/integrations/supabase/client';

// ============================================================================
// TYPES
// ============================================================================

export interface PublicProposal {
  id: string;
  display_id: string | null;
  name: string;
  company: string;
  email: string;
  phone: string;
  datacenter: string;
  contract_duration: number;
  discount_pct: number;
  total: number;
  currency: string;
  status: string;
  channel_type: string;
  reseller_name: string | null;
  observations: string | null;
  due_at: string;
  created_at: string;
  pdf_path: string | null;
  approval_decision: string | null;
  approved_at: string | null;
  rejected_at: string | null;
  approval_token: string | null;
  approval_token_expires_at: string | null;
  servers: PublicProposalServer[];
  addons: PublicProposalAddon[];
}

export interface PublicProposalServer {
  id: string;
  server_type: string;
  name: string;
  vcpu: number;
  ram_gb: number;
  nvme_tb: number;
  ips: number;
  qty_servers: number;
  gpu: string | null;
  gpu_qty: number;
  bm_cpu: string | null;
  bm_ram: string | null;
  disks: any;
  storage_type: string | null;
  storage_region: string | null;
  volume_tb: number | null;
  unit_price: number;
  total_price: number;
  sort_order: number;
  specs: any;
}

export interface PublicProposalAddon {
  id: string;
  addon_key: string;
  label: string;
  enabled: boolean;
  quantity: number;
  unit_price: number;
  total_price: number;
  sort_order: number;
}

export type ApprovalDecision = 'accepted' | 'rejected';

export interface ApprovalResult {
  success: boolean;
  error?: string;
}

export type LoadError = 
  | 'token_missing'
  | 'token_invalid'
  | 'token_expired'
  | 'already_approved'
  | 'already_rejected'
  | 'unknown';

// ============================================================================
// GENERATE / GET APPROVAL LINK
// ============================================================================

/**
 * Generate or retrieve the public approval link for a proposal.
 * Creates a secure random token if one doesn't exist or is expired.
 */
export async function generateOrGetPublicApprovalLink(proposalId: string): Promise<string> {
  console.log('[publicApprovalService] generateOrGetPublicApprovalLink:', proposalId);

  // Fetch current proposal
  const { data: proposal, error: fetchErr } = await supabase
    .from('calculator_proposals')
    .select('id, approval_token, approval_token_expires_at')
    .eq('id', proposalId)
    .maybeSingle();

  if (fetchErr) throw new Error(`Erro ao buscar proposta: ${fetchErr.message}`);
  if (!proposal) throw new Error(`Proposta não encontrada: ${proposalId}`);

  const now = new Date();
  const existingExpiry = proposal.approval_token_expires_at
    ? new Date(proposal.approval_token_expires_at)
    : null;

  // Reuse existing valid token
  if (proposal.approval_token && existingExpiry && existingExpiry > now) {
    console.log('[publicApprovalService] Reusing existing token:', proposal.approval_token.substring(0, 8) + '...');
    const url = buildPublicUrl(proposal.approval_token);
    console.log('[publicApprovalService] final public approval url:', url);
    return url;
  }

  // Generate new token
  const newToken = crypto.randomUUID();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  console.log('[publicApprovalService] Generating new token:', newToken.substring(0, 8) + '...');

  const { error: updateErr } = await supabase
    .from('calculator_proposals')
    .update({
      approval_token: newToken,
      approval_token_expires_at: expiresAt.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', proposalId);

  if (updateErr) throw new Error(`Erro ao gerar token: ${updateErr.message}`);

  const url = buildPublicUrl(newToken);
  console.log('[publicApprovalService] final public approval url:', url);
  return url;
}

// ============================================================================
// LOAD PUBLIC PROPOSAL BY TOKEN
// ============================================================================

/**
 * Load a proposal using its public approval token.
 * Validates token existence, match, and expiration.
 */
export async function loadPublicProposalByToken(token: string): Promise<{
  proposal?: PublicProposal;
  error?: LoadError;
  message?: string;
}> {
  console.log('[publicApprovalService] approval token from url:', token);

  if (!token || token.trim() === '') {
    return { error: 'token_missing', message: 'Token de aprovação ausente.' };
  }

  // Find proposal by token
  const { data: proposal, error: fetchErr } = await supabase
    .from('calculator_proposals')
    .select('*')
    .eq('approval_token', token.trim())
    .maybeSingle();

  if (fetchErr) {
    console.error('[publicApprovalService] Fetch error:', fetchErr);
    return { error: 'unknown', message: 'Erro ao buscar proposta.' };
  }

  if (!proposal) {
    console.log('[publicApprovalService] No proposal found for token');
    return { error: 'token_invalid', message: 'Token de aprovação inválido.' };
  }

  console.log('[publicApprovalService] public proposal loaded:', proposal.id);
  console.log('[publicApprovalService] proposal status:', proposal.status);
  console.log('[publicApprovalService] proposal pdf path:', proposal.pdf_path);

  // Check expiration
  if (proposal.approval_token_expires_at) {
    const expiresAt = new Date(proposal.approval_token_expires_at);
    if (expiresAt <= new Date()) {
      return { error: 'token_expired', message: 'Este link de aprovação expirou.' };
    }
  }

  // Load servers and addons
  const [serversRes, addonsRes] = await Promise.all([
    supabase
      .from('calculator_proposal_servers')
      .select('*')
      .eq('proposal_id', proposal.id)
      .order('sort_order'),
    supabase
      .from('calculator_proposal_addons')
      .select('*')
      .eq('proposal_id', proposal.id)
      .order('sort_order'),
  ]);

  const servers: PublicProposalServer[] = (serversRes.data || []).map((s: any) => ({
    id: s.id,
    server_type: s.server_type,
    name: s.name,
    vcpu: s.vcpu,
    ram_gb: s.ram_gb,
    nvme_tb: s.nvme_tb,
    ips: s.ips,
    qty_servers: s.qty_servers,
    gpu: s.gpu,
    gpu_qty: s.gpu_qty,
    bm_cpu: s.bm_cpu,
    bm_ram: s.bm_ram,
    disks: s.disks,
    storage_type: s.storage_type,
    storage_region: s.storage_region,
    volume_tb: s.volume_tb,
    unit_price: s.unit_price,
    total_price: s.total_price,
    sort_order: s.sort_order,
    specs: s.specs,
  }));

  const addons: PublicProposalAddon[] = (addonsRes.data || []).map((a: any) => ({
    id: a.id,
    addon_key: a.addon_key,
    label: a.label,
    enabled: a.enabled,
    quantity: a.quantity,
    unit_price: a.unit_price,
    total_price: a.total_price,
    sort_order: a.sort_order,
  }));

  const publicProposal: PublicProposal = {
    id: proposal.id,
    display_id: proposal.display_id,
    name: proposal.name,
    company: proposal.company,
    email: proposal.email,
    phone: proposal.phone,
    datacenter: proposal.datacenter,
    contract_duration: proposal.contract_duration,
    discount_pct: proposal.discount_pct,
    total: proposal.total,
    currency: proposal.currency,
    status: proposal.status,
    channel_type: proposal.channel_type,
    reseller_name: proposal.reseller_name,
    observations: proposal.observations,
    due_at: proposal.due_at,
    created_at: proposal.created_at,
    pdf_path: proposal.pdf_path,
    approval_decision: proposal.approval_decision,
    approved_at: proposal.approved_at,
    rejected_at: proposal.rejected_at,
    approval_token: proposal.approval_token,
    approval_token_expires_at: proposal.approval_token_expires_at,
    servers,
    addons,
  };

  return { proposal: publicProposal };
}

// ============================================================================
// ACCEPT / REJECT
// ============================================================================

/**
 * Record an approval decision on a proposal.
 * Idempotent — rejects duplicate decisions.
 */
export async function recordApprovalDecision(
  proposalId: string,
  decision: ApprovalDecision,
  meta?: { name?: string; email?: string; notes?: string }
): Promise<ApprovalResult> {
  console.log('[publicApprovalService] approval decision:', decision);
  console.log('[publicApprovalService] proposal before update:', proposalId);

  // Fresh check to prevent conflicting decisions
  const { data: fresh, error: fetchErr } = await supabase
    .from('calculator_proposals')
    .select('status, approval_decision')
    .eq('id', proposalId)
    .maybeSingle();

  if (fetchErr || !fresh) {
    return { success: false, error: 'Proposta não encontrada.' };
  }

  // Check existing decision
  const currentDecision = fresh.approval_decision;
  const currentStatus = (fresh.status || '').toUpperCase();

  if (currentDecision === 'accepted' || currentStatus === 'APROVADO' || currentStatus === 'APPROVED') {
    return { success: false, error: 'Esta proposta já foi aprovada.' };
  }
  if (currentDecision === 'rejected' || currentStatus === 'RECUSADO' || currentStatus === 'REPROVADO' || currentStatus === 'REJECTED') {
    return { success: false, error: 'Esta proposta já foi recusada.' };
  }

  const now = new Date().toISOString();
  const newStatus = decision === 'accepted' ? 'Aprovado' : 'Recusado';

  const updatePayload: Record<string, any> = {
    approval_decision: decision,
    status: newStatus,
    updated_at: now,
  };

  if (decision === 'accepted') {
    updatePayload.approved_at = now;
  } else {
    updatePayload.rejected_at = now;
  }

  if (meta?.name) updatePayload.approved_by_name = meta.name;
  if (meta?.email) updatePayload.approved_by_email = meta.email;
  if (meta?.notes) updatePayload.approval_notes = meta.notes;

  const { error: updateErr } = await supabase
    .from('calculator_proposals')
    .update(updatePayload)
    .eq('id', proposalId);

  if (updateErr) {
    console.error('[publicApprovalService] Update error:', updateErr);
    return { success: false, error: `Erro ao registrar decisão: ${updateErr.message}` };
  }

  console.log('[publicApprovalService] proposal updated after decision:', proposalId, decision);
  return { success: true };
}

// ============================================================================
// PDF SIGNED URL (PUBLIC)
// ============================================================================

/**
 * Get a signed URL for the proposal PDF from Supabase Storage.
 */
export async function getPublicPdfSignedUrl(pdfPath: string): Promise<string | null> {
  if (!pdfPath) return null;

  const { data, error } = await supabase.storage
    .from('proposal-files')
    .createSignedUrl(pdfPath, 60 * 30); // 30 minutes

  if (error || !data?.signedUrl) {
    console.error('[publicApprovalService] PDF signed URL error:', error);
    return null;
  }

  return data.signedUrl;
}

// ============================================================================
// HELPERS
// ============================================================================

function buildPublicUrl(token: string): string {
  const baseUrl = window.location.origin;
  return `${baseUrl}/proposta/aprovacao/${token}`;
}
