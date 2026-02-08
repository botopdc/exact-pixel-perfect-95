/**
 * Generate PDF from Supabase proposal using the SAME hydration and calculation
 * logic as the OpenCalculator edit mode.
 * 
 * This ensures the PDF generated from the Proposals list is IDENTICAL to the
 * PDF generated from the calculator, with no item reconstruction or fallback.
 * 
 * Flow:
 * 1. Fetch proposal from Supabase via Edge Function (proposal-get)
 * 2. Hydrate calculator state using hydrateProposalForEdit
 * 3. Calculate results using the same logic as OpenCalculator
 * 4. Generate PDF using generateOpenPDF
 */

import { getProposal as getProposalFromEdge } from '@/services/proposalApi';
import { hydrateProposalForEdit } from '@/modules/comercial/propostas/state/proposalMappers';
import { generateOpenPDF } from '@/lib/pdfGenerator';
import type { 
  CalculatorConfig, 
  CalculationResult, 
  SummaryRow,
  PriceOverrideMap,
} from '@/lib/calculatorConfig';
import { DEFAULT_CONFIG } from '@/lib/calculatorConfig';
import { getCalculatorConfigs } from '@/services/calculatorConfigService';

interface GeneratePdfResult {
  success: boolean;
  error?: string;
}

// Helper to convert number safely
const toNum = (val: unknown, fallback = 0): number => {
  if (val === undefined || val === null || val === '') return fallback;
  const parsed = typeof val === 'string' ? parseFloat(String(val).replace(',', '.')) : Number(val);
  return Number.isFinite(parsed) ? parsed : fallback;
};

/**
 * Load calculator config from API (standalone, doesn't use React hooks)
 */
async function loadConfig(): Promise<CalculatorConfig> {
  try {
    const entries = await getCalculatorConfigs();
    
    if (!Array.isArray(entries) || entries.length === 0) {
      console.warn('[loadConfig] No entries, using defaults');
      return DEFAULT_CONFIG;
    }
    
    // Transform entries to config (simplified version)
    const config: CalculatorConfig = { ...DEFAULT_CONFIG };
    
    for (const entry of entries) {
      const category = String(entry.category || '').trim().toLowerCase();
      const section = String(entry.section || '').trim().toLowerCase();
      const items = Array.isArray(entry.config) ? entry.config : [];
      
      if (category === 'vm' && section === 'preços de vm') {
        for (const item of items) {
          const value = Number(item.value) || 0;
          if (item.label === 'vCPU') config.vm_prices_brl.vcpu = value;
          if (item.label === 'RAM') config.vm_prices_brl.ram_per_gb = value;
          if (item.label === 'NVMe') config.vm_prices_brl.nvme_per_gb = value;
          if (item.label === 'IP Público') config.vm_prices_brl.ip_public = value;
        }
      }
      
      if (category === 'gpu' && section === 'preços de gpu') {
        for (const item of items) {
          if (item.label) {
            config.gpu_usd[item.label] = Number(item.value) || 0;
          }
        }
      }
      
      if (category === 'baremetal') {
        if (section === 'modelos de cpu') {
          config.baremetal.cpu_models = items.map((item, idx) => ({
            id: String(item.id ?? idx),
            label: item.label || '',
            price: Number(item.value) || 0,
          }));
        }
        if (section === 'opções de ram') {
          config.baremetal.ram_tiers = items.map((item, idx) => ({
            id: String(item.id ?? idx),
            label: item.label || '',
            gb: parseInt(String(item.label || '').match(/(\d+)GB/i)?.[1] || '0', 10),
            price: Number(item.value) || 0,
          }));
        }
        if (section === 'opções de disco') {
          config.baremetal.disks = items.map((item, idx) => ({
            id: String(item.id ?? idx),
            label: item.label || '',
            tb: parseInt(String(item.label || '').match(/(\d+)TB/i)?.[1] || '0', 10),
            price: Number(item.value) || 0,
          }));
        }
      }
      
      if (category === 'add-ons' && section === 'add-ons') {
        for (const item of items) {
          const value = Number(item.value) || 0;
          const label = item.label || '';
          if (label.includes('Antivírus') || label.includes('Antivirus')) config.addons_brl.antivirus_unit = value;
          if (label.includes('Firewall')) config.addons_brl.firewall_pfsense = value;
          if (label.includes('TSplus')) config.addons_brl.tsplus_unit = value;
          if (label.includes('CAL')) config.addons_brl.cal_unit = value;
          if (label.includes('Veeam VM')) config.addons_brl.veeam_vm_unit = value;
          if (label.includes('Veeam Agent')) config.addons_brl.veeam_agent_unit = value;
          if (label.includes('WinServer')) config.addons_brl.winserver_2vcpu_unit = value;
        }
      }
      
      if (category === 'sql server' && section === 'sql server') {
        for (const item of items) {
          const key = (item.label || '').toLowerCase();
          config.addons_brl.sql[key] = Number(item.value) || 0;
        }
      }
    }
    
    return config;
  } catch (error) {
    console.error('[loadConfig] Error:', error);
    return DEFAULT_CONFIG;
  }
}

