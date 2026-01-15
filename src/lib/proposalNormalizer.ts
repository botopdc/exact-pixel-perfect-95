/**
 * Proposal Normalizer - Centralizes the logic for hydrating calculator state from proposals
 * 
 * CRITICAL: This module uses proposal.items as the SINGLE SOURCE OF TRUTH for editing.
 * proposal.servers should NOT be used for UI rehydration - they are only for API compatibility.
 * 
 * Virtual servers (Storage, Kubernetes, OPEN SaaS, VIRTUAL_PRODUCT_BUNDLE) added to servers[]
 * for API compatibility should be IGNORED during hydration.
 */

import {
  KubernetesState,
  StorageItem,
  OpenSaaSState,
  AddonsState,
  VMItem,
  BMItem,
  DiskItem,
  PriceOverrideMap,
  ResellerState,
  DEFAULT_RESELLER_STATE,
  DEFAULT_OPEN_SAAS_STATE,
  K8sPlan,
  StorageType,
  StorageRegion,
} from '@/lib/calculatorConfig';

// Helper to safely convert any value to a number
const toNum = (val: unknown, fallback = 0): number => {
  if (val === undefined || val === null || val === '') return fallback;
  const parsed = typeof val === 'string' ? parseFloat(String(val).replace(',', '.')) : Number(val);
  return Number.isFinite(parsed) ? parsed : fallback;
};

// Item types recognized by the normalizer
type ItemType = 'vm' | 'baremetal' | 'bm' | 'storage' | 'kubernetes' | 'open_saas';

// Generic item from proposal.items (as stored in dados_proposta)
interface ProposalItem {
  id?: string;
  type?: string;
  // VM fields
  vcpu?: number;
  ramGb?: number;
  nvmeTb?: number;
  trafficTb?: number;
  ips?: number;
  qtyServers?: number;
  gpu?: string;
  gpuQty?: number;
  // BM fields
  bmCpu?: string;
  bmRam?: string;
  disks?: DiskItem[];
  // Storage fields
  volumeTB?: number;
  volumeGB?: number;
  storageType?: string;
  region?: string;
  price?: number;
  // Kubernetes fields
  plan?: string;
  enabled?: boolean;
  addons?: Record<string, unknown>;
  extras?: Record<string, unknown>;
  // OPEN SaaS fields
  users?: number;
  // Common
  name?: string;
  label?: string;
  quantity?: number;
  total?: number;
  monthlyPrice?: number;
  // Allow extra fields
  [key: string]: unknown;
}

// Normalized calculator state ready for hydration
export interface NormalizedCalculatorState {
  vmItems: VMItem[];
  baremetalItems: BMItem[];
  storageItems: StorageItem[];
  kubernetes: KubernetesState;
  openSaas: OpenSaaSState;
  addons: AddonsState;
  reseller: ResellerState;
  priceOverrides: PriceOverrideMap;
  observacao: string;
  fx: number;
  selectedTerm: string;
  datacenter: 'SP1' | 'SP2' | 'FL1' | 'CE1';
  client: {
    name: string;
    company: string;
    phone: string;
    email: string;
  };
  proposal: {
    id: string;
    validityDays: number;
    createdAt: string;
  };
  // Totals for reference
  totals: {
    vmSubtotal: number;
    bmSubtotal: number;
    storageSubtotal: number;
    kubernetesSubtotal: number;
    openSaasSubtotal: number;
    addonsSubtotal: number;
    grandTotal: number;
  };
  // For edit mode
  apiId: number | null;
  displayId: string;
}

// Virtual product names that should be ignored during hydration
const VIRTUAL_PRODUCT_PREFIXES = [
  'storage ',
  'kubernetes ',
  'open saas',
  'virtual_product_bundle',
];

function isVirtualProduct(name: string): boolean {
  if (!name) return false;
  const lower = name.toLowerCase();
  return VIRTUAL_PRODUCT_PREFIXES.some(prefix => lower.startsWith(prefix) || lower === prefix);
}

