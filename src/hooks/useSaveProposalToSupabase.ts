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
import type { ServerItem, VMItem, BMItem, StorageItem, AddonsState, KubernetesState, OpenSaaSState, ResellerState, CalculationResult } from '@/lib/calculatorConfig';
import { generateProposalId } from '@/lib/calculatorConfig';

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

  // Build servers array from items + storageItems + kubernetes + openSaas
  const servers: SaveProposalServer[] = [];
  
  // Process VM/BM items
  items.forEach((item, idx) => {
    if (item.type === 'vm') {
      const vm = item as VMItem;
      // Find matching row in result for price
      const rowKey = `item-${item.id}`;
      const overridePrice = priceOverrides?.[rowKey];
      
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
        qty_servers: vm.qtyServers || 1,
        unit_price: overridePrice ?? 0,
        total_price: (overridePrice ?? 0) * (vm.qtyServers || 1),
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
      const rowKey = `item-${item.id}`;
      const overridePrice = priceOverrides?.[rowKey];
      
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
        qty_servers: bm.qtyServers || 1,
        bm_cpu: bm.bmCpu || null,
        bm_ram: bm.bmRam || null,
        disks: bm.disks || [],
        unit_price: overridePrice ?? 0,
        total_price: (overridePrice ?? 0) * (bm.qtyServers || 1),
        specs: {
          bmCpu: bm.bmCpu,
          bmRam: bm.bmRam,
          disks: bm.disks,
        },
      });
    }
  });

  // Process storage items
  storageItems.forEach((storage, idx) => {
    servers.push({
      server_type: 'storage',
      name: `Storage ${storage.storageType?.toUpperCase() || 'SAS'} #${idx + 1}`,
      storage_type: storage.storageType || 'sas',
      storage_region: storage.region || 'BR',
      volume_tb: storage.volumeTB || storage.volumeGB ? (storage.volumeGB || 0) / 1024 : 0,
      vcpu: 0,
      ram_gb: 0,
      nvme_tb: 0,
      traffic_tb: 0,
      ips: 0,
      qty_servers: 1,
      unit_price: 0,
      total_price: 0,
    });
  });

  // Add Kubernetes as virtual server if enabled
  if (kubernetes.enabled) {
    servers.push({
      server_type: 'vm', // K8s is treated as VM for storage
      name: `__VIRTUAL__KUBERNETES__:${JSON.stringify(kubernetes)}`,
      vcpu: 0,
      ram_gb: 0,
      nvme_tb: 0,
      traffic_tb: 0,
      ips: 0,
      qty_servers: 1,
      unit_price: 0,
      total_price: 0,
      specs: { kubernetes },
    });
  }

  // Add OpenSaaS as virtual server if enabled
  if (openSaas.enabled && openSaas.users > 0) {
    servers.push({
      server_type: 'vm',
      name: `__VIRTUAL__OPENSAAS__:${JSON.stringify(openSaas)}`,
      vcpu: 0,
      ram_gb: 0,
      nvme_tb: 0,
      traffic_tb: 0,
      ips: 0,
      qty_servers: 1,
      unit_price: 0,
      total_price: 0,
      specs: { openSaas },
    });
  }

  // Build addons array
  const addonsArray: SaveProposalAddon[] = [];

  // Backup
  if (addons.backupPlan && addons.backupPlan !== 'none') {
    addonsArray.push({
      addon_key: 'backup',
      label: `Backup ${addons.backupPlan} (${addons.backupGb} GB)`,
      enabled: true,
      quantity: addons.backupGb || 1,
      unit_price: 0,
      total_price: 0,
      metadata: { plan: addons.backupPlan, gb: addons.backupGb },
    });
  }

  // Antivirus
  if (addons.antivirus > 0) {
    addonsArray.push({
      addon_key: 'antivirus',
      label: 'Antivírus',
      enabled: true,
      quantity: addons.antivirus,
      unit_price: 0,
      total_price: 0,
    });
  }

  // Firewall
  if (addons.firewall > 0) {
    addonsArray.push({
      addon_key: 'firewall',
      label: 'Firewall',
      enabled: true,
      quantity: addons.firewall,
      unit_price: 0,
      total_price: 0,
    });
  }

  // SQL
  if (addons.sql && addons.sql !== 'none' && addons.sqlQty > 0) {
    addonsArray.push({
      addon_key: 'sql',
      label: `SQL Server ${addons.sql}`,
      enabled: true,
      quantity: addons.sqlQty,
      unit_price: 0,
      total_price: 0,
      metadata: { type: addons.sql },
    });
  }

  // Veeam VM
  if (addons.veeamVm > 0) {
    addonsArray.push({
      addon_key: 'veeam_vm',
      label: 'Veeam (VM)',
      enabled: true,
      quantity: addons.veeamVm,
      unit_price: 0,
      total_price: 0,
    });
  }

  // Veeam Agent
  if (addons.veeamAg > 0) {
    addonsArray.push({
      addon_key: 'veeam_agent',
      label: 'Veeam (Agent)',
      enabled: true,
      quantity: addons.veeamAg,
      unit_price: 0,
      total_price: 0,
    });
  }

  // Windows Server
  if (addons.winserver > 0) {
    addonsArray.push({
      addon_key: 'winserver',
      label: 'Windows Server',
      enabled: true,
      quantity: addons.winserver,
      unit_price: 0,
      total_price: 0,
    });
  }

  // TSPlus
  if (addons.tsplus && addons.tsplus > 0) {
    addonsArray.push({
      addon_key: 'tsplus',
      label: 'TSPlus',
      enabled: true,
      quantity: addons.tsplus,
      unit_price: 0,
      total_price: 0,
    });
  }

  // CAL
  if (addons.cal && addons.cal > 0) {
    addonsArray.push({
      addon_key: 'cal',
      label: 'CAL',
      enabled: true,
      quantity: addons.cal,
      unit_price: 0,
      total_price: 0,
    });
  }

  // Support
  if (addons.support?.level && addons.support.level !== 'none') {
    addonsArray.push({
      addon_key: 'support',
      label: `Suporte ${addons.support.level}`,
      enabled: true,
      quantity: 1,
      unit_price: addons.support.price || 0,
      total_price: addons.support.price || 0,
      metadata: { level: addons.support.level },
    });
  }

  // Consulting
  if (addons.consulting?.quantity > 0) {
    addonsArray.push({
      addon_key: 'consulting',
      label: 'Consultoria',
      enabled: true,
      quantity: addons.consulting.quantity,
      unit_price: addons.consulting.unitPrice || 200,
      total_price: addons.consulting.quantity * (addons.consulting.unitPrice || 200),
    });
  }

  // DBA
  if (addons.dba?.quantity > 0) {
    addonsArray.push({
      addon_key: 'dba',
      label: 'DBA',
      enabled: true,
      quantity: addons.dba.quantity,
      unit_price: addons.dba.unitPrice || 250,
      total_price: addons.dba.quantity * (addons.dba.unitPrice || 250),
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

  return payload;
}

// ============================================================================
// MUTATION HOOK
// ============================================================================

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

  return proposalId;
}
