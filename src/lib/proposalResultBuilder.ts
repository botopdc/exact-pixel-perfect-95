/**
 * Proposal Result Builder
 * 
 * Reconstructs a CalculationResult from dados_proposta snapshot
 * when the 'result' field is not present (legacy proposals or public access).
 */

import { CalculationResult, SummaryRow, getContractDiscount } from './calculatorConfig';

interface DadosPropostaSnapshot {
  items?: Array<{
    type: string;
    name?: string;
    // VM fields
    vcpu?: number;
    ram?: number;
    ramGb?: number;
    ram_gb?: number;
    nvme?: number;
    nvmeTb?: number;
    storage?: number;
    qty?: number;
    qtyServers?: number;
    ipQty?: number;
    ips?: number;
    ip_qty?: number;
    gpu?: string;
    gpuQty?: number;
    gpu_qty?: number;
    // BM fields
    cpu?: string;
    bmCpu?: string;
    bmRam?: string;
    ramTier?: string;
    disks?: Array<{ label: string; tb: number }>;
    // Pricing
    unitPrice?: number;
    price?: number;
    unit_price?: number;
    totalPrice?: number;
    total_price?: number;
  }>;
  addons?: {
    antivirus?: number;
    antivirusPrice?: number;
    firewall?: boolean | number;
    firewallPrice?: number;
    tsplus?: number;
    tsplusPrice?: number;
    cal?: number;
    calPrice?: number;
    winserver?: number;
    winserverPrice?: number;
    sql?: string;
    sqlQty?: number;
    sqlPrice?: number;
    veeamVm?: number;
    veeamVmPrice?: number;
    veeamAgent?: number;
    veeamAgentPrice?: number;
    backupPlan?: string;
    backupRetention?: string;
    backupGb?: number;
    backupPrice?: number;
    supportLevel?: string;
    supportPrice?: number;
    consultingHours?: number;
    consultingPrice?: number;
    dbaHours?: number;
    dbaPrice?: number;
    // Structured add-ons (new format)
    support?: {
      level?: string;
      price?: number;
    };
    consulting?: {
      quantity?: number;
      unitPrice?: number;
    };
    dba?: {
      quantity?: number;
      unitPrice?: number;
    };
    customAddons?: Record<string, unknown>;
  };
  kubernetes?: {
    enabled?: boolean;
    workerNodes?: number;
    nodeVcpu?: number;
    nodeRam?: number;
    totalPrice?: number;
    plan?: string;
    price?: number;
  };
  storageItems?: Array<{
    type?: string;
    storageType?: string;
    region?: string;
    size?: number;
    volumeTB?: number;
    totalPrice?: number;
    price?: number;
  }>;
  openSaas?: {
    enabled?: boolean;
    users?: number;
    pricePerUser?: number;
  };
  priceOverrides?: Record<string, number>;
  selectedTerm?: string;
  // Financial snapshot (calculated values from calculator)
  result?: {
    rows?: Array<{ label: string; qty: number; unitPrice: number; subtotal: number; finalTotal?: number }>;
    subRec?: number;
    subIps?: number;
    subServices?: number;
    subBackup?: number;
    subKubernetes?: number;
    subStorage?: number;
    subOpenSaas?: number;
    grandTotal?: number;
    discountPct?: number;
    discountValue?: number;
  };
}

/**
 * Build a CalculationResult from dados_proposta snapshot
 */
