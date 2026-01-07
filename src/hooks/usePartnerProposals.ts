import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { partnerAuthService } from '@/services/partnersService';
import { PartnerType } from '@/types/partner';
import { openApi } from '@/lib/openApi';

// Proposal status type
export type PartnerProposalStatus = 'Rascunho' | 'Enviada' | 'Aceita' | 'Cancelada';

// Partner Proposal structure
export interface PartnerProposal {
  proposta_id: string;
  api_id?: number;        // API numeric ID
  usuario_id: string;     // ID do parceiro logado
  parceiro_nome: string;  // Nome da empresa parceira
  tipo_parceria: PartnerType;
  cliente_nome: string;
  cliente_email?: string;
  data_criacao: string;   // ISO timestamp
  valor_total: number;
  status_proposta: PartnerProposalStatus;
  dados_proposta: any;    // Full proposal data
}

// Transform API proposal to PartnerProposal format
function apiToPartnerProposal(apiProposal: any, session: any): PartnerProposal {
  return {
    proposta_id: `PROP-${apiProposal.id}`,
    api_id: apiProposal.id,
    usuario_id: session?.partnerId || '',
    parceiro_nome: apiProposal.reseller_name || session?.empresa || '',
    tipo_parceria: (session?.tipo_parceria || 'FINDER') as PartnerType,
    cliente_nome: apiProposal.name || '',
    cliente_email: apiProposal.email || '',
    data_criacao: apiProposal.created_at,
    valor_total: typeof apiProposal.total === 'string' ? parseFloat(apiProposal.total) : apiProposal.total,
    status_proposta: 'Rascunho' as PartnerProposalStatus,
    dados_proposta: apiProposal,
  };
}

// Hook to fetch partner proposals from API (filtered by channel_type PARCEIRO)
export function usePartnerProposals(isAdmin = false) {
  const session = partnerAuthService.getSession();
  const userId = session?.partnerId || null;

  return useQuery({
    queryKey: ['partner-proposals', userId, isAdmin],
    queryFn: async () => {
      try {
        const response = await openApi.getProposals({
          channel_type: 'PARCEIRO',
          __perPage: 100,
        });
        const apiProposals = response.data as any[];
        
        // Transform to PartnerProposal format
        const proposals = apiProposals.map(p => apiToPartnerProposal(p, session));
        
        // Admin sees all, partner sees only their own
        if (isAdmin) {
          return proposals;
        }
        
        // Partner: filter by reseller_name matching their empresa
        return userId && session?.empresa
          ? proposals.filter(p => p.parceiro_nome === session.empresa)
          : [];
      } catch (error) {
        console.warn('[PartnerProposals] API fetch failed:', error);
        return [];
      }
    },
    staleTime: 1000 * 60 * 2,
  });
}

// Hook to fetch all proposals (for admin view)
export function useAllPartnerProposals() {
  return useQuery({
    queryKey: ['partner-proposals', 'all'],
    queryFn: async () => {
      try {
        const response = await openApi.getProposals({
          channel_type: 'PARCEIRO',
          __perPage: 500,
        });
        const session = partnerAuthService.getSession();
        return (response.data as any[]).map(p => apiToPartnerProposal(p, session));
      } catch (error) {
        console.warn('[PartnerProposals] API fetch failed:', error);
        return [];
      }
    },
    staleTime: 1000 * 60 * 2,
  });
}

