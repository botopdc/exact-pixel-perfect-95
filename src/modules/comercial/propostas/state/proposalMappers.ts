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

/**
 * Merge addons: API values take precedence for non-zero values.
 * This ensures that the actual API data is used when available.
 */
function mergeAddonsWithApiPrecedence(snapshot: AddonsStateV2, api: AddonsStateV2): AddonsStateV2 {
  return {
    // Numeric fields: use API if > 0, otherwise fall back to snapshot
    backupPlan: api.backupPlan !== 'none' ? api.backupPlan : snapshot.backupPlan,
    backupGb: api.backupGb > 0 ? api.backupGb : snapshot.backupGb,
    antivirus: api.antivirus > 0 ? api.antivirus : snapshot.antivirus,
    firewall: api.firewall > 0 ? api.firewall : snapshot.firewall,
    tsplus: api.tsplus > 0 ? api.tsplus : snapshot.tsplus,
    cal: api.cal > 0 ? api.cal : snapshot.cal,
    sql: api.sql !== 'none' ? api.sql : snapshot.sql,
    sqlQty: api.sqlQty > 0 ? api.sqlQty : snapshot.sqlQty,
    veeamVm: api.veeamVm > 0 ? api.veeamVm : snapshot.veeamVm,
    veeamAg: api.veeamAg > 0 ? api.veeamAg : snapshot.veeamAg,
    winserver: api.winserver > 0 ? api.winserver : snapshot.winserver,
    // Complex objects: merge with API precedence
    support: api.support.level !== 'none' ? api.support : snapshot.support,
    consulting: api.consulting.quantity > 0 ? api.consulting : snapshot.consulting,
    dba: api.dba.quantity > 0 ? api.dba : snapshot.dba,
    // Custom addons: merge both
    customAddons: { ...snapshot.customAddons, ...api.customAddons },
  };
}

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
  
  // DEBUG: Log exactly what the API returned for addons/servers
  console.log('[hydrateProposalForEdit] RAW API addons type:', typeof apiProposal.addons, 
    'isArray:', Array.isArray(apiProposal.addons),
    'keys:', apiProposal.addons && typeof apiProposal.addons === 'object' ? Object.keys(apiProposal.addons) : 'N/A');
  console.log('[hydrateProposalForEdit] RAW API addons value:', JSON.stringify(apiProposal.addons, null, 2));
  console.log('[hydrateProposalForEdit] RAW API servers type:', typeof apiProposal.servers, 
    'isArray:', Array.isArray(apiProposal.servers));
  console.log('[hydrateProposalForEdit] RAW API servers value:', JSON.stringify(apiProposal.servers, null, 2));
  
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
  // STRATEGY: Use dados_proposta.addons as primary, then MERGE from API addons[]
  // This ensures we always have the latest data from the API.
  // ============================================
  let snapshotAddons: AddonsStateV2 | null = null;
  let apiAddons: AddonsStateV2 | null = null;
  
  // First try to get from snapshot
  if (hasDadosProposta && (dadosProposta as any).addons) {
    snapshotAddons = hydrateAddons((dadosProposta as any).addons);
    console.log('[hydrateProposalForEdit] Addons from snapshot:', snapshotAddons);
  }
  
  // Then get from API array (source of truth per API spec)
  if (Array.isArray(apiProposal.addons) && apiProposal.addons.length > 0) {
    apiAddons = hydrateAddonsFromLegacy(apiProposal.addons as any[]);
    console.log('[hydrateProposalForEdit] Addons from API array:', apiAddons);
  }
  
  // Merge: API takes precedence over snapshot for non-zero values
  // This ensures that if the API has data, it's used; otherwise fall back to snapshot
  if (apiAddons) {
    state.addons = mergeAddonsWithApiPrecedence(snapshotAddons || DEFAULT_ADDONS, apiAddons);
  } else if (snapshotAddons) {
    state.addons = snapshotAddons;
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
  const support = {
    level: raw.support?.level || 'none',
    price: toNum(raw.support?.price, 0),
  };
  const consulting = {
    quantity: toNum(raw.consulting?.quantity, 0),
    unitPrice: toNum(raw.consulting?.unitPrice, 200),
  };
  const dba = {
    quantity: toNum(raw.dba?.quantity, 0),
    unitPrice: toNum(raw.dba?.unitPrice, 250),
  };
  
  // Log specialized services restoration from snapshot
  if (support.level !== 'none') {
    console.log('[EDIT] support restored (snapshot): level=' + support.level + ' price=' + support.price);
  }
  if (consulting.quantity > 0) {
    console.log('[EDIT] consulting restored (snapshot): qty=' + consulting.quantity + ' unitPrice=' + consulting.unitPrice);
  }
  if (dba.quantity > 0) {
    console.log('[EDIT] dba restored (snapshot): qty=' + dba.quantity + ' unitPrice=' + dba.unitPrice);
  }
  
  // CRITICAL: SQL type and quantity per OpenAPI spec
  // API requires quantity >= 1 when type is selected for addon persistence
  const sqlType = toStr(raw.sql, 'none').toLowerCase();
  const normalizedSqlType = sqlType === 'standard' ? 'std' : (sqlType === 'web' || sqlType === 'std' ? sqlType : 'none');
  const sqlQty = toNum(raw.sqlQty, 0);
  // CRITICAL: Ensure qty >= 1 when SQL type is selected (prevents 0-qty loss)
  const finalSqlQty = normalizedSqlType !== 'none' && sqlQty === 0 ? 1 : sqlQty;
  
  // CRITICAL: Backup plan and GB per OpenAPI spec
  // API requires quantity >= 1 when plan is selected for addon persistence
  const rawBackupPlan = toStr(raw.backupPlan, 'none');
  const validBackupPlans = ['7', '15', '30'] as const;
  const normalizedBackupPlan: '7' | '15' | '30' | 'none' = validBackupPlans.includes(rawBackupPlan as any) 
    ? (rawBackupPlan as '7' | '15' | '30') 
    : 'none';
  const backupGb = toNum(raw.backupGb, 0);
  // CRITICAL: Ensure GB >= 1 when backup plan is selected (prevents 0-GB loss)
  const finalBackupGb = normalizedBackupPlan !== 'none' && backupGb === 0 ? 1 : backupGb;
  
  // Log SQL and Backup restoration for debugging
  if (normalizedSqlType !== 'none') {
    console.log('[EDIT] SQL restored (snapshot): type=' + normalizedSqlType + ' qty=' + finalSqlQty);
  }
  if (normalizedBackupPlan !== 'none') {
    console.log('[EDIT] Backup restored (snapshot): plan=' + normalizedBackupPlan + ' gb=' + finalBackupGb);
  }
  
  return {
    backupPlan: normalizedBackupPlan,
    backupGb: finalBackupGb,
    antivirus: toNum(raw.antivirus, 0),
    // Firewall: now a quantity. Convert old boolean (true) to 1, false to 0
    firewall: typeof raw.firewall === 'boolean' ? (raw.firewall ? 1 : 0) : toNum(raw.firewall, 0),
    tsplus: toNum(raw.tsplus, 0),
    cal: toNum(raw.cal, 0),
    sql: normalizedSqlType,
    sqlQty: finalSqlQty,
    veeamVm: toNum(raw.veeamVm, 0),
    veeamAg: toNum(raw.veeamAg, 0),
    winserver: toNum(raw.winserver, 0),
    support,
    consulting,
    dba,
    customAddons: raw.customAddons || {},
  };
}

