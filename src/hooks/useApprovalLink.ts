/**
 * useApprovalLink - Hook for generating token-based approval links
 * 
 * This hook handles the process of:
 * 1. Validating the proposal exists
 * 2. Fetching the approval token from the API with fallback logic
 * 3. Constructing the proper approval link with the token
 * 
 * Uses the centralized approvalLinkService for robust error handling.
 */

import { useState, useCallback } from 'react';
import { 
  buildApprovalLink, 
  buildApprovalLinkFromId, 
  ApprovalLinkError,
  type BuildApprovalLinkResult 
} from '@/services/approvalLinkService';

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

export function useApprovalLink(): UseApprovalLinkResult {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<ApprovalLinkError['debugInfo'] | null>(null);

  const getApprovalLink = useCallback(async (proposalIdOrUuid: string | number): Promise<string> => {
    setIsLoading(true);
    setError(null);
    setDebugInfo(null);

    try {
      console.log('[useApprovalLink] Building approval link for:', proposalIdOrUuid);
      
      const result: BuildApprovalLinkResult = await buildApprovalLinkFromId(proposalIdOrUuid);
      
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

  const getApprovalLinkFromProposal = useCallback(async (
    proposal: { id?: number | string; uuid?: string }
  ): Promise<string> => {
    setIsLoading(true);
    setError(null);
    setDebugInfo(null);

    try {
      console.log('[useApprovalLink] Building approval link from proposal:', {
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
