/**
 * OpenCalculatorState - Single source of truth for calculator state
 * 
 * CRITICAL: In edit mode, this state MUST be populated ONLY via hydrateProposalForEdit()
 * CRITICAL: When saving, the payload MUST be generated ONLY via serializeProposal()
 * 
 * This eliminates scattered useState and ensures all items (WinServer, Backup, GPU)
 * are properly persisted and restored during editing.
 */

import type {
  CalculatorConfig,
  ServerItem,
  VMItem,
  BMItem,
  DiskItem,
  StorageItem,
  KubernetesState,
  OpenSaaSState,
  ResellerState,
  PriceOverrideMap,
  K8sPlan,
} from '@/lib/calculatorConfig';

// ============================================================================
// ADDONS STATE
// ============================================================================

export type SupportLevelV2 = 'none' | 'basic' | 'intermediate' | 'advanced';

export interface AddonsStateV2 {
  backupPlan: 'none' | '7' | '15' | '30';
  backupGb: number;
  antivirus: number;
  firewall: boolean;
  tsplus: number;
  cal: number;
  sql: 'none' | 'web' | 'we' | 'std';
  sqlQty: number;
  veeamVm: number;
  veeamAg: number;
  winserver: number; // Windows Server 2vCPU units
  // New add-ons
  support: {
    level: SupportLevelV2;
    price: number;
  };
  consulting: {
    quantity: number;
    unitPrice: number;
  };
  dba: {
    quantity: number;
    unitPrice: number;
  };
  customAddons: Record<string, number>;
}

export const DEFAULT_ADDONS: AddonsStateV2 = {
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
  support: { level: 'none', price: 0 },
  consulting: { quantity: 0, unitPrice: 200 },
  dba: { quantity: 0, unitPrice: 250 },
  customAddons: {},
};

// ============================================================================
// KUBERNETES STATE
// ============================================================================

export interface K8sAddonsV2 {
  support_24x7: boolean;
  backup_velero: boolean;
  dr_multisite: boolean;
  observability: boolean;
  cicd_managed: boolean;
  devops_hours: number;
}

export interface K8sExtrasV2 {
  vcpu: number;
  ramGB: number;
  diskGB: number;
}

export interface KubernetesStateV2 {
  enabled: boolean;
  plan: K8sPlan;
  addons: K8sAddonsV2;
  extras: K8sExtrasV2;
}

export const DEFAULT_KUBERNETES: KubernetesStateV2 = {
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
};

// ============================================================================
// OPEN SAAS STATE
// ============================================================================

export interface OpenSaaSStateV2 {
  enabled: boolean;
  users: number;
}

export const DEFAULT_OPEN_SAAS: OpenSaaSStateV2 = {
  enabled: false,
  users: 0,
};

// ============================================================================
// RESELLER STATE
// ============================================================================

export interface ResellerStateV2 {
  enabled: boolean;
  viewMode: 'INTERNO' | 'CLIENTE';
  resellerName: string;
  overValue: number;
  overReason: string;
  observations: string;
  approvalRequired: boolean;
  approvalStatus: 'Pendente' | 'Aprovado';
  approver: string;
  approvedAt: string | null;
}

export const DEFAULT_RESELLER: ResellerStateV2 = {
  enabled: false,
  viewMode: 'INTERNO',
  resellerName: '',
  overValue: 0,
  overReason: '',
  observations: '',
  approvalRequired: false,
  approvalStatus: 'Pendente',
  approver: '',
  approvedAt: null,
};

// ============================================================================
// STORAGE STATE
// ============================================================================

export interface StorageItemV2 {
  id: string;
  storageType: 'sas' | 's3' | 'nvme';
  region: 'BR' | 'USA';
  volumeTB: number;
  volumeGB?: number;
}

// ============================================================================
// SERVER ITEMS (VM / BAREMETAL)
// ============================================================================

