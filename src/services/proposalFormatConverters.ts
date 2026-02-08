/**
 * Proposal Format Converters
 * 
 * Converts between Supabase format and Calculator state format.
 * This ensures data persisted in Supabase can be hydrated back to the calculator UI.
 */

import type {
  CalculatorProposalWithRelations,
  CalculatorProposalServerRow,
  CalculatorProposalAddonRow,
  SaveProposalPayload,
  SaveProposalServer,
  SaveProposalAddon,
} from '@/types/calculatorProposal';
import type { K8sPlan } from '@/lib/calculatorConfig';
import type { 
  OpenCalculatorState, 
  ServerItemV2, 
  VMItemV2, 
  BMItemV2, 
  StorageItemV2, 
  AddonsStateV2,
  KubernetesStateV2,
  SupportLevelV2,
  DEFAULT_ADDONS,
  DEFAULT_KUBERNETES,
  DEFAULT_RESELLER,
  DEFAULT_OPEN_SAAS,
} from '@/modules/comercial/propostas/state/openCalculatorState';

// ============================================================================
// SUPABASE → CALCULATOR STATE (for hydrating edit mode)
// ============================================================================

export function supabaseToCalculatorState(proposal: CalculatorProposalWithRelations): OpenCalculatorState {
  console.log('[supabaseToCalculatorState] Converting proposal:', proposal.id);

  // Convert servers to items (filter out virtual/legacy items)
  const items: ServerItemV2[] = (proposal.servers || [])
    .filter((s) => s.server_type !== 'storage')
    .filter((s) => !(s.name || '').startsWith('__VIRTUAL__'))
    .map((server) => {
      if (server.server_type === 'bm') {
        const bmItem: BMItemV2 = {
          type: 'bm',
          id: server.id,
          gpu: server.gpu || 'Sem GPU',
          gpuQty: server.gpu_qty || 0,
          bmCpu: server.bm_cpu || 'intel_xeon_e2136',
          bmRam: server.bm_ram || 'ram_128gb',
          disks: Array.isArray(server.disks) ? server.disks : [{ type: 'nvme_1tb', qty: 1, desc: '' }],
          trafficTb: server.traffic_tb || 5,
          ips: server.ips || 1,
          qtyServers: server.qty_servers || 1,
        };
        return bmItem;
      }

      const vmItem: VMItemV2 = {
        type: 'vm',
        id: server.id,
        gpu: server.gpu || 'Sem GPU',
        gpuQty: server.gpu_qty || 0,
        vcpu: server.vcpu || 16,
        ramGb: server.ram_gb || 128,
        nvmeTb: server.nvme_tb || 0.09765625,
        trafficTb: server.traffic_tb || 5,
        ips: server.ips || 1,
        qtyServers: server.qty_servers || 1,
      };
      return vmItem;
    });

  // Convert storage servers to storageItems
  const storageItems: StorageItemV2[] = (proposal.servers || [])
    .filter((s) => s.server_type === 'storage')
    .map((server) => {
      // Map storage_type to valid StorageItemV2 types
      let storageType: 'sas' | 's3' | 'nvme' = 'sas';
      if (server.storage_type === 'nvme') storageType = 'nvme';
      else if (server.storage_type === 's3') storageType = 's3';
      
      // Map region to valid values
      let region: 'BR' | 'USA' = 'BR';
      if (server.storage_region === 'USA' || server.storage_region === 'US') region = 'USA';
      
      return {
        id: server.id,
        storageType,
        region,
        volumeTB: server.volume_tb || 1,
      };
    });

  // Convert addons
  const addonsMap: Record<string, CalculatorProposalAddonRow> = {};
  (proposal.addons || []).forEach((addon) => {
    addonsMap[addon.addon_key] = addon;
  });

  // Map backup plan to valid values
  const rawBackupPlan = addonsMap['backup']?.metadata?.plan;
  let backupPlan: 'none' | '7' | '15' | '30' = 'none';
  if (rawBackupPlan === '7' || rawBackupPlan === '15' || rawBackupPlan === '30') {
    backupPlan = rawBackupPlan;
  }

  // Map SQL to valid values
  const rawSql = addonsMap['sql']?.metadata?.type;
  let sql: 'none' | 'web' | 'std' = 'none';
  if (rawSql === 'web') sql = 'web';
  else if (rawSql === 'std' || rawSql === 'standard') sql = 'std';

  // Map support level to valid values
  const rawSupportLevel = addonsMap['support']?.metadata?.level;
  let supportLevel: SupportLevelV2 = 'none';
  if (rawSupportLevel === 'basic') supportLevel = 'basic';
  else if (rawSupportLevel === 'intermediate') supportLevel = 'intermediate';
  else if (rawSupportLevel === 'advanced' || rawSupportLevel === '24x7' || rawSupportLevel === 'extended') supportLevel = 'advanced';

  const addons: AddonsStateV2 = {
    backupPlan,
    backupGb: addonsMap['backup']?.quantity || 0,
    antivirus: addonsMap['antivirus']?.quantity || 0,
    firewall: addonsMap['firewall']?.quantity || 0,
    tsplus: addonsMap['tsplus']?.quantity || 0,
    cal: addonsMap['cal']?.quantity || 0,
    sql,
    sqlQty: addonsMap['sql']?.quantity || 0,
    veeamVm: addonsMap['veeam_vm']?.quantity || 0,
    veeamAg: addonsMap['veeam_ag']?.quantity || 0,
    winserver: addonsMap['winserver']?.quantity || 0,
    support: {
      level: supportLevel,
      price: addonsMap['support']?.unit_price || 0,
    },
    consulting: {
      quantity: addonsMap['consulting']?.quantity || 0,
      unitPrice: addonsMap['consulting']?.unit_price || 200,
    },
    dba: {
      quantity: addonsMap['dba']?.quantity || 0,
      unitPrice: addonsMap['dba']?.unit_price || 250,
    },
    customAddons: addonsMap['custom']?.metadata || {},
  };

  // Map K8s plan to valid values
  const rawK8sPlan = addonsMap['kubernetes']?.metadata?.plan;
  let k8sPlan: K8sPlan = 'k8s_small';
  if (rawK8sPlan === 'k8s_medium' || rawK8sPlan === 'k8s_large' || rawK8sPlan === 'k8s_enterprise') {
    k8sPlan = rawK8sPlan as K8sPlan;
  }

  // Map contract duration to valid values
  const rawDuration = proposal.contract_duration;
  let selectedTerm: '1' | '12' | '24' | '36' | '48' = '12';
  if (rawDuration === 1) selectedTerm = '1';
  else if (rawDuration === 24) selectedTerm = '24';
  else if (rawDuration === 36) selectedTerm = '36';
  else if (rawDuration === 48) selectedTerm = '48';

  // Build state
  const state: OpenCalculatorState = {
    client: {
      name: proposal.name,
      company: proposal.company,
      phone: proposal.phone,
      email: proposal.email,
    },
    meta: {
      apiId: null, // Supabase proposals don't have external API ID
      proposalDisplayId: proposal.display_id || '',
      createdAt: proposal.created_at,
      validityDays: 30,
    },
    datacenter: (proposal.datacenter as 'SP1' | 'SP2' | 'FL1' | 'CE1') || 'SP1',
    selectedTerm,
    items,
    addons,
    kubernetes: {
      enabled: addonsMap['kubernetes']?.enabled || false,
      plan: k8sPlan,
      addons: addonsMap['kubernetes']?.metadata?.addons || {
        support_24x7: false,
        backup_velero: false,
        dr_multisite: false,
        observability: false,
        cicd_managed: false,
        devops_hours: 0,
      },
      extras: addonsMap['kubernetes']?.metadata?.extras || {
        vcpu: 0,
        ramGB: 0,
        diskGB: 0,
      },
    },
    storageItems,
    openSaas: {
      enabled: addonsMap['open_saas']?.enabled || false,
      users: addonsMap['open_saas']?.quantity || 0,
    },
    reseller: {
      enabled: proposal.channel_type === 'PARCEIRO',
      viewMode: 'INTERNO',
      resellerName: proposal.reseller_name || '',
      overValue: proposal.commission_value || 0,
      overReason: proposal.commission_reason || '',
      observations: proposal.observations || '',
      approvalRequired: false,
      approvalStatus: 'Pendente',
      approver: '',
      approvedAt: null,
    },
    priceOverrides: {},
    observacao: proposal.observations || '',
    flags: {
      isLoading: false,
      isEditMode: true,
      isHydrated: true,
      isSaving: false,
    },
  };

  console.log('[supabaseToCalculatorState] Converted state:', {
    client: state.client,
    itemsCount: state.items.length,
    storageCount: state.storageItems.length,
    hasAddons: Object.keys(addonsMap).length,
  });

  return state;
}

