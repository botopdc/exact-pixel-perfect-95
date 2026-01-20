/**
 * Proposal Mappers - Hydration and Serialization
 * 
 * CRITICAL: These are the ONLY functions that should be used for:
 * - hydrateProposalForEdit: API response → OpenCalculatorState (for editing)
 * - serializeProposal: OpenCalculatorState → API payload (for saving)
 * 
 * This ensures perfect roundtrip of ALL data including:
 * - Windows Server (winserver)
 * - Backup (plan + GB)
 * - GPU (model + quantity per server)
 * - All other addons and independent products
 */

import {
  OpenCalculatorState,
  createDefaultCalculatorState,
  AddonsStateV2,
  KubernetesStateV2,
  OpenSaaSStateV2,
  ResellerStateV2,
  StorageItemV2,
  ServerItemV2,
  VMItemV2,
  BMItemV2,
  DiskItemV2,
  DEFAULT_ADDONS,
  DEFAULT_KUBERNETES,
  DEFAULT_OPEN_SAAS,
  DEFAULT_RESELLER,
} from './openCalculatorState';

import { generateProposalId, isValidContractMonth } from '@/lib/calculatorConfig';

// ============================================================================
// HELPERS
// ============================================================================

const toNum = (val: unknown, fallback = 0): number => {
  if (val === undefined || val === null || val === '') return fallback;
  const parsed = typeof val === 'string' ? parseFloat(String(val).replace(',', '.')) : Number(val);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toStr = (val: unknown, fallback = ''): string => {
  if (val === undefined || val === null) return fallback;
  return String(val);
};

const toBool = (val: unknown): boolean => {
  return Boolean(val);
};

// ============================================================================
// HYDRATE FROM API (for edit mode)
// ============================================================================

/**
 * Hydrates the complete calculator state from an API proposal response.
 * 
 * This function handles:
 * 1. dados_proposta snapshot (preferred source - complete state)
 * 2. Legacy reconstruction from addons[]/servers[] arrays
 * 
 * CRITICAL: All items (WinServer, Backup, GPU) are explicitly mapped.
 */
export function hydrateProposalForEdit(apiProposal: Record<string, unknown>): OpenCalculatorState {
  console.log('[hydrateProposalForEdit] Starting hydration for proposal:', apiProposal.id);
  
  const state = createDefaultCalculatorState();
  
  // Set edit mode flags
  state.flags.isEditMode = true;
  state.flags.isHydrated = true;
  state.flags.isLoading = false;
  
  // ============================================
  // STEP 1: Parse dados_proposta if available
  // ============================================
  let dadosProposta = apiProposal.dados_proposta as Record<string, unknown> | string | null;
  
  if (typeof dadosProposta === 'string') {
    try {
      dadosProposta = JSON.parse(dadosProposta);
      console.log('[hydrateProposalForEdit] Parsed dados_proposta from string');
    } catch {
      console.warn('[hydrateProposalForEdit] Failed to parse dados_proposta string');
      dadosProposta = null;
    }
  }
  
  const hasDadosProposta = dadosProposta && typeof dadosProposta === 'object';
  
  // ============================================
  // STEP 2: Extract meta information
  // ============================================
  state.meta.apiId = toNum(apiProposal.id, null as unknown as number) || null;
  state.meta.proposalDisplayId = hasDadosProposta 
    ? toStr((dadosProposta as any).proposal?.id, `PROP-${apiProposal.id}`)
    : `PROP-${apiProposal.id}`;
  state.meta.createdAt = toStr(apiProposal.created_at, new Date().toISOString());
  state.meta.validityDays = hasDadosProposta 
    ? toNum((dadosProposta as any).proposal?.validityDays, 7)
    : 7;
  
  // ============================================
  // STEP 3: Extract client info
  // ============================================
  if (hasDadosProposta && (dadosProposta as any).client) {
    const c = (dadosProposta as any).client;
    state.client.name = toStr(c.name, toStr(apiProposal.name));
    state.client.company = toStr(c.company, toStr(apiProposal.company));
    state.client.phone = toStr(c.phone, toStr(apiProposal.phone));
    state.client.email = toStr(c.email, toStr(apiProposal.email));
  } else {
    state.client.name = toStr(apiProposal.name);
    state.client.company = toStr(apiProposal.company);
    state.client.phone = toStr(apiProposal.phone);
    state.client.email = toStr(apiProposal.email);
  }
  
  // ============================================
  // STEP 4: Extract contract terms
  // ============================================
  const rawTerm = hasDadosProposta 
    ? (dadosProposta as any).selectedTerm 
    : apiProposal.contract_duration;
  const termNum = toNum(rawTerm, 1);
  state.selectedTerm = isValidContractMonth(termNum) 
    ? (String(termNum) as '1' | '12' | '24' | '36' | '48')
    : '1';
  
  // Datacenter
  const datacenterMap: Record<string, 'SP1' | 'SP2' | 'FL1' | 'CE1'> = {
    'São Paulo': 'SP1', 'SP1': 'SP1',
    'São Paulo 2': 'SP2', 'SP2': 'SP2',
    'Florida': 'FL1', 'FL1': 'FL1',
    'Ceará': 'CE1', 'CE1': 'CE1',
  };
  const rawDc = hasDadosProposta 
    ? toStr((dadosProposta as any).datacenter)
    : toStr(apiProposal.datacenter);
  state.datacenter = datacenterMap[rawDc] || 'SP1';
  
  // ============================================
  // STEP 5: Extract server items (VMs / BareMetals)
  // ============================================
  if (hasDadosProposta && Array.isArray((dadosProposta as any).items)) {
    state.items = hydrateServerItems((dadosProposta as any).items);
  } else if (Array.isArray(apiProposal.servers)) {
    state.items = hydrateServerItemsFromLegacy(apiProposal.servers as any[]);
  }
  
  // ============================================
  // STEP 6: Extract ADDONS (including WinServer, Backup)
  // ============================================
  if (hasDadosProposta && (dadosProposta as any).addons) {
    state.addons = hydrateAddons((dadosProposta as any).addons);
  } else if (Array.isArray(apiProposal.addons)) {
    state.addons = hydrateAddonsFromLegacy(apiProposal.addons as any[]);
  }
  
  // Log addon restoration for debugging
  logAddonRestoration(state.addons);
  
  // ============================================
  // STEP 7: Extract Kubernetes
  // ============================================
  if (hasDadosProposta && (dadosProposta as any).kubernetes) {
    state.kubernetes = hydrateKubernetes((dadosProposta as any).kubernetes);
  }
  
  // ============================================
  // STEP 8: Extract Storage items
  // ============================================
  if (hasDadosProposta && Array.isArray((dadosProposta as any).storageItems)) {
    state.storageItems = hydrateStorageItems((dadosProposta as any).storageItems);
  }
  
  // ============================================
  // STEP 9: Extract OpenSaaS
  // ============================================
  if (hasDadosProposta && (dadosProposta as any).openSaas) {
    state.openSaas = hydrateOpenSaas((dadosProposta as any).openSaas);
  }
  
  // ============================================
  // STEP 10: Extract Reseller
  // ============================================
  if (hasDadosProposta && (dadosProposta as any).reseller) {
    state.reseller = hydrateReseller((dadosProposta as any).reseller);
  } else if (apiProposal.reseller_name) {
    state.reseller = {
      ...DEFAULT_RESELLER,
      enabled: true,
      resellerName: toStr(apiProposal.reseller_name),
      overValue: toNum(apiProposal.commission_value, 0),
      overReason: toStr(apiProposal.commission_reason),
    };
  }
  
  // ============================================
  // STEP 11: Extract price overrides
  // ============================================
  if (hasDadosProposta && (dadosProposta as any).priceOverrides) {
    state.priceOverrides = (dadosProposta as any).priceOverrides;
  }
  
  // ============================================
  // STEP 12: Extract observacao
  // ============================================
  state.observacao = hasDadosProposta 
    ? toStr((dadosProposta as any).observacao, toStr(apiProposal.observations))
    : toStr(apiProposal.observations);
  
  console.log('[hydrateProposalForEdit] Hydration complete:', {
    apiId: state.meta.apiId,
    itemsCount: state.items.length,
    vmCount: state.items.filter(i => i.type === 'vm').length,
    bmCount: state.items.filter(i => i.type === 'bm').length,
    storageCount: state.storageItems.length,
    kubernetesEnabled: state.kubernetes.enabled,
    openSaasEnabled: state.openSaas.enabled,
    addons: state.addons,
  });
  
  return state;
}

// ============================================
// HYDRATION HELPERS
// ============================================

function hydrateServerItems(items: any[]): ServerItemV2[] {
  return items.map((item, idx) => {
    const id = item.id || crypto.randomUUID();
    
    // CRITICAL: Explicit GPU preservation - only default if truly missing or empty
    const gpu = typeof item.gpu === 'string' && item.gpu !== '' ? item.gpu : 'Sem GPU';
    const gpuQty = typeof item.gpuQty === 'number' ? item.gpuQty : toNum(item.gpuQty, 0);
    
    // Log GPU restoration
    if (gpu !== 'Sem GPU' && gpuQty > 0) {
      console.log('[EDIT] GPU restored on server ID=', id, ':', { gpu, gpuQty });
    }
    
    if (item.type === 'bm' || item.bmCpu || item.bmRam) {
      return {
        type: 'bm' as const,
        id,
        gpu,
        gpuQty,
        bmCpu: toStr(item.bmCpu, 'intel_xeon_e2136'),
        bmRam: toStr(item.bmRam, 'ram_128gb'),
        disks: hydrateDisks(item.disks),
        trafficTb: toNum(item.trafficTb, 5),
        ips: toNum(item.ips, 0),
        qtyServers: toNum(item.qtyServers, 1),
      } as BMItemV2;
    }
    
    return {
      type: 'vm' as const,
      id,
      gpu,
      gpuQty,
      vcpu: toNum(item.vcpu, 16),
      ramGb: toNum(item.ramGb, 128),
      nvmeTb: toNum(item.nvmeTb, 0.09765625), // 100GB default
      trafficTb: toNum(item.trafficTb, 5),
      ips: toNum(item.ips, 0),
      qtyServers: toNum(item.qtyServers, 1),
    } as VMItemV2;
  });
}

function hydrateServerItemsFromLegacy(servers: any[]): ServerItemV2[] {
  return servers
    .filter(s => {
      // Skip virtual products
      const name = toStr(s.name, '').toLowerCase();
      return !name.startsWith('__virtual__') && !name.startsWith('virtual_product');
    })
    .map((server, idx) => {
      const id = crypto.randomUUID();
      const name = toStr(server.name, '').toLowerCase();
      const isVM = name.includes('vm') || toNum(server.vcpu, 0) > 0;

      // CRITICAL: support GPU stored as object: { model, quantity }
      let gpu = 'Sem GPU';
      let gpuQty = 0;

      if (server.gpu && typeof server.gpu === 'object') {
        gpu = typeof server.gpu.model === 'string' && server.gpu.model !== '' ? server.gpu.model : 'Sem GPU';
        gpuQty = typeof server.gpu.quantity === 'number' ? server.gpu.quantity : toNum(server.gpu.quantity, 0);
      } else {
        const rawGpu = server.gpu || server.gpu_model || server.extras?.gpu || server.extras?.gpu_model;
        gpu = typeof rawGpu === 'string' && rawGpu !== '' ? rawGpu : 'Sem GPU';

        const rawGpuQty = server.gpuQty ?? server.gpu_qty ?? server.extras?.gpuQty ?? server.extras?.gpu_qty;
        gpuQty = typeof rawGpuQty === 'number' ? rawGpuQty : toNum(rawGpuQty, 0);
      }

      if (gpu !== 'Sem GPU' && gpuQty > 0) {
        console.log(`[EDIT] GPU restored: model=${gpu} qty=${gpuQty}`);
      }

      if (isVM) {
        return {
          type: 'vm' as const,
          id,
          gpu,
          gpuQty,
          vcpu: toNum(server.vcpu, 16),
          ramGb: toNum(server.ram, 128),
          nvmeTb: toNum(server.storage, 50) / 1024,
          trafficTb: 5,
          ips: toNum(server.ips, 0),
          qtyServers: toNum(server.quantity, 1),
        } as VMItemV2;
      }

      return {
        type: 'bm' as const,
        id,
        gpu,
        gpuQty,
        bmCpu: 'intel_xeon_e2136',
        bmRam: 'ram_128gb',
        disks: [{ type: 'nvme_1tb', qty: 1, desc: '' }],
        trafficTb: 5,
        ips: toNum(server.ips, 0),
        qtyServers: toNum(server.quantity, 1),
      } as BMItemV2;
    });
}

function hydrateDisks(disks: any): DiskItemV2[] {
  if (!Array.isArray(disks) || disks.length === 0) {
    return [{ type: 'nvme_1tb', qty: 1, desc: '' }];
  }
  return disks.map(d => ({
    type: toStr(d.type, 'nvme_1tb'),
    qty: toNum(d.qty, 1),
    desc: toStr(d.desc, ''),
  }));
}

function hydrateAddons(raw: any): AddonsStateV2 {
  return {
    backupPlan: raw.backupPlan || 'none',
    backupGb: toNum(raw.backupGb, 0),
    antivirus: toNum(raw.antivirus, 0),
    firewall: toBool(raw.firewall),
    tsplus: toNum(raw.tsplus, 0),
    cal: toNum(raw.cal, 0),
    sql: raw.sql || 'none',
    sqlQty: toNum(raw.sqlQty, 0),
    veeamVm: toNum(raw.veeamVm, 0),
    veeamAg: toNum(raw.veeamAg, 0),
    winserver: toNum(raw.winserver, 0),
    support: {
      level: raw.support?.level || 'none',
      price: toNum(raw.support?.price, 0),
    },
    consulting: {
      quantity: toNum(raw.consulting?.quantity, 0),
      unitPrice: toNum(raw.consulting?.unitPrice, 200),
    },
    dba: {
      quantity: toNum(raw.dba?.quantity, 0),
      unitPrice: toNum(raw.dba?.unitPrice, 250),
    },
    customAddons: raw.customAddons || {},
  };
}

function hydrateAddonsFromLegacy(addons: any[]): AddonsStateV2 {
  const result: AddonsStateV2 = { ...DEFAULT_ADDONS };
  
  for (const addon of addons) {
    if (!addon.name) continue;
    
    const name = toStr(addon.name, '').toLowerCase();
    const qty = toNum(addon.quantity, 1);
    const price = toNum(addon.price, 0);
    
    // Windows Server
    if (name.includes('winserver') || name.includes('windows server') || name.includes('win server')) {
      result.winserver = qty;
      console.log('[EDIT] WindowsServer units restored:', qty);
      continue;
    }
    
    // Suporte (Support) - NEW
    if (name.startsWith('suporte ')) {
      const levelMatch = name.match(/suporte\s+(basic|intermediate|advanced|básico|intermediário|avançado)/i);
      if (levelMatch) {
        const levelMap: Record<string, 'basic' | 'intermediate' | 'advanced'> = {
          'basic': 'basic', 'básico': 'basic',
          'intermediate': 'intermediate', 'intermediário': 'intermediate',
          'advanced': 'advanced', 'avançado': 'advanced',
        };
        result.support.level = levelMap[levelMatch[1].toLowerCase()] || 'basic';
        result.support.price = price;
        console.log('[EDIT] Suporte restored:', result.support.level, result.support.price);
      }
      continue;
    }
    
    // Consultoria Técnica - NEW
    if (name.includes('consultoria')) {
      result.consulting.quantity = qty;
      result.consulting.unitPrice = price > 0 ? price : 200;
      console.log('[EDIT] Consultoria restored:', result.consulting.quantity, 'h @', result.consulting.unitPrice);
      continue;
    }
    
    // DBA - NEW
    if (name === 'dba') {
      result.dba.quantity = qty;
      result.dba.unitPrice = price > 0 ? price : 250;
      console.log('[EDIT] DBA restored:', result.dba.quantity, 'h @', result.dba.unitPrice);
      continue;
    }
    
    // Backup
    if (name.startsWith('backup ')) {
      const planMatch = name.match(/backup\s+(\d+)/i);
      if (planMatch) {
        result.backupPlan = planMatch[1] as '7' | '15' | '30';
        result.backupGb = qty;
        console.log('[EDIT] Backup restored: plan=', result.backupPlan, ', gb=', result.backupGb);
      }
      continue;
    }
    
    // Antivirus
    if (name.includes('antivirus') || name.includes('antivírus')) {
      result.antivirus = qty;
      continue;
    }
    
    // Firewall
    if (name.includes('firewall')) {
      result.firewall = true;
      continue;
    }
    
    // TSplus
    if (name.includes('tsplus') || name.includes('ts plus')) {
      result.tsplus = qty;
      continue;
    }
    
    // CAL
    if (name === 'cal') {
      result.cal = qty;
      continue;
    }
    
    // Veeam VM
    if (name.includes('veeam vm')) {
      result.veeamVm = qty;
      continue;
    }
    
    // Veeam Agent
    if (name.includes('veeam agent')) {
      result.veeamAg = qty;
      continue;
    }
    
    // SQL
    if (name.includes('sql')) {
      if (name.includes('web')) result.sql = 'web';
      else if (name.includes('we')) result.sql = 'we';
      else if (name.includes('std') || name.includes('standard')) result.sql = 'std';
      result.sqlQty = qty;
      continue;
    }
  }
  
  return result;
}

function hydrateKubernetes(raw: any): KubernetesStateV2 {
  const addons = raw.addons || {};
  const extras = raw.extras || {};
  
  return {
    enabled: toBool(raw.enabled),
    plan: raw.plan || 'k8s_small',
    addons: {
      support_24x7: toBool(addons.support_24x7),
      backup_velero: toBool(addons.backup_velero),
      dr_multisite: toBool(addons.dr_multisite),
      observability: toBool(addons.observability),
      cicd_managed: toBool(addons.cicd_managed),
      devops_hours: toNum(addons.devops_hours, 0),
    },
    extras: {
      vcpu: toNum(extras.vcpu, 0),
      ramGB: toNum(extras.ramGB, 0),
      diskGB: toNum(extras.diskGB, 0),
    },
  };
}

function hydrateStorageItems(items: any[]): StorageItemV2[] {
  return items.map(s => ({
    id: s.id || crypto.randomUUID(),
    storageType: s.storageType || s.type || 'sas',
    region: s.region || 'BR',
    volumeTB: toNum(s.volumeTB, 0),
    volumeGB: toNum(s.volumeGB, 0),
  }));
}

function hydrateOpenSaas(raw: any): OpenSaaSStateV2 {
  return {
    enabled: toBool(raw.enabled),
    users: toNum(raw.users, 0),
  };
}

function hydrateReseller(raw: any): ResellerStateV2 {
  return {
    enabled: toBool(raw.enabled),
    viewMode: raw.viewMode === 'CLIENTE' ? 'CLIENTE' : 'INTERNO',
    resellerName: toStr(raw.resellerName),
    overValue: toNum(raw.overValue, 0),
    overReason: toStr(raw.overReason),
    observations: toStr(raw.observations),
    approvalRequired: toBool(raw.approvalRequired),
    approvalStatus: raw.approvalStatus === 'Aprovado' ? 'Aprovado' : 'Pendente',
    approver: toStr(raw.approver),
    approvedAt: raw.approvedAt || null,
  };
}

function logAddonRestoration(addons: AddonsStateV2): void {
  if (addons.winserver > 0) {
    console.log('[EDIT] WindowsServer units restored:', addons.winserver);
  }
  if (addons.backupPlan !== 'none' && addons.backupGb > 0) {
    console.log('[EDIT] Backup restored: plan=', addons.backupPlan, ', gb=', addons.backupGb);
  }
  if (addons.antivirus > 0) {
    console.log('[EDIT] Antivirus restored:', addons.antivirus);
  }
  if (addons.firewall) {
    console.log('[EDIT] Firewall restored: enabled');
  }
}

// ============================================================================
// SERIALIZE TO API (for saving)
// ============================================================================

export interface ApiProposalPayload {
  name: string;
  company: string;
  phone: string;
  email: string;
  channel_type: 'CLIENTE' | 'PARCEIRO';
  reseller_name?: string | null;
  commission_value?: number | null;
  commission_reason?: string | null;
  observations?: string | null;
  fx: number;
  datacenter: string;
  contract_duration: number;
  discount_pct: number;
  total: number;
  addons: Array<{ name: string; price: number; quantity: number }>;
  servers: Array<{
    name: string;
    vcpu: number;
    ram: number;
    storage: number;
    price: number;
    quantity: number;
    gpu?: { model: string; quantity: number };
  }>;
  due_at: string;
  proposal_status?: string;
  status?: string;
  dados_proposta: Record<string, unknown>;
}

/**
 * Serializes the calculator state to API payload format.
 * 
 * CRITICAL: This is the ONLY function that should generate the save payload.
 * All items (WinServer, Backup, GPU) are explicitly serialized.
 */
export function serializeProposal(
  state: OpenCalculatorState,
  channelType: 'CLIENTE' | 'PARCEIRO',
  grandTotal: number,
  discountPct: number = 0
): ApiProposalPayload {
  console.log('[serializeProposal] Serializing state for save...');
  
  const datacenterNames: Record<string, string> = {
    'SP1': 'São Paulo',
    'SP2': 'São Paulo 2',
    'FL1': 'Florida',
    'CE1': 'Ceará',
  };
  
  // Calculate due_at
  const validityDays = state.meta.validityDays || 7;
  const createdAt = state.meta.createdAt || new Date().toISOString();
  const dueAt = new Date(createdAt);
  dueAt.setDate(dueAt.getDate() + validityDays);
  
  // ============================================
  // BUILD ADDONS ARRAY
  // ============================================
  const addonsArray: Array<{ name: string; price: number; quantity: number }> = [];
  
  // Windows Server - EXPLICIT
  if (state.addons.winserver > 0) {
    addonsArray.push({
      name: 'WinServer(2vCPU/unid.)',
      price: 0,
      quantity: state.addons.winserver,
    });
    console.log('[serializeProposal] Added WinServer:', state.addons.winserver);
  }
  
  // Support - NEW
  if (state.addons.support.level !== 'none') {
    addonsArray.push({
      name: `Suporte ${state.addons.support.level}`,
      price: state.addons.support.price,
      quantity: 1,
    });
    console.log('[serializeProposal] Added Suporte:', state.addons.support.level, state.addons.support.price);
  }
  
  // Consultoria Técnica - NEW
  if (state.addons.consulting.quantity > 0) {
    addonsArray.push({
      name: 'Consultoria Técnica',
      price: state.addons.consulting.unitPrice,
      quantity: state.addons.consulting.quantity,
    });
    console.log('[serializeProposal] Added Consultoria:', state.addons.consulting.quantity, 'h');
  }
  
  // DBA - NEW
  if (state.addons.dba.quantity > 0) {
    addonsArray.push({
      name: 'DBA',
      price: state.addons.dba.unitPrice,
      quantity: state.addons.dba.quantity,
    });
    console.log('[serializeProposal] Added DBA:', state.addons.dba.quantity, 'h');
  }
  
  // Backup - EXPLICIT
  if (state.addons.backupPlan !== 'none' && state.addons.backupGb > 0) {
    addonsArray.push({
      name: `Backup ${state.addons.backupPlan}`,
      price: 0,
      quantity: state.addons.backupGb,
    });
    console.log('[serializeProposal] Added Backup:', state.addons.backupPlan, state.addons.backupGb);
  }
  
  // Antivirus
  if (state.addons.antivirus > 0) {
    addonsArray.push({ name: 'Antivirus', price: 0, quantity: state.addons.antivirus });
  }
  
  // Firewall
  if (state.addons.firewall) {
    addonsArray.push({ name: 'Firewall', price: 0, quantity: 1 });
  }
  
  // TSplus
  if (state.addons.tsplus > 0) {
    addonsArray.push({ name: 'TS Plus', price: 0, quantity: state.addons.tsplus });
  }
  
  // CAL
  if (state.addons.cal > 0) {
    addonsArray.push({ name: 'CAL', price: 0, quantity: state.addons.cal });
  }
  
  // Veeam VM
  if (state.addons.veeamVm > 0) {
    addonsArray.push({ name: 'Veeam VM', price: 0, quantity: state.addons.veeamVm });
  }
  
  // Veeam Agent
  if (state.addons.veeamAg > 0) {
    addonsArray.push({ name: 'Veeam Agent', price: 0, quantity: state.addons.veeamAg });
  }
  
  // SQL
  if (state.addons.sql !== 'none' && state.addons.sqlQty > 0) {
    addonsArray.push({
      name: `SQL ${state.addons.sql.toUpperCase()}`,
      price: 0,
      quantity: state.addons.sqlQty,
    });
  }
  
  // Storage items
  for (const storage of state.storageItems) {
    const volumeTB = storage.volumeTB || 0;
    const volumeGB = storage.volumeGB || 0;
    if (volumeTB > 0 || volumeGB > 0) {
      const displaySize = volumeTB >= 1 
        ? `${volumeTB}TB`
        : `${Math.round(volumeGB || volumeTB * 1024)}GB`;
      addonsArray.push({
        name: `Storage ${storage.storageType.toUpperCase()} ${displaySize}`,
        price: 0,
        quantity: 1,
      });
    }
  }
  
  // Kubernetes
  if (state.kubernetes.enabled) {
    addonsArray.push({
      name: `Kubernetes ${state.kubernetes.plan}`,
      price: 0,
      quantity: 1,
    });
  }
  
  // OpenSaaS
  if (state.openSaas.enabled && state.openSaas.users > 0) {
    addonsArray.push({
      name: `OPEN SaaS ${state.openSaas.users} usuários`,
      price: 0,
      quantity: state.openSaas.users,
    });
  }
  
  // ============================================
  // BUILD SERVERS ARRAY
  // ============================================
  const serversArray: Array<{
    name: string;
    vcpu: number;
    ram: number;
    storage: number;
    price: number;
    quantity: number;
    gpu?: { model: string; quantity: number };
  }> = [];

  for (const [idx, item] of state.items.entries()) {
    const hasGpu = typeof item.gpu === 'string' && item.gpu !== '' && item.gpu !== 'Sem GPU' && item.gpuQty > 0;
    const gpuObj = hasGpu ? { model: item.gpu, quantity: item.gpuQty } : undefined;

    if (hasGpu) {
      console.log(`[SERIALIZE] gpu.enabled=true model=${item.gpu} qty=${item.gpuQty}`);
    }

    if (item.type === 'vm') {
      serversArray.push({
        name: `VM #${idx + 1}`,
        vcpu: item.vcpu,
        ram: item.ramGb,
        storage: Math.round(item.nvmeTb * 1024),
        price: 0,
        quantity: item.qtyServers,
        gpu: gpuObj,
      });
    } else if (item.type === 'bm') {
      serversArray.push({
        name: `BareMetal #${idx + 1}`,
        vcpu: 0,
        ram: 0,
        storage: 0,
        price: 0,
        quantity: item.qtyServers,
        gpu: gpuObj,
      });
    }
  }
  
  // Add virtual servers if no real servers (API requires at least 1)
  if (serversArray.length === 0) {
    if (state.storageItems.length > 0) {
      serversArray.push({
        name: `__VIRTUAL__STORAGE__:${JSON.stringify({ items: state.storageItems })}`,
        vcpu: 0, ram: 0, storage: 0, price: 0, quantity: 1,
      });
    }
    if (state.kubernetes.enabled) {
      serversArray.push({
        name: `__VIRTUAL__KUBERNETES__:${JSON.stringify(state.kubernetes)}`,
        vcpu: 0, ram: 0, storage: 0, price: 0, quantity: 1,
      });
    }
    if (state.openSaas.enabled && state.openSaas.users > 0) {
      serversArray.push({
        name: `__VIRTUAL__OPENSAAS__:${JSON.stringify(state.openSaas)}`,
        vcpu: 0, ram: 0, storage: 0, price: 0, quantity: 1,
      });
    }
    
    // Fallback placeholder
    if (serversArray.length === 0) {
      serversArray.push({
        name: '__VIRTUAL__BUNDLE__:{}',
        vcpu: 0, ram: 0, storage: 0, price: 0, quantity: 1,
      });
    }
  }
  
  // ============================================
  // BUILD dados_proposta SNAPSHOT
  // ============================================
  const dadosProposta = {
    proposalId: state.meta.proposalDisplayId,
    fx: 1, // Fixed BRL
    selectedTerm: state.selectedTerm,
    datacenter: state.datacenter,
    client: state.client,
    proposal: {
      id: state.meta.proposalDisplayId,
      validityDays: state.meta.validityDays,
      createdAt: state.meta.createdAt,
    },
    items: state.items,
    addons: state.addons,
    kubernetes: state.kubernetes,
    storageItems: state.storageItems,
    reseller: state.reseller,
    openSaas: state.openSaas,
    priceOverrides: state.priceOverrides,
    observacao: state.observacao,
  };
  
  console.log('[serializeProposal] Payload ready:', {
    serversCount: serversArray.length,
    addonsCount: addonsArray.length,
    hasWinServer: state.addons.winserver > 0,
    hasBackup: state.addons.backupPlan !== 'none',
    hasGpu: state.items.some(i => i.gpu !== 'Sem GPU' && i.gpuQty > 0),
  });
  
  return {
    name: state.client.name,
    company: state.client.company,
    phone: state.client.phone,
    email: state.client.email,
    channel_type: channelType,
    reseller_name: state.reseller.enabled ? state.reseller.resellerName : null,
    commission_value: state.reseller.enabled ? state.reseller.overValue : null,
    commission_reason: state.reseller.enabled ? state.reseller.overReason : null,
    observations: state.observacao || null,
    fx: 1, // Fixed BRL
    datacenter: datacenterNames[state.datacenter] || 'São Paulo',
    contract_duration: parseInt(state.selectedTerm, 10),
    discount_pct: discountPct,
    total: grandTotal,
    addons: addonsArray,
    servers: serversArray,
    due_at: dueAt.toISOString(),
    proposal_status: 'DRAFT',
    status: 'DRAFT',
    dados_proposta: dadosProposta,
  };
}

// ============================================================================
// LEGACY COMPATIBILITY EXPORTS
// ============================================================================

/**
 * Convert OpenCalculatorState back to legacy format for existing code
 */
export function stateToLegacyFormat(state: OpenCalculatorState): Record<string, unknown> {
  return {
    fx: 1,
    selectedTerm: state.selectedTerm,
    datacenter: state.datacenter,
    client: state.client,
    proposal: {
      id: state.meta.proposalDisplayId || generateProposalId(),
      validityDays: state.meta.validityDays,
      createdAt: state.meta.createdAt,
    },
    items: state.items,
    addons: state.addons,
    kubernetes: state.kubernetes,
    storageItems: state.storageItems,
    reseller: state.reseller,
    openSaas: state.openSaas,
    priceOverrides: state.priceOverrides,
    observacao: state.observacao,
  };
}
