import axios from 'axios';
import { 
  CalculatorConfig, 
  DEFAULT_CONFIG, 
  ServerItem, 
  AddonsState,
  VMItem,
  BMItem,
  CalculatorState,
  CalculationResult,
  StorageItem,
  KubernetesState,
  OpenSaaSState,
  K8S_PLANS,
  getStoragePricePerTB,
  calculateStorageMonthly,
} from './calculatorConfig';

// ============================================================================
// API CONFIGURATION
// ============================================================================
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/+$/, '');

// API version prefix
const API_V2_PREFIX = '/v2/calculator';

const AUTH_TOKEN_KEY = 'open_access_token';
const LEGACY_AUTH_TOKEN_KEY = 'open_api_token';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem(AUTH_TOKEN_KEY) || localStorage.getItem(LEGACY_AUTH_TOKEN_KEY);
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  return config;
});

// ============================================================================
// API TYPES
// ============================================================================

export interface ApiConfigItem {
  id: number;
  category: string;
  group: string;
  label: string;
  type: 'BRL' | 'USD' | 'PERCENTAGE';
  value: string;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProposalView {
  id: number;
  proposal_id: number;
  source: string;
  user_agent: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

interface SendEmailRequest {
  clientName: string;
  clientEmail: string;
  proposalId: string;
  proposalLink: string;
  totalValue: string;
  validityDate: string;
}

// Proposal API Types
export interface ApiProposalAddon {
  type: 'antivirus' | 'firewall' | 'tsplus' | 'cal' | 'sql' | 'veeam_vm' | 'veeam_agent' | 'backup';
  qty: number;
  unit_price: number;
  subtotal: number;
  edition?: string;
  plan?: string;
  gb?: number;
}

export interface ApiProposalDisk {
  id: string;
  label: string;
  qty: number;
}

export interface ApiProposalServerBase {
  type: 'vm' | 'baremetal' | 'storage' | 'open_saas' | 'kubernetes';
  qty: number;
  subtotal: number;
}

export interface ApiProposalVMServer extends Omit<ApiProposalServerBase, 'type'> {
  type: 'vm';
  gpu: string;
  gpu_qty: number;
  traffic_tb: number;
  ips: number;
  vcpu: number;
  ram_gb: number;
  nvme_tb: number;
}

export interface ApiProposalBareMetalServer extends Omit<ApiProposalServerBase, 'type'> {
  type: 'baremetal';
  gpu: string;
  gpu_qty: number;
  traffic_tb: number;
  ips: number;
  cpu_id: string;
  cpu_label: string;
  ram_id: string;
  ram_label: string;
  disks: ApiProposalDisk[];
}

export interface ApiProposalStorageServer extends Omit<ApiProposalServerBase, 'type'> {
  type: 'storage';
  region: string;
  volume_tb: number;
  price_per_tb: number;
}

export interface ApiProposalOpenSaasServer extends Omit<ApiProposalServerBase, 'type'> {
  type: 'open_saas';
  users: number;
  unit_price: number;
}

export interface ApiProposalKubernetesServer extends Omit<ApiProposalServerBase, 'type'> {
  type: 'kubernetes';
  plan: string;
  plan_label: string;
}

export type ApiProposalServer = ApiProposalVMServer | ApiProposalBareMetalServer | ApiProposalStorageServer | ApiProposalOpenSaasServer | ApiProposalKubernetesServer;

// API Proposal format (what the API expects/returns)
export interface ApiProposal {
  id: number;
  name: string;
  company: string;
  phone: string;
  email: string;
  fx: string | number;
  contract_duration: number;
  discount_pct: string | number;
  total: string | number;
  addons: ApiProposalAddon[];
  servers: ApiProposalServer[];
  due_at: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

// Proposal create/update request format
export interface ApiProposalRequest {
  name: string;
  company: string;
  phone: string;
  email: string;
  fx: number;
  contract_duration: number;
  discount_pct: number;
  total: number;
  addons: ApiProposalAddon[]; // Always present (can be empty)
  servers: ApiProposalServer[];
  due_at: string;
}

// Paginated response
export interface PaginatedResponse<T> {
  current_page: number;
  data: T[];
  from: number;
  last_page: number;
  per_page: number;
  to: number;
  total: number;
}

// Internal saved proposal format (for compatibility)
export interface SavedProposal extends CalculatorState {
  total: number;
  savedAt: string;
  result?: CalculationResult;
}

// ============================================================================
// TRANSFORM FUNCTIONS
// ============================================================================

export const transformApiConfig = (items: ApiConfigItem[]): CalculatorConfig => {
  const config: CalculatorConfig = {
    meta: { name: 'OPEN Calculator Config', version: '1.0' },
    fx_default: 5.0,
    discount: {},
    gpu_usd: {},
    vm_prices_brl: { vcpu: 0, ram_per_gb: 0, nvme_per_gb: 0, ip_public: 0 },
    baremetal: { cpu_models: [], ram_tiers: [], disks: [] },
    addons_brl: { antivirus_unit: 0, firewall_pfsense: 0, tsplus_unit: 0, cal_unit: 0, sql: {}, veeam_vm_unit: 0, veeam_agent_unit: 0 },
    backup_tables_brl_per_gb: DEFAULT_CONFIG.backup_tables_brl_per_gb,
  };

  items.forEach((item) => {
    const value = parseFloat(item.value);

    switch (item.category) {
      case 'VM':
        if (item.label.includes('vCPU')) config.vm_prices_brl.vcpu = value;
        else if (item.label.includes('RAM')) config.vm_prices_brl.ram_per_gb = value;
        else if (item.label.includes('NVMe')) config.vm_prices_brl.nvme_per_gb = value;
        else if (item.label.includes('IP')) config.vm_prices_brl.ip_public = value;
        break;

      case 'BareMetal':
        if (item.group === 'Modelos de CPU') {
          config.baremetal.cpu_models.push({ id: `cpu_${item.id}`, label: item.label, price: value });
        } else if (item.group === 'Opções de RAM') {
          const gbMatch = item.label.match(/(\d+)/);
          config.baremetal.ram_tiers.push({ id: `ram_${item.id}`, label: item.label, gb: gbMatch ? parseInt(gbMatch[1]) : 0, price: value });
        } else if (item.group === 'Opções de Disco') {
          const tbMatch = item.label.match(/(\d+)/);
          config.baremetal.disks.push({ id: `disk_${item.id}`, label: item.label, tb: tbMatch ? parseInt(tbMatch[1]) : 0, price: value });
        }
        break;

      case 'GPU':
        config.gpu_usd[item.label] = value;
        break;

      case 'Add-ons':
        if (item.group === 'SQL Server') {
          const sqlKey = item.label.toLowerCase() === 'nenhum' ? 'none' : item.label.toLowerCase();
          config.addons_brl.sql[sqlKey] = value;
        } else {
          if (item.label.includes('Antivírus')) config.addons_brl.antivirus_unit = value;
          else if (item.label.includes('Firewall')) config.addons_brl.firewall_pfsense = value;
          else if (item.label.includes('TSplus')) config.addons_brl.tsplus_unit = value;
          else if (item.label.includes('CAL')) config.addons_brl.cal_unit = value;
          else if (item.label.includes('Veeam VM')) config.addons_brl.veeam_vm_unit = value;
          else if (item.label.includes('Veeam Agent')) config.addons_brl.veeam_agent_unit = value;
        }
        break;

      case 'Geral':
        if (item.group === 'Taxa de Câmbio') {
          config.fx_default = value;
        } else if (item.group === 'Descontos por Vigência') {
          const monthsMatch = item.label.match(/(\d+)/);
          if (monthsMatch) {
            config.discount[monthsMatch[1]] = value / 100;
          }
        }
        break;
    }
  });

  return config;
};

export function transformToApiProposal(
  client: { name: string; company: string; phone: string; email: string },
  proposal: { id: string; validityDays: number; createdAt: string },
  items: ServerItem[],
  addons: AddonsState,
  config: CalculatorConfig,
  fx: number,
  selectedTerm: string,
  discountPct: number,
  total: number,
  storageItems?: StorageItem[],
  kubernetes?: KubernetesState,
  openSaas?: OpenSaaSState
): ApiProposalRequest {
  const createdAt = new Date(proposal.createdAt);
  const dueAt = new Date(createdAt);
  dueAt.setDate(dueAt.getDate() + proposal.validityDays);

  // Build addons array (can be empty)
  const apiAddons: ApiProposalAddon[] = [];

  if (addons.antivirus > 0) {
    apiAddons.push({ type: 'antivirus', qty: addons.antivirus, unit_price: config.addons_brl.antivirus_unit, subtotal: addons.antivirus * config.addons_brl.antivirus_unit });
  }
  if (addons.firewall) {
    apiAddons.push({ type: 'firewall', qty: 1, unit_price: config.addons_brl.firewall_pfsense, subtotal: config.addons_brl.firewall_pfsense });
  }
  if (addons.tsplus > 0) {
    apiAddons.push({ type: 'tsplus', qty: addons.tsplus, unit_price: config.addons_brl.tsplus_unit, subtotal: addons.tsplus * config.addons_brl.tsplus_unit });
  }
  if (addons.cal > 0) {
    apiAddons.push({ type: 'cal', qty: addons.cal, unit_price: config.addons_brl.cal_unit, subtotal: addons.cal * config.addons_brl.cal_unit });
  }
  if (addons.sql !== 'none' && addons.sqlQty > 0) {
    const sqlPrice = config.addons_brl.sql[addons.sql] || 0;
    apiAddons.push({ type: 'sql', edition: addons.sql, qty: addons.sqlQty, unit_price: sqlPrice, subtotal: addons.sqlQty * sqlPrice });
  }
  if (addons.veeamVm > 0) {
    apiAddons.push({ type: 'veeam_vm', qty: addons.veeamVm, unit_price: config.addons_brl.veeam_vm_unit, subtotal: addons.veeamVm * config.addons_brl.veeam_vm_unit });
  }
  if (addons.veeamAg > 0) {
    apiAddons.push({ type: 'veeam_agent', qty: addons.veeamAg, unit_price: config.addons_brl.veeam_agent_unit, subtotal: addons.veeamAg * config.addons_brl.veeam_agent_unit });
  }
  if (addons.backupPlan !== 'none' && addons.backupGb > 0) {
    const ranges = config.backup_tables_brl_per_gb[addons.backupPlan] || [];
    let unitPrice = 0;
    for (const r of ranges) {
      if (addons.backupGb >= r.min && addons.backupGb <= r.max) {
        unitPrice = r.price;
        break;
      }
    }
    if (unitPrice === 0 && ranges.length > 0) {
      unitPrice = ranges[ranges.length - 1].price;
    }
    apiAddons.push({ type: 'backup', plan: addons.backupPlan, gb: addons.backupGb, qty: addons.backupGb, unit_price: unitPrice, subtotal: addons.backupGb * unitPrice });
  }

  // Build servers array - includes VM, BareMetal, Storage, Kubernetes, and OPEN SaaS
  const apiServers: ApiProposalServer[] = [];

  // Add VM and BareMetal servers
  items.forEach(item => {
    if (item.type === 'vm') {
      const vmItem = item as VMItem;
      const vcpuCost = vmItem.vcpu * config.vm_prices_brl.vcpu;
      const ramCost = vmItem.ramGb * config.vm_prices_brl.ram_per_gb;
      const nvmeCost = vmItem.nvmeTb * 1024 * config.vm_prices_brl.nvme_per_gb;
      const ipCost = vmItem.ips * config.vm_prices_brl.ip_public;
      const gpuCost = (config.gpu_usd[vmItem.gpu] || 0) * vmItem.gpuQty * fx;
      const subtotal = (vcpuCost + ramCost + nvmeCost + ipCost + gpuCost) * vmItem.qtyServers;

      apiServers.push({
        type: 'vm' as const,
        qty: vmItem.qtyServers,
        gpu: vmItem.gpu,
        gpu_qty: vmItem.gpuQty,
        vcpu: vmItem.vcpu,
        ram_gb: vmItem.ramGb,
        nvme_tb: vmItem.nvmeTb,
        traffic_tb: vmItem.trafficTb,
        ips: vmItem.ips,
        subtotal,
      });
    } else {
      const bmItem = item as BMItem;
      const cpu = config.baremetal.cpu_models.find(c => c.id === bmItem.bmCpu);
      const ram = config.baremetal.ram_tiers.find(r => r.id === bmItem.bmRam);
      
      let disksCost = 0;
      const apiDisks: ApiProposalDisk[] = bmItem.disks.map(disk => {
        const diskOption = config.baremetal.disks.find(d => d.id === disk.type);
        if (diskOption) disksCost += diskOption.price * disk.qty;
        return { id: disk.type, label: diskOption?.label || disk.type, qty: disk.qty };
      });

      const cpuCost = cpu?.price || 0;
      const ramCost = ram?.price || 0;
      const ipCost = bmItem.ips * config.vm_prices_brl.ip_public;
      const gpuCost = (config.gpu_usd[bmItem.gpu] || 0) * bmItem.gpuQty * fx;
      const subtotal = (cpuCost + ramCost + disksCost + ipCost + gpuCost) * bmItem.qtyServers;

      apiServers.push({
        type: 'baremetal' as const,
        qty: bmItem.qtyServers,
        gpu: bmItem.gpu,
        gpu_qty: bmItem.gpuQty,
        cpu_id: bmItem.bmCpu,
        cpu_label: cpu?.label || '',
        ram_id: bmItem.bmRam,
        ram_label: ram?.label || '',
        disks: apiDisks,
        traffic_tb: bmItem.trafficTb,
        ips: bmItem.ips,
        subtotal,
      });
    }
  });

  // Add Storage items as servers
  if (storageItems && storageItems.length > 0) {
    storageItems.forEach(storage => {
      if (storage.volumeTB >= 1) {
        const pricePerTB = getStoragePricePerTB(storage.volumeTB, storage.region, config);
        const subtotal = calculateStorageMonthly(storage.volumeTB, storage.region, config);
        apiServers.push({
          type: 'storage' as const,
          qty: 1,
          region: storage.region,
          volume_tb: storage.volumeTB,
          price_per_tb: pricePerTB,
          subtotal,
        });
      }
    });
  }

  // Add Kubernetes as server
  if (kubernetes && kubernetes.enabled) {
    const planSpec = K8S_PLANS[kubernetes.plan];
    apiServers.push({
      type: 'kubernetes' as const,
      qty: 1,
      plan: kubernetes.plan,
      plan_label: planSpec.label,
      subtotal: planSpec.price,
    });
  }

  // Add OPEN SaaS as server
  if (openSaas && openSaas.enabled && openSaas.users >= 1) {
    const unitPrice = config.open_saas_price_per_user ?? 85;
    const subtotal = openSaas.users * unitPrice;
    apiServers.push({
      type: 'open_saas' as const,
      qty: 1,
      users: openSaas.users,
      unit_price: unitPrice,
      subtotal,
    });
  }

  // Build request object (addons always present, can be empty)
  return {
    name: client.name,
    company: client.company,
    phone: client.phone,
    email: client.email,
    fx,
    contract_duration: parseInt(selectedTerm) || 1,
    discount_pct: discountPct,
    total,
    addons: apiAddons,
    servers: apiServers,
    due_at: dueAt.toISOString().split('T')[0],
  };
}

export function normalizeProposalForSave(proposal: ApiProposalRequest): ApiProposalRequest;
export function normalizeProposalForSave(proposal: Partial<ApiProposalRequest>): ApiProposalRequest;
export function normalizeProposalForSave(proposal: Partial<ApiProposalRequest>): ApiProposalRequest {
  // Deep clone to avoid accidental mutations
  let p: any = proposal;
  try {
    p = typeof structuredClone === 'function' ? structuredClone(proposal) : JSON.parse(JSON.stringify(proposal));
  } catch {
    p = proposal;
  }

  // addons: never missing
  if (!Array.isArray(p.addons)) p.addons = [];

  // servers: never missing
  if (!Array.isArray(p.servers)) p.servers = [];

  // numeric fields (API sometimes tolerates strings, but we normalize)
  p.fx = Number(p.fx) || 0;
  p.contract_duration = Number(p.contract_duration) || 1;
  p.discount_pct = Number(p.discount_pct) || 0;
  p.total = Number(p.total) || 0;

  return p as ApiProposalRequest;
}

// Transform API proposal to SavedProposal format (for compatibility with existing components)
export function transformApiToSavedProposal(apiProposal: ApiProposal, config: CalculatorConfig): SavedProposal {
  // Apply defaults to handle missing fields
  const servers = apiProposal.servers ?? [];
  const apiAddons = apiProposal.addons ?? [];

  // Transform VM and BareMetal servers back to internal format
  const items: ServerItem[] = [];
  const storageItems: StorageItem[] = [];
  let kubernetes: KubernetesState = {
    enabled: false,
    plan: 'k8s_small' as const,
    addons: {
      support_24x7: false,
      backup_velero: false,
      dr_multisite: false,
      observability: false,
      cicd_managed: false,
      devops_hours: 0,
    },
    extras: { vcpu: 0, ramGB: 0, diskGB: 0 },
  };
  let openSaas: OpenSaaSState = {
    enabled: false,
    users: 0,
  };
  
  servers.forEach((server, idx) => {
    if (server.type === 'vm') {
      const vmServer = server as ApiProposalVMServer;
      items.push({
        type: 'vm' as const,
        id: `server_${idx}`,
        gpu: vmServer.gpu,
        gpuQty: vmServer.gpu_qty,
        vcpu: vmServer.vcpu,
        ramGb: vmServer.ram_gb,
        nvmeTb: vmServer.nvme_tb,
        trafficTb: vmServer.traffic_tb,
        ips: vmServer.ips,
        qtyServers: vmServer.qty,
      });
    } else if (server.type === 'baremetal') {
      const bmServer = server as ApiProposalBareMetalServer;
      items.push({
        type: 'bm' as const,
        id: `server_${idx}`,
        gpu: bmServer.gpu,
        gpuQty: bmServer.gpu_qty,
        bmCpu: bmServer.cpu_id,
        bmRam: bmServer.ram_id,
        disks: bmServer.disks.map(d => ({ type: d.id, qty: d.qty, desc: d.label })),
        trafficTb: bmServer.traffic_tb,
        ips: bmServer.ips,
        qtyServers: bmServer.qty,
      });
    } else if (server.type === 'storage') {
      const storageServer = server as ApiProposalStorageServer;
      storageItems.push({
        id: `storage_${idx}`,
        storageType: (storageServer as any).storage_type || 'sas',
        region: storageServer.region as 'BR' | 'USA',
        volumeTB: storageServer.volume_tb,
      });
    } else if (server.type === 'kubernetes') {
      const k8sServer = server as ApiProposalKubernetesServer;
      kubernetes = {
        enabled: true,
        plan: k8sServer.plan as 'k8s_small' | 'k8s_medium' | 'k8s_large',
        addons: {
          support_24x7: false,
          backup_velero: false,
          dr_multisite: false,
          observability: false,
          cicd_managed: false,
          devops_hours: 0,
        },
        extras: { vcpu: 0, ramGB: 0, diskGB: 0 },
      };
    } else if (server.type === 'open_saas') {
      const saasServer = server as ApiProposalOpenSaasServer;
      openSaas = {
        enabled: true,
        users: saasServer.users,
      };
    }
  });

  // Transform addons back to internal format (with defaults)
  const addons: AddonsState = {
    backupPlan: 'none',
    backupGb: 0,
    antivirus: 0,
    firewall: false,
    tsplus: 0,
    cal: 0,
    sql: 'none',
    sqlQty: 0,
    veeamVm: 0,
    veeamAg: 0,
  };

  apiAddons.forEach(addon => {
    switch (addon.type) {
      case 'antivirus': addons.antivirus = addon.qty; break;
      case 'firewall': addons.firewall = true; break;
      case 'tsplus': addons.tsplus = addon.qty; break;
      case 'cal': addons.cal = addon.qty; break;
      case 'sql': addons.sql = addon.edition || 'none'; addons.sqlQty = addon.qty; break;
      case 'veeam_vm': addons.veeamVm = addon.qty; break;
      case 'veeam_agent': addons.veeamAg = addon.qty; break;
      case 'backup': addons.backupPlan = addon.plan || 'none'; addons.backupGb = addon.gb || 0; break;
    }
  });

  // Calculate result rows for display
  const rows = servers.map((server, idx) => {
    let label = '';
    switch (server.type) {
      case 'vm': label = `VM #${idx + 1}`; break;
      case 'baremetal': label = `BareMetal #${idx + 1}`; break;
      case 'storage': label = `Storage (${(server as ApiProposalStorageServer).region})`; break;
      case 'kubernetes': label = `Kubernetes (${(server as ApiProposalKubernetesServer).plan})`; break;
      case 'open_saas': label = `OPEN SaaS`; break;
      default: label = `Server #${idx + 1}`;
    }
    return {
      label,
      qty: server.qty,
      unitPrice: server.subtotal / (server.qty || 1),
      subtotal: server.subtotal,
    };
  });

  apiAddons.forEach(addon => {
    rows.push({
      label: addon.type.replace('_', ' ').toUpperCase(),
      qty: addon.qty,
      unitPrice: addon.unit_price,
      subtotal: addon.subtotal,
    });
  });

  const subRec = servers.filter(s => s.type === 'vm' || s.type === 'baremetal').reduce((acc, s) => acc + s.subtotal, 0);
  const subStorage = servers.filter(s => s.type === 'storage').reduce((acc, s) => acc + s.subtotal, 0);
  const subKubernetes = servers.filter(s => s.type === 'kubernetes').reduce((acc, s) => acc + s.subtotal, 0);
  const subOpenSaas = servers.filter(s => s.type === 'open_saas').reduce((acc, s) => acc + s.subtotal, 0);
  const subServices = apiAddons.filter(a => a.type !== 'backup').reduce((acc, a) => acc + a.subtotal, 0);
  const subBackup = apiAddons.find(a => a.type === 'backup')?.subtotal || 0;

  const fx = typeof apiProposal.fx === 'string' ? parseFloat(apiProposal.fx) : apiProposal.fx;
  const discountPct = typeof apiProposal.discount_pct === 'string' ? parseFloat(apiProposal.discount_pct) : apiProposal.discount_pct;
  const total = typeof apiProposal.total === 'string' ? parseFloat(apiProposal.total) : apiProposal.total;

  return {
    fx,
    selectedTerm: String(apiProposal.contract_duration),
    client: {
      name: apiProposal.name,
      company: apiProposal.company,
      phone: apiProposal.phone,
      email: apiProposal.email,
    },
    proposal: {
      id: String(apiProposal.id),
      validityDays: 7, // Default
      createdAt: apiProposal.created_at,
    },
    items,
    addons,
    kubernetes,
    storageItems,
    reseller: {
      enabled: false,
      viewMode: 'INTERNO' as const,
      resellerName: '',
      overValue: 0,
      overReason: '',
      observations: '',
      approvalRequired: false,
      approvalStatus: 'Pendente' as const,
      approver: '',
      approvedAt: null,
    },
    openSaas,
    total,
    savedAt: apiProposal.created_at,
    result: {
      rows,
      subRec,
      subIps: 0,
      subServices,
      subBackup,
      subKubernetes,
      subStorage,
      subOpenSaas,
      discountPct,
      discountValue: total * discountPct / (1 - discountPct || 1),
      grandTotal: total,
      totalServers: servers.reduce((acc, s) => acc + s.qty, 0),
      gpuUsdTotal: 0,
      gpuBrlTotal: 0,
      subtotalPriceList: subRec + subServices + subBackup + subStorage + subKubernetes + subOpenSaas,
      overValue: 0,
      overPercent: 0,
      totalWithOver: total,
    },
  };
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

export const api = {
  // Fetch calculator config
  async fetchConfig(): Promise<CalculatorConfig> {
    try {
      const response = await apiClient.get<ApiConfigItem[]>(`${API_V2_PREFIX}/config/all`);
      return transformApiConfig(response.data);
    } catch (error) {
      console.error('[API] Error fetching config:', error);
      return DEFAULT_CONFIG;
    }
  },

  // Save calculator config to external API
  async saveConfig(config: CalculatorConfig): Promise<{ success: boolean; error?: string }> {
    try {
      // Transform CalculatorConfig to API format (array of ApiConfigItem-like objects)
      const configItems: Array<{ category: string; group: string; label: string; type: string; value: string }> = [];

      // VM prices
      configItems.push({ category: 'VM', group: 'Preços', label: 'vCPU', type: 'BRL', value: String(config.vm_prices_brl.vcpu) });
      configItems.push({ category: 'VM', group: 'Preços', label: 'RAM por GB', type: 'BRL', value: String(config.vm_prices_brl.ram_per_gb) });
      configItems.push({ category: 'VM', group: 'Preços', label: 'NVMe por GB', type: 'BRL', value: String(config.vm_prices_brl.nvme_per_gb) });
      configItems.push({ category: 'VM', group: 'Preços', label: 'IP Público', type: 'BRL', value: String(config.vm_prices_brl.ip_public) });

      // BareMetal CPU models
      config.baremetal.cpu_models.forEach(cpu => {
        configItems.push({ category: 'BareMetal', group: 'Modelos de CPU', label: cpu.label, type: 'BRL', value: String(cpu.price) });
      });

      // BareMetal RAM tiers
      config.baremetal.ram_tiers.forEach(ram => {
        configItems.push({ category: 'BareMetal', group: 'Opções de RAM', label: ram.label, type: 'BRL', value: String(ram.price) });
      });

      // BareMetal disks
      config.baremetal.disks.forEach(disk => {
        configItems.push({ category: 'BareMetal', group: 'Opções de Disco', label: disk.label, type: 'BRL', value: String(disk.price) });
      });

      // GPU prices
      Object.entries(config.gpu_usd).forEach(([label, price]) => {
        configItems.push({ category: 'GPU', group: 'Preços USD', label, type: 'USD', value: String(price) });
      });

      // Add-ons
      configItems.push({ category: 'Add-ons', group: 'Serviços', label: 'Antivírus', type: 'BRL', value: String(config.addons_brl.antivirus_unit) });
      configItems.push({ category: 'Add-ons', group: 'Serviços', label: 'Firewall pfSense', type: 'BRL', value: String(config.addons_brl.firewall_pfsense) });
      configItems.push({ category: 'Add-ons', group: 'Serviços', label: 'TSplus', type: 'BRL', value: String(config.addons_brl.tsplus_unit) });
      configItems.push({ category: 'Add-ons', group: 'Serviços', label: 'CAL', type: 'BRL', value: String(config.addons_brl.cal_unit) });
      configItems.push({ category: 'Add-ons', group: 'Serviços', label: 'Veeam VM', type: 'BRL', value: String(config.addons_brl.veeam_vm_unit) });
      configItems.push({ category: 'Add-ons', group: 'Serviços', label: 'Veeam Agent', type: 'BRL', value: String(config.addons_brl.veeam_agent_unit) });

      // SQL editions
      Object.entries(config.addons_brl.sql).forEach(([edition, price]) => {
        const label = edition === 'none' ? 'Nenhum' : edition.toUpperCase();
        configItems.push({ category: 'Add-ons', group: 'SQL Server', label, type: 'BRL', value: String(price) });
      });

      // Custom add-ons (any key not in the standard list)
      const standardAddonKeys = ['antivirus_unit', 'firewall_pfsense', 'tsplus_unit', 'cal_unit', 'sql', 'veeam_vm_unit', 'veeam_agent_unit'];
      Object.entries(config.addons_brl).forEach(([key, value]) => {
        if (!standardAddonKeys.includes(key) && typeof value === 'number') {
          configItems.push({ category: 'Add-ons', group: 'Serviços Customizados', label: key, type: 'BRL', value: String(value) });
        }
      });

      // General settings
      configItems.push({ category: 'Geral', group: 'Taxa de Câmbio', label: 'USD para BRL', type: 'BRL', value: String(config.fx_default) });

      // Discounts
      Object.entries(config.discount).forEach(([term, discount]) => {
        configItems.push({ category: 'Geral', group: 'Descontos por Vigência', label: `${term} meses`, type: 'PERCENTAGE', value: String(discount * 100) });
      });

      await apiClient.post(`${API_V2_PREFIX}/config`, { items: configItems });
      return { success: true };
    } catch (error: any) {
      console.error('[API] Error saving config:', error);
      const message = error.response?.data?.message || error.message || 'Erro ao salvar configuração';
      return { success: false, error: message };
    }
  },

  // Get all proposals (paginated)
  async getProposals(page = 1, perPage = 100): Promise<{ proposals: SavedProposal[]; pagination: { currentPage: number; lastPage: number; total: number } }> {
    try {
      const response = await apiClient.get<PaginatedResponse<ApiProposal>>(`${API_V2_PREFIX}/proposal`, {
        params: { __page: page, __perPage: perPage }
      });
      const config = await this.fetchConfig();
      const proposals = response.data.data.map(p => transformApiToSavedProposal(p, config));
      return {
        proposals,
        pagination: {
          currentPage: response.data.current_page,
          lastPage: response.data.last_page,
          total: response.data.total,
        }
      };
    } catch (error) {
      console.error('[API] Error fetching proposals:', error);
      return { proposals: [], pagination: { currentPage: 1, lastPage: 1, total: 0 } };
    }
  },

  // Get proposal by ID
  async getProposalById(id: string): Promise<SavedProposal | null> {
    try {
      const response = await apiClient.get<ApiProposal>(`${API_V2_PREFIX}/proposal/${id}`);
      const config = await this.fetchConfig();
      return transformApiToSavedProposal(response.data, config);
    } catch (error) {
      console.error('[API] Error fetching proposal:', error);
      return null;
    }
  },

  // Save proposal (create)
  async saveProposal(proposal: ApiProposalRequest): Promise<{ success: boolean; data?: ApiProposal; error?: string }> {
    try {
      const normalized = normalizeProposalForSave(proposal);
      console.info('[API] saveProposal payload', {
        addonsLen: normalized.addons?.length ?? null,
        serversLen: normalized.servers?.length ?? null,
        total: normalized.total,
      });

      const response = await apiClient.post<ApiProposal>(`${API_V2_PREFIX}/proposal`, normalized);
      return { success: true, data: response.data };
    } catch (error: any) {
      console.error('[API] Error saving proposal:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
      });
      const message = error.response?.data?.message || error.message || 'Erro ao salvar proposta';
      return { success: false, error: message };
    }
  },

  // Update proposal
  async updateProposal(id: string, proposal: ApiProposalRequest): Promise<{ success: boolean; data?: ApiProposal; error?: string }> {
    try {
      const normalized = normalizeProposalForSave(proposal);
      console.info('[API] updateProposal payload', {
        id,
        addonsLen: normalized.addons?.length ?? null,
        serversLen: normalized.servers?.length ?? null,
        total: normalized.total,
      });

      const response = await apiClient.put<ApiProposal>(`${API_V2_PREFIX}/proposal/${id}`, normalized);
      return { success: true, data: response.data };
    } catch (error: any) {
      console.error('[API] Error updating proposal:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
      });
      const message = error.response?.data?.message || error.message || 'Erro ao atualizar proposta';
      return { success: false, error: message };
    }
  },

  // Delete proposal
  async deleteProposal(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      await apiClient.delete(`${API_V2_PREFIX}/proposal/${id}`);
      return { success: true };
    } catch (error: any) {
      console.error('[API] Error deleting proposal:', error);
      return { success: false, error: error.response?.data?.message || error.message || 'Erro ao excluir proposta' };
    }
  },

  // Track proposal view
  async trackProposalView(proposalId: string, source: string): Promise<void> {
    try {
      await apiClient.post(`${API_V2_PREFIX}/proposal/view`, { 
        proposal_id: parseInt(proposalId), 
        source, 
        user_agent: navigator.userAgent 
      });
    } catch (error) {
      console.log('[API] Error tracking view:', error);
    }
  },

  // Get proposal views
  async getProposalViews(proposalId: string): Promise<ProposalView[]> {
    try {
      const response = await apiClient.get<ProposalView[]>(`${API_V2_PREFIX}/proposal/view/all`);
      // Filter by proposal_id since the API returns all views
      return response.data.filter(v => v.proposal_id === parseInt(proposalId));
    } catch (error) {
      console.error('[API] Error fetching views:', error);
      return [];
    }
  },

  // Send proposal email via Edge Function (Resend)
  async sendProposalEmail(data: SendEmailRequest): Promise<{ success: boolean; error?: string }> {
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/send-proposal-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        return { success: false, error: result.error || 'Erro ao enviar email' };
      }
      
      return { success: true };
    } catch (error: any) {
      console.error('[API] Error sending email:', error);
      return { success: false, error: error.message || 'Erro ao enviar email' };
    }
  },
};
