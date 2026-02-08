/**
 * useApprovalLink - Hook for generating token-based approval links
 * 
 * This hook handles the process of:
 * 1. Detecting if the proposal is Supabase (UUID) or legacy (numeric)
 * 2. For Supabase: Uses supabaseApprovalLinkService (100% Supabase)
 * 3. For legacy: Falls back to approvalLinkService (openApi)
 */

import { useState, useCallback } from 'react';
import { 
  buildApprovalLink, 
  buildApprovalLinkFromId, 
  ApprovalLinkError,
  type BuildApprovalLinkResult 
} from '@/services/approvalLinkService';
import { getOrCreateApprovalLink } from '@/services/supabaseApprovalLinkService';
import { extractNumericId } from '@/lib/proposalIdUtils';

interface UseApprovalLinkResult {
  /**
   * Get approval link for a proposal (using id or uuid)
   * @param proposalIdOrUuid - Proposal ID (numeric) or UUID (string)
   * @returns Full approval URL with token
   */
  getApprovalLink: (proposalIdOrUuid: string | number) => Promise<string>;
  
  /**
   * Get approval link for a proposal object
   * @param proposal - Proposal object with id and/or uuid
   * @returns Full approval URL with token
   */
  getApprovalLinkFromProposal: (proposal: { id?: number | string; uuid?: string }) => Promise<string>;
  
  isLoading: boolean;
  error: string | null;
  debugInfo: ApprovalLinkError['debugInfo'] | null;
}

/**
 * Helper to check if a string is a valid UUID
 */
function isUUID(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export function useApprovalLink(): UseApprovalLinkResult {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<ApprovalLinkError['debugInfo'] | null>(null);

  const getApprovalLink = useCallback(async (proposalIdOrUuid: string | number): Promise<string> => {
    setIsLoading(true);
    setError(null);
    setDebugInfo(null);

    try {
      const idStr = String(proposalIdOrUuid);
      
      // Check if this is a Supabase UUID
      if (isUUID(idStr)) {
        console.log('[useApprovalLink] Detected UUID, using Supabase service:', idStr);
        
        // Use 100% Supabase flow
        const result = await getOrCreateApprovalLink(idStr);
        console.log('[useApprovalLink] Supabase approval link generated successfully');
        return result.link;
      }
      
      // Check if numeric ID can be extracted (legacy flow)
      const numericId = extractNumericId(proposalIdOrUuid);
      
      if (numericId !== null) {
        console.log('[useApprovalLink] Detected numeric ID, using legacy API service:', numericId);
        
        // Use legacy openApi flow
        const result: BuildApprovalLinkResult = await buildApprovalLinkFromId(numericId);
        console.log('[useApprovalLink] Legacy approval link generated successfully');
        return result.link;
      }
      
      // Neither UUID nor numeric - error
      throw new Error(`ID inválido: ${proposalIdOrUuid}. Deve ser UUID ou numérico.`);
      
    } catch (err: any) {
      console.error('[useApprovalLink] Error building approval link:', err);
      
      let errorMessage: string;
      
      if (err instanceof ApprovalLinkError) {
        errorMessage = err.message;
        setDebugInfo(err.debugInfo);
        console.error('[useApprovalLink] Debug info:', err.debugInfo);
      } else {
        errorMessage = err.message || 'Erro ao gerar link de aprovação';
      }
      
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getApprovalLinkFromProposal = useCallback(async (
    proposal: { id?: number | string; uuid?: string }
  ): Promise<string> => {
    setIsLoading(true);
    setError(null);
    setDebugInfo(null);

    try {
      // Prefer UUID if available
      if (proposal.uuid && isUUID(proposal.uuid)) {
        console.log('[useApprovalLink] Using proposal.uuid (Supabase):', proposal.uuid);
        const result = await getOrCreateApprovalLink(proposal.uuid);
        return result.link;
      }
      
      // Check if id is a UUID
      const idStr = proposal.id !== undefined ? String(proposal.id) : '';
      if (isUUID(idStr)) {
        console.log('[useApprovalLink] proposal.id is UUID (Supabase):', idStr);
        const result = await getOrCreateApprovalLink(idStr);
        return result.link;
      }
      
      // Legacy: Use buildApprovalLink which handles numeric ID
      console.log('[useApprovalLink] Using legacy API flow for proposal:', {
        id: proposal.id,
        uuid: proposal.uuid,
      });
      
      const result: BuildApprovalLinkResult = await buildApprovalLink({ proposal });
      console.log('[useApprovalLink] Generated approval link successfully');
      return result.link;
      
    } catch (err: any) {
      console.error('[useApprovalLink] Error building approval link:', err);
      
      let errorMessage: string;
      
      if (err instanceof ApprovalLinkError) {
        errorMessage = err.message;
        setDebugInfo(err.debugInfo);
        console.error('[useApprovalLink] Debug info:', err.debugInfo);
      } else {
        errorMessage = err.message || 'Erro ao gerar link de aprovação';
      }
      
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    getApprovalLink,
    getApprovalLinkFromProposal,
    isLoading,
    error,
    debugInfo,
  };
}