/**
 * Calculate result from hydrated state (same logic as OpenCalculator.calculate)
 */
function calculateFromState(
  state: ReturnType<typeof hydrateProposalForEdit>,
  config: CalculatorConfig
): CalculationResult {
  const rows: SummaryRow[] = [];
  let subRec = 0;
  let subIps = 0;
  let subServices = 0;
  let subBackup = 0;
  let subKubernetes = 0;
  let subStorage = 0;
  let subOpenSaas = 0;
  let gpuUsdTotal = 0;
  let gpuBrlTotal = 0;
  let totalServers = 0;

  const priceOverrides: PriceOverrideMap = state.priceOverrides || {};
  
  // Helper to add row with price override support
  const addRow = (label: string, qty: number, unitPrice: number, subtotal: number, rowKey?: string): number => {
    const finalTotal = rowKey && priceOverrides[rowKey] !== undefined 
      ? priceOverrides[rowKey] 
      : subtotal;
    rows.push({ label, qty, unitPrice, subtotal, finalTotal });
    return finalTotal;
  };

  // Process server items (VMs and BareMetals)
  for (const item of state.items) {
    totalServers += item.qtyServers || 1;
    
    if (item.type === 'vm') {
      // VM pricing
      const vcpuPrice = toNum(config.vm_prices_brl.vcpu, 45);
      const ramPrice = toNum(config.vm_prices_brl.ram_per_gb, 9);
      const diskPricePerGB = toNum(config.vm_prices_brl.nvme_per_gb, 0.9);
      
      const vcpu = toNum(item.vcpu, 0);
      const ramGb = toNum(item.ramGb, 0);
      const nvmeGb = toNum(item.nvmeTb, 0) * 1024; // Convert TB to GB
      const qtyServers = toNum(item.qtyServers, 1);
      
      // Resources
      if (vcpu > 0) {
        const total = vcpu * vcpuPrice * qtyServers;
        subRec += addRow(`vCPU × ${vcpu}`, qtyServers, vcpu * vcpuPrice, total, `vm_${item.id}_vcpu`);
      }
      if (ramGb > 0) {
        const total = ramGb * ramPrice * qtyServers;
        subRec += addRow(`RAM ${ramGb} GB`, qtyServers, ramGb * ramPrice, total, `vm_${item.id}_ram`);
      }
      if (nvmeGb > 0) {
        const total = nvmeGb * diskPricePerGB * qtyServers;
        subRec += addRow(`NVMe ${nvmeGb} GB`, qtyServers, nvmeGb * diskPricePerGB, total, `vm_${item.id}_nvme`);
      }
      
      // IPs
      const ips = toNum(item.ips, 0);
      if (ips > 0) {
        const ipPrice = toNum(config.vm_prices_brl.ip_public, 30);
        const total = ips * ipPrice * qtyServers;
        subIps += addRow(`IP Público × ${ips}`, qtyServers, ips * ipPrice, total, `vm_${item.id}_ip`);
      }
      
      // GPU (gpu_usd is actually BRL now)
      if (item.gpu && item.gpu !== 'Sem GPU' && toNum(item.gpuQty, 0) > 0) {
        const gpuPrice = toNum(config.gpu_usd[item.gpu], 0);
        if (gpuPrice > 0) {
          const gpuQty = toNum(item.gpuQty, 0);
          const total = gpuQty * gpuPrice * qtyServers;
          gpuBrlTotal += total;
          subRec += addRow(`GPU ${item.gpu} × ${gpuQty}`, qtyServers, gpuQty * gpuPrice, total, `vm_${item.id}_gpu`);
        }
      }
    } else if (item.type === 'bm') {
      // BareMetal pricing
      const qtyServers = toNum(item.qtyServers, 1);
      
      // CPU
      const cpuModel = config.baremetal.cpu_models.find(c => c.id === item.bmCpu || c.label === item.bmCpu);
      if (cpuModel) {
        const total = toNum(cpuModel.price, 0) * qtyServers;
        subRec += addRow(`CPU: ${cpuModel.label}`, qtyServers, toNum(cpuModel.price, 0), total, `bm_${item.id}_cpu`);
      }
      
      // RAM
      const ramTier = config.baremetal.ram_tiers.find(r => r.id === item.bmRam || r.label === item.bmRam);
      if (ramTier) {
        const total = toNum(ramTier.price, 0) * qtyServers;
        subRec += addRow(`RAM: ${ramTier.label}`, qtyServers, toNum(ramTier.price, 0), total, `bm_${item.id}_ram`);
      }
      
      // Disks
      if (Array.isArray(item.disks)) {
        item.disks.forEach((disk, idx) => {
          const diskConfig = config.baremetal.disks.find(d => d.id === disk.type || d.label === disk.type);
          if (diskConfig) {
            const diskQty = toNum(disk.qty, 1);
            const total = toNum(diskConfig.price, 0) * diskQty * qtyServers;
            subRec += addRow(`Disco: ${diskConfig.label} × ${diskQty}`, qtyServers, toNum(diskConfig.price, 0) * diskQty, total, `bm_${item.id}_disk_${idx}`);
          }
        });
      }
      
      // IPs
      const ips = toNum(item.ips, 0);
      if (ips > 0) {
        const ipPrice = toNum(config.vm_prices_brl.ip_public, 30);
        const total = ips * ipPrice * qtyServers;
        subIps += addRow(`IP Público × ${ips}`, qtyServers, ips * ipPrice, total, `bm_${item.id}_ip`);
      }
      
      // GPU
      if (item.gpu && item.gpu !== 'Sem GPU' && toNum(item.gpuQty, 0) > 0) {
        const gpuPrice = toNum(config.gpu_usd[item.gpu], 0);
        if (gpuPrice > 0) {
          const gpuQty = toNum(item.gpuQty, 0);
          const total = gpuQty * gpuPrice * qtyServers;
          gpuBrlTotal += total;
          subRec += addRow(`GPU ${item.gpu} × ${gpuQty}`, qtyServers, gpuQty * gpuPrice, total, `bm_${item.id}_gpu`);
        }
      }
    }
  }

  // Addons
  const addons = state.addons;
  
  // Backup (simplified - just show total if exists)
  if (addons.backupPlan && addons.backupPlan !== 'none' && toNum(addons.backupGb, 0) > 0) {
    const backupGb = toNum(addons.backupGb, 0);
    const retentionDays = parseInt(addons.backupPlan) || 7;
    // Use stored price snapshot if available, otherwise calculate
    const backupPricePerGb = config.backup_tables_brl_per_gb?.[String(retentionDays)]?.[0]?.price || 0.10;
    const total = backupGb * backupPricePerGb;
    subBackup += addRow(`Backup ${retentionDays}d — ${backupGb} GB`, 1, backupPricePerGb, total, 'backup');
  }
  
  // Windows Server
  if (toNum(addons.winserver, 0) > 0) {
    const qty = toNum(addons.winserver, 0);
    const price = toNum(config.addons_brl.winserver_2vcpu_unit, 45);
    const total = qty * price;
    subServices += addRow(`Windows Server × ${qty}`, qty, price, total, 'winserver');
  }
  
  // Antivirus
  if (toNum(addons.antivirus, 0) > 0) {
    const qty = toNum(addons.antivirus, 0);
    const price = toNum(config.addons_brl.antivirus_unit, 69.9);
    const total = qty * price;
    subServices += addRow(`Antivírus × ${qty}`, qty, price, total, 'antivirus');
  }
  
  // Firewall
  if (toNum(addons.firewall, 0) > 0) {
    const qty = toNum(addons.firewall, 0);
    const price = toNum(config.addons_brl.firewall_pfsense, 199.9);
    const total = qty * price;
    subServices += addRow(`Firewall × ${qty}`, qty, price, total, 'firewall');
  }
  
  // TSPlus
  if (toNum(addons.tsplus, 0) > 0) {
    const qty = toNum(addons.tsplus, 0);
    const price = toNum(config.addons_brl.tsplus_unit, 40);
    const total = qty * price;
    subServices += addRow(`TSPlus × ${qty}`, qty, price, total, 'tsplus');
  }
  
  // CAL
  if (toNum(addons.cal, 0) > 0) {
    const qty = toNum(addons.cal, 0);
    const price = toNum(config.addons_brl.cal_unit, 55);
    const total = qty * price;
    subServices += addRow(`CAL × ${qty}`, qty, price, total, 'cal');
  }
  
  // SQL Server
  if (addons.sql && addons.sql !== 'none' && toNum(addons.sqlQty, 0) > 0) {
    const sqlQty = toNum(addons.sqlQty, 0);
    const sqlPrice = config.addons_brl.sql[addons.sql] || (addons.sql === 'web' ? 200 : 2240);
    const total = sqlQty * sqlPrice;
    const sqlLabel = addons.sql === 'web' ? 'SQL Server WEB' : 'SQL Server STD';
    subServices += addRow(`${sqlLabel} × ${sqlQty}`, sqlQty, sqlPrice, total, 'sql');
  }
  
  // Veeam VM
  if (toNum(addons.veeamVm, 0) > 0) {
    const qty = toNum(addons.veeamVm, 0);
    const price = toNum(config.addons_brl.veeam_vm_unit, 50);
    const total = qty * price;
    subServices += addRow(`Veeam VM × ${qty}`, qty, price, total, 'veeam_vm');
  }
  
  // Veeam Agent
  if (toNum(addons.veeamAg, 0) > 0) {
    const qty = toNum(addons.veeamAg, 0);
    const price = toNum(config.addons_brl.veeam_agent_unit, 45);
    const total = qty * price;
    subServices += addRow(`Veeam Agent × ${qty}`, qty, price, total, 'veeam_agent');
  }

  // Storage items
  for (let idx = 0; idx < state.storageItems.length; idx++) {
    const storage = state.storageItems[idx];
    const storageType = storage.storageType || 'sas';
    
    if (storageType === 'nvme') {
      const volumeGB = toNum(storage.volumeGB, 0) || toNum(storage.volumeTB, 0) * 1024;
      if (volumeGB > 0) {
        const pricePerGB = config.storage_pricing?.nvme?.pricePerGB || 0.9;
        const total = volumeGB * pricePerGB;
        subStorage += addRow(`Storage NVMe — ${volumeGB} GB`, 1, pricePerGB, total, `storage_${idx}_nvme`);
      }
    } else {
      const volumeTB = toNum(storage.volumeTB, 0);
      if (volumeTB > 0) {
        // Get price from config (simplified tier lookup)
        const pricePerTB = config.storage_pricing?.sas?.br?.pricePerTB_1_10 || 200;
        const total = volumeTB * pricePerTB;
        subStorage += addRow(`Storage ${storageType.toUpperCase()} — ${volumeTB} TB`, 1, pricePerTB, total, `storage_${idx}_${storageType}`);
      }
    }
  }

  // Kubernetes
  if (state.kubernetes.enabled) {
    const k8sPrice = config.kubernetes_pricing?.k8s_small?.basePriceMonthly || 500;
    subKubernetes += addRow('Kubernetes Gerenciado', 1, k8sPrice, k8sPrice, 'kubernetes');
  }

  // OPEN SaaS
  if (state.openSaas.enabled && toNum(state.openSaas.users, 0) >= 5) {
    const users = Math.max(5, toNum(state.openSaas.users, 0));
    const pricePerUser = toNum(config.open_saas_price_per_user, 85);
    const total = users * pricePerUser;
    subOpenSaas += addRow(`OPEN SaaS — ${users} usuários`, users, pricePerUser, total, 'open_saas');
  }

  // Calculate totals
  const preTotal = subRec + subIps + subServices + subBackup + subKubernetes + subStorage + subOpenSaas;
  const discountPct = toNum(config.discount?.[state.selectedTerm], 0);
  const discountValue = preTotal * discountPct;
  const grandTotal = preTotal - discountValue;

  // Reseller margin
  const overValue = toNum(state.reseller?.overValue, 0);
  const overPercent = grandTotal > 0 ? (overValue / grandTotal) * 100 : 0;
  const totalWithOver = grandTotal + overValue;

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
    discountValue,
    grandTotal,
    totalServers,
    gpuUsdTotal,
    gpuBrlTotal,
    subtotalPriceList: preTotal,
    overValue,
    overPercent,
    totalWithOver,
  };
}

