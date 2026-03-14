/**
 * Public Approval Service — 100% Supabase via Edge Function
 *
 * All public operations go through the `public-approval` edge function
 * which uses SERVICE_ROLE_KEY to bypass RLS.
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
  public_approval_token?: string | null;
  public_approval_enabled?: boolean;
  public_approval_expires_at?: string | null;
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
  | 'proposal_not_found'
  | 'token_disabled'
  | 'token_expired'
  | 'already_approved'
  | 'already_rejected'
  | 'unknown';

// ============================================================================
// EDGE FUNCTION CALLER
// ============================================================================

const FUNCTION_NAME = 'public-approval';

async function callEdgeFunction(body: Record<string, unknown>): Promise<any> {
  const { data, error } = await supabase.functions.invoke(FUNCTION_NAME, {
    body,
  });

  if (error) {
    console.error('[publicApprovalService] Edge function error:', error);
    throw new Error(error.message || 'Erro ao chamar função de aprovação');
  }

  return data;
}

// ============================================================================
// GENERATE / GET APPROVAL LINK (authenticated — uses direct Supabase)
// ============================================================================

/**
 * Generate or retrieve the public approval link for a proposal.
 * This runs in authenticated context (commercial panel).
 */
export async function generateOrGetPublicApprovalLink(proposalId: string): Promise<string> {
  console.log('generate approval link proposal', proposalId);

  const { data: proposal, error: fetchErr } = await supabase
    .from('calculator_proposals')
    .select('id, public_approval_token, public_approval_enabled, public_approval_expires_at')
    .eq('id', proposalId)
    .maybeSingle();

  if (fetchErr) throw new Error(`Erro ao buscar proposta: ${fetchErr.message}`);
  if (!proposal) throw new Error(`Proposta não encontrada: ${proposalId}`);

  console.log('proposal id', proposal.id);
  console.log('proposal uuid', (proposal as any)?.uuid ?? null);
  console.log('proposal public token', (proposal as any)?.public_approval_token ?? null);

  const now = new Date();
  const existingExpiry = (proposal as any)?.public_approval_expires_at
    ? new Date((proposal as any).public_approval_expires_at)
    : null;

  if (
    (proposal as any)?.public_approval_token &&
    (proposal as any)?.public_approval_enabled &&
    (!existingExpiry || existingExpiry > now)
  ) {
    const reuseUrl = buildPublicUrl((proposal as any).public_approval_token);
    console.log('final public approval url', reuseUrl);
    return reuseUrl;
  }

  const newToken = createPublicApprovalToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  const { error: updateErr } = await supabase
    .from('calculator_proposals')
    .update({
      public_approval_token: newToken,
      public_approval_enabled: true,
      public_approval_expires_at: expiresAt.toISOString(),
      updated_at: new Date().toISOString(),
    } as any)
    .eq('id', proposalId);

  if (updateErr) throw new Error(`Erro ao gerar token: ${updateErr.message}`);

  const approvalUrl = buildPublicUrl(newToken);
  console.log('final public approval url', approvalUrl);
  return approvalUrl;
}

// ============================================================================
// LOAD PUBLIC PROPOSAL BY TOKEN (via edge function — no auth required)
// ============================================================================

export async function loadPublicProposalByToken(token: string): Promise<{
  proposal?: PublicProposal;
  pdfSignedUrl?: string | null;
  error?: LoadError;
  message?: string;
}> {
  console.log('loading public proposal by token', token);

  if (!token || token.trim() === '') {
    return { error: 'token_missing', message: 'Token de aprovação ausente.' };
  }

  try {
    const result = await callEdgeFunction({ action: 'load', token: token.trim() });

    if (!result.success) {
      const errorCode = (result.errorCode || 'unknown') as LoadError;
      return {
        error: errorCode,
        message: result.error || mapLoadErrorToMessage(errorCode),
      };
    }

    const p = result.proposal;
    const publicProposal: PublicProposal = {
      ...p,
      servers: (result.servers || []).map((s: any) => ({
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
      })),
      addons: (result.addons || []).map((a: any) => ({
        id: a.id,
        addon_key: a.addon_key,
        label: a.label,
        enabled: a.enabled,
        quantity: a.quantity,
        unit_price: a.unit_price,
        total_price: a.total_price,
        sort_order: a.sort_order,
      })),
    };

    console.log('proposal found', publicProposal);
    console.log('public approval enabled', publicProposal.public_approval_enabled);
    console.log('public approval token in db', publicProposal.public_approval_token);

    return { proposal: publicProposal, pdfSignedUrl: result.pdfSignedUrl };
  } catch (err: any) {
    console.error('[publicApprovalService] Load error:', err);
    return { error: 'unknown', message: err.message || 'Erro ao carregar proposta.' };
  }
}

// ============================================================================
// ACCEPT / REJECT (via edge function — no auth required)
// ============================================================================

export async function recordApprovalDecision(
  token: string,
  decision: ApprovalDecision,
  meta?: { name?: string; email?: string; notes?: string }
): Promise<ApprovalResult> {
  console.log('approval decision', decision);

  try {
    const result = await callEdgeFunction({
      action: 'decide',
      token,
      decision,
      name: meta?.name,
      email: meta?.email,
      notes: meta?.notes,
    });

    if (!result.success) {
      return { success: false, error: result.error || 'Erro ao registrar decisão.' };
    }

    return { success: true };
  } catch (err: any) {
    console.error('[publicApprovalService] Decision error:', err);
    return { success: false, error: err.message || 'Erro ao registrar decisão.' };
  }
}

// ============================================================================
// PDF SIGNED URL — now returned by edge function load action
// ============================================================================

export async function getPublicPdfSignedUrl(pdfPath: string): Promise<string | null> {
  // This is now handled by the edge function's load action
  // Kept for backward compatibility but shouldn't be called directly
  if (!pdfPath) return null;
  console.warn('[publicApprovalService] getPublicPdfSignedUrl called directly — use loadPublicProposalByToken instead');
  return null;
}

// ============================================================================
// HELPERS
// ============================================================================

function buildPublicUrl(token: string): string {
  const baseUrl = window.location.origin;
  return `${baseUrl}/proposta/aprovacao/${token}`;
}

function createPublicApprovalToken(): string {
  return `pat_${crypto.randomUUID().replace(/-/g, '')}`;
}

function mapLoadErrorToMessage(error: LoadError): string {
  switch (error) {
    case 'token_missing':
      return 'Token de aprovação ausente.';
    case 'token_invalid':
      return 'Token de aprovação inválido.';
    case 'proposal_not_found':
      return 'Proposta não encontrada.';
    case 'token_disabled':
      return 'A aprovação pública desta proposta está desabilitada.';
    case 'token_expired':
      return 'Este link de aprovação expirou.';
    case 'already_approved':
      return 'Esta proposta já foi aprovada.';
    case 'already_rejected':
      return 'Esta proposta já foi recusada.';
    default:
      return 'Erro ao carregar proposta.';
  }
}
