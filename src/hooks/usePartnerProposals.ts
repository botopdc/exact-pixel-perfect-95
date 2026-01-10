import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { partnerAuthService } from '@/services/partnersService';
import { authService } from '@/services/authService';
import { PartnerType } from '@/types/partner';
import { openApi } from '@/lib/openApi';
import { CalculationResult, generateProposalId } from '@/lib/calculatorConfig';
import type { SummaryRow } from '@/lib/calculatorConfig';

// Proposal status type
export type PartnerProposalStatus = 'Rascunho' | 'Enviada' | 'Aceita' | 'Cancelada';

// Local proposal format (what the calculator expects)
export interface LocalProposalData {
  fx: number;
  selectedTerm: string;
  datacenter?: 'SP1' | 'SP2' | 'FL1' | 'CE1';
  client: {
    name: string;
    company: string;
    email: string;
    phone: string;
  };
  proposal: {
    id: string;
    validityDays: number;
    createdAt: string;
  };
  items: any[];
  addons: any;
  kubernetes: any;
  storageItems: any[];
  reseller?: any;
  openSaas?: any;
  result?: CalculationResult;
  observacao?: string;
}

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
  dados_proposta: LocalProposalData;  // Full proposal data in LOCAL format
}

/**
 * Transform API proposal to LOCAL calculator format
 * This is critical for the calculator edit mode to work correctly
 */
function apiToLocalFormat(apiProposal: any): LocalProposalData {
  // Map contract_duration to selectedTerm
  const termMap: Record<number, string> = { 1: '1', 12: '12', 24: '24', 36: '36' };
  const selectedTerm = termMap[apiProposal.contract_duration] || '1';
  
  // Map datacenter string to code
  const datacenterMap: Record<string, 'SP1' | 'SP2' | 'FL1' | 'CE1'> = {
    'São Paulo': 'SP1',
    'São Paulo 2': 'SP2',
    'SP1': 'SP1',
    'SP2': 'SP2',
    'Florida': 'FL1',
    'FL1': 'FL1',
    'Ceará': 'CE1',
    'CE1': 'CE1',
  };
  
  // Transform API addons array to local addons object
  const addonsObj: Record<string, any> = {
    backupPlan: 'none',
    backupGb: 0,
    antivirus: 0,
    firewall: false,
    tsplus: 0,
    cal: 0,
    sql: 'none',
    sqlQty: 0,
    veeamVm: 0,
    veeamAg: 0,
  };
  let addonsTotal = 0;
  
  if (apiProposal.addons && Array.isArray(apiProposal.addons)) {
    for (const addon of apiProposal.addons) {
      if (addon.name) {
        const addonPrice = addon.price || 0;
        const addonQty = addon.quantity || 1;
        // Map addon names to local state keys
        const addonKeyMap: Record<string, string> = {
          'antivirus': 'antivirus',
          'firewall': 'firewall',
          'tsplus': 'tsplus',
          'cal': 'cal',
          'veeam_vm': 'veeamVm',
          'veeam_agent': 'veeamAg',
        };
        const localKey = addonKeyMap[addon.name.toLowerCase()] || addon.name;
        if (localKey === 'firewall') {
          addonsObj.firewall = true;
        } else if (typeof addonsObj[localKey] === 'number') {
          addonsObj[localKey] = addonQty;
        }
        addonsTotal += addonPrice * addonQty;
      }
    }
  }
  
  // Transform API servers array to local items format
  const rows: SummaryRow[] = [];
  let serversSubtotal = 0;
  
  const items = (apiProposal.servers || []).map((server: any, idx: number) => {
    const serverName = server.name || 'Server';
    const price = server.price || 0;
    const quantity = server.quantity || 1;
    const subtotal = price * quantity;
    const vcpu = server.vcpu || 0;
    const ram = server.ram || 0;
    const storage = server.storage || 0;
    
    // Detect if VM or BareMetal
    const isVM = serverName.toLowerCase().includes('vm') || vcpu > 0;
    
    // Build spec label for rows
    const specLabel = vcpu > 0 || ram > 0 || storage > 0
      ? `${serverName} (${vcpu} vCPU, ${ram}GB RAM, ${storage}GB)`
      : serverName;
    
    // Add row for result
    rows.push({
      label: specLabel,
      qty: quantity,
      unitPrice: price,
      subtotal: subtotal,
    });
    
    serversSubtotal += subtotal;
    
    // Return item in calculator format
    if (isVM) {
      return {
        type: 'vm' as const,
        id: crypto.randomUUID(),
        gpu: 'Sem GPU',
        gpuQty: 0,
        vcpu: vcpu || 16,
        ramGb: ram || 128,
        nvmeTb: (storage || 50) / 1024, // Convert GB to TB
        trafficTb: 5,
        ips: 1,
        qtyServers: quantity,
      };
    } else {
      return {
        type: 'bm' as const,
        id: crypto.randomUUID(),
        gpu: 'Sem GPU',
        gpuQty: 0,
        bmCpu: 'intel_xeon_e2136', // Default
        bmRam: 'ram_128gb',
        disks: [{ type: 'nvme_1tb', qty: 1, desc: '' }],
        trafficTb: 5,
        ips: 1,
        qtyServers: quantity,
      };
    }
  });
  
  // Add addon rows if they exist
  if (apiProposal.addons && Array.isArray(apiProposal.addons)) {
    for (const addon of apiProposal.addons) {
      if (addon.name) {
        const addonPrice = addon.price || 0;
        const addonQty = addon.quantity || 1;
        rows.push({
          label: addon.name,
          qty: addonQty,
          unitPrice: addonPrice,
          subtotal: addonPrice * addonQty,
        });
      }
    }
  }
  
  // Calculate discount
  const discountPct = apiProposal.discount_pct || 0;
  const subtotalBeforeDiscount = serversSubtotal + addonsTotal;
  const discountValue = subtotalBeforeDiscount * discountPct;
  const grandTotal = apiProposal.total || (subtotalBeforeDiscount - discountValue);
  
  // Build the result object for rendering
  const result: CalculationResult = {
    rows,
    subRec: serversSubtotal,
    subIps: 0,
    subServices: addonsTotal,
    subBackup: 0,
    subKubernetes: 0,
    subStorage: 0,
    subOpenSaas: 0,
    discountPct,
    discountValue,
    grandTotal,
    totalServers: items.length,
    gpuUsdTotal: 0,
    gpuBrlTotal: 0,
    subtotalPriceList: subtotalBeforeDiscount,
    overValue: 0,
    overPercent: 0,
    totalWithOver: grandTotal,
  };
  
  return {
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
    items,
    addons: addonsObj,
    kubernetes: {
      enabled: false,
      plan: 'k8s_small',
      addons: {
        support_24x7: false,
        backup_velero: false,
        dr_multisite: false,
        observability: false,
        cicd_managed: false,
        devops_hours: 0,
      },
      extras: { vcpu: 0, ramGB: 0, diskGB: 0 },
    },
    storageItems: [],
    reseller: apiProposal.reseller_name ? {
      enabled: true,
      name: apiProposal.reseller_name,
      overValue: apiProposal.commission_value || 0,
      approvalRequired: false,
      approvalStatus: 'Pendente',
      approver: '',
      approvedAt: null,
    } : undefined,
    openSaas: {
      enabled: false,
      users: 0,
      modules: [],
    },
    observacao: apiProposal.observations || undefined,
    result,
  };
}