/**
 * Hydrate addons from legacy API response (addons[] array).
 * 
 * STRATEGY: Build a map using config_id:item_id as key.
 * Then match based on:
 * 1. config_id + item_id (new API format)
 * 2. code OR name (legacy fallback)
 */
function hydrateAddonsFromLegacy(addons: any[]): AddonsStateV2 {
  const result: AddonsStateV2 = { ...DEFAULT_ADDONS };
  
  // Step 1: Build addonsByKey map for config_id:item_id lookup
  const addonsByKey: Map<string, number> = new Map();
  
  for (const addon of addons) {
    // CRITICAL: Skip if addon is null/undefined (sparse arrays)
    if (!addon || typeof addon !== 'object') continue;
    
    const configId = addon.config_id ?? addon.configId;
    const itemId = addon.item_id ?? addon.itemId;
    const qty = toNum(addon.quantity ?? addon.qty, 1);
    
    if (configId !== undefined && itemId !== undefined) {
      const key = `${configId}:${itemId}`;
      addonsByKey.set(key, qty);
      console.log(`[hydrateAddonsFromLegacy] Mapped ${key} -> qty=${qty}`);
    }
  }
  
  console.log('[hydrateAddonsFromLegacy] Built addonsByKey with', addonsByKey.size, 'entries');
  
  // Helper to normalize strings for matching (lowercase, remove accents, trim)
  // CRITICAL: Handle undefined/null by using toStr first
  const normalize = (str: unknown): string => {
    const safeStr = toStr(str, '');
    if (!safeStr) return '';
    return safeStr
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  };
  
  for (const addon of addons) {
    // CRITICAL: Skip if addon is null/undefined (can happen with sparse arrays)
    if (!addon || typeof addon !== 'object') continue;
    
    // Get code, name, AND label for matching (API returns 'label' not 'name')
    // CRITICAL: Use toStr to safely convert to string before calling toLowerCase
    const code = toStr(addon.code, '').toLowerCase().trim();
    const name = toStr(addon.name ?? addon.label, '').toLowerCase().trim();
    const label = toStr(addon.label, '').toLowerCase().trim();
    const nameNormalized = normalize(addon.name ?? addon.label ?? '');
    const labelNormalized = normalize(addon.label ?? '');
    const qty = toNum(addon.quantity ?? addon.qty, 1);
    const price = toNum(addon.price, 0);
    
    // Also check for config_id/item_id based lookup (new format)
    const configId = addon.config_id ?? addon.configId;
    const itemId = addon.item_id ?? addon.itemId;
    
    console.log(`[hydrateAddonsFromLegacy] Processing addon:`, { 
      code, name, label, qty, configId, itemId 
    });
    
    // Skip if no identifier at all
    if (!code && !name && !label && configId === undefined) continue;
    
    // Windows Server - match by code, name, label, or known item_id patterns
    if (code === 'winserver_2vcpu_unit' || 
        name.includes('winserver') || 
        name.includes('windows server') || 
        name.includes('win server') ||
        name.includes('windows') ||
        label.includes('winserver') ||
        labelNormalized.includes('winserver') || 
        labelNormalized.includes('windows')) {
      result.winserver = qty;
      console.log('[EDIT] WindowsServer units restored:', qty);
      continue;
    }
    
    // Support - match by code OR normalized name/label
    if (code === 'support_basic' || nameNormalized === 'suporte basico' || labelNormalized === 'suporte basico') {
      result.support.level = 'basic';
      result.support.price = price;
      console.log('[EDIT] support restored from addons[]: level=basic price=' + price);
      continue;
    }
    if (code === 'support_intermediate' || nameNormalized === 'suporte intermediario' || labelNormalized === 'suporte intermediario') {
      result.support.level = 'intermediate';
      result.support.price = price;
      console.log('[EDIT] support restored from addons[]: level=intermediate price=' + price);
      continue;
    }
    if (code === 'support_advanced' || nameNormalized === 'suporte avancado' || labelNormalized === 'suporte avancado') {
      result.support.level = 'advanced';
      result.support.price = price;
      console.log('[EDIT] support restored from addons[]: level=advanced price=' + price);
      continue;
    }
    // Generic support matching
    if (name.includes('suporte') || label.includes('suporte') || code.includes('support')) {
      if (name.includes('basico') || label.includes('basico') || name.includes('basic') || code.includes('basic')) {
        result.support.level = 'basic';
      } else if (name.includes('intermediario') || label.includes('intermediario') || name.includes('intermediate') || code.includes('intermediate')) {
        result.support.level = 'intermediate';
      } else if (name.includes('avancado') || label.includes('avancado') || name.includes('advanced') || code.includes('advanced')) {
        result.support.level = 'advanced';
      }
      result.support.price = price;
      console.log('[EDIT] support restored (generic): level=' + result.support.level + ' price=' + price);
      continue;
    }
    
    // Consultoria Técnica - match by code, name, or label
    if (code === 'consulting_hours' || 
        nameNormalized === 'consultoria tecnica' || 
        nameNormalized.includes('consultoria') ||
        labelNormalized.includes('consultoria')) {
      result.consulting.quantity = qty;
      result.consulting.unitPrice = price > 0 ? price : 200;
      console.log('[EDIT] consulting restored from addons[]: qty=' + qty + ' unitPrice=' + result.consulting.unitPrice);
      continue;
    }
    
    // DBA - match by code, name, or label
    if (code === 'dba_hours' || name === 'dba' || label === 'dba' || nameNormalized === 'dba' || labelNormalized === 'dba') {
      result.dba.quantity = qty;
      result.dba.unitPrice = price > 0 ? price : 250;
      console.log('[EDIT] dba restored from addons[]: qty=' + qty + ' unitPrice=' + result.dba.unitPrice);
      continue;
    }
    
    // Backup - match by code, name, or label pattern
    if (code?.startsWith('backup_') || name.startsWith('backup ') || name.includes('backup') || 
        label.includes('backup')) {
      const planMatch = (code || name || label).match(/backup[_\s]*(\d+)/i);
      if (planMatch) {
        const plan = planMatch[1];
        if (plan === '7' || plan === '15' || plan === '30') {
          result.backupPlan = plan as '7' | '15' | '30';
          result.backupGb = qty;
          console.log('[EDIT] Backup restored: plan=', result.backupPlan, ', gb=', result.backupGb);
        }
      }
      continue;
    }
    
    // Antivirus - match by code, name, or label
    if (code === 'antivirus' || name.includes('antivirus') || name.includes('antivírus') || 
        nameNormalized.includes('antivirus') || label.includes('antivirus') || labelNormalized.includes('antivirus')) {
      result.antivirus = qty;
      console.log('[EDIT] Antivirus restored:', qty);
      continue;
    }
    
    // Firewall - now supports quantity - match by code, name, or label
    if (code === 'firewall' || name.includes('firewall') || code.includes('pfsense') ||
        label.includes('firewall') || labelNormalized.includes('pfsense')) {
      result.firewall = qty > 0 ? qty : 1; // If qty not set, default to 1 for old boolean data
      console.log('[EDIT] Firewall restored: qty=' + result.firewall);
      continue;
    }
    
    // TSplus - match by code, name, or label
    if (code === 'tsplus' || name.includes('tsplus') || name.includes('ts plus') ||
        label.includes('tsplus') || labelNormalized.includes('tsplus')) {
      result.tsplus = qty;
      console.log('[EDIT] TSplus restored:', qty);
      continue;
    }
    
    // CAL - match by code, name, or label
    if (code === 'cal' || name === 'cal' || label === 'cal' || 
        name.includes('cal rds') || name.includes('ts-cal') ||
        labelNormalized === 'cal') {
      result.cal = qty;
      console.log('[EDIT] CAL restored:', qty);
      continue;
    }
    
    // Veeam VM - match by code, name, or label
    if (code === 'veeam_vm' || name.includes('veeam vm') || name.includes('veeam backup') ||
        label.includes('veeam vm') || labelNormalized.includes('veeam vm')) {
      result.veeamVm = qty;
      console.log('[EDIT] Veeam VM restored:', qty);
      continue;
    }
    
    // Veeam Agent - match by code, name, or label
    if (code === 'veeam_agent' || name.includes('veeam agent') ||
        label.includes('veeam agent') || labelNormalized.includes('veeam agent')) {
      result.veeamAg = qty;
      console.log('[EDIT] Veeam Agent restored:', qty);
      continue;
    }
    
    // SQL (WE removido - apenas WEB e STD per API spec)
    // Per OpenAPI spec: SQL addon requires quantity >= 1
    // API returns label like "STD" or "WEB" for SQL items (config_id 7)
    if (code?.startsWith('sql_') || name.includes('sql') || name.includes('licença sql') ||
        nameNormalized.includes('sql') || configId === 7 ||
        label === 'std' || label === 'web' || labelNormalized === 'std' || labelNormalized === 'web') {
      if (code?.includes('web') || name.includes('web') || label === 'web' || labelNormalized === 'web') {
        result.sql = 'web';
      } else if (code?.includes('std') || name.includes('std') || name.includes('standard') || 
                 label === 'std' || labelNormalized === 'std') {
        result.sql = 'std';
      }
      // Fallback: propostas antigas com WE mapeiam para WEB
      else if (code?.includes('we') || name.includes('we')) result.sql = 'web';
      // CRITICAL: Ensure at least qty 1 when SQL is selected (API requirement)
      result.sqlQty = qty > 0 ? qty : 1;
      console.log('[EDIT] SQL restored from addons[]: type=' + result.sql + ' qty=' + result.sqlQty);
      continue;
    }
  }
  
  // CRITICAL POST-PROCESSING: Enforce OpenAPI minimums
  // Per api-docs-29-jan-26.json: addons require quantity >= 1 when selected
  
  // If SQL type is selected but qty is 0, set to 1
  if (result.sql !== 'none' && result.sqlQty === 0) {
    result.sqlQty = 1;
    console.log('[EDIT] SQL qty was 0, enforced minimum=1 (OpenAPI requirement)');
  }
  // If backup plan is selected but GB is 0, set to 1
  if (result.backupPlan !== 'none' && result.backupGb === 0) {
    result.backupGb = 1;
    console.log('[EDIT] Backup GB was 0, enforced minimum=1 (OpenAPI requirement)');
  }
  
  console.log('[hydrateAddonsFromLegacy] Final result:', {
    winserver: result.winserver,
    sql: result.sql,
    sqlQty: result.sqlQty,
    backupPlan: result.backupPlan,
    backupGb: result.backupGb,
    antivirus: result.antivirus,
    firewall: result.firewall,
    support: result.support,
    consulting: result.consulting,
    dba: result.dba,
    cal: result.cal,
    tsplus: result.tsplus,
    veeamVm: result.veeamVm,
    veeamAg: result.veeamAg,
  });
  
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
  // Specialized services
  if (addons.support.level !== 'none') {
    console.log('[EDIT] restored from dados_proposta: support=' + JSON.stringify(addons.support));
  }
  if (addons.consulting.quantity > 0) {
    console.log('[EDIT] restored from dados_proposta: consulting=' + JSON.stringify(addons.consulting));
  }
  if (addons.dba.quantity > 0) {
    console.log('[EDIT] restored from dados_proposta: dba=' + JSON.stringify(addons.dba));
  }
}