// Detect item type from various possible formats
function detectItemType(item: ProposalItem): ItemType | null {
  // Explicit type field
  if (item.type) {
    const t = String(item.type).toLowerCase();
    if (t === 'vm') return 'vm';
    if (t === 'bm' || t === 'baremetal') return 'baremetal';
    if (t === 'storage') return 'storage';
    if (t === 'kubernetes' || t === 'k8s') return 'kubernetes';
    if (t === 'open_saas' || t === 'opensaas' || t === 'saas') return 'open_saas';
  }
  
  // Detect by name pattern
  const name = String(item.name || item.label || '').toLowerCase();
  if (name.includes('storage') && !isVirtualProduct(name)) return 'storage';
  if (name.includes('kubernetes') && !isVirtualProduct(name)) return 'kubernetes';
  if (name.includes('open saas') && !isVirtualProduct(name)) return 'open_saas';
  
  // Detect by field presence
  if (item.volumeTB !== undefined || item.volumeGB !== undefined) return 'storage';
  if (item.plan !== undefined && item.enabled !== undefined && !item.vcpu) return 'kubernetes';
  if (item.users !== undefined && item.enabled !== undefined) return 'open_saas';
  
  // VM vs BM detection
  if (item.bmCpu || item.bmRam || (item.type === 'bm')) return 'baremetal';
  if (item.vcpu || item.ramGb || (item.type === 'vm')) return 'vm';
  
  // Fallback: if has vcpu > 0, it's a VM; otherwise if it looks like a server, it's BM
  if (toNum(item.vcpu, 0) > 0) return 'vm';
  
  return null;
}

// Normalize a VM item
function normalizeVMItem(item: ProposalItem): VMItem {
  return {
    type: 'vm',
    id: item.id || crypto.randomUUID(),
    gpu: item.gpu || 'Sem GPU',
    gpuQty: toNum(item.gpuQty, 0),
    vcpu: toNum(item.vcpu, 16),
    ramGb: toNum(item.ramGb, 128),
    nvmeTb: toNum(item.nvmeTb, 0.05),
    trafficTb: toNum(item.trafficTb, 5),
    ips: toNum(item.ips, 0),
    qtyServers: toNum(item.qtyServers, 1),
  };
}

// Normalize a BM item
function normalizeBMItem(item: ProposalItem): BMItem {
  return {
    type: 'bm',
    id: item.id || crypto.randomUUID(),
    gpu: item.gpu || 'Sem GPU',
    gpuQty: toNum(item.gpuQty, 0),
    bmCpu: item.bmCpu || 'intel_xeon_e2136',
    bmRam: item.bmRam || 'ram_128gb',
    disks: Array.isArray(item.disks) && item.disks.length > 0 
      ? item.disks.map(d => ({
          type: d.type || 'nvme_1tb',
          qty: toNum(d.qty, 1),
          desc: d.desc || '',
        }))
      : [{ type: 'nvme_1tb', qty: 1, desc: '' }],
    trafficTb: toNum(item.trafficTb, 5),
    ips: toNum(item.ips, 0),
    qtyServers: toNum(item.qtyServers, 1),
  };
}

// Normalize a Storage item
function normalizeStorageItem(item: ProposalItem): StorageItem {
  return {
    id: item.id || crypto.randomUUID(),
    storageType: (item.storageType || item.type || 'SAN') as StorageItem['storageType'],
    region: (item.region || 'SP1') as StorageItem['region'],
    volumeTB: toNum(item.volumeTB, 0),
    volumeGB: toNum(item.volumeGB, 0),
  };
}

// Default addons state
const DEFAULT_ADDONS: AddonsState = {
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
  customAddons: {},
};

// Default kubernetes state
const DEFAULT_KUBERNETES: KubernetesState = {
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
  extras: {
    vcpu: 0,
    ramGB: 0,
    diskGB: 0,
  },
};

/**
 * Main normalization function - converts any proposal format to a clean calculator state
 * 
 * CRITICAL: Uses proposal data from dados_proposta as the source of truth.
 * Never creates default BareMetal when no servers exist.
 * Ignores virtual product servers that were added only for API compatibility.
 */