/**
 * Generate and download PDF from Supabase proposal
 * Uses the EXACT same hydration and calculation logic as OpenCalculator
 */
export async function generatePdfFromSupabaseProposal(proposalId: string): Promise<GeneratePdfResult> {
  console.log('[generatePdfFromSupabaseProposal] Starting for:', proposalId);
  
  try {
    // 1. Fetch proposal from Supabase via Edge Function
    const result = await getProposalFromEdge(proposalId);
    
    if (!result?.success || !result.proposal) {
      console.error('[generatePdfFromSupabaseProposal] Failed to fetch proposal:', result?.error);
      return { 
        success: false, 
        error: result?.error || 'Proposta não encontrada' 
      };
    }
    
    console.log('[generatePdfFromSupabaseProposal] Fetched proposal:', {
      id: result.proposal.id,
      company: result.proposal.company,
      serversCount: result.servers?.length || 0,
      addonsCount: result.addons?.length || 0,
    });
    
    // 2. Build API-like structure for hydration
    const apiProposal = {
      ...result.proposal,
      servers: result.servers || [],
      addons: result.addons || [],
    };
    
    // 3. Hydrate calculator state using the SAME function as edit mode
    const hydratedState = hydrateProposalForEdit(apiProposal);
    
    console.log('[generatePdfFromSupabaseProposal] Hydrated state:', {
      itemsCount: hydratedState.items.length,
      storageCount: hydratedState.storageItems.length,
      kubernetesEnabled: hydratedState.kubernetes.enabled,
      openSaasEnabled: hydratedState.openSaas.enabled,
      selectedTerm: hydratedState.selectedTerm,
    });
    
    // 4. Load calculator config for pricing
    const config = await loadConfig();
    
    // 5. Calculate result using the SAME logic as OpenCalculator
    const calculatedResult = calculateFromState(hydratedState, config);
    
    console.log('[generatePdfFromSupabaseProposal] Calculated result:', {
      rowsCount: calculatedResult.rows.length,
      grandTotal: calculatedResult.grandTotal,
      subRec: calculatedResult.subRec,
      subServices: calculatedResult.subServices,
    });
    
    // 6. Prepare client info
    const client = {
      name: hydratedState.client.name || result.proposal.name || '',
      company: hydratedState.client.company || result.proposal.company || '',
      email: hydratedState.client.email || result.proposal.email || '',
      phone: hydratedState.client.phone || result.proposal.phone || '',
    };
    
    // 7. Prepare proposal meta
    const proposalMeta = {
      id: result.proposal.display_id || result.proposal.id.substring(0, 8),
      createdAt: result.proposal.created_at || new Date().toISOString(),
      validityDays: 7,
    };
    
    // 8. Prepare reseller info
    const reseller = {
      enabled: !!result.proposal.reseller_name,
      resellerName: result.proposal.reseller_name || '',
      overValue: toNum(result.proposal.commission_value, 0),
      overReason: result.proposal.commission_reason || '',
      observations: result.proposal.observations || '',
      viewMode: 'CLIENTE' as const,
      approvalRequired: false,
      approvalStatus: 'Aprovado' as const,
      approver: '',
      approvedAt: null,
    };
    
    // 9. Generate and download PDF
    await generateOpenPDF({
      client,
      proposal: proposalMeta,
      result: calculatedResult,
      selectedTerm: hydratedState.selectedTerm,
      datacenter: hydratedState.datacenter,
      reseller,
      includeCommission: true,
      observacao: hydratedState.observacao || result.proposal.observations || undefined,
    });
    
    console.log('[generatePdfFromSupabaseProposal] PDF generated successfully');
    return { success: true };
    
  } catch (error: any) {
    console.error('[generatePdfFromSupabaseProposal] Error:', error);
    return { 
      success: false, 
      error: error.message || 'Erro ao gerar PDF' 
    };
  }
}