// ============================================================================
// SERIALIZE TO API (for saving)
// ============================================================================

/**
 * Addon payload for API (v12+)
 * 
 * Per OpenAPI spec (CalculatorProposalStoreRequest):
 * - addons requires config_id and item_id (REQUIRED for priced items)
 * - Backend calculates price automatically from config
 * - DO NOT send price field - backend ignores it
 */
export interface ApiAddonPayload {
  config_id: number;      // REQUIRED: ID of the calculator config entry
  item_id: number;        // REQUIRED: ID of the item within the config
  quantity: number;       // REQUIRED: Quantity (defaults to 1)
}

/**
 * Server payload for API (v12+)
 * 
 * Per OpenAPI spec (CalculatorProposalStoreRequest):
 * - servers requires config_id, name, vcpu_item_id, ram_item_id, storage_item_id
 * - Backend calculates price automatically from config
 * - DO NOT send price field - backend ignores it
 */
export interface ApiServerPayload {
  config_id: number;        // REQUIRED: ID of the calculator config (VM category)
  name: string;             // REQUIRED: Server name for identification
  vcpu_item_id: number;     // REQUIRED: ID of the vCPU item in config
  vcpu: number;
  ram_item_id: number;      // REQUIRED: ID of the RAM item in config
  ram: number;
  storage_item_id: number;  // REQUIRED: ID of the storage item in config
  storage: number;
  quantity: number;
  gpu?: { model: string; quantity: number };
}

