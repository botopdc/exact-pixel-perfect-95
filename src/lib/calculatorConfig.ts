// Tipos e configuração para a calculadora OPEN
export interface CpuModel {
  id: string;
  label: string;
  price: number;
}

export interface RamTier {
  id: string;
  label: string;
  gb: number;
  price: number;
}

export interface DiskOption {
  id: string;
  label: string;
  tb: number;
  price: number;
}

export interface BackupPriceRange {
  min: number;
  max: number;
  price: number;
}

// Storage type enum
export type StorageType = 'sas' | 's3' | 'nvme';

export const STORAGE_TYPE_LABELS: Record<StorageType, string> = {
  sas: 'Storage SAS',
  s3: 'Bucket S3',
  nvme: 'SSD NVMe',
};

// Single region pricing (5 tiers) - used for SAS and S3 (S3 reuses SAS pricing)
export interface StorageRegionPricing {
  pricePerTB_1_10: number;
  pricePerTB_11_100: number;
  pricePerTB_101_500: number;
  pricePerTB_501_1024: number;
  pricePerTB_gt_1024: number;
}

// Per storage type, per region (for SAS only - S3 inherits from SAS)
export interface StorageTypePricing {
  br: StorageRegionPricing;
  usa: StorageRegionPricing;
}

// NVMe fixed pricing config (R$/GB)
export interface NvmePricingConfig {
  pricePerGB: number;
}

// Full storage pricing config
export interface StoragePricingConfig {
  sas: StorageTypePricing;
  // Note: S3 inherits SAS pricing automatically - no separate config needed
  nvme: NvmePricingConfig;
}

// Legacy flat structure (for backward compatibility)
export interface StoragePriceConfig {
  pricePerTB_BR_1_10: number;
  pricePerTB_BR_11_100: number;
  pricePerTB_BR_101_500: number;
  pricePerTB_BR_501_1024: number;
  pricePerTB_BR_gt_1024: number;
  pricePerTB_USA_1_10: number;
  pricePerTB_USA_11_100: number;
  pricePerTB_USA_101_500: number;
  pricePerTB_USA_501_1024: number;
  pricePerTB_USA_gt_1024: number;
}

export interface CalculatorConfig {
  meta: {
    name: string;
    version: string;
  };
  fx_default: number;
  discount: Record<string, number>;
  gpu_usd: Record<string, number>;
  vm_prices_brl: {
    vcpu: number;
    ram_per_gb: number;
    nvme_per_gb: number;
    ip_public: number;
  };
  baremetal: {
    cpu_models: CpuModel[];
    ram_tiers: RamTier[];
    disks: DiskOption[];
  };
  addons_brl: {
    antivirus_unit: number;
    firewall_pfsense: number;
    tsplus_unit: number;
    cal_unit: number;
    sql: Record<string, number>;
    veeam_vm_unit: number;
    veeam_agent_unit: number;
  };
  backup_tables_brl_per_gb: Record<string, BackupPriceRange[]>;
  // OPEN SaaS pricing
  open_saas_price_per_user?: number;
  // Legacy Storage pricing config (optional, falls back to STORAGE_PRICE_TIERS)
  storage_prices?: StoragePriceConfig;
  // New extended storage pricing (SAS, S3, NVMe)
  storage_pricing?: StoragePricingConfig;
  // Kubernetes pricing config (editable base prices for each plan)
  kubernetes_pricing?: KubernetesPricingConfig;
  // Kubernetes add-ons pricing config
  kubernetes_addons_pricing?: K8sAddonsPricingConfig;
}