export interface VMItemV2 {
  type: 'vm';
  id: string;
  gpu: string;
  gpuQty: number;
  vcpu: number;
  ramGb: number;
  nvmeTb: number;
  trafficTb: number;
  ips: number;
  qtyServers: number;
}

export interface DiskItemV2 {
  type: string;
  qty: number;
  desc: string;
}

export interface BMItemV2 {
  type: 'bm';
  id: string;
  gpu: string;
  gpuQty: number;
  bmCpu: string;
  bmRam: string;
  disks: DiskItemV2[];
  trafficTb: number;
  ips: number;
  qtyServers: number;
}

export type ServerItemV2 = VMItemV2 | BMItemV2;

// ============================================================================
// META INFO
// ============================================================================

export interface ProposalMetaV2 {
  apiId: number | null;           // API numeric ID (null for new proposals)
  proposalDisplayId: string;      // Display ID (e.g., "OPEN-ABC123")
  createdAt: string;
  validityDays: number;
}

export interface ClientInfoV2 {
  name: string;
  company: string;
  phone: string;
  email: string;
}

// ============================================================================
// TOTALS (calculated, not persisted directly)
// ============================================================================

export interface CalculatedTotals {
  subRec: number;
  subIps: number;
  subServices: number;
  subBackup: number;
  subKubernetes: number;
  subStorage: number;
  subOpenSaas: number;
  gpuBrlTotal: number;
  discountPct: number;
  discountValue: number;
  subtotalPriceList: number;
  overValue: number;
  overPercent: number;
  grandTotal: number;
  totalWithOver: number;
}

// ============================================================================
// FLAGS
// ============================================================================

export interface CalculatorFlags {
  isEditMode: boolean;
  isHydrated: boolean;
  isLoading: boolean;
  isSaving: boolean;
}

// ============================================================================
// MAIN STATE CONTRACT
// ============================================================================

export interface OpenCalculatorState {
  // Meta information
  meta: ProposalMetaV2;
  client: ClientInfoV2;
  
  // Contract terms
  datacenter: 'SP1' | 'SP2' | 'FL1' | 'CE1';
  selectedTerm: '1' | '12' | '24' | '36' | '48';
  
  // Server items (VMs and BareMetals)
  items: ServerItemV2[];
  
  // Add-ons (includes WinServer, Backup, standard addons)
  addons: AddonsStateV2;
  
  // Independent products
  kubernetes: KubernetesStateV2;
  storageItems: StorageItemV2[];
  openSaas: OpenSaaSStateV2;
  
  // Reseller/Commission
  reseller: ResellerStateV2;
  
  // Price overrides (manual markup)
  priceOverrides: PriceOverrideMap;
  
  // Observations
  observacao: string;
  
  // Flags
  flags: CalculatorFlags;
}

// ============================================================================
// DEFAULT STATE FACTORY
// ============================================================================

export function createDefaultCalculatorState(): OpenCalculatorState {
  return {
    meta: {
      apiId: null,
      proposalDisplayId: '',
      createdAt: new Date().toISOString(),
      validityDays: 7,
    },
    client: {
      name: '',
      company: '',
      phone: '',
      email: '',
    },
    datacenter: 'SP1',
    selectedTerm: '1',
    items: [],
    addons: { ...DEFAULT_ADDONS },
    kubernetes: { ...DEFAULT_KUBERNETES },
    storageItems: [],
    openSaas: { ...DEFAULT_OPEN_SAAS },
    reseller: { ...DEFAULT_RESELLER },
    priceOverrides: {},
    observacao: '',
    flags: {
      isEditMode: false,
      isHydrated: false,
      isLoading: false,
      isSaving: false,
    },
  };
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

export function isVMItem(item: ServerItemV2): item is VMItemV2 {
  return item.type === 'vm';
}

export function isBMItem(item: ServerItemV2): item is BMItemV2 {
  return item.type === 'bm';
}
