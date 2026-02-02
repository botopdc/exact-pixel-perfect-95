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
  // CRITICAL: We use apiProposal.servers as the source of truth
  // Priority: API server specs[] > dados_proposta.items (snapshot)
  // ============================================
  if (Array.isArray(apiProposal.servers) && (apiProposal.servers as any[]).length > 0) {
    const apiServers = apiProposal.servers as any[];
    const snapshotItems = hasDadosProposta && Array.isArray((dadosProposta as any).items) 
      ? (dadosProposta as any).items 
      : [];
    
    state.items = apiServers
      .filter(s => {
        const name = toStr(s.name, '').toLowerCase();
        return !name.startsWith('__virtual__') && !name.startsWith('virtual_product');
      })
      .map((apiServer, idx) => {
        // Find matching snapshot item by index or name (for fallback)
        const snapshotItem = snapshotItems[idx] || snapshotItems.find((si: any) => 
          toStr(si.name, '').toLowerCase() === toStr(apiServer.name, '').toLowerCase()
        );
        
        // CRITICAL: Use type from API as the PRIMARY source
        const apiType = toStr(apiServer.type, '').toLowerCase();
        const isBM = apiType === 'bm' || apiType === 'baremetal';
        
        console.log(`[HYDRATE] Server #${idx} name="${apiServer.name}" apiType="${apiType}" → isBM=${isBM}`);
        
        // Parse specs[] array for custom fields
        const specsArray = Array.isArray(apiServer.specs) ? apiServer.specs : [];
        
        // Helper to find custom spec by key
        const findCustomSpec = (key: string): any => {
          return specsArray.find((s: any) => s.key === key);
        };
        
        // ============================================
        // GPU: Priority - specs[] custom keys > snapshot
        // ============================================
        let gpu = 'Sem GPU';
        let gpuQty = 0;
        
        const gpuModelSpec = findCustomSpec('gpu_model');
        const gpuQtySpec = findCustomSpec('gpu_qty');
        
        if (gpuModelSpec?.string_value) {
          gpu = gpuModelSpec.string_value;
          gpuQty = gpuQtySpec?.value || toNum(gpuQtySpec?.value, 1);
          console.log(`[HYDRATE] Server #${idx} GPU from specs[]: model="${gpu}" qty=${gpuQty}`);
        } else if (snapshotItem?.gpu) {
          gpu = typeof snapshotItem.gpu === 'string' ? snapshotItem.gpu : 'Sem GPU';
          gpuQty = toNum(snapshotItem.gpuQty, 0);
          console.log(`[HYDRATE] Server #${idx} GPU from snapshot: model="${gpu}" qty=${gpuQty}`);
        }
        
        // ============================================
        // IPs: Priority - specs[] with config_id matching IP > snapshot
        // ============================================
        let ips = 1;
        const ipSpec = specsArray.find((s: any) => 
          toStr(s.label, '').toLowerCase().includes('ip') || 
          (s.config_id && !s.key) // Assume numeric spec without key could be IP
        );
        if (typeof apiServer.ips === 'number') {
          ips = apiServer.ips;
        } else if (ipSpec) {
          ips = toNum(ipSpec.value, 1);
        } else {
          ips = toNum(snapshotItem?.ips, 1);
        }
        
        const id = snapshotItem?.id || crypto.randomUUID();
        
        if (isBM) {
          // ============================================
          // BareMetal: Priority - specs[] custom keys > snapshot
          // ============================================
          const bmCpuSpec = findCustomSpec('bm_cpu');
          const bmRamSpec = findCustomSpec('bm_ram');
          const bmDisksSpec = findCustomSpec('bm_disks');
          
          const bmCpu = bmCpuSpec?.string_value || toStr(snapshotItem?.bmCpu, '2x Intel Xeon E5-2680v4 28c/56t 2.4GHz/3.3GHz - Disponível');
          const bmRam = bmRamSpec?.string_value || toStr(snapshotItem?.bmRam, '128GB');
          
          // Disks: parse from json_value or fallback to snapshot
          let disks: DiskItemV2[] = [];
          if (bmDisksSpec?.json_value) {
            disks = hydrateDisks(bmDisksSpec.json_value);
            console.log(`[HYDRATE] BareMetal #${idx} disks from specs[]: ${JSON.stringify(disks)}`);
          } else if (snapshotItem?.disks) {
            disks = hydrateDisks(snapshotItem.disks);
            console.log(`[HYDRATE] BareMetal #${idx} disks from snapshot: ${JSON.stringify(disks)}`);
          }
          
          console.log(`[HYDRATE] BareMetal #${idx}: bmCpu="${bmCpu}" bmRam="${bmRam}" disks=${disks.length}`);
          
          return {
            type: 'bm' as const,
            id,
            gpu,
            gpuQty,
            bmCpu,
            bmRam,
            disks,
            trafficTb: toNum(snapshotItem?.trafficTb, 5),
            ips,
            qtyServers: toNum(apiServer.quantity, 1),
          } as BMItemV2;
        }
        
        // ============================================
        // VM: Priority - specs[] with config_id > snapshot
        // ============================================
        let vcpu = 16;
        let ramGb = 128;
        let nvmeGb = 100;
        
        // Extract from specs[] array
        const vcpuSpec = specsArray.find((s: any) => 
          toStr(s.label, '').toLowerCase().includes('vcpu') || 
          toStr(s.label, '').toLowerCase().includes('cpu')
        );
        const ramSpec = specsArray.find((s: any) => 
          toStr(s.label, '').toLowerCase().includes('ram')
        );
        const nvmeSpec = specsArray.find((s: any) => 
          toStr(s.label, '').toLowerCase().includes('nvme') || 
          toStr(s.label, '').toLowerCase().includes('disco')
        );
        
        vcpu = vcpuSpec ? toNum(vcpuSpec.value, snapshotItem?.vcpu ?? 16) : toNum(snapshotItem?.vcpu, 16);
        ramGb = ramSpec ? toNum(ramSpec.value, snapshotItem?.ramGb ?? 128) : toNum(snapshotItem?.ramGb, 128);
        nvmeGb = nvmeSpec ? toNum(nvmeSpec.value, snapshotItem?.nvmeTb ? snapshotItem.nvmeTb * 1024 : 100) 
                         : (snapshotItem?.nvmeTb ? snapshotItem.nvmeTb * 1024 : 100);
        
        console.log(`[HYDRATE] VM #${idx}: vcpu=${vcpu} ramGb=${ramGb} nvmeGb=${nvmeGb} gpu="${gpu}" gpuQty=${gpuQty}`);
        
        return {
          type: 'vm' as const,
          id,
          gpu,
          gpuQty,
          vcpu,
          ramGb,
          nvmeTb: nvmeGb / 1024, // Convert GB to TB
          trafficTb: toNum(snapshotItem?.trafficTb, 5),
          ips,
          qtyServers: toNum(apiServer.quantity, 1),
        } as VMItemV2;
      });
  } else if (hasDadosProposta && Array.isArray((dadosProposta as any).items)) {
    // FALLBACK: Use snapshot items only if no API servers available
    state.items = hydrateServerItems((dadosProposta as any).items);
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
    
    // CRITICAL: Preserve IPs - value can be 0 which is valid
    const ips = typeof item.ips === 'number' ? item.ips : toNum(item.ips, 1);
    
    // Log GPU restoration
    if (gpu !== 'Sem GPU' && gpuQty > 0) {
      console.log('[EDIT] GPU restored on server ID=', id, ':', { gpu, gpuQty });
    }
    
    // Log IPs restoration
    console.log('[EDIT] IPs restored on server ID=', id, ':', ips);
    
    // CRITICAL: Use 'type' field as PRIMARY source for server type detection
    // Supported types: 'vm', 'bm', 'baremetal', 'kubernetes', 'storage', 'opensaas'
    const serverType = toStr(item.type, '').toLowerCase();
    
    // Check for BareMetal - type field is the primary indicator
    const isBM = serverType === 'bm' || serverType === 'baremetal';
    
    // Legacy fallback for old data without type field
    const legacyIsBM = !serverType && (!!item.bmCpu || !!item.bmRam || (Array.isArray(item.disks) && item.disks.length > 0));
    
    if (isBM || legacyIsBM) {
      console.log('[EDIT] Server ID=', id, 'identified as BareMetal (type:', serverType || 'legacy', ')');
      return {
        type: 'bm' as const,
        id,
        gpu,
        gpuQty,
        bmCpu: toStr(item.bmCpu, '2x Intel Xeon E5-2680v4 28c/56t 2.4GHz/3.3GHz - Disponível'),
        bmRam: toStr(item.bmRam, '128GB'),
        disks: hydrateDisks(item.disks),
        trafficTb: toNum(item.trafficTb, 5),
        ips,
        qtyServers: toNum(item.qtyServers, 1),
      } as BMItemV2;
    }
    
    console.log('[EDIT] Server ID=', id, 'identified as VM (type:', serverType || 'default', ')');
    return {
      type: 'vm' as const,
      id,
      gpu,
      gpuQty,
      vcpu: toNum(item.vcpu, 16),
      ramGb: toNum(item.ramGb, 128),
      nvmeTb: toNum(item.nvmeTb, 0.09765625), // 100GB default
      trafficTb: toNum(item.trafficTb, 5),
      ips,
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
      
      // CRITICAL: Use 'type' field as PRIMARY source for server type detection
      const serverType = toStr(server.type, '').toLowerCase();
      
      // Determine if it's a BareMetal using type field first
      const isBM = serverType === 'bm' || serverType === 'baremetal';
      
      // Legacy fallback: check name only if type field is not set
      const name = toStr(server.name, '').toLowerCase();
      const legacyIsVM = !serverType && (name.includes('vm') || toNum(server.vcpu, 0) > 0);
      const legacyIsBM = !serverType && (name.includes('baremetal') || name.includes('bm'));

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

      // Determine server type: type field > legacy name check > fallback to VM
      const isBareMetal = isBM || legacyIsBM;
      const isVM = serverType === 'vm' || (!isBareMetal && (legacyIsVM || !serverType));
      
      console.log(`[EDIT LEGACY] Server #${idx} type="${serverType}" name="${name}" → isBareMetal=${isBareMetal} isVM=${isVM}`);

      if (isBareMetal) {
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
      }

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
  
  return {
    backupPlan: raw.backupPlan || 'none',
    backupGb: toNum(raw.backupGb, 0),
    antivirus: toNum(raw.antivirus, 0),
    // Firewall: now a quantity. Convert old boolean (true) to 1, false to 0
    firewall: typeof raw.firewall === 'boolean' ? (raw.firewall ? 1 : 0) : toNum(raw.firewall, 0),
    tsplus: toNum(raw.tsplus, 0),
    cal: toNum(raw.cal, 0),
    sql: raw.sql || 'none',
    sqlQty: toNum(raw.sqlQty, 0),
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
 * Matches by code OR name (case-insensitive, accent-insensitive).
 */
function hydrateAddonsFromLegacy(addons: any[]): AddonsStateV2 {
  const result: AddonsStateV2 = { ...DEFAULT_ADDONS };
  
  // Helper to normalize strings for matching (lowercase, remove accents, trim)
  const normalize = (str: string): string => {
    return str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  };
  
  for (const addon of addons) {
    // Get both code and name for matching
    const code = toStr(addon.code, '').toLowerCase().trim();
    const name = toStr(addon.name, '').toLowerCase().trim();
    const nameNormalized = normalize(addon.name || '');
    const qty = toNum(addon.quantity, 1);
    const price = toNum(addon.price, 0);
    
    // Skip if no identifier
    if (!code && !name) continue;
    
    // Windows Server - match by code or name
    if (code === 'winserver_2vcpu_unit' || 
        name.includes('winserver') || 
        name.includes('windows server') || 
        name.includes('win server')) {
      result.winserver = qty;
      console.log('[EDIT] WindowsServer units restored:', qty);
      continue;
    }
    
    // Support - match by code OR normalized name
    if (code === 'support_basic' || nameNormalized === 'suporte basico') {
      result.support.level = 'basic';
      result.support.price = price;
      console.log('[EDIT] support restored from addons[]: level=basic price=' + price);
      continue;
    }
    if (code === 'support_intermediate' || nameNormalized === 'suporte intermediario') {
      result.support.level = 'intermediate';
      result.support.price = price;
      console.log('[EDIT] support restored from addons[]: level=intermediate price=' + price);
      continue;
    }
    if (code === 'support_advanced' || nameNormalized === 'suporte avancado') {
      result.support.level = 'advanced';
      result.support.price = price;
      console.log('[EDIT] support restored from addons[]: level=advanced price=' + price);
      continue;
    }
    
    // Consultoria Técnica - match by code or name
    if (code === 'consulting_hours' || 
        nameNormalized === 'consultoria tecnica' || 
        nameNormalized.includes('consultoria')) {
      result.consulting.quantity = qty;
      result.consulting.unitPrice = price > 0 ? price : 200;
      console.log('[EDIT] consulting restored from addons[]: qty=' + qty + ' unitPrice=' + result.consulting.unitPrice);
      continue;
    }
    
    // DBA - match by code or name
    if (code === 'dba_hours' || name === 'dba') {
      result.dba.quantity = qty;
      result.dba.unitPrice = price > 0 ? price : 250;
      console.log('[EDIT] dba restored from addons[]: qty=' + qty + ' unitPrice=' + result.dba.unitPrice);
      continue;
    }
    
    // Backup - match by code or name pattern
    if (code?.startsWith('backup_') || name.startsWith('backup ')) {
      const planMatch = (code || name).match(/backup[_\s]+(\d+)/i);
      if (planMatch) {
        result.backupPlan = planMatch[1] as '7' | '15' | '30';
        result.backupGb = qty;
        console.log('[EDIT] Backup restored: plan=', result.backupPlan, ', gb=', result.backupGb);
      }
      continue;
    }
    
    // Antivirus
    if (code === 'antivirus' || name.includes('antivirus') || name.includes('antivírus')) {
      result.antivirus = qty;
      continue;
    }
    
    // Firewall - now supports quantity
    if (code === 'firewall' || name.includes('firewall')) {
      result.firewall = qty > 0 ? qty : 1; // If qty not set, default to 1 for old boolean data
      console.log('[EDIT] Firewall restored: qty=' + result.firewall);
      continue;
    }
    
    // TSplus
    if (code === 'tsplus' || name.includes('tsplus') || name.includes('ts plus')) {
      result.tsplus = qty;
      continue;
    }
    
    // CAL
    if (code === 'cal' || name === 'cal') {
      result.cal = qty;
      continue;
    }
    
    // Veeam VM
    if (code === 'veeam_vm' || name.includes('veeam vm')) {
      result.veeamVm = qty;
      continue;
    }
    
    // Veeam Agent
    if (code === 'veeam_agent' || name.includes('veeam agent')) {
      result.veeamAg = qty;
      continue;
    }
    
    // SQL (WE removido - apenas WEB e STD)
    if (code?.startsWith('sql_') || name.includes('sql')) {
      if (code?.includes('web') || name.includes('web')) result.sql = 'web';
      else if (code?.includes('std') || name.includes('std') || name.includes('standard')) result.sql = 'std';
      // Fallback: propostas antigas com WE mapeiam para WEB
      else if (code?.includes('we') || name.includes('we')) result.sql = 'web';
      result.sqlQty = qty;
      continue;
    }
  }
  
  console.log('[hydrateAddonsFromLegacy] Final result:', {
    winserver: result.winserver,
    backupPlan: result.backupPlan,
    support: result.support,
    consulting: result.consulting,
    dba: result.dba,
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
 * Requires config_id for backend price calculation
 */
export interface ApiAddonPayload {
  config_id?: number;     // ID of the calculator config entry (Add-ons category)
  item_id?: number;       // ID of the item within the config (legacy)
  code?: string;          // Legacy: addon code for compatibility
  name?: string;          // Display name (optional, for legacy)
  price?: number;         // Price (backend calculates from config)
  quantity: number;       // Quantity
}

/**
 * Server spec for API (v12+ - FLAT structure)
 * Each spec is a pair of config_id + value OR custom key-value pairs
 * 
 * IMPORTANT: The API allows custom key-value pairs in specs[]
 * We use this to persist GPU, BareMetal CPU/RAM/Disks
 */
export interface ApiServerSpec {
  config_id?: number;      // ID of the calculator config item (optional for custom specs)
  value?: number;          // Quantity/capacity of this component
  // Custom fields for roundtrip persistence
  key?: string;            // Custom key for non-config specs (e.g., 'gpu_model', 'bm_cpu')
  string_value?: string;   // String value for custom specs
  json_value?: unknown;    // JSON value for complex data (e.g., disks array)
}

/**
 * Server payload for API (v12+ - FLAT structure)
 * Uses specs[] array with config_id + value pairs AND custom key-value specs
 */
export interface ApiServerPayload {
  name: string;           // Server name
  type: string;           // Server type: 'vm', 'baremetal', 'storage', 'kubernetes', 'opensaas'
  specs: ApiServerSpec[]; // Array of specifications with config IDs and values
  quantity: number;       // Number of identical servers
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
  addons: ApiAddonPayload[];
  servers: ApiServerPayload[];
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
 * 
 * API v12+: Requires config_id and item_id for addons and servers.
 * If configIdStore is provided, IDs will be included for backend price calculation.
 * 
 * @param state - Calculator state
 * @param channelType - CLIENTE or PARCEIRO
 * @param grandTotal - Total value
 * @param discountPct - Discount percentage
 * @param configIdStore - Optional: Config ID mappings for v12+ API
 */
export function serializeProposal(
  state: OpenCalculatorState,
  channelType: 'CLIENTE' | 'PARCEIRO',
  grandTotal: number,
  discountPct: number = 0,
  configIdStore?: {
    vm?: { configId: number; items: Record<string, number> } | null;
    gpu?: { configId: number; items: Record<string, number> } | null;
    addons?: { configId: number; items: Record<string, number> } | null;
    sqlServer?: { configId: number; items: Record<string, number> } | null;
    backup?: { configId: number; items: Record<string, number> } | null;
    specializedServices?: { configId: number; items: Record<string, number> } | null;
    baremetal?: {
      cpu?: { configId: number; items: Record<string, number> } | null;
      ram?: { configId: number; items: Record<string, number> } | null;
      disk?: { configId: number; items: Record<string, number> } | null;
    } | null;
  } | null
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
  // BUILD ADDONS ARRAY (with config_id + item_id for v12+)
  // ============================================
  const addonsArray: ApiAddonPayload[] = [];
  
  // Get addons config IDs
  const addonsConfigId = configIdStore?.addons?.configId;
  const specializedConfigId = configIdStore?.specializedServices?.configId ?? addonsConfigId;
  const sqlConfigId = configIdStore?.sqlServer?.configId;
  const backupConfigId = configIdStore?.backup?.configId;
  
  // Windows Server - EXPLICIT
  if (state.addons.winserver > 0) {
    const itemId = findItemId(configIdStore?.addons, 'WinServer(2vCPU/unid.)', 'winserver_2vcpu_unit', 'Windows Server');
    addonsArray.push({
      config_id: addonsConfigId,
      item_id: itemId,
      code: 'winserver_2vcpu_unit',
      name: 'WinServer(2vCPU/unid.)',
      price: 0,
      quantity: state.addons.winserver,
    });
    console.log('[serializeProposal] Added WinServer:', state.addons.winserver, 'item_id:', itemId);
  }
  
  // Support - Using official codes from ADMIN (with both code and name for compatibility)
  if (state.addons.support.level !== 'none') {
    const supportCodeMap: Record<string, { code: string; name: string }> = {
      'basic': { code: 'support_basic', name: 'Suporte Básico' },
      'intermediate': { code: 'support_intermediate', name: 'Suporte Intermediário' },
      'advanced': { code: 'support_advanced', name: 'Suporte Avançado' },
    };
    const supportData = supportCodeMap[state.addons.support.level] || supportCodeMap['basic'];
    const itemId = findItemId(configIdStore?.specializedServices ?? configIdStore?.addons, supportData.name, supportData.code);
    addonsArray.push({
      config_id: specializedConfigId,
      item_id: itemId,
      code: supportData.code,
      name: supportData.name,
      price: state.addons.support.price,
      quantity: 1,
    });
    console.log('[SERIALIZE] support=' + supportData.code + ' price=' + state.addons.support.price + ' item_id=' + itemId);
  }
  
  // Consultoria Técnica - Using official code (with both code and name)
  if (state.addons.consulting.quantity > 0) {
    const itemId = findItemId(configIdStore?.specializedServices ?? configIdStore?.addons, 'Consultoria Técnica', 'consulting_hours');
    addonsArray.push({
      config_id: specializedConfigId,
      item_id: itemId,
      code: 'consulting_hours',
      name: 'Consultoria Técnica',
      price: state.addons.consulting.unitPrice,
      quantity: state.addons.consulting.quantity,
    });
    console.log('[SERIALIZE] consulting_hours qty=' + state.addons.consulting.quantity + ' item_id=' + itemId);
  }
  
  // DBA - Using official code (with both code and name)
  if (state.addons.dba.quantity > 0) {
    const itemId = findItemId(configIdStore?.specializedServices ?? configIdStore?.addons, 'DBA', 'dba_hours');
    addonsArray.push({
      config_id: specializedConfigId,
      item_id: itemId,
      code: 'dba_hours',
      name: 'DBA',
      price: state.addons.dba.unitPrice,
      quantity: state.addons.dba.quantity,
    });
    console.log('[SERIALIZE] dba_hours qty=' + state.addons.dba.quantity + ' item_id=' + itemId);
  }
  
  // Backup - EXPLICIT
  if (state.addons.backupPlan !== 'none' && state.addons.backupGb > 0) {
    const itemId = findItemId(configIdStore?.backup, `${state.addons.backupPlan} dias`, `backup_${state.addons.backupPlan}`, state.addons.backupPlan);
    addonsArray.push({
      config_id: backupConfigId,
      item_id: itemId,
      code: `backup_${state.addons.backupPlan}`,
      name: `Backup ${state.addons.backupPlan}`,
      price: 0,
      quantity: state.addons.backupGb,
    });
    console.log('[serializeProposal] Added Backup:', state.addons.backupPlan, state.addons.backupGb, 'item_id:', itemId);
  }
  
  // Antivirus
  if (state.addons.antivirus > 0) {
    const itemId = findItemId(configIdStore?.addons, 'Antivírus', 'Antivirus', 'antivirus');
    addonsArray.push({ 
      config_id: addonsConfigId, 
      item_id: itemId, 
      code: 'antivirus', 
      name: 'Antivirus', 
      price: 0, 
      quantity: state.addons.antivirus 
    });
  }
  
  // Firewall (qty) - now with quantity support
  if (state.addons.firewall > 0) {
    const itemId = findItemId(configIdStore?.addons, 'Firewall pfSense', 'Firewall (qtd)', 'firewall');
    addonsArray.push({ 
      config_id: addonsConfigId, 
      item_id: itemId, 
      code: 'firewall', 
      name: 'Firewall (qtd)', 
      price: 0, 
      quantity: state.addons.firewall 
    });
  }
  
  // TSplus
  if (state.addons.tsplus > 0) {
    const itemId = findItemId(configIdStore?.addons, 'TSplus', 'tsplus');
    addonsArray.push({ 
      config_id: addonsConfigId, 
      item_id: itemId, 
      code: 'tsplus', 
      name: 'TS Plus', 
      price: 0, 
      quantity: state.addons.tsplus 
    });
  }
  
  // CAL
  if (state.addons.cal > 0) {
    const itemId = findItemId(configIdStore?.addons, 'CAL', 'cal');
    addonsArray.push({ 
      config_id: addonsConfigId, 
      item_id: itemId, 
      code: 'cal', 
      name: 'CAL', 
      price: 0, 
      quantity: state.addons.cal 
    });
  }
  
  // Veeam VM
  if (state.addons.veeamVm > 0) {
    const itemId = findItemId(configIdStore?.addons, 'Veeam VM', 'veeam_vm');
    addonsArray.push({ 
      config_id: addonsConfigId, 
      item_id: itemId, 
      code: 'veeam_vm', 
      name: 'Veeam VM', 
      price: 0, 
      quantity: state.addons.veeamVm 
    });
  }
  
  // Veeam Agent
  if (state.addons.veeamAg > 0) {
    const itemId = findItemId(configIdStore?.addons, 'Veeam Agent', 'veeam_agent');
    addonsArray.push({ 
      config_id: addonsConfigId, 
      item_id: itemId, 
      code: 'veeam_agent', 
      name: 'Veeam Agent', 
      price: 0, 
      quantity: state.addons.veeamAg 
    });
  }
  
  // SQL
  if (state.addons.sql !== 'none' && state.addons.sqlQty > 0) {
    const edition = state.addons.sql.toUpperCase();
    const itemId = findItemId(configIdStore?.sqlServer, edition, `${edition} (2vCPU)`, `${edition} (8vCPU)`, `SQL ${edition}`);
    addonsArray.push({
      config_id: sqlConfigId,
      item_id: itemId,
      code: `sql_${state.addons.sql.toLowerCase()}`,
      name: `SQL ${edition}`,
      price: 0,
      quantity: state.addons.sqlQty,
    });
  }
  
  // Log dados_proposta snapshot for debugging
  console.log('[SAVE] dados_proposta.support=' + JSON.stringify(state.addons.support) + 
    ' consulting=' + JSON.stringify(state.addons.consulting) + 
    ' dba=' + JSON.stringify(state.addons.dba));
  
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
  // BUILD SERVERS ARRAY (FLAT API v12+ format with type + specs[])
  // CRITICAL: GPU, BareMetal CPU/RAM/Disks are stored as custom specs
  // ============================================
  const serversArray: ApiServerPayload[] = [];
  
  // Get config IDs for VM components
  const vmVcpuConfigId = findItemId(configIdStore?.vm, 'vCPU', 'vcpu');
  const vmRamConfigId = findItemId(configIdStore?.vm, 'RAM', 'ram');
  const vmNvmeConfigId = findItemId(configIdStore?.vm, 'NVMe', 'nvme', 'Disco NVMe');
  const vmIpConfigId = findItemId(configIdStore?.vm, 'IP Público', 'IP', 'ips');
  
  // Get config IDs for GPU
  const gpuConfigId = configIdStore?.gpu?.configId;
  
  // Get config IDs for BareMetal components
  const bmCpuConfigId = configIdStore?.baremetal?.cpu?.configId;
  const bmRamConfigId = configIdStore?.baremetal?.ram?.configId;
  const bmDiskConfigId = configIdStore?.baremetal?.disk?.configId;

  for (const [idx, item] of state.items.entries()) {
    const hasGpu = typeof item.gpu === 'string' && item.gpu !== '' && item.gpu !== 'Sem GPU' && item.gpuQty > 0;

    if (hasGpu) {
      console.log(`[SERIALIZE] gpu.enabled=true model=${item.gpu} qty=${item.gpuQty}`);
    }

    if (item.type === 'vm') {
      // Build specs[] array for VM
      const vmSpecs: ApiServerSpec[] = [];
      
      // vCPU (minimum 1)
      if (vmVcpuConfigId) {
        vmSpecs.push({ config_id: vmVcpuConfigId, value: Math.max(1, item.vcpu) });
      }
      
      // RAM (minimum 1GB)
      if (vmRamConfigId) {
        vmSpecs.push({ config_id: vmRamConfigId, value: Math.max(1, item.ramGb) });
      }
      
      // NVMe Storage (in GB)
      if (vmNvmeConfigId) {
        vmSpecs.push({ config_id: vmNvmeConfigId, value: Math.round(item.nvmeTb * 1024) });
      }
      
      // IP Público
      if (vmIpConfigId && item.ips > 0) {
        vmSpecs.push({ config_id: vmIpConfigId, value: item.ips });
      }
      
      // GPU - add as config_id if available, otherwise as custom spec
      if (hasGpu) {
        if (gpuConfigId) {
          const gpuModelConfigId = findItemId(configIdStore?.gpu, item.gpu);
          if (gpuModelConfigId) {
            vmSpecs.push({ config_id: gpuModelConfigId, value: item.gpuQty });
          }
        }
        // ALWAYS add custom spec for GPU to ensure roundtrip
        vmSpecs.push({ key: 'gpu_model', string_value: item.gpu });
        vmSpecs.push({ key: 'gpu_qty', value: item.gpuQty });
      }
      
      serversArray.push({
        name: `VM #${idx + 1}`,
        type: 'vm',
        specs: vmSpecs,
        quantity: item.qtyServers,
      });
      
      console.log(`[SERIALIZE] VM #${idx + 1}: specs=${JSON.stringify(vmSpecs)}`);
      
    } else if (item.type === 'bm') {
      // Build specs[] array for BareMetal
      const bmSpecs: ApiServerSpec[] = [];
      
      // CPU Model (need to find config_id by label)
      if (bmCpuConfigId && item.bmCpu) {
        const cpuItemId = findItemId(configIdStore?.baremetal?.cpu, item.bmCpu);
        if (cpuItemId) {
          bmSpecs.push({ config_id: cpuItemId, value: 1 });
        }
      }
      // ALWAYS add custom spec for BM CPU to ensure roundtrip
      if (item.bmCpu) {
        bmSpecs.push({ key: 'bm_cpu', string_value: item.bmCpu });
      }
      
      // RAM Model
      if (bmRamConfigId && item.bmRam) {
        const ramItemId = findItemId(configIdStore?.baremetal?.ram, item.bmRam);
        if (ramItemId) {
          bmSpecs.push({ config_id: ramItemId, value: 1 });
        }
      }
      // ALWAYS add custom spec for BM RAM to ensure roundtrip
      if (item.bmRam) {
        bmSpecs.push({ key: 'bm_ram', string_value: item.bmRam });
      }
      
      // Disks - store both as config_id (if found) and as custom spec
      if (Array.isArray(item.disks) && item.disks.length > 0) {
        if (bmDiskConfigId) {
          for (const disk of item.disks) {
            const diskItemId = findItemId(configIdStore?.baremetal?.disk, disk.type);
            if (diskItemId) {
              bmSpecs.push({ config_id: diskItemId, value: disk.qty });
            }
          }
        }
        // ALWAYS add custom spec for disks array to ensure roundtrip
        bmSpecs.push({ key: 'bm_disks', json_value: item.disks });
      }
      
      // IP Público
      if (vmIpConfigId && item.ips > 0) {
        bmSpecs.push({ config_id: vmIpConfigId, value: item.ips });
      }
      
      // GPU
      if (hasGpu) {
        if (gpuConfigId) {
          const gpuModelConfigId = findItemId(configIdStore?.gpu, item.gpu);
          if (gpuModelConfigId) {
            bmSpecs.push({ config_id: gpuModelConfigId, value: item.gpuQty });
          }
        }
        // ALWAYS add custom spec for GPU to ensure roundtrip
        bmSpecs.push({ key: 'gpu_model', string_value: item.gpu });
        bmSpecs.push({ key: 'gpu_qty', value: item.gpuQty });
      }
      
      serversArray.push({
        name: `BareMetal #${idx + 1}`,
        type: 'baremetal',
        specs: bmSpecs,
        quantity: item.qtyServers,
      });
      
      console.log(`[SERIALIZE] BareMetal #${idx + 1}: specs=${JSON.stringify(bmSpecs)}`);
    }
  }
  
  // Add virtual servers if no real servers (API requires at least 1)
  if (serversArray.length === 0) {
    if (state.storageItems.length > 0) {
      serversArray.push({
        name: `__VIRTUAL__STORAGE__:${JSON.stringify({ items: state.storageItems })}`,
        type: 'storage',
        specs: [],
        quantity: 1,
      });
    }
    if (state.kubernetes.enabled) {
      serversArray.push({
        name: `__VIRTUAL__KUBERNETES__:${JSON.stringify(state.kubernetes)}`,
        type: 'kubernetes',
        specs: [],
        quantity: 1,
      });
    }
    if (state.openSaas.enabled && state.openSaas.users > 0) {
      serversArray.push({
        name: `__VIRTUAL__OPENSAAS__:${JSON.stringify(state.openSaas)}`,
        type: 'opensaas',
        specs: [],
        quantity: 1,
      });
    }
    
    // Fallback placeholder
    if (serversArray.length === 0) {
      serversArray.push({
        name: '__VIRTUAL__BUNDLE__:{}',
        type: 'vm',
        specs: [],
        quantity: 1,
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
