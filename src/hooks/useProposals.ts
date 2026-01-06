import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CalculationResult, ClientInfo, ProposalMeta } from '@/lib/calculatorConfig';
import { openApi } from '@/lib/openApi';

// Proposal status type
export type ProposalStatus = 'E' | 'A' | 'R' | ''; // Enviado, Aprovado, Recusado, Vazio

// Acceptance/Rejection info
export interface ProposalAcceptance {
  id: string;
  acceptedAt?: string;
  rejectedAt?: string;
  channel: 'public_url' | 'ui' | 'email';
  token?: string;
}

// SavedProposal type (local format compatible with API)
export interface SavedProposal {
  id?: number; // API ID
  fx: number;
  selectedTerm: string;
  datacenter?: 'SP1' | 'SP2' | 'FL1' | 'CE1';
  client: ClientInfo;
  proposal: ProposalMeta;
  items: any[];
  addons: any;
  kubernetes: any;
  storageItems: any[];
  reseller?: any;
  openSaas?: any;
  total: number;
  savedAt: string;
  result?: CalculationResult;
  status?: ProposalStatus;
  acceptance?: ProposalAcceptance;
}

// API Proposal format (what comes from the API)
interface ApiProposal {
  id: number;
  proposal_id: string;
  channel_type: 'CLIENTE' | 'PARCEIRO';
  status: string;
  client_name: string;
  client_email: string;
  client_company: string;
  client_phone: string;
  total_value: number;
  payload: SavedProposal;
  created_at: string;
  updated_at: string;
}

// Transform API proposal to local format
function apiToLocal(apiProposal: ApiProposal): SavedProposal {
  // If payload contains full data, use it
  if (apiProposal.payload) {
    return {
      ...apiProposal.payload,
      id: apiProposal.id,
      status: (apiProposal.status as ProposalStatus) || '',
      savedAt: apiProposal.created_at,
    };
  }
  
  // Fallback: construct from API fields
  return {
    id: apiProposal.id,
    fx: 5,
    selectedTerm: '1',
    datacenter: 'SP1',
    client: {
      name: apiProposal.client_name || '',
      company: apiProposal.client_company || '',
      email: apiProposal.client_email || '',
      phone: apiProposal.client_phone || '',
    },
    proposal: {
      id: apiProposal.proposal_id,
      validityDays: 7,
      createdAt: apiProposal.created_at,
    },
    items: [],
    addons: {},
    kubernetes: {},
    storageItems: [],
    total: apiProposal.total_value || 0,
    savedAt: apiProposal.created_at,
    status: (apiProposal.status as ProposalStatus) || '',
  };
}

// Transform local proposal to API format
function localToApi(proposal: SavedProposal): Record<string, unknown> {
  return {
    proposal_id: proposal.proposal?.id,
    channel_type: 'CLIENTE',
    status: proposal.status || '',
    client_name: proposal.client?.name || '',
    client_email: proposal.client?.email || '',
    client_company: proposal.client?.company || '',
    client_phone: proposal.client?.phone || '',
    total_value: proposal.total || proposal.result?.grandTotal || 0,
    payload: proposal,
  };
}

