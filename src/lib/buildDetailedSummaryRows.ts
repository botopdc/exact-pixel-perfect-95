/**
 * buildDetailedSummaryRows — Single source of truth for detailed summary rows.
 *
 * Used by:
 *   - OpenCalculator Resumo block (live UI)
 *   - PDF generator (via CalculationResult.rows)
 *   - proposalResultBuilder (snapshot reconstruction)
 *
 * Every infrastructure product is enumerated (#1, #2 …) and decomposed into
 * component-level rows (vCPU, RAM, NVMe, IPs, GPU, etc.).
 */

import {
  CalculatorConfig,
  SummaryRow,
  PriceOverrideMap,
  K8S_PLANS,
  STORAGE_TYPE_LABELS,
  SUPPORT_LEVEL_LABELS,
  SupportLevel,
  getStoragePricePerTB,
  calculateStorageMonthly,
  getStorageTierLabel,
  getNvmePricePerGB,
  getK8sPlanBasePrice,
  getK8sAddonPrice,
  calculateBackupPrice,
  formatCurrency,
} from './calculatorConfig';

// Re-export friendly types consumed by callers that don't import calculatorConfig
export type { SummaryRow };

// ---------------------------------------------------------------------------
// Input contract – mirrors the shapes used by OpenCalculatorState
// ---------------------------------------------------------------------------

export interface DetailedRowsInput {
  items: ServerItemInput[];
  addons: AddonsInput;
  kubernetes: KubernetesInput;
  storageItems: StorageInput[];
  openSaas: OpenSaaSInput;
  priceOverrides: PriceOverrideMap;
  config: CalculatorConfig;
}

export interface ServerItemInput {
  type: 'vm' | 'bm';
  gpu: string;
  gpuQty: number;
  qtyServers: number;
  ips: number;
  // VM fields
  vcpu?: number;
  ramGb?: number;
  nvmeTb?: number;
  // BM fields
  bmCpu?: string;
  bmRam?: string;
  disks?: { type: string; qty: number }[];
}

export interface AddonsInput {
  antivirus: number;
  firewall: number;
  tsplus: number;
  cal: number;
  sql: string;
  sqlQty: number;
  veeamVm: number;
  veeamAg: number;
  winserver: number;
  backupPlan: string;
  backupGb: number;
  support: { level: string; price: number };
  consulting: { quantity: number; unitPrice: number };
  dba: { quantity: number; unitPrice: number };
  customAddons?: Record<string, number>;
}

export interface KubernetesInput {
  enabled: boolean;
  plan: string;
  addons: {
    support_24x7: boolean;
    backup_velero: boolean;
    dr_multisite: boolean;
    observability: boolean;
    cicd_managed: boolean;
    devops_hours: number;
  };
  extras: { vcpu: number; ramGB: number; diskGB: number };
}

export interface StorageInput {
  storageType: 'sas' | 's3' | 'nvme';
  region: 'BR' | 'USA';
  volumeTB: number;
  volumeGB?: number;
}

export interface OpenSaaSInput {
  enabled: boolean;
  users: number;
}

// ---------------------------------------------------------------------------
// Result
// ---------------------------------------------------------------------------