export function buildResultFromSnapshot(
  dadosProposta: DadosPropostaSnapshot,
  proposalTotal: number,
  contractDuration: number
): CalculationResult {
  const rows: SummaryRow[] = [];
  let subRec = 0;
  let subIps = 0;
  let subServices = 0;
  let subBackup = 0;
  let subKubernetes = 0;
  let subStorage = 0;
  let subOpenSaas = 0;
  let gpuBrlTotal = 0;
  let totalServers = 0;

  const priceOverrides = dadosProposta.priceOverrides || {};

  // Process server items
  // CRITICAL FIX: Support both lowercase ('vm', 'bm') and uppercase ('VM', 'BareMetal') types
  if (dadosProposta.items && Array.isArray(dadosProposta.items)) {
    dadosProposta.items.forEach((item, idx) => {
      const qty = item.qty || item.qtyServers || 1;
      totalServers += qty;
      
      // Normalize type to lowercase for comparison
      const itemType = (item.type || '').toString().toLowerCase();
      
      if (itemType === 'vm') {
        // CRITICAL: Use stored unitPrice and totalPrice from snapshot
        const unitPrice = item.unitPrice ?? item.price ?? item.unit_price ?? 0;
        const total = item.totalPrice ?? item.total_price ?? (unitPrice * qty);
        const rowKey = `vm_${idx}`;
        const overrideTotal = priceOverrides[rowKey];
        const finalTotal = overrideTotal ?? total;
        
        // Build VM label matching calculator summary format
        const vcpu = item.vcpu || 0;
        const ramGb = item.ramGb || item.ram || item.ram_gb || 0;
        const nvmeTb = item.nvmeTb || item.nvme || item.storage || 0;
        const storageDisplay = nvmeTb >= 1 ? `${nvmeTb.toFixed(2)}TB` : `${Math.round(nvmeTb * 1024) || 0}GB`;
        
        const label = item.name || `VM #${idx + 1} (${vcpu} vCPU, ${ramGb}GB RAM, ${storageDisplay})`;
        
        rows.push({
          label,
          qty,
          unitPrice,
          subtotal: total,
          baseTotal: total,
          overrideTotal: overrideTotal ?? null,
          finalTotal,
          rowKey,
        });
        subRec += finalTotal;
        
        // GPU
        if (item.gpu && item.gpu !== 'Sem GPU' && (item.gpuQty || item.gpu_qty)) {
          const gpuQty = item.gpuQty || item.gpu_qty || 0;
          // GPU pricing would need config - for now just document the GPU exists
          console.log(`[proposalResultBuilder] VM has GPU: ${item.gpu} x${gpuQty}`);
        }
        
        // IPs
        const ipQty = item.ipQty || item.ips || item.ip_qty || 0;
        if (ipQty > 0) {
          const ipPrice = 30 * ipQty * qty; // Default IP price
          subIps += ipPrice;
          rows.push({
            label: `IPs Públicos (${ipQty}/servidor)`,
            qty: ipQty * qty,
            unitPrice: 30,
            subtotal: ipPrice,
            finalTotal: ipPrice,
          });
        }
      } else if (itemType === 'bm' || itemType === 'baremetal') {
        // CRITICAL: Use stored unitPrice and totalPrice from snapshot
        const unitPrice = item.unitPrice ?? item.price ?? item.unit_price ?? 0;
        const total = item.totalPrice ?? item.total_price ?? (unitPrice * qty);
        const rowKey = `bm_${idx}`;
        const overrideTotal = priceOverrides[rowKey];
        const finalTotal = overrideTotal ?? total;
        
        // Build BareMetal label
        const cpu = item.bmCpu || item.cpu || '';
        const ram = item.bmRam || item.ramTier || '';
        const label = item.name || `BareMetal #${idx + 1} (${cpu}, ${ram})`;
        
        rows.push({
          label,
          qty,
          unitPrice,
          subtotal: total,
          baseTotal: total,
          overrideTotal: overrideTotal ?? null,
          finalTotal,
          rowKey,
        });
        subRec += finalTotal;
        
        // IPs for BareMetal
        const ipQty = item.ips || item.ipQty || 0;
        if (ipQty > 0) {
          const ipPrice = 30 * ipQty * qty;
          subIps += ipPrice;
          rows.push({
            label: `IPs Públicos (${ipQty}/servidor)`,
            qty: ipQty * qty,
            unitPrice: 30,
            subtotal: ipPrice,
            finalTotal: ipPrice,
          });
        }
      }
    });
  }

  // Process addons - use snapshot prices when available, otherwise use defaults
  if (dadosProposta.addons) {
    const addons = dadosProposta.addons;
    
    if (addons.antivirus && addons.antivirus > 0) {
      const unitPrice = addons.antivirusPrice ?? 69.9;
      const price = unitPrice * addons.antivirus;
      rows.push({ label: 'Antivírus', qty: addons.antivirus, unitPrice, subtotal: price, finalTotal: price });
      subServices += price;
    }
    
    // Firewall (qtd) - now with quantity support
    const firewallQty = typeof addons.firewall === 'boolean' ? (addons.firewall ? 1 : 0) : (addons.firewall ?? 0);
    if (firewallQty > 0) {
      const unitPrice = addons.firewallPrice ?? 199.9;
      const price = unitPrice * firewallQty;
      rows.push({ label: 'Firewall (qtd)', qty: firewallQty, unitPrice, subtotal: price, finalTotal: price });
      subServices += price;
    }
    
    if (addons.tsplus && addons.tsplus > 0) {
      const unitPrice = addons.tsplusPrice ?? 40;
      const price = unitPrice * addons.tsplus;
      rows.push({ label: 'TSplus', qty: addons.tsplus, unitPrice, subtotal: price, finalTotal: price });
      subServices += price;
    }
    
    if (addons.cal && addons.cal > 0) {
      const unitPrice = addons.calPrice ?? 55;
      const price = unitPrice * addons.cal;
      rows.push({ label: 'CAL RDS', qty: addons.cal, unitPrice, subtotal: price, finalTotal: price });
      subServices += price;
    }
    
    if (addons.winserver && addons.winserver > 0) {
      const unitPrice = addons.winserverPrice ?? 45;
      const price = unitPrice * addons.winserver;
      rows.push({ label: 'WinServer (2vCPU/unid.)', qty: addons.winserver, unitPrice, subtotal: price, finalTotal: price });
      subServices += price;
    }
    
    // SQL Server - CRITICAL: Support sqlQty for quantity
    const sqlType = addons.sql;
    const sqlQty = addons.sqlQty ?? 1;
    if (sqlType && sqlType !== 'none' && sqlQty > 0) {
      const sqlPrices: Record<string, number> = { web: 265, std: 2240, standard: 2240 };
      const sqlLabels: Record<string, string> = { web: 'WEB (2vCPU)', std: 'STD (8vCPU)', standard: 'STD (8vCPU)' };
      // Normalize SQL type
      const normalizedSqlType = sqlType.toLowerCase() === 'standard' ? 'std' : sqlType.toLowerCase();
      const unitPrice = addons.sqlPrice ?? sqlPrices[normalizedSqlType] ?? 0;
      const label = sqlLabels[normalizedSqlType] || sqlType.toUpperCase();
      if (unitPrice > 0) {
        const totalPrice = unitPrice * sqlQty;
        rows.push({ 
          label: `SQL Server ${label}`, 
          qty: sqlQty, 
          unitPrice, 
          subtotal: totalPrice, 
          finalTotal: totalPrice 
        });
        subServices += totalPrice;
      }
    }
    
    if (addons.veeamVm && addons.veeamVm > 0) {
      const unitPrice = addons.veeamVmPrice ?? 50;
      const price = unitPrice * addons.veeamVm;
      rows.push({ label: 'Veeam Backup (VM)', qty: addons.veeamVm, unitPrice, subtotal: price, finalTotal: price });
      subServices += price;
    }
    
    if (addons.veeamAgent && addons.veeamAgent > 0) {
      const unitPrice = addons.veeamAgentPrice ?? 45;
      const price = unitPrice * addons.veeamAgent;
      rows.push({ label: 'Veeam Backup (Agente)', qty: addons.veeamAgent, unitPrice, subtotal: price, finalTotal: price });
      subServices += price;
    }
    
    // Backup - CRITICAL: Properly handle backup plan and GB
    const backupPlan = addons.backupPlan;
    const backupGb = addons.backupGb ?? 0;
    if (backupPlan && backupPlan !== 'none' && backupGb > 0) {
      // Normalize backup plan to retention days
      const retentionDays = backupPlan === '7' || backupPlan === '7_dias' ? '7' :
                            backupPlan === '15' || backupPlan === '15_dias' ? '15' :
                            backupPlan === '30' || backupPlan === '30_dias' ? '30' : backupPlan;
      const price = addons.backupPrice ?? (0.5 * backupGb);
      rows.push({ 
        label: `Backup ${retentionDays} dias (${backupGb}GB)`, 
        qty: 1, 
        unitPrice: price, 
        subtotal: price,
        finalTotal: price,
      });
      subBackup += price;
    }
    
    // Specialized services - Support
    const support = addons.support;
    if (support && typeof support === 'object' && support.level && support.level !== 'none') {
      const price = support.price ?? addons.supportPrice ?? 0;
      if (price > 0) {
        const label = support.level === 'basic' ? 'Suporte Básico' :
                      support.level === 'intermediate' ? 'Suporte Intermediário' : 'Suporte Avançado';
        rows.push({ label, qty: 1, unitPrice: price, subtotal: price, finalTotal: price });
        subServices += price;
      }
    }
    
    // Consulting
    const consulting = addons.consulting;
    if (consulting && typeof consulting === 'object' && consulting.quantity > 0) {
      const qty = consulting.quantity;
      const unitPrice = consulting.unitPrice ?? 200;
      const price = unitPrice * qty;
      rows.push({ label: 'Consultoria Técnica', qty, unitPrice, subtotal: price, finalTotal: price });
      subServices += price;
    }
    
    // DBA
    const dba = addons.dba;
    if (dba && typeof dba === 'object' && dba.quantity > 0) {
      const qty = dba.quantity;
      const unitPrice = dba.unitPrice ?? 250;
      const price = unitPrice * qty;
      rows.push({ label: 'DBA', qty, unitPrice, subtotal: price, finalTotal: price });
      subServices += price;
    }
  }

  // Kubernetes
  if (dadosProposta.kubernetes?.enabled) {
    const k8s = dadosProposta.kubernetes;
    const price = k8s.totalPrice || k8s.price || 0;
    const planLabel = k8s.plan || `${k8s.workerNodes || 0} nodes`;
    rows.push({
      label: `Kubernetes Gerenciado (${planLabel})`,
      qty: 1,
      unitPrice: price,
      subtotal: price,
      finalTotal: price,
    });
    subKubernetes += price;
  }

  // Storage
  if (dadosProposta.storageItems && Array.isArray(dadosProposta.storageItems)) {
    dadosProposta.storageItems.forEach((storage) => {
      const price = storage.totalPrice || storage.price || 0;
      const storageType = storage.storageType || storage.type;
      const typeLabel = storageType === 'sas' ? 'Storage SAS' : 
                        storageType === 's3' ? 'Bucket S3' : 'SSD NVMe';
      const size = storage.volumeTB || storage.size || 0;
      rows.push({
        label: `${typeLabel} (${size}TB)`,
        qty: 1,
        unitPrice: price,
        subtotal: price,
        finalTotal: price,
      });
      subStorage += price;
    });
  }

  // OpenSaaS
  if (dadosProposta.openSaas?.enabled) {
    const saas = dadosProposta.openSaas;
    const pricePerUser = saas.pricePerUser || 49.9;
    const users = saas.users || 0;
    const price = pricePerUser * users;
    rows.push({
      label: `OpenSaaS (${users} usuários)`,
      qty: users,
      unitPrice: pricePerUser,
      subtotal: price,
      finalTotal: price,
    });
    subOpenSaas += price;
  }

  // Calculate discount
  const discountPct = getContractDiscount(contractDuration);
  const subtotalBeforeDiscount = subRec + subIps + subServices + subBackup + subKubernetes + subStorage + subOpenSaas;
  
  // Use proposal total if available, otherwise calculate
  const grandTotal = proposalTotal > 0 ? proposalTotal : subtotalBeforeDiscount * (1 - discountPct);
  const discountValue = subtotalBeforeDiscount - grandTotal;

  return {
    rows,
    subRec,
    subIps,
    subServices,
    subBackup,
    subKubernetes,
    subStorage,
    subOpenSaas,
    discountPct,
    discountValue: discountValue > 0 ? discountValue : 0,
    grandTotal,
    totalServers,
    gpuUsdTotal: 0,
    gpuBrlTotal,
    subtotalPriceList: subtotalBeforeDiscount,
    overValue: 0,
    overPercent: 0,
    totalWithOver: grandTotal,
  };
}

/**
 * Check if dados_proposta has enough data to build a result
 */
export function canBuildResult(dadosProposta: any): boolean {
  if (!dadosProposta) return false;
  
  // Has items or addons = can build
  const hasItems = dadosProposta.items && Array.isArray(dadosProposta.items) && dadosProposta.items.length > 0;
  const hasAddons = dadosProposta.addons && Object.keys(dadosProposta.addons).length > 0;
  const hasKubernetes = dadosProposta.kubernetes?.enabled;
  const hasStorage = dadosProposta.storageItems && dadosProposta.storageItems.length > 0;
  const hasOpenSaas = dadosProposta.openSaas?.enabled;
  
  return hasItems || hasAddons || hasKubernetes || hasStorage || hasOpenSaas;
}
