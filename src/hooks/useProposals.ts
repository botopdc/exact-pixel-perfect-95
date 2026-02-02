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
import { buildResultFromSnapshot, canBuildResult } from '@/lib/proposalResultBuilder';
import { generateOpenPDFBlob } from '@/lib/pdfGenerator';
import { persistArchitectCommission, getProposalsByParticipant } from '@/services/proposalParticipantService';
import { 
  buildAddonConfigIdMap,
  loadFlatConfigs,
} from '@/services/calculatorConfigService';
import { extractNumericId, toDisplayId } from '@/lib/proposalIdUtils';

// Proposal status type - STANDARDIZED to 6 canonical values matching API
// DRAFT = Initial state when created (API: Rascunho)
// SENT = Proposal sent to client (API: Enviado)
// APPROVED = Client accepted the proposal (API: Aprovado)
// REJECTED = Client rejected the proposal (API: Recusado)
// EXPIRED = Proposal validity has passed (API: Expirado)
// CANCELLED = Proposal was cancelled (API: Cancelado)
export type ProposalStatus = 'DRAFT' | 'SENT' | 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'CANCELLED';

// Status mapping - API returns readable Portuguese text
// Maps API status values to internal ProposalStatus type
const LEGACY_STATUS_MAP: Record<string, ProposalStatus> = {
  '': 'DRAFT',
  // New API format (Portuguese readable text)
  'Rascunho': 'DRAFT',
  'Enviado': 'SENT',
  'Aprovado': 'APPROVED',
  'Recusado': 'REJECTED',
  'Expirado': 'EXPIRED',
  'Cancelado': 'CANCELLED',
  // Legacy formats for backward compatibility
  'S': 'DRAFT',
  'E': 'SENT',
  'A': 'APPROVED',
  'Approved': 'APPROVED',
  'R': 'REJECTED',
  'Rejected': 'REJECTED',
};

// Reverse mapping - Internal → API format for updates (Portuguese text)
const STATUS_TO_API_MAP: Record<ProposalStatus, string> = {
  'DRAFT': 'Rascunho',
  'SENT': 'Enviado',
  'APPROVED': 'Aprovado',
  'REJECTED': 'Recusado',
  'EXPIRED': 'Expirado',
  'CANCELLED': 'Cancelado',
};

// Convert internal ProposalStatus to API format for updates
// Returns 'Rascunho' as default if status is undefined or not mapped
export function statusToApiFormat(status: ProposalStatus | undefined | null): string {
  if (!status) return 'Rascunho';
  return STATUS_TO_API_MAP[status] || 'Rascunho';
}

