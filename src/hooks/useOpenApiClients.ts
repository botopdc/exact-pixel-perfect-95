// ============================================================================
// USE OPEN API CLIENTS HOOK - Fetch clients (level=1) from OPEN API with cache
// ============================================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { openApi, ApiUser, USER_LEVELS } from '@/lib/openApi';
import { useToast } from '@/hooks/use-toast';

// NO CACHE - Always fetch fresh data from API

export function useOpenApiClients() {
  const [clients, setClients] = useState<ApiUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const mountedRef = useRef(true);

  const fetchAllClients = useCallback(async (): Promise<ApiUser[]> => {
    const allClients: ApiUser[] = [];
    let currentPage = 1;
    let lastPage = 1;
    const perPage = 100;

    try {
      // Fetch all pages
      do {
        const response = await openApi.getUsers({
          level: USER_LEVELS.CLIENTE, // level=1
          __perPage: perPage,
          __page: currentPage,
          __order: 'name:ASC',
        });

        allClients.push(...response.data);
        
        // Update pagination info
        if (response.last_page) {
          lastPage = response.last_page;
        }
        
        currentPage++;
      } while (currentPage <= lastPage);

      return allClients;
    } catch (err) {
      console.error('Erro ao carregar clientes da OPEN API:', err);
      throw err;
    }
  }, []);

  const loadClients = useCallback(async () => {
    if (!mountedRef.current) return;
    
    setLoading(true);
    setError(null);

    try {
      const data = await fetchAllClients();
      if (mountedRef.current) {
        setClients(data);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Falha ao carregar clientes';
      if (mountedRef.current) {
        setError(errorMessage);
        toast({
          title: 'Erro',
          description: 'Falha ao carregar clientes. Tente novamente.',
          variant: 'destructive',
        });
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [fetchAllClients, toast]);

  const refresh = useCallback(() => {
    loadClients();
  }, [loadClients]);

  useEffect(() => {
    mountedRef.current = true;
    loadClients();

    return () => {
      mountedRef.current = false;
    };
  }, [loadClients]);

  return {
    clients,
    loading,
    error,
    refresh,
  };
}
