import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { partnerAuthService } from '@/services/partnersService';
import { PartnerType } from '@/types/partner';

// Local storage key
const PARTNER_PROPOSALS_KEY = 'open_partner_proposals_v1';

// Proposal status type
export type PartnerProposalStatus = 'Rascunho' | 'Enviada' | 'Aceita' | 'Cancelada';

// Partner Proposal structure
export interface PartnerProposal {
  proposta_id: string;
  usuario_id: string;       // ID do parceiro logado
  parceiro_nome: string;    // Nome da empresa parceira
  tipo_parceria: PartnerType;
  cliente_nome: string;
  cliente_email?: string;
  data_criacao: string;     // ISO timestamp
  valor_total: number;
  status_proposta: PartnerProposalStatus;
  dados_proposta: any;      // Full proposal data
}

// Get proposals from localStorage
function getLocalProposals(): PartnerProposal[] {
  try {
    const stored = localStorage.getItem(PARTNER_PROPOSALS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

// Save proposals to localStorage
function saveLocalProposals(proposals: PartnerProposal[]): void {
  localStorage.setItem(PARTNER_PROPOSALS_KEY, JSON.stringify(proposals));
}

// Hook to fetch partner proposals (filtered by current user or all for admin)
export function usePartnerProposals(isAdmin = false) {
  const session = partnerAuthService.getSession();
  const userId = session?.partnerId || null;

  return useQuery({
    queryKey: ['partner-proposals', userId, isAdmin],
    queryFn: () => {
      const all = getLocalProposals();
      // Admin sees all, partner sees only their own
      if (isAdmin) {
        return all;
      }
      // Partner: filter by usuario_id AND ignore proposals without usuario_id
      return userId 
        ? all.filter(p => p.usuario_id && p.usuario_id === userId) 
        : [];
    },
    staleTime: 1000 * 60 * 5,
  });
}

// Hook to fetch all proposals (for admin view)
export function useAllPartnerProposals() {
  return useQuery({
    queryKey: ['partner-proposals', 'all'],
    queryFn: () => getLocalProposals(),
    staleTime: 1000 * 60 * 5,
  });
}

// Hook to save a partner proposal
export function useSavePartnerProposal() {
  const queryClient = useQueryClient();
  const session = partnerAuthService.getSession();

  return useMutation({
    mutationFn: (proposalData: {
      proposta_id: string;
      cliente_nome: string;
      cliente_email?: string;
      valor_total: number;
      status_proposta?: PartnerProposalStatus;
      dados_proposta: any;
    }) => {
      if (!session) {
        return Promise.reject(new Error('Sessão de parceiro não encontrada'));
      }

      const proposal: PartnerProposal = {
        proposta_id: proposalData.proposta_id,
        usuario_id: session.partnerId,
        parceiro_nome: session.empresa,
        tipo_parceria: session.tipo_parceria,
        cliente_nome: proposalData.cliente_nome,
        cliente_email: proposalData.cliente_email,
        data_criacao: new Date().toISOString(),
        valor_total: proposalData.valor_total,
        status_proposta: proposalData.status_proposta || 'Rascunho',
        dados_proposta: proposalData.dados_proposta,
      };

      const existing = getLocalProposals();
      const filtered = existing.filter(p => p.proposta_id !== proposal.proposta_id);
      filtered.unshift(proposal);
      saveLocalProposals(filtered.slice(0, 500)); // Keep last 500 proposals

      return Promise.resolve({ success: true, data: proposal });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partner-proposals'] });
    },
  });
}

// Hook to update proposal status
export function useUpdatePartnerProposalStatus() {
  const queryClient = useQueryClient();
  const session = partnerAuthService.getSession();

  return useMutation({
    mutationFn: ({ proposta_id, status_proposta }: { proposta_id: string; status_proposta: PartnerProposalStatus }) => {
      if (!session) {
        return Promise.reject(new Error('Sessão de parceiro não encontrada'));
      }

      const existing = getLocalProposals();
      const idx = existing.findIndex(p => p.proposta_id === proposta_id && p.usuario_id === session.partnerId);
      
      if (idx >= 0) {
        existing[idx].status_proposta = status_proposta;
        saveLocalProposals(existing);
        return Promise.resolve({ success: true, data: existing[idx] });
      }
      
      return Promise.resolve({ success: false, data: null });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partner-proposals'] });
    },
  });
}

// Hook to duplicate a proposal
export function useDuplicatePartnerProposal() {
  const queryClient = useQueryClient();
  const session = partnerAuthService.getSession();

  return useMutation({
    mutationFn: (proposta_id: string) => {
      if (!session) {
        return Promise.reject(new Error('Sessão de parceiro não encontrada'));
      }

      const existing = getLocalProposals();
      const original = existing.find(p => p.proposta_id === proposta_id && p.usuario_id === session.partnerId);
      
      if (!original) {
        return Promise.reject(new Error('Proposta não encontrada'));
      }

      const newProposal: PartnerProposal = {
        ...original,
        proposta_id: `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
        data_criacao: new Date().toISOString(),
        status_proposta: 'Rascunho',
      };

      existing.unshift(newProposal);
      saveLocalProposals(existing.slice(0, 500));

      return Promise.resolve({ success: true, data: newProposal });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partner-proposals'] });
    },
  });
}

// Hook to delete a proposal (only drafts can be deleted)
export function useDeletePartnerProposal() {
  const queryClient = useQueryClient();
  const session = partnerAuthService.getSession();

  return useMutation({
    mutationFn: (proposta_id: string) => {
      if (!session) {
        return Promise.reject(new Error('Sessão de parceiro não encontrada'));
      }

      const existing = getLocalProposals();
      const proposal = existing.find(p => p.proposta_id === proposta_id && p.usuario_id === session.partnerId);
      
      if (!proposal) {
        return Promise.reject(new Error('Proposta não encontrada'));
      }

      if (proposal.status_proposta !== 'Rascunho') {
        return Promise.reject(new Error('Apenas rascunhos podem ser excluídos'));
      }

      const filtered = existing.filter(p => p.proposta_id !== proposta_id);
      saveLocalProposals(filtered);

      return Promise.resolve({ success: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partner-proposals'] });
    },
  });
}
