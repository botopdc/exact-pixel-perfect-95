import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CalculationResult, ClientInfo, ProposalMeta, AddonsState } from '@/lib/calculatorConfig';
import { openApi } from '@/lib/openApi';
import type { SummaryRow } from '@/lib/calculatorConfig';

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
  observacao?: string;
  // RBAC fields from API (critical for access control)
  created_by?: number | null;
  creator?: {
    id: number;
    email: string;
    name: string;
    level: number;
  } | null;
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
  // Status fields (persisted at API level)
  proposal_status?: string; // '', 'E', 'A', 'R' (Enviado, Aprovado, Recusado)
  status_sent_at?: string;
  status_accepted_at?: string;
  status_rejected_at?: string;
  acceptance_channel?: string;
  acceptance_id?: string;
  // RBAC fields from API (critical for access control)
  created_by?: number | null; // ID of the user who created the proposal
  creator?: {
    id: number;
    email: string;
    name: string;
    level: number;
  } | null; // User object from __with=creator expansion
  // Owner tracking (from dados_proposta - legacy, still supported)
  dados_proposta?: {
    created_by_user_id?: number;
    created_by_email?: string;
    created_by_name?: string;
    created_by_level?: number;
    // Status can also be stored in dados_proposta for fallback
    status?: string;
    acceptance?: ProposalAcceptance;
    [key: string]: any;
  };
}

// Helper to safely convert any value to a number
const toNum = (val: any, fallback = 0): number => {
  if (val === undefined || val === null || val === '') return fallback;
  const parsed = typeof val === 'string' ? parseFloat(String(val).replace(',', '.')) : Number(val);
  return Number.isFinite(parsed) ? parsed : fallback;
};

