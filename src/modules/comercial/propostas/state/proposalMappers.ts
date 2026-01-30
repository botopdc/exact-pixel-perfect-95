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
      const name = toStr(server.name, '');
      const nameLower = name.toLowerCase();
      
      // ============================================
      // BAREMETAL DETECTION - CRITICAL FIX
      // 
      // Priority order:
      // 1. Check if name contains __BAREMETAL__ (serialized format)
      // 2. Check if server has explicit bmCpu/bmRam fields (dados_proposta format)
      // 3. FALLBACK to VM only if vcpu > 0 AND no BareMetal indicators
      // 
      // IMPORTANT: vcpu > 0 is NOT a reliable VM indicator because
      // BareMetals are sent with vcpu=1 (API minimum requirement)
      // ============================================
      
      const isEncodedBareMetal = name.startsWith('__BAREMETAL__:');
      const hasBaremetalFields = !!server.bmCpu || !!server.bmRam || 
        (Array.isArray(server.disks) && server.disks.length > 0 && server.disks[0]?.type);
      const isBareMetal = isEncodedBareMetal || hasBaremetalFields;
      
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
      
      // ============================================
      // BAREMETAL PARSING
      // ============================================
      if (isBareMetal) {
        let bmCpu = 'intel_xeon_e2136';
        let bmRam = 'ram_128gb';
        let bmDisks: DiskItemV2[] = [{ type: 'nvme_1tb', qty: 1, desc: '' }];
        let bmGpu = gpu;
        let bmGpuQty = gpuQty;
        
        // Parse from encoded name if present
        if (isEncodedBareMetal) {
          try {
            const jsonPart = name.substring('__BAREMETAL__:'.length);
            const bmPayload = JSON.parse(jsonPart);
            bmCpu = bmPayload.cpu || bmCpu;
            bmRam = bmPayload.ram || bmRam;
            if (Array.isArray(bmPayload.disks) && bmPayload.disks.length > 0) {
              bmDisks = bmPayload.disks.map((d: any) => ({
                type: toStr(d.type, 'nvme_1tb'),
                qty: toNum(d.qty, 1),
                desc: toStr(d.desc, ''),
              }));
            }
            // GPU from encoded payload
            if (bmPayload.gpu?.model) {
              bmGpu = bmPayload.gpu.model;
              bmGpuQty = bmPayload.gpu.quantity || 0;
            }
            console.log('[EDIT] BareMetal decoded from name:', { bmCpu, bmRam, disks: bmDisks.length });
          } catch (e) {
            console.warn('[EDIT] Failed to parse BareMetal JSON from name, using defaults');
          }
        } else {
          // Extract from server fields directly
          bmCpu = toStr(server.bmCpu || server.cpu || server.cpu_model, bmCpu);
          bmRam = toStr(server.bmRam || server.ram_tier, bmRam);
          if (Array.isArray(server.disks) && server.disks.length > 0) {
            bmDisks = server.disks.map((d: any) => ({
              type: toStr(d.type, 'nvme_1tb'),
              qty: toNum(d.qty, 1),
              desc: toStr(d.desc, ''),
            }));
          }
        }
        
        console.log(`[EDIT] BareMetal restored: cpu=${bmCpu} ram=${bmRam} disks=${JSON.stringify(bmDisks)} gpu=${bmGpu} gpuQty=${bmGpuQty}`);

        return {
          type: 'bm' as const,
          id,
          gpu: bmGpu,
          gpuQty: bmGpuQty,
          bmCpu,
          bmRam,
          disks: bmDisks,
          trafficTb: 5,
          ips: toNum(server.ips, 0),
          qtyServers: toNum(server.quantity, 1),
        } as BMItemV2;
      }
      
      // ============================================
      // VM PARSING (default case)
      // ============================================
      console.log(`[EDIT] VM restored: vcpu=${server.vcpu} ram=${server.ram} storage=${server.storage}`);

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
 * STRATEGY: The NEW FLAT API (Janeiro 2026) returns addons with:
 * - config_id: ID from calculator_configs table
 * - label: The item label from config
 * - quantity: Quantity
 * 
 * We match based on:
 * 1. config_id (direct match - most reliable)
 * 2. label (normalized fuzzy match)
 * 3. Legacy code/name fields (backward compatibility)
 */
