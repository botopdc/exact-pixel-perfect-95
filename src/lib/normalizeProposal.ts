/**
 * Unified Proposal Normalizer
 * 
 * SINGLE SOURCE OF TRUTH for normalizing proposal data from API.
 * Used by: PropostaView, OpenCalculator (edit mode), PDF Generator
 * 
 * This function ensures:
 * 1. servers is always an array (handles object/string/null)
 * 2. addons is always an array (handles object/string/null)
 * 3. Each server has description and calculated prices
 * 4. Each addon has quantity and price
 * 5. Totals are recalculated from normalized items
 * 6. Divergences are logged for debugging
 */

import { CalculationResult, SummaryRow, getContractDiscount, formatCurrency } from './calculatorConfig';

// ============================================================================
// TYPES
// ============================================================================

export interface NormalizedServer {
  name: string;
  description: string;
  type: 'vm' | 'bm';
  vcpu: number;
  ram: number;
  storage: number;
  quantity: number;
  ips: number;
  gpu: string;
  gpuQty: number;
  unitPrice: number;
  subtotal: number;
  // Original data for edit mode
  originalData?: Record<string, unknown>;
}

export interface NormalizedAddon {
  code: string;
  name: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface NormalizedTotals {
  subtotalRecursos: number;
  subtotalIps: number;
  subtotalAddons: number;
  subtotalBackup: number;
  subtotalKubernetes: number;
  subtotalStorage: number;
  subtotalOpenSaas: number;
  subtotalServices: number;
  discountPct: number;
  discountValue: number;
  totalMensal: number;
}

export interface NormalizedProposal {
  // Identity
  id: number | null;
  uuid: string | null;
  displayId: string;
  
  // Client
  client: {
    name: string;
    company: string;
    phone: string;
    email: string;
  };
  
  // Meta
  createdAt: string;
  validityDays: number;
  validUntil: Date;
  status: string;
  datacenter: string;
  contractDuration: number;
  selectedTerm: string;
  
  // Items
  servers: NormalizedServer[];
  addons: NormalizedAddon[];
  
  // Totals
  totals: NormalizedTotals;
  apiTotal: number;
  
  // Result for rendering (compatible with existing components)
  result: CalculationResult;
  
  // Raw data for edit mode
  rawDadosProposta: Record<string, unknown> | null;
  
