import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  CalculationResult, 
  ClientInfo, 
  ProposalMeta, 
  AddonsState,
  VALID_CONTRACT_MONTHS,
  isValidContractMonth,
  StorageType,
} from '@/lib/calculatorConfig';
import { openApi } from '@/lib/openApi';
import type { SummaryRow } from '@/lib/calculatorConfig';
import { authService } from '@/services/authService';

// Proposal status type - STANDARDIZED to 5 canonical values
// DRAFT = Initial state when created
// SENT = Proposal sent to client
// APPROVED = Client accepted the proposal
// REJECTED = Client rejected the proposal
// EXPIRED = Proposal validity has passed
export type ProposalStatus = 'DRAFT' | 'SENT' | 'APPROVED' | 'REJECTED' | 'EXPIRED';

// Legacy status mapping - for backward compatibility
const LEGACY_STATUS_MAP: Record<string, ProposalStatus> = {
  '': 'DRAFT',
  'S': 'DRAFT', // Legacy "Sem status" → DRAFT
  'E': 'SENT',
  'Enviado': 'SENT',
  'A': 'APPROVED',
  'Approved': 'APPROVED',
  'Aprovado': 'APPROVED',
  'R': 'REJECTED',
  'Rejected': 'REJECTED',
  'Recusado': 'REJECTED',
};

// Normalize any status value to canonical ProposalStatus
export function normalizeStatus(rawStatus: string | undefined | null): ProposalStatus {
  if (!rawStatus || rawStatus.trim() === '') return 'DRAFT';
  const normalized = LEGACY_STATUS_MAP[rawStatus];
  if (normalized) return normalized;
  // If it's already a valid canonical status, return it
  if (['DRAFT', 'SENT', 'APPROVED', 'REJECTED', 'EXPIRED'].includes(rawStatus)) {
    return rawStatus as ProposalStatus;
  }
  // Default to DRAFT for unknown values
  console.warn('[normalizeStatus] Unknown status value:', rawStatus, '→ DRAFT');
  return 'DRAFT';
}