export const DEFAULT_CONFIG: CalculatorConfig = {
  meta: {
    name: "OPEN Calculator Config",
    version: "1.0"
  },
  fx_default: 5.0,
  discount: {
    "1": 0,
    "12": 0.05,
    "36": 0.12,
    "48": 0.15
  },
  gpu_usd: {
    "Sem GPU": 0,
    "NVIDIA T4": 1090,
    "NVIDIA A100 40GB": 2400,
    "NVIDIA A100 80GB": 3200,
    "NVIDIA H100 80GB": 7600
  },
  vm_prices_brl: {
    vcpu: 45.0,
    ram_per_gb: 9.0,
    nvme_per_gb: 0.9,
    ip_public: 30.0
  },
  baremetal: {
    cpu_models: [
      {
        id: "e5_2680v4",
        label: "2x Intel Xeon E5-2680v4 28c/56t 2.4GHz/3.3GHz - Disponível",
        price: 700.0
      },
      {
        id: "gold_5418y",
        label: "2x Intel Xeon Gold 5418Y 2G, 48C/96T DDR5",
        price: 3600.0
      },
      {
        id: "gold_6138",
        label: "2 x Intel Xeon Gold 6138 40c/80t 2.0GHz/3.7GHz - Disponível",
        price: 850.0
      }
    ],
    ram_tiers: [
      { id: "128", label: "128GB", gb: 128, price: 400.0 },
      { id: "256", label: "256GB", gb: 256, price: 800.0 },
      { id: "384", label: "384GB", gb: 384, price: 1200.0 },
      { id: "512", label: "512GB", gb: 512, price: 1500.0 }
    ],
    disks: [
      { id: "1tb", label: "1TB NVMe", tb: 1, price: 150.0 },
      { id: "2tb", label: "2TB NVMe", tb: 2, price: 300.0 },
      { id: "4tb", label: "4TB NVMe", tb: 4, price: 580.0 }
    ]
  },
  addons_brl: {
    antivirus_unit: 69.9,
    firewall_pfsense: 199.9,
    tsplus_unit: 40.0,
    cal_unit: 55.0,
    sql: {
      none: 0,
      web: 200.0,
      we: 265.0,
      std: 2240.0
    },
    veeam_vm_unit: 50.0,
    veeam_agent_unit: 45.0
  },
  backup_tables_brl_per_gb: {
    "7": [
      { min: 1, max: 100, price: 0.5 },
      { min: 101, max: 200, price: 0.475 },
      { min: 201, max: 400, price: 0.415 },
      { min: 401, max: 500, price: 0.4 },
      { min: 501, max: 700, price: 0.375 },
      { min: 701, max: 1000, price: 0.2 },
      { min: 1001, max: 2000, price: 0.2 },
      { min: 2001, max: 4000, price: 0.2 }
    ],
    "15": [
      { min: 1, max: 100, price: 0.6 },
      { min: 101, max: 200, price: 0.575 },
      { min: 201, max: 400, price: 0.515 },
      { min: 401, max: 500, price: 0.5 },
      { min: 501, max: 700, price: 0.475 },
      { min: 701, max: 1000, price: 0.47 },
      { min: 1001, max: 2000, price: 0.47 },
      { min: 2001, max: 4000, price: 0.47 }
    ],
    "30": [
      { min: 1, max: 100, price: 0.8 },
      { min: 101, max: 200, price: 0.775 },
      { min: 201, max: 400, price: 0.715 },
      { min: 401, max: 500, price: 0.7 },
      { min: 501, max: 700, price: 0.675 },
      { min: 701, max: 1000, price: 0.67 },
      { min: 1001, max: 2000, price: 0.67 },
      { min: 2001, max: 4000, price: 0.67 }
    ]
  },
  // OPEN SaaS default price
  open_saas_price_per_user: 85.0,
  // Legacy Storage pricing defaults (for backward compatibility - used for SAS)
  storage_prices: {
    pricePerTB_BR_1_10: 119,
    pricePerTB_BR_11_100: 99,
    pricePerTB_BR_101_500: 75,
    pricePerTB_BR_501_1024: 55,
    pricePerTB_BR_gt_1024: 45,
    pricePerTB_USA_1_10: 99,
    pricePerTB_USA_11_100: 79,
    pricePerTB_USA_101_500: 55,
    pricePerTB_USA_501_1024: 45,
    pricePerTB_USA_gt_1024: 42,
  },
  // Extended storage pricing (SAS uses tiered pricing, S3 inherits SAS, NVMe is fixed per GB)
  storage_pricing: {
    sas: {
      br: { pricePerTB_1_10: 119, pricePerTB_11_100: 99, pricePerTB_101_500: 75, pricePerTB_501_1024: 55, pricePerTB_gt_1024: 45 },
      usa: { pricePerTB_1_10: 99, pricePerTB_11_100: 79, pricePerTB_101_500: 55, pricePerTB_501_1024: 45, pricePerTB_gt_1024: 42 },
    },
    // S3 inherits SAS pricing - no separate config
    nvme: {
      pricePerGB: 0.90, // Fixed R$ 0.90/GB
    },
  },
};

