/**
 * Supabase Approval Link Service
 * 
 * Generates and manages approval tokens for Supabase proposals.
 * This is the 100% Supabase-native replacement for openApi-based approval links.
 * 
 * Token lifecycle:
 * - Generated on first request
 * - Expires after 7 days
 * - Reused if still valid
 */

import { coreSupabase } from '@/integrations/supabase/coreClient';
import { ROUTES } from '@/config/routes';

export interface ApprovalLinkResult {
  link: string;
  token: string;
  expiresAt: string;
}

/**
 * Helper to check if a string is a valid UUID
 */
function isUUID(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

/**
 * Get or create an approval link for a Supabase proposal
 * 
 * @param proposalUuid - The UUID of the proposal in Supabase
 * @returns Full approval URL with token
 * @throws Error if proposal not found or update fails
 */
export async function getOrCreateApprovalLink(proposalUuid: string): Promise<ApprovalLinkResult> {
  if (!isUUID(proposalUuid)) {
    throw new Error(`Invalid proposal UUID: ${proposalUuid}`);
  }

  console.log('[APPROVAL LINK SUPABASE] Starting for proposalId:', proposalUuid);

  // Fetch current proposal to check existing token
  const { data: proposal, error: fetchError } = await supabase
    .from('calculator_proposals')
    .select('id, approval_token, approval_token_expires_at')
    .eq('id', proposalUuid)
    .maybeSingle();

  if (fetchError) {
    console.error('[APPROVAL LINK SUPABASE] Fetch error:', fetchError);
    throw new Error(`Erro ao buscar proposta: ${fetchError.message}`);
  }

  if (!proposal) {
    throw new Error(`Proposta não encontrada: ${proposalUuid}`);
  }

  // Check if existing token is still valid (not expired)
  const now = new Date();
  const existingToken = proposal.approval_token;
  const existingExpiry = proposal.approval_token_expires_at 
    ? new Date(proposal.approval_token_expires_at) 
    : null;

  if (existingToken && existingExpiry && existingExpiry > now) {
    // Reuse existing valid token
    console.log('[APPROVAL LINK SUPABASE] Reusing existing token:', {
      proposalId: proposalUuid,
      tokenPrefix: existingToken.substring(0, 8) + '...',
      expiresAt: existingExpiry.toISOString(),
    });

    const link = buildApprovalUrl(proposalUuid, existingToken);
    return {
      link,
      token: existingToken,
      expiresAt: existingExpiry.toISOString(),
    };
  }

  // Generate new token
  const newToken = crypto.randomUUID();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days validity

  console.log('[APPROVAL LINK SUPABASE] Generating new token:', {
    proposalId: proposalUuid,
    tokenPrefix: newToken.substring(0, 8) + '...',
    expiresAt: expiresAt.toISOString(),
  });

  // Update proposal with new token
  const { error: updateError } = await supabase
    .from('calculator_proposals')
    .update({
      approval_token: newToken,
      approval_token_expires_at: expiresAt.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', proposalUuid);

  if (updateError) {
    console.error('[APPROVAL LINK SUPABASE] Update error:', updateError);
    throw new Error(`Erro ao gerar token de aprovação: ${updateError.message}`);
  }

  const link = buildApprovalUrl(proposalUuid, newToken);
  
  console.log('[APPROVAL LINK SUPABASE] Success:', {
    proposalId: proposalUuid,
    tokenPrefix: newToken.substring(0, 8) + '...',
    expiresAt: expiresAt.toISOString(),
  });

  return {
    link,
    token: newToken,
    expiresAt: expiresAt.toISOString(),
  };
}

/**
 * Validate an approval token for a proposal
 * 
 * @param proposalUuid - The UUID of the proposal
 * @param token - The approval token to validate
 * @returns true if token is valid and not expired
 */
export async function validateApprovalToken(proposalUuid: string, token: string): Promise<boolean> {
  if (!isUUID(proposalUuid) || !token) {
    return false;
  }

  const { data: proposal, error } = await supabase
    .from('calculator_proposals')
    .select('approval_token, approval_token_expires_at')
    .eq('id', proposalUuid)
    .maybeSingle();

  if (error || !proposal) {
    console.error('[APPROVAL LINK SUPABASE] Validation fetch error:', error);
    return false;
  }

  // Check token match
  if (proposal.approval_token !== token) {
    console.log('[APPROVAL LINK SUPABASE] Token mismatch');
    return false;
  }

  // Check expiry
  if (proposal.approval_token_expires_at) {
    const expiresAt = new Date(proposal.approval_token_expires_at);
    if (expiresAt <= new Date()) {
      console.log('[APPROVAL LINK SUPABASE] Token expired');
      return false;
    }
  }

  return true;
}

/**
 * Build the full approval URL
 */
function buildApprovalUrl(proposalId: string, token: string): string {
  const baseUrl = window.location.origin;
  const relativePath = ROUTES.public.proposalApprove(proposalId, token);
  return `${baseUrl}${relativePath}`;
}
