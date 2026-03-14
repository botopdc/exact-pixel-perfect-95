/**
 * useSaveProposalToSupabase - Hook for saving proposals DIRECTLY to Supabase
 * 
 * This hook replaces the API-based useSaveProposal for the new autonomous proposal system.
 * Supabase is now the SOURCE OF TRUTH for proposals.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { SUPABASE_PROPOSAL_KEYS } from '@/hooks/useSupabaseProposals';
import type { SaveProposalPayload, SaveProposalServer, SaveProposalAddon } from '@/types/calculatorProposal';
import type { ServerItem, VMItem, BMItem, StorageItem, AddonsState, KubernetesState, OpenSaaSState, ResellerState, CalculationResult, ClientInfo, ProposalMeta } from '@/lib/calculatorConfig';
import { generateProposalId } from '@/lib/calculatorConfig';
import { generateOpenPDFBlob } from '@/lib/pdfGenerator';
import { uploadPdfToStorage } from '@/services/supabaseProposalService';

// ============================================================================
// LOGGING: Environment check
// ============================================================================
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
if (import.meta.env.DEV) {
  console.log('[Supabase] URL prefix:', SUPABASE_URL.substring(0, 30) + '...');
}

// ============================================================================
// CONVERT CALCULATOR STATE TO SUPABASE PAYLOAD
// ============================================================================

interface CalculatorSaveInput {
  // Proposal header
  proposalId?: string; // UUID for update, undefined for create
  displayId?: string;
  fx: number;
  selectedTerm: string;
  datacenter: string;
  client: { name: string; company: string; phone: string; email: string };
  proposal: { id?: string; validityDays?: number };
  total: number;
  // Items
  items: ServerItem[];
  storageItems: StorageItem[];
  // Features
  kubernetes: KubernetesState;
  openSaas: OpenSaaSState;
  addons: AddonsState;
  reseller: ResellerState;
  // Result (for snapshot)
  result?: CalculationResult | null;
  // Observacoes
  observacao?: string;
  // Price overrides
  priceOverrides?: Record<string, number>;
}

export function convertCalculatorToSupabasePayload(input: CalculatorSaveInput): SaveProposalPayload {
  const {
    proposalId,
    displayId,
    fx,
    selectedTerm,
    datacenter,
    client,
    proposal,
    total,
    items,
    storageItems,
    kubernetes,
    openSaas,
    addons,
    reseller,
    result,
    observacao,
    priceOverrides,
  } = input;

  // ============================================================================
  // BUILD PRICE MAPS FROM result.rows USING rowKey (stable key, not label match)
  // ============================================================================
  
  // Map rowKey → { unitPrice, finalTotal }
  const rowByKey: Record<string, { unitPrice: number; finalTotal: number }> = {};
  if (result?.rows) {
    result.rows.forEach((row: any) => {
      if (row.rowKey) {
        rowByKey[row.rowKey] = {
          unitPrice: row.unitPrice || 0,
          finalTotal: row.finalTotal ?? row.subtotal ?? 0,
        };
      }
    });
  }
  
  // Sum all rows matching a prefix (e.g., "vm_0" sums vm_0_cpu + vm_0_ram + vm_0_nvme + ...)
  const sumByPrefix = (prefix: string): { unit: number; total: number } => {
    let unit = 0;
    let total = 0;
    Object.entries(rowByKey).forEach(([key, val]) => {
      if (key.startsWith(prefix + '_') || key === prefix) {
        unit += val.unitPrice;
        total += val.finalTotal;
      }
    });
    return { unit, total };
  };

  // Get exact row price by rowKey
  const getRowPrice = (rowKey: string): { unit: number; total: number } => {
    const r = rowByKey[rowKey];
    return r ? { unit: r.unitPrice, total: r.finalTotal } : { unit: 0, total: 0 };
  };

  // Build servers array from items + storageItems
  const servers: SaveProposalServer[] = [];

  // Process VM/BM items — sum all sub-rows (cpu, ram, nvme, traffic, gpu) per item
  items.forEach((item, idx) => {
    if (item.type === 'vm') {
      const vm = item as VMItem;
      const prefix = `vm_${idx}`;
      const prices = sumByPrefix(prefix);
      const qtyServers = vm.qtyServers || 1;
      
      // Override check
      const rowKey = `item-${item.id}`;
      const overridePrice = priceOverrides?.[rowKey];
      
      const unitPrice = overridePrice ?? (qtyServers > 0 ? prices.total / qtyServers : prices.total);
      const totalPrice = overridePrice ? overridePrice * qtyServers : prices.total;
      
      servers.push({
        server_type: 'vm',
        name: `VM #${idx + 1}`,
        gpu: vm.gpu || 'Sem GPU',
        gpu_qty: vm.gpuQty || 0,
        vcpu: vm.vcpu || 0,
        ram_gb: vm.ramGb || 0,
        nvme_tb: vm.nvmeTb || 0,
        traffic_tb: vm.trafficTb || 0,
        ips: vm.ips || 1,
        qty_servers: qtyServers,
        unit_price: unitPrice,
        total_price: totalPrice,
        specs: {
          gpu: vm.gpu,
          gpuQty: vm.gpuQty,
          vcpu: vm.vcpu,
          ramGb: vm.ramGb,
          nvmeTb: vm.nvmeTb,
        },
      });
    } else if (item.type === 'bm') {
      const bm = item as BMItem;
      const prefix = `bm_${idx}`;
      const prices = sumByPrefix(prefix);
      const qtyServers = bm.qtyServers || 1;
      
      const rowKey = `item-${item.id}`;
      const overridePrice = priceOverrides?.[rowKey];
      
      const unitPrice = overridePrice ?? (qtyServers > 0 ? prices.total / qtyServers : prices.total);
      const totalPrice = overridePrice ? overridePrice * qtyServers : prices.total;
      
      servers.push({
        server_type: 'bm',
        name: `BareMetal #${idx + 1}`,
        gpu: bm.gpu || 'Sem GPU',
        gpu_qty: bm.gpuQty || 0,
        vcpu: 0,
        ram_gb: 0,
        nvme_tb: 0,
        traffic_tb: bm.trafficTb || 0,
        ips: bm.ips || 1,
        qty_servers: qtyServers,
        bm_cpu: bm.bmCpu || null,
        bm_ram: bm.bmRam || null,
        disks: bm.disks || [],
        unit_price: unitPrice,
        total_price: totalPrice,
        specs: {
          bmCpu: bm.bmCpu,
          bmRam: bm.bmRam,
          disks: bm.disks,
        },
      });
    }
  });

  // Process storage items — use rowKey pattern: storage_{idx}_{type}
  storageItems.forEach((storage, idx) => {
    const storageType = storage.storageType || 'sas';
    const rowKey = `storage_${idx}_${storageType}`;
    const prices = getRowPrice(rowKey);
    
    servers.push({
      server_type: 'storage',
      name: `Storage ${storageType.toUpperCase()} #${idx + 1}`,
      storage_type: storageType,
      storage_region: storage.region || 'BR',
      volume_tb: storage.volumeTB || (storage.volumeGB ? (storage.volumeGB || 0) / 1024 : 0),
      vcpu: 0,
      ram_gb: 0,
      nvme_tb: 0,
      traffic_tb: 0,
      ips: 0,
      qty_servers: 1,
      unit_price: prices.unit,
      total_price: prices.total,
    });
  });

  // ============================================================================
  // BUILD ADDONS — use rowKey-based price lookup (no label matching)
  // ============================================================================
  const addonsArray: SaveProposalAddon[] = [];
  
  // Mapping: addon_key → rowKey used by calculator
  const addonRowKeyMap: Record<string, string> = {
    antivirus: 'svc_antivirus',
    firewall: 'svc_firewall',
    tsplus: 'svc_tsplus',
    cal: 'svc_cal',
    veeam_vm: 'svc_veeam_vm',
    veeam_agent: 'svc_veeam_agent',
    winserver: 'svc_winserver',
    support: 'svc_support',
    consulting: 'svc_consulting',
    dba: 'svc_dba',
  };

  // Backup
  if (addons.backupPlan && addons.backupPlan !== 'none') {
    const backupRowKey = `backup_${addons.backupPlan}`;
    const price = getRowPrice(backupRowKey);
    addonsArray.push({
      addon_key: 'backup',
      label: `Backup ${addons.backupPlan} (${addons.backupGb} GB)`,
      enabled: true,
      quantity: addons.backupGb || 1,
      unit_price: price.unit,
      total_price: price.total,
      metadata: { plan: addons.backupPlan, gb: addons.backupGb },
    });
  }

  // Simple addons (quantity-based)
  if (addons.antivirus > 0) {
    const p = getRowPrice(addonRowKeyMap.antivirus);
    addonsArray.push({ addon_key: 'antivirus', label: 'Antivírus', enabled: true, quantity: addons.antivirus, unit_price: p.unit, total_price: p.total });
  }
  if (addons.firewall > 0) {
    const p = getRowPrice(addonRowKeyMap.firewall);
    addonsArray.push({ addon_key: 'firewall', label: 'Firewall', enabled: true, quantity: addons.firewall, unit_price: p.unit, total_price: p.total });
  }
  if (addons.sql && addons.sql !== 'none' && addons.sqlQty > 0) {
    const sqlRowKey = `svc_sql_${addons.sql}`;
    const p = getRowPrice(sqlRowKey);
    addonsArray.push({ addon_key: 'sql', label: `SQL Server ${addons.sql}`, enabled: true, quantity: addons.sqlQty, unit_price: p.unit, total_price: p.total, metadata: { type: addons.sql } });
  }
  if (addons.veeamVm > 0) {
    const p = getRowPrice(addonRowKeyMap.veeam_vm);
    addonsArray.push({ addon_key: 'veeam_vm', label: 'Veeam (VM)', enabled: true, quantity: addons.veeamVm, unit_price: p.unit, total_price: p.total });
  }
  if (addons.veeamAg > 0) {
    const p = getRowPrice(addonRowKeyMap.veeam_agent);
    addonsArray.push({ addon_key: 'veeam_agent', label: 'Veeam (Agent)', enabled: true, quantity: addons.veeamAg, unit_price: p.unit, total_price: p.total });
  }
  if (addons.winserver > 0) {
    const p = getRowPrice(addonRowKeyMap.winserver);
    addonsArray.push({ addon_key: 'winserver', label: 'Windows Server', enabled: true, quantity: addons.winserver, unit_price: p.unit, total_price: p.total });
  }
  if (addons.tsplus && addons.tsplus > 0) {
    const p = getRowPrice(addonRowKeyMap.tsplus);
    addonsArray.push({ addon_key: 'tsplus', label: 'TSPlus', enabled: true, quantity: addons.tsplus, unit_price: p.unit, total_price: p.total });
  }
  if (addons.cal && addons.cal > 0) {
    const p = getRowPrice(addonRowKeyMap.cal);
    addonsArray.push({ addon_key: 'cal', label: 'CAL', enabled: true, quantity: addons.cal, unit_price: p.unit, total_price: p.total });
  }

  // Support
  if (addons.support?.level && addons.support.level !== 'none') {
    const p = getRowPrice(addonRowKeyMap.support);
    addonsArray.push({
      addon_key: 'support',
      label: `Suporte ${addons.support.level}`,
      enabled: true,
      quantity: 1,
      unit_price: p.total > 0 ? p.total : (addons.support.price || 0),
      total_price: p.total > 0 ? p.total : (addons.support.price || 0),
      metadata: { level: addons.support.level },
    });
  }

  // Consulting
  if (addons.consulting?.quantity > 0) {
    const p = getRowPrice(addonRowKeyMap.consulting);
    addonsArray.push({
      addon_key: 'consulting',
      label: 'Consultoria',
      enabled: true,
      quantity: addons.consulting.quantity,
      unit_price: p.unit > 0 ? p.unit : (addons.consulting.unitPrice || 200),
      total_price: p.total > 0 ? p.total : addons.consulting.quantity * (addons.consulting.unitPrice || 200),
    });
  }

  // DBA
  if (addons.dba?.quantity > 0) {
    const p = getRowPrice(addonRowKeyMap.dba);
    addonsArray.push({
      addon_key: 'dba',
      label: 'DBA',
      enabled: true,
      quantity: addons.dba.quantity,
      unit_price: p.unit > 0 ? p.unit : (addons.dba.unitPrice || 250),
      total_price: p.total > 0 ? p.total : addons.dba.quantity * (addons.dba.unitPrice || 250),
    });
  }

  // Kubernetes — use rowKey prefix k8s_*
  if (kubernetes?.enabled) {
    const k8sPrice = sumByPrefix('k8s');
    addonsArray.push({
      addon_key: 'kubernetes',
      label: `Kubernetes ${kubernetes.plan}`,
      enabled: true,
      quantity: 1,
      unit_price: k8sPrice.total,
      total_price: k8sPrice.total,
      metadata: {
        plan: kubernetes.plan,
        addons: kubernetes.addons,
        extras: kubernetes.extras,
      },
    });
  }

  // OPEN SaaS — rowKey: open_saas
  if (openSaas?.enabled && (openSaas.users || 0) > 0) {
    const saasPrice = getRowPrice('open_saas');
    addonsArray.push({
      addon_key: 'open_saas',
      label: `OPEN SaaS (${openSaas.users} usuários)`,
      enabled: true,
      quantity: openSaas.users,
      unit_price: saasPrice.total > 0 ? saasPrice.total / openSaas.users : 0,
      total_price: saasPrice.total,
      metadata: {},
    });
  }

  // Calculate due_at
  const validityDays = proposal.validityDays || 7;
  const dueAt = new Date();
  dueAt.setDate(dueAt.getDate() + validityDays);

  // Build final payload
  const payload: SaveProposalPayload = {
    proposal: {
      id: proposalId,
      display_id: displayId || proposal.id || generateProposalId(),
      name: client.name || client.company || '',
      company: client.company || '',
      phone: client.phone || '',
      email: client.email || '',
      status: 'Rascunho',
      channel_type: reseller.enabled ? 'PARCEIRO' : 'CLIENTE',
      reseller_name: reseller.enabled ? reseller.resellerName : null,
      commission_value: reseller.enabled ? reseller.overValue : null,
      commission_reason: reseller.enabled ? reseller.overReason : null,
      observations: observacao || null,
      fx: fx || 1,
      datacenter: datacenter || 'SP1',
      contract_duration: parseInt(selectedTerm, 10) || 12,
      discount_pct: result?.discountPct || 0,
      total: total || result?.grandTotal || 0,
      due_at: dueAt.toISOString(),
      currency: 'BRL',
    },
    servers,
    addons: addonsArray,
  };

  // ============================================================================
  // VALIDATION LOGGING — warn on zero-price items when total > 0
  // ============================================================================
  const proposalTotal = payload.proposal.total || 0;
  if (proposalTotal > 0) {
    servers.forEach((s) => {
      if (s.unit_price === 0 && s.total_price === 0) {
        console.warn(`[PRICE WARNING] Server "${s.name}" has price 0 but proposal total is R$${proposalTotal.toFixed(2)}`);
      }
    });
    addonsArray.forEach((a) => {
      if (a.unit_price === 0 && a.total_price === 0 && a.quantity > 0) {
        console.warn(`[PRICE WARNING] Addon "${a.addon_key}" (qty=${a.quantity}) has price 0 but proposal total is R$${proposalTotal.toFixed(2)}`);
      }
    });
  }

  console.log('[convertCalculatorToSupabasePayload] Price summary:', {
    servers: servers.map(s => ({ name: s.name, unit: s.unit_price, total: s.total_price })),
    addons: addonsArray.map(a => ({ key: a.addon_key, qty: a.quantity, unit: a.unit_price, total: a.total_price })),
    proposalTotal,
    rowKeysAvailable: Object.keys(rowByKey).length,
  });

  return payload;
}

// ============================================================================
// MUTATION HOOK
// ============================================================================

async function generateAndPersistPdfAfterSave(proposalUuid: string, input: CalculatorSaveInput) {
  try {
    if (!input.result || !Array.isArray(input.result.rows) || input.result.rows.length === 0) {
      console.warn('[useSaveProposalToSupabase] Skipping PDF generation (missing result.rows)');
      return;
    }

    const proposalMeta: ProposalMeta = {
      id: input.displayId || input.proposal.id || proposalUuid,
      createdAt: (input.proposal as any)?.createdAt || new Date().toISOString(),
      validityDays: input.proposal.validityDays || 7,
    };

    const clientInfo: ClientInfo = {
      name: input.client.name,
      company: input.client.company,
      phone: input.client.phone,
      email: input.client.email,
    };

    const { blob, filename } = await generateOpenPDFBlob({
      client: clientInfo,
      proposal: proposalMeta,
      result: input.result,
      selectedTerm: input.selectedTerm,
      datacenter: input.datacenter,
      reseller: input.reseller,
      observacao: input.observacao,
      attachments: [],
      includeCommission: true,
    });

    const uploaded = await uploadPdfToStorage(proposalUuid, blob, filename);

    console.log('[useSaveProposalToSupabase] PDF persisted to Storage:', {
      proposalUuid,
      pdfPath: uploaded.path,
      filename,
    });
  } catch (err) {
    console.error('[useSaveProposalToSupabase] Failed to generate/upload PDF after save:', err);
  }
}

export function useSaveProposalToSupabase() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: CalculatorSaveInput) => {
      // Log before save
      console.log('[useSaveProposalToSupabase] Starting save to Supabase...');
      console.log('[useSaveProposalToSupabase] Input summary:', {
        proposalId: input.proposalId,
        displayId: input.displayId,
        client: { name: input.client.name, email: input.client.email },
        total: input.total,
        itemsCount: input.items.length,
        storageCount: input.storageItems.length,
        hasKubernetes: input.kubernetes.enabled,
        hasOpenSaas: input.openSaas.enabled,
      });

      // Convert to payload
      const payload = convertCalculatorToSupabasePayload(input);

      console.log('[useSaveProposalToSupabase] Payload prepared:', {
        proposalId: payload.proposal.id,
        displayId: payload.proposal.display_id,
        serversCount: payload.servers.length,
        addonsCount: payload.addons.length,
        total: payload.proposal.total,
      });

      // Call RPC
      const { data, error } = await supabase.rpc('save_calculator_proposal', {
        payload: payload as any,
      });

      if (error) {
        console.error('[useSaveProposalToSupabase] RPC Error:', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        });
        throw new Error(`Supabase RPC failed: ${error.message} (code: ${error.code})`);
      }

      const proposalId = data as string;
      console.log('[useSaveProposalToSupabase] Saved to Supabase, proposalId=', proposalId);

      // After saving, ALWAYS generate + upload the full PDF and update pdf_path
      await generateAndPersistPdfAfterSave(proposalId, input);

      return { success: true, proposalId, isUpdate: !!input.proposalId };
    },
    onSuccess: (result) => {
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: SUPABASE_PROPOSAL_KEYS.lists() });
      
      if (result.proposalId) {
        queryClient.invalidateQueries({ 
          queryKey: SUPABASE_PROPOSAL_KEYS.detail(result.proposalId) 
        });
      }

      toast({
        title: result.isUpdate ? 'Proposta atualizada' : 'Proposta salva',
        description: `ID: ${result.proposalId?.substring(0, 8)}...`,
      });
    },
    onError: (error: Error) => {
      console.error('[useSaveProposalToSupabase] Mutation error:', error);
      
      toast({
        title: 'Erro ao salvar proposta',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// ============================================================================
// DIRECT SAVE FUNCTION (for imperative calls)
// ============================================================================

export async function saveProposalToSupabase(input: CalculatorSaveInput): Promise<string> {
  console.log('[saveProposalToSupabase] Direct save starting...');
  
  const payload = convertCalculatorToSupabasePayload(input);
  
  console.log('[saveProposalToSupabase] Calling RPC with:', {
    hasProposalId: !!payload.proposal.id,
    serversCount: payload.servers.length,
    addonsCount: payload.addons.length,
  });

  const { data, error } = await supabase.rpc('save_calculator_proposal', {
    payload: payload as any,
  });

  if (error) {
    console.error('[saveProposalToSupabase] ERROR:', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    });
    throw new Error(`Failed to save: ${error.message}`);
  }

  const proposalId = data as string;
  console.log('[saveProposalToSupabase] SUCCESS, proposalId=', proposalId);

  // After saving, ALWAYS generate + upload the full PDF and update pdf_path
  await generateAndPersistPdfAfterSave(proposalId, input);

  return proposalId;
}