// Tipos para itens da calculadora
export interface DiskItem {
  type: string;
  qty: number;
  desc: string;
}

export interface VMItem {
  type: 'vm';
  id: string;
  gpu: string;
  gpuQty: number;
  vcpu: number;
  ramGb: number;
  nvmeTb: number;
  trafficTb: number;
  ips: number;
  qtyServers: number;
}

export interface BMItem {
  type: 'bm';
  id: string;
  gpu: string;
  gpuQty: number;
  bmCpu: string;
  bmRam: string;
  disks: DiskItem[];
  trafficTb: number;
  ips: number;
  qtyServers: number;
}

export type ServerItem = VMItem | BMItem;

export interface ClientInfo {
  name: string;
  company: string;
  phone: string;
  email: string;
}

export interface ProposalMeta {
  id: string;
  validityDays: number;
  createdAt: string;
}

// Kubernetes types
export type K8sPlan = 'k8s_small' | 'k8s_medium' | 'k8s_large';

export interface K8sAddons {
  support_24x7: boolean;
  backup_velero: boolean;
  dr_multisite: boolean;
  observability: boolean;
  cicd_managed: boolean;
  devops_hours: number;
}

export interface KubernetesState {
  enabled: boolean;
  plan: K8sPlan;
  addons: K8sAddons;
  extras: K8sExtras;
}

export interface K8sPlanSpec {
  label: string;
  shortLabel: string;
  nodes: number;
  vcpu_per_node: number;
  ram_gb_per_node: number;
  disk_gb_per_node: number;
  price: number;
}

// Kubernetes extras for resource customization above base plan
export interface K8sExtras {
  vcpu: number;
  ramGB: number;
  diskGB: number;
}

export const DEFAULT_K8S_EXTRAS: K8sExtras = {
  vcpu: 0,
  ramGB: 0,
  diskGB: 0,
};

// Kubernetes pricing config (editable in Precos page)
export interface KubernetesPricingConfig {
  k8s_small: { basePriceMonthly: number };
  k8s_medium: { basePriceMonthly: number };
  k8s_large: { basePriceMonthly: number };
}

// Kubernetes Add-ons pricing config (editable in Precos page)
export interface K8sAddonsPricingConfig {
  support_24x7: number;
  backup_velero: number;
  dr_multisite: number;
  observability: number;
  cicd_managed: number;
  devops_hours: number;
}

export const K8S_PLANS: Record<K8sPlan, K8sPlanSpec> = {
  k8s_small: {
    label: 'SMALL — 3 nodes (4 vCPU / 8 GB / 100 GB)',
    shortLabel: 'SMALL',
    nodes: 3,
    vcpu_per_node: 4,
    ram_gb_per_node: 8,
    disk_gb_per_node: 100,
    price: 3200,
  },
  k8s_medium: {
    label: 'MEDIUM — 5 nodes (6 vCPU / 16 GB / 150 GB)',
    shortLabel: 'MEDIUM',
    nodes: 5,
    vcpu_per_node: 6,
    ram_gb_per_node: 16,
    disk_gb_per_node: 150,
    price: 6200,
  },
  k8s_large: {
    label: 'LARGE — 7 nodes (8 vCPU / 32 GB / 200 GB)',
    shortLabel: 'LARGE',
    nodes: 7,
    vcpu_per_node: 8,
    ram_gb_per_node: 32,
    disk_gb_per_node: 200,
    price: 11900,
  },
};

