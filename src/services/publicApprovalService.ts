/**
 * Public Approval Service — 100% backend functions
 *
 * - proposal-public: load proposal by public token (no auth)
 * - public-approval: accept/reject decision (no auth)
 * - proposal-public-link: generate/reuse persisted public token (requires CORE token)
 */

import { coreSupabase } from '@/integrations/supabase/coreClient';

// ============================================================================
// CONSTANTS
// ============================================================================

const PRODUCTION_BASE_URL = 'https://core.opendata.center';

function getPublicBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const origin = window.location.origin;

    // Official production domains must always use canonical URL
    if (origin.includes('opendata.center')) {
      return PRODUCTION_BASE_URL;
    }

    // Lovable preview / local dev
    return origin;
  }

  return PRODUCTION_BASE_URL;
}

function getCoreToken(): string | null {
  if (typeof window === 'undefined') return null;

  return (
    localStorage.getItem('open_access_token') ||
    localStorage.getItem('open_api_token') ||
    localStorage.getItem('open_token') ||
    localStorage.getItem('auth_token') ||
    localStorage.getItem('token')
  );
}

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

interface ParsedInvokeError {
  status?: number;
  errorCode?: string;
  message: string;
}

class EdgeInvokeError extends Error {
  status?: number;
  errorCode?: string;

  constructor(parsed: ParsedInvokeError) {
    super(parsed.message);
    this.name = 'EdgeInvokeError';
    this.status = parsed.status;
    this.errorCode = parsed.errorCode;
  }
}

// ============================================================================
// EDGE FUNCTION CALLERS
// ============================================================================

async function parseInvokeError(error: any, fallbackMessage: string): Promise<ParsedInvokeError> {
  const parsed: ParsedInvokeError = {
    message: error?.message || fallbackMessage,
  };

  const response = error?.context as Response | undefined;

  if (response && typeof response.status === 'number') {
    parsed.status = response.status;

    try {
      const body = await response.clone().json();
      if (typeof body?.error === 'string' && body.error.trim()) {
        parsed.message = body.error;
      }
      if (typeof body?.errorCode === 'string' && body.errorCode.trim()) {
        parsed.errorCode = body.errorCode;
      }
    } catch {
      // ignore parse errors, keep fallback message
    }
  }

  return parsed;
}

async function callProposalPublic(body: Record<string, unknown>): Promise<any> {
  const { data, error } = await supabase.functions.invoke('proposal-public', { body });

  if (error) {
    const parsed = await parseInvokeError(error, 'Erro ao carregar proposta');
    console.error('[publicApprovalService] proposal-public error:', parsed);
    throw new EdgeInvokeError(parsed);
  }

  return data;
}

async function callPublicApproval(body: Record<string, unknown>): Promise<any> {
  const { data, error } = await supabase.functions.invoke('public-approval', { body });

  if (error) {
    const parsed = await parseInvokeError(error, 'Erro ao chamar função de aprovação');
    console.error('[publicApprovalService] public-approval error:', parsed);
    throw new EdgeInvokeError(parsed);
  }

  return data;
}

// ============================================================================
// GENERATE / GET APPROVAL LINK (authenticated via CORE token + edge function)
// ============================================================================

/**
 * Generate or retrieve the public approval link for a proposal.
 * Uses backend function with SERVICE_ROLE_KEY to guarantee token persistence.
 */
export async function generateOrGetPublicApprovalLink(proposalId: string): Promise<string> {
  if (!proposalId || proposalId.trim() === '') {
    throw new Error('ID da proposta é obrigatório.');
  }

  const coreToken = getCoreToken();
  if (!coreToken) {
    throw new Error('Sessão expirada. Faça login novamente para gerar o link.');
  }

  const { data, error } = await supabase.functions.invoke('proposal-public-link', {
    body: { proposalId: proposalId.trim(), expiresInDays: 30 },
    headers: {
      Authorization: `Bearer ${coreToken}`,
    },
  });

  if (error) {
    const parsed = await parseInvokeError(error, 'Erro ao gerar link de aprovação');
    throw new Error(parsed.message);
  }

  if (!data?.success || !data?.token) {
    throw new Error(data?.error || 'Erro ao gerar link de aprovação');
  }

  return buildPublicUrl(data.token);
}

// ============================================================================
// LOAD PUBLIC PROPOSAL BY TOKEN (via proposal-public edge function)
// ============================================================================

export async function loadPublicProposalByToken(token: string): Promise<{
  proposal?: PublicProposal;
  pdfSignedUrl?: string | null;
  error?: LoadError;
  message?: string;
}> {
  if (!token || token.trim() === '') {
    return { error: 'token_missing', message: 'Token de aprovação ausente.' };
  }

  try {
    const result = await callProposalPublic({ token: token.trim() });

    if (!result.proposal) {
      return { error: 'proposal_not_found', message: 'Proposta não encontrada.' };
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

    return { proposal: publicProposal, pdfSignedUrl: result.pdfSignedUrl };
  } catch (err: any) {
    if (err instanceof EdgeInvokeError) {
      return {
        error: mapEdgeErrorToLoadError(err),
        message: err.message,
      };
    }

    console.error('[publicApprovalService] Load error:', err);
    return { error: 'unknown', message: err.message || 'Erro interno ao carregar a proposta.' };
  }
}

// ============================================================================
// ACCEPT / REJECT (via public-approval edge function)
// ============================================================================

export async function recordApprovalDecision(
  token: string,
  decision: ApprovalDecision,
  meta?: { name?: string; email?: string; notes?: string }
): Promise<ApprovalResult> {
  try {
    const result = await callPublicApproval({
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
    if (err instanceof EdgeInvokeError) {
      return { success: false, error: err.message };
    }

    console.error('[publicApprovalService] Decision error:', err);
    return { success: false, error: err.message || 'Erro ao registrar decisão.' };
  }
}

// ============================================================================
// PDF — returned by proposal-public load
// ============================================================================

export async function getPublicPdfSignedUrl(pdfPath: string): Promise<string | null> {
  if (!pdfPath) return null;
  console.warn('[publicApprovalService] getPublicPdfSignedUrl called directly — use loadPublicProposalByToken instead');
  return null;
}

// ============================================================================
// HELPERS
// ============================================================================

function buildPublicUrl(token: string): string {
  const baseUrl = getPublicBaseUrl();
  return `${baseUrl}/proposta/aprovacao/${token}`;
}

function mapEdgeErrorToLoadError(error: EdgeInvokeError): LoadError {
  if (error.errorCode) {
    if (error.errorCode === 'token_missing') return 'token_missing';
    if (error.errorCode === 'token_invalid') return 'token_invalid';
    if (error.errorCode === 'token_disabled') return 'token_disabled';
    if (error.errorCode === 'token_expired') return 'token_expired';
    if (error.errorCode === 'already_approved') return 'already_approved';
    if (error.errorCode === 'already_rejected') return 'already_rejected';
  }

  if (error.status === 404) return 'proposal_not_found';
  if (error.status === 410) return 'token_expired';
  if (error.status === 403) return 'token_disabled';
  if (error.status === 400) return 'token_missing';

  const lower = (error.message || '').toLowerCase();
  if (lower.includes('not found')) return 'proposal_not_found';
  if (lower.includes('expired')) return 'token_expired';
  if (lower.includes('disabled')) return 'token_disabled';
  if (lower.includes('missing')) return 'token_missing';

  return 'unknown';
}
