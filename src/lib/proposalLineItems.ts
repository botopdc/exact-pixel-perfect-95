/**
 * Proposal Line Items Builder
 * 
 * SINGLE SOURCE OF TRUTH: Builds line items exclusively from proposal.servers[] and proposal.addons[]
 * Never depends on dados_proposta or legacy snapshot fields.
 * 
 * Used by: PropostaView, PDF Generator, and any display that needs to list proposal items.
 */

import { formatCurrency } from './calculatorConfig';

// ============================================================================
// TYPES
// ============================================================================

export interface LineItem {
  /** Unique key for React rendering */
  key: string;
  /** Category: 'server' | 'addon' | 'storage' | 'kubernetes' | 'opensaas' */
  category: 'server' | 'addon' | 'storage' | 'kubernetes' | 'opensaas';
  /** Display label (e.g., "VM #1 (16 vCPU, 128GB RAM, 500GB)") */
  label: string;
  /** Description for secondary text (optional) */
  description?: string;
  /** Quantity */
  qty: number;
  /** Unit price (R$) */
  unitPrice: number;
  /** Subtotal = qty * unitPrice (R$) */
  subtotal: number;
}

export interface LineItemsResult {
  /** All line items for display */
  items: LineItem[];
  /** Subtotal for servers */
  subtotalServers: number;
  /** Subtotal for addons */
  subtotalAddons: number;
  /** Grand total (sum of all items) */
  grandTotal: number;
  /** True if any items exist */
  hasItems: boolean;
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
 * Build description from server specs
 */
function buildServerDescription(server: Record<string, unknown>): string {
  const vcpu = toNum(server.vcpu);
  const ram = toNum(server.ram) || toNum(server.ram_gb) || toNum(server.ramGb);
  
  // Handle storage - could be in GB or TB
  const nvmeTb = toNum(server.nvmeTb) || toNum(server.nvme) || toNum(server.nvme_tb);
  const storageGb = toNum(server.storage) || toNum(server.nvme_gb) || Math.round(nvmeTb * 1024);
  
  // Build storage display string
  let storageDisplay = '';
  if (storageGb > 0) {
    storageDisplay = storageGb >= 1024 ? `${(storageGb / 1024).toFixed(2)}TB` : `${storageGb}GB`;
  } else if (nvmeTb > 0) {
    storageDisplay = nvmeTb >= 1 ? `${nvmeTb.toFixed(2)}TB` : `${Math.round(nvmeTb * 1024)}GB`;
  }
  
  const parts: string[] = [];
  if (vcpu > 0) parts.push(`${vcpu} vCPU`);
  if (ram > 0) parts.push(`${ram}GB RAM`);
  if (storageDisplay) parts.push(storageDisplay);
  
  return parts.length > 0 ? `(${parts.join(', ')})` : '';
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Build line items from proposal API data (servers[] and addons[])
 * 
 * @param proposal - Raw proposal from API (should have servers[] and addons[])
 * @returns LineItemsResult with all items and totals
 */
export function buildProposalLineItems(proposal: Record<string, unknown>): LineItemsResult {
  console.log('[buildProposalLineItems] Processing proposal:', proposal?.id);
  
  const items: LineItem[] = [];
  let subtotalServers = 0;
  let subtotalAddons = 0;
  
  // ============================================
  // STEP 1: Process servers from proposal.servers[]
  // ============================================
  const serversArray = Array.isArray(proposal?.servers) ? proposal.servers : [];
  
  console.log('[buildProposalLineItems] Processing', serversArray.length, 'servers');
  
  serversArray.forEach((server: any, idx: number) => {
    const serverName = toStr(server.name, `Servidor #${idx + 1}`);
    const description = buildServerDescription(server);
    const qty = toNum(server.quantity ?? server.qty ?? server.qtyServers, 1);
    const unitPrice = toNum(server.price ?? server.unit_price ?? server.unitPrice);
    const subtotal = toNum(server.subtotal ?? server.total, unitPrice * qty);
    
    // Detect server type
    const typeRaw = toStr(server.type).toLowerCase();
    const isBareMetal = typeRaw === 'bm' || typeRaw === 'baremetal';
    const displayLabel = description 
      ? `${serverName} ${description}`
      : serverName;
    
    items.push({
      key: `server_${idx}`,
      category: 'server',
      label: displayLabel,
      description: isBareMetal ? 'Bare Metal' : 'Virtual Machine',
      qty,
      unitPrice,
      subtotal,
    });
    
    subtotalServers += subtotal;
    
    // Add GPU if present
    const gpu = toStr(server.gpu);
    const gpuQty = toNum(server.gpuQty ?? server.gpu_qty);
    if (gpu && gpu !== 'Sem GPU' && gpuQty > 0) {
      const gpuPrice = toNum(server.gpu_price ?? server.gpuPrice);
      const gpuSubtotal = gpuPrice * gpuQty * qty;
      
      items.push({
        key: `server_${idx}_gpu`,
        category: 'server',
        label: `GPU ${gpu} (x${gpuQty})`,
        description: 'GPU acoplada ao servidor',
        qty: gpuQty * qty,
        unitPrice: gpuPrice,
        subtotal: gpuSubtotal,
      });
      
      subtotalServers += gpuSubtotal;
    }
    
    // Add IPs if present
    const ips = toNum(server.ips ?? server.ip_qty);
    if (ips > 0) {
      const ipPrice = 30; // Fixed IP price
      const ipSubtotal = ipPrice * ips * qty;
      
      items.push({
        key: `server_${idx}_ip`,
        category: 'addon',
        label: `IPs Públicos (${ips}/servidor)`,
        qty: ips * qty,
        unitPrice: ipPrice,
        subtotal: ipSubtotal,
      });
      
      subtotalAddons += ipSubtotal;
    }
  });
  
  // ============================================
  // STEP 2: Process addons from proposal.addons[]
  // ============================================
  const addonsArray = Array.isArray(proposal?.addons) ? proposal.addons : [];
  
  console.log('[buildProposalLineItems] Processing', addonsArray.length, 'addons');
  
  addonsArray.forEach((addon: any, idx: number) => {
    const qty = toNum(addon.quantity ?? addon.qty, 1);
    
    // Skip addons with zero quantity
    if (qty <= 0) {
      console.log('[buildProposalLineItems] Skipping addon with qty=0:', addon.name);
      return;
    }
    
    const name = toStr(addon.label || addon.name || addon.code, `Add-on #${idx + 1}`);
    const unitPrice = toNum(addon.price ?? addon.unit_price ?? addon.unitPrice);
    const subtotal = toNum(addon.subtotal ?? addon.total, unitPrice * qty);
    
    items.push({
      key: `addon_${idx}`,
      category: 'addon',
      label: name,
      qty,
      unitPrice,
      subtotal,
    });
    
    subtotalAddons += subtotal;
  });
  
  // ============================================
  // Calculate totals
  // ============================================
  const grandTotal = subtotalServers + subtotalAddons;
  const hasItems = items.length > 0;
  
  console.log('[buildProposalLineItems] Result:', {
    itemCount: items.length,
    subtotalServers,
    subtotalAddons,
    grandTotal,
    hasItems,
  });
  
  return {
    items,
    subtotalServers,
    subtotalAddons,
    grandTotal,
    hasItems,
  };
}

/**
 * Convert LineItemsResult to SummaryRow[] format for compatibility
 */
export function lineItemsToSummaryRows(lineItems: LineItemsResult): Array<{
  label: string;
  qty: number;
  unitPrice: number;
  subtotal: number;
}> {
  return lineItems.items.map(item => ({
    label: item.label,
    qty: item.qty,
    unitPrice: item.unitPrice,
    subtotal: item.subtotal,
  }));
}