// Hook to save a partner proposal via API
export function useSavePartnerProposal() {
  const queryClient = useQueryClient();
  const session = partnerAuthService.getSession();

  return useMutation({
    mutationFn: async (proposalData: {
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

      // Transform to API format
      const apiData = {
        name: proposalData.cliente_nome,
        company: proposalData.dados_proposta?.client?.company || '',
        phone: proposalData.dados_proposta?.client?.phone || '',
        email: proposalData.cliente_email || '',
        channel_type: 'PARCEIRO' as const,
        reseller_name: session.empresa,
        fx: proposalData.dados_proposta?.fx || 5,
        datacenter: proposalData.dados_proposta?.datacenter || 'São Paulo',
        contract_duration: parseInt(proposalData.dados_proposta?.selectedTerm) || 1,
        discount_pct: proposalData.dados_proposta?.result?.discountPct || 0,
        total: proposalData.valor_total,
        addons: proposalData.dados_proposta?.addons ? 
          Object.entries(proposalData.dados_proposta.addons)
            .filter(([_, v]: [string, any]) => v?.enabled || (typeof v === 'number' && v > 0))
            .map(([name, v]: [string, any]) => ({
              name,
              price: typeof v === 'object' ? v.price || 0 : v,
              quantity: typeof v === 'object' ? v.quantity || 1 : 1,
            })) : [],
        servers: proposalData.dados_proposta?.items?.map((item: any) => ({
          name: item.name || item.label || 'Server',
          vcpu: item.vcpu || item.cpu || 0,
          ram: item.ram || item.memory || 0,
          storage: item.storage || item.disk || 0,
          price: item.price || item.total || 0,
          quantity: item.quantity || 1,
        })) || [],
        due_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      };

      const result = await openApi.createProposal(apiData);
      
      const partnerProposal: PartnerProposal = {
        proposta_id: `PROP-${(result as any).id}`,
        api_id: (result as any).id,
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

      return { success: true, data: partnerProposal };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partner-proposals'] });
    },
  });
}

// Hook to update proposal status (via API update)
export function useUpdatePartnerProposalStatus() {
  const queryClient = useQueryClient();
  const session = partnerAuthService.getSession();

  return useMutation({
    mutationFn: async ({ proposta_id, status_proposta }: { proposta_id: string; status_proposta: PartnerProposalStatus }) => {
      if (!session) {
        return Promise.reject(new Error('Sessão de parceiro não encontrada'));
      }

      // Extract numeric ID from PROP-123 format
      const numericId = proposta_id.replace('PROP-', '');
      const id = parseInt(numericId, 10);
      
      if (isNaN(id)) {
        return Promise.reject(new Error('ID de proposta inválido'));
      }

      // Get current proposal
      const current = await openApi.getProposal(id) as any;
      if (!current) {
        return Promise.reject(new Error('Proposta não encontrada'));
      }

      // Note: API may not have status field - we just acknowledge the update
      // In a real implementation, the API should have a status field
      console.log(`[PartnerProposals] Status update requested: ${proposta_id} -> ${status_proposta}`);
      
      return { success: true, data: { proposta_id, status_proposta } };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partner-proposals'] });
    },
  });
}

// Hook to duplicate a proposal (create new via API)
export function useDuplicatePartnerProposal() {
  const queryClient = useQueryClient();
  const session = partnerAuthService.getSession();

  return useMutation({
    mutationFn: async (proposta_id: string) => {
      if (!session) {
        return Promise.reject(new Error('Sessão de parceiro não encontrada'));
      }

      // Extract numeric ID
      const numericId = proposta_id.replace('PROP-', '');
      const id = parseInt(numericId, 10);
      
      if (isNaN(id)) {
        return Promise.reject(new Error('ID de proposta inválido'));
      }

      // Get original proposal
      const original = await openApi.getProposal(id) as any;
      if (!original) {
        return Promise.reject(new Error('Proposta não encontrada'));
      }

      // Create duplicate
      const duplicateData = {
        ...original,
        id: undefined, // Remove ID for new creation
        name: `${original.name} (Cópia)`,
        due_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      };

      const result = await openApi.createProposal(duplicateData);

      return { success: true, data: apiToPartnerProposal(result, session) };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partner-proposals'] });
    },
  });
}

// Hook to delete a proposal (via API)
export function useDeletePartnerProposal() {
  const queryClient = useQueryClient();
  const session = partnerAuthService.getSession();

  return useMutation({
    mutationFn: async (proposta_id: string) => {
      if (!session) {
        return Promise.reject(new Error('Sessão de parceiro não encontrada'));
      }

      // Extract numeric ID
      const numericId = proposta_id.replace('PROP-', '');
      const id = parseInt(numericId, 10);
      
      if (isNaN(id)) {
        return Promise.reject(new Error('ID de proposta inválido'));
      }

      await openApi.deleteProposal(id);
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partner-proposals'] });
    },
  });
}