export const K8S_ADDONS_PRICES = {
  support_24x7: 1200,
  backup_velero: 600,
  dr_multisite: 2500,
  observability: 900,
  cicd_managed: 1500,
  devops_hours: 250,
};

export const K8S_ADDONS_LABELS: Record<keyof typeof K8S_ADDONS_PRICES, string> = {
  support_24x7: 'Suporte 24×7',
  backup_velero: 'Backup (Velero)',
  dr_multisite: 'DR multi-site',
  observability: 'Observabilidade avançada',
  cicd_managed: 'CI/CD gerenciado',
  devops_hours: 'Horas DevOps',
};

// Get K8s addon price from config (falls back to K8S_ADDONS_PRICES static price)
export const getK8sAddonPrice = (addonKey: keyof typeof K8S_ADDONS_PRICES, config?: CalculatorConfig): number => {
  if (config?.kubernetes_addons_pricing?.[addonKey] !== undefined) {
    return config.kubernetes_addons_pricing[addonKey];
  }
  return K8S_ADDONS_PRICES[addonKey];
};

// Get K8s plan base price from config (falls back to K8S_PLANS static price)
export const getK8sPlanBasePrice = (plan: K8sPlan, config?: CalculatorConfig): number => {
  if (config?.kubernetes_pricing?.[plan]) {
    return config.kubernetes_pricing[plan].basePriceMonthly;
  }
  return K8S_PLANS[plan].price;
};

// Get K8s plan total base resources (nodes × resources per node)
export const getK8sPlanBaseResources = (plan: K8sPlan) => {
  const planSpec = K8S_PLANS[plan];
  return {
    vcpu: planSpec.nodes * planSpec.vcpu_per_node,
    ramGB: planSpec.nodes * planSpec.ram_gb_per_node,
    diskGB: planSpec.nodes * planSpec.disk_gb_per_node,
  };
};

// Calculate K8s extras price using VM pricing
export const calculateK8sExtrasPrice = (extras: K8sExtras, config: CalculatorConfig): number => {
  const vcpuPrice = (extras.vcpu || 0) * config.vm_prices_brl.vcpu;
  const ramPrice = (extras.ramGB || 0) * config.vm_prices_brl.ram_per_gb;
  const diskPrice = (extras.diskGB || 0) * config.vm_prices_brl.nvme_per_gb;
  return vcpuPrice + ramPrice + diskPrice;
};

// Storage types and pricing
export type StorageRegion = 'BR' | 'USA';

export interface StorageItem {
  id: string;
  storageType: StorageType;
  region: StorageRegion;
  volumeTB: number; // For SAS and S3 (in TB)
  volumeGB?: number; // For NVMe (in GB)
}

export interface StoragePriceTier {
  minTB: number;
  maxTB: number;
  pricePerTB_BR: number;
  pricePerTB_USA: number;
}

export const STORAGE_PRICE_TIERS: StoragePriceTier[] = [
  { minTB: 1, maxTB: 10, pricePerTB_BR: 119, pricePerTB_USA: 99 },
  { minTB: 11, maxTB: 100, pricePerTB_BR: 99, pricePerTB_USA: 79 },
  { minTB: 101, maxTB: 500, pricePerTB_BR: 75, pricePerTB_USA: 55 },
  { minTB: 501, maxTB: 1024, pricePerTB_BR: 55, pricePerTB_USA: 45 },
  { minTB: 1024.01, maxTB: Infinity, pricePerTB_BR: 45, pricePerTB_USA: 42 },
];