export interface DetailedRowsResult {
  rows: SummaryRow[];
  subRec: number;
  subIps: number;
  subServices: number;
  subBackup: number;
  subKubernetes: number;
  subStorage: number;
  subOpenSaas: number;
  gpuBrlTotal: number;
  totalServers: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const toNum = (val: any, fallback = 0): number => {
  if (val === undefined || val === null || val === '') return fallback;
  const parsed = typeof val === 'string' ? parseFloat(val.replace(',', '.')) : Number(val);
  return Number.isFinite(parsed) ? parsed : fallback;
};

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

export function buildDetailedSummaryRows(input: DetailedRowsInput): DetailedRowsResult {
  const { items, addons, kubernetes, storageItems, openSaas, priceOverrides, config } = input;

  const rows: SummaryRow[] = [];
  let subRec = 0;
  let subIps = 0;
  let subServices = 0;
  let gpuBrlTotal = 0;
  let totalServers = 0;

  // Row builder with override support
  const addRow = (
    label: string,
    qty: string | number,
    unitPrice: number,
    baseTotal: number,
    rowKey: string,
  ): number => {
    const overrideTotal = priceOverrides[rowKey] ?? null;
    const finalTotal = overrideTotal !== null ? overrideTotal : baseTotal;
    rows.push({
      label,
      qty,
      unitPrice,
      subtotal: finalTotal,
      baseUnitPrice: unitPrice,
      baseTotal,
      overrideTotal,
      finalTotal,
      rowKey,
    });
    return finalTotal;
  };

  // ========== SERVERS (VM / BareMetal) ==========
  items.forEach((item, idx) => {
    const qtyServers = Math.max(1, toNum(item.qtyServers, 1));
    const ips = Math.max(0, toNum(item.ips, 0));
    totalServers += qtyServers;
    const itemPrefix = item.type === 'vm' ? `vm_${idx}` : `bm_${idx}`;

    if (item.type === 'vm') {
      const vcpu = Math.max(1, toNum(item.vcpu, 1));
      const ramGb = Math.max(1, toNum(item.ramGb, 1));
      const nvmeTbVal = toNum(item.nvmeTb, 0);
      const nvmeGb = Math.max(0, nvmeTbVal) * 1024;

      const cpuPrice = toNum(config.vm_prices_brl.vcpu, 0);
      const cpuUnit = vcpu * cpuPrice;
      subRec += addRow(`VM #${idx + 1} — vCPU (${vcpu} por srv)`, qtyServers, cpuUnit, cpuUnit * qtyServers, `${itemPrefix}_cpu`);

      const ramPrice = toNum(config.vm_prices_brl.ram_per_gb, 0);
      const ramUnit = ramGb * ramPrice;
      subRec += addRow(`VM #${idx + 1} — RAM (${ramGb} GB por srv)`, qtyServers, ramUnit, ramUnit * qtyServers, `${itemPrefix}_ram`);

      const diskPrice = toNum(config.vm_prices_brl.nvme_per_gb, 0);
      const diskUnit = nvmeGb * diskPrice;
      subRec += addRow(`VM #${idx + 1} — NVMe (${nvmeTbVal.toFixed(2)} TB por srv)`, qtyServers, diskUnit, diskUnit * qtyServers, `${itemPrefix}_disk`);
    } else {
      // BareMetal
      const cpu = config.baremetal.cpu_models.find(c => c.id === item.bmCpu) || config.baremetal.cpu_models[0];
      const ram = config.baremetal.ram_tiers.find(r => r.id === item.bmRam) || config.baremetal.ram_tiers[0];

      if (cpu && ram) {
        subRec += addRow(`BareMetal #${idx + 1} — CPU (${cpu.label})`, qtyServers, cpu.price, cpu.price * qtyServers, `${itemPrefix}_cpu`);
        subRec += addRow(`BareMetal #${idx + 1} — RAM (${ram.label})`, qtyServers, ram.price, ram.price * qtyServers, `${itemPrefix}_ram`);
      }

      let diskUnitTotal = 0;
      const itemDisks = Array.isArray(item.disks) ? item.disks : [];
      itemDisks.forEach(disk => {
        const d = config.baremetal.disks.find(x => x.id === disk.type) || config.baremetal.disks[0];
        if (d) diskUnitTotal += d.price * Math.max(1, disk.qty);
      });
      if (diskUnitTotal > 0) {
        subRec += addRow(`BareMetal #${idx + 1} — Discos NVMe`, qtyServers, diskUnitTotal, diskUnitTotal * qtyServers, `${itemPrefix}_disks`);
      }
    }

    // IPs
    if (ips > 0) {
      const ipPrice = toNum(config.vm_prices_brl.ip_public, 0);
      const ipUnit = ips * ipPrice;
      subIps += addRow(
        `${item.type === 'vm' ? 'VM' : 'BareMetal'} #${idx + 1} — IPs públicos (${ips} por srv)`,
        qtyServers, ipUnit, ipUnit * qtyServers, `${itemPrefix}_ips`,
      );
    }

    // GPU
    const gpuQty = item.gpu === 'Sem GPU' ? 0 : Math.max(1, Math.min(8, toNum(item.gpuQty, 0)));
    const gpuBrlUnit = toNum(config.gpu_usd[item.gpu], 0);
    if (gpuQty > 0 && gpuBrlUnit > 0) {
      const gpuBrlPerServer = gpuBrlUnit * gpuQty;
      const gpuBrl = gpuBrlPerServer * qtyServers;
      subRec += addRow(
        `${item.type === 'vm' ? 'VM' : 'BareMetal'} #${idx + 1} — GPU (${item.gpu}, ${gpuQty}x por srv)`,
        qtyServers, gpuBrlPerServer, gpuBrl, `${itemPrefix}_gpu`,
      );
      gpuBrlTotal += gpuBrl;
    }
  });

  // ========== SERVICES / ADD-ONS ==========
  const antivirusQty = toNum(addons.antivirus, 0);
  if (antivirusQty > 0) {
    const u = toNum(config.addons_brl.antivirus_unit, 0);
    subServices += addRow('Antivirus', antivirusQty, u, u * antivirusQty, 'svc_antivirus');
  }
  const firewallQty = toNum(addons.firewall, 0);
  if (firewallQty > 0) {
    const u = toNum(config.addons_brl.firewall_pfsense, 0);
    subServices += addRow('Firewall (qtd)', firewallQty, u, u * firewallQty, 'svc_firewall');
  }
  const tsplusQty = toNum(addons.tsplus, 0);
  if (tsplusQty > 0) {
    const u = toNum(config.addons_brl.tsplus_unit, 0);
    subServices += addRow('TS PLUS', tsplusQty, u, u * tsplusQty, 'svc_tsplus');
  }
  const calQty = toNum(addons.cal, 0);
  if (calQty > 0) {
    const u = toNum(config.addons_brl.cal_unit, 0);
    subServices += addRow('CAL / TS-CAL', calQty, u, u * calQty, 'svc_cal');
  }
  const sqlQty = toNum(addons.sqlQty, 0);
  if (addons.sql !== 'none' && sqlQty > 0) {
    const u = toNum((config.addons_brl.sql as any)?.[addons.sql], 0);
    subServices += addRow(`Licença SQL (${addons.sql.toUpperCase()})`, sqlQty, u, u * sqlQty, `svc_sql_${addons.sql}`);
  }
  const veeamVmQty = toNum(addons.veeamVm, 0);
  if (veeamVmQty > 0) {
    const u = toNum(config.addons_brl.veeam_vm_unit, 0);
    subServices += addRow('Veeam Backup (VM)', veeamVmQty, u, u * veeamVmQty, 'svc_veeam_vm');
  }
  const veeamAgQty = toNum(addons.veeamAg, 0);
  if (veeamAgQty > 0) {
    const u = toNum(config.addons_brl.veeam_agent_unit, 0);
    subServices += addRow('Veeam Agent (Workstation)', veeamAgQty, u, u * veeamAgQty, 'svc_veeam_agent');
  }
  const winserverQty = toNum(addons.winserver, 0);
  if (winserverQty > 0) {
    const u = toNum(config.addons_brl.winserver_2vcpu_unit, 0);
    subServices += addRow('WinServer(2vCPU/unid.)', winserverQty, u, u * winserverQty, 'svc_winserver');
  }

  // Support / Consulting / DBA
  if (addons.support.level !== 'none' && addons.support.price > 0) {
    const label = `Suporte ${SUPPORT_LEVEL_LABELS[addons.support.level as SupportLevel] || addons.support.level}`;
    subServices += addRow(label, 1, addons.support.price, addons.support.price, 'svc_support');
  }
  const consultingQty = toNum(addons.consulting.quantity, 0);
  if (consultingQty > 0) {
    const u = toNum(addons.consulting.unitPrice, 200);
    subServices += addRow('Consultoria Técnica', `${consultingQty} h`, u, u * consultingQty, 'svc_consulting');
  }
  const dbaQty = toNum(addons.dba.quantity, 0);
  if (dbaQty > 0) {
    const u = toNum(addons.dba.unitPrice, 250);
    subServices += addRow('DBA', `${dbaQty} h`, u, u * dbaQty, 'svc_dba');
  }

  // Custom add-ons
  const standardAddonKeys = [
    'antivirus_unit', 'firewall_pfsense', 'tsplus_unit', 'cal_unit', 'sql',
    'veeam_vm_unit', 'veeam_agent_unit', 'winserver_2vcpu_unit',
    'support_basic', 'support_intermediate', 'support_advanced',
    'consulting_hours', 'dba_hours',
  ];
  Object.entries(config.addons_brl).forEach(([key, price]) => {
    if (!standardAddonKeys.includes(key) && typeof price === 'number') {
      const qty = toNum(addons.customAddons?.[key], 0);
      const unitPrice = toNum(price, 0);
      if (qty > 0 && unitPrice > 0) {
        const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        subServices += addRow(label, qty, unitPrice, unitPrice * qty, `svc_custom_${key}`);
      }
    }
  });

  // ========== BACKUP ==========
  const backupGbQty = toNum(addons.backupGb, 0);
  let subBackup = 0;
  const backupBasePrice = calculateBackupPrice(config, addons.backupPlan, backupGbQty);
  if (Number.isFinite(backupBasePrice) && backupBasePrice > 0) {
    const unit = backupBasePrice / Math.max(1, backupGbQty);
    subBackup = addRow(`Backup ${addons.backupPlan} dias`, `${backupGbQty} GB`, unit, backupBasePrice, `backup_${addons.backupPlan}`);
  }

  // ========== KUBERNETES (K8s #1) ==========
  let subKubernetes = 0;
  if (kubernetes.enabled) {
    const planInfo = (K8S_PLANS as any)[kubernetes.plan];
    const shortLabel = planInfo?.shortLabel || kubernetes.plan;
    const basePriceMonthly = toNum(getK8sPlanBasePrice(kubernetes.plan as any, config), 0);
    subKubernetes += addRow(`K8s #1 — Base (${shortLabel})`, 1, basePriceMonthly, basePriceMonthly, `k8s_base_${kubernetes.plan}`);

    const extras = kubernetes.extras || { vcpu: 0, ramGB: 0, diskGB: 0 };
    const extrasVcpu = toNum(extras.vcpu, 0);
    const extrasRamGB = toNum(extras.ramGB, 0);
    const extrasDiskGB = toNum(extras.diskGB, 0);

    if (extrasVcpu > 0) {
      const p = toNum(config.vm_prices_brl.vcpu, 0);
      subKubernetes += addRow(`K8s #1 — + ${extrasVcpu} vCPU adicional`, 1, extrasVcpu * p, extrasVcpu * p, 'k8s_extra_vcpu');
    }
    if (extrasRamGB > 0) {
      const p = toNum(config.vm_prices_brl.ram_per_gb, 0);
      subKubernetes += addRow(`K8s #1 — + ${extrasRamGB} GB RAM adicional`, 1, extrasRamGB * p, extrasRamGB * p, 'k8s_extra_ram');
    }
    if (extrasDiskGB > 0) {
      const p = toNum(config.vm_prices_brl.nvme_per_gb, 0);
      subKubernetes += addRow(`K8s #1 — + ${extrasDiskGB} GB Disco adicional`, 1, extrasDiskGB * p, extrasDiskGB * p, 'k8s_extra_disk');
    }

    // K8s add-ons
    if (kubernetes.addons.support_24x7) {
      const p = toNum(getK8sAddonPrice('support_24x7', config), 0);
      subKubernetes += addRow('K8s #1 — Suporte 24×7', 1, p, p, 'k8s_addon_support');
    }
    if (kubernetes.addons.backup_velero) {
      const p = toNum(getK8sAddonPrice('backup_velero', config), 0);
      subKubernetes += addRow('K8s #1 — Backup (Velero)', 1, p, p, 'k8s_addon_backup');
    }
    if (kubernetes.addons.dr_multisite) {
      const p = toNum(getK8sAddonPrice('dr_multisite', config), 0);
      subKubernetes += addRow('K8s #1 — DR multi-site', 1, p, p, 'k8s_addon_dr');
    }
    if (kubernetes.addons.observability) {
      const p = toNum(getK8sAddonPrice('observability', config), 0);
      subKubernetes += addRow('K8s #1 — Observabilidade avançada', 1, p, p, 'k8s_addon_obs');
    }
    if (kubernetes.addons.cicd_managed) {
      const p = toNum(getK8sAddonPrice('cicd_managed', config), 0);
      subKubernetes += addRow('K8s #1 — CI/CD gerenciado', 1, p, p, 'k8s_addon_cicd');
    }
    const devopsHours = toNum(kubernetes.addons.devops_hours, 0);
    if (devopsHours > 0) {
      const p = toNum(getK8sAddonPrice('devops_hours', config), 0);
      subKubernetes += addRow('K8s #1 — Horas DevOps', devopsHours, p, devopsHours * p, 'k8s_addon_devops');
    }
  }

  // ========== STORAGE (Storage #1, #2 …) ==========
  let subStorage = 0;
  storageItems.forEach((storage, idx) => {
    const storageType = storage.storageType || 'sas';
    const typeLabel = STORAGE_TYPE_LABELS[storageType];

    if (storageType === 'nvme') {
      const volumeGB = toNum(storage.volumeGB, 0) || toNum(storage.volumeTB, 0) * 1024 || 1;
      if (volumeGB >= 1) {
        const pricePerGB = toNum(getNvmePricePerGB(config), 0);
        const monthlyTotal = volumeGB * pricePerGB;
        subStorage += addRow(`Storage #${idx + 1} — ${typeLabel} ${volumeGB} GB`, 1, pricePerGB, monthlyTotal, `storage_${idx}_nvme`);
      }
    } else {
      const volumeTB = toNum(storage.volumeTB, 0);
      if (volumeTB >= 1) {
        const pricePerTB = toNum(getStoragePricePerTB(volumeTB, storage.region as any, config, storageType as any), 0);
        const monthlyTotal = toNum(calculateStorageMonthly(volumeTB, storage.region as any, config, storageType as any), 0);
        const tierLabel = getStorageTierLabel(volumeTB);
        subStorage += addRow(`Storage #${idx + 1} — ${typeLabel} ${storage.region} ${volumeTB} TB (${tierLabel})`, 1, pricePerTB, monthlyTotal, `storage_${idx}_${storageType}`);
      }
    }
  });

  // ========== OPEN SaaS (SaaS #1) ==========
  let subOpenSaas = 0;
  const openSaasUsers = toNum(openSaas.users, 0);
  if (openSaas.enabled && openSaasUsers >= 5) {
    const pricePerUser = toNum(config.open_saas_price_per_user, 85);
    const users = Math.max(5, openSaasUsers);
    const monthlyTotal = users * pricePerUser;
    subOpenSaas = addRow(
      `SaaS #1 — OPEN SaaS (${users} usuário(s) × R$ ${formatCurrency(pricePerUser)}/usuário)`,
      users, pricePerUser, monthlyTotal, 'open_saas',
    );
  }

  return {
    rows,
    subRec,
    subIps,
    subServices,
    subBackup,
    subKubernetes,
    subStorage,
    subOpenSaas,
    gpuBrlTotal,
    totalServers,
  };
}