function hydrateAddonsFromLegacy(addons: any[]): AddonsStateV2 {
  const result: AddonsStateV2 = { ...DEFAULT_ADDONS };
  
  // Helper to normalize strings for matching (lowercase, remove accents, trim)
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
  
  console.log('[hydrateAddonsFromLegacy] Processing', addons.length, 'addons');
  
  for (const addon of addons) {
    // CRITICAL: Skip if addon is null/undefined (can happen with sparse arrays)
    if (!addon || typeof addon !== 'object') continue;
    
    // Get all possible identifiers for matching
    const code = toStr(addon.code, '').toLowerCase().trim();
    const name = toStr(addon.name ?? addon.label, '').toLowerCase().trim();
    const label = toStr(addon.label, '').toLowerCase().trim();
    const labelNormalized = normalize(addon.label ?? '');
    const nameNormalized = normalize(addon.name ?? addon.label ?? '');
    const qty = toNum(addon.quantity ?? addon.qty, 1);
    const price = toNum(addon.price, 0);
    const configId = addon.config_id ?? addon.configId;
    
    console.log(`[hydrateAddonsFromLegacy] Processing addon:`, { 
      configId, label, qty, price 
    });
    
    // Skip if no identifier at all
    if (!code && !name && !label && configId === undefined) continue;
    
    // ============================================================
    // SQL Server (config_id 7) - CRITICAL: Match by config_id first
    // API returns labels like "WEB", "STD" (uppercase)
    // ============================================================
    if (configId === 7 || 
        code?.startsWith('sql_') || 
        name.includes('sql') || 
        labelNormalized.includes('sql') ||
        label === 'web' || label === 'std' ||
        labelNormalized === 'web' || labelNormalized === 'std') {
      if (label === 'web' || labelNormalized === 'web' || code?.includes('web') || name.includes('web')) {
        result.sql = 'web';
      } else if (label === 'std' || labelNormalized === 'std' || code?.includes('std') || name.includes('standard') || name.includes('std')) {
        result.sql = 'std';
      } else if (code?.includes('we') || name.includes('we')) {
        // Fallback: legacy WE maps to WEB
        result.sql = 'web';
      } else {
        // Default to std if config_id matches but no clear type
        result.sql = 'std';
      }
      result.sqlQty = qty > 0 ? qty : 1;
      console.log('[EDIT] SQL restored: type=' + result.sql + ' qty=' + result.sqlQty);
      continue;
    }
    
    // ============================================================
    // Serviços Especializados (config_id 16)
    // Labels: "Suporte Básico", "Suporte Intermediário", "Suporte Avançado",
    //         "Consultoria Técnica", "DBA"
    // ============================================================
    
    // Support - match by various patterns
    if (configId === 16 || 
        labelNormalized.includes('suporte') || 
        nameNormalized.includes('suporte') ||
        code.includes('support') ||
        label.includes('support')) {
      // Detect support level
      if (labelNormalized.includes('basico') || nameNormalized.includes('basico') || 
          code.includes('basic') || label.includes('basic')) {
        result.support.level = 'basic';
        result.support.price = price;
        console.log('[EDIT] Support restored: level=basic price=' + price);
        continue;
      } else if (labelNormalized.includes('intermediario') || nameNormalized.includes('intermediario') || 
                 code.includes('intermediate') || label.includes('intermediate')) {
        result.support.level = 'intermediate';
        result.support.price = price;
        console.log('[EDIT] Support restored: level=intermediate price=' + price);
        continue;
      } else if (labelNormalized.includes('avancado') || nameNormalized.includes('avancado') || 
                 code.includes('advanced') || label.includes('advanced')) {
        result.support.level = 'advanced';
        result.support.price = price;
        console.log('[EDIT] Support restored: level=advanced price=' + price);
        continue;
      }
    }
    
    // Consultoria Técnica
    if (labelNormalized.includes('consultoria') || 
        nameNormalized.includes('consultoria') ||
        code === 'consulting_hours' ||
        code === 'consulting') {
      result.consulting.quantity = qty;
      result.consulting.unitPrice = price > 0 ? Math.round(price / qty) : 200;
      console.log('[EDIT] Consulting restored: qty=' + qty + ' unitPrice=' + result.consulting.unitPrice);
      continue;
    }
    
    // DBA
    if (labelNormalized === 'dba' || 
        label === 'dba' || 
        nameNormalized === 'dba' ||
        code === 'dba_hours' ||
        code === 'dba') {
      result.dba.quantity = qty;
      result.dba.unitPrice = price > 0 ? Math.round(price / qty) : 250;
      console.log('[EDIT] DBA restored: qty=' + qty + ' unitPrice=' + result.dba.unitPrice);
      continue;
    }
    
    // ============================================================
    // Windows Server (config_id 17)
    // ============================================================
    if (configId === 17 ||
        code === 'winserver_2vcpu_unit' || 
        labelNormalized.includes('winserver') || 
        labelNormalized.includes('windows') ||
        nameNormalized.includes('winserver') ||
        nameNormalized.includes('windows')) {
      result.winserver = qty;
      console.log('[EDIT] WindowsServer units restored:', qty);
      continue;
    }
    
    // ============================================================
    // Backup (config_id 15) - by retention
    // Labels: "7 dias", "15 dias", "30 dias"
    // ============================================================
    if (configId === 15 ||
        labelNormalized.includes('backup') || 
        nameNormalized.includes('backup') ||
        code?.startsWith('backup_')) {
      // Extract retention days from label
      const planMatch = (label || name || code).match(/(\d+)/);
      if (planMatch) {
        const plan = planMatch[1];
        if (plan === '7' || plan === '15' || plan === '30') {
          result.backupPlan = plan as '7' | '15' | '30';
          result.backupGb = qty;
          console.log('[EDIT] Backup restored: plan=' + result.backupPlan + ' gb=' + result.backupGb);
          continue;
        }
      }
      // Default to 7 days if no clear plan
      if (result.backupPlan === 'none') {
        result.backupPlan = '7';
        result.backupGb = qty;
        console.log('[EDIT] Backup restored (default): plan=7 gb=' + qty);
      }
      continue;
    }
    
    // ============================================================
    // Standard Add-ons (config_id 6)
    // ============================================================
    
    // Antivirus
    if (code === 'antivirus' || 
        labelNormalized.includes('antivirus') || 
        nameNormalized.includes('antivirus')) {
      result.antivirus = qty;
      console.log('[EDIT] Antivirus restored:', qty);
      continue;
    }
    
    // Firewall
    if (code === 'firewall' || code.includes('pfsense') ||
        labelNormalized.includes('firewall') || 
        labelNormalized.includes('pfsense') ||
        nameNormalized.includes('firewall')) {
      result.firewall = qty > 0 ? qty : 1;
      console.log('[EDIT] Firewall restored: qty=' + result.firewall);
      continue;
    }
    
    // TSplus
    if (code === 'tsplus' || 
        labelNormalized.includes('tsplus') || 
        nameNormalized.includes('tsplus') ||
        nameNormalized.includes('ts plus')) {
      result.tsplus = qty;
      console.log('[EDIT] TSplus restored:', qty);
      continue;
    }
    
    // CAL
    if (code === 'cal' || 
        label === 'cal' || 
        labelNormalized === 'cal' ||
        nameNormalized.includes('cal rds') || 
        nameNormalized.includes('ts-cal')) {
      result.cal = qty;
      console.log('[EDIT] CAL restored:', qty);
      continue;
    }
    
    // Veeam VM
    if (code === 'veeam_vm' || 
        labelNormalized.includes('veeam vm') || 
        nameNormalized.includes('veeam vm') ||
        (labelNormalized.includes('veeam') && !labelNormalized.includes('agent'))) {
      result.veeamVm = qty;
      console.log('[EDIT] Veeam VM restored:', qty);
      continue;
    }
    
    // Veeam Agent
    if (code === 'veeam_agent' || 
        labelNormalized.includes('veeam agent') || 
        nameNormalized.includes('veeam agent')) {
      result.veeamAg = qty;
      console.log('[EDIT] Veeam Agent restored:', qty);
      continue;
    }
    
    // Unknown addon - log for debugging
    console.warn('[hydrateAddonsFromLegacy] Unknown addon not mapped:', { configId, label, qty });
  }
  
  // ============================================================
  // POST-PROCESSING: Enforce OpenAPI minimums
  // ============================================================
  
  // If SQL type is selected but qty is 0, set to 1
  if (result.sql !== 'none' && result.sqlQty === 0) {
    result.sqlQty = 1;
    console.log('[EDIT] SQL qty was 0, enforced minimum=1');
  }
  // If backup plan is selected but GB is 0, set to 1
  if (result.backupPlan !== 'none' && result.backupGb === 0) {
    result.backupGb = 1;
    console.log('[EDIT] Backup GB was 0, enforced minimum=1');
  }
  
  console.log('[hydrateAddonsFromLegacy] Final result:', {
    sql: result.sql, sqlQty: result.sqlQty,
    backupPlan: result.backupPlan, backupGb: result.backupGb,
    winserver: result.winserver, antivirus: result.antivirus,
    firewall: result.firewall, tsplus: result.tsplus, cal: result.cal,
    veeamVm: result.veeamVm, veeamAg: result.veeamAg,
    support: result.support, consulting: result.consulting, dba: result.dba,
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
 * Server spec payload for API (January 2026 FLAT structure)
 * 
 * Per OpenAPI spec (CalculatorProposalStoreRequest):
 * - Each spec has config_id (ID from calculator_configs table) and value
 * - Backend calculates price: spec.value × config.value
 */
export interface ApiServerSpec {
  config_id: number;      // REQUIRED: ID do item no calculator_configs
  value: number;          // REQUIRED: Quantidade/valor para essa spec
}

/**
 * Addon payload for API (January 2026 FLAT structure)
 * 
 * Per OpenAPI spec:
 * - addons requires only config_id and quantity
 * - Backend busca label e price do config pelo ID
 * - Backend calcula: config.value × quantity
 */
export interface ApiAddonPayload {
  config_id: number;      // REQUIRED: ID do item no calculator_configs
  quantity: number;       // REQUIRED: Quantidade (padrão: 1, min: 1)
}

/**
 * Server payload for API (January 2026 FLAT structure)
 * 
 * Per OpenAPI spec (CalculatorProposalStoreRequest):
 * - servers requires name, specs[], and optional quantity
 * - specs[] is array of {config_id, value}
 * - Backend busca cada config e calcula preço
 */
export interface ApiServerPayload {
  name: string;             // REQUIRED: Nome do servidor
  specs: ApiServerSpec[];   // REQUIRED: Array de specs (min 1)
  quantity?: number;        // OPTIONAL: Quantidade (padrão: 1)
}

/**
 * Internal payload types for building
 */
interface InternalAddonPayload {
  config_id: number;
  quantity: number;
  label?: string;       // For debugging/display only
}

interface InternalServerPayload {
  name: string;
  specs: ApiServerSpec[];
  quantity: number;
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
 * Raw item from API for section-based lookups
 */
export interface FlatConfigRawItem {
  id: number;
  label: string;
  value: number;
  meta?: { category?: string; section?: string };
}

/**
 * Store for config_id lookups (simplified for flat structure)
 */
export interface FlatConfigStore {
  // All configs indexed by ID
  byId: Map<number, { id: number; label: string; value: number; category: string; section?: string }>;
  // Configs by category → label → id
  byCategoryLabel: Map<string, Map<string, number>>;
  // Configs by section → label → id (for items like "Serviços Especializados")
  bySectionLabel: Map<string, Map<string, number>>;
  // Raw items for advanced searches
  rawItems: FlatConfigRawItem[];
}

/**
 * Build a flat config store from API items
 */
export function buildFlatConfigStore(
  items: Array<{ id: number; label: string; value: number; meta?: { category?: string; section?: string } }>
): FlatConfigStore {
  const store: FlatConfigStore = {
    byId: new Map(),
    byCategoryLabel: new Map(),
    bySectionLabel: new Map(),
    rawItems: items.map(i => ({ id: i.id, label: i.label, value: i.value, meta: i.meta })),
  };
  
  for (const item of items) {
    const category = item.meta?.category || 'Unknown';
    const section = item.meta?.section || '';
    
    store.byId.set(item.id, {
      id: item.id,
      label: item.label,
      value: item.value,
      category,
      section,
    });
    
    // Index by category
    if (!store.byCategoryLabel.has(category)) {
      store.byCategoryLabel.set(category, new Map());
    }
    const categoryMap = store.byCategoryLabel.get(category)!;
    categoryMap.set(item.label, item.id);
    const normalizedLabel = item.label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '_');
    categoryMap.set(normalizedLabel, item.id);
    
    // Index by section (for items like "Serviços Especializados" that are sections within "Add-ons")
    if (section) {
      if (!store.bySectionLabel.has(section)) {
        store.bySectionLabel.set(section, new Map());
      }
      const sectionMap = store.bySectionLabel.get(section)!;
      sectionMap.set(item.label, item.id);
      sectionMap.set(normalizedLabel, item.id);
    }
  }
  
  // Log categories and sections found
  console.log('[buildFlatConfigStore] Categories found:', Array.from(store.byCategoryLabel.keys()));
  console.log('[buildFlatConfigStore] Sections found:', Array.from(store.bySectionLabel.keys()));
  
  return store;
}

/**
 * Find config_id by label in a category
 * Enhanced: Also searches by section when category lookup fails
 */
function findConfigId(
  store: FlatConfigStore,
  category: string,
  ...labels: string[]
): number | undefined {
  // Try direct category lookup first
  const categoryMap = store.byCategoryLabel.get(category);
  if (categoryMap) {
    for (const label of labels) {
      if (categoryMap.has(label)) return categoryMap.get(label);
      const normalized = label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '_');
      if (categoryMap.has(normalized)) return categoryMap.get(normalized);
    }
  }
  
  // Try section-based lookup (for items like "Serviços Especializados" which might be a section in "Add-ons")
  const sectionMap = store.bySectionLabel.get(category);
  if (sectionMap) {
    for (const label of labels) {
      if (sectionMap.has(label)) return sectionMap.get(label);
      const normalized = label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '_');
      if (sectionMap.has(normalized)) return sectionMap.get(normalized);
    }
  }
  
  // Fallback: search raw items for flexible matching
  for (const item of store.rawItems) {
    const itemSection = item.meta?.section;
    const itemCategory = item.meta?.category;
    
    // Check if section or category matches our search parameter
    if (itemSection === category || itemCategory === category) {
      for (const label of labels) {
        const normalizedItem = item.label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '_');
        const normalizedSearch = label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '_');
        
        if (item.label === label || normalizedItem === normalizedSearch || 
            item.label.toLowerCase().includes(label.toLowerCase()) || label.toLowerCase().includes(item.label.toLowerCase())) {
          return item.id;
        }
      }
    }
  }
  
  return undefined;
}