// ============================================================================
// CALCULATOR STATE → SUPABASE PAYLOAD (for saving)
// ============================================================================

export function calculatorStateToSavePayload(
  state: OpenCalculatorState,
  channelType: 'CLIENTE' | 'PARCEIRO',
  grandTotal: number,
  discountPct: number = 0
): SaveProposalPayload {
  console.log('[calculatorStateToSavePayload] Converting state:', {
    displayId: state.meta.proposalDisplayId,
    itemsCount: state.items.length,
    storageCount: state.storageItems.length,
  });

  // Build servers from items + storageItems
  const servers: SaveProposalServer[] = [];

  // Add VM/BM items
  state.items.forEach((item) => {
    if (item.type === 'vm') {
      const vmItem = item as VMItemV2;
      servers.push({
        server_type: 'vm',
        name: `VM-${vmItem.vcpu}vCPU-${vmItem.ramGb}GB`,
        gpu: vmItem.gpu || 'Sem GPU',
        gpu_qty: vmItem.gpuQty || 0,
        vcpu: vmItem.vcpu,
        ram_gb: vmItem.ramGb,
        nvme_tb: vmItem.nvmeTb,
        traffic_tb: vmItem.trafficTb,
        ips: vmItem.ips,
        qty_servers: vmItem.qtyServers,
        unit_price: 0, // Will be calculated by frontend
        total_price: 0,
      });
    } else if (item.type === 'bm') {
      const bmItem = item as BMItemV2;
      servers.push({
        server_type: 'bm',
        name: `BM-${bmItem.bmCpu}`,
        gpu: bmItem.gpu || 'Sem GPU',
        gpu_qty: bmItem.gpuQty || 0,
        bm_cpu: bmItem.bmCpu,
        bm_ram: bmItem.bmRam,
        disks: bmItem.disks,
        traffic_tb: bmItem.trafficTb,
        ips: bmItem.ips,
        qty_servers: bmItem.qtyServers,
        unit_price: 0,
        total_price: 0,
      });
    }
  });

  // Add storage items
  state.storageItems.forEach((storage) => {
    servers.push({
      server_type: 'storage',
      name: `Storage-${storage.storageType}-${storage.volumeTB}TB`,
      storage_type: storage.storageType,
      storage_region: storage.region,
      volume_tb: storage.volumeTB,
      unit_price: 0,
      total_price: 0,
    });
  });

  // Build addons
  const addons: SaveProposalAddon[] = [];

  // Backup
  if (state.addons.backupPlan !== 'none' && state.addons.backupGb > 0) {
    addons.push({
      addon_key: 'backup',
      label: `Backup ${state.addons.backupPlan} dias - ${state.addons.backupGb}GB`,
      enabled: true,
      quantity: state.addons.backupGb,
      metadata: { plan: state.addons.backupPlan },
    });
  }

  // Antivirus
  if (state.addons.antivirus > 0) {
    addons.push({
      addon_key: 'antivirus',
      label: `Antivírus (${state.addons.antivirus} licenças)`,
      enabled: true,
      quantity: state.addons.antivirus,
    });
  }

  // Firewall
  if (state.addons.firewall > 0) {
    addons.push({
      addon_key: 'firewall',
      label: `Firewall (${state.addons.firewall} unidades)`,
      enabled: true,
      quantity: state.addons.firewall,
    });
  }

  // TSPlus
  if (state.addons.tsplus > 0) {
    addons.push({
      addon_key: 'tsplus',
      label: `TSPlus (${state.addons.tsplus} licenças)`,
      enabled: true,
      quantity: state.addons.tsplus,
    });
  }

  // CAL
  if (state.addons.cal > 0) {
    addons.push({
      addon_key: 'cal',
      label: `CAL (${state.addons.cal} licenças)`,
      enabled: true,
      quantity: state.addons.cal,
    });
  }

  // SQL
  if (state.addons.sql !== 'none' && state.addons.sqlQty > 0) {
    addons.push({
      addon_key: 'sql',
      label: `SQL Server ${state.addons.sql} (${state.addons.sqlQty} licenças)`,
      enabled: true,
      quantity: state.addons.sqlQty,
      metadata: { type: state.addons.sql },
    });
  }

  // Veeam VM
  if (state.addons.veeamVm > 0) {
    addons.push({
      addon_key: 'veeam_vm',
      label: `Veeam VM (${state.addons.veeamVm} VMs)`,
      enabled: true,
      quantity: state.addons.veeamVm,
    });
  }

  // Veeam Agent
  if (state.addons.veeamAg > 0) {
    addons.push({
      addon_key: 'veeam_ag',
      label: `Veeam Agent (${state.addons.veeamAg} agents)`,
      enabled: true,
      quantity: state.addons.veeamAg,
    });
  }

  // Windows Server
  if (state.addons.winserver > 0) {
    addons.push({
      addon_key: 'winserver',
      label: `Windows Server (${state.addons.winserver} licenças)`,
      enabled: true,
      quantity: state.addons.winserver,
    });
  }

  // Support
  if (state.addons.support?.level !== 'none') {
    addons.push({
      addon_key: 'support',
      label: `Suporte ${state.addons.support?.level}`,
      enabled: true,
      quantity: 1,
      unit_price: state.addons.support?.price || 0,
      metadata: { level: state.addons.support?.level },
    });
  }

  // Consulting
  if (state.addons.consulting?.quantity > 0) {
    addons.push({
      addon_key: 'consulting',
      label: `Consultoria (${state.addons.consulting.quantity}h)`,
      enabled: true,
      quantity: state.addons.consulting.quantity,
      unit_price: state.addons.consulting.unitPrice,
    });
  }

  // DBA
  if (state.addons.dba?.quantity > 0) {
    addons.push({
      addon_key: 'dba',
      label: `DBA (${state.addons.dba.quantity}h)`,
      enabled: true,
      quantity: state.addons.dba.quantity,
      unit_price: state.addons.dba.unitPrice,
    });
  }

  // Kubernetes
  if (state.kubernetes?.enabled) {
    addons.push({
      addon_key: 'kubernetes',
      label: `Kubernetes ${state.kubernetes.plan}`,
      enabled: true,
      quantity: 1,
      metadata: {
        plan: state.kubernetes.plan,
        addons: state.kubernetes.addons,
        extras: state.kubernetes.extras,
      },
    });
  }

  // OpenSaaS
  if (state.openSaas?.enabled && state.openSaas.users > 0) {
    addons.push({
      addon_key: 'open_saas',
      label: `OpenSaaS (${state.openSaas.users} usuários)`,
      enabled: true,
      quantity: state.openSaas.users,
    });
  }

  // Build due_at (30 days from now or from createdAt)
  const createdDate = state.meta.createdAt ? new Date(state.meta.createdAt) : new Date();
  const dueDate = new Date(createdDate);
  dueDate.setDate(dueDate.getDate() + (state.meta.validityDays || 30));

  // Get existing proposal ID for update (from flags or meta)
  const existingId = state.meta.apiId ? undefined : undefined; // Supabase uses UUID from flags

  const payload: SaveProposalPayload = {
    proposal: {
      id: existingId,
      display_id: state.meta.proposalDisplayId,
      name: state.client.name,
      company: state.client.company,
      phone: state.client.phone,
      email: state.client.email,
      status: 'Rascunho',
      channel_type: channelType,
      reseller_name: state.reseller?.resellerName || null,
      commission_value: state.reseller?.overValue || null,
      commission_reason: state.reseller?.overReason || null,
      observations: state.observacao || null,
      fx: 5.0, // Default FX
      datacenter: state.datacenter,
      contract_duration: parseInt(state.selectedTerm, 10) || 12,
      discount_pct: discountPct,
      total: grandTotal,
      due_at: dueDate.toISOString(),
      currency: 'BRL',
    },
    servers,
    addons,
  };

  console.log('[calculatorStateToSavePayload] Built payload:', {
    proposalId: payload.proposal.id,
    serversCount: payload.servers.length,
    addonsCount: payload.addons.length,
    total: payload.proposal.total,
  });

  return payload;
}