export function normalizeProposalForEdit(proposal: Record<string, unknown>): NormalizedCalculatorState {
  // Parse dados_proposta if it's a string
  let dadosProposta = proposal.dados_proposta || proposal;
  if (typeof dadosProposta === 'string') {
    try {
      dadosProposta = JSON.parse(dadosProposta);
    } catch (e) {
      console.error('[normalizeProposalForEdit] Failed to parse dados_proposta:', e);
      dadosProposta = proposal;
    }
  }
  
  // Ensure we have an object
  const data = typeof dadosProposta === 'object' && dadosProposta !== null 
    ? dadosProposta as Record<string, unknown>
    : proposal;
  
  console.log('[normalizeProposalForEdit] Processing proposal:', {
    hasId: !!proposal.id,
    hasDadosProposta: !!proposal.dados_proposta,
    dataType: typeof data,
  });
  
  // Initialize state containers
  const vmItems: VMItem[] = [];
  const baremetalItems: BMItem[] = [];
  const storageItems: StorageItem[] = [];
  let kubernetes: KubernetesState = { ...DEFAULT_KUBERNETES };
  let openSaas: OpenSaaSState = { ...DEFAULT_OPEN_SAAS_STATE };
  
  // ============================================
  // STEP 1: Extract items from dados_proposta.items (SOURCE OF TRUTH)
  // ============================================
  const rawItems = Array.isArray(data.items) ? data.items as ProposalItem[] : [];
  
  for (const item of rawItems) {
    const itemType = detectItemType(item);
    
    // Skip virtual products that were added for API compatibility
    const itemName = String(item.name || item.label || '');
    if (isVirtualProduct(itemName)) {
      console.log('[normalizeProposalForEdit] Skipping virtual product:', itemName);
      continue;
    }
    
    switch (itemType) {
      case 'vm':
        vmItems.push(normalizeVMItem(item));
        break;
      case 'baremetal':
        baremetalItems.push(normalizeBMItem(item));
        break;
      case 'storage':
        storageItems.push(normalizeStorageItem(item));
        break;
      case 'kubernetes':
        // Kubernetes comes as a separate field, not in items
        break;
      case 'open_saas':
        // OpenSaaS comes as a separate field, not in items
        break;
      default:
        console.warn('[normalizeProposalForEdit] Unknown item type:', item);
    }
  }
  
  // ============================================
  // STEP 2: Extract storageItems from dedicated field (preferred)
  // ============================================
  const rawStorageItems = Array.isArray(data.storageItems) ? data.storageItems as ProposalItem[] : [];
  for (const storage of rawStorageItems) {
    const existing = storageItems.find(s => s.id === storage.id);
    if (!existing) {
      storageItems.push(normalizeStorageItem(storage));
    }
  }
  
  // ============================================
  // STEP 3: Extract kubernetes from dedicated field
  // ============================================
  const rawK8s = data.kubernetes as Record<string, unknown> | undefined;
  if (rawK8s && typeof rawK8s === 'object') {
    const rawExtras = (rawK8s.extras || {}) as Record<string, unknown>;
    const rawK8sAddons = (rawK8s.addons || {}) as Record<string, unknown>;
    // Validate K8s plan
    const rawPlan = rawK8s.plan as string | undefined;
    const validPlans: K8sPlan[] = ['k8s_small', 'k8s_medium', 'k8s_large'];
    const plan: K8sPlan = rawPlan && validPlans.includes(rawPlan as K8sPlan) 
      ? rawPlan as K8sPlan 
      : 'k8s_small';
    kubernetes = {
      enabled: Boolean(rawK8s.enabled),
      plan,
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
  }
  
  // ============================================
  // STEP 4: Extract openSaas from dedicated field
  // ============================================
  const rawOpenSaas = data.openSaas as Record<string, unknown> | undefined;
  if (rawOpenSaas && typeof rawOpenSaas === 'object') {
    openSaas = {
      enabled: Boolean(rawOpenSaas.enabled),
      users: toNum(rawOpenSaas.users, 0),
    };
  }
  
  // ============================================
  // STEP 5: Extract addons from dedicated field
  // ============================================
  const rawAddons = data.addons as Record<string, unknown> | undefined;
  // Parse customAddons ensuring values are numbers
  const parseCustomAddons = (obj: unknown): Record<string, number> => {
    if (!obj || typeof obj !== 'object') return {};
    const result: Record<string, number> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = toNum(value, 0);
    }
    return result;
  };
  const addons: AddonsState = rawAddons && typeof rawAddons === 'object'
    ? {
        backupPlan: (rawAddons.backupPlan as string) || 'none',
        backupGb: toNum(rawAddons.backupGb, 0),
        antivirus: toNum(rawAddons.antivirus, 0),
        firewall: Boolean(rawAddons.firewall),
        tsplus: toNum(rawAddons.tsplus, 0),
        cal: toNum(rawAddons.cal, 0),
        sql: (rawAddons.sql as string) || 'none',
        sqlQty: toNum(rawAddons.sqlQty, 0),
        veeamVm: toNum(rawAddons.veeamVm, 0),
        veeamAg: toNum(rawAddons.veeamAg, 0),
        customAddons: parseCustomAddons(rawAddons.customAddons),
      }
    : { ...DEFAULT_ADDONS };
  
  // ============================================
  // STEP 6: Extract reseller from dedicated field
  // ============================================
  const rawReseller = data.reseller as Record<string, unknown> | undefined;
  // Validate viewMode and approvalStatus
  const rawViewMode = rawReseller?.viewMode as string | undefined;
  const validViewModes: Array<'INTERNO' | 'CLIENTE'> = ['INTERNO', 'CLIENTE'];
  const viewMode = rawViewMode && validViewModes.includes(rawViewMode as 'INTERNO' | 'CLIENTE') 
    ? rawViewMode as 'INTERNO' | 'CLIENTE'
    : 'INTERNO';
  
  const rawApprovalStatus = rawReseller?.approvalStatus as string | undefined;
  const validApprovalStatuses: Array<'Pendente' | 'Aprovado'> = ['Pendente', 'Aprovado'];
  const approvalStatus = rawApprovalStatus && validApprovalStatuses.includes(rawApprovalStatus as 'Pendente' | 'Aprovado')
    ? rawApprovalStatus as 'Pendente' | 'Aprovado'
    : 'Pendente';
  
  const reseller: ResellerState = rawReseller && typeof rawReseller === 'object'
    ? {
        enabled: Boolean(rawReseller.enabled),
        viewMode,
        resellerName: (rawReseller.resellerName as string) || '',
        overValue: toNum(rawReseller.overValue, 0),
        overReason: (rawReseller.overReason as string) || '',
        observations: (rawReseller.observations as string) || '',
        approvalRequired: Boolean(rawReseller.approvalRequired),
        approvalStatus,
        approver: (rawReseller.approver as string) || '',
        approvedAt: (rawReseller.approvedAt as string) || null,
      }
    : { ...DEFAULT_RESELLER_STATE };
  
  // ============================================
  // STEP 7: Extract other fields
  // ============================================
  const priceOverrides = (data.priceOverrides as PriceOverrideMap) || {};
  const observacao = (data.observacao as string) || '';
  const fx = toNum(data.fx, 5);
  
  // Validate selectedTerm
  const rawSelectedTerm = data.selectedTerm as string | undefined;
  const validTerms = ['1', '12', '24', '36', '48'];
  const selectedTerm = rawSelectedTerm && validTerms.includes(rawSelectedTerm) 
    ? rawSelectedTerm 
    : '1';
  
  const datacenter = (data.datacenter as 'SP1' | 'SP2' | 'FL1' | 'CE1') || 'SP1';
  
  // Client info
  const rawClient = (data.client || proposal) as Record<string, unknown>;
  const client = {
    name: (rawClient.name as string) || '',
    company: (rawClient.company as string) || '',
    phone: (rawClient.phone as string) || '',
    email: (rawClient.email as string) || '',
  };
  
  // Proposal meta
  const rawProposal = data.proposal as Record<string, unknown> | undefined;
  const proposalMeta = {
    id: (rawProposal?.id as string) || `PROP-${proposal.id || 'NEW'}`,
    validityDays: toNum(rawProposal?.validityDays, 7),
    createdAt: (rawProposal?.createdAt as string) || new Date().toISOString(),
  };
  
  // ============================================
  // STEP 8: Calculate totals from result if available
  // ============================================
  const rawResult = data.result as Record<string, unknown> | undefined;
  const totals = {
    vmSubtotal: toNum(rawResult?.subRec, 0),
    bmSubtotal: 0, // Not separated in current result format
    storageSubtotal: toNum(rawResult?.subStorage, 0),
    kubernetesSubtotal: toNum(rawResult?.subKubernetes, 0),
    openSaasSubtotal: toNum(rawResult?.subOpenSaas, 0),
    addonsSubtotal: toNum(rawResult?.subServices, 0),
    grandTotal: toNum(rawResult?.grandTotal || proposal.total, 0),
  };
  
  // Log what we found
  console.log('[normalizeProposalForEdit] Normalized result:', {
    vmCount: vmItems.length,
    bmCount: baremetalItems.length,
    storageCount: storageItems.length,
    kubernetesEnabled: kubernetes.enabled,
    openSaasEnabled: openSaas.enabled,
    selectedTerm,
    grandTotal: totals.grandTotal,
  });
  
  return {
    vmItems,
    baremetalItems,
    storageItems,
    kubernetes,
    openSaas,
    addons,
    reseller,
    priceOverrides,
    observacao,
    fx,
    selectedTerm,
    datacenter,
    client,
    proposal: proposalMeta,
    totals,
    apiId: toNum(proposal.id, 0) || null,
    displayId: proposalMeta.id,
  };
}

/**
 * Converts normalized state back to the format expected by OpenCalculator
 * This merges vmItems and baremetalItems into the single items array
 */
export function normalizedToCalculatorItems(normalized: NormalizedCalculatorState): Array<VMItem | BMItem> {
  return [...normalized.vmItems, ...normalized.baremetalItems];
}

/**
 * Check if a proposal has any sellable items (servers OR products)
 * Used for validation before saving
 */
export function hasAnySellableItem(normalized: NormalizedCalculatorState): boolean {
  return (
    normalized.vmItems.length > 0 ||
    normalized.baremetalItems.length > 0 ||
    normalized.storageItems.length > 0 ||
    normalized.kubernetes.enabled ||
    normalized.openSaas.enabled
  );
}