/**
 * Validates that all required config_id are present before serialization.
 */
export function validateSerializationConfig(
  state: OpenCalculatorState,
  configStore?: FlatConfigStore | null
): SerializationValidation {
  const errors: string[] = [];
  
  if (!configStore) {
    errors.push('Configuração de preços não carregada. Tente novamente.');
    return { isValid: false, errors };
  }
  
  // Check VM config if there are VM items
  const vmItems = state.items.filter(i => i.type === 'vm');
  if (vmItems.length > 0) {
    const vcpuId = findConfigId(configStore, 'VM', 'vCPU', 'vcpu');
    const ramId = findConfigId(configStore, 'VM', 'RAM', 'ram');
    const storageId = findConfigId(configStore, 'VM', 'NVMe', 'nvme');
    
    if (!vcpuId) errors.push('Config vCPU não encontrado.');
    if (!ramId) errors.push('Config RAM não encontrado.');
    if (!storageId) errors.push('Config NVMe não encontrado.');
  }
  
  return { isValid: errors.length === 0, errors };
}

/**
 * Serializes the calculator state to API payload format.
 * 
 * ARCHITECTURE (January 2026 - FLAT structure):
 * - Servers use specs[]: array of { config_id, value }
 * - Addons use { config_id, quantity }
 * - Backend calculates all prices from config_id
 * 
 * @param state - Calculator state
 * @param channelType - CLIENTE or PARCEIRO
 * @param grandTotal - Total value
 * @param discountPct - Discount percentage
 * @param configStore - REQUIRED: Flat config store with config_id mappings
 */