  // Flags
  hasDivergence: boolean;
  divergenceAmount: number;
  observacao: string;
}

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

/**
 * Parse JSON-like data (handles string, object, null)
 */
function parseJsonField<T>(field: unknown): T | null {
  if (!field) return null;
  if (typeof field === 'string') {
    try {
      return JSON.parse(field) as T;
    } catch {
      return null;
    }
  }
  if (typeof field === 'object') return field as T;
  return null;
}

/**
 * Ensure array format (handles object/array/null)
 */
function ensureArray<T>(data: unknown): T[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (typeof data === 'object') {
    return Object.values(data) as T[];
  }
  return [];
}

/**
 * Build server description from specs
 */
function buildServerDescription(server: Record<string, unknown>): string {
  const vcpu = toNum(server.vcpu);
  const ram = toNum(server.ram) || toNum(server.ram_gb) || toNum(server.ramGb);
  const storage = toNum(server.storage) || toNum(server.nvme_gb) || (toNum(server.nvmeTb) * 1024);
  
  if (vcpu > 0 || ram > 0 || storage > 0) {
    const parts: string[] = [];
    if (vcpu > 0) parts.push(`${vcpu} vCPU`);
    if (ram > 0) parts.push(`${ram}GB RAM`);
    if (storage > 0) parts.push(`${Math.round(storage)}GB`);
    return `(${parts.join(', ')})`;
  }
  
  return '';
}

// ============================================================================
// MAIN NORMALIZER
// ============================================================================

/**
 * Normalize a raw API proposal to a consistent format
 * 
 * @param rawProposal - Raw proposal from API (GET /calculator/proposal/{id})
 * @returns NormalizedProposal with all fields guaranteed
 */
export function normalizeProposal(rawProposal: Record<string, unknown>): NormalizedProposal {
  console.log('[normalizeProposal] Processing proposal:', rawProposal.id);
  
  // ============================================
  // STEP 1: Parse dados_proposta
  // ============================================
  let dadosProposta = parseJsonField<Record<string, unknown>>(rawProposal.dados_proposta);
  
  console.log('[normalizeProposal] dados_proposta:', {
    hasDadosProposta: !!dadosProposta,
    hasItems: dadosProposta?.items ? (dadosProposta.items as any[]).length : 0,
    hasResult: !!dadosProposta?.result,
  });
  
  // ============================================
  // STEP 2: Extract identity
  // ============================================
  const id = toNum(rawProposal.id, null as unknown as number) || null;
  const uuid = toStr(rawProposal.uuid);
  const displayId = dadosProposta?.proposal 
    ? toStr((dadosProposta.proposal as any)?.id, `PROP-${id}`)
    : `PROP-${id}`;
  
  // ============================================
  // STEP 3: Extract client
  // ============================================
  const clientFromSnapshot = dadosProposta?.client as Record<string, unknown> | undefined;
  const client = {
    name: toStr(clientFromSnapshot?.name ?? rawProposal.name),
    company: toStr(clientFromSnapshot?.company ?? rawProposal.company),
    phone: toStr(clientFromSnapshot?.phone ?? rawProposal.phone),
    email: toStr(clientFromSnapshot?.email ?? rawProposal.email),
  };
  
  // ============================================
  // STEP 4: Extract meta
  // ============================================
  const createdAt = toStr(rawProposal.created_at, new Date().toISOString());
  const validityDays = dadosProposta?.proposal 
    ? toNum((dadosProposta.proposal as any)?.validityDays, 7)
    : 7;
  const validUntil = new Date(createdAt);
  validUntil.setDate(validUntil.getDate() + validityDays);
  
  const status = toStr(rawProposal.status, 'Rascunho');
  const datacenter = toStr(rawProposal.datacenter ?? dadosProposta?.datacenter, 'São Paulo');
  const contractDuration = toNum(rawProposal.contract_duration, 1);
  const selectedTerm = dadosProposta?.selectedTerm 
    ? toStr(dadosProposta.selectedTerm)
    : String(contractDuration);
  const observacao = toStr(dadosProposta?.observacao ?? rawProposal.observations);
  
  // ============================================
  // STEP 5: Normalize servers array
  // ============================================
  // Priority: dados_proposta.items > rawProposal.servers
  let rawServers: any[] = [];
  
  if (dadosProposta?.items && Array.isArray(dadosProposta.items)) {
    rawServers = dadosProposta.items.filter((item: any) => {
      const itemType = toStr(item.type).toLowerCase();
      return itemType === 'vm' || itemType === 'bm' || itemType === 'baremetal';
    });
  } else {
    rawServers = ensureArray(rawProposal.servers);
  }
  
  const servers: NormalizedServer[] = rawServers.map((server: any, idx: number) => {
    const type = toStr(server.type).toLowerCase() === 'bm' || 
                 toStr(server.type).toLowerCase() === 'baremetal' ? 'bm' : 'vm';
    const name = toStr(server.name, `${type === 'vm' ? 'VM' : 'BareMetal'} #${idx + 1}`);
    const vcpu = toNum(server.vcpu);
    const ram = toNum(server.ram) || toNum(server.ram_gb) || toNum(server.ramGb);
    const storage = toNum(server.storage) || toNum(server.nvme_gb) || Math.round(toNum(server.nvmeTb) * 1024);
    const quantity = toNum(server.quantity ?? server.qtyServers, 1);
    const ips = toNum(server.ips ?? server.ipQty);
    const gpu = toStr(server.gpu, 'Sem GPU');
    const gpuQty = toNum(server.gpuQty ?? server.gpu_qty);
    
    // CRITICAL: Use stored prices from snapshot, or calculate
    const unitPrice = toNum(server.price ?? server.unitPrice ?? server.unit_price);
    const subtotal = toNum(server.subtotal ?? server.totalPrice ?? server.total_price, unitPrice * quantity);
    
    const description = buildServerDescription(server);
    
    return {
      name,
      description,
      type,
      vcpu,
      ram,
      storage,
      quantity,
      ips,
      gpu,
      gpuQty,
      unitPrice,
      subtotal,
      originalData: server,
    };
  });
  
  console.log('[normalizeProposal] Normalized servers:', servers.length);
  
  // ============================================
  // STEP 6: Normalize addons array
  // ============================================
  let rawAddons: any[] = [];
  
  // Check if dados_proposta has structured addons (object format)
  const structuredAddons = dadosProposta?.addons as Record<string, unknown> | undefined;
  
  if (structuredAddons && typeof structuredAddons === 'object' && !Array.isArray(structuredAddons)) {
    // Convert structured addons to array format
    rawAddons = convertStructuredAddonsToArray(structuredAddons);
  } else {
    // Use API addons array
    rawAddons = ensureArray(rawProposal.addons);
  }
  
  const addons: NormalizedAddon[] = rawAddons.map((addon: any) => {
    const code = toStr(addon.code);
    const name = toStr(addon.name, code);
    const quantity = toNum(addon.quantity ?? addon.qty, 1);
    const unitPrice = toNum(addon.price ?? addon.unitPrice ?? addon.unit_price);
    const subtotal = toNum(addon.subtotal ?? addon.total_price, unitPrice * quantity);
    
    return { code, name, quantity, unitPrice, subtotal };
  }).filter(addon => addon.quantity > 0 || addon.subtotal > 0);
  
  console.log('[normalizeProposal] Normalized addons:', addons.length);
  
  // ============================================
  // STEP 7: Calculate totals from normalized items
  // ============================================
  const subtotalRecursos = servers.reduce((sum, s) => sum + s.subtotal, 0);
  const subtotalIps = servers.reduce((sum, s) => sum + (s.ips * 30 * s.quantity), 0);
  const subtotalAddons = addons.reduce((sum, a) => sum + a.subtotal, 0);
  
  // Extract specific addon subtotals from structured data
  const subtotalBackup = extractAddonSubtotal(structuredAddons, 'backup');
  const subtotalKubernetes = extractKubernetesSubtotal(dadosProposta?.kubernetes);
  const subtotalStorage = extractStorageSubtotal(dadosProposta?.storageItems);
  const subtotalOpenSaas = extractOpenSaasSubtotal(dadosProposta?.openSaas);
  const subtotalServices = subtotalAddons;
  
  const discountPct = getContractDiscount(contractDuration);
  const subtotalBeforeDiscount = subtotalRecursos + subtotalIps + subtotalServices + 
                                  subtotalBackup + subtotalKubernetes + subtotalStorage + subtotalOpenSaas;
  const discountValue = subtotalBeforeDiscount * discountPct;
  const calculatedTotal = subtotalBeforeDiscount - discountValue;
  
  const apiTotal = toNum(rawProposal.total);
  
  const totals: NormalizedTotals = {
    subtotalRecursos,
    subtotalIps,
    subtotalAddons,
    subtotalBackup,
    subtotalKubernetes,
    subtotalStorage,
    subtotalOpenSaas,
    subtotalServices,
    discountPct,
    discountValue,
    totalMensal: apiTotal > 0 ? apiTotal : calculatedTotal,
  };
  
  // ============================================
  // STEP 8: Check for divergence
  // ============================================
  const divergenceThreshold = 1; // R$ 1.00
  const hasDivergence = apiTotal > 0 && Math.abs(apiTotal - calculatedTotal) > divergenceThreshold;
  const divergenceAmount = apiTotal - calculatedTotal;
  
  if (hasDivergence) {
    console.warn(`[normalizeProposal] DIVERGENCE DETECTED for proposal ${id}:`, {
      apiTotal: formatCurrency(apiTotal),
      calculatedTotal: formatCurrency(calculatedTotal),
      divergence: formatCurrency(divergenceAmount),
    });
  }
  
  // ============================================
  // STEP 9: Build CalculationResult for rendering
  // ============================================
  const result = buildResultFromNormalized(servers, addons, totals, dadosProposta);
  
  return {
    id,
    uuid,
    displayId,
    client,
    createdAt,
    validityDays,
    validUntil,
    status,
    datacenter,
    contractDuration,
    selectedTerm,
    servers,
    addons,
    totals,
    apiTotal,
    result,
    rawDadosProposta: dadosProposta,
    hasDivergence,
    divergenceAmount,
    observacao,
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Convert structured addons (object format) to array format
 */
function convertStructuredAddonsToArray(addons: Record<string, unknown>): any[] {
  const result: any[] = [];
  
  // Windows Server
  const winserver = toNum(addons.winserver);
  if (winserver > 0) {
    result.push({
      code: 'winserver_2vcpu_unit',
      name: 'WinServer (2vCPU/unid.)',
      quantity: winserver,
      price: 45, // Default price
    });
  }
  
  // Support
  const support = addons.support as Record<string, unknown> | undefined;
  if (support?.level && support.level !== 'none') {
    const supportLabels: Record<string, string> = {
      basic: 'Suporte Básico',
      intermediate: 'Suporte Intermediário',
      advanced: 'Suporte Avançado',
    };
    result.push({
      code: `support_${support.level}`,
      name: supportLabels[support.level as string] || 'Suporte',
      quantity: 1,
      price: toNum(support.price),
    });
  }
  
  // Consultoria
  const consulting = addons.consulting as Record<string, unknown> | undefined;
  if (consulting && toNum(consulting.quantity) > 0) {
    result.push({
      code: 'consulting_hours',
      name: 'Consultoria Técnica',
      quantity: toNum(consulting.quantity),
      price: toNum(consulting.unitPrice, 200),
    });
  }
  
  // DBA
  const dba = addons.dba as Record<string, unknown> | undefined;
  if (dba && toNum(dba.quantity) > 0) {
    result.push({
      code: 'dba_hours',
      name: 'DBA',
      quantity: toNum(dba.quantity),
      price: toNum(dba.unitPrice, 250),
    });
  }
  
  // SQL
  const sql = toStr(addons.sql);
  const sqlQty = toNum(addons.sqlQty, 1);
  if (sql && sql !== 'none') {
    const sqlLabels: Record<string, string> = {
      web: 'SQL Server WEB',
      std: 'SQL Server STD',
    };
    const sqlPrices: Record<string, number> = { web: 265, std: 2240 };
    result.push({
      code: `sql_${sql}`,
      name: sqlLabels[sql] || `SQL Server ${sql.toUpperCase()}`,
      quantity: sqlQty,
      price: sqlPrices[sql] || 0,
    });
  }
  
  // Antivirus
  const antivirus = toNum(addons.antivirus);
  if (antivirus > 0) {
    result.push({
      code: 'antivirus',
      name: 'Antivírus',
      quantity: antivirus,
      price: 69.9,
    });
  }
  
  // Firewall
  const firewall = toNum(addons.firewall);
  if (firewall > 0) {
    result.push({
      code: 'firewall',
      name: 'Firewall',
      quantity: firewall,
      price: 199.9,
    });
  }
  
  // TSplus
  const tsplus = toNum(addons.tsplus);
  if (tsplus > 0) {
    result.push({
      code: 'tsplus',
      name: 'TSplus',
      quantity: tsplus,
      price: 40,
    });
  }
  
  // CAL
  const cal = toNum(addons.cal);
  if (cal > 0) {
    result.push({
      code: 'cal',
      name: 'CAL RDS',
      quantity: cal,
      price: 55,
    });
  }
  
  // Backup
  const backupPlan = toStr(addons.backupPlan);
  const backupGb = toNum(addons.backupGb);
  if (backupPlan && backupPlan !== 'none' && backupGb > 0) {
    result.push({
      code: `backup_${backupPlan}`,
      name: `Backup ${backupPlan} dias`,
      quantity: backupGb,
      price: 0.5, // Price per GB
    });
  }
  
  return result;
}

function extractAddonSubtotal(addons: Record<string, unknown> | undefined, key: string): number {
  if (!addons) return 0;
  if (key === 'backup') {
    const backupGb = toNum(addons.backupGb);
    return backupGb * 0.5; // Default 0.5/GB
  }
  return 0;
}

function extractKubernetesSubtotal(kubernetes: unknown): number {
  if (!kubernetes || typeof kubernetes !== 'object') return 0;
  const k8s = kubernetes as Record<string, unknown>;
  if (!k8s.enabled) return 0;
  return toNum(k8s.totalPrice ?? k8s.price);
}

function extractStorageSubtotal(storageItems: unknown): number {
  if (!Array.isArray(storageItems)) return 0;
  return storageItems.reduce((sum: number, item: any) => sum + toNum(item.totalPrice ?? item.price), 0);
}

function extractOpenSaasSubtotal(openSaas: unknown): number {
  if (!openSaas || typeof openSaas !== 'object') return 0;
  const saas = openSaas as Record<string, unknown>;
  if (!saas.enabled) return 0;
  const users = toNum(saas.users);
  const pricePerUser = toNum(saas.pricePerUser, 49.9);
  return users * pricePerUser;
}

/**
 * Build CalculationResult from normalized data
 */
function buildResultFromNormalized(
  servers: NormalizedServer[],
  addons: NormalizedAddon[],
  totals: NormalizedTotals,
  dadosProposta: Record<string, unknown> | null
): CalculationResult {
  const rows: SummaryRow[] = [];
  
  // Add server rows
  servers.forEach((server, idx) => {
    const label = server.description 
      ? `${server.name} ${server.description}`
      : server.name;
    
    rows.push({
      label,
      qty: server.quantity,
      unitPrice: server.unitPrice,
      subtotal: server.subtotal,
      finalTotal: server.subtotal,
      rowKey: `${server.type}_${idx}`,
    });
    
    // Add IPs if any
    if (server.ips > 0) {
      const ipPrice = 30 * server.ips * server.quantity;
      rows.push({
        label: `IPs Públicos (${server.ips}/servidor)`,
        qty: server.ips * server.quantity,
        unitPrice: 30,
        subtotal: ipPrice,
        finalTotal: ipPrice,
      });
    }
    
    // Add GPU if any
    if (server.gpu && server.gpu !== 'Sem GPU' && server.gpuQty > 0) {
      rows.push({
        label: `GPU ${server.gpu} (x${server.gpuQty})`,
        qty: server.gpuQty * server.quantity,
        unitPrice: 0, // GPU price would need config
        subtotal: 0,
        finalTotal: 0,
      });
    }
  });
  
  // Add addon rows
  addons.forEach(addon => {
    rows.push({
      label: addon.name,
      qty: addon.quantity,
      unitPrice: addon.unitPrice,
      subtotal: addon.subtotal,
      finalTotal: addon.subtotal,
    });
  });
  
  // Add kubernetes if enabled
  if (dadosProposta?.kubernetes && (dadosProposta.kubernetes as any).enabled) {
    const k8s = dadosProposta.kubernetes as any;
    rows.push({
      label: `Kubernetes Gerenciado`,
      qty: 1,
      unitPrice: totals.subtotalKubernetes,
      subtotal: totals.subtotalKubernetes,
      finalTotal: totals.subtotalKubernetes,
    });
  }
  
  // Add storage items
  if (dadosProposta?.storageItems && Array.isArray(dadosProposta.storageItems)) {
    (dadosProposta.storageItems as any[]).forEach(storage => {
      const price = toNum(storage.totalPrice ?? storage.price);
      const volumeTB = toNum(storage.volumeTB);
      rows.push({
        label: `Storage ${storage.storageType || 'SAS'} (${volumeTB}TB)`,
        qty: 1,
        unitPrice: price,
        subtotal: price,
        finalTotal: price,
      });
    });
  }
  
  // Add OpenSaaS if enabled
  if (dadosProposta?.openSaas && (dadosProposta.openSaas as any).enabled) {
    const saas = dadosProposta.openSaas as any;
    rows.push({
      label: `OpenSaaS (${saas.users} usuários)`,
      qty: saas.users,
      unitPrice: 49.9,
      subtotal: totals.subtotalOpenSaas,
      finalTotal: totals.subtotalOpenSaas,
    });
  }
  
  return {
    rows,
    subRec: totals.subtotalRecursos,
    subIps: totals.subtotalIps,
    subServices: totals.subtotalServices,
    subBackup: totals.subtotalBackup,
    subKubernetes: totals.subtotalKubernetes,
    subStorage: totals.subtotalStorage,
    subOpenSaas: totals.subtotalOpenSaas,
    discountPct: totals.discountPct,
    discountValue: totals.discountValue,
    grandTotal: totals.totalMensal,
    totalServers: servers.reduce((sum, s) => sum + s.quantity, 0),
    gpuUsdTotal: 0,
    gpuBrlTotal: 0,
    subtotalPriceList: totals.subtotalRecursos + totals.subtotalIps + totals.subtotalServices,
    overValue: 0,
    overPercent: 0,
    totalWithOver: totals.totalMensal,
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export default normalizeProposal;
