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
  name: string;
  company: string;
  phone: string;
  email: string;
  channel_type: 'CLIENTE' | 'PARCEIRO';
  reseller_name?: string;
  commission_value?: number;
  commission_reason?: string;
  observations?: string;
  fx: number;
  datacenter: string;
  contract_duration: number;
  discount_pct: number;
  total: number;
  addons?: any[];
  servers: any[];
  due_at: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

// Transform API proposal to local format
function apiToLocal(apiProposal: ApiProposal): SavedProposal {
  // Map contract_duration to selectedTerm
  const termMap: Record<number, string> = { 1: '1', 12: '12', 24: '24', 36: '36' };
  const selectedTerm = termMap[apiProposal.contract_duration] || '1';
  
  // Map datacenter string to code
  const datacenterMap: Record<string, 'SP1' | 'SP2' | 'FL1' | 'CE1'> = {
    'São Paulo': 'SP1',
    'SP1': 'SP1',
    'SP2': 'SP2',
    'Florida': 'FL1',
    'FL1': 'FL1',
    'Ceará': 'CE1',
    'CE1': 'CE1',
  };
  
  return {
    id: apiProposal.id,
    fx: apiProposal.fx || 5,
    selectedTerm,
    datacenter: datacenterMap[apiProposal.datacenter] || 'SP1',
    client: {
      name: apiProposal.name || '',
      company: apiProposal.company || '',
      email: apiProposal.email || '',
      phone: apiProposal.phone || '',
    },
    proposal: {
      id: `PROP-${apiProposal.id}`,
      validityDays: 7,
      createdAt: apiProposal.created_at,
    },
    items: apiProposal.servers || [],
    addons: apiProposal.addons || {},
    kubernetes: {},
    storageItems: [],
    reseller: apiProposal.reseller_name ? {
      name: apiProposal.reseller_name,
      commissionValue: apiProposal.commission_value,
      commissionReason: apiProposal.commission_reason,
    } : undefined,
    total: apiProposal.total || 0,
    savedAt: apiProposal.created_at,
    status: '' as ProposalStatus,
  };
}

// Transform local proposal to API format
function localToApi(proposal: SavedProposal): Record<string, unknown> {
  // Map selectedTerm to contract_duration
  const termToMonths: Record<string, number> = { '1': 1, '12': 12, '24': 24, '36': 36 };
  const contractDuration = termToMonths[proposal.selectedTerm] || 1;
  
  // Map datacenter code to string
  const datacenterNames: Record<string, string> = {
    'SP1': 'São Paulo',
    'SP2': 'São Paulo 2',
    'FL1': 'Florida',
    'CE1': 'Ceará',
  };
  
  // Calculate discount percentage from result if available
  const discountPct = proposal.result?.discountPct || 0;
  
  // Calculate due_at (proposal validity)
  const validityDays = proposal.proposal?.validityDays || 7;
  const createdAt = proposal.proposal?.createdAt || proposal.savedAt || new Date().toISOString();
  const dueAt = new Date(createdAt);
  dueAt.setDate(dueAt.getDate() + validityDays);
  
  return {
    name: proposal.client?.name || '',
    company: proposal.client?.company || '',
    phone: proposal.client?.phone || '',
    email: proposal.client?.email || '',
    channel_type: proposal.reseller ? 'PARCEIRO' : 'CLIENTE',
    reseller_name: proposal.reseller?.name || null,
    commission_value: proposal.reseller?.commissionValue || null,
    commission_reason: proposal.reseller?.commissionReason || null,
    observations: null,
    fx: proposal.fx || 5,
    datacenter: datacenterNames[proposal.datacenter || 'SP1'] || 'São Paulo',
    contract_duration: contractDuration,
    discount_pct: discountPct,
    total: proposal.total || proposal.result?.grandTotal || 0,
    addons: proposal.addons ? [proposal.addons] : [],
    servers: proposal.items || [],
    due_at: dueAt.toISOString(),
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

// Hook to fetch a single proposal by ID (numeric id or string id)
export function useProposal(proposalId: string | undefined) {
  return useQuery({
    queryKey: ['proposal', 'api', proposalId],
    queryFn: async () => {
      if (!proposalId) return null;
      try {
        // Try to parse as numeric ID
        const numericId = parseInt(proposalId, 10);
        if (!isNaN(numericId)) {
          const result = await openApi.getProposal(numericId);
          return apiToLocal(result as ApiProposal);
        }
        
        // Fallback: search by id string (PROP-123 format)
        const response = await openApi.getProposals({ __perPage: 500 });
        const apiProposals = response.data as ApiProposal[];
        const found = apiProposals.find(p => `PROP-${p.id}` === proposalId);
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
        // Create new proposal
        const result = await openApi.createProposal(apiData);
        return { success: true, data: result };
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
      // Parse numeric ID
      const numericId = parseInt(id, 10);
      if (!isNaN(numericId)) {
        const apiData = localToApi(proposal);
        const result = await openApi.updateProposal(numericId, apiData);
        return { success: true, data: result };
      }
      
      // Fallback: search by PROP-ID format
      const response = await openApi.getProposals({ __perPage: 500 });
      const existing = (response.data as ApiProposal[]).find(p => `PROP-${p.id}` === id);
      
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
      // Parse numeric ID
      const numericId = parseInt(id, 10);
      let existing: ApiProposal | undefined;
      
      if (!isNaN(numericId)) {
        existing = await openApi.getProposal(numericId) as ApiProposal;
      } else {
        // Fallback: search by PROP-ID format
        const response = await openApi.getProposals({ __perPage: 500 });
        existing = (response.data as ApiProposal[]).find(p => `PROP-${p.id}` === id);
      }
      
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
      // Parse numeric ID
      const numericId = parseInt(proposalId, 10);
      
      if (!isNaN(numericId)) {
        await openApi.deleteProposal(numericId);
        return { success: true };
      }
      
      // Fallback: search by PROP-ID format
      const response = await openApi.getProposals({ __perPage: 500 });
      const existing = (response.data as ApiProposal[]).find(p => `PROP-${p.id}` === proposalId);
      
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