// Hook to fetch all proposals from API
export function useProposals(page = 1, perPage = 100) {
  return useQuery({
    queryKey: ['proposals', 'api', page, perPage],
    queryFn: async () => {
      try {
        const response = await openApi.getProposals({
          __page: page,
          __perPage: perPage,
        });
        const apiProposals = response.data as ApiProposal[];
        return apiProposals.map(apiToLocal);
      } catch (error) {
        console.warn('[Proposals] API fetch failed, returning empty:', error);
        return [];
      }
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

// Hook to fetch proposals with pagination info
export function useProposalsPaginated(page = 1, perPage = 20) {
  return useQuery({
    queryKey: ['proposals', 'api', 'paginated', page, perPage],
    queryFn: async () => {
      try {
        const response = await openApi.getProposals({
          __page: page,
          __perPage: perPage,
        });
        const apiProposals = response.data as ApiProposal[];
        const proposals = apiProposals.map(apiToLocal);
        return {
          proposals,
          pagination: {
            currentPage: page,
            lastPage: Math.ceil(response.total / perPage) || 1,
            total: response.total,
          }
        };
      } catch (error) {
        console.warn('[Proposals] API fetch failed:', error);
        return {
          proposals: [],
          pagination: { currentPage: 1, lastPage: 1, total: 0 }
        };
      }
    },
    staleTime: 1000 * 60 * 2,
  });
}

// Hook to fetch a single proposal by ID (proposal_id string)
export function useProposal(proposalId: string | undefined) {
  return useQuery({
    queryKey: ['proposal', 'api', proposalId],
    queryFn: async () => {
      if (!proposalId) return null;
      try {
        // Search by proposal_id in the list (API might not have direct lookup by proposal_id)
        const response = await openApi.getProposals({ __perPage: 500 });
        const apiProposals = response.data as ApiProposal[];
        const found = apiProposals.find(p => p.proposal_id === proposalId);
        return found ? apiToLocal(found) : null;
      } catch (error) {
        console.warn('[Proposal] API fetch failed:', error);
        return null;
      }
    },
    enabled: !!proposalId,
    staleTime: 1000 * 60 * 2,
  });
}

// Hook to save a proposal (create or update)
export function useSaveProposal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (proposal: SavedProposal) => {
      const apiData = localToApi(proposal);
      
      // Check if proposal already exists (has API id)
      if (proposal.id) {
        const result = await openApi.updateProposal(proposal.id, apiData);
        return { success: true, data: result };
      } else {
        // Check if proposal_id already exists
        const existingResponse = await openApi.getProposals({ __perPage: 500 });
        const existing = (existingResponse.data as ApiProposal[]).find(
          p => p.proposal_id === proposal.proposal?.id
        );
        
        if (existing) {
          const result = await openApi.updateProposal(existing.id, apiData);
          return { success: true, data: result };
        } else {
          const result = await openApi.createProposal(apiData);
          return { success: true, data: result };
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
    },
    onError: (error) => {
      console.error('[SaveProposal] Error:', error);
    },
  });
}

// Hook to update a proposal
export function useUpdateProposal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, proposal }: { id: string; proposal: SavedProposal }) => {
      // Find by proposal_id string
      const response = await openApi.getProposals({ __perPage: 500 });
      const existing = (response.data as ApiProposal[]).find(p => p.proposal_id === id);
      
      if (existing) {
        const apiData = localToApi(proposal);
        const result = await openApi.updateProposal(existing.id, apiData);
        return { success: true, data: result };
      }
      
      throw new Error('Proposta não encontrada');
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
      queryClient.invalidateQueries({ queryKey: ['proposal', 'api', id] });
    },
  });
}

// Hook to update proposal status only
export function useUpdateProposalStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status, acceptance }: { 
      id: string; 
      status: ProposalStatus;
      acceptance?: ProposalAcceptance;
    }) => {
      // Find by proposal_id string
      const response = await openApi.getProposals({ __perPage: 500 });
      const existing = (response.data as ApiProposal[]).find(p => p.proposal_id === id);
      
      if (existing) {
        const currentProposal = apiToLocal(existing);
        currentProposal.status = status;
        if (acceptance) {
          currentProposal.acceptance = acceptance;
        }
        
        const apiData = localToApi(currentProposal);
        const result = await openApi.updateProposal(existing.id, apiData);
        return { success: true, data: result };
      }
      
      return { success: false, data: null };
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
      queryClient.invalidateQueries({ queryKey: ['proposal', 'api', id] });
    },
  });
}

// Hook to delete a proposal
export function useDeleteProposal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (proposalId: string) => {
      // Find by proposal_id string
      const response = await openApi.getProposals({ __perPage: 500 });
      const existing = (response.data as ApiProposal[]).find(p => p.proposal_id === proposalId);
      
      if (existing) {
        await openApi.deleteProposal(existing.id);
        return { success: true };
      }
      
      throw new Error('Proposta não encontrada');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
    },
  });
}

// Hook to get proposal views (not available in API - returns empty)
export function useProposalViews(proposalId: string | null) {
  return useQuery({
    queryKey: ['proposal-views', proposalId],
    queryFn: () => [] as any[],
    enabled: false,
  });
}

// Hook to track proposal view (not available in API - no-op)
export function useTrackProposalView() {
  return useMutation({
    mutationFn: ({ proposalId, source }: { proposalId: string; source: string }) => 
      Promise.resolve(),
  });
}

// Hook to send proposal email via edge function
export function useSendProposalEmail() {
  return useMutation({
    mutationFn: async (data: {
      clientName: string;
      clientEmail: string;
      proposalId: string;
      proposalLink: string;
      totalValue: string;
      validityDate: string;
      senderEmail?: string;
      senderName?: string;
      isAcceptance?: boolean;
    }) => {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(
        `${supabaseUrl}/functions/v1/send-proposal-email`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
        }
      );
      
      const result = await response.json();
      
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Falha ao enviar email');
      }
      
      return result;
    },
  });
}
