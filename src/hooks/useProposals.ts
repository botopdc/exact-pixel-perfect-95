import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CalculatorState, CalculationResult, ClientInfo, ProposalMeta } from '@/lib/calculatorConfig';

// Local storage key
const PROPOSALS_KEY = 'open_proposals_v2';

// Proposal status type
export type ProposalStatus = 'E' | 'A' | 'R' | ''; // Enviado, Aprovado, Recusado, Vazio

// Acceptance/Rejection info
export interface ProposalAcceptance {
  id: string;           // UUID for audit
  acceptedAt?: string;  // ISO timestamp
  rejectedAt?: string;  // ISO timestamp
  channel: 'public_url' | 'ui' | 'email';
  token?: string;
}

// SavedProposal type (local format)
export interface SavedProposal {
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
  // New fields for status tracking
  status?: ProposalStatus;
  acceptance?: ProposalAcceptance;
}

// Get proposals from localStorage
function getLocalProposals(): SavedProposal[] {
  try {
    const stored = localStorage.getItem(PROPOSALS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

// Save proposals to localStorage
function saveLocalProposals(proposals: SavedProposal[]): void {
  localStorage.setItem(PROPOSALS_KEY, JSON.stringify(proposals));
}

// Hook to fetch all proposals (from localStorage)
export function useProposals(page = 1, perPage = 100) {
  return useQuery({
    queryKey: ['proposals', 'local'],
    queryFn: () => getLocalProposals(),
    staleTime: 1000 * 60 * 5,
  });
}

// Hook to fetch proposals with pagination info (local)
export function useProposalsPaginated(page = 1, perPage = 20) {
  return useQuery({
    queryKey: ['proposals', 'local', page, perPage],
    queryFn: () => {
      const all = getLocalProposals();
      const start = (page - 1) * perPage;
      const proposals = all.slice(start, start + perPage);
      return {
        proposals,
        pagination: {
          currentPage: page,
          lastPage: Math.ceil(all.length / perPage) || 1,
          total: all.length,
        }
      };
    },
    staleTime: 1000 * 60 * 5,
  });
}

// Hook to fetch a single proposal by ID (from localStorage)
export function useProposal(id: string | undefined) {
  return useQuery({
    queryKey: ['proposal', 'local', id],
    queryFn: () => {
      if (!id) return null;
      const proposals = getLocalProposals();
      return proposals.find(p => p.proposal?.id === id) || null;
    },
    enabled: !!id,
    staleTime: 1000 * 60 * 5,
  });
}

// Hook to save a proposal (to localStorage)
export function useSaveProposal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (proposal: SavedProposal) => {
      const existing = getLocalProposals();
      const filtered = existing.filter((p) => p.proposal?.id !== proposal.proposal?.id);
      filtered.unshift(proposal);
      saveLocalProposals(filtered.slice(0, 200));
      return Promise.resolve({ success: true, data: proposal });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
    },
  });
}

// Hook to update a proposal (in localStorage)
export function useUpdateProposal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, proposal }: { id: string; proposal: SavedProposal }) => {
      const existing = getLocalProposals();
      const idx = existing.findIndex(p => p.proposal?.id === id);
      if (idx >= 0) {
        existing[idx] = proposal;
        saveLocalProposals(existing);
      }
      return Promise.resolve({ success: true, data: proposal });
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
      queryClient.invalidateQueries({ queryKey: ['proposal', 'local', id] });
    },
  });
}

// Hook to update proposal status only
export function useUpdateProposalStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status, acceptance }: { 
      id: string; 
      status: ProposalStatus;
      acceptance?: ProposalAcceptance;
    }) => {
      const existing = getLocalProposals();
      const idx = existing.findIndex(p => p.proposal?.id === id);
      if (idx >= 0) {
        existing[idx].status = status;
        if (acceptance) {
          existing[idx].acceptance = acceptance;
        }
        saveLocalProposals(existing);
        return Promise.resolve({ success: true, data: existing[idx] });
      }
      return Promise.resolve({ success: false, data: null });
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
      queryClient.invalidateQueries({ queryKey: ['proposal', 'local', id] });
    },
  });
}

// Hook to delete a proposal (from localStorage)
export function useDeleteProposal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => {
      const existing = getLocalProposals();
      const filtered = existing.filter((p) => p.proposal?.id !== id);
      saveLocalProposals(filtered);
      return Promise.resolve({ success: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
    },
  });
}

// Hook to get proposal views (disabled - no API)
export function useProposalViews(proposalId: string | null) {
  return useQuery({
    queryKey: ['proposal-views', proposalId],
    queryFn: () => [] as any[],
    enabled: false,
  });
}

// Hook to track proposal view (no-op without API)
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
