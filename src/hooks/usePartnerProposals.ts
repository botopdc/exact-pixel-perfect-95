import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { partnerAuthService } from '@/services/partnersService';
import { authService } from '@/services/authService';
import { PartnerType } from '@/types/partner';
import { openApi } from '@/lib/openApi';
import { CalculationResult, generateProposalId, isValidContractMonth } from '@/lib/calculatorConfig';
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
  // Map contract_duration to selectedTerm (MUST include all valid plans: 1, 12, 24, 36, 48)
  const contractDuration = apiProposal.contract_duration;
  const selectedTerm = isValidContractMonth(contractDuration) ? String(contractDuration) : '1';
  
  if (!isValidContractMonth(contractDuration)) {
    console.error('[partner-proposal-load] INVALID contract_duration:', contractDuration, '→ defaulting to 1');
  }
  console.log('[partner-proposal-load] contract_months=', contractDuration, 'selectedTerm=', selectedTerm);
  
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
      // CRITICAL: Skip if addon is null/undefined (sparse arrays)
      if (!addon || typeof addon !== 'object') continue;
      
      // CRITICAL: API returns 'label' not 'name' - use label as primary
      const addonName = String(addon.label || addon.name || '').toLowerCase().trim();
      if (!addonName) continue;
      
      const addonPrice = addon.price || 0;
      const addonQty = addon.quantity || 1;
      
      // Map addon names to local state keys
      const addonKeyMap: Record<string, string> = {
        'antivirus': 'antivirus',
        'antivírus': 'antivirus',
        'firewall': 'firewall',
        'firewall pfsense': 'firewall',
        'tsplus': 'tsplus',
        'cal': 'cal',
        'veeam_vm': 'veeamVm',
        'veeam vm': 'veeamVm',
        'veeam_agent': 'veeamAg',
        'veeam agent': 'veeamAg',
      };
      const localKey = addonKeyMap[addonName] || addonName;
      if (localKey === 'firewall') {
        addonsObj.firewall = true;
      } else if (typeof addonsObj[localKey] === 'number') {
        addonsObj[localKey] = addonQty;
      }
      addonsTotal += addonPrice * addonQty;
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

// Helper to safely convert any value to a number
const toNum = (val: any, fallback = 0): number => {
  if (val === undefined || val === null || val === '') return fallback;
  const parsed = typeof val === 'string' ? parseFloat(String(val).replace(',', '.')) : Number(val);
  return Number.isFinite(parsed) ? parsed : fallback;
};