// ============================================================================
// HELPER: Convert CalculatorProposalRow to SavedProposal (for list display)
// ============================================================================

export function rowToSavedProposal(row: CalculatorProposalWithRelations): any {
  return {
    id: row.id, // UUID
    fx: row.fx,
    selectedTerm: String(row.contract_duration),
    datacenter: row.datacenter,
    client: {
      name: row.name,
      company: row.company,
      phone: row.phone,
      email: row.email,
    },
    proposal: {
      id: row.display_id || row.id,
      createdAt: row.created_at,
      validityDays: 30,
    },
    items: row.servers?.filter((s) => s.server_type !== 'storage') || [],
    addons: row.addons || [],
    kubernetes: null,
    storageItems: row.servers?.filter((s) => s.server_type === 'storage') || [],
    reseller: row.channel_type === 'PARCEIRO' ? {
      enabled: true,
      resellerName: row.reseller_name,
      overValue: row.commission_value,
      overReason: row.commission_reason,
    } : null,
    openSaas: null,
    total: row.total,
    savedAt: row.created_at,
    status: row.status,
    observacao: row.observations,
    created_by: row.created_by,
    dados_proposta: {
      channel_type: row.channel_type,
      discount_pct: row.discount_pct,
      pdf_path: row.pdf_path,
    },
  };
}

