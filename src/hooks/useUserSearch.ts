// ============================================================================
// USE USER SEARCH - Busca paginada de usuários com autocomplete
// ============================================================================

import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { openApi } from '@/lib/openApi';

export interface UserSearchResult {
  id: number;
  name: string;
  email: string;
  level: number;
}

interface UseUserSearchOptions {
  minChars?: number;
  perPage?: number;
  enabled?: boolean;
}

/**
 * Hook para busca paginada de usuários com autocomplete
 * Usa a OPEN API para buscar usuários com filtro __q
 */
export function useUserSearch(options: UseUserSearchOptions = {}) {
  const { minChars = 2, perPage = 20, enabled = true } = options;
  
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

  const { data, isLoading, error } = useQuery({
    queryKey: ['user-search', debouncedTerm, perPage],
    queryFn: async (): Promise<UserSearchResult[]> => {
      if (!shouldSearch) return [];
      
      try {
        const response = await openApi.getUsers({
          __q: debouncedTerm,
          __perPage: perPage,
          __page: 1,
        });
        
        return response.data.map((user) => ({
          id: user.id,
          name: user.name,
          email: user.email,
          level: user.level,
        }));
      } catch (err) {
        console.error('Erro ao buscar usuários:', err);
        return [];
      }
    },
    enabled: shouldSearch,
    staleTime: 1000 * 30, // 30 segundos
  });

  return {
    searchTerm,
    setSearchTerm: updateSearch,
    results: data || [],
    isLoading: shouldSearch && isLoading,
    error,
    hasMinChars: searchTerm.length >= minChars,
  };
}

/**
 * Hook simplificado para buscar um usuário específico por ID
 */
export function useUserById(userId: number | null) {
  return useQuery({
    queryKey: ['user-by-id', userId],
    queryFn: async () => {
      if (!userId) return null;
      
      try {
        const response = await openApi.getUsers({
          __q: String(userId),
          __perPage: 1,
        });
        
        const user = response.data.find((u) => u.id === userId);
        if (!user) return null;
        
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          level: user.level,
        };
      } catch (err) {
        console.error('Erro ao buscar usuário:', err);
        return null;
      }
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5, // 5 minutos
  });
}
