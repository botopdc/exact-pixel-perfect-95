import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { FileDown, Save, List, Plus, Minus, ChevronDown, ChevronUp, Trash2, Settings, Mail, Loader2, RefreshCw, Copy, Bug, Shield, Percent, Pencil } from 'lucide-react';
import { useNavigate, Link as RouterLink, useLocation } from 'react-router-dom';

import ProductIcon from './ProductIcon';
import {
  CalculatorConfig,
  ServerItem,
  VMItem,
  BMItem,
  DiskItem,
  ClientInfo,
  ProposalMeta,
  AddonsState,
  CalculatorState,
  SummaryRow,
  CalculationResult,
  KubernetesState,
  K8S_PLANS,
  K8S_ADDONS_PRICES,
  K8S_ADDONS_LABELS,
  K8sPlan,
  K8sPlanSpec,
  K8sExtras,
  StorageItem,
  StorageRegion,
  StorageType,
  STORAGE_TYPE_LABELS,
  ResellerState,
  DEFAULT_RESELLER_STATE,
  OpenSaaSState,
  DEFAULT_OPEN_SAAS_STATE,
  getStoragePricePerTB,
  calculateStorageMonthly,
  getStorageTierLabel,
  getNvmePricePerGB,
  getK8sPlanBasePrice,
  getK8sPlanBaseResources,
  calculateK8sExtrasPrice,
  getK8sAddonPrice,
  formatCurrency,
  formatCurrencyBRL,
  generateProposalId,
  formatDateBR,
  getValidityDate,
  calculateBackupPrice,
  maskPhone,
} from '@/lib/calculatorConfig';
import { useConfigWithFallback } from '@/hooks/useConfig';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSaveProposal, SavedProposal } from '@/hooks/useProposals';
import { useSavePartnerProposal } from '@/hooks/usePartnerProposals';
import { authService } from '@/services/authService';
import { partnerAuthService } from '@/services/partnersService';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle, Lock } from 'lucide-react';
import { 
  getPricingRules, 
  isDiscountAllowed, 
  isOverrideAllowed,
  getPartnerTypeDiscount,
  getPricingProfileLabel,
  PricingRules 
} from '@/config/pricingRules';

// User context for calculator
interface CalculatorUserContext {
  userLevel: number | null;
  partnerType: string | null;
  pricingRules: PricingRules;
  partnerDiscount: number;
  profileLabel: string;
}