// Transform API proposal to local format - PRESERVES COMPLETE DATA from dados_proposta if available
function apiToLocal(apiProposal: ApiProposal): SavedProposal {
  // Check if we have the complete calculator state saved in dados_proposta (new format)
  const dadosProposta = (apiProposal as any).dados_proposta;
  
  // Log status resolution for debugging
  console.log('[apiToLocal] Processing proposal', apiProposal.id, {
    proposal_status: apiProposal.proposal_status,
    dados_proposta_status: dadosProposta?.status,
    status_accepted_at: apiProposal.status_accepted_at,
    status_rejected_at: apiProposal.status_rejected_at,
  });
  
  if (dadosProposta && typeof dadosProposta === 'object') {
    // NEW FORMAT: Complete calculator state was saved - use it directly with normalization
    console.log('[apiToLocal] Using complete dados_proposta for proposal', apiProposal.id);
    
    // Normalize items to ensure all required fields exist (especially disks for BM)
    const normalizedItems = (dadosProposta.items || []).map((item: any) => {
      if (item.type === 'bm') {
        return {
          ...item,
          disks: Array.isArray(item.disks) ? item.disks : [{ type: 'nvme_1tb', qty: 1, desc: '' }],
          qtyServers: toNum(item.qtyServers, 1),
          ips: toNum(item.ips, 0),
          gpuQty: toNum(item.gpuQty, 0),
        };
      }
      return {
        ...item,
        vcpu: toNum(item.vcpu, 16),
        ramGb: toNum(item.ramGb, 128),
        nvmeTb: toNum(item.nvmeTb, 0.05),
        qtyServers: toNum(item.qtyServers, 1),
        ips: toNum(item.ips, 0),
        gpuQty: toNum(item.gpuQty, 0),
      };
    });
    
    // Normalize addons
    const rawAddons = dadosProposta.addons || {};
    const normalizedAddons: AddonsState = {
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
    
    // Resolve status: prioritize API-level fields, then dados_proposta
    const resolvedStatus = (
      apiProposal.proposal_status || 
      dadosProposta.status || 
      ''
    ) as ProposalStatus;
    
    // Resolve acceptance info
    const resolvedAcceptance: ProposalAcceptance | undefined = dadosProposta.acceptance || (
      (apiProposal.status_accepted_at || apiProposal.status_rejected_at) ? {
        id: apiProposal.acceptance_id || '',
        acceptedAt: apiProposal.status_accepted_at,
        rejectedAt: apiProposal.status_rejected_at,
        channel: (apiProposal.acceptance_channel || 'public_url') as 'public_url' | 'ui' | 'email',
      } : undefined
    );
    
    return {
      id: apiProposal.id,
      fx: toNum(dadosProposta.fx, toNum(apiProposal.fx, 5)),
      selectedTerm: dadosProposta.selectedTerm || '1',
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
      total: grandTotal,
      savedAt: apiProposal.created_at,
      status: resolvedStatus,
      acceptance: resolvedAcceptance,
      observacao: dadosProposta.observacao || apiProposal.observations || undefined,
      // RBAC fields from API - critical for access control
      created_by: apiProposal.created_by ?? null,
      creator: apiProposal.creator ?? null,
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
  }
  
  // LEGACY FORMAT: Reconstruct from servers/addons arrays (backward compatibility)
  console.log('[apiToLocal] Using legacy format for proposal', apiProposal.id);
  
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
  
  // Transform API addons array to legacy addons object format for display
  const addonsObj: Record<string, { enabled: boolean; price: number; quantity: number }> = {};
  let addonsTotal = 0;
  if (apiProposal.addons && Array.isArray(apiProposal.addons)) {
    for (const addon of apiProposal.addons) {
      if (addon.name) {
        const addonPrice = toNum(addon.price, 0);
        const addonQty = toNum(addon.quantity, 1);
        addonsObj[addon.name] = {
          enabled: true,
          price: addonPrice,
          quantity: addonQty,
        };
        addonsTotal += addonPrice * addonQty;
      }
    }
  }
  
  // Transform API servers array to local items format + build rows for result
  const rows: Array<{ label: string; qty: string | number; unitPrice: number; subtotal: number }> = [];
  let serversSubtotal = 0;
  
  const items = (apiProposal.servers || []).map((server: any, idx: number) => {
    const serverName = server.name || 'Server';
    const price = toNum(server.price, 0);
    const quantity = toNum(server.quantity, 1);
    const subtotal = price * quantity;
    
    // Build display label with specs
    const vcpu = toNum(server.vcpu, 0);
    const ram = toNum(server.ram, 0);
    const storage = toNum(server.storage, 0);
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
    
    // Detect if VM or BareMetal based on name
    const isVM = serverName.toLowerCase().includes('vm') || vcpu > 0;
    
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
        disks: [{ type: 'nvme_1tb', qty: 1, desc: '' }], // Always initialize disks array
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
        const addonPrice = toNum(addon.price, 0);
        const addonQty = toNum(addon.quantity, 1);
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
  const discountPct = toNum(apiProposal.discount_pct, 0);
  const subtotalBeforeDiscount = serversSubtotal + addonsTotal;
  const discountValue = subtotalBeforeDiscount * discountPct;
  const grandTotal = toNum(apiProposal.total, subtotalBeforeDiscount - discountValue);
  
  // Build the result object
  const result: CalculationResult = {
    rows,
    subRec: serversSubtotal,
    subIps: 0, // Not stored in API
    subServices: addonsTotal,
    subBackup: 0, // Not stored in API
    subKubernetes: 0, // Not stored in API
    subStorage: 0, // Not stored in API
    subOpenSaas: 0, // Not stored in API
    discountPct,
    discountValue,
    grandTotal,
    totalServers: items.length,
    gpuUsdTotal: 0, // Not stored in API
    gpuBrlTotal: 0, // Not stored in API
    subtotalPriceList: subtotalBeforeDiscount,
    overValue: 0,
    overPercent: 0,
    totalWithOver: grandTotal,
  };
  
  // Resolve status for legacy format
  const resolvedStatus = (apiProposal.proposal_status || '') as ProposalStatus;
  const resolvedAcceptance: ProposalAcceptance | undefined = (
    (apiProposal.status_accepted_at || apiProposal.status_rejected_at) ? {
      id: apiProposal.acceptance_id || '',
      acceptedAt: apiProposal.status_accepted_at,
      rejectedAt: apiProposal.status_rejected_at,
      channel: (apiProposal.acceptance_channel || 'public_url') as 'public_url' | 'ui' | 'email',
    } : undefined
  );
  
  return {
    id: apiProposal.id,
    fx: toNum(apiProposal.fx, 5),
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
    kubernetes: {},
    storageItems: [],
    reseller: apiProposal.reseller_name ? {
      enabled: true,
      viewMode: 'INTERNO' as const,
      resellerName: apiProposal.reseller_name,
      overValue: toNum(apiProposal.commission_value, 0),
      overReason: apiProposal.commission_reason || '',
      observations: '',
      approvalRequired: false,
      approvalStatus: 'Pendente' as const,
      approver: '',
      approvedAt: null,
    } : undefined,
    total: grandTotal,
    savedAt: apiProposal.created_at,
    status: resolvedStatus,
    acceptance: resolvedAcceptance,
    observacao: apiProposal.observations || undefined,
    // RBAC fields from API - critical for access control
    created_by: apiProposal.created_by ?? null,
    creator: apiProposal.creator ?? null,
    result,
  };
}

// Transform local proposal to API format - SAVES COMPLETE DATA in dados_proposta
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
  
  // Calculate discount percentage from result if available (API expects 0-1 range)
  const discountPct = proposal.result?.discountPct || 0;
  
  // Calculate due_at (proposal validity)
  const validityDays = proposal.proposal?.validityDays || 7;
  const createdAt = proposal.proposal?.createdAt || proposal.savedAt || new Date().toISOString();
  const dueAt = new Date(createdAt);
  dueAt.setDate(dueAt.getDate() + validityDays);
  
  // Transform addons to API format: array of {name, price, quantity}
  // Note: The full addons state is saved in dados_proposta, this is just for API compatibility
  const addonsArray: Array<{ name: string; price: number; quantity: number }> = [];
  if (proposal.addons && typeof proposal.addons === 'object') {
    const addons = proposal.addons;
    
    // Standard addon mappings with proper type handling
    if (typeof addons.antivirus === 'number' && addons.antivirus > 0) {
      addonsArray.push({ name: 'Antivirus', price: 0, quantity: addons.antivirus });
    }
    if (addons.firewall === true) {
      addonsArray.push({ name: 'Firewall', price: 0, quantity: 1 });
    }
    if (typeof addons.tsplus === 'number' && addons.tsplus > 0) {
      addonsArray.push({ name: 'TS Plus', price: 0, quantity: addons.tsplus });
    }
    if (typeof addons.cal === 'number' && addons.cal > 0) {
      addonsArray.push({ name: 'CAL', price: 0, quantity: addons.cal });
    }
    if (typeof addons.veeamVm === 'number' && addons.veeamVm > 0) {
      addonsArray.push({ name: 'Veeam VM', price: 0, quantity: addons.veeamVm });
    }
    if (typeof addons.veeamAg === 'number' && addons.veeamAg > 0) {
      addonsArray.push({ name: 'Veeam Agent', price: 0, quantity: addons.veeamAg });
    }
    // Backup
    if (addons.backupPlan && addons.backupPlan !== 'none' && typeof addons.backupGb === 'number' && addons.backupGb > 0) {
      addonsArray.push({ name: `Backup ${addons.backupPlan}`, price: 0, quantity: addons.backupGb });
    }
    // SQL
    if (addons.sql && addons.sql !== 'none' && typeof addons.sqlQty === 'number' && addons.sqlQty > 0) {
      addonsArray.push({ name: `SQL ${addons.sql.toUpperCase()}`, price: 0, quantity: addons.sqlQty });
    }
    // Custom addons (legacy support)
    if (addons.customAddons && typeof addons.customAddons === 'object') {
      for (const [key, value] of Object.entries(addons.customAddons)) {
        if (typeof value === 'object' && value !== null) {
          const addon = value as { enabled?: boolean; price?: number; quantity?: number };
          if (addon.enabled) {
            addonsArray.push({ name: key, price: addon.price || 0, quantity: addon.quantity || 1 });
          }
        } else if (typeof value === 'number' && value > 0) {
          addonsArray.push({ name: key, price: 0, quantity: value });
        }
      }
    }
  }
  
  // Transform servers/items to API format: array of {name, vcpu, ram, storage, price, quantity}
  const serversArray: Array<{ name: string; vcpu: number; ram: number; storage: number; price: number; quantity: number }> = [];
  if (proposal.items && Array.isArray(proposal.items)) {
    for (const [idx, item] of proposal.items.entries()) {
      // Handle VM/BM format from calculator
      if (item.type === 'vm') {
        serversArray.push({
          name: `VM #${idx + 1}`,
          vcpu: item.vcpu || 0,
          ram: item.ramGb || 0,
          storage: Math.round((item.nvmeTb || 0) * 1024), // Convert TB to GB
          price: 0,
          quantity: item.qtyServers || 1,
        });
      } else if (item.type === 'bm') {
        serversArray.push({
          name: `BareMetal #${idx + 1}`,
          vcpu: 0,
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
          storage: item.storage || item.disk || item.nvme || Math.round((item.nvmeTb || 0) * 1024) || 0,
          price: item.price || item.total || item.monthlyPrice || 0,
          quantity: item.quantity || item.qtyServers || 1,
        });
      }
    }
  }
  
  // Build complete dados_proposta object with ALL calculator state
  // This ensures we can restore the exact proposal when editing
  // CRITICAL: dados_proposta is the SOURCE OF TRUTH - do not save just the total!
  const dadosProposta = {
    // Unique proposal identifiers
    proposalId: proposal.proposal?.id,
    
    // Owner tracking (required)
    created_by_user_id: proposal.result?.grandTotal ? (proposal as any).created_by_user_id : undefined,
    created_by_email: (proposal as any).created_by_email,
    created_by_name: (proposal as any).created_by_name,
    created_by_level: (proposal as any).created_by_level,
    created_by_role: (proposal as any).created_by_role,
    
    // Configuration
    fx: proposal.fx,
    selectedTerm: proposal.selectedTerm,
    datacenter: proposal.datacenter,
    
    // Client info
    client: proposal.client,
    
    // Proposal meta
    proposal: proposal.proposal,
    
    // ALL items with complete data (VMs, BareMetals with disks, etc)
    items: proposal.items, // Complete items with all fields
    
    // ALL addons
    addons: proposal.addons, // Complete addons object
    
    // Kubernetes complete state
    kubernetes: proposal.kubernetes, // Complete kubernetes state
    
    // Storage items complete
    storageItems: proposal.storageItems, // Complete storage items
    
    // Reseller/Commission state
    reseller: proposal.reseller, // Complete reseller state
    
    // OpenSaaS state
    openSaas: proposal.openSaas, // Complete OpenSaaS state
    
    // Computed result (for reference and validation)
    result: proposal.result, // Complete calculation result
    
    // Observation
    observacao: proposal.observacao,
    
    // Status fields (persisted in dados_proposta as fallback)
    status: proposal.status || '',
    acceptance: proposal.acceptance,
  };
  
  // IMPORTANT: This hook is used by EXECUTIVES (level 700+), so channel_type is always CLIENTE
  // Partner proposals use useSavePartnerProposal which sets channel_type: PARCEIRO
  return {
    name: proposal.client?.name || '',
    company: proposal.client?.company || '',
    phone: proposal.client?.phone || '',
    email: proposal.client?.email || '',
    channel_type: 'CLIENTE', // Executive proposals are always CLIENTE
    reseller_name: proposal.reseller?.resellerName || null,
    commission_value: proposal.reseller?.overValue || null,
    commission_reason: proposal.reseller?.overReason || null,
    observations: proposal.observacao || null,
    fx: proposal.fx || 5,
    datacenter: datacenterNames[proposal.datacenter || 'SP1'] || 'São Paulo',
    contract_duration: contractDuration,
    discount_pct: discountPct,
    total: proposal.total || proposal.result?.grandTotal || 0,
    addons: addonsArray.length > 0 ? addonsArray : null,
    servers: serversArray,
    due_at: dueAt.toISOString(),
    // STATUS FIELDS - persisted at API level for proper filtering
    // proposal_status is the CANONICAL source of truth: '', 'E', 'A', 'R'
    proposal_status: proposal.status || '',
    // Only set status_sent_at on first send transition
    status_sent_at: proposal.acceptance?.acceptedAt 
      ? undefined 
      : proposal.acceptance?.rejectedAt 
        ? undefined 
        : proposal.status === 'E' 
          ? new Date().toISOString() 
          : undefined,
    // Acceptance timestamps from acceptance object
    status_accepted_at: proposal.acceptance?.acceptedAt || undefined,
    status_rejected_at: proposal.acceptance?.rejectedAt || undefined,
    acceptance_channel: proposal.acceptance?.channel || undefined,
    acceptance_id: proposal.acceptance?.id || undefined,
    // CRITICAL: Save complete calculator state for perfect editing restoration
    dados_proposta: dadosProposta,
  };
}

// ============================================================================
// RBAC RULES FOR PROPOSAL VISIBILITY
// ============================================================================
// Level 1000 (Admin): See ALL proposals
// Level 750 (Gerente Comercial): See ALL proposals
// Level 775 (CS): See only OWN proposals (created_by === user.id)
// Level 700 (Executivo): See only OWN proposals (created_by === user.id)
// Level 200 (Parceiro): See only OWN proposals (created_by === user.id AND channel_type === PARCEIRO)
// Level 1 (Cliente): See only proposals where proposal.email === user.email
// Other levels (600, 900, 950): No access
// ============================================================================

function canSeeAllProposals(level: number): boolean {
  return level === 1000 || level === 750;
}

// Hook to fetch executive proposals from API (excludes partner proposals)
export function useProposals(page = 1, perPage = 100) {
  return useQuery({
    queryKey: ['proposals', 'api', 'executive', page, perPage],
    queryFn: async () => {
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const token = openApi.getToken();
        if (!token) throw new Error('Sem token de autenticação');

        const params = new URLSearchParams({
          scope: 'CLIENTE',
          __page: String(page),
          __perPage: String(perPage),
        });

        const resp = await fetch(`${supabaseUrl}/functions/v1/proposal-gateway/proposals?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const payload = await resp.json();
        if (!resp.ok || payload?.success === false) {
          throw new Error(payload?.error || 'Falha ao listar propostas');
        }

        // The gateway already applies RBAC filtering based on user level
        // We just receive the filtered list
        const apiProposals = (payload.data || []) as ApiProposal[];
        const ownership = payload.ownership || {};
        
        // Additional client-side safety filter: ensure only CLIENTE proposals
        const safe = apiProposals.filter((p) => p?.channel_type === 'CLIENTE');

        console.log('[useProposals] Fetched executive proposals:', {
          received: apiProposals.length,
          kept: safe.length,
          ownership,
          canSeeAll: ownership.can_see_all,
        });

        return safe.map(apiToLocal);
      } catch (error) {
        console.warn('[Proposals] API fetch failed, returning empty:', error);
        return [];
      }
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

// Hook to fetch executive proposals with pagination info (excludes partner proposals)
// RBAC filtering is done server-side in the gateway
export function useProposalsPaginated(page = 1, perPage = 20) {
  return useQuery({
    queryKey: ['proposals', 'api', 'executive', 'paginated', page, perPage],
    queryFn: async () => {
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const token = openApi.getToken();
        if (!token) throw new Error('Sem token de autenticação');

        const params = new URLSearchParams({
          scope: 'CLIENTE',
          __page: String(page),
          __perPage: String(perPage),
        });

        const resp = await fetch(`${supabaseUrl}/functions/v1/proposal-gateway/proposals?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const payload = await resp.json();
        if (!resp.ok || payload?.success === false) {
          throw new Error(payload?.error || 'Falha ao listar propostas');
        }

        // The gateway already applies RBAC filtering
        const apiProposals = (payload.data || []) as ApiProposal[];
        const ownership = payload.ownership || {};
        
        // Additional client-side safety filter
        const safe = apiProposals.filter((p) => p?.channel_type === 'CLIENTE');

        console.log('[useProposalsPaginated] Fetched executive proposals:', {
          received: apiProposals.length,
          kept: safe.length,
          ownership,
        });

        const proposals = safe.map(apiToLocal);
        return {
          proposals,
          pagination: {
            currentPage: page,
            lastPage: Math.ceil((payload.total || 0) / perPage) || 1,
            total: payload.total || 0,
          },
        };
      } catch (error) {
        console.warn('[Proposals] API fetch failed:', error);
        return {
          proposals: [],
          pagination: { currentPage: 1, lastPage: 1, total: 0 },
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

      // Resolve numeric ID (edit mode)
      let numericId: number | null = null;

      if (proposal.id && typeof proposal.id === 'number') {
        numericId = proposal.id;
      } else if (proposal.proposal?.id) {
        const propId = proposal.proposal.id;
        if (propId.startsWith('PROP-')) {
          const parsed = parseInt(propId.replace('PROP-', ''), 10);
          if (!isNaN(parsed)) numericId = parsed;
        } else {
          const parsed = parseInt(propId, 10);
          if (!isNaN(parsed)) numericId = parsed;
        }
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const token = openApi.getToken();
      if (!token) throw new Error('Sem token de autenticação');

      const scope = 'CLIENTE';
      const url = numericId
        ? `${supabaseUrl}/functions/v1/proposal-gateway/proposal/${numericId}?scope=${scope}`
        : `${supabaseUrl}/functions/v1/proposal-gateway/proposal?scope=${scope}`;

      // CRITICAL: Log full payload details for debugging persistence issues
      const dadosProposta = (apiData as any).dados_proposta;
      console.log('[SaveProposal] Sending to gateway:', {
        mode: numericId ? 'UPDATE' : 'CREATE',
        numericId,
        intended_channel_type: 'CLIENTE',
        payload_channel_type: (apiData as any).channel_type,
        // Validate dados_proposta contains all required data
        dados_proposta_summary: {
          hasProposalId: Boolean(dadosProposta?.proposalId),
          hasOwnerUserId: Boolean(dadosProposta?.created_by_user_id),
          hasOwnerEmail: Boolean(dadosProposta?.created_by_email),
          hasItems: Boolean(dadosProposta?.items?.length),
          itemsCount: dadosProposta?.items?.length || 0,
          itemsTypes: (dadosProposta?.items || []).map((i: any) => i.type),
          hasAddons: Boolean(dadosProposta?.addons),
          hasKubernetes: Boolean(dadosProposta?.kubernetes?.enabled),
          hasStorageItems: Boolean(dadosProposta?.storageItems?.length),
          hasOpenSaas: Boolean(dadosProposta?.openSaas?.enabled),
          hasResult: Boolean(dadosProposta?.result),
          savedTotal: dadosProposta?.result?.grandTotal,
        },
      });
      
      // VALIDATION: Ensure dados_proposta has items before saving
      if (!dadosProposta?.items?.length) {
        console.error('[SaveProposal] ERROR: No items in dados_proposta! This will cause issues on edit.');
      }

      const resp = await fetch(url, {
        method: numericId ? 'PUT' : 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'x-open-module': 'internal',
        },
        body: JSON.stringify(apiData),
      });

      const payload = await resp.json();
      if (!resp.ok || payload?.success === false) {
        throw new Error(payload?.error || 'Falha ao salvar proposta');
      }

      console.log('[SaveProposal] Gateway response ownership:', payload.ownership);
      return { success: true, data: payload.data, isUpdate: Boolean(numericId) };
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

// Hook to update proposal status only - THE CANONICAL WAY to change proposal status
// Status values: '' (Sem status), 'E' (Enviado), 'A' (Aprovado), 'R' (Recusado)
export function useUpdateProposalStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status, acceptance }: { 
      id: string; 
      status: ProposalStatus;
      acceptance?: ProposalAcceptance;
    }) => {
      console.log('[useUpdateProposalStatus] Starting update:', { id, status, acceptance });
      
      // Parse numeric ID - try direct parse first
      let numericId = parseInt(id, 10);
      let existing: ApiProposal | undefined;
      
      // If direct parse worked, fetch by ID
      if (!isNaN(numericId)) {
        console.log('[useUpdateProposalStatus] Fetching by numeric ID:', numericId);
        existing = await openApi.getProposal(numericId) as ApiProposal;
      } else {
        // Fallback: search by PROP-ID format
        console.log('[useUpdateProposalStatus] Searching by PROP-ID format:', id);
        const response = await openApi.getProposals({ __perPage: 500 });
        existing = (response.data as ApiProposal[]).find(p => `PROP-${p.id}` === id);
        if (existing) {
          numericId = existing.id;
        }
      }
      
      if (!existing) {
        console.error('[useUpdateProposalStatus] Proposal not found:', id);
        throw new Error('Proposta não encontrada');
      }
      
      console.log('[useUpdateProposalStatus] Found proposal:', existing.id, 'Current status:', existing.proposal_status);
      
      // Build the minimal update payload with ONLY status fields
      // This ensures we don't accidentally overwrite other data
      const updatePayload: Record<string, unknown> = {
        // Required fields for API
        name: existing.name,
        company: existing.company,
        phone: existing.phone,
        email: existing.email,
        fx: existing.fx,
        datacenter: existing.datacenter,
        contract_duration: existing.contract_duration,
        discount_pct: existing.discount_pct,
        total: existing.total,
        due_at: existing.due_at,
        channel_type: existing.channel_type,
        // Preserve servers/addons/dados_proposta
        servers: existing.servers,
        addons: existing.addons,
        // Update dados_proposta with new status
        dados_proposta: {
          ...(existing.dados_proposta || {}),
          status: status,
          acceptance: acceptance || (existing.dados_proposta as any)?.acceptance,
        },
        // STATUS FIELDS - the canonical source of truth
        proposal_status: status,
        // Preserve existing sent_at or set new one
        status_sent_at: status === 'E' 
          ? (existing.status_sent_at || new Date().toISOString())
          : existing.status_sent_at,
        // Set accepted_at if accepting
        status_accepted_at: status === 'A' 
          ? (acceptance?.acceptedAt || new Date().toISOString())
          : existing.status_accepted_at,
        // Set rejected_at if rejecting
        status_rejected_at: status === 'R' 
          ? (acceptance?.rejectedAt || new Date().toISOString())
          : existing.status_rejected_at,
        // Acceptance metadata
        acceptance_channel: acceptance?.channel || existing.acceptance_channel,
        acceptance_id: acceptance?.id || existing.acceptance_id,
      };
      
      console.log('[useUpdateProposalStatus] Updating proposal', numericId, 'with status:', status, {
        proposal_status: updatePayload.proposal_status,
        status_accepted_at: updatePayload.status_accepted_at,
        status_rejected_at: updatePayload.status_rejected_at,
      });
      
      const result = await openApi.updateProposal(numericId, updatePayload);
      console.log('[useUpdateProposalStatus] Update result:', result);
      
      return { success: true, data: result, apiId: numericId };
    },
    onSuccess: (result, { id }) => {
      console.log('[useUpdateProposalStatus] SUCCESS - Invalidating queries for:', id, 'apiId:', result?.apiId);
      // Invalidate all proposal queries to ensure fresh data
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
      queryClient.invalidateQueries({ queryKey: ['proposal'] });
      // Also invalidate by specific IDs
      queryClient.invalidateQueries({ queryKey: ['proposal', 'api', id] });
      if (result?.apiId) {
        queryClient.invalidateQueries({ queryKey: ['proposal', 'api', String(result.apiId)] });
      }
    },
    onError: (error) => {
      console.error('[useUpdateProposalStatus] Error:', error);
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
