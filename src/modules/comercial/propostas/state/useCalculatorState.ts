/**
 * useCalculatorState - Unified calculator state hook
 * 
 * This hook manages the complete calculator state and provides:
 * - State initialization for new proposals
 * - Hydration from API for edit mode (with timeout, no infinite retry)
 * - Serialization for saving
 * - State update helpers
 * 
 * CRITICAL: In edit mode, all state MUST come from hydrateProposalForEdit()
 * CRITICAL: No infinite loops - single load attempt with manual retry option
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { generateProposalId } from '@/lib/calculatorConfig';
import { loadProposalWithItems, convertToLegacyFormat } from '@/services/proposalLoadService';

import {
  OpenCalculatorState,
  createDefaultCalculatorState,
  ServerItemV2,
  VMItemV2,
  BMItemV2,
  StorageItemV2,
  AddonsStateV2,
  KubernetesStateV2,
  OpenSaaSStateV2,
  ResellerStateV2,
  DEFAULT_ADDONS,
  DEFAULT_KUBERNETES,
  DEFAULT_OPEN_SAAS,
  DEFAULT_RESELLER,
} from './openCalculatorState';

import {
  hydrateProposalForEdit,
  serializeProposal,
  ApiProposalPayload,
} from './proposalMappers';

// ============================================================================
// HOOK RETURN TYPE
// ============================================================================

export interface UseCalculatorStateReturn {
  // Main state
  state: OpenCalculatorState;
  
  // Flags
  isLoading: boolean;
  isEditMode: boolean;
  isHydrated: boolean;
  editError: string | null;
  
  // State setters
  setState: React.Dispatch<React.SetStateAction<OpenCalculatorState>>;
  updateClient: (client: Partial<OpenCalculatorState['client']>) => void;
  updateMeta: (meta: Partial<OpenCalculatorState['meta']>) => void;
  setDatacenter: (dc: OpenCalculatorState['datacenter']) => void;
  setSelectedTerm: (term: OpenCalculatorState['selectedTerm']) => void;
  setItems: (items: ServerItemV2[]) => void;
  setAddons: (addons: AddonsStateV2) => void;
  setKubernetes: (k8s: KubernetesStateV2) => void;
  setStorageItems: (items: StorageItemV2[]) => void;
  setOpenSaas: (saas: OpenSaaSStateV2) => void;
  setReseller: (reseller: ResellerStateV2) => void;
  setPriceOverrides: (overrides: OpenCalculatorState['priceOverrides']) => void;
  setObservacao: (obs: string) => void;
  
  // Item operations
  addVM: () => void;
  addBM: (defaultCpu?: string, defaultRam?: string, defaultDisk?: string) => void;
  addStorage: () => void;
  removeItem: (id: string) => void;
  updateItem: (id: string, updates: Partial<ServerItemV2>) => void;
  removeStorage: (id: string) => void;
  updateStorage: (id: string, updates: Partial<StorageItemV2>) => void;
  
  // Serialization
  getSerializedPayload: (channelType: 'CLIENTE' | 'PARCEIRO', grandTotal: number, discountPct?: number) => ApiProposalPayload;
  
  // Reset and Retry
  resetToNew: () => void;
  retryLoad: () => void;
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

export function useCalculatorState(): UseCalculatorStateReturn {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const { toast } = useToast();
  
  // URL-based edit mode detection
  const urlEditParam = searchParams.get('edit');
  const urlIdParam = searchParams.get('id');
  const isUrlEditMode = urlEditParam === '1' && !!urlIdParam;
  
  // Main state
  const [state, setState] = useState<OpenCalculatorState>(() => {
    const initial = createDefaultCalculatorState();
    initial.meta.proposalDisplayId = generateProposalId();
    return initial;
  });
  
  // Error state
  const [editError, setEditError] = useState<string | null>(null);
  
  // Prevent duplicate hydration
  const hydratedRef = useRef(false);
  
  // ============================================
  // EDIT MODE HYDRATION
  // ============================================
  useEffect(() => {
    if (!isUrlEditMode || !urlIdParam) return;
    if (hydratedRef.current) return;
    
    hydratedRef.current = true;
    
    console.log('[useCalculatorState] EDIT_MODE_DETECTED via URL:', { edit: urlEditParam, id: urlIdParam });
    
    // Set loading state
    setState(prev => ({
      ...prev,
      flags: { ...prev.flags, isLoading: true, isEditMode: true },
    }));
    setEditError(null);
    
    // Check for state from navigation (optimization)
    const editProposalFromState = location.state?.editProposal;
    
    const loadProposalData = async () => {
      try {
        let apiProposal: Record<string, unknown> | null = null;
        
        if (editProposalFromState) {
          console.log('[useCalculatorState] Using proposal from navigation state');
          apiProposal = editProposalFromState;
        } else {
          console.log('[useCalculatorState] Loading proposal via Edge Function:', urlIdParam);
          
          // Use the new unified loading service with timeout
          const result = await loadProposalWithItems(urlIdParam);
          
          if (!result.success) {
            throw new Error(result.error || 'Erro ao carregar proposta');
          }
          
          // Convert to legacy format for hydration
          apiProposal = convertToLegacyFormat(result);
          
          if (!apiProposal) {
            throw new Error('Proposta não encontrada');
          }
        }
        
        // Hydrate state using the centralized function
        const hydratedState = hydrateProposalForEdit(apiProposal);
        
        setState(hydratedState);
        
        // Clear navigation state to prevent re-loading on refresh
        window.history.replaceState({}, document.title);
        
        toast({
          title: 'Proposta carregada',
          description: `Editando proposta ${hydratedState.meta.proposalDisplayId}`,
        });
        
      } catch (error: any) {
        console.error('[useCalculatorState] Error loading proposal:', error);
        const errorMessage = error.message || 'Erro ao carregar proposta';
        setEditError(errorMessage);
        
        // Stop loading - allow manual retry
        setState(prev => ({
          ...prev,
          flags: { ...prev.flags, isLoading: false },
        }));
        
        toast({
          title: 'Erro ao carregar proposta',
          description: errorMessage,
          variant: 'destructive',
        });
      }
    };
    
    // Single load attempt - no automatic retry
    loadProposalData();
  }, [isUrlEditMode, urlIdParam, location.state, toast]);
  
  // ============================================
  // STATE UPDATE HELPERS
  // ============================================
  
  const updateClient = useCallback((updates: Partial<OpenCalculatorState['client']>) => {
    setState(prev => ({
      ...prev,
      client: { ...prev.client, ...updates },
    }));
  }, []);
  
  const updateMeta = useCallback((updates: Partial<OpenCalculatorState['meta']>) => {
    setState(prev => ({
      ...prev,
      meta: { ...prev.meta, ...updates },
    }));
  }, []);
  
  const setDatacenter = useCallback((dc: OpenCalculatorState['datacenter']) => {
    setState(prev => ({ ...prev, datacenter: dc }));
  }, []);
  
  const setSelectedTerm = useCallback((term: OpenCalculatorState['selectedTerm']) => {
    setState(prev => ({ ...prev, selectedTerm: term }));
  }, []);
  
  const setItems = useCallback((items: ServerItemV2[]) => {
    setState(prev => ({ ...prev, items }));
  }, []);
  
  const setAddons = useCallback((addons: AddonsStateV2) => {
    setState(prev => ({ ...prev, addons }));
  }, []);
  
  const setKubernetes = useCallback((k8s: KubernetesStateV2) => {
    setState(prev => ({ ...prev, kubernetes: k8s }));
  }, []);
  
  const setStorageItems = useCallback((items: StorageItemV2[]) => {
    setState(prev => ({ ...prev, storageItems: items }));
  }, []);
  
  const setOpenSaas = useCallback((saas: OpenSaaSStateV2) => {
    setState(prev => ({ ...prev, openSaas: saas }));
  }, []);
  
  const setReseller = useCallback((reseller: ResellerStateV2) => {
    setState(prev => ({ ...prev, reseller }));
  }, []);
  
  const setPriceOverrides = useCallback((overrides: OpenCalculatorState['priceOverrides']) => {
    setState(prev => ({ ...prev, priceOverrides: overrides }));
  }, []);
  
  const setObservacao = useCallback((obs: string) => {
    setState(prev => ({ ...prev, observacao: obs }));
  }, []);
  
  // ============================================
  // ITEM OPERATIONS
  // ============================================
  
  const addVM = useCallback(() => {
    const newItem: VMItemV2 = {
      type: 'vm',
      id: crypto.randomUUID(),
      gpu: 'Sem GPU',
      gpuQty: 0,
      vcpu: 16,
      ramGb: 128,
      nvmeTb: 0.09765625, // 100GB = 100/1024 TB
      trafficTb: 5,
      ips: 1,
      qtyServers: 1,
    };
    setState(prev => ({
      ...prev,
      items: [...prev.items, newItem],
    }));
  }, []);
  
  const addBM = useCallback((
    defaultCpu = 'intel_xeon_e2136',
    defaultRam = 'ram_128gb',
    defaultDisk = 'nvme_1tb'
  ) => {
    const newItem: BMItemV2 = {
      type: 'bm',
      id: crypto.randomUUID(),
      gpu: 'Sem GPU',
      gpuQty: 0,
      bmCpu: defaultCpu,
      bmRam: defaultRam,
      disks: [{ type: defaultDisk, qty: 1, desc: '' }],
      trafficTb: 5,
      ips: 1,
      qtyServers: 1,
    };
    setState(prev => ({
      ...prev,
      items: [...prev.items, newItem],
    }));
  }, []);
  
  const addStorage = useCallback(() => {
    const newItem: StorageItemV2 = {
      id: crypto.randomUUID(),
      storageType: 'sas',
      region: 'BR',
      volumeTB: 1,
    };
    setState(prev => ({
      ...prev,
      storageItems: [...prev.storageItems, newItem],
    }));
  }, []);
  
  const removeItem = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      items: prev.items.filter(item => item.id !== id),
    }));
  }, []);
  
  const updateItem = useCallback((id: string, updates: Partial<ServerItemV2>) => {
    setState(prev => ({
      ...prev,
      items: prev.items.map(item => 
        item.id === id ? { ...item, ...updates } as ServerItemV2 : item
      ),
    }));
  }, []);
  
  const removeStorage = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      storageItems: prev.storageItems.filter(item => item.id !== id),
    }));
  }, []);
  
  const updateStorage = useCallback((id: string, updates: Partial<StorageItemV2>) => {
    setState(prev => ({
      ...prev,
      storageItems: prev.storageItems.map(item =>
        item.id === id ? { ...item, ...updates } : item
      ),
    }));
  }, []);
  
  // ============================================
  // SERIALIZATION
  // ============================================
  
  const getSerializedPayload = useCallback((
    channelType: 'CLIENTE' | 'PARCEIRO',
    grandTotal: number,
    discountPct = 0
  ): ApiProposalPayload => {
    return serializeProposal(state, channelType, grandTotal, discountPct);
  }, [state]);
  
  // ============================================
  // RESET
  // ============================================
  
  const resetToNew = useCallback(() => {
    const newState = createDefaultCalculatorState();
    newState.meta.proposalDisplayId = generateProposalId();
    setState(newState);
    hydratedRef.current = false;
    setEditError(null);
  }, []);
  
  // ============================================
  // RETRY LOAD (for manual retry after error)
  // ============================================
  
  const retryLoad = useCallback(async () => {
    if (!isUrlEditMode || !urlIdParam) {
      console.warn('[useCalculatorState] retryLoad called but not in edit mode');
      return;
    }
    
    console.log('[useCalculatorState] Manual retry triggered for:', urlIdParam);
    
    // Reset hydrated ref to allow re-loading
    hydratedRef.current = false;
    setEditError(null);
    
    // Set loading state
    setState(prev => ({
      ...prev,
      flags: { ...prev.flags, isLoading: true, isEditMode: true },
    }));
    
    try {
      // Use the unified loading service with timeout
      const result = await loadProposalWithItems(urlIdParam);
      
      if (!result.success) {
        throw new Error(result.error || 'Erro ao carregar proposta');
      }
      
      // Convert to legacy format for hydration
      const apiProposal = convertToLegacyFormat(result);
      
      if (!apiProposal) {
        throw new Error('Proposta não encontrada');
      }
      
      // Hydrate state using the centralized function
      const hydratedState = hydrateProposalForEdit(apiProposal);
      
      setState(hydratedState);
      hydratedRef.current = true;
      
      toast({
        title: 'Proposta carregada',
        description: `Editando proposta ${hydratedState.meta.proposalDisplayId}`,
      });
      
    } catch (error: any) {
      console.error('[useCalculatorState] Retry error:', error);
      const errorMessage = error.message || 'Erro ao carregar proposta';
      setEditError(errorMessage);
      
      setState(prev => ({
        ...prev,
        flags: { ...prev.flags, isLoading: false },
      }));
      
      toast({
        title: 'Erro ao carregar proposta',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  }, [isUrlEditMode, urlIdParam, toast]);
  
  // ============================================
  // RETURN
  // ============================================
  
  return {
    state,
    isLoading: state.flags.isLoading,
    isEditMode: state.flags.isEditMode,
    isHydrated: state.flags.isHydrated,
    editError,
    setState,
    updateClient,
    updateMeta,
    setDatacenter,
    setSelectedTerm,
    setItems,
    setAddons,
    setKubernetes,
    setStorageItems,
    setOpenSaas,
    setReseller,
    setPriceOverrides,
    setObservacao,
    addVM,
    addBM,
    addStorage,
    removeItem,
    updateItem,
    removeStorage,
    updateStorage,
    getSerializedPayload,
    resetToNew,
    retryLoad,
  };
}