// Normalize any status value to canonical ProposalStatus
export function normalizeStatus(rawStatus: string | undefined | null): ProposalStatus {
  if (!rawStatus || rawStatus.trim() === '') return 'DRAFT';
  const normalized = LEGACY_STATUS_MAP[rawStatus];
  if (normalized) return normalized;
  // If it's already a valid canonical status, return it
  if (['DRAFT', 'SENT', 'APPROVED', 'REJECTED', 'EXPIRED', 'CANCELLED'].includes(rawStatus)) {
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
  // Preserve dados_proposta for fallback access to creator info
  dados_proposta?: {
    created_by_user_id?: number;
    created_by_email?: string;
    created_by_name?: string;
    created_by_level?: number;
    [key: string]: any;
  };
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
    const normalizedItems = (dadosProposta.items || []).map((item: any, idx: number) => {
      // ============================================
      // GPU PRESERVATION: support both legacy shape (gpu:string + gpuQty:number)
      // and new API/server shape (gpu:{ model, quantity })
      // ============================================
      const rawGpuObj = item.gpu && typeof item.gpu === 'object' ? item.gpu : null;
      const rawGpuModel = rawGpuObj ? (rawGpuObj as any).model : item.gpu;
      const rawGpuQty = rawGpuObj ? (rawGpuObj as any).quantity : item.gpuQty;

      const itemGpu = typeof rawGpuModel === 'string' && rawGpuModel !== '' ? rawGpuModel : 'Sem GPU';
      const itemGpuQty = typeof rawGpuQty === 'number' ? rawGpuQty : toNum(rawGpuQty, 0);

      if (itemGpu !== 'Sem GPU' && itemGpuQty > 0) {
        console.log(`[EDIT] GPU restored: model=${itemGpu} qty=${itemGpuQty}`);
      }
      
      // ============================================
      // SERVER TYPE PRESERVATION: Check type field first, then fallback indicators
      // ============================================
      const isBM = item.type === 'bm' || 
                   item.type === 'baremetal' || 
                   !!item.bmCpu || 
                   !!item.bmRam || 
                   (Array.isArray(item.disks) && item.disks.length > 0);
      
      // ============================================
      // IPs PRESERVATION: Keep the original value (can be 0, 1, 2, 3, etc.)
      // ============================================
      const ips = typeof item.ips === 'number' ? item.ips : toNum(item.ips, 1);
      console.log(`[EDIT] Server #${idx + 1} type=${isBM ? 'bm' : 'vm'} ips=${ips}`);

      if (isBM) {
        return {
          ...item,
          type: 'bm', // CRITICAL: Ensure type is always set
          gpu: itemGpu,
          gpuQty: itemGpuQty,
          disks: Array.isArray(item.disks) ? item.disks : [{ type: 'nvme_1tb', qty: 1, desc: '' }],
          qtyServers: toNum(item.qtyServers, 1),
          ips,
        };
      }
      return {
        ...item,
        type: 'vm', // CRITICAL: Ensure type is always set
        gpu: itemGpu,
        gpuQty: itemGpuQty,
        vcpu: toNum(item.vcpu, 16),
        ramGb: toNum(item.ramGb, 128),
        nvmeTb: toNum(item.nvmeTb, 0.09765625), // 100GB default
        qtyServers: toNum(item.qtyServers, 1),
        ips,
      };
    });
    
    // ============================================
    // ADDONS RESTORATION: Log addons being restored from dados_proposta
    // ============================================
    const rawAddons = dadosProposta.addons || {};
    
    // Log specific addons for debugging
    if (toNum(rawAddons.winserver, 0) > 0) {
      console.log('[EDIT] WindowsServer units restored:', toNum(rawAddons.winserver, 0));
    }
    if (rawAddons.backupPlan && rawAddons.backupPlan !== 'none') {
      console.log('[EDIT] Backup restored: plan=', rawAddons.backupPlan, ', gb=', toNum(rawAddons.backupGb, 0));
    }
    
    const normalizedAddons: AddonsState = {
      backupPlan: rawAddons.backupPlan || 'none',
      backupGb: toNum(rawAddons.backupGb, 0),
      antivirus: toNum(rawAddons.antivirus, 0),
      // Firewall: convert old boolean to number
      firewall: typeof rawAddons.firewall === 'boolean' ? (rawAddons.firewall ? 1 : 0) : toNum(rawAddons.firewall, 0),
      tsplus: toNum(rawAddons.tsplus, 0),
      cal: toNum(rawAddons.cal, 0),
      sql: rawAddons.sql || 'none',
      sqlQty: toNum(rawAddons.sqlQty, 0),
      veeamVm: toNum(rawAddons.veeamVm, 0),
      veeamAg: toNum(rawAddons.veeamAg, 0),
      winserver: toNum(rawAddons.winserver, 0),
      support: {
        level: rawAddons.support?.level || 'none',
        price: toNum(rawAddons.support?.price, 0),
      },
      consulting: {
        quantity: toNum(rawAddons.consulting?.quantity, 0),
        unitPrice: toNum(rawAddons.consulting?.unitPrice, 200),
      },
      dba: {
        quantity: toNum(rawAddons.dba?.quantity, 0),
        unitPrice: toNum(rawAddons.dba?.unitPrice, 250),
      },
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
    
    // Use saved result OR build from snapshot if result is missing/incomplete
    // Import buildResultFromSnapshot for reconstruction
    const savedResult = dadosProposta.result;
    const grandTotal = toNum(apiProposal.total, toNum(savedResult?.grandTotal, 0));
    
    // CRITICAL: Determine if we need to reconstruct the result
    // This is necessary when:
    // 1. Result is missing or has no rows
    // 2. Rows exist but have zero prices (indicative of corrupt/incomplete data)
    // 3. The sum of row subtotals doesn't match any reasonable total
    const hasEmptyRows = !savedResult || !savedResult.rows || savedResult.rows.length === 0;
    
    // Check for zero prices in rows - more aggressive check
    const hasZeroPrices = savedResult?.rows?.some((row: any) => {
      // A row is considered "bad" if both unitPrice and subtotal are zero but qty is > 0
      const qty = typeof row.qty === 'number' ? row.qty : 1;
      const hasZeroUnit = row.unitPrice === 0 || row.unitPrice === undefined || row.unitPrice === null;
      const hasZeroSub = row.subtotal === 0 || row.subtotal === undefined || row.subtotal === null;
      return qty > 0 && hasZeroUnit && hasZeroSub;
    });
    
    // Calculate sum of rows for validation
    const rowsSum = savedResult?.rows?.reduce((sum: number, row: any) => {
      const finalTotal = row.finalTotal ?? row.subtotal ?? 0;
      return sum + toNum(finalTotal, 0);
    }, 0) || 0;
    
    // If we have a significant total but rows sum is zero or much smaller, something is wrong
    const hasMismatchedTotal = grandTotal > 100 && rowsSum < (grandTotal * 0.1);
    
    const needsReconstruction = hasEmptyRows || hasZeroPrices || hasMismatchedTotal;
    let finalResult = savedResult;
    
    if (needsReconstruction && canBuildResult(dadosProposta)) {
      console.log('[apiToLocal] Reconstructing result from snapshot for proposal', apiProposal.id, {
        hasEmptyRows,
        hasZeroPrices,
        hasMismatchedTotal,
        rowCount: savedResult?.rows?.length || 0,
        rowsSum,
        grandTotal,
      });
      finalResult = buildResultFromSnapshot(
        dadosProposta,
        grandTotal,
        apiProposal.contract_duration || 12
      );
    } else if (needsReconstruction) {
      console.warn('[apiToLocal] Cannot reconstruct result - insufficient data in dados_proposta', apiProposal.id);
    }
    
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
      created_by: apiProposal.created_by ?? dadosProposta.created_by_user_id ?? null,
      creator: apiProposal.creator ?? (dadosProposta.created_by_name ? {
        id: dadosProposta.created_by_user_id,
        email: dadosProposta.created_by_email,
        name: dadosProposta.created_by_name,
        level: dadosProposta.created_by_level,
      } : null),
      // Preserve dados_proposta for fallback access to creator info
      dados_proposta: dadosProposta,
      result: finalResult || {
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
    firewall: 0, // Changed from false to 0
    tsplus: 0,
    cal: 0,
    sql: 'none',
    sqlQty: 0,
    veeamVm: 0,
    veeamAg: 0,
    winserver: 0,
    support: { level: 'none', price: 0 },
    consulting: { quantity: 0, unitPrice: 200 },
    dba: { quantity: 0, unitPrice: 250 },
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
        console.log('[EDIT] Antivirus restored:', addonQty);
      } else if (addonNameLower.includes('firewall')) {
        reconstructedAddonsState.firewall = addonQty > 0 ? addonQty : 1; // Convert old boolean to qty
        console.log('[EDIT] Firewall restored: qty=' + reconstructedAddonsState.firewall);
      } else if (addonNameLower.includes('tsplus') || addonNameLower.includes('ts plus')) {
        reconstructedAddonsState.tsplus = addonQty;
        console.log('[EDIT] TSPlus restored:', addonQty);
      } else if (addonNameLower.includes('cal') || addonNameLower.includes('ts-cal')) {
        reconstructedAddonsState.cal = addonQty;
        console.log('[EDIT] CAL restored:', addonQty);
      } else if (addonNameLower.includes('veeam') && addonNameLower.includes('vm')) {
        reconstructedAddonsState.veeamVm = addonQty;
        console.log('[EDIT] Veeam VM restored:', addonQty);
      } else if (addonNameLower.includes('veeam') && (addonNameLower.includes('agent') || addonNameLower.includes('workstation'))) {
        reconstructedAddonsState.veeamAg = addonQty;
        console.log('[EDIT] Veeam Agent restored:', addonQty);
      } else if (addonNameLower.includes('winserver') || addonNameLower.includes('windows server') || addonNameLower.includes('win server')) {
        // ============================================
        // PARSE WINSERVER: "WinServer(2vCPU/unid.)" or "Windows Server"
        // ============================================
        reconstructedAddonsState.winserver = addonQty;
        console.log('[EDIT] WindowsServer units restored:', addonQty);
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
        console.log('[EDIT] SQL restored:', { type: reconstructedAddonsState.sql, qty: addonQty });
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
        console.log('[EDIT] Backup restored: plan=', reconstructedAddonsState.backupPlan, ', gb=', reconstructedAddonsState.backupGb);
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
      winserver: reconstructedAddonsState.winserver,
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
      const quantity = toNum(server.quantity, 1);
      
      // ============================================
      // NEW FLAT FORMAT: Extract specs from specs[] array
      // Each spec has { config_id, value } and backend returns { label, price, total }
      // ============================================
      let vcpu = 0;
      let ram = 0;
      let storage = 0;
      let serverPrice = 0;
      
      if (Array.isArray(server.specs) && server.specs.length > 0) {
        // NEW FORMAT: specs[] array
        for (const spec of server.specs) {
          const label = (spec.label || '').toLowerCase();
          const value = toNum(spec.value, 0);
          const specPrice = toNum(spec.price, 0);
          
          if (label.includes('vcpu') || label === 'cpu') {
            vcpu = value;
          } else if (label.includes('ram') || label === 'memoria') {
            ram = value;
          } else if (label.includes('nvme') || label.includes('storage') || label.includes('disco')) {
            storage = value;
          }
          
          serverPrice += specPrice;
        }
        console.log(`[apiToLocal] Parsed specs[] for ${serverName}:`, { vcpu, ram, storage, price: serverPrice });
      } else {
        // LEGACY FORMAT: direct vcpu/ram/storage fields
        vcpu = toNum(server.vcpu, 0);
        ram = toNum(server.ram, 0);
        storage = toNum(server.storage, 0);
        serverPrice = toNum(server.price, 0);
      }
      
      const subtotal = serverPrice * quantity;
      
      // Build display label with specs
      const specLabel = vcpu > 0 || ram > 0 || storage > 0
        ? `${serverName} (${vcpu} vCPU, ${ram}GB RAM, ${storage}GB)`
        : serverName;
      
      // Add row for result
      rows.push({
        label: specLabel,
        qty: quantity,
        unitPrice: serverPrice,
        subtotal: subtotal,
      });
      
      serversSubtotal += subtotal;
      
      // Detect if VM or BareMetal based on name and specs
      const isVM = serverName.toLowerCase().includes('vm') || vcpu > 0;
      
      // ============================================
      // GPU RECONSTRUCTION: Extract GPU from server object
      // ============================================
      let serverGpu = 'Sem GPU';
      let serverGpuQty = 0;

      if (server.gpu && typeof server.gpu === 'object') {
        serverGpu = typeof server.gpu.model === 'string' && server.gpu.model !== '' ? server.gpu.model : 'Sem GPU';
        serverGpuQty = typeof server.gpu.quantity === 'number' ? server.gpu.quantity : toNum(server.gpu.quantity, 0);
      } else {
        const rawGpu = server.gpu || server.gpu_model || server.extras?.gpu;
        serverGpu = typeof rawGpu === 'string' && rawGpu !== '' ? rawGpu : 'Sem GPU';
        const rawGpuQty = server.gpuQty ?? server.gpu_qty ?? server.extras?.gpuQty;
        serverGpuQty = typeof rawGpuQty === 'number' ? rawGpuQty : toNum(rawGpuQty, 0);
      }

      if (serverGpu !== 'Sem GPU' && serverGpuQty > 0) {
        console.log(`[EDIT] GPU restored: model=${serverGpu} qty=${serverGpuQty}`);
      }

      if (isVM) {
        return {
          type: 'vm' as const,
          id: crypto.randomUUID(),
          gpu: serverGpu,
          gpuQty: serverGpuQty,
          vcpu: vcpu || 16,
          ramGb: ram || 128,
          nvmeTb: (storage || 100) / 1024, // Convert GB to TB
          trafficTb: 5,
          ips: toNum(server.ips, 1),
          qtyServers: quantity,
        };
      } else {
        return {
          type: 'bm' as const,
          id: crypto.randomUUID(),
          gpu: serverGpu,
          gpuQty: serverGpuQty,
          bmCpu: server.bmCpu || server.cpu_model || 'intel_xeon_e2136',
          bmRam: server.bmRam || server.ram_tier || 'ram_128gb',
          disks: Array.isArray(server.disks) && server.disks.length > 0 
            ? server.disks 
            : [{ type: 'nvme_1tb', qty: 1, desc: '' }],
          trafficTb: 5,
          ips: toNum(server.ips, 1),
          qtyServers: quantity,
        };
      }
    });
  
  // Add addon rows if they exist
  // NEW FLAT FORMAT: Backend returns addons with { config_id, quantity, label, price }
  if (apiProposal.addons && Array.isArray(apiProposal.addons)) {
    for (const addon of apiProposal.addons) {
      // NEW FORMAT: label comes from backend based on config_id
      // LEGACY FORMAT: name was sent by frontend
      const addonLabel = addon.label || addon.name || `Add-on #${addon.config_id || '?'}`;
      const addonPrice = toNum(addon.price, 0);
      const addonQty = toNum(addon.quantity, 1);
      
      if (addonLabel && addonQty > 0) {
        rows.push({
          label: addonLabel,
          qty: addonQty,
          unitPrice: addonPrice / addonQty, // Price from backend is total, convert to unit
          subtotal: addonPrice,
        });
        addonsTotal += addonPrice;
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
    reconstructedAddonsState.veeamAg > 0 ||
    reconstructedAddonsState.winserver > 0;
  
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
// Uses NEW FLAT API FORMAT (January 2026):
// - Servers: name, specs: [{config_id, value}, ...], quantity
// - Addons: {config_id, quantity} - NO price, NO item_id (backend calculates everything)
// 
// @param proposal - The local proposal to convert
// @param addonConfigIdMap - Pre-built map of addon codes to config_ids (from buildAddonConfigIdMap)
function localToApi(proposal: SavedProposal, addonConfigIdMap?: Record<string, number> | null): Record<string, unknown> {
  // Map selectedTerm to contract_duration (MUST include all valid plans: 1, 12, 24, 36, 48)
  const termAsNumber = parseInt(proposal.selectedTerm, 10);
  const contractDuration = isValidContractMonth(termAsNumber) ? termAsNumber : 1;
  
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
  
  // Helper to get config_id from the pre-built map
  const getConfigId = (code: string): number | null => {
    if (!addonConfigIdMap) return null;
    return addonConfigIdMap[code] ?? null;
  };
  
  // ============================================
  // ADDONS - NEW FLAT FORMAT: {config_id, quantity}
  // Each addon type has its own unique config_id from the API
  // ============================================
  const addonsArray: Array<{ config_id: number; quantity: number }> = [];
  
  // Storage items - add each storage configuration as an addon
  if (proposal.storageItems && Array.isArray(proposal.storageItems)) {
    for (const storage of proposal.storageItems) {
      const volumeTB = toNum(storage.volumeTB, 0);
      const volumeGB = toNum(storage.volumeGB, 0);
      if (volumeTB > 0 || volumeGB > 0) {
        const storageType = storage.storageType || 'sas';
        const configId = getConfigId(`storage_${storageType}`);
        if (configId) {
          // Quantity is in GB for storage
          const qty = volumeGB > 0 ? volumeGB : Math.round(volumeTB * 1024);
          addonsArray.push({ config_id: configId, quantity: qty });
        }
      }
    }
  }
  
  // Kubernetes - add as addon if enabled
  if (proposal.kubernetes && proposal.kubernetes.enabled) {
    const configId = getConfigId('kubernetes');
    if (configId) {
      addonsArray.push({ config_id: configId, quantity: 1 });
    }
  }
  
  // OPEN SaaS - add as addon if enabled with users > 0
  if (proposal.openSaas && proposal.openSaas.enabled && proposal.openSaas.users > 0) {
    const configId = getConfigId('open_saas');
    if (configId) {
      addonsArray.push({ config_id: configId, quantity: proposal.openSaas.users });
    }
  }
  
  if (proposal.addons && typeof proposal.addons === 'object') {
    const addons = proposal.addons;
    
    // WinServer - uses specific config_id from API
    if (typeof addons.winserver === 'number' && addons.winserver > 0) {
      const configId = getConfigId('winserver');
      if (configId) {
        addonsArray.push({ config_id: configId, quantity: addons.winserver });
      }
    }
    
    // Antivirus
    if (typeof addons.antivirus === 'number' && addons.antivirus > 0) {
      const configId = getConfigId('antivirus');
      if (configId) {
        addonsArray.push({ config_id: configId, quantity: addons.antivirus });
      }
    }
    
    // Firewall
    if (addons.firewall === true || (typeof addons.firewall === 'number' && addons.firewall > 0)) {
      const configId = getConfigId('firewall');
      const fwQty = typeof addons.firewall === 'number' ? addons.firewall : 1;
      if (configId) {
        addonsArray.push({ config_id: configId, quantity: fwQty });
      }
    }
    
    // TSPlus
    if (typeof addons.tsplus === 'number' && addons.tsplus > 0) {
      const configId = getConfigId('tsplus');
      if (configId) {
        addonsArray.push({ config_id: configId, quantity: addons.tsplus });
      }
    }
    
    // CAL
    if (typeof addons.cal === 'number' && addons.cal > 0) {
      const configId = getConfigId('cal');
      if (configId) {
        addonsArray.push({ config_id: configId, quantity: addons.cal });
      }
    }
    
    // Veeam VM
    if (typeof addons.veeamVm === 'number' && addons.veeamVm > 0) {
      const configId = getConfigId('veeam_vm');
      if (configId) {
        addonsArray.push({ config_id: configId, quantity: addons.veeamVm });
      }
    }
    
    // Veeam Agent
    if (typeof addons.veeamAg === 'number' && addons.veeamAg > 0) {
      const configId = getConfigId('veeam_agent');
      if (configId) {
        addonsArray.push({ config_id: configId, quantity: addons.veeamAg });
      }
    }
    
    // Backup - uses plan-specific config_id (backup_7, backup_15, backup_30)
    if (addons.backupPlan && addons.backupPlan !== 'none' && typeof addons.backupGb === 'number' && addons.backupGb > 0) {
      const backupCode = `backup_${addons.backupPlan}`;
      const configId = getConfigId(backupCode);
      if (configId) {
        addonsArray.push({ config_id: configId, quantity: Math.max(addons.backupGb, 1) });
      }
    }
    
    // SQL Server - uses edition-specific config_id (sql_web, sql_standard, sql_enterprise)
    if (addons.sql && addons.sql !== 'none' && typeof addons.sqlQty === 'number' && addons.sqlQty > 0) {
      const sqlCode = `sql_${addons.sql.toLowerCase()}`;
      const configId = getConfigId(sqlCode);
      if (configId) {
        addonsArray.push({ config_id: configId, quantity: addons.sqlQty });
      }
    }
    
    // Support - specialized service (support_basic, support_intermediate, support_advanced)
    if (addons.support && addons.support.level !== 'none' && addons.support.price > 0) {
      const supportCode = `support_${addons.support.level}`;
      const configId = getConfigId(supportCode);
      if (configId) {
        addonsArray.push({ config_id: configId, quantity: 1 });
      }
    }
    
    // Consulting - specialized service
    if (addons.consulting && typeof addons.consulting.quantity === 'number' && addons.consulting.quantity > 0) {
      const configId = getConfigId('consulting');
      if (configId) {
        addonsArray.push({ config_id: configId, quantity: addons.consulting.quantity });
      }
    }
    
    // DBA - specialized service
    if (addons.dba && typeof addons.dba.quantity === 'number' && addons.dba.quantity > 0) {
      const configId = getConfigId('dba');
      if (configId) {
        addonsArray.push({ config_id: configId, quantity: addons.dba.quantity });
      }
    }
  }
  
  console.log('[localToApi] Addons (FLAT format):', addonsArray);
  console.log('[localToApi] Using addon config ID map:', addonConfigIdMap);
  
  // ============================================
  // SERVERS - NEW FLAT FORMAT: name, specs: [{config_id, value}, ...], quantity
  // Config IDs are fetched from the addonConfigIdMap which includes VM components
  // ============================================
  const serversArray: Array<{ name: string; specs: Array<{ config_id: number; value: number }>; quantity: number }> = [];
  
  // Config IDs for VM specs - fetched from the pre-built map
  const VCPU_CONFIG_ID = getConfigId('vcpu') ?? 1;
  const RAM_CONFIG_ID = getConfigId('ram') ?? 2;
  const NVME_CONFIG_ID = getConfigId('nvme') ?? 3;
  const IP_CONFIG_ID = getConfigId('ip') ?? 4;
  
  console.log('[localToApi] VM Config IDs:', { VCPU_CONFIG_ID, RAM_CONFIG_ID, NVME_CONFIG_ID, IP_CONFIG_ID });
  
  if (proposal.items && Array.isArray(proposal.items)) {
    for (const [idx, item] of proposal.items.entries()) {
      if (item.type === 'vm') {
        // Build specs array for VM
        const specs: Array<{ config_id: number; value: number }> = [];
        
        // vCPU
        const vcpu = toNum(item.vcpu, 1);
        if (vcpu > 0) {
          specs.push({ config_id: VCPU_CONFIG_ID, value: Math.max(vcpu, 1) }); // Minimum 1 vCPU
        }
        
        // RAM in GB
        const ramGb = toNum(item.ramGb, 1);
        if (ramGb > 0) {
          specs.push({ config_id: RAM_CONFIG_ID, value: Math.max(ramGb, 1) }); // Minimum 1GB RAM
        }
        
        // NVMe storage in GB (convert from TB if needed)
        const nvmeTb = toNum(item.nvmeTb, 0);
        const storageGb = Math.round(nvmeTb * 1024) || 100; // Default 100GB
        if (storageGb > 0) {
          specs.push({ config_id: NVME_CONFIG_ID, value: storageGb });
        }
        
        // IP addresses
        const ips = toNum(item.ips, 0);
        if (ips > 0 && IP_CONFIG_ID) {
          specs.push({ config_id: IP_CONFIG_ID, value: ips });
        }
        
        // GPU - extract model and quantity for serialization
        const gpuModel = typeof item.gpu === 'string' && item.gpu !== '' && item.gpu !== 'Sem GPU'
          ? item.gpu
          : (item.gpu && typeof item.gpu === 'object' ? (item.gpu as any).model : null);
        const gpuQty = typeof item.gpuQty === 'number' ? item.gpuQty : toNum(item.gpuQty ?? (item.gpu as any)?.quantity, 0);
        
        // Build GPU object for server payload
        let gpuPayload: { model: string; quantity: number } | undefined = undefined;
        if (gpuModel && gpuQty > 0) {
          gpuPayload = { model: gpuModel, quantity: gpuQty };
          console.log(`[SERIALIZE] VM GPU: model=${gpuModel} qty=${gpuQty}`);
        }
        
        const server: any = {
          name: `VM #${idx + 1}`,
          type: 'vm',
          specs,
          quantity: toNum(item.qtyServers, 1),
        };
        
        // Add GPU to server payload if present
        if (gpuPayload) {
          server.gpu = gpuPayload;
        }
        
        console.log(`[SERIALIZE] VM #${idx + 1}:`, server);
        serversArray.push(server);
        
      } else if (item.type === 'bm') {
        // BareMetal - serialize with specs including CPU, RAM, Disks, IPs
        const specs: Array<{ config_id: number; value: number }> = [];
        
        // For BareMetal, we use the same config IDs but the values represent the selection
        // The actual CPU/RAM models are stored in the dados_proposta for reconstruction
        specs.push({ config_id: VCPU_CONFIG_ID, value: 1 }); // Placeholder for CPU model
        specs.push({ config_id: RAM_CONFIG_ID, value: 1 }); // Placeholder for RAM model
        
        // IP addresses for BareMetal
        const ips = typeof item.ips === 'number' ? item.ips : toNum(item.ips, 0);
        if (ips > 0 && IP_CONFIG_ID) {
          specs.push({ config_id: IP_CONFIG_ID, value: ips });
        }
        
        // GPU - extract model and quantity for BareMetal
        const gpuModel = typeof item.gpu === 'string' && item.gpu !== '' && item.gpu !== 'Sem GPU'
          ? item.gpu
          : (item.gpu && typeof item.gpu === 'object' ? (item.gpu as any).model : null);
        const gpuQty = typeof item.gpuQty === 'number' ? item.gpuQty : toNum(item.gpuQty ?? (item.gpu as any)?.quantity, 0);
        
        let gpuPayload: { model: string; quantity: number } | undefined = undefined;
        if (gpuModel && gpuQty > 0) {
          gpuPayload = { model: gpuModel, quantity: gpuQty };
          console.log(`[SERIALIZE] BareMetal GPU: model=${gpuModel} qty=${gpuQty}`);
        }
        
        const server: any = {
          name: `BareMetal #${idx + 1}`,
          type: 'baremetal',
          specs,
          quantity: toNum(item.qtyServers, 1),
        };
        
        // Add GPU to server payload if present
        if (gpuPayload) {
          server.gpu = gpuPayload;
        }
        
        console.log(`[SERIALIZE] BareMetal #${idx + 1}:`, server);
        serversArray.push(server);
      }
    }
  }
  
  // ============================================
  // WORKAROUND: API requires servers array to have at least 1 item
  // When there are no VMs/BMs but there are independent products,
  // add virtual server entries to satisfy API requirement
  // ============================================
  if (serversArray.length === 0) {
    // Check for independent products
    const hasStorage = (proposal.storageItems || []).some((s: any) => toNum(s.volumeTB, 0) > 0 || toNum(s.volumeGB, 0) > 0);
    const hasK8s = proposal.kubernetes?.enabled;
    const hasSaas = proposal.openSaas?.enabled && proposal.openSaas.users > 0;
    
    if (hasStorage || hasK8s || hasSaas) {
      // Add virtual server placeholder with minimum specs
      serversArray.push({
        name: '__VIRTUAL__BUNDLE__:{}',
        specs: [
          { config_id: VCPU_CONFIG_ID, value: 1 },
          { config_id: RAM_CONFIG_ID, value: 1 },
        ],
        quantity: 1,
      });
      console.log('[localToApi] Added virtual server for independent products');
    } else {
      // Fallback: add minimal placeholder
      console.warn('[localToApi] No items found, adding virtual placeholder');
      serversArray.push({
        name: '__VIRTUAL__BUNDLE__:{}',
        specs: [
          { config_id: VCPU_CONFIG_ID, value: 1 },
          { config_id: RAM_CONFIG_ID, value: 1 },
        ],
        quantity: 1,
      });
    }
  }
  
  console.log('[localToApi] Servers (FLAT format):', serversArray);
  
  // Build complete dados_proposta object with ALL calculator state
  // This ensures we can restore the exact proposal when editing
  const session = authService.getSession();
  const currentUserId = session?.userId || null;
  const currentUserEmail = session?.email || null;
  const currentUserName = session?.name || null;
  const currentUserLevel = session?.level || null;
  
  const existingCreatorId = (proposal as any).created_by_user_id || (proposal as any).created_by || proposal.creator?.id;
  const existingCreatorName = (proposal as any).created_by_name || proposal.creator?.name;
  const existingCreatorEmail = (proposal as any).created_by_email || proposal.creator?.email;
  const existingCreatorLevel = (proposal as any).created_by_level || proposal.creator?.level;
  
  const dadosProposta = {
    proposalId: proposal.proposal?.id,
    created_by_user_id: existingCreatorId || currentUserId,
    created_by_email: existingCreatorEmail || currentUserEmail,
    created_by_name: existingCreatorName || currentUserName,
    created_by_level: existingCreatorLevel || currentUserLevel,
    created_by_role: (proposal as any).created_by_role,
    fx: proposal.fx,
    selectedTerm: proposal.selectedTerm,
    datacenter: proposal.datacenter,
    client: proposal.client,
    proposal: proposal.proposal,
    items: proposal.items,
    addons: proposal.addons,
    kubernetes: proposal.kubernetes,
    storageItems: proposal.storageItems,
    reseller: proposal.reseller,
    openSaas: proposal.openSaas,
    result: proposal.result,
    observacao: proposal.observacao,
    status: statusToApiFormat(proposal.status as ProposalStatus) || 'Rascunho',
    acceptance: proposal.acceptance,
  };
  
  const finalPayload = {
    name: proposal.client?.name || '',
    company: proposal.client?.company || '',
    phone: proposal.client?.phone || '',
    email: proposal.client?.email || '',
    channel_type: 'CLIENTE',
    reseller_name: proposal.reseller?.resellerName || null,
    commission_value: proposal.reseller?.overValue || null,
    commission_reason: proposal.reseller?.overReason || null,
    observations: proposal.observacao || null,
    fx: proposal.fx || 1,
    datacenter: datacenterNames[proposal.datacenter || 'SP1'] || 'São Paulo',
    contract_duration: contractDuration,
    discount_pct: discountPct,
    total: proposal.total || proposal.result?.grandTotal || 0,
    // NEW FLAT FORMAT: servers with specs[], addons with config_id + quantity only
    servers: serversArray,
    addons: addonsArray,
    due_at: dueAt.toISOString(),
    status: statusToApiFormat(proposal.status),
    dados_proposta: dadosProposta,
  };
  
  console.log('[localToApi] PAYLOAD FINAL (FLAT FORMAT):', {
    total: finalPayload.total,
    serversCount: serversArray.length,
    addonsCount: addonsArray.length,
    servers: serversArray,
    addons: addonsArray,
  });
  
  return finalPayload;
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
  
  // Architects (690): SPECIAL CASE - will be filtered separately by participant query
  // Return empty here; architect proposals are fetched via useArchitectProposals
  if (userLevel === 690) {
    console.log('[filterProposalsByOwnership] Level 690 (Architect) - proposals will be filtered by participant');
    return []; // Architect proposals fetched separately
  }
  
  // Other internal levels (600, 900, 950): no access to commercial proposals
  console.warn('[filterProposalsByOwnership] Level', userLevel, 'has no access to proposals');
  return [];
}

// Hook to fetch proposals for architects (level 690)
// Fetches only proposals where the user is a participant with role=ARCHITECT
// Returns paginated format for consistency with useProposals
export function useArchitectProposals(page = 1) {
  const session = authService.getSession();
  const userId = session?.userId || null;
  
  return useQuery({
    queryKey: ['proposals', 'api', 'architect', page, userId],
    queryFn: async () => {
      if (!userId) {
        console.warn('[useArchitectProposals] No userId available');
        return {
          proposals: [] as SavedProposal[],
          pagination: { currentPage: 1, lastPage: 1, total: 0 },
        };
      }
      
      const numericUserId = Number(userId);
      
      try {
        // 1. Get all proposal IDs where this user is an ARCHITECT participant
        console.log('[useArchitectProposals] Fetching participations for user:', numericUserId);
        const participations = await getProposalsByParticipant(numericUserId, 'ARCHITECT');
        
        if (participations.length === 0) {
          console.log('[useArchitectProposals] No architect participations found for user:', numericUserId);
          return {
            proposals: [] as SavedProposal[],
            pagination: { currentPage: 1, lastPage: 1, total: 0 },
          };
        }
        
        // proposal_id in Supabase is stored as string of the numeric API ID
        const participantProposalIds = participations.map(p => p.proposal_id);
        console.log('[useArchitectProposals] Found architect participations:', participantProposalIds);
        
        // 2. Fetch proposals with __order=id:DESC (default) - no perPage override, uses API default
        const response = await openApi.getProposals({
          channel_type: 'CLIENTE',
          __page: page,
        });
        
        const apiProposals = (response.data || []) as ApiProposal[];
        const localProposals = apiProposals.map(apiToLocal);
        
        // 3. Filter to only proposals where user is architect participant
        // Note: compare as strings since proposal_id in Supabase is stored as string
        const filtered = localProposals.filter(p => {
          const proposalApiId = p.id ? String(p.id) : null;
          return proposalApiId && participantProposalIds.includes(proposalApiId);
        });
        
        console.log('[useArchitectProposals] Filtered proposals:', filtered.length, 'of', localProposals.length);
        
        return {
          proposals: filtered,
          pagination: { currentPage: page, lastPage: 1, total: filtered.length },
        };
      } catch (error) {
        console.warn('[useArchitectProposals] Error fetching proposals:', error);
        return {
          proposals: [] as SavedProposal[],
          pagination: { currentPage: 1, lastPage: 1, total: 0 },
        };
      }
    },
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    enabled: !!userId,
  });
}

// Hook to fetch executive proposals from API (excludes partner proposals)
// Uses GET /api/calculator/proposal with channel_type=CLIENTE filter
// RBAC: Filters proposals based on user level and ownership
// For architects (690), use useArchitectProposals instead
// NOW SUPPORTS: server-side filtering via status, __q, __order
export interface ProposalFilters {
  status?: string; // API format: 'Enviado', 'Approved', 'Rejected', ''
  search?: string; // __q parameter for text search
  perPage?: number; // __perPage parameter for pagination
}

export function useProposals(page = 1, filters?: ProposalFilters) {
  // Get user session for RBAC filtering
  const session = authService.getSession();
  const userLevel = session?.level || 0;
  const userId = session?.userId || null;
  
  // For architects, delegate to useArchitectProposals (they don't use filters)
  const architectQuery = useArchitectProposals(page);
  
  const regularQuery = useQuery({
    queryKey: ['proposals', 'api', 'executive', page, userLevel, userId, filters?.status, filters?.search, filters?.perPage],
    queryFn: async () => {
      // Don't fetch for architects - they use the architect query
      if (userLevel === 690) {
        return [];
      }
      
      try {
        // Build params with server-side filters
        const params: Record<string, any> = {
          channel_type: 'CLIENTE',
          __page: page,
          // __order=id:DESC is now default in openApi.getProposals
        };
        
        // Add perPage if provided
        if (filters?.perPage) {
          params.__perPage = filters.perPage;
        }
        
        // Add status filter if provided (not 'all')
        if (filters?.status && filters.status !== 'all') {
          params.status = filters.status;
        }
        
        // Add search filter if provided
        if (filters?.search && filters.search.trim()) {
          params.__q = filters.search.trim();
        }
        
        // Call API directly: GET /api/calculator/proposal
        const response = await openApi.getProposals(params);

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
          filters,
          pagination: { current: response.current_page, last: response.last_page, total: response.total },
        });

        return {
          proposals: filtered,
          pagination: {
            currentPage: response.current_page || page,
            lastPage: response.last_page || 1,
            total: response.total || 0,
          },
        };
      } catch (error) {
        console.warn('[Proposals] API fetch failed, returning empty:', error);
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
    enabled: userLevel !== 690, // Disable for architects
  });
  
  // Return architect query for level 690, regular query otherwise
  if (userLevel === 690) {
    // Architect query already returns paginated format
    return architectQuery;
  }
  
  return regularQuery;
}

// Hook to fetch executive proposals with pagination info (excludes partner proposals)
// Uses GET /api/calculator/proposal with channel_type=CLIENTE filter
// RBAC: Filters proposals based on user level and ownership
export function useProposalsPaginated(page = 1, filters?: ProposalFilters) {
  // Get user session for RBAC filtering
  const session = authService.getSession();
  const userLevel = session?.level || 0;
  const userId = session?.userId || null;

  return useQuery({
    queryKey: ['proposals', 'api', 'executive', 'paginated', page, userLevel, userId, filters?.status, filters?.search, filters?.perPage],
    queryFn: async () => {
      try {
        // Build params with server-side filters
        const params: Record<string, any> = {
          channel_type: 'CLIENTE',
          __page: page,
          // __order=id:DESC is now default in openApi.getProposals
        };
        
        // Add perPage if provided
        if (filters?.perPage) {
          params.__perPage = filters.perPage;
        }
        
        // Add status filter if provided (not 'all')
        if (filters?.status && filters.status !== 'all') {
          params.status = filters.status;
        }
        
        // Add search filter if provided
        if (filters?.search && filters.search.trim()) {
          params.__q = filters.search.trim();
        }
        
        // Call API directly: GET /api/calculator/proposal
        const response = await openApi.getProposals(params);

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
          filters,
        });

        return {
          proposals: filtered,
          pagination: {
            currentPage: response.current_page || page,
            lastPage: response.last_page || Math.ceil((response.total || 0) / 15) || 1,
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
// UNIFIED: Now fetches with __with=files,creator to get all data in a single request
export function useProposal(proposalId: string | undefined) {
  return useQuery({
    queryKey: ['proposal', 'api', proposalId],
    queryFn: async () => {
      if (!proposalId) return null;
      try {
        // CRITICAL: Always extract numeric ID - handles PROP-123, OPEN-abc, etc.
        const numericId = extractNumericId(proposalId);
        
        if (numericId !== null) {
          console.log('[useProposal] Fetching by numeric ID with files,creator:', numericId, '(original:', proposalId, ')');
          // openApi.getProposal now defaults to __with=files,creator
          const result = await openApi.getProposal(numericId);
          
          // Convert to local format - result now includes files and creator
          const localProposal = apiToLocal(result as ApiProposal);
          
          // Attach files directly from API response if present
          const apiResult = result as any;
          if (apiResult.files && Array.isArray(apiResult.files)) {
            (localProposal as any).files = apiResult.files;
          }
          
          return localProposal;
        }
        
        console.warn('[useProposal] Could not extract numeric ID from:', proposalId);
        return null;
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

// Hook to save a proposal (create or update) with optional PDF file
// CRITICAL: Decision logic for POST vs PUT:
// 1. proposal.id as NUMBER → UPDATE (PUT) - this is the API ID from a previous save
// 2. proposal.id undefined/null → CREATE (POST) - new proposal
// 3. proposal.proposal.id is IGNORED for this decision (it's a local display ID like OPEN-ABC123)
// 
// NEW: The mutation now accepts an optional pdfBlob to send along with the proposal data
// in the same request using multipart/form-data.
export function useSaveProposal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ proposal, pdfBlob }: { proposal: SavedProposal; pdfBlob?: Blob }) => {
      // Load addon config ID map for NEW FLAT API format
      let addonConfigIdMap: Record<string, number> | null = null;
      try {
        addonConfigIdMap = await buildAddonConfigIdMap();
        console.log('[SaveProposal] Addon config ID map built:', Object.keys(addonConfigIdMap).length, 'codes mapped');
      } catch (error) {
        console.warn('[SaveProposal] Failed to build addon config ID map, proceeding with fallbacks:', error);
      }

      const apiData = localToApi(proposal, addonConfigIdMap);

      // CRITICAL: Only use proposal.id (the API numeric ID) for update detection
      // DO NOT use proposal.proposal.id - that's the local display ID (OPEN-ABC123)
      let numericId: number | null = null;

      // Only proposal.id as a number indicates this is an existing API record
      if (proposal.id !== undefined && proposal.id !== null && typeof proposal.id === 'number') {
        numericId = proposal.id;
        console.log('[SaveProposal] Detected API ID from proposal.id:', numericId);
      }
      
      // IMPORTANT: We intentionally do NOT check proposal.proposal.id here
      // That field contains locally generated IDs like "OPEN-E5A12345" which are NOT API IDs

      // CRITICAL: Log payload details for debugging
      const dadosProposta = (apiData as any).dados_proposta;
      console.log('[SaveProposal] Sending to API:', {
        mode: numericId ? 'UPDATE (PUT)' : 'CREATE (POST)',
        numericId,
        'proposal.id': proposal.id,
        'proposal.id type': typeof proposal.id,
        'proposal.proposal.id': proposal.proposal?.id,
        channel_type: (apiData as any).channel_type,
        configIdsLoaded: !!addonConfigIdMap,
        configIdMapSize: addonConfigIdMap ? Object.keys(addonConfigIdMap).length : 0,
        hasPdfFile: !!pdfBlob,
        pdfFileSize: pdfBlob?.size,
        dados_proposta_summary: {
          hasProposalId: Boolean(dadosProposta?.proposalId),
          hasOwnerUserId: Boolean(dadosProposta?.created_by_user_id),
          hasOwnerEmail: Boolean(dadosProposta?.created_by_email),
          hasItems: Boolean(dadosProposta?.items?.length),
          itemsCount: dadosProposta?.items?.length || 0,
        },
        addonsCount: (apiData as any).addons?.length || 0,
        serversCount: (apiData as any).servers?.length || 0,
        sampleAddon: (apiData as any).addons?.[0],
        sampleServer: (apiData as any).servers?.[0],
      });

      let result: any;
      
      if (numericId !== null && numericId > 0) {
        // Update existing proposal via API: PUT /api/calculator/proposal/{id}
        console.log('[SaveProposal] ✓ UPDATING proposal via PUT:', numericId, pdfBlob ? 'with PDF file' : 'without file');
        result = await openApi.updateProposal(numericId, apiData, pdfBlob);
      } else {
        // Create new proposal via API: POST /api/calculator/proposal
        console.log('[SaveProposal] ✓ CREATING new proposal via POST', pdfBlob ? 'with PDF file' : 'without file');
        result = await openApi.createProposal(apiData, pdfBlob);
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
      // Load addon config ID map for NEW FLAT API format
      let addonConfigIdMap: Record<string, number> | null = null;
      try {
        addonConfigIdMap = await buildAddonConfigIdMap();
      } catch (error) {
        console.warn('[UpdateProposal] Failed to build addon config ID map:', error);
      }

      // Parse numeric ID
      const numericId = parseInt(id, 10);
      if (!isNaN(numericId)) {
        const apiData = localToApi(proposal, addonConfigIdMap);
        const result = await openApi.updateProposal(numericId, apiData);
        return { success: true, data: result };
      }
      
      // Fallback: search by PROP-ID format
      const response = await openApi.getProposals({ __perPage: 500 });
      const existing = (response.data as ApiProposal[]).find(p => `PROP-${p.id}` === id);
      
      if (existing) {
        const apiData = localToApi(proposal, addonConfigIdMap);
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
        // STATUS FIELD - Convert internal status to API format
        // Internal: APPROVED, REJECTED, SENT → API: Approved, Rejected, Enviado
        status: statusToApiFormat(status),
      };
      
      console.log('[useUpdateProposalStatus] Updating proposal', numericId, 'with status:', status, '→ API:', statusToApiFormat(status));
      
      const result = await openApi.updateProposal(numericId, updatePayload);
      console.log('[useUpdateProposalStatus] Update result:', result);
      
      // If status is APPROVED, persist architect commission
      if (status === 'APPROVED') {
        try {
          const contractDuration = existing.contract_duration || 12;
          await persistArchitectCommission(String(numericId), contractDuration);
          console.log('[useUpdateProposalStatus] Architect commission persisted for proposal:', numericId);
        } catch (commissionError) {
          console.warn('[useUpdateProposalStatus] Failed to persist architect commission (non-blocking):', commissionError);
          // Don't fail the approval flow - this is an optional step
        }
      }
      
      return { success: true, data: result, apiId: numericId, contractDuration: existing.contract_duration };
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