/**
 * Flexible payload types for internal use (before validation)
 * These allow undefined IDs which will be validated before serialization
 */
interface InternalAddonPayload {
  config_id?: number;
  item_id?: number;
  quantity: number;
}

interface InternalServerPayload {
  config_id?: number;
  name: string;
  vcpu_item_id?: number;
  vcpu: number;
  ram_item_id?: number;
  ram: number;
  storage_item_id?: number;
  storage: number;
  quantity: number;
  gpu?: { model: string; quantity: number };
}

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
  addons: InternalAddonPayload[];
  servers: InternalServerPayload[];
  due_at: string;
  proposal_status?: string;
  status?: string;
  dados_proposta: Record<string, unknown>;
}

/**
 * Validation result for serialization
 */
export interface SerializationValidation {
  isValid: boolean;
  errors: string[];
}

/**
 * Validates that all required config_id and item_id are present
 * before serialization. Returns errors if any IDs are missing.
 */
export function validateSerializationConfig(
  state: OpenCalculatorState,
  configIdStore?: {
    vm?: { configId: number; items: Record<string, number> } | null;
    addons?: { configId: number; items: Record<string, number> } | null;
    sqlServer?: { configId: number; items: Record<string, number> } | null;
    backup?: { configId: number; items: Record<string, number> } | null;
    specializedServices?: { configId: number; items: Record<string, number> } | null;
  } | null
): SerializationValidation {
  const errors: string[] = [];
  
  // Check if config IDs are loaded
  if (!configIdStore) {
    errors.push('Configuração de preços não carregada. Tente novamente.');
    return { isValid: false, errors };
  }
  
  // Check VM config if there are VM items
  const vmItems = state.items.filter(i => i.type === 'vm');
  if (vmItems.length > 0) {
    if (!configIdStore.vm?.configId) {
      errors.push('Configuração de VM não encontrada.');
    }
    if (!configIdStore.vm?.items?.['vCPU'] && !configIdStore.vm?.items?.['vcpu']) {
      errors.push('Item vCPU não encontrado na configuração.');
    }
    if (!configIdStore.vm?.items?.['RAM'] && !configIdStore.vm?.items?.['ram']) {
      errors.push('Item RAM não encontrado na configuração.');
    }
    if (!configIdStore.vm?.items?.['NVMe'] && !configIdStore.vm?.items?.['nvme']) {
      errors.push('Item NVMe não encontrado na configuração.');
    }
  }
  
  // Check addons config if there are addons
  const hasAddons = state.addons.winserver > 0 || 
    state.addons.antivirus > 0 || 
    state.addons.firewall > 0 ||
    state.addons.tsplus > 0 ||
    state.addons.cal > 0 ||
    state.addons.veeamVm > 0 ||
    state.addons.veeamAg > 0;
  
  if (hasAddons && !configIdStore.addons?.configId) {
    errors.push('Configuração de Add-ons não encontrada.');
  }
  
  // Check SQL config if SQL is selected
  if (state.addons.sql !== 'none' && !configIdStore.sqlServer?.configId) {
    errors.push('Configuração de SQL Server não encontrada.');
  }
  
  // Check Backup config if backup is selected
  if (state.addons.backupPlan !== 'none' && !configIdStore.backup?.configId) {
    errors.push('Configuração de Backup não encontrada.');
  }
  
  return { isValid: errors.length === 0, errors };
}

