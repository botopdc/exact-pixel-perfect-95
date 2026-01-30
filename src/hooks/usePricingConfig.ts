// ============================================================================
// HOOK: usePricingConfig - Manage flat pricing config items from API
// ============================================================================

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { CONFIG_QUERY_KEY } from '@/hooks/useConfig';
import {
  getCalculatorConfigs,
  createCalculatorConfig,
  updateCalculatorConfig,
  deleteCalculatorConfig,
  CalculatorConfigItem,
  groupConfigsByCategoryAndSection,
  CalculatorConfigStoreRequest,
} from '@/services/calculatorConfigService';

// ============================================================================
// TYPES
// ============================================================================

interface PendingChange {
  type: 'create' | 'update' | 'delete';
  item: CalculatorConfigItem | Omit<CalculatorConfigItem, 'id'>;
  originalId?: number;
}

// ============================================================================
// HOOK
// ============================================================================

export function usePricingConfig() {
  const queryClient = useQueryClient();

  // State
  const [items, setItems] = useState<CalculatorConfigItem[]>([]);
  const [localItems, setLocalItems] = useState<CalculatorConfigItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingChanges, setPendingChanges] = useState<Map<number | string, PendingChange>>(new Map());

  const hasInitializedRef = useRef(false);
  const tempIdCounterRef = useRef(-1);

  // Check if there are pending changes
  const isDirty = pendingChanges.size > 0;

  // Fetch items from API
  const fetchItems = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await getCalculatorConfigs();
      setItems(data);
      if (!hasInitializedRef.current || pendingChanges.size === 0) {
        setLocalItems(data);
        hasInitializedRef.current = true;
      }
      console.log('[PricingConfig] Fetched', data.length, 'items from API');
    } catch (err: any) {
      console.error('[PricingConfig] Fetch failed:', err);
      setError(err?.message || 'Erro ao carregar configurações');
      toast({
        title: 'Erro ao carregar preços',
        description: 'Não foi possível buscar as configurações da API.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [pendingChanges.size]);

  // Initial fetch
  useEffect(() => {
    fetchItems();
  }, []);

  // Group items by category and section
  const groupedItems = useMemo(() => {
    return groupConfigsByCategoryAndSection(localItems);
  }, [localItems]);

  // Get items by category
  const getItemsByCategory = useCallback((category: string): CalculatorConfigItem[] => {
    return localItems.filter(
      item => (item.meta?.category || '').toLowerCase() === category.toLowerCase()
    );
  }, [localItems]);

  // Get items by category and section
  const getItemsByCategoryAndSection = useCallback(
    (category: string, section: string): CalculatorConfigItem[] => {
      return localItems.filter(
        item =>
          (item.meta?.category || '').toLowerCase() === category.toLowerCase() &&
          (item.meta?.section || '').toLowerCase() === section.toLowerCase()
      );
    },
    [localItems]
  );

  // Update a single item's value
  const updateItemValue = useCallback((itemId: number, newValue: number) => {
    setLocalItems(prev => {
      const updated = prev.map(item =>
        item.id === itemId ? { ...item, value: newValue } : item
      );
      return updated;
    });

    // Track change
    setPendingChanges(prev => {
      const updated = new Map(prev);
      const existingChange = updated.get(itemId);
      const currentItem = localItems.find(i => i.id === itemId);

      if (currentItem) {
        updated.set(itemId, {
          type: existingChange?.type === 'create' ? 'create' : 'update',
          item: { ...currentItem, value: newValue },
          originalId: itemId,
        });
      }
      return updated;
    });
  }, [localItems]);

  // Add a new item
  const addItem = useCallback((newItem: Omit<CalculatorConfigItem, 'id'>) => {
    const tempId = tempIdCounterRef.current--;
    const itemWithTempId = { ...newItem, id: tempId } as CalculatorConfigItem;

    setLocalItems(prev => [...prev, itemWithTempId]);

    setPendingChanges(prev => {
      const updated = new Map(prev);
      updated.set(tempId, {
        type: 'create',
        item: newItem,
      });
      return updated;
    });

    return tempId;
  }, []);

  // Remove an item
  const removeItem = useCallback((itemId: number) => {
    setLocalItems(prev => prev.filter(item => item.id !== itemId));

    setPendingChanges(prev => {
      const updated = new Map(prev);
      const existingChange = updated.get(itemId);

      // If it was a pending create, just remove the pending change
      if (existingChange?.type === 'create') {
        updated.delete(itemId);
      } else if (itemId > 0) {
        // Only delete items that exist in the API (positive IDs)
        updated.set(itemId, {
          type: 'delete',
          item: { id: itemId } as CalculatorConfigItem,
          originalId: itemId,
        });
      }
      return updated;
    });
  }, []);

  // Save all pending changes to API
  const saveChanges = useCallback(async (): Promise<boolean> => {
    if (pendingChanges.size === 0) {
      toast({
        title: 'Nenhuma alteração',
        description: 'Não há mudanças pendentes para salvar.',
      });
      return true;
    }

    setIsSaving(true);
    setError(null);

    let successCount = 0;
    let failCount = 0;

    try {
      const changes = Array.from(pendingChanges.values());
      console.log('[PricingConfig] Saving', changes.length, 'changes');

      for (const change of changes) {
        try {
          if (change.type === 'create') {
            const payload: CalculatorConfigStoreRequest = {
              label: (change.item as CalculatorConfigItem).label,
              value: (change.item as CalculatorConfigItem).value,
              meta: (change.item as CalculatorConfigItem).meta,
            };
            await createCalculatorConfig(payload);
            successCount++;
          } else if (change.type === 'update' && change.originalId) {
            await updateCalculatorConfig(change.originalId, {
              value: (change.item as CalculatorConfigItem).value,
            });
            successCount++;
          } else if (change.type === 'delete' && change.originalId) {
            await deleteCalculatorConfig(change.originalId);
            successCount++;
          }
        } catch (err: any) {
          console.error('[PricingConfig] Operation failed:', change, err);
          failCount++;
        }
      }

      // Clear pending changes and refresh from API
      setPendingChanges(new Map());
      await fetchItems();
      await queryClient.invalidateQueries({ queryKey: CONFIG_QUERY_KEY });

      if (failCount > 0) {
        toast({
          title: 'Salvo com erros',
          description: `${successCount} salvos, ${failCount} com erro.`,
          variant: 'destructive',
        });
        return false;
      }

      toast({
        title: 'Preços salvos com sucesso',
        description: `${successCount} alteração(ões) aplicada(s).`,
      });
      return true;
    } catch (err: any) {
      console.error('[PricingConfig] Save failed:', err);
      setError(err?.message || 'Erro ao salvar');

      if (err?.response?.status === 401) {
        toast({
          title: 'Sessão expirada',
          description: 'Faça login novamente.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Erro ao salvar preços',
          description: err?.message || 'Erro desconhecido',
          variant: 'destructive',
        });
      }
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [pendingChanges, fetchItems, queryClient]);

  // Reset to API values
  const resetToApi = useCallback(async () => {
    setPendingChanges(new Map());
    await fetchItems();
    await queryClient.invalidateQueries({ queryKey: CONFIG_QUERY_KEY });
    toast({
      title: 'Configuração restaurada',
      description: 'Valores carregados da API.',
    });
  }, [fetchItems, queryClient]);

  // Refresh from API
  const refresh = useCallback(async () => {
    await fetchItems();
  }, [fetchItems]);

  return {
    // State
    items: localItems,
    groupedItems,
    isLoading,
    isSaving,
    isDirty,
    error,

    // Getters
    getItemsByCategory,
    getItemsByCategoryAndSection,

    // Mutations
    updateItemValue,
    addItem,
    removeItem,

    // Actions
    saveChanges,
    resetToApi,
    refresh,
  };
}