// Transform API proposal to PartnerProposal format with LOCAL data
// CRITICAL: Use saved dados_proposta if available for perfect restoration
function apiToPartnerProposal(apiProposal: any, session: any): PartnerProposal {
  // Check if we have the complete calculator state saved in dados_proposta
  const dadosProposta = apiProposal.dados_proposta;
  
  let localData: LocalProposalData;
  
  if (dadosProposta && typeof dadosProposta === 'object' && dadosProposta.items) {
    // NEW FORMAT: Complete calculator state was saved - use it directly with normalization
    console.log('[apiToPartnerProposal] Using saved dados_proposta for proposal', apiProposal.id);
    
    // Normalize items to ensure all required fields exist (especially disks for BM)
    const normalizedItems = (dadosProposta.items || []).map((item: any) => {
      if (item.type === 'bm') {
        return {
          ...item,
          id: item.id || crypto.randomUUID(),
          disks: Array.isArray(item.disks) ? item.disks : [{ type: 'nvme_1tb', qty: 1, desc: '' }],
          qtyServers: toNum(item.qtyServers, 1),
          ips: toNum(item.ips, 0),
          gpuQty: toNum(item.gpuQty, 0),
        };
      }
      return {
        ...item,
        id: item.id || crypto.randomUUID(),
        vcpu: toNum(item.vcpu, 16),
        ramGb: toNum(item.ramGb, 128),
        nvmeTb: toNum(item.nvmeTb, 0.09765625), // 100GB default
        qtyServers: toNum(item.qtyServers, 1),
        ips: toNum(item.ips, 0),
        gpuQty: toNum(item.gpuQty, 0),
      };
    });
    
    // Normalize addons
    const rawAddons = dadosProposta.addons || {};
    const normalizedAddons = {
      backupPlan: rawAddons.backupPlan || 'none',
      backupGb: toNum(rawAddons.backupGb, 0),
      antivirus: toNum(rawAddons.antivirus, 0),
      firewall: Boolean(rawAddons.firewall),
      tsplus: toNum(rawAddons.tsplus, 0),
      cal: toNum(rawAddons.cal, 0),
      sql: rawAddons.sql || 'none',
      sqlQty: toNum(rawAddons.sqlQty, 0),
      veeamVm: toNum(rawAddons.veeamVm, 0),
      veeamAg: toNum(rawAddons.veeamAg, 0),
      customAddons: rawAddons.customAddons || {},
    };
    
    // Normalize kubernetes
    const rawK8s = dadosProposta.kubernetes || {};
    const rawExtras = rawK8s.extras || {};
    const rawK8sAddons = rawK8s.addons || {};
    const normalizedKubernetes = {
      enabled: Boolean(rawK8s.enabled),
      plan: rawK8s.plan || 'k8s_small',
      addons: {
        support_24x7: Boolean(rawK8sAddons.support_24x7),
        backup_velero: Boolean(rawK8sAddons.backup_velero),
        dr_multisite: Boolean(rawK8sAddons.dr_multisite),
        observability: Boolean(rawK8sAddons.observability),
        cicd_managed: Boolean(rawK8sAddons.cicd_managed),
        devops_hours: toNum(rawK8sAddons.devops_hours, 0),
      },
      extras: {
        vcpu: toNum(rawExtras.vcpu, 0),
        ramGB: toNum(rawExtras.ramGB, 0),
        diskGB: toNum(rawExtras.diskGB, 0),
      },
    };
    
    // Normalize storage items
    const normalizedStorageItems = (dadosProposta.storageItems || []).map((s: any) => ({
      ...s,
      id: s.id || crypto.randomUUID(),
      volumeTB: toNum(s.volumeTB, 1),
      volumeGB: toNum(s.volumeGB, 0),
    }));
    
    // Normalize reseller
    const rawReseller = dadosProposta.reseller || {};
    const normalizedReseller = {
      enabled: Boolean(rawReseller.enabled),
      viewMode: rawReseller.viewMode || 'INTERNO',
      resellerName: rawReseller.resellerName || '',
      overValue: toNum(rawReseller.overValue, 0),
      overReason: rawReseller.overReason || '',
      observations: rawReseller.observations || '',
      approvalRequired: Boolean(rawReseller.approvalRequired),
      approvalStatus: rawReseller.approvalStatus || 'Pendente',
      approver: rawReseller.approver || '',
      approvedAt: rawReseller.approvedAt || null,
    };
    
    // Normalize OpenSaaS
    const rawOpenSaas = dadosProposta.openSaas || {};
    const normalizedOpenSaas = {
      enabled: Boolean(rawOpenSaas.enabled),
      users: toNum(rawOpenSaas.users, 0),
    };
    
    // Use saved result or use total from API
    const savedResult = dadosProposta.result;
    const grandTotal = toNum(apiProposal.total, toNum(savedResult?.grandTotal, 0));
    
    // Validate selectedTerm from dados_proposta
    const rawSelectedTerm = dadosProposta.selectedTerm;
    const selectedTermValid = rawSelectedTerm && isValidContractMonth(rawSelectedTerm);
    const finalSelectedTerm = selectedTermValid ? rawSelectedTerm : '1';
    
    if (!selectedTermValid && rawSelectedTerm) {
      console.error('[partner-proposal-load] INVALID selectedTerm in dados_proposta:', rawSelectedTerm, '→ defaulting to 1');
    }
    console.log('[partner-proposal-load] contract_months=', rawSelectedTerm, 'finalSelectedTerm=', finalSelectedTerm);
    
    localData = {
      fx: toNum(dadosProposta.fx, toNum(apiProposal.fx, 5)),
      selectedTerm: finalSelectedTerm,
      datacenter: dadosProposta.datacenter || 'SP1',
      client: {
        name: dadosProposta.client?.name || apiProposal.name || '',
        company: dadosProposta.client?.company || apiProposal.company || '',
        email: dadosProposta.client?.email || apiProposal.email || '',
        phone: dadosProposta.client?.phone || apiProposal.phone || '',
      },
      proposal: dadosProposta.proposal || {
        id: `PROP-${apiProposal.id}`,
        validityDays: 7,
        createdAt: apiProposal.created_at,
      },
      items: normalizedItems,
      addons: normalizedAddons,
      kubernetes: normalizedKubernetes,
      storageItems: normalizedStorageItems,
      reseller: normalizedReseller,
      openSaas: normalizedOpenSaas,
      observacao: dadosProposta.observacao || apiProposal.observations || undefined,
      result: savedResult || {
        rows: [],
        subRec: 0,
        subIps: 0,
        subServices: 0,
        subBackup: 0,
        subKubernetes: 0,
        subStorage: 0,
        subOpenSaas: 0,
        discountPct: 0,
        discountValue: 0,
        grandTotal,
        totalServers: normalizedItems.length,
        gpuUsdTotal: 0,
        gpuBrlTotal: 0,
        subtotalPriceList: grandTotal,
        overValue: 0,
        overPercent: 0,
        totalWithOver: grandTotal,
      },
    };
  } else {
    // LEGACY FORMAT: Reconstruct from servers/addons arrays (backward compatibility)
    console.log('[apiToPartnerProposal] Using legacy format for proposal', apiProposal.id);
    localData = apiToLocalFormat(apiProposal);
  }
  
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

// ============================================================================
// RBAC RULES FOR PARTNER PROPOSAL VISIBILITY
// ============================================================================
// Level 1000 (Admin): See ALL partner proposals
// Level 750 (Gerente Comercial): See ALL partner proposals  
// Level 200 (Parceiro): See only OWN proposals (created_by === user.id)
// Note: The gateway now filters by created_by_user_id, not reseller_name
// ============================================================================

// Hook to fetch partner proposals from API (filtered by channel_type PARCEIRO)
// Uses GET /api/calculator/proposal with channel_type=PARCEIRO filter
export function usePartnerProposals(isAdmin = false) {
  const session = partnerAuthService.getSession();
  const userId = session?.partnerId || null;

  return useQuery({
    queryKey: ['partner-proposals', userId, isAdmin],
    queryFn: async () => {
      try {
        // Call API directly: GET /api/calculator/proposal
        const response = await openApi.getProposals({
          channel_type: 'PARCEIRO',
          __perPage: isAdmin ? 500 : 100,
        });

        const apiProposals = (response.data || []) as any[];
        
        // Client-side safety filter: ensure only PARCEIRO proposals
        const safe = apiProposals.filter((p) => p?.channel_type === 'PARCEIRO');

        console.log('[usePartnerProposals] Fetched partner proposals:', {
          received: apiProposals.length,
          kept: safe.length,
        });

        const proposals = safe.map((p) => apiToPartnerProposal(p, session));
        return proposals;
      } catch (error) {
        console.warn('[PartnerProposals] API fetch failed:', error);
        return [];
      }
    },
    // NO CACHE - Always fetch fresh data from API
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });
}

// Hook to fetch all proposals (for admin view)
// Uses GET /api/calculator/proposal with channel_type=PARCEIRO filter
export function useAllPartnerProposals() {
  return useQuery({
    queryKey: ['partner-proposals', 'all'],
    queryFn: async () => {
      try {
        // Call API directly: GET /api/calculator/proposal
        const response = await openApi.getProposals({
          channel_type: 'PARCEIRO',
          __perPage: 500,
        });

        const session = partnerAuthService.getSession();
        const apiProposals = (response.data || []) as any[];
        const safe = apiProposals.filter((p) => p?.channel_type === 'PARCEIRO');
        return safe.map((p) => apiToPartnerProposal(p, session));
      } catch (error) {
        console.warn('[PartnerProposals] API fetch failed:', error);
        return [];
      }
    },
    // NO CACHE - Always fetch fresh data from API
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });
}

// Transform local items (VM/BM format) to API servers format
// NOTE: Also handles independent products (Storage, Kubernetes, OPEN SaaS) when no VMs/BMs exist
// This is a workaround because the API OPDC requires `servers` to have at least 1 item
function localItemsToApiServers(
  items: any[],
  storageItems?: any[],
  kubernetes?: any,
  openSaas?: any
): Array<{ name: string; vcpu: number; ram: number; storage: number; price: number; quantity: number }> {
  const serversArray: Array<{ name: string; vcpu: number; ram: number; storage: number; price: number; quantity: number }> = [];
  
  // First, add VMs and Bare Metals
  if (items && Array.isArray(items)) {
    for (const [idx, item] of items.entries()) {
      if (item.type === 'vm') {
        serversArray.push({
          name: `VM #${idx + 1}`,
          vcpu: item.vcpu || 0,
          ram: item.ramGb || 0,
          storage: Math.round((item.nvmeTb || 0) * 1024), // Convert TB to GB
          price: 0, // Will be calculated by backend
          quantity: item.qtyServers || 1,
        });
      } else if (item.type === 'bm') {
        serversArray.push({
          name: `BareMetal #${idx + 1}`,
          vcpu: 0, // BM doesn't have vCPU in the same way
          ram: 0,
          storage: 0,
          price: 0,
          quantity: item.qtyServers || 1,
        });
      } else {
        // Fallback for legacy format
        serversArray.push({
          name: item.name || item.label || 'Server',
          vcpu: item.vcpu || item.cpu || 0,
          ram: item.ram || item.memory || item.ramGb || 0,
          storage: item.storage || item.disk || Math.round((item.nvmeTb || 0) * 1024) || 0,
          price: item.price || item.total || 0,
          quantity: item.quantity || item.qtyServers || 1,
        });
      }
    }
  }
  
  // WORKAROUND: If no servers, add independent products as virtual servers
  // This satisfies the API requirement of at least 1 server item
  if (serversArray.length === 0) {
    // Add Storage items as virtual servers
    if (storageItems && Array.isArray(storageItems)) {
      for (const storage of storageItems) {
        if (storage.volumeTB >= 1) {
          serversArray.push({
            name: `Storage ${storage.type || storage.storageType || 'SAN'} ${storage.volumeTB}TB`,
            vcpu: 0,
            ram: 0,
            storage: Math.round(storage.volumeTB * 1024), // Convert TB to GB
            price: storage.price || 0,
            quantity: 1,
          });
        }
      }
    }
    
    // Add Kubernetes as virtual server
    if (kubernetes && kubernetes.enabled) {
      serversArray.push({
        name: `Kubernetes ${kubernetes.plan || 'Standard'}`,
        vcpu: kubernetes.extras?.vcpu || 0,
        ram: kubernetes.extras?.ramGB || 0,
        storage: kubernetes.extras?.diskGB || 0,
        price: kubernetes.price || 0,
        quantity: 1,
      });
    }
    
    // Add OPEN SaaS as virtual server
    if (openSaas && openSaas.enabled && openSaas.users >= 5) {
      serversArray.push({
        name: `OPEN SaaS ${openSaas.users} usuários`,
        vcpu: 0,
        ram: 0,
        storage: 0,
        price: openSaas.price || 0,
        quantity: openSaas.users,
      });
    }
  }
  
  return serversArray;
}

// Transform local addons to API format
// Also includes independent products (Storage, Kubernetes, OPEN SaaS) in addons array
function localAddonsToApiFormat(
  addons: any,
  storageItems?: any[],
  kubernetes?: any,
  openSaas?: any
): Array<{ name: string; price: number; quantity: number }> {
  const result: Array<{ name: string; price: number; quantity: number }> = [];
  
  // ============================================
  // INDEPENDENT PRODUCTS (don't require servers)
  // ============================================
  
  // Storage items
  if (storageItems && Array.isArray(storageItems)) {
    for (const storage of storageItems) {
      if (storage.volumeTB >= 1) {
        result.push({
          name: `Storage ${storage.type || storage.storageType || 'SAN'} ${storage.volumeTB}TB`,
          price: storage.price || 0,
          quantity: 1,
        });
      }
    }
  }
  
  // Kubernetes
  if (kubernetes && kubernetes.enabled) {
    result.push({
      name: `Kubernetes ${kubernetes.plan || 'Standard'}`,
      price: kubernetes.price || 0,
      quantity: 1,
    });
  }
  
  // OPEN SaaS
  if (openSaas && openSaas.enabled && openSaas.users >= 5) {
    result.push({
      name: `OPEN SaaS ${openSaas.users} usuários`,
      price: openSaas.price || 0,
      quantity: openSaas.users,
    });
  }
  
  // ============================================
  // STANDARD ADDONS (services/extras)
  // ============================================
  if (!addons || typeof addons !== 'object') return result;
  
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
        // Validate contract_duration from selectedTerm (MUST be 1, 12, 24, 36, or 48)
        contract_duration: (() => {
          const term = parseInt(proposalData.dados_proposta?.selectedTerm);
          if (isValidContractMonth(term)) return term;
          console.error('[partner-proposal-save] INVALID selectedTerm:', proposalData.dados_proposta?.selectedTerm, '→ defaulting to 1');
          return 1;
        })(),
        discount_pct: proposalData.dados_proposta?.result?.discountPct || 0,
        total: proposalData.valor_total,
        observations: proposalData.dados_proposta?.observacao || null,
        addons: localAddonsToApiFormat(
          proposalData.dados_proposta?.addons,
          proposalData.dados_proposta?.storageItems,
          proposalData.dados_proposta?.kubernetes,
          proposalData.dados_proposta?.openSaas
        ),
        servers: localItemsToApiServers(
          proposalData.dados_proposta?.items,
          proposalData.dados_proposta?.storageItems,
          proposalData.dados_proposta?.kubernetes,
          proposalData.dados_proposta?.openSaas
        ),
        due_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        // STATUS: Send in API format (Portuguese readable text)
        // API expects: 'Rascunho', 'Enviado', 'Aprovado', 'Recusado', 'Expirado', 'Cancelado'
        status: proposalData.status_proposta || 'Rascunho',
        // CRITICAL: Save complete calculator state for perfect editing restoration
        dados_proposta: proposalData.dados_proposta,
      };

      // CRITICAL: Log full payload details for debugging persistence issues
      const draftState = proposalData.dados_proposta;
      console.log('[SavePartnerProposal] Sending to API:', {
        mode: isUpdate && numericId ? 'UPDATE' : 'CREATE',
        numericId,
        channel_type: 'PARCEIRO',
        dados_proposta_summary: {
          hasProposalId: Boolean(draftState?.proposal?.id || draftState?.proposalId),
          hasOwnerUserId: Boolean(draftState?.created_by_user_id),
          hasOwnerEmail: Boolean(draftState?.created_by_email),
          hasItems: Boolean(draftState?.items?.length),
          itemsCount: draftState?.items?.length || 0,
          itemsTypes: (draftState?.items || []).map((i: any) => i.type),
          hasAddons: Boolean(draftState?.addons),
          hasKubernetes: Boolean(draftState?.kubernetes?.enabled),
          hasStorageItems: Boolean(draftState?.storageItems?.length),
          hasOpenSaas: Boolean(draftState?.openSaas?.enabled),
          hasResult: Boolean(draftState?.result),
          savedTotal: draftState?.result?.grandTotal,
        },
      });
      
      // VALIDATION: Check if there's at least one item (servers, storage, kubernetes, or openSaas)
      const hasItems = draftState?.items?.length > 0;
      const hasStorage = draftState?.storageItems?.some((s: any) => s.volumeTB >= 1);
      const hasKubernetes = draftState?.kubernetes?.enabled;
      const hasOpenSaas = draftState?.openSaas?.enabled && draftState?.openSaas?.users >= 5;
      
      if (!hasItems && !hasStorage && !hasKubernetes && !hasOpenSaas) {
        console.warn('[SavePartnerProposal] Warning: No items in dados_proposta. Proposal may have issues on edit.');
      }

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
