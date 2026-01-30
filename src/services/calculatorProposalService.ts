/**
 * Calculator Proposal Service
 * 
 * Service layer for calculator proposal operations following OpenAPI spec.
 * Includes approval token endpoints for public acceptance flow.
 */

import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://apiv2.opendata.center/api';

// Create a public axios instance (no auth required for approval endpoints)
const publicClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// Types based on OpenAPI spec
export interface ApprovalTokenResponse {
  token: string;
}

/**
 * Payload for define-acceptance endpoint
 * 
 * CRITICAL: Per OpenAPI spec (DefineProposalAcceptanceRequest):
 * - status MUST be "Aprovado" or "Recusado" (NOT "Reprovado")
 */
export interface DefineAcceptancePayload {
  proposal_id: number;       // INTEGER - required
  approval_token: string;    // STRING - required
  status: 'Aprovado' | 'Recusado';  // FIXED: "Recusado" not "Reprovado" per API spec
}

export interface CalculatorProposal {
  id: number;
  uuid?: string;
  name: string;
  company: string;
  phone: string;
  email: string;
  status: string;
  channel_type: 'PARCEIRO' | 'CLIENTE';
  reseller_name?: string | null;
  commission_value?: number | null;
  commission_reason?: string | null;
  observations?: string | null;
  fx: number;
  datacenter: string;
  contract_duration: number;
  discount_pct: number;
  total: number;
  addons?: unknown;
  servers?: unknown;
  dados_proposta?: unknown;
  due_at: string;
  file_path?: string | null;
  file_access_token?: string | null;
  created_by?: number | null;
  creator?: unknown;
  created_at: string;
  updated_at: string;
}

/**
 * Get approval token for a proposal
 * 
 * GET /api/calculator/proposal/{id}/get-approval-token
 * 
 * @param idOrUuid - Proposal ID (numeric) or UUID (string)
 * @returns Approval token for the proposal
 */
export async function getApprovalToken(idOrUuid: string): Promise<ApprovalTokenResponse> {
  console.log('[calculatorProposalService] Getting approval token for:', idOrUuid);
  
  const response = await publicClient.get<ApprovalTokenResponse>(
    `/calculator/proposal/${idOrUuid}/get-approval-token`
  );
  
  console.log('[calculatorProposalService] Got approval token:', response.data.token.substring(0, 8) + '...');
  return response.data;
}

/**
 * Define proposal acceptance (approve or reject)
 * 
 * POST /api/calculator/proposal/define-acceptance
 * 
 * @param payload - Acceptance payload with proposal_id (INTEGER), approval_token, and status
 * @returns void on success
 */
export async function defineAcceptance(payload: DefineAcceptancePayload): Promise<void> {
  console.log('[calculatorProposalService] Defining acceptance:', {
    proposal_id: payload.proposal_id,
    status: payload.status,
    token: payload.approval_token.substring(0, 8) + '...',
  });
  
  // Validate payload before sending
  if (typeof payload.proposal_id !== 'number' || !Number.isInteger(payload.proposal_id)) {
    throw new Error('proposal_id must be an integer');
  }
  
  if (!payload.approval_token || typeof payload.approval_token !== 'string') {
    throw new Error('approval_token is required');
  }
  
  // FIXED: Per OpenAPI spec, status must be "Recusado" not "Reprovado"
  if (payload.status !== 'Aprovado' && payload.status !== 'Recusado') {
    throw new Error('status must be "Aprovado" or "Recusado" (not "Reprovado")');
  }
  
  await publicClient.post('/calculator/proposal/define-acceptance', payload);
  
  console.log('[calculatorProposalService] Acceptance defined successfully');
}

/**
 * Get proposal by ID or UUID (public endpoint for approval page)
 * 
 * GET /api/calculator/proposal/{id}
 * 
 * @param idOrUuid - Proposal ID (numeric) or UUID (string)
 * @returns Proposal data
 */
export async function getProposalPublic(idOrUuid: string): Promise<CalculatorProposal> {
  console.log('[calculatorProposalService] Getting proposal (public):', idOrUuid);
  
  const response = await publicClient.get<CalculatorProposal>(
    `/calculator/proposal/${idOrUuid}`
  );
  
  console.log('[calculatorProposalService] Got proposal:', response.data.id);
  return response.data;
}