const OpenCalculator: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { config, isLoading: configLoading, refetch: refetchConfig } = useConfigWithFallback();
  
  // Get user context (works for both internal users and partners)
  const userContext = useMemo((): CalculatorUserContext => {
    // Try internal auth first
    const internalSession = authService.getSession();
    if (internalSession) {
      const partnerType = internalSession.apiUser?.partner?.type || null;
      const rules = getPricingRules(internalSession.level);
      return {
        userLevel: internalSession.level,
        partnerType,
        pricingRules: rules,
        partnerDiscount: rules.canApplyPartnerDiscounts ? getPartnerTypeDiscount(partnerType) : 0,
        profileLabel: getPricingProfileLabel(internalSession.level, partnerType || undefined),
      };
    }
    
    // Try partner auth
    const partnerSession = partnerAuthService.getSession();
    if (partnerSession) {
      const partnerType = partnerSession.tipo_parceria;
      const rules = getPricingRules(200); // Partner level
      return {
        userLevel: 200,
        partnerType,
        pricingRules: rules,
        partnerDiscount: getPartnerTypeDiscount(partnerType),
        profileLabel: getPricingProfileLabel(200, partnerType),
      };
    }
    
    // No session - default rules
    const defaultRules = getPricingRules(null);
    return {
      userLevel: null,
      partnerType: null,
      pricingRules: defaultRules,
      partnerDiscount: 0,
      profileLabel: 'Visitante',
    };
  }, []);
  
  // Determine if this is a partner context for saving
  const isPartnerContext = userContext.userLevel === 200;
  const partnerSession = isPartnerContext ? partnerAuthService.getSession() : null;
  
  // Use appropriate save mutation based on context
  const saveInternalProposalMutation = useSaveProposal();
  const savePartnerProposalMutation = useSavePartnerProposal();

  // State
  const [fx, setFx] = useState(config.fx_default);
  const [selectedTerm, setSelectedTerm] = useState("1");
  const [datacenter, setDatacenter] = useState<'SP1' | 'SP2' | 'FL1' | 'CE1'>('SP1');
  const [client, setClient] = useState<ClientInfo>({ name: '', company: '', phone: '', email: '' });
  // Collapsible sections state
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [proposal, setProposal] = useState<ProposalMeta>({
    id: generateProposalId(),
    validityDays: 7,
    createdAt: new Date().toISOString(),
  });
  const [items, setItems] = useState<ServerItem[]>([]);
  const [addons, setAddons] = useState<AddonsState>({
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
  });
  const [kubernetes, setKubernetes] = useState<KubernetesState>({
    enabled: false,
    plan: 'k8s_small',
    addons: {
      support_24x7: false,
      backup_velero: false,
      dr_multisite: false,
      observability: false,
      cicd_managed: false,
      devops_hours: 0,
    },
    extras: { vcpu: 0, ramGB: 0, diskGB: 0 },
  });
  const [storageItems, setStorageItems] = useState<StorageItem[]>([]);
  const [reseller, setReseller] = useState<ResellerState>(DEFAULT_RESELLER_STATE);
  const [openSaas, setOpenSaas] = useState<OpenSaaSState>(DEFAULT_OPEN_SAAS_STATE);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<CalculationResult | null>(null);
  const [antivirusManuallySet, setAntivirusManuallySet] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [saving, setSaving] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [includeCommissionInPdf, setIncludeCommissionInPdf] = useState(true);
  const [lastPayload, setLastPayload] = useState<string | null>(null);
  const [observacao, setObservacao] = useState('');
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingProposalId, setEditingProposalId] = useState<string | null>(null);
  // Check if admin mode (same PIN as /precos page)
  const isAdminMode = localStorage.getItem('open_precos_adminMode') === 'true';

  // Update FX when config loads
  useEffect(() => {
    if (!configLoading && config) {
      setFx(config.fx_default);
    }
  }, [config, configLoading]);

  // Add VM
  const addVM = useCallback(() => {
    const newItem: VMItem = {
      type: 'vm',
      id: crypto.randomUUID(),
      gpu: 'Sem GPU',
      gpuQty: 0,
      vcpu: 16,
      ramGb: 128,
      nvmeTb: 0.05, // 50GB = 0.05TB (stored in TB for calculation compatibility)
      trafficTb: 5,
      ips: 1,
      qtyServers: 1,
    };
    setItems(prev => [...prev, newItem]);
    setExpandedItems(prev => new Set([...prev, newItem.id]));
  }, []);

  // Add BareMetal
  const addBM = useCallback(() => {
    if (!config.baremetal.cpu_models.length || !config.baremetal.ram_tiers.length || !config.baremetal.disks.length) {
      toast({ title: 'Erro', description: 'Configuração de BareMetal não carregada', variant: 'destructive' });
      return;
    }
    const newItem: BMItem = {
      type: 'bm',
      id: crypto.randomUUID(),
      gpu: 'Sem GPU',
      gpuQty: 0,
      bmCpu: config.baremetal.cpu_models[0].id,
      bmRam: config.baremetal.ram_tiers[0].id,
      disks: [{ type: config.baremetal.disks[0].id, qty: 1, desc: '' }],
      trafficTb: 5,
      ips: 1,
      qtyServers: 1,
    };
    setItems(prev => [...prev, newItem]);
    setExpandedItems(prev => new Set([...prev, newItem.id]));
  }, [config, toast]);

  // Add Storage
  const addStorage = useCallback(() => {
    const newItem: StorageItem = {
      id: crypto.randomUUID(),
      storageType: 'sas',
      region: 'BR',
      volumeTB: 1,
    };
    setStorageItems(prev => [...prev, newItem]);
  }, []);

  // Remove Storage
  const removeStorage = useCallback((id: string) => {
    setStorageItems(prev => prev.filter(item => item.id !== id));
  }, []);

  // Update Storage
  const updateStorage = useCallback((id: string, updates: Partial<StorageItem>) => {
    setStorageItems(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
  }, []);

  // Remove item
  const removeItem = useCallback((id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
    setExpandedItems(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  // Update item
  const updateItem = useCallback((id: string, updates: Partial<ServerItem>) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, ...updates } as ServerItem : item));
  }, []);

  // Add disk to BM
  const addDisk = useCallback((itemId: string) => {
    if (!config.baremetal.disks.length) return;
    setItems(prev => prev.map(item => {
      if (item.id === itemId && item.type === 'bm') {
        return {
          ...item,
          disks: [...item.disks, { type: config.baremetal.disks[0].id, qty: 1, desc: '' }],
        };
      }
      return item;
    }));
  }, [config]);

  // Remove disk from BM
  const removeDisk = useCallback((itemId: string, diskIndex: number) => {
    setItems(prev => prev.map(item => {
      if (item.id === itemId && item.type === 'bm') {
        const disks = Array.isArray(item.disks) ? item.disks : [];
        if (disks.length > 1) {
          return {
            ...item,
            disks: disks.filter((_, i) => i !== diskIndex),
          };
        }
      }
      return item;
    }));
  }, []);

  // Update disk in BM
  const updateDisk = useCallback((itemId: string, diskIndex: number, updates: Partial<DiskItem>) => {
    setItems(prev => prev.map(item => {
      if (item.id === itemId && item.type === 'bm') {
        const disks = Array.isArray(item.disks) ? item.disks : [];
        return {
          ...item,
          disks: disks.map((disk, i) => i === diskIndex ? { ...disk, ...updates } : disk),
        };
      }
      return item;
    }));
  }, []);

  // Toggle expand
  const toggleExpand = useCallback((id: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Toggle section collapse (for K8s, Storage, OPEN SaaS)
  const toggleSectionCollapse = useCallback((sectionId: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  }, []);

  // Calculate
  const calculate = useCallback(() => {
    if (!config) return;

    const rows: SummaryRow[] = [];
    let subRec = 0;
    let subIps = 0;
    let subServices = 0;
    let gpuUsdTotal = 0;
    let gpuBrlTotal = 0;
    let totalServers = 0;

    items.forEach((item, idx) => {
      const qtyServers = Math.max(1, item.qtyServers);
      const ips = Math.max(0, item.ips);
      totalServers += qtyServers;

      if (item.type === 'vm') {
        const vcpu = Math.max(1, item.vcpu);
        const ramGb = Math.max(1, item.ramGb);
        const nvmeGb = Math.max(0, item.nvmeTb) * 1024;

        // CPU
        const cpuUnit = vcpu * config.vm_prices_brl.vcpu;
        const cpuSub = cpuUnit * qtyServers;
        rows.push({ label: `VM #${idx + 1} — vCPU (${vcpu} por srv)`, qty: qtyServers, unitPrice: cpuUnit, subtotal: cpuSub });
        subRec += cpuSub;

        // RAM
        const ramUnit = ramGb * config.vm_prices_brl.ram_per_gb;
        const ramSub = ramUnit * qtyServers;
        rows.push({ label: `VM #${idx + 1} — RAM (${ramGb} GB por srv)`, qty: qtyServers, unitPrice: ramUnit, subtotal: ramSub });
        subRec += ramSub;

        // Disk
        const diskUnit = nvmeGb * config.vm_prices_brl.nvme_per_gb;
        const diskSub = diskUnit * qtyServers;
        rows.push({ label: `VM #${idx + 1} — NVMe (${item.nvmeTb.toFixed(2)} TB por srv)`, qty: qtyServers, unitPrice: diskUnit, subtotal: diskSub });
        subRec += diskSub;
      } else {
        // BareMetal
        const cpu = config.baremetal.cpu_models.find(c => c.id === item.bmCpu) || config.baremetal.cpu_models[0];
        const ram = config.baremetal.ram_tiers.find(r => r.id === item.bmRam) || config.baremetal.ram_tiers[0];

        if (cpu && ram) {
          // CPU
          const cpuSub = cpu.price * qtyServers;
          rows.push({ label: `BareMetal #${idx + 1} — CPU (${cpu.label})`, qty: qtyServers, unitPrice: cpu.price, subtotal: cpuSub });
          subRec += cpuSub;

          // RAM
          const ramSub = ram.price * qtyServers;
          rows.push({ label: `BareMetal #${idx + 1} — RAM (${ram.label})`, qty: qtyServers, unitPrice: ram.price, subtotal: ramSub });
          subRec += ramSub;
        }

        // Disks - safe iteration with null check
        let diskUnitTotal = 0;
        const itemDisks = Array.isArray(item.disks) ? item.disks : [];
        itemDisks.forEach(disk => {
          const d = config.baremetal.disks.find(x => x.id === disk.type) || config.baremetal.disks[0];
          if (d) {
            diskUnitTotal += d.price * Math.max(1, disk.qty);
          }
        });
        if (diskUnitTotal > 0) {
          const diskSub = diskUnitTotal * qtyServers;
          rows.push({ label: `BareMetal #${idx + 1} — Discos NVMe`, qty: qtyServers, unitPrice: diskUnitTotal, subtotal: diskSub });
          subRec += diskSub;
        }
      }

      // IPs
      if (ips > 0) {
        const ipUnit = ips * config.vm_prices_brl.ip_public;
        const ipSub = ipUnit * qtyServers;
        rows.push({ label: `${item.type === 'vm' ? 'VM' : 'BareMetal'} #${idx + 1} — IPs públicos (${ips} por srv)`, qty: qtyServers, unitPrice: ipUnit, subtotal: ipSub });
        subIps += ipSub;
      }

      // GPU
      const gpuQty = item.gpu === 'Sem GPU' ? 0 : Math.max(1, Math.min(8, item.gpuQty));
      const gpuUsdUnit = config.gpu_usd[item.gpu] || 0;
      if (gpuQty > 0 && gpuUsdUnit > 0) {
        const gpuUsdPerServer = gpuUsdUnit * gpuQty;
        const gpuUsd = gpuUsdPerServer * qtyServers;
        const gpuBrl = gpuUsd * fx;
        rows.push({ label: `${item.type === 'vm' ? 'VM' : 'BareMetal'} #${idx + 1} — GPU (${item.gpu}, ${gpuQty}x por srv)`, qty: qtyServers, unitPrice: gpuUsdPerServer * fx, subtotal: gpuBrl });
        subRec += gpuBrl;
        gpuUsdTotal += gpuUsd;
        gpuBrlTotal += gpuBrl;
      }
    });

    // Auto-set antivirus
    if (!antivirusManuallySet) {
      setAddons(prev => ({ ...prev, antivirus: totalServers }));
    }

    // Services
    if (addons.antivirus > 0) {
      const st = config.addons_brl.antivirus_unit * addons.antivirus;
      rows.push({ label: 'Antivirus', qty: addons.antivirus, unitPrice: config.addons_brl.antivirus_unit, subtotal: st });
      subServices += st;
    }
    if (addons.firewall) {
      rows.push({ label: 'Firewall PFsense', qty: 1, unitPrice: config.addons_brl.firewall_pfsense, subtotal: config.addons_brl.firewall_pfsense });
      subServices += config.addons_brl.firewall_pfsense;
    }
    if (addons.tsplus > 0) {
      const st = config.addons_brl.tsplus_unit * addons.tsplus;
      rows.push({ label: 'TS PLUS', qty: addons.tsplus, unitPrice: config.addons_brl.tsplus_unit, subtotal: st });
      subServices += st;
    }
    if (addons.cal > 0) {
      const st = config.addons_brl.cal_unit * addons.cal;
      rows.push({ label: 'CAL / TS-CAL', qty: addons.cal, unitPrice: config.addons_brl.cal_unit, subtotal: st });
      subServices += st;
    }
    if (addons.sql !== 'none' && addons.sqlQty > 0) {
      const unit = config.addons_brl.sql[addons.sql] || 0;
      const st = unit * addons.sqlQty;
      rows.push({ label: `Licença SQL (${addons.sql.toUpperCase()})`, qty: addons.sqlQty, unitPrice: unit, subtotal: st });
      subServices += st;
    }
    if (addons.veeamVm > 0) {
      const st = config.addons_brl.veeam_vm_unit * addons.veeamVm;
      rows.push({ label: 'Veeam Backup (VM)', qty: addons.veeamVm, unitPrice: config.addons_brl.veeam_vm_unit, subtotal: st });
      subServices += st;
    }
    if (addons.veeamAg > 0) {
      const st = config.addons_brl.veeam_agent_unit * addons.veeamAg;
      rows.push({ label: 'Veeam Agent (Workstation)', qty: addons.veeamAg, unitPrice: config.addons_brl.veeam_agent_unit, subtotal: st });
      subServices += st;
    }

    // Custom add-ons (dynamic from config)
    const standardAddonKeys = ['antivirus_unit', 'firewall_pfsense', 'tsplus_unit', 'cal_unit', 'sql', 'veeam_vm_unit', 'veeam_agent_unit'];
    Object.entries(config.addons_brl).forEach(([key, price]) => {
      if (!standardAddonKeys.includes(key) && typeof price === 'number') {
        const qty = addons.customAddons?.[key] || 0;
        if (qty > 0) {
          const st = price * qty;
          const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
          rows.push({ label, qty, unitPrice: price, subtotal: st });
          subServices += st;
        }
      }
    });

    // Backup
    const subBackup = calculateBackupPrice(config, addons.backupPlan, addons.backupGb);
    if (subBackup > 0) {
      const unit = subBackup / Math.max(1, addons.backupGb);
      rows.push({ label: `Backup ${addons.backupPlan} dias`, qty: `${addons.backupGb} GB`, unitPrice: unit, subtotal: subBackup });
    }

    // Kubernetes
    let subKubernetes = 0;
    if (kubernetes.enabled) {
      const planInfo = K8S_PLANS[kubernetes.plan];
      const basePriceMonthly = getK8sPlanBasePrice(kubernetes.plan, config);
      rows.push({ label: `Kubernetes Gerenciado — ${planInfo.shortLabel} (base)`, qty: 1, unitPrice: basePriceMonthly, subtotal: basePriceMonthly });
      subKubernetes += basePriceMonthly;

      // K8s extras (additional resources using VM pricing)
      const extras = kubernetes.extras || { vcpu: 0, ramGB: 0, diskGB: 0 };
      const extrasPrice = calculateK8sExtrasPrice(extras, config);
      if (extras.vcpu > 0) {
        const vcpuCost = extras.vcpu * config.vm_prices_brl.vcpu;
        rows.push({ label: `K8s — + ${extras.vcpu} vCPU adicional`, qty: 1, unitPrice: vcpuCost, subtotal: vcpuCost });
      }
      if (extras.ramGB > 0) {
        const ramCost = extras.ramGB * config.vm_prices_brl.ram_per_gb;
        rows.push({ label: `K8s — + ${extras.ramGB} GB RAM adicional`, qty: 1, unitPrice: ramCost, subtotal: ramCost });
      }
      if (extras.diskGB > 0) {
        const diskCost = extras.diskGB * config.vm_prices_brl.nvme_per_gb;
        rows.push({ label: `K8s — + ${extras.diskGB} GB Disco adicional`, qty: 1, unitPrice: diskCost, subtotal: diskCost });
      }
      subKubernetes += extrasPrice;

      // K8s add-ons (using configurable prices)
      if (kubernetes.addons.support_24x7) {
        const price = getK8sAddonPrice('support_24x7', config);
        rows.push({ label: 'K8s — Suporte 24×7', qty: 1, unitPrice: price, subtotal: price });
        subKubernetes += price;
      }
      if (kubernetes.addons.backup_velero) {
        const price = getK8sAddonPrice('backup_velero', config);
        rows.push({ label: 'K8s — Backup (Velero)', qty: 1, unitPrice: price, subtotal: price });
        subKubernetes += price;
      }
      if (kubernetes.addons.dr_multisite) {
        const price = getK8sAddonPrice('dr_multisite', config);
        rows.push({ label: 'K8s — DR multi-site', qty: 1, unitPrice: price, subtotal: price });
        subKubernetes += price;
      }
      if (kubernetes.addons.observability) {
        const price = getK8sAddonPrice('observability', config);
        rows.push({ label: 'K8s — Observabilidade avançada', qty: 1, unitPrice: price, subtotal: price });
        subKubernetes += price;
      }
      if (kubernetes.addons.cicd_managed) {
        const price = getK8sAddonPrice('cicd_managed', config);
        rows.push({ label: 'K8s — CI/CD gerenciado', qty: 1, unitPrice: price, subtotal: price });
        subKubernetes += price;
      }
      if (kubernetes.addons.devops_hours > 0) {
        const price = getK8sAddonPrice('devops_hours', config);
        const devopsSubtotal = kubernetes.addons.devops_hours * price;
        rows.push({ label: 'K8s — Horas DevOps', qty: kubernetes.addons.devops_hours, unitPrice: price, subtotal: devopsSubtotal });
        subKubernetes += devopsSubtotal;
      }
    }

    // Storage
    let subStorage = 0;
    storageItems.forEach((storage, idx) => {
      const storageType = storage.storageType || 'sas';
      const typeLabel = STORAGE_TYPE_LABELS[storageType];
      
      if (storageType === 'nvme') {
        // NVMe uses GB
        const volumeGB = storage.volumeGB || storage.volumeTB * 1024 || 1;
        if (volumeGB >= 1) {
          const pricePerGB = getNvmePricePerGB(config);
          const monthlyTotal = volumeGB * pricePerGB;
          rows.push({
            label: `${typeLabel} — ${volumeGB} GB`,
            qty: 1,
            unitPrice: pricePerGB,
            subtotal: monthlyTotal,
          });
          subStorage += monthlyTotal;
        }
      } else {
        // SAS and S3 use TB (S3 uses same pricing as SAS)
        if (storage.volumeTB >= 1) {
          const pricePerTB = getStoragePricePerTB(storage.volumeTB, storage.region, config, storageType);
          const monthlyTotal = calculateStorageMonthly(storage.volumeTB, storage.region, config, storageType);
          const tierLabel = getStorageTierLabel(storage.volumeTB);
          rows.push({
            label: `${typeLabel} ${storage.region} — ${storage.volumeTB} TB (${tierLabel})`,
            qty: 1,
            unitPrice: pricePerTB,
            subtotal: monthlyTotal,
          });
          subStorage += monthlyTotal;
        }
      }
    });

    // OPEN SaaS (minimum 5 users enforced)
    let subOpenSaas = 0;
    if (openSaas.enabled && openSaas.users >= 5) {
      const pricePerUser = config.open_saas_price_per_user || 85;
      const users = Math.max(5, openSaas.users); // Enforce minimum
      const monthlyTotal = users * pricePerUser;
      rows.push({
        label: `OPEN SaaS — ${users} usuário(s) × R$ ${formatCurrency(pricePerUser)}/usuário`,
        qty: users,
        unitPrice: pricePerUser,
        subtotal: monthlyTotal,
      });
      subOpenSaas = monthlyTotal;
    }

    // Calculate subtotal (price list) before discount
    const preTotal = subRec + subIps + subServices + subBackup + subKubernetes + subStorage + subOpenSaas;
    const discountPct = config.discount[selectedTerm] || 0;
    const discountValue = preTotal * discountPct;
    const grandTotalBeforePartner = preTotal - discountValue;
    
    // Apply partner discount if available (from userContext)
    const partnerDiscountPct = userContext.partnerDiscount;
    const partnerDiscountValue = grandTotalBeforePartner * partnerDiscountPct;
    const grandTotal = grandTotalBeforePartner - partnerDiscountValue;

    // Calculate over values (reseller margin)
    const overValue = Math.max(0, Math.min(reseller.overValue, grandTotal * 0.3)); // Cap at 30%
    const overPercent = grandTotal > 0 ? (overValue / grandTotal) * 100 : 0;
    const totalWithOver = grandTotal + overValue;

    // Update approval requirement based on overPercent and pricing rules
    const overrideCheck = isOverrideAllowed(overPercent, userContext.userLevel);
    const approvalRequired = overrideCheck.requiresApproval;
    if (approvalRequired !== reseller.approvalRequired) {
      setReseller(prev => ({
        ...prev,
        approvalRequired,
        // Clear approval if no longer required
        ...(approvalRequired ? {} : { approvalStatus: 'Pendente' as const, approver: '', approvedAt: null }),
      }));
    }

    setResult({
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
      subtotalPriceList: grandTotalBeforePartner,
      overValue,
      overPercent,
      totalWithOver,
      partnerDiscountPct,
      partnerDiscountValue,
    });
  }, [items, addons, kubernetes, storageItems, openSaas, fx, selectedTerm, config, antivirusManuallySet, reseller.overValue, reseller.approvalRequired, userContext]);

  // Recalculate on changes
  useEffect(() => {
    calculate();
  }, [calculate]);

  // Helper to normalize items ensuring disks array exists for BM items
  const normalizeItems = useCallback((items: any[]): ServerItem[] => {
    if (!items || !Array.isArray(items)) return [];
    
    return items.map((item: any) => {
      // Ensure item has an ID
      const id = item.id || crypto.randomUUID();
      
      if (item.type === 'bm') {
        // Normalize BareMetal item - ensure disks is always an array
        return {
          type: 'bm' as const,
          id,
          gpu: item.gpu || 'Sem GPU',
          gpuQty: item.gpuQty || 0,
          bmCpu: item.bmCpu || config.baremetal.cpu_models[0]?.id || 'intel_xeon_e2136',
          bmRam: item.bmRam || config.baremetal.ram_tiers[0]?.id || 'ram_128gb',
          disks: Array.isArray(item.disks) && item.disks.length > 0 
            ? item.disks 
            : [{ type: config.baremetal.disks[0]?.id || 'nvme_1tb', qty: 1, desc: '' }],
          trafficTb: item.trafficTb ?? 5,
          ips: item.ips ?? 1,
          qtyServers: item.qtyServers ?? 1,
        };
      } else {
        // Normalize VM item (default if type not specified)
        return {
          type: 'vm' as const,
          id,
          gpu: item.gpu || 'Sem GPU',
          gpuQty: item.gpuQty || 0,
          vcpu: item.vcpu ?? 16,
          ramGb: item.ramGb ?? 128,
          nvmeTb: item.nvmeTb ?? 0.05,
          trafficTb: item.trafficTb ?? 5,
          ips: item.ips ?? 1,
          qtyServers: item.qtyServers ?? 1,
        };
      }
    });
  }, [config.baremetal.cpu_models, config.baremetal.ram_tiers, config.baremetal.disks]);

  // Add initial VM after config loads OR load proposal for editing
  useEffect(() => {
    if (configLoading) return;
    
    // Check if we have a proposal to edit from navigation state
    const editProposal = location.state?.editProposal;
    
    if (editProposal && !initialized) {
      // Load proposal data for editing
      setFx(editProposal.fx || config.fx_default);
      setSelectedTerm(editProposal.selectedTerm || "1");
      setDatacenter(editProposal.datacenter || 'SP1');
      setClient(editProposal.client || { name: '', company: '', phone: '', email: '' });
      setProposal(editProposal.proposal || { id: generateProposalId(), validityDays: 7, createdAt: new Date().toISOString() });
      
      // Normalize items to ensure all required fields exist (especially disks for BM)
      const normalizedItems = normalizeItems(editProposal.items || []);
      setItems(normalizedItems);
      setAddons(editProposal.addons || {
        backupPlan: 'none', backupGb: 0, antivirus: 0, firewall: false,
        tsplus: 0, cal: 0, sql: 'none', sqlQty: 0, veeamVm: 0, veeamAg: 0,
      });
      setKubernetes(editProposal.kubernetes || {
        enabled: false, plan: 'k8s_small',
        addons: { support_24x7: false, backup_velero: false, dr_multisite: false, observability: false, cicd_managed: false, devops_hours: 0 },
        extras: { vcpu: 0, ramGB: 0, diskGB: 0 },
      });
      setStorageItems(editProposal.storageItems || []);
      setReseller(editProposal.reseller || DEFAULT_RESELLER_STATE);
      setOpenSaas(editProposal.openSaas || DEFAULT_OPEN_SAAS_STATE);
      setObservacao(editProposal.observacao || '');
      
      // Expand all loaded items
      const allItemIds = (editProposal.items || []).map((item: any) => item.id);
      setExpandedItems(new Set(allItemIds));
      
      // Mark as edit mode with proposal ID
      setIsEditMode(true);
      setEditingProposalId(editProposal.proposal?.id || null);
      
      setInitialized(true);
      
      // Clear the navigation state to prevent re-loading on refresh
      window.history.replaceState({}, document.title);
      
      toast({ title: 'Proposta carregada', description: `Editando proposta ${editProposal.proposal?.id || ''}` });
    } else if (!initialized && items.length === 0) {
      addVM();
      setInitialized(true);
    }
  }, [configLoading, initialized, items.length, addVM, location.state, config.fx_default, toast, normalizeItems]);

  // Check if approval is required and pending
  const isApprovalPending = reseller.approvalRequired && reseller.approvalStatus !== 'Aprovado';

  // Check if there's at least one sellable product (VM, BareMetal, Kubernetes, Storage, or OPEN SaaS)
  const hasSellableProduct = useCallback(() => {
    const hasVM = items.some(i => i.type === 'vm');
    const hasBareMetal = items.some(i => i.type === 'bm');
    const hasKubernetes = kubernetes.enabled;
    const hasStorage = storageItems.some(s => s.volumeTB >= 1);
    const hasOpenSaaS = openSaas.enabled && openSaas.users >= 5;
    return hasVM || hasBareMetal || hasKubernetes || hasStorage || hasOpenSaaS;
  }, [items, kubernetes.enabled, storageItems, openSaas.enabled, openSaas.users]);

  // Check if only add-ons are selected (no main product)
  const hasOnlyAddons = useCallback(() => {
    const hasAnyAddon = addons.backupPlan !== 'none' || 
      addons.backupGb > 0 || 
      addons.antivirus > 0 || 
      addons.firewall || 
      addons.tsplus > 0 || 
      addons.cal > 0 || 
      addons.sql !== 'none' || 
      addons.veeamVm > 0 || 
      addons.veeamAg > 0 ||
      Object.entries(addons).some(([key, val]) => !['backupPlan', 'backupGb', 'antivirus', 'firewall', 'tsplus', 'cal', 'sql', 'sqlQty', 'veeamVm', 'veeamAg'].includes(key) && val);
    return hasAnyAddon && !hasSellableProduct();
  }, [addons, hasSellableProduct]);

  // Save proposal via API
  const handleSave = async () => {
    if (!client.name.trim() && !client.company.trim()) {
      toast({ title: 'Erro', description: 'Informe o nome do cliente ou empresa', variant: 'destructive' });
      return;
    }
    if (hasOnlyAddons()) {
      toast({ title: 'Erro', description: 'Add-ons precisam estar associados a pelo menos um produto principal.', variant: 'destructive' });
      return;
    }
    if (!hasSellableProduct()) {
      toast({ title: 'Erro', description: 'Adicione pelo menos um produto (VM, BareMetal, Kubernetes, Storage ou OPEN SaaS).', variant: 'destructive' });
      return;
    }
    // Block save if approval is pending
    if (isApprovalPending) {
      toast({ title: 'Aprovação pendente', description: 'Preencha o Aprovador e marque como aprovado antes de salvar.', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      if (isPartnerContext && partnerSession) {
        // Partner context: use partner proposal hook
        const partnerProposalData = {
          proposta_id: proposal.id,
          cliente_nome: client.name || client.company || '',
          cliente_email: client.email,
          valor_total: result?.grandTotal || 0,
          status_proposta: 'Rascunho' as const,
          dados_proposta: {
            fx,
            selectedTerm,
            datacenter,
            client,
            proposal,
            items,
            addons,
            kubernetes,
            storageItems,
            reseller,
            openSaas,
            result,
            observacao: observacao.trim() || undefined,
          },
        };

        await savePartnerProposalMutation.mutateAsync(partnerProposalData);
      } else {
        // Internal context: use internal proposal hook
        const proposalData: SavedProposal = {
          fx,
          selectedTerm,
          datacenter,
          client,
          proposal,
          items,
          addons,
          kubernetes,
          storageItems,
          reseller,
          openSaas,
          total: result?.grandTotal || 0,
          savedAt: new Date().toISOString(),
          result: result || undefined,
          observacao: observacao.trim() || undefined,
        };

        await saveInternalProposalMutation.mutateAsync(proposalData);
      }

      // Store payload for debug purposes (admin mode)
      setLastPayload(JSON.stringify({ fx, selectedTerm, datacenter, client, proposal, items, addons, kubernetes, storageItems, reseller, openSaas, result, observacao }, null, 2));

      toast({ title: 'Proposta salva', description: `Proposta ${proposal.id} salva com sucesso` });
    } catch (error: any) {
      console.error('Error saving proposal:', error);
      
      // Handle 401 specifically for better UX
      const is401 = error.response?.status === 401 || error.message?.includes('401');
      toast({ 
        title: is401 ? 'Sessão expirada' : 'Erro ao salvar', 
        description: is401 ? 'Faça login novamente para continuar.' : (error.message || 'Tente novamente mais tarde'), 
        variant: 'destructive' 
      });
      
      // Redirect to login if 401 in partner context
      if (is401 && isPartnerContext) {
        navigate('/parceiro/login');
      }
    } finally {
      setSaving(false);
    }
  };

  // Generate PDF
  const handleGeneratePDF = async () => {
    if (!hasSellableProduct()) {
      toast({ title: 'Erro', description: 'Adicione pelo menos um produto (VM, BareMetal, Kubernetes, Storage ou OPEN SaaS).', variant: 'destructive' });
      return;
    }
    // Block PDF if approval is pending
    if (isApprovalPending) {
      toast({ title: 'Aprovação pendente', description: 'Preencha o Aprovador e marque como aprovado antes de gerar o PDF.', variant: 'destructive' });
      return;
    }

    const { generateOpenPDF } = await import('@/lib/pdfGenerator');
    generateOpenPDF({
      client,
      proposal,
      result: result!,
      selectedTerm,
      datacenter,
      reseller,
      includeCommission: includeCommissionInPdf,
      observacao: observacao.trim() || undefined,
    });
    toast({ title: 'PDF gerado', description: 'O download do PDF foi iniciado' });
  };

  // Send by email via edge function
  const handleSendEmail = async () => {
    if (!client.email?.trim()) {
      toast({ title: 'Erro', description: 'Informe o e-mail do cliente para enviar a proposta', variant: 'destructive' });
      return;
    }
    if (!hasSellableProduct()) {
      toast({ title: 'Erro', description: 'Adicione pelo menos um produto (VM, BareMetal, Kubernetes, Storage ou OPEN SaaS).', variant: 'destructive' });
      return;
    }

    await handleSave();
    setSendingEmail(true);

    const proposalLink = `${window.location.origin}/proposta/${proposal.id}`;
    const validityDateStr = getValidityDate(proposal.createdAt, proposal.validityDays).toLocaleDateString('pt-BR');

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(
        `${supabaseUrl}/functions/v1/send-proposal-email`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientName: client.name || client.company || 'Cliente',
            clientEmail: client.email,
            proposalId: proposal.id,
            proposalLink,
            totalValue: `R$ ${formatCurrency(result?.grandTotal || 0)}`,
            validityDate: validityDateStr,
          }),
        }
      );
      
      const resultData = await response.json();
      
      if (!response.ok || !resultData.success) {
        throw new Error(resultData.error || 'Falha ao enviar email');
      }
      
      toast({ title: 'Email enviado!', description: `Proposta enviada para ${client.email}` });
    } catch (error: any) {
      toast({ 
        title: 'Erro ao enviar email', 
        description: error.message || 'Falha ao enviar email',
        variant: 'destructive' 
      });
    } finally {
      setSendingEmail(false);
    }
  };

  // Reset
  const handleReset = () => {
    setClient({ name: '', company: '', phone: '', email: '' });
    setProposal({ id: generateProposalId(), validityDays: 7, createdAt: new Date().toISOString() });
    setItems([]);
    setAddons({
      backupPlan: 'none', backupGb: 0, antivirus: 0, firewall: false,
      tsplus: 0, cal: 0, sql: 'none', sqlQty: 0, veeamVm: 0, veeamAg: 0,
    });
    setKubernetes({
      enabled: false,
      plan: 'k8s_small',
      addons: {
        support_24x7: false,
        backup_velero: false,
        dr_multisite: false,
        observability: false,
        cicd_managed: false,
        devops_hours: 0,
      },
      extras: { vcpu: 0, ramGB: 0, diskGB: 0 },
    });
    setStorageItems([]);
    setReseller(DEFAULT_RESELLER_STATE);
    setOpenSaas(DEFAULT_OPEN_SAAS_STATE);
    setFx(config.fx_default);
    setSelectedTerm("1");
    setDatacenter('SP1');
    setAntivirusManuallySet(false);
    setObservacao('');
    // Clear edit mode
    setIsEditMode(false);
    setEditingProposalId(null);
    setTimeout(addVM, 0);
  };

  // Add OPEN SaaS (only 1 allowed) - starts with minimum 5 users
  const addOpenSaas = useCallback(() => {
    if (openSaas.enabled) {
      // Already enabled, scroll to section or focus
      toast({ title: 'OPEN SaaS já adicionado', description: 'Você só pode adicionar 1 OPEN SaaS por proposta.' });
      return;
    }
    setOpenSaas({ enabled: true, users: 5 });
  }, [openSaas.enabled, toast]);

  // Handle marking as approved
  const handleApprove = () => {
    if (!reseller.approver.trim()) {
      toast({ title: 'Erro', description: 'Informe o nome do Aprovador', variant: 'destructive' });
      return;
    }
    setReseller(prev => ({
      ...prev,
      approvalStatus: 'Aprovado',
      approvedAt: new Date().toISOString(),
    }));
    toast({ title: 'Aprovado', description: 'Proposta marcada como aprovada' });
  };

  // Calculate max over value (30% of subtotal)
  const maxOverValue = result ? result.grandTotal * 0.3 : 0;

  const validityDate = getValidityDate(proposal.createdAt, proposal.validityDays);

  // Loading state
  if (configLoading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <span className="text-2xl font-bold tracking-wide text-foreground">OPEN — Calculadora VM + BareMetal</span>
            <Skeleton className="h-10 w-32" />
          </div>
        </header>
        <main className="container mx-auto px-4 py-6">
          <div className="grid lg:grid-cols-[1.15fr_0.85fr] gap-6">
            <div className="space-y-6">
              <Skeleton className="h-8 w-96" />
              <Skeleton className="h-64 w-full" />
              <Skeleton className="h-48 w-full" />
            </div>
            <div className="space-y-6">
              <Skeleton className="h-96 w-full" />
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Edit Mode Banner */}
      {isEditMode && editingProposalId && (
        <div className="bg-gradient-to-r from-amber-500/20 to-amber-500/10 border-b border-amber-500/30 px-4 py-3">
          <div className="container mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-amber-500/30 flex items-center justify-center">
                <Pencil className="h-4 w-4 text-amber-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-amber-400">
                  Modo Edição
                </p>
                <p className="text-xs text-amber-400/70">
                  Editando proposta existente — alterações serão salvas sobre a versão atual
                </p>
              </div>
            </div>
            <Badge className="bg-amber-500/30 text-amber-400 border-amber-500/50 font-mono text-sm px-3 py-1">
              {editingProposalId}
            </Badge>
          </div>
        </div>
      )}

      {/* Profile Banner - Shows discount for partners */}
      {userContext.partnerDiscount > 0 && (
        <div className="bg-gradient-to-r from-emerald-500/20 to-emerald-500/10 border-b border-emerald-500/30 px-4 py-3">
          <div className="container mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-emerald-500/30 flex items-center justify-center">
                <Percent className="h-4 w-4 text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-emerald-400">
                  Desconto de {userContext.profileLabel}
                </p>
                <p className="text-xs text-emerald-400/70">
                  {(userContext.partnerDiscount * 100).toFixed(0)}% aplicado automaticamente no valor final
                </p>
              </div>
            </div>
            <Badge className="bg-emerald-500/30 text-emerald-400 border-emerald-500/50 text-lg px-4 py-1">
              -{(userContext.partnerDiscount * 100).toFixed(0)}%
            </Badge>
          </div>
        </div>
      )}
      
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <span className="text-2xl font-bold tracking-wide text-foreground">OPEN — Calculadora VM + BareMetal</span>
            <p className="text-muted-foreground text-sm">Preços em BRL. Câmbio aplica só para GPU.</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Profile badge */}
            <Badge variant="outline" className="hidden sm:flex gap-1 items-center">
              <Shield className="w-3 h-3" />
              {userContext.profileLabel}
            </Badge>
            <Button variant="ghost" size="icon" title="Atualizar Preços" onClick={() => refetchConfig()}>
              <RefreshCw className="w-4 h-4" />
            </Button>
            {/* Settings only for users with canAccessSettings */}
            {userContext.pricingRules.canAccessSettings && (
              <RouterLink to="/precos">
                <Button variant="ghost" size="icon" title="Configurar Preços">
                  <Settings className="w-4 h-4" />
                </Button>
              </RouterLink>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="grid lg:grid-cols-[1.15fr_0.85fr] gap-6">
          {/* Left Column - Configuration */}
          <div className="space-y-6">

            {/* Config Card */}
            <div className="open-card">
              <h2 className="text-lg font-semibold text-foreground mb-4">Configuração</h2>
              
              {/* FX */}
              <div className="grid md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Câmbio (USD→BRL) — aplica só para GPU</label>
                  <Input
                    type="number"
                    value={fx}
                    onChange={(e) => setFx(parseFloat(e.target.value) || 5)}
                    min={0}
                    step={0.01}
                    className="bg-input border-border"
                  />
                  <span className="text-xs text-muted-foreground">CPU/RAM/Discos/IPs/Add-ons continuam em R$.</span>
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Preços VM</label>
                  <div className="text-xs text-muted-foreground bg-muted/30 rounded p-2">
                    vCPU: R$ {config.vm_prices_brl.vcpu} | RAM: R$ {config.vm_prices_brl.ram_per_gb}/GB | NVMe: R$ {config.vm_prices_brl.nvme_per_gb}/GB | IP: R$ {config.vm_prices_brl.ip_public}
                  </div>
                </div>
              </div>

              {/* Term and Datacenter - side by side */}
              <div className="grid md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Vigência (desconto)</label>
                  <div className="flex gap-2 flex-wrap">
                    {Object.entries(config.discount).map(([term, disc]) => (
                      <Button
                        key={term}
                        variant={selectedTerm === term ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSelectedTerm(term)}
                      >
                        {term} {parseInt(term) === 1 ? 'mês' : 'meses'} {disc > 0 && `(-${(disc * 100).toFixed(0)}%)`}
                      </Button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Datacenter</label>
                  <Select value={datacenter} onValueChange={(v) => setDatacenter(v as 'SP1' | 'SP2' | 'FL1' | 'CE1')}>
                    <SelectTrigger className="bg-input border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SP1">SP1 (São Paulo)</SelectItem>
                      <SelectItem value="SP2">SP2 (São Paulo)</SelectItem>
                      <SelectItem value="FL1">FL1 (Fortaleza)</SelectItem>
                      <SelectItem value="CE1">CE1 (Ceará)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Client Info */}
            <div className="open-card">
              <h2 className="text-lg font-semibold text-foreground mb-4">Dados do Cliente</h2>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Nome</label>
                  <Input
                    value={client.name}
                    onChange={(e) => setClient(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Nome do cliente"
                    className="bg-input border-border"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Empresa</label>
                  <Input
                    value={client.company}
                    onChange={(e) => setClient(prev => ({ ...prev, company: e.target.value }))}
                    placeholder="Nome da empresa"
                    className="bg-input border-border"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Telefone</label>
                  <Input
                    value={client.phone}
                    onChange={(e) => setClient(prev => ({ ...prev, phone: maskPhone(e.target.value) }))}
                    placeholder="(00) 00000-0000"
                    className="bg-input border-border"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">E-mail</label>
                  <Input
                    type="email"
                    value={client.email}
                    onChange={(e) => setClient(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="email@empresa.com"
                    className="bg-input border-border"
                  />
                </div>
              </div>
            </div>

            {/* Proposal Info */}
            <div className="open-card">
              <h2 className="text-lg font-semibold text-foreground mb-4">Proposta</h2>
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">ID</label>
                  <Input value={proposal.id} readOnly className="bg-muted/30 border-border" />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Data</label>
                  <Input value={formatDateBR(proposal.createdAt)} readOnly className="bg-muted/30 border-border" />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Validade (dias)</label>
                  <Select value={String(proposal.validityDays)} onValueChange={(v) => setProposal(prev => ({ ...prev, validityDays: parseInt(v) }))}>
                    <SelectTrigger className="bg-input border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7">7 dias</SelectItem>
                      <SelectItem value="15">15 dias</SelectItem>
                      <SelectItem value="30">30 dias</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Válida até: {validityDate.toLocaleDateString('pt-BR')}
              </p>
              
              {/* Observação field */}
              <div className="mt-4">
                <label className="block text-xs text-muted-foreground mb-1">Observação</label>
                <textarea
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value.slice(0, 2000))}
                  placeholder="Digite aqui informações relevantes para o cliente (escopo, premissas, prazos, ressalvas etc.)"
                  className="w-full min-h-[100px] p-3 rounded-md bg-input border border-border text-foreground placeholder:text-muted-foreground resize-y"
                  maxLength={2000}
                />
                <p className="text-xs text-muted-foreground mt-1 text-right">
                  {observacao.length}/2000 caracteres
                </p>
              </div>
            </div>

            {/* Servers */}
            <div className="open-card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-foreground">Servidores</h2>
                <div className="flex gap-2 flex-wrap">
                  <Button variant="server-badge" size="badge" onClick={addVM}>
                    <ProductIcon type="vm" size={14} className="text-white" />
                    <Plus className="w-3 h-3" /> VM
                  </Button>
                  <Button variant="server-badge" size="badge" onClick={addBM}>
                    <ProductIcon type="baremetal" size={14} className="text-white" />
                    <Plus className="w-3 h-3" /> BareMetal
                  </Button>
                  <Button 
                    variant="server-badge" 
                    size="badge" 
                    onClick={() => setKubernetes(prev => ({ ...prev, enabled: true }))}
                    disabled={kubernetes.enabled}
                  >
                    <ProductIcon type="kubernetes" size={14} className="text-white" />
                    <Plus className="w-3 h-3" /> Kubernetes
                  </Button>
                  <Button variant="server-badge" size="badge" onClick={addStorage}>
                    <ProductIcon type="storage-volume" size={14} className="text-white" />
                    <Plus className="w-3 h-3" /> Storage
                  </Button>
                  <Button 
                    variant="server-badge" 
                    size="badge" 
                    onClick={addOpenSaas}
                    disabled={openSaas.enabled}
                  >
                    <ProductIcon type="open-saas" size={14} className="text-white" />
                    <Plus className="w-3 h-3" /> OPEN SaaS
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                {/* VM and BareMetal items */}
                {items.map((item, idx) => {
                  const isExpanded = expandedItems.has(item.id);
                  const gpuOptions = Object.keys(config.gpu_usd);

                  return (
                    <div key={item.id} className="border border-border rounded-lg overflow-hidden bg-card/50">
                      {/* Header */}
                      <div
                        className="flex items-center justify-between px-4 py-3 bg-muted/30 cursor-pointer"
                        onClick={() => toggleExpand(item.id)}
                      >
                        <div className="flex items-center gap-3">
                          <ProductIcon type={item.type === 'vm' ? 'vm' : 'baremetal'} size={18} className="text-emerald-400" />
                          <span className="bg-emerald-500 text-white text-xs font-bold uppercase px-2 py-1 rounded-full">
                            {item.type === 'vm' ? 'VM' : 'BAREMETAL'}
                          </span>
                          <span className="font-medium text-foreground">
                            {item.type === 'vm' ? `VM #${idx + 1}` : `BareMetal #${idx + 1}`}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {item.qtyServers}x servidor(es)
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => { e.stopPropagation(); removeItem(item.id); }}
                            className="h-8 w-8 text-destructive hover:bg-destructive/20"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </div>
                      </div>

                      {/* Content */}
                      {isExpanded && (
                        <div className="p-4 space-y-4">
                          {/* Common fields */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div>
                              <label className="block text-xs text-muted-foreground mb-1">Qtd Servidores</label>
                              <Input
                                type="number"
                                value={item.qtyServers}
                                onChange={(e) => updateItem(item.id, { qtyServers: parseInt(e.target.value) || 1 })}
                                min={1}
                                className="bg-input border-border"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-muted-foreground mb-1">IPs Públicos</label>
                              <Input
                                type="number"
                                value={item.ips}
                                onChange={(e) => updateItem(item.id, { ips: parseInt(e.target.value) || 0 })}
                                min={0}
                                className="bg-input border-border"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-muted-foreground mb-1">GPU</label>
                              <Select value={item.gpu} onValueChange={(v) => updateItem(item.id, { gpu: v, gpuQty: v === 'Sem GPU' ? 0 : Math.max(1, item.gpuQty) })}>
                                <SelectTrigger className="bg-input border-border">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {gpuOptions.map(gpu => (
                                    <SelectItem key={gpu} value={gpu}>{gpu}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            {item.gpu !== 'Sem GPU' && (
                              <div>
                                <label className="block text-xs text-muted-foreground mb-1">Qtd GPU</label>
                                <Input
                                  type="number"
                                  value={item.gpuQty}
                                  onChange={(e) => updateItem(item.id, { gpuQty: parseInt(e.target.value) || 1 })}
                                  min={1}
                                  max={8}
                                  className="bg-input border-border"
                                />
                              </div>
                            )}
                          </div>

                          {/* VM-specific fields */}
                          {item.type === 'vm' && (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                              <div>
                                <label className="block text-xs text-muted-foreground mb-1">vCPU</label>
                                <Input
                                  type="number"
                                  value={item.vcpu}
                                  onChange={(e) => updateItem(item.id, { vcpu: parseInt(e.target.value) || 1 })}
                                  min={1}
                                  className="bg-input border-border"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-muted-foreground mb-1">RAM (GB)</label>
                                <Input
                                  type="number"
                                  value={item.ramGb}
                                  onChange={(e) => updateItem(item.id, { ramGb: parseInt(e.target.value) || 1 })}
                                  min={1}
                                  className="bg-input border-border"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-muted-foreground mb-1">NVMe (GB)</label>
                                <Input
                                  type="number"
                                  value={Math.round(item.nvmeTb * 1024)}
                                  onChange={(e) => updateItem(item.id, { nvmeTb: (parseInt(e.target.value) || 0) / 1024 })}
                                  min={0}
                                  step={50}
                                  className="bg-input border-border"
                                />
                              </div>
                            </div>
                          )}

                          {/* BM-specific fields */}
                          {item.type === 'bm' && (
                            <>
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-xs text-muted-foreground mb-1">CPU</label>
                                  <Select value={item.bmCpu} onValueChange={(v) => updateItem(item.id, { bmCpu: v })}>
                                    <SelectTrigger className="bg-input border-border">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {config.baremetal.cpu_models.map(cpu => (
                                        <SelectItem key={cpu.id} value={cpu.id}>{cpu.label} - R$ {formatCurrency(cpu.price)}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div>
                                  <label className="block text-xs text-muted-foreground mb-1">RAM</label>
                                  <Select value={item.bmRam} onValueChange={(v) => updateItem(item.id, { bmRam: v })}>
                                    <SelectTrigger className="bg-input border-border">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {config.baremetal.ram_tiers.map(ram => (
                                        <SelectItem key={ram.id} value={ram.id}>{ram.label} - R$ {formatCurrency(ram.price)}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>

                              {/* Disks */}
                              <div>
                                <div className="flex items-center justify-between mb-2">
                                  <label className="block text-xs text-muted-foreground">Discos NVMe</label>
                                  <Button variant="ghost" size="sm" onClick={() => addDisk(item.id)}>
                                    <Plus className="w-3 h-3 mr-1" /> Disco
                                  </Button>
                                </div>
                                <div className="space-y-2">
                                  {(Array.isArray(item.disks) ? item.disks : []).map((disk, diskIdx) => (
                                    <div key={diskIdx} className="flex gap-2 items-center">
                                      <Select value={disk.type} onValueChange={(v) => updateDisk(item.id, diskIdx, { type: v })}>
                                        <SelectTrigger className="flex-1 bg-input border-border">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {config.baremetal.disks.map(d => (
                                            <SelectItem key={d.id} value={d.id}>{d.label} - R$ {formatCurrency(d.price)}</SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                      <Input
                                        type="number"
                                        value={disk.qty}
                                        onChange={(e) => updateDisk(item.id, diskIdx, { qty: parseInt(e.target.value) || 1 })}
                                        min={1}
                                        className="w-20 bg-input border-border"
                                        placeholder="Qtd"
                                      />
                                      {(Array.isArray(item.disks) ? item.disks : []).length > 1 && (
                                        <Button variant="ghost" size="icon" onClick={() => removeDisk(item.id, diskIdx)} className="h-8 w-8">
                                          <Minus className="w-4 h-4" />
                                        </Button>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Kubernetes item - inline with VMs and BareMetals */}
                {kubernetes.enabled && (
                  <div className="border border-border rounded-lg overflow-hidden bg-card/50">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 bg-muted/30">
                      <div 
                        className="flex items-center gap-3 flex-1 cursor-pointer"
                        onClick={() => toggleSectionCollapse('kubernetes')}
                      >
                        <ProductIcon type="kubernetes" size={18} className="text-emerald-400" />
                        <span className="bg-emerald-500 text-white text-xs font-bold uppercase px-2 py-1 rounded-full">
                          KUBERNETES
                        </span>
                        <span className="font-medium text-foreground">
                          Kubernetes Gerenciado
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {K8S_PLANS[kubernetes.plan].shortLabel}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setKubernetes({
                            enabled: false,
                            plan: 'k8s_small',
                            addons: {
                              support_24x7: false,
                              backup_velero: false,
                              dr_multisite: false,
                              observability: false,
                              cicd_managed: false,
                              devops_hours: 0,
                            },
                            extras: { vcpu: 0, ramGB: 0, diskGB: 0 },
                          })}
                          className="h-8 w-8 text-destructive hover:bg-destructive/20"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8"
                          onClick={() => toggleSectionCollapse('kubernetes')}
                        >
                          {collapsedSections.has('kubernetes') ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>

                    {/* Content - collapsible */}
                    {!collapsedSections.has('kubernetes') && (
                    <div className="p-4 space-y-4">
                      {/* Plan selector */}
                      <div>
                        <label className="block text-xs text-muted-foreground mb-2">Plano</label>
                        <Select 
                          value={kubernetes.plan} 
                          onValueChange={(v) => setKubernetes(prev => ({ 
                            ...prev, 
                            plan: v as K8sPlan,
                            extras: { vcpu: 0, ramGB: 0, diskGB: 0 } // Reset extras when changing plan
                          }))}
                        >
                          <SelectTrigger className="bg-input border-border">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(Object.entries(K8S_PLANS) as [K8sPlan, K8sPlanSpec][]).map(([planId, planInfo]) => {
                              const basePrice = getK8sPlanBasePrice(planId, config);
                              return (
                                <SelectItem key={planId} value={planId}>
                                  {planInfo.label} — R$ {formatCurrency(basePrice)}/mês
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground mt-2">
                          Plano selecionado: <span className="text-foreground font-medium">{K8S_PLANS[kubernetes.plan].shortLabel} — R$ {formatCurrency(getK8sPlanBasePrice(kubernetes.plan, config))}/mês</span>
                        </p>
                      </div>

                      {/* Recursos Base e Extras */}
                      <div className="border border-border rounded-lg p-3 bg-muted/20">
                        <label className="block text-xs text-muted-foreground mb-3">Recursos do Plano</label>
                        {(() => {
                          const planSpec = K8S_PLANS[kubernetes.plan];
                          const baseResources = getK8sPlanBaseResources(kubernetes.plan);
                          const extras = kubernetes.extras || { vcpu: 0, ramGB: 0, diskGB: 0 };
                          const extrasPrice = calculateK8sExtrasPrice(extras, config);
                          
                          return (
                            <>
                              {/* Base resources (read-only) */}
                              <div className="grid grid-cols-3 gap-3 mb-4">
                                <div className="bg-muted/30 rounded px-2 py-1.5">
                                  <span className="text-xs text-muted-foreground block">vCPU base</span>
                                  <span className="text-sm font-medium text-foreground">{baseResources.vcpu} vCPU</span>
                                  <span className="text-xs text-muted-foreground block">({planSpec.nodes} nodes × {planSpec.vcpu_per_node})</span>
                                </div>
                                <div className="bg-muted/30 rounded px-2 py-1.5">
                                  <span className="text-xs text-muted-foreground block">RAM base</span>
                                  <span className="text-sm font-medium text-foreground">{baseResources.ramGB} GB</span>
                                  <span className="text-xs text-muted-foreground block">({planSpec.nodes} nodes × {planSpec.ram_gb_per_node})</span>
                                </div>
                                <div className="bg-muted/30 rounded px-2 py-1.5">
                                  <span className="text-xs text-muted-foreground block">Disco base</span>
                                  <span className="text-sm font-medium text-foreground">{baseResources.diskGB} GB</span>
                                  <span className="text-xs text-muted-foreground block">({planSpec.nodes} nodes × {planSpec.disk_gb_per_node})</span>
                                </div>
                              </div>
                              
                              {/* Extra resources (editable) */}
                              <label className="block text-xs text-muted-foreground mb-2">Recursos Adicionais (opcional)</label>
                              <div className="grid grid-cols-3 gap-3">
                                <div>
                                  <label className="block text-xs text-muted-foreground mb-1">+ vCPU</label>
                                  <Input
                                    type="number"
                                    value={extras.vcpu}
                                    onChange={(e) => setKubernetes(prev => ({ 
                                      ...prev, 
                                      extras: { ...prev.extras, vcpu: Math.max(0, parseInt(e.target.value) || 0) }
                                    }))}
                                    min={0}
                                    step={1}
                                    className="bg-input border-border"
                                  />
                                  <span className="text-xs text-muted-foreground">R$ {formatCurrency(config.vm_prices_brl.vcpu)}/vCPU</span>
                                </div>
                                <div>
                                  <label className="block text-xs text-muted-foreground mb-1">+ RAM (GB)</label>
                                  <Input
                                    type="number"
                                    value={extras.ramGB}
                                    onChange={(e) => setKubernetes(prev => ({ 
                                      ...prev, 
                                      extras: { ...prev.extras, ramGB: Math.max(0, parseInt(e.target.value) || 0) }
                                    }))}
                                    min={0}
                                    step={1}
                                    className="bg-input border-border"
                                  />
                                  <span className="text-xs text-muted-foreground">R$ {formatCurrency(config.vm_prices_brl.ram_per_gb)}/GB</span>
                                </div>
                                <div>
                                  <label className="block text-xs text-muted-foreground mb-1">+ Disco (GB)</label>
                                  <Input
                                    type="number"
                                    value={extras.diskGB}
                                    onChange={(e) => setKubernetes(prev => ({ 
                                      ...prev, 
                                      extras: { ...prev.extras, diskGB: Math.max(0, parseInt(e.target.value) || 0) }
                                    }))}
                                    min={0}
                                    step={1}
                                    className="bg-input border-border"
                                  />
                                  <span className="text-xs text-muted-foreground">R$ {formatCurrency(config.vm_prices_brl.nvme_per_gb)}/GB</span>
                                </div>
                              </div>
                              
                              {/* Extras price summary */}
                              {extrasPrice > 0 && (
                                <div className="mt-3 pt-3 border-t border-border/50">
                                  <div className="flex justify-between items-center">
                                    <span className="text-xs text-muted-foreground">Custo adicional mensal:</span>
                                    <span className="text-sm font-medium text-primary">+ R$ {formatCurrency(extrasPrice)}/mês</span>
                                  </div>
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </div>

                      {/* K8s Add-ons */}
                      <div>
                        <label className="block text-xs text-muted-foreground mb-2">Add-ons Kubernetes</label>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={kubernetes.addons.support_24x7}
                              onChange={(e) => setKubernetes(prev => ({ ...prev, addons: { ...prev.addons, support_24x7: e.target.checked } }))}
                              className="rounded border-border"
                            />
                            <div>
                              <label className="block text-xs text-foreground">Suporte 24×7</label>
                              <span className="text-xs text-muted-foreground">R$ {formatCurrency(getK8sAddonPrice('support_24x7', config))}/mês</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={kubernetes.addons.backup_velero}
                              onChange={(e) => setKubernetes(prev => ({ ...prev, addons: { ...prev.addons, backup_velero: e.target.checked } }))}
                              className="rounded border-border"
                            />
                            <div>
                              <label className="block text-xs text-foreground">Backup (Velero)</label>
                              <span className="text-xs text-muted-foreground">R$ {formatCurrency(getK8sAddonPrice('backup_velero', config))}/mês</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={kubernetes.addons.dr_multisite}
                              onChange={(e) => setKubernetes(prev => ({ ...prev, addons: { ...prev.addons, dr_multisite: e.target.checked } }))}
                              className="rounded border-border"
                            />
                            <div>
                              <label className="block text-xs text-foreground">DR multi-site</label>
                              <span className="text-xs text-muted-foreground">R$ {formatCurrency(getK8sAddonPrice('dr_multisite', config))}/mês</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={kubernetes.addons.observability}
                              onChange={(e) => setKubernetes(prev => ({ ...prev, addons: { ...prev.addons, observability: e.target.checked } }))}
                              className="rounded border-border"
                            />
                            <div>
                              <label className="block text-xs text-foreground">Observabilidade avançada</label>
                              <span className="text-xs text-muted-foreground">R$ {formatCurrency(getK8sAddonPrice('observability', config))}/mês</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={kubernetes.addons.cicd_managed}
                              onChange={(e) => setKubernetes(prev => ({ ...prev, addons: { ...prev.addons, cicd_managed: e.target.checked } }))}
                              className="rounded border-border"
                            />
                            <div>
                              <label className="block text-xs text-foreground">CI/CD gerenciado</label>
                              <span className="text-xs text-muted-foreground">R$ {formatCurrency(getK8sAddonPrice('cicd_managed', config))}/mês</span>
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs text-muted-foreground mb-1">Horas DevOps</label>
                            <Input
                              type="number"
                              value={kubernetes.addons.devops_hours}
                              onChange={(e) => setKubernetes(prev => ({ ...prev, addons: { ...prev.addons, devops_hours: parseInt(e.target.value) || 0 } }))}
                              min={0}
                              className="bg-input border-border"
                            />
                            <span className="text-xs text-muted-foreground">R$ {formatCurrency(getK8sAddonPrice('devops_hours', config))}/hora</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    )}
                  </div>
                )}

                {/* Storage items */}
                {storageItems.map((storage, idx) => {
                  const storageType = storage.storageType || 'sas';
                  const isNvme = storageType === 'nvme';
                  const typeLabel = STORAGE_TYPE_LABELS[storageType];
                  
                  // Calculate pricing based on storage type
                  let pricePerUnit: number;
                  let monthlyTotal: number;
                  let unitLabel: string;
                  let volumeDisplay: number;
                  let tierLabel: string = '';
                  
                  if (isNvme) {
                    // NVMe: GB, fixed price
                    const volumeGB = storage.volumeGB || 100;
                    pricePerUnit = getNvmePricePerGB(config);
                    monthlyTotal = volumeGB * pricePerUnit;
                    unitLabel = 'GB';
                    volumeDisplay = volumeGB;
                  } else {
                    // SAS and S3: TB, tiered pricing (S3 uses same pricing as SAS)
                    pricePerUnit = getStoragePricePerTB(storage.volumeTB, storage.region, config, storageType);
                    monthlyTotal = calculateStorageMonthly(storage.volumeTB, storage.region, config, storageType);
                    unitLabel = 'TB';
                    volumeDisplay = storage.volumeTB;
                    tierLabel = getStorageTierLabel(storage.volumeTB);
                  }

                  const sectionId = `storage-${storage.id}`;
                  return (
                    <div key={storage.id} className="border border-border rounded-lg overflow-hidden bg-card/50">
                      {/* Header */}
                      <div className="flex items-center justify-between px-4 py-3 bg-muted/30">
                        <div 
                          className="flex items-center gap-3 flex-1 cursor-pointer"
                          onClick={() => toggleSectionCollapse(sectionId)}
                        >
                          <ProductIcon 
                            type={storageType === 's3' ? 'storage-s3' : storageType === 'nvme' ? 'storage-nvme' : 'storage-volume'} 
                            size={18} 
                            className="text-emerald-400" 
                          />
                          <span className="bg-emerald-500 text-white text-xs font-bold uppercase px-2 py-1 rounded-full">
                            STORAGE
                          </span>
                          <span className="font-medium text-foreground">
                            {typeLabel} #{idx + 1}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {isNvme ? '' : `${storage.region} — `}{volumeDisplay} {unitLabel}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeStorage(storage.id)}
                            className="h-8 w-8 text-destructive hover:bg-destructive/20"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8"
                            onClick={() => toggleSectionCollapse(sectionId)}
                          >
                            {collapsedSections.has(sectionId) ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                          </Button>
                        </div>
                      </div>

                      {/* Content - collapsible */}
                      {!collapsedSections.has(sectionId) && (
                      <div className="p-4 space-y-4">
                        <div className={`grid gap-3 ${isNvme ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-2 md:grid-cols-5'}`}>
                          <div>
                            <label className="block text-xs text-muted-foreground mb-1">Tipo de Storage</label>
                            <Select 
                              value={storageType} 
                              onValueChange={(v) => {
                                const newType = v as StorageType;
                                // When switching to NVMe, initialize volumeGB; when switching away, clear it
                                if (newType === 'nvme') {
                                  updateStorage(storage.id, { storageType: newType, volumeGB: storage.volumeGB || 100 });
                                } else {
                                  updateStorage(storage.id, { storageType: newType, volumeGB: undefined });
                                }
                              }}
                            >
                              <SelectTrigger className="bg-input border-border">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="sas">Storage SAS</SelectItem>
                                <SelectItem value="s3">Bucket S3</SelectItem>
                                <SelectItem value="nvme">SSD NVMe</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          {!isNvme && (
                            <div>
                              <label className="block text-xs text-muted-foreground mb-1">Região</label>
                              <Select 
                                value={storage.region} 
                                onValueChange={(v) => updateStorage(storage.id, { region: v as StorageRegion })}
                              >
                                <SelectTrigger className="bg-input border-border">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="BR">Brasil (BR)</SelectItem>
                                  <SelectItem value="USA">Estados Unidos (USA)</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                          <div>
                            <label className="block text-xs text-muted-foreground mb-1">
                              Volume ({isNvme ? 'GB' : 'TB'})
                            </label>
                            <Input
                              type="number"
                              value={isNvme ? (storage.volumeGB || 100) : storage.volumeTB}
                              onChange={(e) => {
                                if (isNvme) {
                                  updateStorage(storage.id, { volumeGB: parseFloat(e.target.value) || 1 });
                                } else {
                                  updateStorage(storage.id, { volumeTB: parseFloat(e.target.value) || 1 });
                                }
                              }}
                              min={1}
                              step={isNvme ? 50 : 0.1}
                              className="bg-input border-border"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-muted-foreground mb-1">
                              Preço por {isNvme ? 'GB' : 'TB'}{!isNvme && ' (faixa)'}
                            </label>
                            <div className="text-sm bg-muted/30 rounded px-3 py-2 text-foreground">
                              R$ {formatCurrency(pricePerUnit)}/{unitLabel}
                            </div>
                            {!isNvme && <span className="text-xs text-muted-foreground">Faixa: {tierLabel}</span>}
                          </div>
                          <div>
                            <label className="block text-xs text-muted-foreground mb-1">Total mensal</label>
                            <div className="text-sm font-medium text-primary bg-muted/30 rounded px-3 py-2">
                              R$ {formatCurrency(monthlyTotal)}
                            </div>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {typeLabel}{!isNvme && ` ${storage.region}`} — {volumeDisplay} {unitLabel} — R$ {formatCurrency(pricePerUnit)}/{unitLabel} — Total: R$ {formatCurrency(monthlyTotal)}/mês
                        </p>
                      </div>
                      )}
                    </div>
                  );
                })}

                {/* OPEN SaaS Card */}
                {openSaas.enabled && (
                  <div className="border border-border rounded-lg overflow-hidden bg-card/50">
                    <div className="flex items-center justify-between px-4 py-3 bg-muted/30">
                      <div 
                        className="flex items-center gap-3 flex-1 cursor-pointer"
                        onClick={() => toggleSectionCollapse('open-saas')}
                      >
                        <ProductIcon type="open-saas" size={18} className="text-blue-400" />
                        <span className="bg-blue-500 text-white text-xs font-bold uppercase px-2 py-1 rounded-full">
                          SAAS
                        </span>
                        <span className="font-medium text-foreground">OPEN SaaS</span>
                        <span className="text-xs text-muted-foreground">
                          {openSaas.users} usuário(s)
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setOpenSaas(DEFAULT_OPEN_SAAS_STATE)}
                          className="h-8 w-8 text-destructive hover:bg-destructive/20"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8"
                          onClick={() => toggleSectionCollapse('open-saas')}
                        >
                          {collapsedSections.has('open-saas') ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>
                    {!collapsedSections.has('open-saas') && (
                    <div className="p-4 space-y-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div>
                          <label className="block text-xs text-muted-foreground mb-1">Usuários (mínimo 5)</label>
                          <Input
                            type="number"
                            value={openSaas.users}
                            onChange={(e) => setOpenSaas(prev => ({ ...prev, users: parseInt(e.target.value) || 5 }))}
                            onBlur={(e) => {
                              const val = parseInt(e.target.value) || 5;
                              if (val < 5) setOpenSaas(prev => ({ ...prev, users: 5 }));
                            }}
                            min={5}
                            className="bg-input border-border"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-muted-foreground mb-1">Preço por usuário</label>
                          <div className="text-sm text-foreground bg-muted/30 rounded px-3 py-2">
                            R$ {formatCurrency(config.open_saas_price_per_user || 85)}/usuário
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs text-muted-foreground mb-1">Total mensal</label>
                          <div className="text-sm font-medium text-primary bg-muted/30 rounded px-3 py-2">
                            R$ {formatCurrency(openSaas.users * (config.open_saas_price_per_user || 85))}
                          </div>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        OPEN SaaS — {openSaas.users} usuário(s) × R$ {formatCurrency(config.open_saas_price_per_user || 85)}/usuário — Total: R$ {formatCurrency(openSaas.users * (config.open_saas_price_per_user || 85))}/mês
                      </p>
                    </div>
                    )}
                  </div>
                )}

                {items.length === 0 && !kubernetes.enabled && storageItems.length === 0 && !openSaas.enabled && (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>Nenhum servidor adicionado.</p>
                    <p className="text-sm">Clique em "+ VM", "+ BareMetal", "+ Kubernetes", "+ Storage" ou "+ OPEN SaaS" para começar.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Add-ons */}
            <div className="open-card">
              <h2 className="text-lg font-semibold text-foreground mb-4">Add-ons & Serviços</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* Antivírus */}
                <div className="relative">
                  <label className="block text-xs text-muted-foreground mb-1">Antivírus (qtd)</label>
                  <Input
                    type="number"
                    value={addons.antivirus}
                    onChange={(e) => { setAddons(prev => ({ ...prev, antivirus: parseInt(e.target.value) || 0 })); setAntivirusManuallySet(true); }}
                    min={0}
                    className="bg-input border-border"
                  />
                  <span className="text-xs text-muted-foreground">R$ {config.addons_brl.antivirus_unit}/unid.</span>
                </div>

                {/* TSplus */}
                <div className="relative">
                  <label className="block text-xs text-muted-foreground mb-1">TSplus (qtd)</label>
                  <Input
                    type="number"
                    value={addons.tsplus}
                    onChange={(e) => setAddons(prev => ({ ...prev, tsplus: parseInt(e.target.value) || 0 }))}
                    min={0}
                    className="bg-input border-border"
                  />
                  <span className="text-xs text-muted-foreground">R$ {config.addons_brl.tsplus_unit}/unid.</span>
                </div>

                {/* CAL */}
                <div className="relative">
                  <label className="block text-xs text-muted-foreground mb-1">CAL (qtd)</label>
                  <Input
                    type="number"
                    value={addons.cal}
                    onChange={(e) => setAddons(prev => ({ ...prev, cal: parseInt(e.target.value) || 0 }))}
                    min={0}
                    className="bg-input border-border"
                  />
                  <span className="text-xs text-muted-foreground">R$ {config.addons_brl.cal_unit}/unid.</span>
                </div>

                {/* Firewall */}
                <div className="relative">
                  <label className="block text-xs text-muted-foreground mb-1">Firewall pfSense</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={addons.firewall}
                      onChange={(e) => setAddons(prev => ({ ...prev, firewall: e.target.checked }))}
                      className="rounded border-border h-4 w-4"
                    />
                    <span className="text-xs text-muted-foreground">Ativar — R$ {config.addons_brl.firewall_pfsense}/mês</span>
                  </div>
                </div>
              </div>

              {/* SQL */}
              <div className="mt-4 grid grid-cols-2 gap-4">
                <div className="relative">
                  <label className="block text-xs text-muted-foreground mb-1">SQL Server</label>
                  <Select value={addons.sql} onValueChange={(v) => setAddons(prev => ({ ...prev, sql: v, sqlQty: v === 'none' ? 0 : Math.max(1, prev.sqlQty) }))}>
                    <SelectTrigger className="bg-input border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(config.addons_brl.sql)
                        .filter(([key]) => key && key.trim() !== '')
                        .map(([key, price]) => (
                          <SelectItem key={key} value={key}>
                            {key === 'none' ? 'Nenhum' : key.toUpperCase()} {price > 0 && `- R$ ${formatCurrency(price)}`}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                {addons.sql !== 'none' && (
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Qtd Licenças SQL</label>
                    <Input
                      type="number"
                      value={addons.sqlQty}
                      onChange={(e) => setAddons(prev => ({ ...prev, sqlQty: parseInt(e.target.value) || 0 }))}
                      min={1}
                      className="bg-input border-border"
                    />
                  </div>
                )}
              </div>

              {/* Veeam */}
              <div className="mt-4 grid grid-cols-2 gap-4">
                <div className="relative">
                  <label className="block text-xs text-muted-foreground mb-1">Veeam VM (qtd)</label>
                  <Input
                    type="number"
                    value={addons.veeamVm}
                    onChange={(e) => setAddons(prev => ({ ...prev, veeamVm: parseInt(e.target.value) || 0 }))}
                    min={0}
                    className="bg-input border-border"
                  />
                  <span className="text-xs text-muted-foreground">R$ {config.addons_brl.veeam_vm_unit}/unid.</span>
                </div>
                <div className="relative">
                  <label className="block text-xs text-muted-foreground mb-1">Veeam Agent (qtd)</label>
                  <Input
                    type="number"
                    value={addons.veeamAg}
                    onChange={(e) => setAddons(prev => ({ ...prev, veeamAg: parseInt(e.target.value) || 0 }))}
                    min={0}
                    className="bg-input border-border"
                  />
                  <span className="text-xs text-muted-foreground">R$ {config.addons_brl.veeam_agent_unit}/unid.</span>
                </div>
              </div>

              {/* Backup */}
              <div className="mt-4 grid grid-cols-2 gap-4">
                <div className="relative">
                  <label className="block text-xs text-muted-foreground mb-1">Plano de Backup</label>
                  <Select value={addons.backupPlan} onValueChange={(v) => setAddons(prev => ({ ...prev, backupPlan: v }))}>
                    <SelectTrigger className="bg-input border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem Backup</SelectItem>
                      <SelectItem value="7">7 dias</SelectItem>
                      <SelectItem value="15">15 dias</SelectItem>
                      <SelectItem value="30">30 dias</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {addons.backupPlan !== 'none' && (
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Backup (GB)</label>
                    <Input
                      type="number"
                      value={addons.backupGb}
                      onChange={(e) => setAddons(prev => ({ ...prev, backupGb: parseInt(e.target.value) || 0 }))}
                      min={0}
                      className="bg-input border-border"
                    />
                  </div>
                )}
              </div>

              {/* Custom Add-ons (dynamic from config) */}
              {(() => {
                const standardAddonKeys = ['antivirus_unit', 'firewall_pfsense', 'tsplus_unit', 'cal_unit', 'sql', 'veeam_vm_unit', 'veeam_agent_unit'];
                const customAddonEntries = Object.entries(config.addons_brl).filter(
                  ([key, value]) => !standardAddonKeys.includes(key) && typeof value === 'number'
                );
                
                if (customAddonEntries.length === 0) return null;
                
                return (
                  <div className="mt-4">
                    <label className="block text-xs text-muted-foreground mb-2">Add-ons Customizados</label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {customAddonEntries.map(([key, price]) => (
                        <div key={key} className="relative">
                          <label className="block text-xs text-muted-foreground mb-1 capitalize">
                            {key.replace(/_/g, ' ')}
                          </label>
                          <Input
                            type="number"
                            value={addons.customAddons?.[key] || 0}
                            onChange={(e) => setAddons(prev => ({
                              ...prev,
                              customAddons: {
                                ...prev.customAddons,
                                [key]: parseInt(e.target.value) || 0,
                              },
                            }))}
                            min={0}
                            className="bg-input border-border"
                          />
                          <span className="text-xs text-muted-foreground">R$ {formatCurrency(price as number)}/unid.</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Canal / Parceiro Section */}
            <div className="open-card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-foreground">Canal / Parceiro</h2>
                <div className="flex gap-2">
                  <Button
                    variant={reseller.viewMode === 'INTERNO' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setReseller(prev => ({ ...prev, viewMode: 'INTERNO' }))}
                  >
                    PARCEIRO
                  </Button>
                  <Button
                    variant={reseller.viewMode === 'CLIENTE' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setReseller(prev => ({ ...prev, viewMode: 'CLIENTE' }))}
                  >
                    CLIENTE
                  </Button>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Revendedor</label>
                  <Input
                    value={reseller.resellerName}
                    onChange={(e) => setReseller(prev => ({ ...prev, resellerName: e.target.value }))}
                    placeholder="Nome do revendedor"
                    className="bg-input border-border"
                    disabled={reseller.approvalStatus === 'Aprovado'}
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Comissão Parceiro (R$) — máx 30%</label>
                  <Input
                    type="number"
                    value={reseller.overValue}
                    onChange={(e) => {
                      const val = Math.max(0, Math.min(parseFloat(e.target.value) || 0, maxOverValue));
                      setReseller(prev => ({ ...prev, overValue: val }));
                    }}
                    min={0}
                    max={maxOverValue}
                    step={0.01}
                    className="bg-input border-border"
                    disabled={reseller.approvalStatus === 'Aprovado'}
                  />
                  {result && (
                    <span className="text-xs text-muted-foreground">
                      {result.overPercent.toFixed(1)}% do total (máx: R$ {formatCurrency(maxOverValue)})
                    </span>
                  )}
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Motivo da Comissão</label>
                  <Input
                    value={reseller.overReason}
                    onChange={(e) => setReseller(prev => ({ ...prev, overReason: e.target.value }))}
                    placeholder="Motivo"
                    className="bg-input border-border"
                    disabled={reseller.approvalStatus === 'Aprovado'}
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Observações</label>
                  <Input
                    value={reseller.observations}
                    onChange={(e) => setReseller(prev => ({ ...prev, observations: e.target.value }))}
                    placeholder="Observações"
                    className="bg-input border-border"
                    disabled={reseller.approvalStatus === 'Aprovado'}
                  />
                </div>
              </div>

              {/* Approval Section - Only shown when approvalRequired */}
              {reseller.approvalRequired && reseller.viewMode === 'INTERNO' && (
                <div className="mt-4 p-4 border border-yellow-500/50 bg-yellow-500/10 rounded-lg">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="w-5 h-5 text-yellow-500" />
                    <span className="text-sm font-medium text-yellow-500">Comissão acima de 20%: requer aprovação antes de gerar PDF e salvar.</span>
                  </div>
                  
                  <div className="grid md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">Aprovador *</label>
                      <Input
                        value={reseller.approver}
                        onChange={(e) => setReseller(prev => ({ ...prev, approver: e.target.value }))}
                        placeholder="Nome do aprovador"
                        className="bg-input border-border"
                        disabled={reseller.approvalStatus === 'Aprovado'}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">Status</label>
                      <div className={`flex items-center gap-2 px-3 py-2 rounded ${reseller.approvalStatus === 'Aprovado' ? 'bg-green-500/20 text-green-500' : 'bg-yellow-500/20 text-yellow-500'}`}>
                        {reseller.approvalStatus === 'Aprovado' ? <CheckCircle className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                        <span className="text-sm font-medium">{reseller.approvalStatus}</span>
                      </div>
                    </div>
                    <div className="flex items-end">
                      {reseller.approvalStatus !== 'Aprovado' && (
                        <Button onClick={handleApprove} className="w-full">
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Marcar como Aprovado
                        </Button>
                      )}
                      {reseller.approvalStatus === 'Aprovado' && reseller.approvedAt && (
                        <div className="text-xs text-muted-foreground">
                          Aprovado em: {new Date(reseller.approvedAt).toLocaleString('pt-BR')}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Approval pending message for CLIENT mode */}
              {isApprovalPending && reseller.viewMode === 'CLIENTE' && (
                <div className="mt-4 p-3 border border-red-500/50 bg-red-500/10 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-red-500" />
                    <span className="text-sm text-red-500">Aprovação pendente: alterne para modo PARCEIRO para aprovar.</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Summary */}
          <div className="lg:sticky lg:top-24 space-y-6">
            <div className="open-card">
              <h2 className="text-lg font-semibold text-foreground mb-4">Resumo</h2>

              {result && (
                <>
                  {/* Summary rows */}
                  <div className="space-y-2 max-h-[400px] overflow-y-auto mb-4">
                    {result.rows.map((row, idx) => (
                      <div key={idx} className="flex justify-between items-center text-sm py-1 border-b border-border/50">
                        <span className="text-muted-foreground">{row.label}</span>
                        <span className="text-foreground font-medium">{formatCurrencyBRL(row.subtotal)}</span>
                      </div>
                    ))}
                  </div>

                  {/* Subtotals */}
                  <div className="space-y-2 py-3 border-t border-border">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal Recursos</span>
                      <span className="text-foreground">{formatCurrencyBRL(result.subRec)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal IPs</span>
                      <span className="text-foreground">{formatCurrencyBRL(result.subIps)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal Serviços</span>
                      <span className="text-foreground">{formatCurrencyBRL(result.subServices)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal Backup</span>
                      <span className="text-foreground">{formatCurrencyBRL(result.subBackup)}</span>
                    </div>
                    {result.subKubernetes > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Subtotal Kubernetes</span>
                        <span className="text-foreground">{formatCurrencyBRL(result.subKubernetes)}</span>
                      </div>
                    )}
                    {result.subStorage > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Subtotal Storage</span>
                        <span className="text-foreground">{formatCurrencyBRL(result.subStorage)}</span>
                      </div>
                    )}
                    {result.discountValue > 0 && (
                      <div className="flex justify-between text-sm text-green-500">
                        <span>Desconto prazo ({(result.discountPct * 100).toFixed(0)}%)</span>
                        <span>-{formatCurrencyBRL(result.discountValue)}</span>
                      </div>
                    )}
                    {result.partnerDiscountValue && result.partnerDiscountValue > 0 && (
                      <div className="flex justify-between text-sm text-emerald-500">
                        <span>Desconto parceiro ({((result.partnerDiscountPct || 0) * 100).toFixed(0)}%)</span>
                        <span>-{formatCurrencyBRL(result.partnerDiscountValue)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Vigência</span>
                      <span className="text-foreground">{selectedTerm} {parseInt(selectedTerm) === 1 ? 'mês' : 'meses'}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Datacenter</span>
                      <span className="text-foreground">{datacenter}</span>
                    </div>
                  </div>

                  {/* Total */}
                  <div className="py-4 border-t border-border">
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-semibold text-foreground">TOTAL MENSAL</span>
                      <span className="text-2xl font-bold text-primary">{formatCurrencyBRL(result.grandTotal)}</span>
                    </div>
                  </div>

                  {/* Comissão Parceiro section - only in PARCEIRO mode */}
                  {reseller.viewMode === 'INTERNO' && result.overValue > 0 && (
                    <div className="py-3 border-t border-border space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Comissão Parceiro ({result.overPercent.toFixed(1)}%)</span>
                        <span className="text-amber-500 font-medium">+{formatCurrencyBRL(result.overValue)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-lg font-semibold text-foreground">TOTAL COM COMISSÃO</span>
                        <span className="text-2xl font-bold text-amber-500">{formatCurrencyBRL(result.totalWithOver)}</span>
                      </div>
                      {isApprovalPending && (
                        <div className="flex items-center gap-2 text-xs text-yellow-500 mt-2">
                          <AlertTriangle className="w-3 h-3" />
                          <span>Aprovação pendente (Comissão &gt; 20%)</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* GPU info */}
                  {result.gpuUsdTotal > 0 && (
                    <div className="text-xs text-muted-foreground py-2 border-t border-border">
                      GPU: USD {formatCurrency(result.gpuUsdTotal)} × {fx} = R$ {formatCurrency(result.gpuBrlTotal)}
                    </div>
                  )}
                </>
              )}

              {/* Actions */}
              <div className="space-y-2 pt-4 border-t border-border">
                {/* Commission checkbox - only show if there's commission configured */}
                {result && result.overValue > 0 && (
                  <div className="flex items-center gap-2 pb-2">
                    <input
                      type="checkbox"
                      id="includeCommission"
                      checked={includeCommissionInPdf}
                      onChange={(e) => setIncludeCommissionInPdf(e.target.checked)}
                      className="rounded border-border"
                    />
                    <label htmlFor="includeCommission" className="text-xs text-muted-foreground cursor-pointer">
                      Incluir comissão no PDF
                    </label>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="open-outline" onClick={handleSave} disabled={saving}>
                    {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                    {saving ? 'Salvando...' : 'Salvar'}
                  </Button>
                  <Button variant="open-outline" onClick={handleGeneratePDF}>
                    <FileDown className="w-4 h-4 mr-2" />
                    PDF
                  </Button>
                </div>
                <Button 
                  className="w-full" 
                  onClick={handleSendEmail}
                  disabled={sendingEmail || !client.email}
                >
                  {sendingEmail ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Mail className="w-4 h-4 mr-2" />
                  )}
                  Enviar por E-mail
                </Button>
                <Button variant="ghost" className="w-full text-muted-foreground" onClick={handleReset}>
                  Nova Proposta
                </Button>

                {/* Debug button - only visible in admin mode */}
                {isAdminMode && lastPayload && (
                  <Button
                    variant="ghost"
                    className="w-full text-xs text-muted-foreground/60 hover:text-muted-foreground"
                    onClick={() => {
                      navigator.clipboard.writeText(lastPayload);
                      toast({ title: 'Copiado!', description: 'Payload JSON copiado para a área de transferência' });
                    }}
                  >
                    <Bug className="w-3 h-3 mr-2" />
                    Copiar Payload (Debug)
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default OpenCalculator;
