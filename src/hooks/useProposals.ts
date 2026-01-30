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
  loadConfigIds, 
  ConfigIdStore, 
  getAddonItemId, 
  getSqlItemId, 
  getBackupItemId,
  getGpuItemId,
  getItemId,
  findConfigByLabel,
  getBaremetalCpuConfig,
  getBaremetalRamConfig,
  getBaremetalDiskConfig,
} from '@/services/configIdsService';
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
  console.clear();
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

      if (item.type === 'bm') {
        return {
          ...item,
          gpu: itemGpu,
          gpuQty: itemGpuQty,
          disks: Array.isArray(item.disks) ? item.disks : [{ type: 'nvme_1tb', qty: 1, desc: '' }],
          qtyServers: toNum(item.qtyServers, 1),
          ips: toNum(item.ips, 0),
        };
      }
      return {
        ...item,
        gpu: itemGpu,
        gpuQty: itemGpuQty,
        vcpu: toNum(item.vcpu, 16),
        ramGb: toNum(item.ramGb, 128),
        nvmeTb: toNum(item.nvmeTb, 0.09765625), // 100GB default
        qtyServers: toNum(item.qtyServers, 1),
        ips: toNum(item.ips, 0),
      };
    });
    
    // ============================================
    // ADDONS RESTORATION: Hybrid approach
    // 1. Try dados_proposta.addons first (snapshot)
    // 2. THEN merge from apiProposal.addons[] (API array) as fallback
    // This ensures addons are restored even if snapshot is incomplete
    // ============================================
    const rawAddons = dadosProposta.addons || {};
    
    // STEP 1: Initialize from dados_proposta.addons (snapshot)
    let sqlType = rawAddons.sql || 'none';
    let sqlQtyRaw = toNum(rawAddons.sqlQty, 0);
    let backupPlan = rawAddons.backupPlan || 'none';
    let backupGbRaw = toNum(rawAddons.backupGb, 0);
    let antivirusQty = toNum(rawAddons.antivirus, 0);
    let firewallQty = typeof rawAddons.firewall === 'boolean' ? (rawAddons.firewall ? 1 : 0) : toNum(rawAddons.firewall, 0);
    let tsplusQty = toNum(rawAddons.tsplus, 0);
    let calQty = toNum(rawAddons.cal, 0);
    let veeamVmQty = toNum(rawAddons.veeamVm, 0);
    let veeamAgQty = toNum(rawAddons.veeamAg, 0);
    let winserverQty = toNum(rawAddons.winserver, 0);
    let supportLevel = rawAddons.support?.level || 'none';
    let supportPrice = toNum(rawAddons.support?.price, 0);
    let consultingQty = toNum(rawAddons.consulting?.quantity, 0);
    let consultingPrice = toNum(rawAddons.consulting?.unitPrice, 200);
    let dbaQty = toNum(rawAddons.dba?.quantity, 0);
    let dbaPrice = toNum(rawAddons.dba?.unitPrice, 250);
    
    // STEP 2: ALWAYS process apiProposal.addons[] array (API is source of truth)
    // This OVERRIDES snapshot values for addons that exist in the API response
    const apiAddonsArray = apiProposal.addons || [];
    if (Array.isArray(apiAddonsArray) && apiAddonsArray.length > 0) {
      console.log('[apiToLocal] Processing addons from API array:', apiAddonsArray.length, 'items');
      console.log('[apiToLocal] API addons raw:', JSON.stringify(apiAddonsArray));
      
      // Helper to normalize strings
      const normalize = (str: string) => str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
      
      for (const addon of apiAddonsArray) {
        if (!addon) continue;
        
        // Get all identifiers for matching
        const configId = addon.config_id ?? addon.configId;
        const rawLabel = addon.label || addon.name || '';
        const addonLabel = normalize(rawLabel);
        const addonQty = toNum(addon.quantity, 1);
        const addonPrice = toNum(addon.price, 0);
        
        // Skip if empty or virtual/bundle
        if (!rawLabel && configId === undefined) continue;
        if (addonLabel.includes('virtual') || addonLabel.includes('bundle')) continue;
        
        console.log('[apiToLocal] Processing addon:', { configId, rawLabel, normalizedLabel: addonLabel, qty: addonQty, price: addonPrice });
        
        // ============================================
        // SQL Server - Match by LABEL
        // API returns: label: "WEB" or label: "STD"
        // ============================================
        if (addonLabel === 'web' || addonLabel === 'std' || 
            addonLabel.includes('sql') || 
            rawLabel.toUpperCase() === 'WEB' || rawLabel.toUpperCase() === 'STD') {
          // ALWAYS override - API is source of truth
          if (addonLabel === 'web' || addonLabel.includes('web') || rawLabel.toUpperCase() === 'WEB') {
            sqlType = 'web';
          } else {
            sqlType = 'std';
          }
          sqlQtyRaw = addonQty > 0 ? addonQty : 1;
          console.log('[EDIT] SQL SET from API:', { type: sqlType, qty: sqlQtyRaw, configId, rawLabel });
          continue;
        }
        
        // ============================================
        // Serviços Especializados - Match by LABEL
        // API returns: label: "Suporte Básico", "Suporte Avançado", etc.
        // ============================================
        if (addonLabel.includes('suporte') || addonLabel.includes('support')) {
          // ALWAYS override - API is source of truth
          if (addonLabel.includes('avancado') || addonLabel.includes('advanced')) {
            supportLevel = 'advanced';
          } else if (addonLabel.includes('intermediario') || addonLabel.includes('intermediate')) {
            supportLevel = 'intermediate';
          } else if (addonLabel.includes('basico') || addonLabel.includes('basic')) {
            supportLevel = 'basic';
          } else {
            // Default to basic if just "suporte"
            supportLevel = 'basic';
          }
          supportPrice = addonPrice;
          console.log('[EDIT] Support SET from API:', { level: supportLevel, price: addonPrice, configId, rawLabel });
          continue;
        }
        
        if (addonLabel.includes('consultoria') || addonLabel.includes('consulting')) {
          consultingQty = addonQty;
          consultingPrice = addonQty > 0 && addonPrice > 0 ? Math.round(addonPrice / addonQty) : 200;
          console.log('[EDIT] Consulting SET from API:', { qty: addonQty, unitPrice: consultingPrice, rawLabel });
          continue;
        }
        
        if (addonLabel === 'dba') {
          dbaQty = addonQty;
          dbaPrice = addonQty > 0 && addonPrice > 0 ? Math.round(addonPrice / addonQty) : 250;
          console.log('[EDIT] DBA SET from API:', { qty: addonQty, unitPrice: dbaPrice, rawLabel });
          continue;
        }
        
        // ============================================
        // Windows Server - Match by LABEL
        // ============================================
        if (addonLabel.includes('winserver') || addonLabel.includes('windows')) {
          winserverQty = addonQty;
          console.log('[EDIT] WindowsServer SET from API:', addonQty, 'rawLabel:', rawLabel);
          continue;
        }
        
        // ============================================
        // Backup - Match by LABEL
        // ============================================
        if (addonLabel.includes('backup')) {
          if (addonLabel.includes('30')) backupPlan = '30';
          else if (addonLabel.includes('15')) backupPlan = '15';
          else if (addonLabel.includes('7')) backupPlan = '7';
          else backupPlan = '7';
          backupGbRaw = addonQty;
          console.log('[EDIT] Backup SET from API: plan=', backupPlan, ', gb=', addonQty, 'rawLabel:', rawLabel);
          continue;
        }
        
        // ============================================
        // Standard Add-ons
        // ============================================
        if (addonLabel.includes('antivirus')) {
          antivirusQty = addonQty;
          console.log('[EDIT] Antivirus SET from API:', addonQty);
        } else if (addonLabel.includes('firewall') || addonLabel.includes('pfsense')) {
          firewallQty = addonQty > 0 ? addonQty : 1;
          console.log('[EDIT] Firewall SET from API:', firewallQty);
        } else if (addonLabel.includes('tsplus') || addonLabel.includes('ts plus')) {
          tsplusQty = addonQty;
          console.log('[EDIT] TSPlus SET from API:', addonQty);
        } else if ((addonLabel.includes('cal') || addonLabel === 'cal') && !addonLabel.includes('technical')) {
          calQty = addonQty;
          console.log('[EDIT] CAL SET from API:', addonQty);
        } else if (addonLabel.includes('veeam') && addonLabel.includes('vm')) {
          veeamVmQty = addonQty;
          console.log('[EDIT] Veeam VM SET from API:', addonQty);
        } else if (addonLabel.includes('veeam') && addonLabel.includes('agent')) {
          veeamAgQty = addonQty;
          console.log('[EDIT] Veeam Agent SET from API:', addonQty);
        } else {
          console.log('[EDIT] Addon NOT MATCHED:', { rawLabel, addonLabel, configId });
        }
      }
    }
    
    // CRITICAL: Ensure SQL has qty >= 1 when type is selected
    const finalSqlQty = sqlType !== 'none' && sqlQtyRaw === 0 ? 1 : sqlQtyRaw;
    
    // CRITICAL: Ensure Backup has GB >= 1 when plan is selected
    const finalBackupGb = backupPlan !== 'none' && backupGbRaw === 0 ? 1 : backupGbRaw;
    
    // Log final addons state for debugging
    console.log('[apiToLocal] Final addons state after merge:', {
      antivirus: antivirusQty,
      firewall: firewallQty,
      tsplus: tsplusQty,
      cal: calQty,
      veeamVm: veeamVmQty,
      veeamAg: veeamAgQty,
      winserver: winserverQty,
      sql: sqlType,
      sqlQty: finalSqlQty,
      backupPlan,
      backupGb: finalBackupGb,
      support: { level: supportLevel, price: supportPrice },
    });
    
    const normalizedAddons: AddonsState = {
      backupPlan: backupPlan as 'none' | '7' | '15' | '30',
      backupGb: finalBackupGb,
      antivirus: antivirusQty,
      firewall: firewallQty,
      tsplus: tsplusQty,
      cal: calQty,
      sql: sqlType as 'none' | 'web' | 'std',
      sqlQty: finalSqlQty,
      veeamVm: veeamVmQty,
      veeamAg: veeamAgQty,
      winserver: winserverQty,
      support: {
        level: supportLevel as 'none' | 'basic' | 'intermediate' | 'advanced',
        price: supportPrice,
      },
      consulting: {
        quantity: consultingQty,
        unitPrice: consultingPrice,
      },
      dba: {
        quantity: dbaQty,
        unitPrice: dbaPrice,
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
      // CRITICAL: API returns 'label' not 'name' - use label as primary
      const addonName = (addon.label || addon.name || '').trim();
      if (!addonName) continue;
      
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
      
      // ============================================
      // SQL SERVER - Match by label: "WEB", "STD", or contains "sql"
      // API returns: label: "WEB" or label: "STD"
      // ============================================
      if (addonName.toUpperCase() === 'WEB' || addonName.toUpperCase() === 'STD' || 
          addonNameLower.includes('sql')) {
        if (addonName.toUpperCase() === 'WEB' || addonNameLower.includes('web')) {
          reconstructedAddonsState.sql = 'web';
        } else if (addonName.toUpperCase() === 'STD' || addonNameLower.includes('standard') || addonNameLower.includes('std')) {
          reconstructedAddonsState.sql = 'std';
        } else if (addonNameLower.includes('enterprise')) {
          reconstructedAddonsState.sql = 'enterprise';
        } else {
          reconstructedAddonsState.sql = 'std'; // Default to standard
        }
        reconstructedAddonsState.sqlQty = addonQty > 0 ? addonQty : 1;
        console.log('[EDIT] SQL LEGACY restored:', { type: reconstructedAddonsState.sql, qty: reconstructedAddonsState.sqlQty, rawLabel: addonName });
      } 
      // ============================================
      // SERVIÇOS ESPECIALIZADOS - Match by label containing "Suporte", "Consultoria", "DBA"
      // API returns: label: "Suporte Básico", "Suporte Avançado", etc.
      // ============================================
      else if (addonNameLower.includes('suporte') || addonNameLower.includes('support')) {
        if (addonNameLower.includes('avançado') || addonNameLower.includes('avancado') || addonNameLower.includes('advanced')) {
          reconstructedAddonsState.support = { level: 'advanced', price: addonPrice };
        } else if (addonNameLower.includes('intermediário') || addonNameLower.includes('intermediario') || addonNameLower.includes('intermediate')) {
          reconstructedAddonsState.support = { level: 'intermediate', price: addonPrice };
        } else if (addonNameLower.includes('básico') || addonNameLower.includes('basico') || addonNameLower.includes('basic')) {
          reconstructedAddonsState.support = { level: 'basic', price: addonPrice };
        } else {
          // Default to basic if just "suporte"
          reconstructedAddonsState.support = { level: 'basic', price: addonPrice };
        }
        console.log('[EDIT] Support LEGACY restored:', { level: reconstructedAddonsState.support.level, price: addonPrice, rawLabel: addonName });
      } else if (addonNameLower.includes('consultoria') || addonNameLower.includes('consulting')) {
        const unitPrice = addonQty > 0 && addonPrice > 0 ? Math.round(addonPrice / addonQty) : 200;
        reconstructedAddonsState.consulting = { quantity: addonQty, unitPrice };
        console.log('[EDIT] Consulting LEGACY restored:', { qty: addonQty, unitPrice, rawLabel: addonName });
      } else if (addonNameLower === 'dba' || addonNameLower.includes('dba ')) {
        const unitPrice = addonQty > 0 && addonPrice > 0 ? Math.round(addonPrice / addonQty) : 250;
        reconstructedAddonsState.dba = { quantity: addonQty, unitPrice };
        console.log('[EDIT] DBA LEGACY restored:', { qty: addonQty, unitPrice, rawLabel: addonName });
      }
      // ============================================
      // Other standard addons
      // ============================================
      else if (addonNameLower.includes('antivirus') || addonNameLower.includes('antivírus')) {
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
        
        // Detect backup plan by retention days
        if (addonNameLower.includes('30')) {
          reconstructedAddonsState.backupPlan = '30';
        } else if (addonNameLower.includes('15')) {
          reconstructedAddonsState.backupPlan = '15';
        } else if (addonNameLower.includes('7')) {
          reconstructedAddonsState.backupPlan = '7';
        } else if (addonNameLower.includes('gold')) {
          reconstructedAddonsState.backupPlan = '30';
        } else if (addonNameLower.includes('silver')) {
          reconstructedAddonsState.backupPlan = '15';
        } else if (addonNameLower.includes('bronze')) {
          reconstructedAddonsState.backupPlan = '7';
        } else {
          reconstructedAddonsState.backupPlan = '7'; // Default
        }
        console.log('[EDIT] Backup restored: plan=', reconstructedAddonsState.backupPlan, ', gb=', reconstructedAddonsState.backupGb);
      } else {
        console.log('[EDIT] Addon NOT MATCHED in LEGACY:', { rawLabel: addonName, normalized: addonNameLower });
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
      
      // ============================================
      // BAREMETAL DETECTION - CRITICAL FIX
      // 
      // Priority order:
      // 1. Check if name contains __BAREMETAL__ (serialized format)
      // 2. Check if server has explicit bmCpu/bmRam fields
      // 3. FALLBACK to VM only if no BareMetal indicators
      // 
      // IMPORTANT: vcpu > 0 is NOT a reliable VM indicator because
      // BareMetals are sent with vcpu=1 (API minimum requirement)
      // ============================================
      const isEncodedBareMetal = serverName.startsWith('__BAREMETAL__:');
      const hasBaremetalFields = !!server.bmCpu || !!server.bmRam || 
        (Array.isArray(server.disks) && server.disks.length > 0 && server.disks[0]?.type);
      const isBareMetal = isEncodedBareMetal || hasBaremetalFields;
      
      // ============================================
      // GPU RECONSTRUCTION: Extract GPU from server object
      // CRITICAL: support both shapes:
      // - gpu: { model, quantity }
      // - gpu_model + gpu_qty
      // - gpu + gpuQty (legacy)
      // ============================================
      let serverGpu = 'Sem GPU';
      let serverGpuQty = 0;

      if (server.gpu && typeof server.gpu === 'object') {
        serverGpu = typeof server.gpu.model === 'string' && server.gpu.model !== '' ? server.gpu.model : 'Sem GPU';
        serverGpuQty = typeof server.gpu.quantity === 'number' ? server.gpu.quantity : toNum(server.gpu.quantity, 0);
      } else {
        const rawGpu = server.gpu || server.gpu_model || server.extras?.gpu || server.extras?.gpu_model;
        serverGpu = typeof rawGpu === 'string' && rawGpu !== '' ? rawGpu : 'Sem GPU';

        const rawGpuQty = server.gpuQty ?? server.gpu_qty ?? server.extras?.gpuQty ?? server.extras?.gpu_qty;
        serverGpuQty = typeof rawGpuQty === 'number' ? rawGpuQty : toNum(rawGpuQty, 0);
      }

      if (serverGpu !== 'Sem GPU' && serverGpuQty > 0) {
        console.log(`[EDIT] GPU restored: model=${serverGpu} qty=${serverGpuQty}`);
      }
      
      // ============================================
      // BAREMETAL PARSING
      // ============================================
      if (isBareMetal) {
        let bmCpu = 'intel_xeon_e2136';
        let bmRam = 'ram_128gb';
        let bmDisks: { type: string; qty: number; desc: string }[] = [{ type: 'nvme_1tb', qty: 1, desc: '' }];
        let bmGpu = serverGpu;
        let bmGpuQty = serverGpuQty;
        
        // Parse from encoded name if present
        if (isEncodedBareMetal) {
          try {
            const jsonPart = serverName.substring('__BAREMETAL__:'.length);
            const bmPayload = JSON.parse(jsonPart);
            bmCpu = bmPayload.cpu || bmCpu;
            bmRam = bmPayload.ram || bmRam;
            if (Array.isArray(bmPayload.disks) && bmPayload.disks.length > 0) {
              bmDisks = bmPayload.disks.map((d: any) => ({
                type: d.type || 'nvme_1tb',
                qty: d.qty || 1,
                desc: d.desc || '',
              }));
            }
            // GPU from encoded payload
            if (bmPayload.gpu?.model) {
              bmGpu = bmPayload.gpu.model;
              bmGpuQty = bmPayload.gpu.quantity || 0;
            }
            console.log('[reconstructResult] BareMetal decoded from name:', { bmCpu, bmRam, disks: bmDisks.length });
          } catch (e) {
            console.warn('[reconstructResult] Failed to parse BareMetal JSON from name, using server fields');
          }
        } else {
          // Extract from server fields directly
          bmCpu = server.bmCpu || server.cpu_model || bmCpu;
          bmRam = server.bmRam || server.ram_tier || bmRam;
          if (Array.isArray(server.disks) && server.disks.length > 0) {
            bmDisks = server.disks.map((d: any) => ({
              type: d.type || 'nvme_1tb',
              qty: d.qty || 1,
              desc: d.desc || '',
            }));
          }
        }
        
        console.log(`[reconstructResult] BareMetal restored: cpu=${bmCpu} ram=${bmRam} disks=${JSON.stringify(bmDisks)}`);

        return {
          type: 'bm' as const,
          id: crypto.randomUUID(),
          gpu: bmGpu,
          gpuQty: bmGpuQty,
          bmCpu,
          bmRam,
          disks: bmDisks,
          trafficTb: 5,
          ips: toNum(server.ips, 1),
          qtyServers: quantity,
        };
      }
      
      // ============================================
      // VM PARSING (default case)
      // ============================================
      console.log(`[reconstructResult] VM restored: vcpu=${vcpu} ram=${ram} storage=${storage}`);
      
      return {
        type: 'vm' as const,
        id: crypto.randomUUID(),
        gpu: serverGpu,
        gpuQty: serverGpuQty,
        vcpu: vcpu || 16,
        ramGb: ram || 128,
        nvmeTb: (storage || 50) / 1024, // Convert GB to TB
        trafficTb: 5,
        ips: toNum(server.ips, 1),
        qtyServers: quantity,
      };
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
// configIdStore: Optional mapping of config IDs for API v12+ compatibility
function localToApi(proposal: SavedProposal, configIdStore?: ConfigIdStore | null): Record<string, unknown> {
  // ============================================
  // CRITICAL: Build price maps from result.rows FIRST
  // This is the ONLY source of truth for calculated prices
  // ============================================
  const resultRows = (proposal.result?.rows || []) as Array<{
    label?: string;
    rowKey?: string;
    key?: string; // legacy fallback
    qty?: string | number;
    unitPrice?: number;
    subtotal?: number;
    finalTotal?: number;
  }>;
  
  // Log the source data for debugging
  console.log('[localToApi] RESUMO USADO NO PAYLOAD:', {
    rowCount: resultRows.length,
    rows: resultRows.map(r => ({
      rowKey: r.rowKey || r.key,
      label: r.label,
      unitPrice: r.unitPrice,
      finalTotal: r.finalTotal,
      subtotal: r.subtotal,
    })),
    grandTotal: proposal.result?.grandTotal,
  });
  
  // Build price map for SERVERS: aggregate by prefix (vm_0, bm_1, etc.)
  // Each server may have multiple rows (cpu, ram, disk, gpu, ips, traffic)
  const serverPriceByPrefix: Record<string, number> = {};
  
  // Build price map for ADDONS: exact rowKey match
  const addonPriceByKey: Record<string, { unitPrice: number; subtotal: number }> = {};
  
  for (const row of resultRows) {
    const rowKey = row.rowKey || row.key;
    if (!rowKey) continue;
    
    const rowTotal = toNum(row.finalTotal, toNum(row.subtotal, 0));
    const rowUnitPrice = toNum(row.unitPrice, 0);
    
    // Check if this is a server row (vm_X_* or bm_X_*)
    const serverMatch = rowKey.match(/^(vm|bm)_(\d+)_/);
    if (serverMatch) {
      const prefix = `${serverMatch[1]}_${serverMatch[2]}`; // e.g., "vm_0" or "bm_1"
      serverPriceByPrefix[prefix] = (serverPriceByPrefix[prefix] || 0) + rowTotal;
    }
    
    // Also store in addon lookup (for services like svc_*, backup_*, etc.)
    addonPriceByKey[rowKey] = {
      unitPrice: rowUnitPrice,
      subtotal: rowTotal,
    };
  }
  
  console.log('[localToApi] Server price aggregation by prefix:', serverPriceByPrefix);
  console.log('[localToApi] Addon price lookup keys:', Object.keys(addonPriceByKey));
  
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
  
  // ============================================
  // NEW FLAT API STRUCTURE (Janeiro 2026)
  // addons: apenas { config_id, quantity } - backend calcula preço
  // servers: { name, specs: [{ config_id, value }], quantity } - backend calcula preço
  // ============================================
  
  // Transform addons to NEW API format: array of {config_id, quantity}
  // NOTE: 'price' e 'item_id' NÃO são mais enviados - backend calcula tudo
  const addonsArray: Array<{ 
    config_id: number; 
    quantity: number;
  }> = [];
  
  // Helper to get config_id from configIdStore
  // In NEW flat structure, we only need the config_id (no separate item_id)
  const getConfigId = (code: string): number | null => {
    if (!configIdStore) {
      console.error('[localToApi] No configIdStore available - addon will be skipped:', code);
      return null;
    }
    const ids = getAddonItemId(configIdStore, code);
    if (!ids.configId) {
      console.error('[localToApi] SKIPPING addon - missing config_id:', code);
      console.error('[localToApi] Available categories in store:', Array.from(configIdStore.byCategory.keys()));
      console.error('[localToApi] Addons in store:', configIdStore.byCategory.get('Add-ons')?.map(a => a.label));
      return null;
    }
    console.log('[localToApi] Found config_id for addon:', code, '→', ids.configId);
    return ids.configId;
  };
  
  // Helper to safely add addon to array - only if config_id is valid
  // NEW FLAT API: No more 'price', 'item_id', or 'name' - backend calculates/resolves everything
  const addAddon = (code: string, quantity: number): boolean => {
    const configId = getConfigId(code);
    if (!configId) {
      console.error(`[localToApi] ADDON NOT ADDED: ${code} - missing config_id`);
      return false;
    }
    addonsArray.push({
      config_id: configId,
      quantity,
    });
    console.log(`[localToApi] Added addon: ${code} (config_id: ${configId}, qty: ${quantity})`);
    return true;
  };
  
  // ============================================
  // INDEPENDENT PRODUCTS (don't require servers)
  // NEW FLAT API: No prices needed - backend calculates everything
  // ============================================
  
  // Storage items - add each storage configuration as an addon
  if (proposal.storageItems && Array.isArray(proposal.storageItems)) {
    for (let i = 0; i < proposal.storageItems.length; i++) {
      const storage = proposal.storageItems[i];
      const volumeTB = toNum(storage.volumeTB, 0);
      const volumeGB = toNum(storage.volumeGB, 0);
      
      if (volumeTB > 0 || volumeGB > 0) {
        addAddon('storage', 1);
      }
    }
  }
  
  // Kubernetes - add as addon if enabled
  if (proposal.kubernetes && proposal.kubernetes.enabled) {
    addAddon('kubernetes', 1);
  }
  
  // OPEN SaaS - add as addon if enabled with ANY users > 0
  if (proposal.openSaas && proposal.openSaas.enabled && proposal.openSaas.users > 0) {
    addAddon('open_saas', proposal.openSaas.users);
  }
  
  if (proposal.addons && typeof proposal.addons === 'object') {
    const addons = proposal.addons;
    
    // ============================================
    // WINSERVER - EXPLICIT (CRITICAL FOR PERSISTENCE)
    // NEW: No price - backend calculates
    // Uses 'winserver' code which maps to 'WinServer(2vCPU/unid.)' label
    // ============================================
    if (typeof addons.winserver === 'number' && addons.winserver > 0) {
      addAddon('winserver', addons.winserver);
    }
    
    // Standard addon mappings - NEW: No prices, only config_id + quantity
    if (typeof addons.antivirus === 'number' && addons.antivirus > 0) {
      addAddon('antivirus', addons.antivirus);
    }
    if (addons.firewall === true || (typeof addons.firewall === 'number' && addons.firewall > 0)) {
      const fwQty = typeof addons.firewall === 'number' ? addons.firewall : 1;
      addAddon('firewall', fwQty);
    }
    if (typeof addons.tsplus === 'number' && addons.tsplus > 0) {
      addAddon('tsplus', addons.tsplus);
    }
    if (typeof addons.cal === 'number' && addons.cal > 0) {
      addAddon('cal', addons.cal);
    }
    if (typeof addons.veeamVm === 'number' && addons.veeamVm > 0) {
      addAddon('veeam_vm', addons.veeamVm);
    }
    if (typeof addons.veeamAg === 'number' && addons.veeamAg > 0) {
      addAddon('veeam_agent', addons.veeamAg);
    }
    // Backup - uses dedicated function for ID lookup
    // NEW FLAT API: Only config_id + quantity
    // CRITICAL: Ensure backupGb >= 1 when plan is selected
    if (addons.backupPlan && addons.backupPlan !== 'none') {
      const backupGb = typeof addons.backupGb === 'number' && addons.backupGb > 0 ? addons.backupGb : 1;
      const backupIds = configIdStore ? getBackupItemId(configIdStore, addons.backupPlan) : { configId: undefined };
      if (backupIds.configId) {
        addonsArray.push({ 
          config_id: backupIds.configId, 
          quantity: backupGb 
        });
        console.log('[localToApi] Added Backup to payload:', addons.backupPlan, backupGb);
      } else {
        console.error('[localToApi] SKIPPING Backup - missing config_id:', backupIds);
      }
    }
    // SQL - uses dedicated function for ID lookup
    // NEW FLAT API: Only config_id + quantity
    // CRITICAL: Ensure sqlQty >= 1 when edition is selected
    if (addons.sql && addons.sql !== 'none') {
      const sqlQty = typeof addons.sqlQty === 'number' && addons.sqlQty > 0 ? addons.sqlQty : 1;
      const sqlIds = configIdStore ? getSqlItemId(configIdStore, addons.sql) : { configId: undefined };
      if (sqlIds.configId) {
        addonsArray.push({ 
          config_id: sqlIds.configId, 
          quantity: sqlQty 
        });
        console.log('[localToApi] Added SQL to payload:', addons.sql, sqlQty);
      } else {
        console.error('[localToApi] SKIPPING SQL - missing config_id:', sqlIds);
      }
    }
    // Support - specialized service
    if (addons.support && addons.support.level !== 'none') {
      addAddon(`support_${addons.support.level}`, 1);
    }
    // Consulting - specialized service
    // Uses 'consulting' code which maps to 'Consultoria Técnica (horas)' label
    if (addons.consulting && typeof addons.consulting.quantity === 'number' && addons.consulting.quantity > 0) {
      addAddon('consulting', addons.consulting.quantity);
    }
    // DBA - specialized service
    // Uses 'dba' code which maps to 'DBA (horas)' label
    if (addons.dba && typeof addons.dba.quantity === 'number' && addons.dba.quantity > 0) {
      addAddon('dba', addons.dba.quantity);
    }
    // Custom addons (legacy support)
    if (addons.customAddons && typeof addons.customAddons === 'object') {
      for (const [key, value] of Object.entries(addons.customAddons)) {
        if (typeof value === 'object' && value !== null) {
          const addon = value as { enabled?: boolean; quantity?: number };
          if (addon.enabled) {
            addAddon(key, addon.quantity || 1);
          }
        } else if (typeof value === 'number' && value > 0) {
          addAddon(key, value);
        }
      }
    }
  }
  
  // Transform servers/items to API format
  // IMPORTANT: GPU must be persisted inside the server object (servers[].gpu)
  // CRITICAL: Use serverPriceByPrefix built at the start from result.rows
  // API v12+: config_id and item IDs are REQUIRED for each server
  // ============================================
  // NEW FLAT API STRUCTURE (Janeiro 2026)
  // servers: { name, specs: [{ config_id, value }], quantity }
  // Backend calculates price from specs using config values
  // ============================================
  const serversArray: Array<{
    name: string;
    specs: Array<{ config_id: number; value: number }>;
    quantity: number;
  }> = [];
  
  // Get VM config IDs from configIdStore using FLAT structure lookups
  // These are IDs from calculator_configs table for vCPU, RAM, NVMe
  const getConfigIdByLabel = (category: string, ...labels: string[]): number | undefined => {
    if (!configIdStore) return undefined;
    const categoryConfigs = configIdStore.byCategory.get(category);
    if (!categoryConfigs) return undefined;
    
    for (const searchLabel of labels) {
      const normalizedSearch = searchLabel.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      for (const item of categoryConfigs) {
        const itemLabel = item.label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        if (itemLabel === normalizedSearch || itemLabel.includes(normalizedSearch) || normalizedSearch.includes(itemLabel)) {
          return item.configId;
        }
      }
    }
    return undefined;
  };
  
  const vcpuConfigId = getConfigIdByLabel('VM', 'vCPU', 'vcpu');
  const ramConfigId = getConfigIdByLabel('VM', 'RAM', 'ram');
  const storageConfigId = getConfigIdByLabel('VM', 'NVMe', 'nvme', 'Storage');
  const ipConfigId = getConfigIdByLabel('VM', 'IP Público', 'IP');
  
  // CRITICAL: Log available config items for debugging if IDs are missing
  if (!vcpuConfigId || !ramConfigId || !storageConfigId) {
    console.error('[localToApi] ❌ CRITICAL: Missing VM config IDs from API:', { vcpuConfigId, ramConfigId, storageConfigId, ipConfigId });
    console.error('[localToApi] Available VM items:', configIdStore?.byCategory.get('VM')?.map(v => ({ id: v.configId, label: v.label })));
    console.error('[localToApi] This will cause API 422 error - config IDs must exist in the API');
  }
  
  console.log('[localToApi] VM Config IDs from API (FLAT):', { vcpuConfigId, ramConfigId, storageConfigId, ipConfigId });
  
  if (proposal.items && Array.isArray(proposal.items)) {
    for (const [idx, item] of proposal.items.entries()) {
      // Get total price for this server from pre-built price map
      const itemPrefix = item.type === 'vm' ? `vm_${idx}` : `bm_${idx}`;
      const serverPrice = serverPriceByPrefix[itemPrefix] || 0;
      
      // Handle VM format from calculator - NEW FLAT API uses specs[]
      if (item.type === 'vm') {
        const gpuModel = typeof item.gpu === 'string' && item.gpu !== '' && item.gpu !== 'Sem GPU'
          ? item.gpu
          : (item.gpu && typeof item.gpu === 'object' ? (item.gpu as any).model : null);
        const gpuQty = typeof item.gpuQty === 'number' ? item.gpuQty : toNum(item.gpuQty ?? (item.gpu as any)?.quantity, 0);

        // CRITICAL: Per OpenAPI spec, VMs MUST have vcpu >= 1 and ram >= 1
        const vcpuValue = Math.max(1, item.vcpu || 1);
        const ramValue = Math.max(1, item.ramGb || 1);
        const storageGb = Math.round((item.nvmeTb || 0) * 1024);
        
        if ((item.vcpu || 0) < 1 || (item.ramGb || 0) < 1) {
          console.warn(`[localToApi] VM #${idx + 1} had invalid values (vcpu=${item.vcpu}, ram=${item.ramGb}), enforced minimums`);
        }

        // Build specs array - NEW FLAT API format per OpenAPI spec
        const specs: Array<{ config_id: number; value: number }> = [];
        
        // vCPU spec (minimum 1)
        if (vcpuConfigId) {
          specs.push({ config_id: vcpuConfigId, value: vcpuValue });
        }
        
        // RAM spec (minimum 1)
        if (ramConfigId) {
          specs.push({ config_id: ramConfigId, value: ramValue });
        }
        
        // Storage/NVMe spec (in GB)
        if (storageConfigId) {
          specs.push({ config_id: storageConfigId, value: Math.max(0, storageGb) });
        }
        
        // IP spec (if configured)
        if (ipConfigId && item.ips > 0) {
          specs.push({ config_id: ipConfigId, value: item.ips });
        }

        // Add GPU as addon (if present) - GPU is a separate addon, not part of specs
        if (gpuModel && gpuQty > 0) {
          // Get GPU config ID from GPU category
          const gpuConfigs = configIdStore?.byCategory.get('GPU');
          let gpuConfigId: number | undefined;
          if (gpuConfigs) {
            const normalizedGpuModel = gpuModel.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            for (const item of gpuConfigs) {
              const itemLabel = item.label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
              if (itemLabel === normalizedGpuModel || itemLabel.includes(normalizedGpuModel) || normalizedGpuModel.includes(itemLabel)) {
                gpuConfigId = item.configId;
                break;
              }
            }
          }
          
          if (gpuConfigId) {
            const totalGpuQty = gpuQty * Math.max(1, item.qtyServers || 1);
            addonsArray.push({
              config_id: gpuConfigId,
              quantity: totalGpuQty,
            });
            console.log(`[localToApi] Added VM GPU as addon: ${gpuModel}, config_id=${gpuConfigId}, qty=${totalGpuQty}`);
          } else {
            console.warn(`[localToApi] ⚠️ Could not find GPU config for: ${gpuModel}`);
          }
        }
        
        // Only add server if we have at least one valid spec
        if (specs.length > 0) {
          serversArray.push({
            name: `VM #${idx + 1}`,
            specs,
            quantity: Math.max(1, item.qtyServers || 1),
          });
          console.log(`[localToApi] VM #${idx + 1} serialized with specs[] format:`, specs);
        } else {
          console.error(`[localToApi] ❌ VM #${idx + 1} skipped - no valid specs (missing config IDs)`);
        }
      } else if (item.type === 'bm') {
        // ============================================
        // BAREMETAL: Send as individual ADDONS
        // 
        // Per OpenAPI spec, servers[] requires all item_ids from SAME config_id.
        // BareMetal has SEPARATE configs: CPU (2), RAM (3), Disk (4).
        // 
        // SOLUTION: Send BareMetal components as addons:
        // - 1 addon for CPU model (config_id=2)
        // - 1 addon for RAM tier (config_id=3)
        // - N addons for disks (config_id=4, one per disk type)
        // 
        // dados_proposta stores the complete BareMetal state for hydration.
        // ============================================
        const bmCpuModel = item.bmCpu || 'intel_xeon_e2136';
        const bmRamTier = item.bmRam || 'ram_128gb';
        const bmDisks = Array.isArray(item.disks) ? item.disks : [{ type: 'nvme_1tb', qty: 1 }];
        const qtyServers = Math.max(1, item.qtyServers || 1);
        
        const gpuModel = typeof item.gpu === 'string' && item.gpu !== '' && item.gpu !== 'Sem GPU'
          ? item.gpu
          : (item.gpu && typeof item.gpu === 'object' ? (item.gpu as any).model : null);
        const gpuQty = typeof item.gpuQty === 'number' ? item.gpuQty : toNum(item.gpuQty ?? (item.gpu as any)?.quantity, 0);
        
        // Get BareMetal configs from flat configIdStore using helper functions
        // In new flat structure, each CPU/RAM/Disk model is an individual config item with its own ID
        const cpuConfig = configIdStore ? getBaremetalCpuConfig(configIdStore, bmCpuModel) : undefined;
        const ramConfig = configIdStore ? getBaremetalRamConfig(configIdStore, bmRamTier) : undefined;
        
        console.log('[localToApi] BareMetal configs (flat):', {
          cpuConfig: cpuConfig ? { id: cpuConfig.configId, label: cpuConfig.label } : null,
          ramConfig: ramConfig ? { id: ramConfig.configId, label: ramConfig.label } : null,
        });
        
        // Add CPU as addon - NEW FLAT API: only config_id + quantity
        if (cpuConfig?.configId) {
          addonsArray.push({
            config_id: cpuConfig.configId,
            quantity: qtyServers,
          });
          console.log(`[localToApi] Added BareMetal CPU: ${bmCpuModel}, config_id=${cpuConfig.configId}, qty=${qtyServers}`);
        } else {
          console.warn(`[localToApi] ⚠️ Could not find BareMetal CPU config for: ${bmCpuModel}`);
        }
        
        // Add RAM as addon - NEW FLAT API: only config_id + quantity
        if (ramConfig?.configId) {
          addonsArray.push({
            config_id: ramConfig.configId,
            quantity: qtyServers,
          });
          console.log(`[localToApi] Added BareMetal RAM: ${bmRamTier}, config_id=${ramConfig.configId}, qty=${qtyServers}`);
        } else {
          console.warn(`[localToApi] ⚠️ Could not find BareMetal RAM config for: ${bmRamTier}`);
        }
        
        // Add each disk as addon (aggregated by type) - NEW FLAT API: only config_id + quantity
        const disksByType = new Map<string, number>();
        for (const disk of bmDisks) {
          const diskType = disk.type || 'nvme_1tb';
          const diskQty = (disk.qty || 1) * qtyServers;
          disksByType.set(diskType, (disksByType.get(diskType) || 0) + diskQty);
        }
        
        for (const [diskType, totalQty] of disksByType) {
          const diskConfig = configIdStore ? getBaremetalDiskConfig(configIdStore, diskType) : undefined;
          if (diskConfig?.configId) {
            addonsArray.push({
              config_id: diskConfig.configId,
              quantity: totalQty,
            });
            console.log(`[localToApi] Added BareMetal Disk: ${diskType}, config_id=${diskConfig.configId}, qty=${totalQty}`);
          } else {
            console.warn(`[localToApi] ⚠️ Could not find BareMetal Disk config for: ${diskType}`);
          }
        }
        
        // Add GPU for BareMetal if present - NEW FLAT API: only config_id + quantity
        if (gpuModel && gpuQty > 0 && configIdStore) {
          const gpuIds = getGpuItemId(configIdStore, gpuModel);
          if (gpuIds.configId) {
            addonsArray.push({
              config_id: gpuIds.configId,
              quantity: gpuQty * qtyServers,
            });
            console.log(`[localToApi] Added BareMetal GPU: ${gpuModel}, qty=${gpuQty * qtyServers}`);
          }
        }
        
        console.log(`[SERIALIZE] BareMetal #${idx + 1} sent as addons: cpu=${bmCpuModel}, ram=${bmRamTier}, disks=${bmDisks.length} types, qty=${qtyServers}`);
        
        // Note: BareMetal is NOT added to serversArray - it's fully represented as addons
      } else {
        // Fallback for legacy format - convert to specs[] format
        const specs: Array<{ config_id: number; value: number }> = [];
        const vcpuVal = Math.max(1, item.vcpu || item.cpu || 1);
        const ramVal = Math.max(1, item.ram || item.memory || item.ramGb || 1);
        const storageVal = item.storage || item.disk || item.nvme || Math.round((item.nvmeTb || 0) * 1024) || 0;
        
        if (vcpuConfigId) specs.push({ config_id: vcpuConfigId, value: vcpuVal });
        if (ramConfigId) specs.push({ config_id: ramConfigId, value: ramVal });
        if (storageConfigId) specs.push({ config_id: storageConfigId, value: storageVal });
        
        if (specs.length > 0) {
          serversArray.push({
            name: item.name || item.label || 'Server',
            specs,
            quantity: item.quantity || item.qtyServers || 1,
          });
        }
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
    
    // Build default specs for virtual servers
    const defaultVirtualSpecs: Array<{ config_id: number; value: number }> = [];
    if (vcpuConfigId) defaultVirtualSpecs.push({ config_id: vcpuConfigId, value: 1 });
    if (ramConfigId) defaultVirtualSpecs.push({ config_id: ramConfigId, value: 1 });
    if (storageConfigId) defaultVirtualSpecs.push({ config_id: storageConfigId, value: 0 });
    
    // Fallback if no config IDs - use hardcoded IDs (should not happen)
    const virtualSpecs = defaultVirtualSpecs.length > 0 ? defaultVirtualSpecs : [
      { config_id: 1, value: 1 },
      { config_id: 2, value: 1 },
      { config_id: 3, value: 0 },
    ];
    
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
        specs: virtualSpecs,
        quantity: 1,
      });
    }
    
    // Check for Kubernetes (enabled = true)
    if (proposal.kubernetes && proposal.kubernetes.enabled) {
      hasAnyIndependentProduct = true;
      const k8sPayload = JSON.stringify(proposal.kubernetes);
      serversArray.push({
        name: `__VIRTUAL__KUBERNETES__:${k8sPayload}`,
        specs: virtualSpecs,
        quantity: 1,
      });
    }
    
    // Check for OPEN SaaS (enabled = true AND users > 0)
    if (proposal.openSaas && proposal.openSaas.enabled && proposal.openSaas.users > 0) {
      hasAnyIndependentProduct = true;
      const saasPayload = JSON.stringify(proposal.openSaas);
      serversArray.push({
        name: `__VIRTUAL__OPENSAAS__:${saasPayload}`,
        specs: virtualSpecs,
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
        specs: virtualSpecs,
        quantity: 1,
      });
    }
    
    if (hasAnyIndependentProduct) {
      console.log('[localToApi] Created virtual servers for independent products:', serversArray.map(s => String(s.name).substring(0, 50)));
    }
  }
  
  // Build complete dados_proposta object with ALL calculator state
  // This ensures we can restore the exact proposal when editing
  // CRITICAL: dados_proposta is the SOURCE OF TRUTH - do not save just the total!
  
  // CRITICAL: Get current user session to persist creator info
  const session = authService.getSession();
  const currentUserId = session?.userId || null;
  const currentUserEmail = session?.email || null;
  const currentUserName = session?.name || null;
  const currentUserLevel = session?.level || null;
  
  // Use existing creator info if already set (editing), otherwise use current user
  const existingCreatorId = (proposal as any).created_by_user_id || (proposal as any).created_by || proposal.creator?.id;
  const existingCreatorName = (proposal as any).created_by_name || proposal.creator?.name;
  const existingCreatorEmail = (proposal as any).created_by_email || proposal.creator?.email;
  const existingCreatorLevel = (proposal as any).created_by_level || proposal.creator?.level;
  
  const dadosProposta = {
    // Unique proposal identifiers
    proposalId: proposal.proposal?.id,
    
    // Owner tracking (CRITICAL for Executivo column and RBAC)
    // Preserve existing creator on edits, set from session on new proposals
    created_by_user_id: existingCreatorId || currentUserId,
    created_by_email: existingCreatorEmail || currentUserEmail,
    created_by_name: existingCreatorName || currentUserName,
    created_by_level: existingCreatorLevel || currentUserLevel,
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
    // CRITICAL: Enrich items with prices from result for proper reconstruction later
    items: (proposal.items || []).map((item: any, idx: number) => {
      // Find matching rows in result to get calculated prices
      const resultRows = proposal.result?.rows || [];
      const prefix = item.type === 'vm' ? `vm_${idx}` : `bm_${idx}`;
      
      // Sum up all related row prices (cpu, ram, disk, gpu, etc)
      const relatedRows = resultRows.filter((r: any) => r.rowKey?.startsWith(prefix));
      const unitPrice = relatedRows.reduce((sum: number, r: any) => sum + (r.unitPrice || 0), 0);
      const totalPrice = relatedRows.reduce((sum: number, r: any) => sum + (r.finalTotal || r.subtotal || 0), 0);
      
      return {
        ...item,
        unitPrice: item.unitPrice || unitPrice,
        totalPrice: item.totalPrice || totalPrice,
      };
    }),
    
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
    // Store in API format for consistency
    status: statusToApiFormat(proposal.status as ProposalStatus) || 'Rascunho',
    acceptance: proposal.acceptance,
  };
  
  // IMPORTANT: This hook is used by EXECUTIVES (level 700+), so channel_type is always CLIENTE
  // Partner proposals use useSavePartnerProposal which sets channel_type: PARCEIRO
  
  // ============================================
  // FINAL VALIDATION: Log payload before returning
  // ============================================
  const finalPayload = {
    name: proposal.client?.name || '',
    company: proposal.client?.company || '',
    phone: proposal.client?.phone || '',
    email: proposal.client?.email || '',
    channel_type: 'CLIENTE', // Executive proposals are always CLIENTE
    reseller_name: proposal.reseller?.resellerName || null,
    commission_value: proposal.reseller?.overValue || null,
    commission_reason: proposal.reseller?.overReason || null,
    observations: proposal.observacao || null,
    fx: proposal.fx || 1, // Fixed at 1 for BRL
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
    // API expects Portuguese readable status: 'Rascunho', 'Enviado', 'Aprovado', 'Recusado', 'Expirado', 'Cancelado'
    // Convert internal status to API format (statusToApiFormat already handles undefined → 'Rascunho')
    status: statusToApiFormat(proposal.status),
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
  
  // ============================================
  // FINAL VALIDATION AND LOGGING - BLOCK IF IDs ARE MISSING
  // ============================================
  console.log('[localToApi] PAYLOAD FINAL:', {
    total: finalPayload.total,
    discount_pct: finalPayload.discount_pct,
    fx: finalPayload.fx,
    servers: serversArray.map((s: any) => ({ 
      name: s.name, price: s.price, qty: s.quantity, 
      config_id: s.config_id, vcpu_item_id: s.vcpu_item_id, ram_item_id: s.ram_item_id, storage_item_id: s.storage_item_id 
    })),
    addons: addonsArray.map((a: any) => ({ name: a.name, price: a.price, qty: a.quantity, config_id: a.config_id, item_id: a.item_id })),
  });
  
  // ============================================
  // CRITICAL VALIDATION: Check for missing specs that will cause API 422 errors
  // NEW FLAT API: servers use specs[] not individual fields
  // ============================================
  const validationErrors: string[] = [];
  
  // Validate servers have at least one spec (NEW FLAT API: specs[] is required)
  for (const server of serversArray) {
    const serverName = server.name;
    // Skip validation for virtual/placeholder servers
    if (serverName?.startsWith('__VIRTUAL__')) continue;
    
    if (!server.specs || server.specs.length === 0) {
      validationErrors.push(`Server "${serverName}" missing specs[]`);
    } else {
      // Validate each spec has config_id and value
      for (let i = 0; i < server.specs.length; i++) {
        const spec = server.specs[i];
        if (!spec.config_id) {
          validationErrors.push(`Server "${serverName}" spec[${i}] missing config_id`);
        }
      }
    }
  }
  
  // Validate addons have config_id (NEW FLAT API: only config_id is required)
  for (const addon of addonsArray) {
    if (!addon.config_id) {
      validationErrors.push(`Addon missing config_id`);
    }
  }
  
  // If there are validation errors, throw to prevent API request
  if (validationErrors.length > 0) {
    console.error('[localToApi] ❌ VALIDATION FAILED - Missing IDs:', validationErrors);
    console.error('[localToApi] Available config store categories:', configIdStore ? Array.from(configIdStore.byCategory.keys()) : 'null');
    console.error('[localToApi] VM items:', configIdStore?.byCategory.get('VM')?.map(v => `${v.configId}:${v.label}`));
    console.error('[localToApi] Addon items:', configIdStore?.byCategory.get('Add-ons')?.map(a => `${a.configId}:${a.label}`));
    console.error('[localToApi] SQL items:', configIdStore?.byCategory.get('SQL Server')?.map(s => `${s.configId}:${s.label}`));
    throw new Error(`IDs obrigatórios ausentes na configuração da API. Verifique o console para detalhes. Erros: ${validationErrors.join('; ')}`);
  }
  
  // NEW FLAT API: Price is calculated by backend from specs, no validation needed
  console.log('[localToApi] Note: All prices will be calculated by backend in NEW FLAT API');
  
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
          
          // CRITICAL: Log raw API response for debugging
          console.log('[useProposal] Raw API response:', {
            id: (result as any).id,
            serversCount: (result as any).servers?.length || 0,
            addonsCount: (result as any).addons?.length || 0,
            total: (result as any).total,
            sampleServer: (result as any).servers?.[0],
            sampleAddon: (result as any).addons?.[0],
          });
          
          // Convert to local format - result now includes files and creator
          const localProposal = apiToLocal(result as ApiProposal);
          
          // CRITICAL: Preserve raw API data for PropostaView rendering
          // These arrays have backend-calculated prices which are the source of truth
          const apiResult = result as any;
          (localProposal as any)._rawApiServers = apiResult.servers || [];
          (localProposal as any)._rawApiAddons = apiResult.addons || [];
          (localProposal as any)._rawApiTotal = apiResult.total;
          (localProposal as any)._rawApiData = apiResult;
          
          // Attach files directly from API response if present
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
// NEW ARCHITECTURE: After POST/PUT, we do a GET to fetch the complete proposal with
// backend-calculated prices. The mutation returns the refetched data as source of truth.
// 
// NEW: The mutation now accepts an optional pdfBlob to send along with the proposal data
// in the same request using multipart/form-data.
export function useSaveProposal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ proposal, pdfBlob }: { proposal: SavedProposal; pdfBlob?: Blob }) => {
      // Load config IDs for API v12+ compliance
      let configIdStore: ConfigIdStore | null = null;
      try {
        configIdStore = await loadConfigIds();
        console.log('[SaveProposal] Config IDs loaded for payload');
      } catch (error) {
        console.warn('[SaveProposal] Failed to load config IDs, proceeding without them:', error);
      }

      const apiData = localToApi(proposal, configIdStore);

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
        configIdsLoaded: !!configIdStore,
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

      let saveResult: any;
      let savedProposalId: number;
      
      if (numericId !== null && numericId > 0) {
        // Update existing proposal via API: PUT /api/calculator/proposal/{id}
        // Per API spec, file is REQUIRED on PUT - always send it
        console.log('[SaveProposal] ✓ UPDATING proposal via PUT:', numericId, pdfBlob ? 'with PDF file' : 'without file');
        saveResult = await openApi.updateProposal(numericId, apiData, pdfBlob);
        savedProposalId = numericId;
      } else {
        // ============================================
        // NEW FLOW: Create in 2 steps per API requirement
        // STEP 1: POST without file to create the proposal
        // STEP 2: Fetch backend-calculated prices and generate PDF
        // STEP 3: PUT with file to update with the PDF
        // ============================================
        console.log('[SaveProposal] ✓ CREATING new proposal via POST (Step 1: without file)');
        
        // Step 1: Create proposal WITHOUT file first
        saveResult = await openApi.createProposal(apiData);
        savedProposalId = saveResult?.id || saveResult?.data?.id;
        
        if (!savedProposalId) {
          console.error('[SaveProposal] POST response did not return an ID:', saveResult);
          throw new Error('Falha ao criar proposta: ID não retornado pela API');
        }
        
        console.log('[SaveProposal] ✓ Proposal created with ID:', savedProposalId, '- now will fetch and update with PDF');
        
        // Step 2: If we have a pdfBlob, we need to do an immediate PUT to attach the file
        // The PDF should be generated AFTER the POST so it uses backend-calculated prices
        if (pdfBlob) {
          try {
            console.log('[SaveProposal] ✓ Step 2: Updating proposal with PDF file via PUT:', savedProposalId);
            await openApi.updateProposal(savedProposalId, apiData, pdfBlob);
            console.log('[SaveProposal] ✓ PDF file attached successfully');
          } catch (putError) {
            console.error('[SaveProposal] Failed to attach PDF file (non-blocking):', putError);
            // Don't fail the whole operation - the proposal was created successfully
          }
        }
      }

      console.log('[SaveProposal] Save response - now refetching with backend-calculated prices. ID:', savedProposalId);

      // CRITICAL NEW STEP: Refetch the proposal to get backend-calculated prices
      // This is the source of truth for UI rendering, PDF generation, and editing
      let refetchedProposal: any;
      try {
        // GET /api/calculator/proposal/{id} with __with=files,creator
        refetchedProposal = await openApi.getProposal(savedProposalId);
        console.log('[SaveProposal] ✓ Refetched proposal with backend-calculated prices:', {
          id: refetchedProposal?.id,
          total: refetchedProposal?.total,
          serversCount: refetchedProposal?.servers?.length,
          addonsCount: refetchedProposal?.addons?.length,
          sampleServerPrice: refetchedProposal?.servers?.[0]?.price,
          sampleAddonPrice: refetchedProposal?.addons?.[0]?.price,
        });
      } catch (refetchError) {
        console.error('[SaveProposal] Failed to refetch proposal after save:', refetchError);
        // Don't fail the whole operation - return save result but warn about missing refetch
        return { 
          success: true, 
          data: saveResult, 
          refetchedData: null,
          proposalId: savedProposalId,
          isUpdate: Boolean(numericId),
          refetchFailed: true,
        };
      }

      // Convert refetched API data to local format for UI consumption
      const localProposal = apiToLocal(refetchedProposal as ApiProposal);
      
      // Attach files directly from refetched response if present
      if (refetchedProposal.files && Array.isArray(refetchedProposal.files)) {
        (localProposal as any).files = refetchedProposal.files;
      }

      return { 
        success: true, 
        data: saveResult, 
        refetchedData: refetchedProposal,
        localData: localProposal,
        proposalId: savedProposalId,
        isUpdate: Boolean(numericId),
        refetchFailed: false,
      };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
      // Also invalidate specific proposal query to ensure fresh data
      if (result?.proposalId) {
        queryClient.invalidateQueries({ queryKey: ['proposal', 'api', String(result.proposalId)] });
      }
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
      // Load config IDs for API v12+ compliance
      let configIdStore: ConfigIdStore | null = null;
      try {
        configIdStore = await loadConfigIds();
      } catch (error) {
        console.warn('[UpdateProposal] Failed to load config IDs:', error);
      }

      // Parse numeric ID
      const numericId = parseInt(id, 10);
      if (!isNaN(numericId)) {
        const apiData = localToApi(proposal, configIdStore);
        const result = await openApi.updateProposal(numericId, apiData);
        return { success: true, data: result };
      }
      
      // Fallback: search by PROP-ID format
      const response = await openApi.getProposals({ __perPage: 500 });
      const existing = (response.data as ApiProposal[]).find(p => `PROP-${p.id}` === id);
      
      if (existing) {
        const apiData = localToApi(proposal, configIdStore);
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