export function serializeProposal(
  state: OpenCalculatorState,
  channelType: 'CLIENTE' | 'PARCEIRO',
  grandTotal: number,
  discountPct: number = 0,
  configStore: FlatConfigStore
): ApiProposalPayload {
  console.log('[serializeProposal] Serializing state for save (FLAT structure)...');
  
  // ========== ADDON AUDIT LOG ==========
  console.log('[serializeProposal] ===== ADDON AUDIT START =====');
  console.log('[serializeProposal] State addons:', JSON.stringify({
    winserver: state.addons.winserver,
    support: state.addons.support,
    consulting: state.addons.consulting,
    dba: state.addons.dba,
    backupPlan: state.addons.backupPlan,
    backupGb: state.addons.backupGb,
    antivirus: state.addons.antivirus,
    firewall: state.addons.firewall,
    tsplus: state.addons.tsplus,
    cal: state.addons.cal,
    veeamVm: state.addons.veeamVm,
    veeamAg: state.addons.veeamAg,
    sql: state.addons.sql,
    sqlQty: state.addons.sqlQty,
  }, null, 2));
  
  // Log available configs per category for debugging
  console.log('[serializeProposal] Available categories:', Array.from(configStore.byCategoryLabel.keys()));
  console.log('[serializeProposal] Available sections:', Array.from(configStore.bySectionLabel.keys()));
  
  // Log specific categories for debugging
  const addonsCategory = configStore.byCategoryLabel.get('Add-ons');
  if (addonsCategory) {
    console.log('[serializeProposal] Add-ons category items:', Array.from(addonsCategory.keys()).slice(0, 30));
  }
  const servicosSection = configStore.bySectionLabel.get('Serviços Especializados');
  if (servicosSection) {
    console.log('[serializeProposal] Serviços Especializados section items:', Array.from(servicosSection.keys()));
  }
  console.log('[serializeProposal] ===== ADDON AUDIT END =====');
  // ========================================
  
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
  // BUILD ADDONS ARRAY - Per new OpenAPI spec: { config_id, quantity }
  // Backend calculates price from config_id
  // ============================================
  const addonsArray: InternalAddonPayload[] = [];
  const addonAudit: { name: string; found: boolean; configId?: number }[] = [];
  
  // Helper to safely add addon
  const addAddon = (configId: number | undefined, qty: number, label: string) => {
    addonAudit.push({ name: label, found: !!configId, configId });
    if (qty <= 0 || !configId) {
      if (!configId && qty > 0) console.warn(`[serializeProposal] ⚠️ MISSING CONFIG_ID for ${label} (qty=${qty})`);
      return;
    }
    addonsArray.push({ config_id: configId, quantity: qty, label });
    console.log(`[serializeProposal] ✅ Added ${label}: qty=${qty}, config_id=${configId}`);
  };
  
  // Windows Server
  if (state.addons.winserver > 0) {
    const configId = findConfigId(configStore, 'Add-ons', 'WinServer(2vCPU/unid.)', 'Windows Server', 'WinServer');
    addAddon(configId, state.addons.winserver, 'WinServer');
  }
  
  // Support (Serviços Especializados - may be category or section)
  if (state.addons.support.level !== 'none') {
    const supportLabels: Record<string, string[]> = {
      'basic': ['Suporte Básico', 'Suporte Basico', 'Suporte (Básico)', 'Suporte (Basico)', 'support_basic', 'suporte_basico'],
      'intermediate': ['Suporte Intermediário', 'Suporte Intermediario', 'Suporte (Intermediário)', 'support_intermediate', 'suporte_intermediario'],
      'advanced': ['Suporte Avançado', 'Suporte Avancado', 'Suporte (Avançado)', 'support_advanced', 'suporte_avancado'],
    };
    const labels = supportLabels[state.addons.support.level] || supportLabels['basic'];
    // Try multiple categories/sections for specialized services
    let configId = findConfigId(configStore, 'Serviços Especializados', ...labels);
    if (!configId) configId = findConfigId(configStore, 'Add-ons', ...labels);
    if (!configId) configId = findConfigId(configStore, 'Geral', ...labels);
    addAddon(configId, 1, `Support ${state.addons.support.level}`);
  }
  
  // Consultoria Técnica (Serviços Especializados - may be category or section)
  if (state.addons.consulting.quantity > 0) {
    const consultingLabels = [
      'Consultoria Técnica', 'Consultoria Tecnica', 'Consultoria Técnica (horas)', 'Consultoria',
      'consulting', 'consultoria_tecnica', 'Consultoria (horas)', 'Horas de Consultoria'
    ];
    let configId = findConfigId(configStore, 'Serviços Especializados', ...consultingLabels);
    if (!configId) configId = findConfigId(configStore, 'Add-ons', ...consultingLabels);
    if (!configId) configId = findConfigId(configStore, 'Geral', ...consultingLabels);
    addAddon(configId, state.addons.consulting.quantity, 'Consulting');
  }
  
  // DBA (Serviços Especializados - may be category or section)
  if (state.addons.dba.quantity > 0) {
    const dbaLabels = [
      'DBA', 'DBA (horas)', 'Horas de DBA', 'dba', 'DBA Remoto', 'DBA as a Service'
    ];
    let configId = findConfigId(configStore, 'Serviços Especializados', ...dbaLabels);
    if (!configId) configId = findConfigId(configStore, 'Add-ons', ...dbaLabels);
    if (!configId) configId = findConfigId(configStore, 'Geral', ...dbaLabels);
    addAddon(configId, state.addons.dba.quantity, 'DBA');
  }
  
  // Backup
  if (state.addons.backupPlan !== 'none') {
    const backupGb = state.addons.backupGb > 0 ? state.addons.backupGb : 1;
    const configId = findConfigId(configStore, 'Backup', `${state.addons.backupPlan} dias`, `backup_${state.addons.backupPlan}`);
    addAddon(configId, backupGb, `Backup ${state.addons.backupPlan}d`);
  }
  
  // Antivirus
  if (state.addons.antivirus > 0) {
    const configId = findConfigId(configStore, 'Add-ons', 'Antivírus', 'Antivirus');
    addAddon(configId, state.addons.antivirus, 'Antivirus');
  }
  
  // Firewall
  if (state.addons.firewall > 0) {
    const configId = findConfigId(configStore, 'Add-ons', 'Firewall pfSense', 'Firewall (qtd)', 'Firewall');
    addAddon(configId, state.addons.firewall, 'Firewall');
  }
  
  // TSplus
  if (state.addons.tsplus > 0) {
    const configId = findConfigId(configStore, 'Add-ons', 'TSplus');
    addAddon(configId, state.addons.tsplus, 'TSplus');
  }
  
  // CAL
  if (state.addons.cal > 0) {
    const configId = findConfigId(configStore, 'Add-ons', 'CAL');
    addAddon(configId, state.addons.cal, 'CAL');
  }
  
  // Veeam VM
  if (state.addons.veeamVm > 0) {
    const configId = findConfigId(configStore, 'Add-ons', 'Veeam VM', 'Veeam Backup (VM)');
    addAddon(configId, state.addons.veeamVm, 'Veeam VM');
  }
  
  // Veeam Agent
  if (state.addons.veeamAg > 0) {
    const configId = findConfigId(configStore, 'Add-ons', 'Veeam Agent');
    addAddon(configId, state.addons.veeamAg, 'Veeam Agent');
  }
  
  // SQL
  if (state.addons.sql !== 'none') {
    const edition = state.addons.sql.toUpperCase();
    const sqlQty = state.addons.sqlQty > 0 ? state.addons.sqlQty : 1;
    const sqlLabel = edition === 'WEB' ? 'WEB (2vCPU)' : 'STD (8vCPU)';
    const configId = findConfigId(configStore, 'SQL Server', sqlLabel, edition);
    addAddon(configId, sqlQty, `SQL ${edition}`);
  }
  
  // Log final addon audit
  console.log('[serializeProposal] ===== ADDON AUDIT RESULT =====');
  console.log('[serializeProposal] Addons built:', addonsArray.length, 'items');
  console.log('[serializeProposal] Addon audit:', JSON.stringify(addonAudit, null, 2));
  const missingAddons = addonAudit.filter(a => !a.found);
  if (missingAddons.length > 0) {
    console.warn('[serializeProposal] ⚠️ MISSING ADDONS:', missingAddons.map(a => a.name).join(', '));
  }
  console.log('[serializeProposal] ===== ADDON AUDIT RESULT END =====');

  // ============================================
  // BUILD SERVERS ARRAY - Per new OpenAPI spec: { name, specs[], quantity }
  // specs[] is array of { config_id, value }
  // ============================================
  const serversArray: InternalServerPayload[] = [];
  
  // Get VM config IDs
  const vcpuConfigId = findConfigId(configStore, 'VM', 'vCPU', 'vcpu');
  const ramConfigId = findConfigId(configStore, 'VM', 'RAM', 'ram');
  const storageConfigId = findConfigId(configStore, 'VM', 'NVMe', 'nvme');
  const ipConfigId = findConfigId(configStore, 'VM', 'IP Público', 'IP');
  
  console.log('[serializeProposal] VM Config IDs:', { vcpuConfigId, ramConfigId, storageConfigId, ipConfigId });
  
  for (const [idx, item] of state.items.entries()) {
    if (item.type === 'vm') {
      const specs: ApiServerSpec[] = [];
      
      // vCPU (minimum 1)
      if (vcpuConfigId) {
        specs.push({ config_id: vcpuConfigId, value: Math.max(1, item.vcpu || 1) });
      }
      
      // RAM (minimum 1)
      if (ramConfigId) {
        specs.push({ config_id: ramConfigId, value: Math.max(1, item.ramGb || 1) });
      }
      
      // Storage (NVMe in GB)
      if (storageConfigId) {
        const storageGb = Math.round((item.nvmeTb || 0) * 1024);
        specs.push({ config_id: storageConfigId, value: Math.max(0, storageGb) });
      }
      
      // IP if configured
      if (ipConfigId && item.ips > 0) {
        specs.push({ config_id: ipConfigId, value: item.ips });
      }
      
      // GPU as addon (if present)
      if (item.gpu && item.gpu !== 'Sem GPU' && item.gpuQty > 0) {
        const gpuConfigId = findConfigId(configStore, 'GPU', item.gpu);
        if (gpuConfigId) {
          addonsArray.push({
            config_id: gpuConfigId,
            quantity: item.gpuQty * Math.max(1, item.qtyServers || 1),
            label: `GPU: ${item.gpu}`,
          });
          console.log(`[serializeProposal] Added VM GPU: ${item.gpu}, qty=${item.gpuQty}`);
        }
      }
      
      if (specs.length > 0) {
        serversArray.push({
          name: `VM #${idx + 1}`,
          specs,
          quantity: Math.max(1, item.qtyServers || 1),
        });
      }
      
    } else if (item.type === 'bm') {
      // ============================================
      // BAREMETAL: Serialized as addons per new OpenAPI spec
      // Each component (CPU, RAM, Disk) is a separate addon
      // ============================================
      const bmCpuModel = item.bmCpu || 'intel_xeon_e2136';
      const bmRamTier = item.bmRam || 'ram_128gb';
      const bmDisks = Array.isArray(item.disks) ? item.disks : [{ type: 'nvme_1tb', qty: 1, desc: '' }];
      const qtyServers = Math.max(1, item.qtyServers || 1);
      
      // CPU as addon
      const cpuConfigId = findConfigId(configStore, 'BareMetal', bmCpuModel);
      if (cpuConfigId) {
        addonsArray.push({ config_id: cpuConfigId, quantity: qtyServers, label: `BM CPU: ${bmCpuModel}` });
      }
      
      // RAM as addon
      const ramBmConfigId = findConfigId(configStore, 'BareMetal', bmRamTier);
      if (ramBmConfigId) {
        addonsArray.push({ config_id: ramBmConfigId, quantity: qtyServers, label: `BM RAM: ${bmRamTier}` });
      }
      
      // Disks as addons (aggregated by type)
      const disksByType = new Map<string, number>();
      for (const disk of bmDisks) {
        const diskType = disk.type || 'nvme_1tb';
        const diskQty = (disk.qty || 1) * qtyServers;
        disksByType.set(diskType, (disksByType.get(diskType) || 0) + diskQty);
      }
      
      for (const [diskType, totalQty] of disksByType) {
        const diskConfigId = findConfigId(configStore, 'BareMetal', diskType);
        if (diskConfigId) {
          addonsArray.push({ config_id: diskConfigId, quantity: totalQty, label: `BM Disk: ${diskType}` });
        }
      }
      
      // GPU for BareMetal
      if (item.gpu && item.gpu !== 'Sem GPU' && item.gpuQty > 0) {
        const gpuConfigId = findConfigId(configStore, 'GPU', item.gpu);
        if (gpuConfigId) {
          addonsArray.push({
            config_id: gpuConfigId,
            quantity: item.gpuQty * qtyServers,
            label: `BM GPU: ${item.gpu}`,
          });
        }
      }
      
      console.log(`[serializeProposal] BareMetal #${idx + 1} serialized as addons`);
    }
  }
  
  // Add virtual server if no real servers (for K8s, Storage, SaaS only proposals)
  if (serversArray.length === 0 && vcpuConfigId && ramConfigId && storageConfigId) {
    const virtualPayload: Record<string, unknown> = {};
    
    if (state.storageItems.length > 0) virtualPayload.storage = state.storageItems;
    if (state.kubernetes.enabled) virtualPayload.kubernetes = state.kubernetes;
    if (state.openSaas.enabled && state.openSaas.users > 0) virtualPayload.openSaas = state.openSaas;
    
    serversArray.push({
      name: `__VIRTUAL__BUNDLE__:${JSON.stringify(virtualPayload)}`,
      specs: [
        { config_id: vcpuConfigId, value: 1 },
        { config_id: ramConfigId, value: 1 },
        { config_id: storageConfigId, value: 0 },
      ],
      quantity: 1,
    });
  }
  
  console.log('[serializeProposal] Servers built:', serversArray.length, 'items');
  
  // ============================================
  // BUILD dados_proposta SNAPSHOT
  // ============================================
  const dadosProposta = {
    proposalId: state.meta.proposalDisplayId,
    fx: 1,
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
    fx: 1,
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
