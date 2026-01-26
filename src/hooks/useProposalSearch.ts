// ============================================================================
// USE PROPOSAL SEARCH - Busca paginada de propostas aprovadas com autocomplete
// ============================================================================

import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { openApi } from '@/lib/openApi';
import { normalizeStatus } from '@/hooks/useProposals';

export interface ProposalSearchResult {
  id: number;
  uuid: string | null;
  company: string;
  name: string;
  email: string;
  total: number;
  status: string;
  normalizedStatus: string;
  contract_duration: number;
  datacenter: string;
  created_at: string;
  due_at: string;
}

interface UseProposalSearchOptions {
  minChars?: number;
  perPage?: number;
  enabled?: boolean;
  onlyApproved?: boolean; // Filtrar apenas propostas aprovadas
}

/**
 * Hook para busca paginada de propostas com autocomplete
 * Usa a OPEN API para buscar propostas com filtros
 */
export function useProposalSearch(options: UseProposalSearchOptions = {}) {
  const { minChars = 3, perPage = 20, enabled = true, onlyApproved = true } = options;
  
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedTerm, setDebouncedTerm] = useState('');
  
  // Debounce da busca
  const updateSearch = useCallback((term: string) => {
    setSearchTerm(term);
    
    // Debounce de 300ms
    const timeoutId = setTimeout(() => {
      setDebouncedTerm(term);
    }, 300);
    
    return () => clearTimeout(timeoutId);
  }, []);

  const shouldSearch = enabled && debouncedTerm.length >= minChars;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['proposal-search', debouncedTerm, perPage, onlyApproved],
    queryFn: async (): Promise<ProposalSearchResult[]> => {
      if (!shouldSearch) return [];
      
      try {
        // Buscar propostas da API com __q para server-side search
        const response = await openApi.getProposals({
          __page: 1,
          __q: debouncedTerm, // Server-side search
          ...(onlyApproved && { status: 'Approved' }), // Server-side status filter
        });
        
        // Mapear resultados (já filtrados pelo servidor)
        const proposals = (response.data || []) as any[];

        // Mapear para o formato de resultado
        const mapped: ProposalSearchResult[] = proposals.map((p) => ({
          id: p.id,
          uuid: p.uuid || null,
          company: p.company || '',
          name: p.name || '',
          email: p.email || '',
          total: p.total || 0,
          status: p.status || '',
          normalizedStatus: normalizeStatus(p.status),
          contract_duration: p.contract_duration || 1,
          datacenter: p.datacenter || '',
          created_at: p.created_at || '',
          due_at: p.due_at || '',
        }));

        return mapped;
      } catch (err) {
        console.error('Erro ao buscar propostas:', err);
        return [];
      }
    },
    enabled: shouldSearch,
    // NO CACHE - Always fetch fresh data from API
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  return {
    searchTerm,
    setSearchTerm: updateSearch,
    results: data || [],
    isLoading: shouldSearch && isLoading,
    error,
    hasMinChars: searchTerm.length >= minChars,
    refetch,
  };
}

/**
 * Hook para buscar uma proposta específica por ID
 */
export function useProposalById(proposalId: number | string | null) {
  return useQuery({
    queryKey: ['proposal-by-id', proposalId],
    queryFn: async () => {
      if (!proposalId) return null;
      
      try {
        const response = await openApi.getProposal(proposalId);
        return response as any;
      } catch (err) {
        console.error('Erro ao buscar proposta:', err);
        return null;
      }
    },
    enabled: !!proposalId,
    // NO CACHE - Always fetch fresh data from API
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });
}