// Check if proposal is expired based on due_at date
export function isProposalExpired(dueAt: string | undefined): boolean {
  if (!dueAt) return false;
  const dueDate = new Date(dueAt);
  return dueDate < new Date();
}

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
  // Official API status field (uses "Approved", "Rejected", "Enviado")
  status?: string;
  // Legacy status fields (kept for backward compatibility)
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
export function apiToLocal(apiProposal: ApiProposal): SavedProposal {
  // Check if we have the complete calculator state saved in dados_proposta (new format)
  // IMPORTANT: dados_proposta may come as string (JSON serialized) - must parse it first
  let dadosProposta = (apiProposal as any).dados_proposta;
  
  // FIX: If dados_proposta is a string, parse it
  if (typeof dadosProposta === 'string') {
    try {
      dadosProposta = JSON.parse(dadosProposta);
      console.log('[apiToLocal] Parsed dados_proposta from string for proposal', apiProposal.id);
    } catch (e) {
      console.error('[apiToLocal] Failed to parse dados_proposta string, falling back to legacy', e);
      dadosProposta = null;
    }
  }
  
  // Log status resolution for debugging
  console.log('[apiToLocal] Processing proposal', apiProposal.id, {
    proposal_status: apiProposal.proposal_status,
    dados_proposta_status: dadosProposta?.status,
    status_accepted_at: apiProposal.status_accepted_at,
    status_rejected_at: apiProposal.status_rejected_at,
    dados_proposta_type: typeof dadosProposta,
    has_dados_proposta: !!dadosProposta,
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
      winserver: toNum(rawAddons.winserver, 0),
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
    
    // Resolve status: prioritize API "status" field, then proposal_status, then dados_proposta
    // Then normalize to canonical ProposalStatus
    const rawStatus = apiProposal.status || apiProposal.proposal_status || dadosProposta.status || '';
    let resolvedStatus = normalizeStatus(rawStatus);
    
    // Check if proposal is expired (overrides other statuses except APPROVED/REJECTED)
    if (resolvedStatus !== 'APPROVED' && resolvedStatus !== 'REJECTED' && apiProposal.due_at) {
      if (isProposalExpired(apiProposal.due_at)) {
        resolvedStatus = 'EXPIRED';
      }
    }
    
    // Resolve acceptance info
    const resolvedAcceptance: ProposalAcceptance | undefined = dadosProposta.acceptance || (
      (apiProposal.status_accepted_at || apiProposal.status_rejected_at) ? {
        id: apiProposal.acceptance_id || '',
        acceptedAt: apiProposal.status_accepted_at,
        rejectedAt: apiProposal.status_rejected_at,
        channel: (apiProposal.acceptance_channel || 'public_url') as 'public_url' | 'ui' | 'email',
      } : undefined
    );
    
    // Validate and get selectedTerm from dados_proposta with logging
    const rawSelectedTerm = dadosProposta.selectedTerm;
    const selectedTermValid = rawSelectedTerm && isValidContractMonth(rawSelectedTerm);
    const finalSelectedTerm = selectedTermValid ? rawSelectedTerm : '1';
    
    if (!selectedTermValid && rawSelectedTerm) {
      console.error('[proposal-load] INVALID selectedTerm in dados_proposta:', rawSelectedTerm, '→ defaulting to 1');
    }
    console.log('[proposal-load] contract_months=', rawSelectedTerm, 'finalSelectedTerm=', finalSelectedTerm);
    
    return {
      id: apiProposal.id,
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
  // This path handles proposals that don't have dados_proposta OR where dados_proposta is empty
  console.log('[apiToLocal] LEGACY: dados_proposta missing → reconstructing from addons[]', {
    proposalId: apiProposal.id,
    addonsCount: apiProposal.addons?.length || 0,
    serversCount: apiProposal.servers?.length || 0,
  });
  
  // Map contract_duration to selectedTerm (MUST include all valid plans: 1, 12, 24, 36, 48)
  const contractDuration = apiProposal.contract_duration;
  const selectedTerm = isValidContractMonth(contractDuration) ? String(contractDuration) : '1';
  
  if (!isValidContractMonth(contractDuration)) {
    console.error('[proposal-load] LEGACY: INVALID contract_duration:', contractDuration, '→ defaulting to 1');
  }
  console.log('[proposal-load] LEGACY contract_months=', contractDuration, 'selectedTerm=', selectedTerm);
  
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
  
  // ============================================
  // LAYER B: RECONSTRUCT INDEPENDENT PRODUCTS FROM addons[] WHEN dados_proposta IS MISSING
  // This is critical for proposals that were saved before dados_proposta was implemented
  // ============================================
  let reconstructedStorageFromAddons: any[] = [];
  let reconstructedKubernetesFromAddons: any = null;
  let reconstructedOpenSaasFromAddons: any = null;
  const reconstructedAddonsState: AddonsState = {
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
    winserver: 0,
    customAddons: {},
  };
  
  // Transform API addons array to legacy addons object format for display
  // AND reconstruct independent products (Storage, Kubernetes, OPEN SaaS)
  const addonsObj: Record<string, { enabled: boolean; price: number; quantity: number }> = {};
  let addonsTotal = 0;
  
  if (apiProposal.addons && Array.isArray(apiProposal.addons)) {
    for (const addon of apiProposal.addons) {
      if (!addon.name) continue;
      
      const addonName = addon.name.trim();
      const addonPrice = toNum(addon.price, 0);
      const addonQty = toNum(addon.quantity, 1);
      const addonNameLower = addonName.toLowerCase();
      
      // Store in legacy addonsObj
      addonsObj[addonName] = {
        enabled: true,
        price: addonPrice,
        quantity: addonQty,
      };
      addonsTotal += addonPrice * addonQty;
      
      // ============================================
      // PARSE STORAGE: "Storage SAS 0.1TB" or "Storage S3 500GB BR" or legacy "Storage SAN..."
      // ============================================
      if (addonNameLower.startsWith('storage ')) {
        const storageMatch = addonName.match(/storage\s+(\w+)\s+([\d.]+)\s*(TB|GB)?(?:\s+(\w+))?/i);
        if (storageMatch) {
          const rawType = storageMatch[1].toLowerCase();
          const value = parseFloat(storageMatch[2]) || 1;
          const unit = (storageMatch[3] || 'TB').toUpperCase();
          const region = storageMatch[4] || 'BR';
          
          // Map legacy names to canonical StorageType
          let normalizedStorageType: StorageType = 'sas'; // default
          if (rawType === 'sas' || rawType === 'san' || rawType === 'nas') {
            normalizedStorageType = 'sas';
          } else if (rawType === 's3' || rawType === 'bucket') {
            normalizedStorageType = 's3';
          } else if (rawType === 'nvme' || rawType === 'ssd') {
            normalizedStorageType = 'nvme';
          }
          
          reconstructedStorageFromAddons.push({
            id: crypto.randomUUID(),
            storageType: normalizedStorageType,
            region: (region.toUpperCase() === 'USA' || region.toUpperCase() === 'US') ? 'USA' : 'BR',
            volumeTB: unit === 'TB' ? value : 0,
            volumeGB: unit === 'GB' ? value : 0,
          });
        }
        continue;
      }
      
      // ============================================
      // PARSE KUBERNETES: "Kubernetes Small" or "Kubernetes k8s_medium"
      // ============================================
      if (addonNameLower.startsWith('kubernetes ')) {
        const k8sMatch = addonName.match(/kubernetes\s+(\w+)/i);
        let plan = 'k8s_small';
        if (k8sMatch) {
          const planSuffix = k8sMatch[1].toLowerCase();
          // Normalize plan name
          if (planSuffix === 'small' || planSuffix === 'k8s_small') plan = 'k8s_small';
          else if (planSuffix === 'medium' || planSuffix === 'k8s_medium') plan = 'k8s_medium';
          else if (planSuffix === 'large' || planSuffix === 'k8s_large') plan = 'k8s_large';
          else if (planSuffix === 'xl' || planSuffix === 'k8s_xl') plan = 'k8s_xl';
          else if (planSuffix === 'enterprise' || planSuffix === 'k8s_enterprise') plan = 'k8s_enterprise';
        }
        reconstructedKubernetesFromAddons = { 
          enabled: true, 
          plan,
          addons: {
            support_24x7: false,
            backup_velero: false,
            dr_multisite: false,
            observability: false,
            cicd_managed: false,
            devops_hours: 0,
          },
          extras: { vcpu: 0, ramGB: 0, diskGB: 0 },
        };
        continue;
      }
      
      // ============================================
      // PARSE OPEN SAAS: "OPEN SaaS 10 usuários" or "OPEN SaaS (10)"
      // ============================================
      if (addonNameLower.startsWith('open saas') || addonNameLower.startsWith('opensaas')) {
        const usersMatch = addonName.match(/(\d+)/);
        const users = usersMatch ? parseInt(usersMatch[1], 10) : addonQty;
        reconstructedOpenSaasFromAddons = { 
          enabled: true, 
          users: Math.max(1, users),
        };
        continue;
      }
      
      // ============================================
      // PARSE STANDARD ADDONS → AddonsState
      // ============================================
      if (addonNameLower.includes('antivirus') || addonNameLower.includes('antivírus')) {
        reconstructedAddonsState.antivirus = addonQty;
      } else if (addonNameLower.includes('firewall')) {
        reconstructedAddonsState.firewall = true;
      } else if (addonNameLower.includes('tsplus') || addonNameLower.includes('ts plus')) {
        reconstructedAddonsState.tsplus = addonQty;
      } else if (addonNameLower.includes('cal') || addonNameLower.includes('ts-cal')) {
        reconstructedAddonsState.cal = addonQty;
      } else if (addonNameLower.includes('veeam') && addonNameLower.includes('vm')) {
        reconstructedAddonsState.veeamVm = addonQty;
      } else if (addonNameLower.includes('veeam') && (addonNameLower.includes('agent') || addonNameLower.includes('workstation'))) {
        reconstructedAddonsState.veeamAg = addonQty;
      } else if (addonNameLower.includes('sql')) {
        // Detect SQL type from name
        if (addonNameLower.includes('enterprise')) {
          reconstructedAddonsState.sql = 'enterprise';
        } else if (addonNameLower.includes('standard')) {
          reconstructedAddonsState.sql = 'standard';
        } else if (addonNameLower.includes('web')) {
          reconstructedAddonsState.sql = 'web';
        } else {
          reconstructedAddonsState.sql = 'standard'; // Default
        }
        reconstructedAddonsState.sqlQty = addonQty;
      } else if (addonNameLower.includes('backup')) {
        // Parse backup size from name if available
        const backupGbMatch = addonName.match(/(\d+)\s*GB/i);
        const backupTbMatch = addonName.match(/(\d+)\s*TB/i);
        if (backupTbMatch) {
          reconstructedAddonsState.backupGb = parseInt(backupTbMatch[1], 10) * 1024;
        } else if (backupGbMatch) {
          reconstructedAddonsState.backupGb = parseInt(backupGbMatch[1], 10);
        } else {
          reconstructedAddonsState.backupGb = addonQty; // Use quantity as GB
        }
        
        // Detect backup plan
        if (addonNameLower.includes('gold')) {
          reconstructedAddonsState.backupPlan = 'gold';
        } else if (addonNameLower.includes('silver')) {
          reconstructedAddonsState.backupPlan = 'silver';
        } else if (addonNameLower.includes('bronze')) {
          reconstructedAddonsState.backupPlan = 'bronze';
        } else {
          reconstructedAddonsState.backupPlan = 'bronze'; // Default
        }
      }
    }
  }
  
  // Log reconstruction summary
  console.log('[apiToLocal] LEGACY reconstruction from addons[]:', {
    storageCount: reconstructedStorageFromAddons.length,
    k8sEnabled: !!reconstructedKubernetesFromAddons,
    openSaasUsers: reconstructedOpenSaasFromAddons?.users || 0,
    addonsApplied: {
      antivirus: reconstructedAddonsState.antivirus,
      firewall: reconstructedAddonsState.firewall,
      backupPlan: reconstructedAddonsState.backupPlan,
      backupGb: reconstructedAddonsState.backupGb,
      sql: reconstructedAddonsState.sql,
      sqlQty: reconstructedAddonsState.sqlQty,
      veeamVm: reconstructedAddonsState.veeamVm,
      veeamAg: reconstructedAddonsState.veeamAg,
    },
  });
  
  // ============================================
  // VIRTUAL SERVER RECONSTRUCTION
  // Parse __VIRTUAL__ prefixed servers to reconstruct independent products
  // ============================================
  const rows: Array<{ label: string; qty: string | number; unitPrice: number; subtotal: number }> = [];
  let serversSubtotal = 0;
  let reconstructedStorageItems: any[] = [];
  let reconstructedKubernetes: any = null;
  let reconstructedOpenSaas: any = null;
  
  // Helper to detect and parse virtual server names
  const parseVirtualServer = (name: string): { type: 'storage' | 'kubernetes' | 'opensaas' | 'bundle' | null; payload: any } => {
    if (!name) return { type: null, payload: null };
    
    // New format: __VIRTUAL__TYPE__:JSON
    if (name.startsWith('__VIRTUAL__STORAGE__:')) {
      try {
        const json = name.substring('__VIRTUAL__STORAGE__:'.length);
        return { type: 'storage', payload: JSON.parse(json) };
      } catch (e) {
        console.warn('[apiToLocal] Failed to parse virtual storage:', e);
        return { type: 'storage', payload: null };
      }
    }
    if (name.startsWith('__VIRTUAL__KUBERNETES__:')) {
      try {
        const json = name.substring('__VIRTUAL__KUBERNETES__:'.length);
        return { type: 'kubernetes', payload: JSON.parse(json) };
      } catch (e) {
        console.warn('[apiToLocal] Failed to parse virtual kubernetes:', e);
        return { type: 'kubernetes', payload: null };
      }
    }
    if (name.startsWith('__VIRTUAL__OPENSAAS__:')) {
      try {
        const json = name.substring('__VIRTUAL__OPENSAAS__:'.length);
        return { type: 'opensaas', payload: JSON.parse(json) };
      } catch (e) {
        console.warn('[apiToLocal] Failed to parse virtual opensaas:', e);
        return { type: 'opensaas', payload: null };
      }
    }
    if (name.startsWith('__VIRTUAL__BUNDLE__:') || name === 'VIRTUAL_PRODUCT_BUNDLE') {
      return { type: 'bundle', payload: null };
    }
    
    // Legacy format: detect by name pattern (for backward compatibility)
    const lower = name.toLowerCase();
    if (lower.startsWith('storage ')) return { type: 'storage', payload: null };
    if (lower.startsWith('kubernetes ')) return { type: 'kubernetes', payload: null };
    if (lower.startsWith('open saas')) return { type: 'opensaas', payload: null };
    
    return { type: null, payload: null };
  };
  
  // First pass: extract virtual servers and reconstruct independent products
  for (const server of (apiProposal.servers || [])) {
    const serverName = server.name || '';
    const virtual = parseVirtualServer(serverName);
    
    if (virtual.type === 'storage') {
      if (virtual.payload?.items) {
        // New format: has embedded storage items
        reconstructedStorageItems = virtual.payload.items;
        console.log('[apiToLocal] Reconstructed storage items from virtual server:', reconstructedStorageItems.length);
      } else {
        // Legacy format: try to parse from name (e.g., "Storage SAS 0.1TB")
        const match = serverName.match(/storage\s+(\w+)\s+([\d.]+)(TB|GB)/i);
        if (match) {
          const rawType = match[1].toLowerCase();
          const value = parseFloat(match[2]);
          const unit = match[3].toUpperCase();
          // Map legacy names to canonical StorageType
          let normalizedType: StorageType = 'sas';
          if (rawType === 's3' || rawType === 'bucket') normalizedType = 's3';
          else if (rawType === 'nvme' || rawType === 'ssd') normalizedType = 'nvme';
          
          reconstructedStorageItems.push({
            id: crypto.randomUUID(),
            storageType: normalizedType,
            region: 'BR' as const,
            volumeTB: unit === 'TB' ? value : 0,
            volumeGB: unit === 'GB' ? value : 0,
          });
          console.log('[apiToLocal] Reconstructed legacy storage item:', { storageType: normalizedType, value, unit });
        }
      }
    } else if (virtual.type === 'kubernetes') {
      if (virtual.payload) {
        // New format: has embedded kubernetes state
        reconstructedKubernetes = virtual.payload;
        console.log('[apiToLocal] Reconstructed kubernetes from virtual server:', reconstructedKubernetes);
      } else {
        // Legacy format: enable with defaults
        reconstructedKubernetes = { enabled: true, plan: 'k8s_small' };
        console.log('[apiToLocal] Reconstructed legacy kubernetes (defaults)');
      }
    } else if (virtual.type === 'opensaas') {
      if (virtual.payload) {
        // New format: has embedded openSaas state
        reconstructedOpenSaas = virtual.payload;
        console.log('[apiToLocal] Reconstructed openSaas from virtual server:', reconstructedOpenSaas);
      } else {
        // Legacy format: parse from name (e.g., "OPEN SaaS 5 usuários")
        const match = serverName.match(/open\s*saas\s+(\d+)/i);
        const users = match ? parseInt(match[1], 10) : 1;
        reconstructedOpenSaas = { enabled: true, users };
        console.log('[apiToLocal] Reconstructed legacy openSaas:', { users });
      }
    }
    // Skip 'bundle' type - it's just a placeholder
  }
  
  // Second pass: filter out virtual servers and process real VM/BM servers
  const items = (apiProposal.servers || [])
    .filter((server: any) => {
      const serverName = server.name || '';
      const virtual = parseVirtualServer(serverName);
      // Keep only NON-virtual servers (real VMs/BMs)
      return virtual.type === null;
    })
    .map((server: any, idx: number) => {
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
      
      // Detect if VM or BareMetal based on name and specs
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
          bmCpu: 'intel_xeon_e2136',
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
  
  // Resolve status for legacy format - prioritize official "status" field and normalize
  const rawStatus = apiProposal.status || apiProposal.proposal_status || '';
  let resolvedStatus = normalizeStatus(rawStatus);
  
  // Check if proposal is expired (overrides other statuses except APPROVED/REJECTED)
  if (resolvedStatus !== 'APPROVED' && resolvedStatus !== 'REJECTED' && apiProposal.due_at) {
    if (isProposalExpired(apiProposal.due_at)) {
      resolvedStatus = 'EXPIRED';
    }
  }
  
  const resolvedAcceptance: ProposalAcceptance | undefined = (
    (apiProposal.status_accepted_at || apiProposal.status_rejected_at) ? {
      id: apiProposal.acceptance_id || '',
      acceptedAt: apiProposal.status_accepted_at,
      rejectedAt: apiProposal.status_rejected_at,
      channel: (apiProposal.acceptance_channel || 'public_url') as 'public_url' | 'ui' | 'email',
    } : undefined
  );
  
  // ============================================
  // MERGE RECONSTRUCTION SOURCES
  // Priority: virtual servers > addons[] reconstruction
  // ============================================
  const finalStorageItems = reconstructedStorageItems.length > 0 
    ? reconstructedStorageItems 
    : reconstructedStorageFromAddons;
  const finalKubernetes = reconstructedKubernetes || reconstructedKubernetesFromAddons || {};
  const finalOpenSaas = reconstructedOpenSaas || reconstructedOpenSaasFromAddons || undefined;
  
  // For addons, prefer the structured AddonsState if we parsed anything meaningful
  const hasReconstructedAddons = reconstructedAddonsState.antivirus > 0 || 
    reconstructedAddonsState.firewall || 
    reconstructedAddonsState.backupPlan !== 'none' ||
    reconstructedAddonsState.sql !== 'none' ||
    reconstructedAddonsState.veeamVm > 0 ||
    reconstructedAddonsState.veeamAg > 0;
  
  // Log final reconstruction results
  console.log('[apiToLocal] LEGACY final reconstruction results:', {
    items: items.length,
    storageItems: finalStorageItems.length,
    storageSource: reconstructedStorageItems.length > 0 ? 'virtual_servers' : 'addons[]',
    kubernetes: !!finalKubernetes?.enabled,
    kubernetesSource: reconstructedKubernetes ? 'virtual_servers' : (reconstructedKubernetesFromAddons ? 'addons[]' : 'none'),
    openSaas: !!finalOpenSaas?.enabled,
    openSaasUsers: finalOpenSaas?.users || 0,
    openSaasSource: reconstructedOpenSaas ? 'virtual_servers' : (reconstructedOpenSaasFromAddons ? 'addons[]' : 'none'),
    addonsSource: hasReconstructedAddons ? 'reconstructed' : 'raw',
  });
  
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
    // Use reconstructed AddonsState if we parsed meaningful data, otherwise fall back to raw
    addons: hasReconstructedAddons ? reconstructedAddonsState : addonsObj,
    // USE RECONSTRUCTED VALUES (merged from virtual servers AND addons[])
    kubernetes: finalKubernetes,
    storageItems: finalStorageItems,
    openSaas: finalOpenSaas,
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
  // Map selectedTerm to contract_duration (MUST include all valid plans: 1, 12, 24, 36, 48)
  // Use centralized validation
  const termAsNumber = parseInt(proposal.selectedTerm, 10);
  const contractDuration = isValidContractMonth(termAsNumber) ? termAsNumber : 1;
  
  // Validate and log contract_months being saved
  if (!isValidContractMonth(proposal.selectedTerm)) {
    console.error('[proposal-save] INVALID contract_months:', proposal.selectedTerm, '→ defaulting to 1');
  }
  console.log('[proposal-save] contract_months=', contractDuration, 'selectedTerm=', proposal.selectedTerm);
  
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
  // IMPORTANT: Storage, Kubernetes, and OPEN SaaS are INDEPENDENT products (not servers)
  // They should be added to addons array to allow proposals without VM/BM
  const addonsArray: Array<{ name: string; price: number; quantity: number }> = [];
  
  // ============================================
  // INDEPENDENT PRODUCTS (don't require servers)
  // FIX: Removed volumeTB >= 1 restriction - use any volume > 0 (TB or GB)
  // FIX: Removed users >= 5 restriction - allow any users > 0
  // ============================================
  
  // Storage items - add each storage configuration as an addon
  // Accept if volumeTB > 0 OR volumeGB > 0
  if (proposal.storageItems && Array.isArray(proposal.storageItems)) {
    for (const storage of proposal.storageItems) {
      const volumeTB = toNum(storage.volumeTB, 0);
      const volumeGB = toNum(storage.volumeGB, 0);
      // Calculate effective TB for display (if only GB is set, convert)
      const effectiveTB = volumeTB > 0 ? volumeTB : (volumeGB > 0 ? volumeGB / 1024 : 0);
      
      if (volumeTB > 0 || volumeGB > 0) {
        const displaySize = effectiveTB >= 1 
          ? `${effectiveTB.toFixed(effectiveTB % 1 === 0 ? 0 : 2)}TB`
          : `${Math.round(volumeGB || volumeTB * 1024)}GB`;
        addonsArray.push({
          name: `Storage ${storage.type || storage.storageType || 'SAN'} ${displaySize}`,
          price: storage.price || 0,
          quantity: 1,
        });
      }
    }
  }
  
  // Kubernetes - add as addon if enabled
  if (proposal.kubernetes && proposal.kubernetes.enabled) {
    const k8s = proposal.kubernetes;
    addonsArray.push({
      name: `Kubernetes ${k8s.plan || 'Standard'}`,
      price: k8s.price || 0,
      quantity: 1,
    });
  }
  
  // OPEN SaaS - add as addon if enabled with ANY users > 0
  // FIX: Removed users >= 5 restriction
  if (proposal.openSaas && proposal.openSaas.enabled && proposal.openSaas.users > 0) {
    addonsArray.push({
      name: `OPEN SaaS ${proposal.openSaas.users} usuários`,
      price: proposal.openSaas.price || 0,
      quantity: proposal.openSaas.users,
    });
  }
  
  // ============================================
  // STANDARD ADDONS (services/extras)
  // ============================================
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
  
  // ============================================
  // WORKAROUND: API OPDC requires servers array to have at least 1 item
  // When there are no VMs/BMs but there are independent products (Storage, Kubernetes, OPEN SaaS),
  // we add VIRTUAL SERVERS with special __VIRTUAL__ prefix for reconstruction during edit.
  // The full state is preserved in dados_proposta for accurate restoration.
  // 
  // VIRTUAL SERVER FORMAT (for fallback reconstruction):
  // __VIRTUAL__STORAGE__:<JSON with storageItems array>
  // __VIRTUAL__KUBERNETES__:<JSON with kubernetes state>
  // __VIRTUAL__OPENSAAS__:<JSON with openSaas state>
  // ============================================
  if (serversArray.length === 0) {
    let hasAnyIndependentProduct = false;
    
    // Check for Storage items (accept any volume > 0)
    const validStorageItems = (proposal.storageItems || []).filter((storage: any) => {
      const volumeTB = toNum(storage.volumeTB, 0);
      const volumeGB = toNum(storage.volumeGB, 0);
      return volumeTB > 0 || volumeGB > 0;
    });
    
    if (validStorageItems.length > 0) {
      hasAnyIndependentProduct = true;
      // Encode storage items in virtual server name for fallback reconstruction
      const storagePayload = JSON.stringify({ items: validStorageItems });
      serversArray.push({
        name: `__VIRTUAL__STORAGE__:${storagePayload}`,
        vcpu: 0,
        ram: 0,
        storage: 0,
        price: 0,
        quantity: 1,
      });
    }
    
    // Check for Kubernetes (enabled = true)
    if (proposal.kubernetes && proposal.kubernetes.enabled) {
      hasAnyIndependentProduct = true;
      const k8sPayload = JSON.stringify(proposal.kubernetes);
      serversArray.push({
        name: `__VIRTUAL__KUBERNETES__:${k8sPayload}`,
        vcpu: 0,
        ram: 0,
        storage: 0,
        price: 0,
        quantity: 1,
      });
    }
    
    // Check for OPEN SaaS (enabled = true AND users > 0)
    if (proposal.openSaas && proposal.openSaas.enabled && proposal.openSaas.users > 0) {
      hasAnyIndependentProduct = true;
      const saasPayload = JSON.stringify(proposal.openSaas);
      serversArray.push({
        name: `__VIRTUAL__OPENSAAS__:${saasPayload}`,
        vcpu: 0,
        ram: 0,
        storage: 0,
        price: 0,
        quantity: 1,
      });
    }
    
    // ============================================
    // FALLBACK: If still no servers after adding independent products,
    // add a virtual placeholder to guarantee servers is never empty
    // ============================================
    if (serversArray.length === 0) {
      console.warn('[localToApi] No items found, adding VIRTUAL_PRODUCT_BUNDLE fallback');
      serversArray.push({
        name: '__VIRTUAL__BUNDLE__:{}',
        vcpu: 0,
        ram: 0,
        storage: 0,
        price: 0,
        quantity: 1,
      });
    }
    
    if (hasAnyIndependentProduct) {
      console.log('[localToApi] Created virtual servers for independent products:', serversArray.map(s => s.name.substring(0, 50)));
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
    // CRITICAL: Always send arrays (even empty) to satisfy API schema
    // servers is REQUIRED by the API, addons is optional but we always send array
    addons: addonsArray,
    servers: serversArray, // Always an array, even if empty []
    due_at: dueAt.toISOString(),
    // STATUS FIELDS - persisted at API level for proper filtering
    // status is the CANONICAL source of truth: 'DRAFT', 'SENT', 'APPROVED', 'REJECTED', 'EXPIRED'
    proposal_status: proposal.status || 'DRAFT',
    status: proposal.status || 'DRAFT',
    // Only set status_sent_at on first send transition
    status_sent_at: proposal.acceptance?.acceptedAt 
      ? undefined 
      : proposal.acceptance?.rejectedAt 
        ? undefined 
        : proposal.status === 'SENT' 
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

// Check if a user level can see ALL proposals (Admin or Gerente Comercial)
export function canSeeAllProposals(level: number): boolean {
  return level === 1000 || level === 750;
}

// Helper to extract owner ID from proposal (for RBAC filtering)
export function getProposalOwnerId(proposal: any): number | null {
  // Primary: created_by field from API (integer, nullable)
  if (proposal?.created_by !== undefined && proposal?.created_by !== null) {
    return Number(proposal.created_by);
  }
  
  // Fallback: creator object from __with=creator expansion
  if (proposal?.creator?.id !== undefined && proposal?.creator?.id !== null) {
    return Number(proposal.creator.id);
  }
  
  // Also check dados_proposta for saved ownership info
  if (proposal?.dados_proposta?.created_by_user_id !== undefined && 
      proposal?.dados_proposta?.created_by_user_id !== null) {
    return Number(proposal.dados_proposta.created_by_user_id);
  }
  
  // No owner info available
  return null;
}

// Filter proposals by ownership based on user level
export function filterProposalsByOwnership(
  proposals: SavedProposal[], 
  userLevel: number, 
  userId: string | number | null
): SavedProposal[] {
  // Admins and Managers see all
  if (canSeeAllProposals(userLevel)) {
    console.log('[filterProposalsByOwnership] Level', userLevel, 'can see all proposals');
    return proposals;
  }
  
  // Convert userId to number for comparison
  const numericUserId = userId !== null ? Number(userId) : null;
  
  // Executives (700), CS (775): filter by owner
  if (userLevel === 700 || userLevel === 775) {
    if (numericUserId === null) {
      console.warn('[filterProposalsByOwnership] No userId available, returning empty');
      return [];
    }
    
    const filtered = proposals.filter((p) => {
      const ownerId = getProposalOwnerId(p);
      
      // Security: proposals without owner info are hidden from non-managers
      if (ownerId === null) {
        console.warn('[filterProposalsByOwnership] Proposal without owner hidden:', p.id);
        return false;
      }
      
      return ownerId === numericUserId;
    });
    
    console.log('[filterProposalsByOwnership] Level', userLevel, 'userId', numericUserId, ':', filtered.length, 'of', proposals.length, 'proposals');
    return filtered;
  }
  
  // Other internal levels (600, 900, 950): no access to commercial proposals
  console.warn('[filterProposalsByOwnership] Level', userLevel, 'has no access to proposals');
  return [];
}

// Hook to fetch executive proposals from API (excludes partner proposals)
// Uses GET /api/calculator/proposal with channel_type=CLIENTE filter
// RBAC: Filters proposals based on user level and ownership
export function useProposals(page = 1, perPage = 100) {
  // Get user session for RBAC filtering
  const session = authService.getSession();
  const userLevel = session?.level || 0;
  const userId = session?.userId || null;
  
  return useQuery({
    queryKey: ['proposals', 'api', 'executive', page, perPage, userLevel, userId],
    queryFn: async () => {
      try {
        // Call API directly: GET /api/calculator/proposal
        const response = await openApi.getProposals({
          channel_type: 'CLIENTE',
          __page: page,
          __perPage: perPage,
        });

        const apiProposals = (response.data || []) as ApiProposal[];
        
        // Client-side safety filter: ensure only CLIENTE proposals
        const safe = apiProposals.filter((p) => p?.channel_type === 'CLIENTE');
        
        // Transform to local format
        const localProposals = safe.map(apiToLocal);
        
        // RBAC: Filter by ownership for non-managers
        const filtered = filterProposalsByOwnership(localProposals, userLevel, userId);

        console.log('[useProposals] Fetched executive proposals:', {
          received: apiProposals.length,
          kept: safe.length,
          afterRBAC: filtered.length,
          userLevel,
          userId,
        });

        return filtered;
      } catch (error) {
        console.warn('[Proposals] API fetch failed, returning empty:', error);
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

// Hook to fetch executive proposals with pagination info (excludes partner proposals)
// Uses GET /api/calculator/proposal with channel_type=CLIENTE filter
// RBAC: Filters proposals based on user level and ownership
export function useProposalsPaginated(page = 1, perPage = 20) {
  // Get user session for RBAC filtering
  const session = authService.getSession();
  const userLevel = session?.level || 0;
  const userId = session?.userId || null;

  return useQuery({
    queryKey: ['proposals', 'api', 'executive', 'paginated', page, perPage, userLevel, userId],
    queryFn: async () => {
      try {
        // Call API directly: GET /api/calculator/proposal
        const response = await openApi.getProposals({
          channel_type: 'CLIENTE',
          __page: page,
          __perPage: perPage,
        });

        const apiProposals = (response.data || []) as ApiProposal[];
        
        // Client-side safety filter
        const safe = apiProposals.filter((p) => p?.channel_type === 'CLIENTE');
        
        // Transform to local format
        const proposals = safe.map(apiToLocal);
        
        // RBAC: Filter by ownership for non-managers
        const filtered = filterProposalsByOwnership(proposals, userLevel, userId);

        console.log('[useProposalsPaginated] Fetched executive proposals:', {
          received: apiProposals.length,
          kept: safe.length,
          afterRBAC: filtered.length,
          userLevel,
          userId,
        });

        return {
          proposals: filtered,
          pagination: {
            currentPage: page,
            // Note: pagination total might be incorrect after client-side filter
            // but this is acceptable as security measure
            lastPage: Math.ceil((response.total || 0) / perPage) || 1,
            total: response.total || 0,
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
    // NO CACHE - Always fetch fresh data from API
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
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
    // NO CACHE - Always fetch fresh data from API
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
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

      // CRITICAL: Log payload details for debugging
      const dadosProposta = (apiData as any).dados_proposta;
      console.log('[SaveProposal] Sending to API:', {
        mode: numericId ? 'UPDATE' : 'CREATE',
        numericId,
        channel_type: (apiData as any).channel_type,
        dados_proposta_summary: {
          hasProposalId: Boolean(dadosProposta?.proposalId),
          hasOwnerUserId: Boolean(dadosProposta?.created_by_user_id),
          hasOwnerEmail: Boolean(dadosProposta?.created_by_email),
          hasItems: Boolean(dadosProposta?.items?.length),
          itemsCount: dadosProposta?.items?.length || 0,
        },
      });

      let result: any;
      
      if (numericId) {
        // Update existing proposal via API: PUT /api/calculator/proposal/{id}
        console.log('[SaveProposal] Updating proposal:', numericId);
        result = await openApi.updateProposal(numericId, apiData);
      } else {
        // Create new proposal via API: POST /api/calculator/proposal
        console.log('[SaveProposal] Creating new proposal');
        result = await openApi.createProposal(apiData);
      }

      console.log('[SaveProposal] API response:', result);
      return { success: true, data: result, isUpdate: Boolean(numericId) };
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
// Status values per API: "Approved", "Rejected", "Enviado" (or legacy: E/A/R)
export function useUpdateProposalStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { 
      id: string; 
      status: ProposalStatus;
    }) => {
      console.log('[useUpdateProposalStatus] Starting update:', { id, status });
      
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
      
      // Build minimal update payload using ONLY the official API "status" field
      // Per API spec: PATCH /api/calculator/proposal/{id} with { "status": "Approved" }
      // The API will automatically handle approved_at/status_at
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
        dados_proposta: existing.dados_proposta,
        // STATUS FIELD - the ONLY field needed per API spec
        // Using the official API format: "Approved", "Rejected", "Enviado"
        status: status,
      };
      
      console.log('[useUpdateProposalStatus] Updating proposal', numericId, 'with status:', status);
      
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
