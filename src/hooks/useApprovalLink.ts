/**
 * useApprovalLink - Hook for generating public approval links
 * 
 * 100% Supabase — no legacy API dependency.
 */

import { useState, useCallback } from 'react';
import { generateOrGetPublicApprovalLink } from '@/services/publicApprovalService';

interface UseApprovalLinkResult {
  getApprovalLink: (proposalId: string) => Promise<string>;
  isLoading: boolean;
  error: string | null;
}

export function useApprovalLink(): UseApprovalLinkResult {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getApprovalLink = useCallback(async (proposalId: string): Promise<string> => {
    setIsLoading(true);
    setError(null);

    try {
      console.log('[useApprovalLink] Generating Supabase approval link for:', proposalId);
      const url = await generateOrGetPublicApprovalLink(proposalId);
      console.log('[useApprovalLink] Generated URL:', url);
      return url;
    } catch (err: any) {
      console.error('[useApprovalLink] Error:', err);
      const msg = err.message || 'Erro ao gerar link de aprovação';
      setError(msg);
      throw new Error(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { getApprovalLink, isLoading, error };
}