// ============================================================================
// EDGE FUNCTION RESPONSE → CALCULATOR STATE (for hydrating edit mode)
// ============================================================================

import type { ProposalGetResult, ProposalServer, ProposalAddon } from '@/services/proposalApi';

/**
 * Converts Edge Function response to OpenCalculatorState.
 * This is similar to supabaseToCalculatorState but works with the API response types.
 */
export function edgeFunctionToCalculatorState(result: ProposalGetResult): OpenCalculatorState {
  console.log('[edgeFunctionToCalculatorState] Converting proposal:', result.proposal.id);

  const proposal = result.proposal;
  const servers = result.servers || [];
  const addonsArr = result.addons || [];

  // Convert servers to items (filter out virtual/legacy items)
  const items: ServerItemV2[] = servers
    .filter((s) => s.server_type !== 'storage')
    .filter((s) => !(s.name || '').startsWith('__VIRTUAL__'))
    .map((server) => {
      if (server.server_type === 'bm') {
        // Map disks with required 'desc' field
        const disks = Array.isArray(server.disks) 
          ? (server.disks as Array<{ type: string; qty: number; desc?: string }>).map(d => ({
              type: d.type,
              qty: d.qty,
              desc: d.desc || '',
            }))
          : [{ type: 'nvme_1tb', qty: 1, desc: '' }];
        
        const bmItem: BMItemV2 = {
          type: 'bm',
          id: server.id || crypto.randomUUID(),
          gpu: server.gpu || 'Sem GPU',
          gpuQty: server.gpu_qty || 0,
          bmCpu: server.bm_cpu || 'intel_xeon_e2136',
          bmRam: server.bm_ram || 'ram_128gb',
          disks,
          trafficTb: server.traffic_tb || 5,
          ips: server.ips || 1,
          qtyServers: server.qty_servers || 1,
        };
        return bmItem;
      }

      const vmItem: VMItemV2 = {
        type: 'vm',
        id: server.id || crypto.randomUUID(),
        gpu: server.gpu || 'Sem GPU',
        gpuQty: server.gpu_qty || 0,
        vcpu: server.vcpu || 16,
        ramGb: server.ram_gb || 128,
        nvmeTb: server.nvme_tb || 0.09765625,
        trafficTb: server.traffic_tb || 5,
        ips: server.ips || 1,
        qtyServers: server.qty_servers || 1,
      };
      return vmItem;
    });

  // Convert storage servers to storageItems
  const storageItems: StorageItemV2[] = servers
    .filter((s) => s.server_type === 'storage')
    .map((server) => {
      let storageType: 'sas' | 's3' | 'nvme' = 'sas';
      if (server.storage_type === 'nvme') storageType = 'nvme';
      else if (server.storage_type === 's3') storageType = 's3';
      
      let region: 'BR' | 'USA' = 'BR';
      if (server.storage_region === 'USA' || server.storage_region === 'US') region = 'USA';
      
      return {
        id: server.id || crypto.randomUUID(),
        storageType,
        region,
        volumeTB: server.volume_tb || 1,
      };
    });

  // Convert addons
  const addonsMap: Record<string, ProposalAddon> = {};
  addonsArr.forEach((addon) => {
    addonsMap[addon.addon_key] = addon;
  });

  // Map addons to state format
  const addons: AddonsStateV2 = {
    backupPlan: (addonsMap['backup']?.metadata as any)?.plan || 'none',
    backupGb: addonsMap['backup']?.quantity || 0,
    antivirus: addonsMap['antivirus']?.quantity || 0,
    firewall: addonsMap['firewall']?.quantity || 0,
    tsplus: addonsMap['tsplus']?.quantity || 0,
    cal: addonsMap['cal']?.quantity || 0,
    sql: (() => {
      const rawSqlType = ((addonsMap['sql']?.metadata as any)?.type || '').toString().toLowerCase();
      if (rawSqlType === 'web') return 'web';
      if (rawSqlType === 'std' || rawSqlType === 'standard') return 'std';
      return 'none';
    })(),
    sqlQty: addonsMap['sql']?.quantity || 0,
    veeamVm: addonsMap['veeam_vm']?.quantity || 0,
    veeamAg: addonsMap['veeam_ag']?.quantity ?? addonsMap['veeam_agent']?.quantity ?? 0,
    winserver: addonsMap['winserver']?.quantity || 0,
    support: {
      level: (addonsMap['support']?.metadata as any)?.level || 'none',
      price: addonsMap['support']?.unit_price || 0,
    },
    consulting: {
      quantity: addonsMap['consulting']?.quantity || 0,
      unitPrice: addonsMap['consulting']?.unit_price || 200,
    },
    dba: {
      quantity: addonsMap['dba']?.quantity || 0,
      unitPrice: addonsMap['dba']?.unit_price || 250,
    },
    customAddons: {},
  };

  // Build kubernetes state
  const k8sAddon = addonsMap['kubernetes'];
  const kubernetesEnabled = k8sAddon?.enabled || false;
  const k8sMetadata = k8sAddon?.metadata as any || {};
  
  const kubernetes: KubernetesStateV2 = {
    enabled: kubernetesEnabled,
    plan: (k8sMetadata.plan || 'k8s_small') as K8sPlan,
    addons: {
      support_24x7: k8sMetadata.addons?.support_24x7 || false,
      backup_velero: k8sMetadata.addons?.backup_velero || false,
      dr_multisite: k8sMetadata.addons?.dr_multisite || false,
      observability: k8sMetadata.addons?.observability || false,
      cicd_managed: k8sMetadata.addons?.cicd_managed || false,
      devops_hours: k8sMetadata.addons?.devops_hours || 0,
    },
    extras: {
      vcpu: k8sMetadata.extras?.vcpu || 0,
      ramGB: k8sMetadata.extras?.ramGB || 0,
      diskGB: k8sMetadata.extras?.diskGB || 0,
    },
  };

  // Map contract_duration to selectedTerm
  const durationToTerm: Record<number, '1' | '12' | '24' | '36' | '48'> = {
    1: '1',
    12: '12',
    24: '24',
    36: '36',
    48: '48',
  };
  const selectedTerm = durationToTerm[proposal.contract_duration] || '12';

  const state: OpenCalculatorState = {
    client: {
      name: proposal.name || '',
      company: proposal.company || '',
      phone: proposal.phone || '',
      email: proposal.email || '',
    },
    meta: {
      apiId: null, // Edge Function proposals don't have numeric API ID
      proposalDisplayId: proposal.display_id || proposal.id.substring(0, 8).toUpperCase(),
      createdAt: proposal.created_at || new Date().toISOString(),
      validityDays: 7,
    },
    datacenter: (proposal.datacenter as 'SP1' | 'SP2' | 'FL1' | 'CE1') || 'SP1',
    selectedTerm,
    items,
    storageItems,
    addons,
    kubernetes,
    openSaas: {
      enabled: addonsMap['open_saas']?.enabled || false,
      users: addonsMap['open_saas']?.quantity || 0,
    },
    reseller: {
      enabled: proposal.channel_type === 'PARCEIRO',
      viewMode: 'INTERNO',
      resellerName: proposal.reseller_name || '',
      overValue: proposal.commission_value || 0,
      overReason: proposal.commission_reason || '',
      observations: proposal.observations || '',
      approvalRequired: false,
      approvalStatus: 'Pendente',
      approver: '',
      approvedAt: null,
    },
    priceOverrides: {},
    observacao: proposal.observations || '',
    flags: {
      isLoading: false,
      isEditMode: true,
      isHydrated: true,
      isSaving: false,
    },
  };

  console.log('[edgeFunctionToCalculatorState] Converted state:', {
    client: state.client,
    itemsCount: state.items.length,
    storageCount: state.storageItems.length,
    hasAddons: Object.keys(addonsMap).length,
  });

  return state;
}
