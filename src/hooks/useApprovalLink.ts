/**
 * useApprovalLink - Hook for generating token-based approval links
 * 
 * This hook handles the process of:
 * 1. Fetching the approval token from the API
 * 2. Constructing the proper approval link with the token
 * 
 * The token is fetched on-demand (not cached) to ensure freshness.
 */

import { useState, useCallback } from 'react';
import { openApi } from '@/lib/openApi';
import { ROUTES } from '@/config/routes';

interface UseApprovalLinkResult {
  getApprovalLink: (proposalIdOrUuid: string | number) => Promise<string>;
  isLoading: boolean;
  error: string | null;
}

export function useApprovalLink(): UseApprovalLinkResult {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getApprovalLink = useCallback(async (proposalIdOrUuid: string | number): Promise<string> => {
    setIsLoading(true);
    setError(null);

    try {
      console.log('[useApprovalLink] Fetching approval token for:', proposalIdOrUuid);
      
      // Call the API to get the approval token
      const { token } = await openApi.getProposalApprovalToken(proposalIdOrUuid);
      
      console.log('[useApprovalLink] Got approval token:', token.substring(0, 8) + '...');
      
      // Construct the full URL using the centralized route config
      const baseUrl = window.location.origin;
      const relativePath = ROUTES.public.proposalApprove(String(proposalIdOrUuid), token);
      const fullUrl = `${baseUrl}${relativePath}`;
      
      console.log('[useApprovalLink] Generated approval link');
      
      return fullUrl;
    } catch (err: any) {
      console.error('[useApprovalLink] Error getting approval token:', err);
      
      const errorMessage = err.response?.status === 404
        ? 'Proposta não encontrada'
        : err.message || 'Erro ao gerar link de aprovação';
      
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    getApprovalLink,
    isLoading,
    error,
  };
}
