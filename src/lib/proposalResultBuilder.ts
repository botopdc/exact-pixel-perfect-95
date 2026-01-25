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
    vcpu?: number;
    ram?: number;
    nvme?: number;
    qty?: number;
    ipQty?: number;
    gpu?: string;
    gpuQty?: number;
    cpu?: string;
    ramTier?: string;
    disks?: Array<{ label: string; tb: number }>;
    unitPrice?: number;
    totalPrice?: number;
  }>;
  addons?: {
    antivirus?: number;
    antivirusPrice?: number;
    firewall?: boolean;
    firewallPrice?: number;
    tsplus?: number;
    tsplusPrice?: number;
    cal?: number;
    calPrice?: number;
    winserver?: number;
    winserverPrice?: number;
    sql?: string;
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
  };
  kubernetes?: {
    enabled?: boolean;
    workerNodes?: number;
    nodeVcpu?: number;
    nodeRam?: number;
    totalPrice?: number;
  };
  storageItems?: Array<{
    type: string;
    region: string;
    size: number;
    totalPrice?: number;
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
  if (dadosProposta.items && Array.isArray(dadosProposta.items)) {
    dadosProposta.items.forEach((item, idx) => {
      const qty = item.qty || 1;
      totalServers += qty;
      
      if (item.type === 'VM') {
        // CRITICAL: Use stored unitPrice and totalPrice from snapshot
        const unitPrice = item.unitPrice ?? 0;
        const total = item.totalPrice ?? (unitPrice * qty);
        const rowKey = `vm_${idx}`;
        const overrideTotal = priceOverrides[rowKey];
        const finalTotal = overrideTotal ?? total;
        
        // Log if prices are missing for debugging
        if (unitPrice === 0 && total === 0) {
          console.warn('[proposalResultBuilder] VM item has zero prices:', item.name || `VM ${idx}`);
        }
        
        const label = item.name || `VM ${item.vcpu || 0}vCPU / ${item.ram || 0}GB RAM / ${item.nvme || 0}GB NVMe`;
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
        if (item.gpu && item.gpu !== 'Sem GPU' && item.gpuQty) {
          // GPU pricing would need config - estimate from total if available
        }
        
        // IPs
        if (item.ipQty && item.ipQty > 0) {
          const ipPrice = 30 * item.ipQty * qty; // Default IP price
          subIps += ipPrice;
          rows.push({
            label: `IPs Públicos (${item.ipQty}/servidor)`,
            qty: item.ipQty * qty,
            unitPrice: 30,
            subtotal: ipPrice,
            finalTotal: ipPrice,
          });
        }
      } else if (item.type === 'BareMetal') {
        // CRITICAL: Use stored unitPrice and totalPrice from snapshot
        const unitPrice = item.unitPrice ?? 0;
        const total = item.totalPrice ?? (unitPrice * qty);
        const rowKey = `bm_${idx}`;
        const overrideTotal = priceOverrides[rowKey];
        const finalTotal = overrideTotal ?? total;
        
        // Log if prices are missing for debugging
        if (unitPrice === 0 && total === 0) {
          console.warn('[proposalResultBuilder] BareMetal item has zero prices:', item.name || `BM ${idx}`);
        }
        
        const label = item.name || `BareMetal ${item.cpu || ''} / ${item.ramTier || ''}`;
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
    
    if (addons.sql && addons.sql !== 'none') {
      const sqlPrices: Record<string, number> = { web: 265, std: 2240 };
      const sqlLabels: Record<string, string> = { web: 'WEB (2vCPU)', std: 'STD (8vCPU)' };
      const unitPrice = addons.sqlPrice ?? sqlPrices[addons.sql] ?? 0;
      const label = sqlLabels[addons.sql] || addons.sql.toUpperCase();
      if (unitPrice > 0) {
        rows.push({ label: `SQL Server ${label}`, qty: 1, unitPrice, subtotal: unitPrice, finalTotal: unitPrice });
        subServices += unitPrice;
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
    
    // Backup - use snapshot price or default to 0.5/GB
    if (addons.backupPlan && addons.backupPlan !== 'none' && addons.backupGb) {
      const price = addons.backupPrice ?? (0.5 * addons.backupGb);
      rows.push({ 
        label: `Backup ${addons.backupRetention || addons.backupPlan || '7'} dias (${addons.backupGb}GB)`, 
        qty: 1, 
        unitPrice: price, 
        subtotal: price,
        finalTotal: price,
      });
      subBackup += price;
    }
    
    // Specialized services - use snapshot prices when available
    if (addons.supportLevel && addons.supportLevel !== 'none') {
      const supportPrices: Record<string, number> = { basic: 1, intermediate: 500, advanced: 900 };
      const price = addons.supportPrice ?? supportPrices[addons.supportLevel] ?? 0;
      if (price > 0) {
        const label = addons.supportLevel === 'basic' ? 'Suporte Básico' :
                      addons.supportLevel === 'intermediate' ? 'Suporte Intermediário' : 'Suporte Avançado';
        rows.push({ label, qty: 1, unitPrice: price, subtotal: price, finalTotal: price });
        subServices += price;
      }
    }
    
    if (addons.consultingHours && addons.consultingHours > 0) {
      const unitPrice = addons.consultingPrice ? (addons.consultingPrice / addons.consultingHours) : 200;
      const price = addons.consultingPrice ?? (200 * addons.consultingHours);
      rows.push({ label: 'Consultoria Técnica', qty: addons.consultingHours, unitPrice, subtotal: price, finalTotal: price });
      subServices += price;
    }
    
    if (addons.dbaHours && addons.dbaHours > 0) {
      const unitPrice = addons.dbaPrice ? (addons.dbaPrice / addons.dbaHours) : 250;
      const price = addons.dbaPrice ?? (250 * addons.dbaHours);
      rows.push({ label: 'DBA', qty: addons.dbaHours, unitPrice, subtotal: price, finalTotal: price });
      subServices += price;
    }
  }

  // Kubernetes
  if (dadosProposta.kubernetes?.enabled) {
    const k8s = dadosProposta.kubernetes;
    const price = k8s.totalPrice || 0;
    rows.push({
      label: `Kubernetes Gerenciado (${k8s.workerNodes || 0} nodes)`,
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
      const price = storage.totalPrice || 0;
      const typeLabel = storage.type === 'sas' ? 'Storage SAS' : 
                        storage.type === 's3' ? 'Bucket S3' : 'SSD NVMe';
      rows.push({
        label: `${typeLabel} (${storage.size}TB)`,
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