/**
 * Serializes the calculator state to API payload format.
 * 
 * CRITICAL: This is the ONLY function that should generate the save payload.
 * All items (WinServer, Backup, GPU) are explicitly serialized.
 * 
 * ARCHITECTURE CHANGE: Backend calculates prices from config_id + item_id.
 * Frontend does NOT send price fields - they are ignored by backend.
 * 
 * @param state - Calculator state
 * @param channelType - CLIENTE or PARCEIRO
 * @param grandTotal - Total value
 * @param discountPct - Discount percentage
 * @param configIdStore - REQUIRED: Config ID mappings for API
 */
export function serializeProposal(
  state: OpenCalculatorState,
  channelType: 'CLIENTE' | 'PARCEIRO',
  grandTotal: number,
  discountPct: number = 0,
  configIdStore: {
    vm?: { configId: number; items: Record<string, number> } | null;
    addons?: { configId: number; items: Record<string, number> } | null;
    sqlServer?: { configId: number; items: Record<string, number> } | null;
    backup?: { configId: number; items: Record<string, number> } | null;
    specializedServices?: { configId: number; items: Record<string, number> } | null;
  }
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
  
  // Helper to find item ID by label (with fuzzy matching)
  const findItemId = (
    mapping: { configId: number; items: Record<string, number> } | null | undefined,
    ...labels: string[]
  ): number | undefined => {
    if (!mapping) return undefined;
    for (const label of labels) {
      if (mapping.items[label] !== undefined) return mapping.items[label];
      // Try lowercase
      const lower = label.toLowerCase();
      if (mapping.items[lower] !== undefined) return mapping.items[lower];
      // Try normalized (remove accents)
      const normalized = lower.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '_');
      if (mapping.items[normalized] !== undefined) return mapping.items[normalized];
    }
    return undefined;
  };
  
  // ============================================
  // BUILD ADDONS ARRAY - Only include items with valid config_id and item_id
  // ARCHITECTURE: Backend calculates price from IDs, frontend sends no price
  // ============================================
  const addonsArray: InternalAddonPayload[] = [];
  
  // Get addons config IDs (guaranteed to exist since configIdStore is required)
  const addonsConfigId = configIdStore.addons?.configId ?? 0;
  const specializedConfigId = configIdStore.specializedServices?.configId ?? addonsConfigId;
  const sqlConfigId = configIdStore.sqlServer?.configId ?? 0;
  const backupConfigId = configIdStore.backup?.configId ?? 0;
  
  // Helper to safely add addon (only if IDs exist)
  const addAddon = (configId: number | undefined, itemId: number | undefined, qty: number, label: string) => {
    if (configId && itemId && qty > 0) {
      addonsArray.push({ config_id: configId, item_id: itemId, quantity: qty });
      console.log(`[serializeProposal] Added ${label}: qty=${qty}, config_id=${configId}, item_id=${itemId}`);
    } else {
      console.warn(`[serializeProposal] Skipping ${label}: missing config_id(${configId}) or item_id(${itemId})`);
    }
  };
  
  // Windows Server
  if (state.addons.winserver > 0) {
    const itemId = findItemId(configIdStore.addons, 'WinServer(2vCPU/unid.)', 'winserver_2vcpu_unit', 'Windows Server');
    addAddon(addonsConfigId, itemId, state.addons.winserver, 'WinServer');
  }
  
  // Support
  if (state.addons.support.level !== 'none') {
    const supportLabels: Record<string, string[]> = {
      'basic': ['support_basic', 'Suporte Básico'],
      'intermediate': ['support_intermediate', 'Suporte Intermediário'],
      'advanced': ['support_advanced', 'Suporte Avançado'],
    };
    const labels = supportLabels[state.addons.support.level] || supportLabels['basic'];
    const itemId = findItemId(configIdStore.specializedServices ?? configIdStore.addons, ...labels);
    addAddon(specializedConfigId, itemId, 1, `Support ${state.addons.support.level}`);
  }
  
  // Consultoria Técnica
  if (state.addons.consulting.quantity > 0) {
    const itemId = findItemId(configIdStore.specializedServices ?? configIdStore.addons, 'Consultoria Técnica', 'consulting_hours');
    addAddon(specializedConfigId, itemId, state.addons.consulting.quantity, 'Consulting');
  }
  
  // DBA
  if (state.addons.dba.quantity > 0) {
    const itemId = findItemId(configIdStore.specializedServices ?? configIdStore.addons, 'DBA', 'dba_hours');
    addAddon(specializedConfigId, itemId, state.addons.dba.quantity, 'DBA');
  }
  
  // Backup - ensure at least 1GB when plan selected
  if (state.addons.backupPlan !== 'none') {
    const backupGb = state.addons.backupGb > 0 ? state.addons.backupGb : 1;
    const itemId = findItemId(configIdStore.backup, `${state.addons.backupPlan} dias`, `backup_${state.addons.backupPlan}`, state.addons.backupPlan);
    addAddon(backupConfigId, itemId, backupGb, `Backup ${state.addons.backupPlan}d`);
  }
  
  // Antivirus
  if (state.addons.antivirus > 0) {
    const itemId = findItemId(configIdStore.addons, 'Antivírus', 'Antivirus', 'antivirus');
    addAddon(addonsConfigId, itemId, state.addons.antivirus, 'Antivirus');
  }
  
  // Firewall
  if (state.addons.firewall > 0) {
    const itemId = findItemId(configIdStore.addons, 'Firewall pfSense', 'Firewall (qtd)', 'firewall');
    addAddon(addonsConfigId, itemId, state.addons.firewall, 'Firewall');
  }
  
  // TSplus
  if (state.addons.tsplus > 0) {
    const itemId = findItemId(configIdStore.addons, 'TSplus', 'tsplus');
    addAddon(addonsConfigId, itemId, state.addons.tsplus, 'TSplus');
  }
  
  // CAL
  if (state.addons.cal > 0) {
    const itemId = findItemId(configIdStore.addons, 'CAL', 'cal');
    addAddon(addonsConfigId, itemId, state.addons.cal, 'CAL');
  }
  
  // Veeam VM
  if (state.addons.veeamVm > 0) {
    const itemId = findItemId(configIdStore.addons, 'Veeam VM', 'veeam_vm');
    addAddon(addonsConfigId, itemId, state.addons.veeamVm, 'Veeam VM');
  }
  
  // Veeam Agent
  if (state.addons.veeamAg > 0) {
    const itemId = findItemId(configIdStore.addons, 'Veeam Agent', 'veeam_agent');
    addAddon(addonsConfigId, itemId, state.addons.veeamAg, 'Veeam Agent');
  }
  
  // SQL - ensure at least qty 1 when type selected
  if (state.addons.sql !== 'none') {
    const edition = state.addons.sql.toUpperCase();
    const sqlQty = state.addons.sqlQty > 0 ? state.addons.sqlQty : 1;
    const sqlLabel = edition === 'WEB' ? 'WEB (2vCPU)' : 'STD (8vCPU)';
    const itemId = findItemId(configIdStore.sqlServer, sqlLabel, edition, `${edition} (2vCPU)`, `${edition} (8vCPU)`, `SQL ${edition}`);
    addAddon(sqlConfigId, itemId, sqlQty, `SQL ${edition}`);
  }
  
  // Log for debugging
  console.log('[serializeProposal] Addons built:', addonsArray.length, 'items');
  
  // NOTE: Storage, Kubernetes, OpenSaaS are stored in dados_proposta snapshot
  // Backend will calculate their prices from snapshot data
  
  // ============================================
  // BUILD SERVERS ARRAY - Backend calculates price from IDs
  // ============================================
  const serversArray: InternalServerPayload[] = [];
  
  // Get VM config IDs
  const vmConfigId = configIdStore.vm?.configId ?? 0;
  const vcpuItemId = findItemId(configIdStore.vm, 'vCPU', 'vcpu');
  const ramItemId = findItemId(configIdStore.vm, 'RAM', 'ram');
  const storageItemId = findItemId(configIdStore.vm, 'NVMe', 'nvme');

  for (const [idx, item] of state.items.entries()) {
    const hasGpu = typeof item.gpu === 'string' && item.gpu !== '' && item.gpu !== 'Sem GPU' && item.gpuQty > 0;
    const gpuObj = hasGpu ? { model: item.gpu, quantity: item.gpuQty } : undefined;

    if (hasGpu) {
      console.log(`[SERIALIZE] gpu.enabled=true model=${item.gpu} qty=${item.gpuQty}`);
    }

    if (item.type === 'vm') {
      // CRITICAL: Per OpenAPI spec, VMs MUST have vcpu >= 1 and ram >= 1
      const vcpuValue = Math.max(1, item.vcpu || 1);
      const ramValue = Math.max(1, item.ramGb || 1);
      
      if (item.vcpu < 1 || item.ramGb < 1) {
        console.warn(`[serializeProposal] VM #${idx + 1} had invalid values (vcpu=${item.vcpu}, ram=${item.ramGb}), enforced minimums`);
      }
      
      // VMs use VM config IDs
      serversArray.push({
        config_id: vmConfigId || undefined,
        name: `VM #${idx + 1}`,
        vcpu_item_id: vcpuItemId,
        vcpu: vcpuValue,
        ram_item_id: ramItemId,
        ram: ramValue,
        storage_item_id: storageItemId,
        storage: Math.round(item.nvmeTb * 1024),
        quantity: item.qtyServers,
        gpu: gpuObj,
      });
    } else if (item.type === 'bm') {
      // BareMetal - config IDs handled separately by backend
      serversArray.push({
        name: `BareMetal #${idx + 1}`,
        vcpu: 0,
        ram: 0,
        storage: 0,
        quantity: item.qtyServers,
        gpu: gpuObj,
      });
    }
  }
  
  // Add virtual servers for storage/k8s/saas if no real servers
  if (serversArray.length === 0) {
    if (state.storageItems.length > 0) {
      serversArray.push({
        name: `__VIRTUAL__STORAGE__:${JSON.stringify({ items: state.storageItems })}`,
        vcpu: 0, ram: 0, storage: 0, quantity: 1,
      });
    }
    if (state.kubernetes.enabled) {
      serversArray.push({
        name: `__VIRTUAL__KUBERNETES__:${JSON.stringify(state.kubernetes)}`,
        vcpu: 0, ram: 0, storage: 0, quantity: 1,
      });
    }
    if (state.openSaas.enabled && state.openSaas.users > 0) {
      serversArray.push({
        name: `__VIRTUAL__OPENSAAS__:${JSON.stringify(state.openSaas)}`,
        vcpu: 0, ram: 0, storage: 0, quantity: 1,
      });
    }
    
    // Fallback placeholder
    if (serversArray.length === 0) {
      serversArray.push({
        name: '__VIRTUAL__BUNDLE__:{}',
        vcpu: 0, ram: 0, storage: 0, quantity: 1,
      });
    }
  }
  
  console.log('[serializeProposal] Servers built:', serversArray.length, 'items');
  
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
    proposal_status: 'Rascunho',
    status: 'Rascunho',
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