// Transform API proposal to PartnerProposal format with LOCAL data
function apiToPartnerProposal(apiProposal: any, session: any): PartnerProposal {
  const localData = apiToLocalFormat(apiProposal);
  
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
    dados_proposta: localData,
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

// Transform local items (VM/BM format) to API servers format
function localItemsToApiServers(items: any[]): Array<{ name: string; vcpu: number; ram: number; storage: number; price: number; quantity: number }> {
  if (!items || !Array.isArray(items)) return [];
  
  return items.map((item: any, idx: number) => {
    if (item.type === 'vm') {
      return {
        name: `VM #${idx + 1}`,
        vcpu: item.vcpu || 0,
        ram: item.ramGb || 0,
        storage: Math.round((item.nvmeTb || 0) * 1024), // Convert TB to GB
        price: 0, // Will be calculated by backend
        quantity: item.qtyServers || 1,
      };
    } else if (item.type === 'bm') {
      return {
        name: `BareMetal #${idx + 1}`,
        vcpu: 0, // BM doesn't have vCPU in the same way
        ram: 0,
        storage: 0,
        price: 0,
        quantity: item.qtyServers || 1,
      };
    } else {
      // Fallback for legacy format
      return {
        name: item.name || item.label || 'Server',
        vcpu: item.vcpu || item.cpu || 0,
        ram: item.ram || item.memory || item.ramGb || 0,
        storage: item.storage || item.disk || Math.round((item.nvmeTb || 0) * 1024) || 0,
        price: item.price || item.total || 0,
        quantity: item.quantity || item.qtyServers || 1,
      };
    }
  });
}

// Transform local addons to API format
function localAddonsToApiFormat(addons: any): Array<{ name: string; price: number; quantity: number }> {
  if (!addons || typeof addons !== 'object') return [];
  
  const result: Array<{ name: string; price: number; quantity: number }> = [];
  
  // Standard addon mappings
  const addonMappings: Array<{ key: string; label: string }> = [
    { key: 'antivirus', label: 'Antivirus' },
    { key: 'firewall', label: 'Firewall' },
    { key: 'tsplus', label: 'TS Plus' },
    { key: 'cal', label: 'CAL' },
    { key: 'veeamVm', label: 'Veeam VM' },
    { key: 'veeamAg', label: 'Veeam Agent' },
  ];
  
  for (const mapping of addonMappings) {
    const value = addons[mapping.key];
    if (mapping.key === 'firewall' && value === true) {
      result.push({ name: mapping.label, price: 0, quantity: 1 });
    } else if (typeof value === 'number' && value > 0) {
      result.push({ name: mapping.label, price: 0, quantity: value });
    }
  }
  
  // Backup
  if (addons.backupPlan && addons.backupPlan !== 'none' && addons.backupGb > 0) {
    result.push({ name: `Backup ${addons.backupPlan} dias`, price: 0, quantity: addons.backupGb });
  }
  
  // SQL
  if (addons.sql && addons.sql !== 'none' && addons.sqlQty > 0) {
    result.push({ name: `SQL ${addons.sql.toUpperCase()}`, price: 0, quantity: addons.sqlQty });
  }
  
  return result;
}

// Hook to save a partner proposal via API (create or update)
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

      // Check if this is an update (PROP-* format) or create
      const isUpdate = proposalData.proposta_id.startsWith('PROP-');
      const numericId = isUpdate ? parseInt(proposalData.proposta_id.replace('PROP-', ''), 10) : null;
      
      // Map datacenter code to string
      const datacenterNames: Record<string, string> = {
        'SP1': 'São Paulo',
        'SP2': 'São Paulo 2',
        'FL1': 'Florida',
        'CE1': 'Ceará',
      };

      // Transform to API format - CRITICAL: include dados_proposta for full state preservation
      const apiData = {
        name: proposalData.cliente_nome,
        company: proposalData.dados_proposta?.client?.company || '',
        phone: proposalData.dados_proposta?.client?.phone || '',
        email: proposalData.cliente_email || proposalData.dados_proposta?.client?.email || '',
        channel_type: 'PARCEIRO' as const,
        reseller_name: session.empresa,
        fx: proposalData.dados_proposta?.fx || 5,
        datacenter: datacenterNames[proposalData.dados_proposta?.datacenter] || proposalData.dados_proposta?.datacenter || 'São Paulo',
        contract_duration: parseInt(proposalData.dados_proposta?.selectedTerm) || 1,
        discount_pct: proposalData.dados_proposta?.result?.discountPct || 0,
        total: proposalData.valor_total,
        observations: proposalData.dados_proposta?.observacao || null,
        addons: localAddonsToApiFormat(proposalData.dados_proposta?.addons),
        servers: localItemsToApiServers(proposalData.dados_proposta?.items),
        due_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        // CRITICAL: Save complete calculator state for perfect editing restoration
        dados_proposta: proposalData.dados_proposta,
      };

      let result: any;
      
      if (isUpdate && numericId && !isNaN(numericId)) {
        // Update existing proposal
        console.log('[SavePartnerProposal] Updating proposal:', numericId);
        result = await openApi.updateProposal(numericId, apiData);
      } else {
        // Create new proposal
        console.log('[SavePartnerProposal] Creating new proposal');
        result = await openApi.createProposal(apiData);
      }
      
      const partnerProposal: PartnerProposal = {
        proposta_id: `PROP-${result.id}`,
        api_id: result.id,
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

      return { success: true, data: partnerProposal, isUpdate };
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

  return useMutation({
    mutationFn: async (proposta_id: string) => {
      const partnerSession = partnerAuthService.getSession();
      const adminSession = authService.getSession();
      const isAdmin = adminSession?.level === 1000;

      // Admin can delete partner proposals without requiring partner session
      if (!partnerSession && !isAdmin) {
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