// Get storage price per TB for SAS and S3 (S3 uses same SAS pricing)
export const getStoragePricePerTB = (
  volumeTB: number, 
  region: StorageRegion, 
  config?: CalculatorConfig, 
  storageType: StorageType = 'sas'
): number => {
  // NVMe uses GB pricing, not TB
  if (storageType === 'nvme') {
    return 0; // NVMe doesn't use price per TB
  }
  
  if (volumeTB < 1) return 0;
  
  // Helper to get price from region pricing config
  const getPriceFromRegionConfig = (regionPricing: StorageRegionPricing): number => {
    if (volumeTB <= 10) return regionPricing.pricePerTB_1_10;
    if (volumeTB <= 100) return regionPricing.pricePerTB_11_100;
    if (volumeTB <= 500) return regionPricing.pricePerTB_101_500;
    if (volumeTB <= 1024) return regionPricing.pricePerTB_501_1024;
    return regionPricing.pricePerTB_gt_1024;
  };
  
  // Both SAS and S3 use SAS pricing (S3 inherits from SAS)
  if (config?.storage_pricing?.sas) {
    const sasPricing = config.storage_pricing.sas;
    const regionPricing = region === 'BR' ? sasPricing.br : sasPricing.usa;
    return getPriceFromRegionConfig(regionPricing);
  }
  
  // Fallback to legacy storage_prices (backward compatibility)
  if (config?.storage_prices) {
    const sp = config.storage_prices;
    if (volumeTB <= 10) {
      return region === 'BR' ? sp.pricePerTB_BR_1_10 : sp.pricePerTB_USA_1_10;
    } else if (volumeTB <= 100) {
      return region === 'BR' ? sp.pricePerTB_BR_11_100 : sp.pricePerTB_USA_11_100;
    } else if (volumeTB <= 500) {
      return region === 'BR' ? sp.pricePerTB_BR_101_500 : sp.pricePerTB_USA_101_500;
    } else if (volumeTB <= 1024) {
      return region === 'BR' ? sp.pricePerTB_BR_501_1024 : sp.pricePerTB_USA_501_1024;
    } else {
      return region === 'BR' ? sp.pricePerTB_BR_gt_1024 : sp.pricePerTB_USA_gt_1024;
    }
  }
  
  // Fallback to static STORAGE_PRICE_TIERS
  for (const tier of STORAGE_PRICE_TIERS) {
    if (volumeTB >= tier.minTB && volumeTB <= tier.maxTB) {
      return region === 'BR' ? tier.pricePerTB_BR : tier.pricePerTB_USA;
    }
  }
  const lastTier = STORAGE_PRICE_TIERS[STORAGE_PRICE_TIERS.length - 1];
  return region === 'BR' ? lastTier.pricePerTB_BR : lastTier.pricePerTB_USA;
};

// Get NVMe price per GB (fixed price, no tiers)
export const getNvmePricePerGB = (config?: CalculatorConfig): number => {
  return config?.storage_pricing?.nvme?.pricePerGB ?? 0.90; // Default R$ 0.90/GB
};

// Calculate storage monthly cost
export const calculateStorageMonthly = (
  volume: number, // TB for SAS/S3, GB for NVMe
  region: StorageRegion, 
  config?: CalculatorConfig,
  storageType: StorageType = 'sas'
): number => {
  if (storageType === 'nvme') {
    // NVMe: volume is in GB, fixed price per GB
    if (volume < 1) return 0;
    const pricePerGB = getNvmePricePerGB(config);
    return volume * pricePerGB;
  }
  
  // SAS and S3: volume is in TB, tiered pricing
  if (volume < 1) return 0;
  const pricePerTB = getStoragePricePerTB(volume, region, config, storageType);
  return volume * pricePerTB;
};

export const getStorageTierLabel = (volumeTB: number): string => {
  if (volumeTB <= 10) return '1-10 TB';
  if (volumeTB <= 100) return '11-100 TB';
  if (volumeTB <= 500) return '101-500 TB';
  if (volumeTB <= 1024) return '501 TB - 1 PB';
  return '> 1 PB';
};

// OPEN SaaS types
export interface OpenSaaSState {
  enabled: boolean;
  users: number;
}

export interface AddonsState {
  backupPlan: string;
  backupGb: number;
  antivirus: number;
  firewall: boolean;
  tsplus: number;
  cal: number;
  sql: string;
  sqlQty: number;
  veeamVm: number;
  veeamAg: number;
  // Dynamic custom add-ons: key -> quantity
  customAddons?: Record<string, number>;
}

// Canal / Revenda state
export interface ResellerState {
  enabled: boolean;
  viewMode: 'INTERNO' | 'CLIENTE';
  resellerName: string;
  overValue: number; // Over value in BRL (max 30% of subtotal)
  overReason: string;
  observations: string;
  // Approval fields (when overPercent > 20%)
  approvalRequired: boolean;
  approvalStatus: 'Pendente' | 'Aprovado';
  approver: string;
  approvedAt: string | null;
}

export const DEFAULT_RESELLER_STATE: ResellerState = {
  enabled: false,
  viewMode: 'INTERNO',
  resellerName: '',
  overValue: 0,
  overReason: '',
  observations: '',
  approvalRequired: false,
  approvalStatus: 'Pendente',
  approver: '',
  approvedAt: null,
};

export interface CalculatorState {
  fx: number;
  selectedTerm: string;
  client: ClientInfo;
  proposal: ProposalMeta;
  items: ServerItem[];
  addons: AddonsState;
  kubernetes: KubernetesState;
  storageItems: StorageItem[];
  reseller: ResellerState;
  openSaas: OpenSaaSState;
}

export const DEFAULT_OPEN_SAAS_STATE: OpenSaaSState = {
  enabled: false,
  users: 5,
};

export interface SummaryRow {
  label: string;
  qty: string | number;
  unitPrice: number;
  subtotal: number;
}

export interface CalculationResult {
  rows: SummaryRow[];
  subRec: number;
  subIps: number;
  subServices: number;
  subBackup: number;
  subKubernetes: number;
  subStorage: number;
  subOpenSaas: number;
  discountPct: number;
  discountValue: number;
  grandTotal: number;
  totalServers: number;
  gpuUsdTotal: number;
  gpuBrlTotal: number;
  // Reseller/Over fields
  subtotalPriceList: number;
  overValue: number;
  overPercent: number;
  totalWithOver: number;
  // Partner discount fields
  partnerDiscountPct?: number;
  partnerDiscountValue?: number;
}

// Funções utilitárias
export const formatCurrency = (value: number): string => {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export const formatCurrencyBRL = (value: number): string => {
  return `R$ ${formatCurrency(value)}`;
};

export const generateProposalId = (): string => {
  const id = crypto.randomUUID?.() || Math.random().toString(16).slice(2) + Date.now().toString(16);
  return "OPEN-" + id.split("-")[0].toUpperCase();
};

export const formatDateBR = (iso: string): string => {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "-";
    return d.toLocaleDateString("pt-BR");
  } catch {
    return "-";
  }
};

export const getValidityDate = (iso: string, days: number): Date => {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d;
};

export const calculateBackupPrice = (
  config: CalculatorConfig,
  plan: string,
  gb: number
): number => {
  if (plan === "none" || gb <= 0) return 0;
  const ranges = config.backup_tables_brl_per_gb[plan] || [];
  let price = 0;
  for (const r of ranges) {
    if (gb >= r.min && gb <= r.max) {
      price = r.price;
      break;
    }
  }
  if (price === 0 && ranges.length > 0) {
    price = ranges[ranges.length - 1].price;
  }
  return gb * price;
};

export const maskPhone = (value: string): string => {
  let v = value.replace(/\D/g, "");
  if (v.length > 11) v = v.slice(0, 11);
  if (v.length > 10) return v.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  if (v.length > 6) return v.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3");
  if (v.length > 2) return v.replace(/(\d{2})(\d{0,5})/, "($1) $2");
  return v;
};
