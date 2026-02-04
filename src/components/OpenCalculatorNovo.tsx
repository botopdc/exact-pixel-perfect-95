import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import dayjs from "dayjs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  FileDown,
  Save,
  Plus,
  Minus,
  ChevronDown,
  ChevronUp,
  Trash2,
  Settings,
  Mail,
  Loader2,
  RefreshCw,
  Shield,
  Percent,
  Pencil,
} from "lucide-react";
import {
  useNavigate,
  Link as RouterLink,
  useLocation,
  useSearchParams,
} from "react-router-dom";

import ProductIcon from "./ProductIcon";
import { EditablePriceCell } from "./calculator/EditablePriceCell";
import { ArchitectSelector } from "./calculator/ArchitectSelector";
import {
  ServerItem,
  VMItem,
  BMItem,
  DiskItem,
  ClientInfo,
  ProposalMeta,
  AddonsState,
  SummaryRow,
  CalculationResult,
  KubernetesState,
  K8S_PLANS,
  K8sPlan,
  K8sPlanSpec,
  StorageItem,
  StorageRegion,
  StorageType,
  STORAGE_TYPE_LABELS,
  ResellerState,
  DEFAULT_RESELLER_STATE,
  OpenSaaSState,
  DEFAULT_OPEN_SAAS_STATE,
  PriceOverrideMap,
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
  isValidContractMonth,
  SUPPORT_LEVEL_LABELS,
  SupportLevel,
} from "@/lib/calculatorConfig";
import { useConfigWithFallback } from "@/hooks/useConfig";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useSaveProposal,
  SavedProposal,
  apiToLocal,
} from "@/hooks/useProposalsNovo";
import { useSavePartnerProposal } from "@/hooks/usePartnerProposals";
import { authService } from "@/services/authService";
import { partnerAuthService } from "@/services/partnersService";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle, Lock } from "lucide-react";
import {
  getPricingRules,
  isOverrideAllowed,
  getPartnerTypeDiscount,
  getPricingProfileLabel,
  canEditPriceMarkup,
  PricingRules,
} from "@/config/pricingRules";
import {
  normalizeProposalForEdit,
  normalizedToCalculatorItems,
} from "@/lib/proposalNormalizer";
import { openApi } from "@/lib/openApi";
import {
  setArchitectParticipant,
  removeArchitectParticipant,
  getArchitectParticipant,
} from "@/services/proposalParticipantService";
import { downloadProposalPdfFromApi } from "@/services/proposalPdfService";
import {
  dataCenters,
  proposalAcceptanceDays,
} from "@/data/calculator/calculator-config";
import { SectionTitle } from "./ui/section-title";
import { LabelSecondary } from "./ui/LabelSecondary";
import { useCalculatorConfig } from "@/hooks/useCalculatorConfig";
import { useForm, UseFormReturn } from "@/hooks/use-form";
import {
  CalculatorProposal,
  CalculatorProposalServer,
} from "@/data/calculator/calculator-proposal";
import { tw } from "@matheuscaetano/helprs";
import { InputWithLabel } from "./ui/input-with-label";
import { SelectWithLabel } from "./ui/select-with-label";
import { OpenCard } from "./ui/open-card";
import { ToggleOptions } from "./ui/toggle-options";

// User context for calculator
interface CalculatorUserContext {
  userLevel: number | null;
  partnerType: string | null;
  pricingRules: PricingRules;
  partnerDiscount: number;
  profileLabel: string;
}

type FormData = CalculatorProposal & {
  validityDays: number;
  addonSqlServer: string;
  addonSqlServerQty: number;
  planK8s?: number;
};

const OpenCalculator: React.FC = () => {
  const { toast } = useToast();
  const { ...cConfig } = useCalculatorConfig();
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const INITIAL_DATA: Partial<FormData> = {
    contract_duration: 12,
    datacenter: "SP1",
    validityDays: 7,
    channel_type: "PARCEIRO",
    addonSqlServer: cConfig.sqlNone?.key,
    addonSqlServerQty: 0,
    planK8s: null,
    servers: [
      {
        type: "vm",
        name: "VM #1",
        quantity: 1,
        specs: [
          { config_id: cConfig.ipPublico?.id || 0, quantity: 1 },
          { config_id: cConfig.vcpu?.id || 0, quantity: 16 },
          { config_id: cConfig.ram?.id || 0, quantity: 128 },
          { config_id: cConfig.nvme?.id || 0, quantity: 100 },
        ],
      },
    ],
    addons: [
      { config_id: cConfig.antivirus?.id || 0, quantity: 0 },
      { config_id: cConfig.tsplus?.id || 0, quantity: 0 },
      { config_id: cConfig.cal?.id || 0, quantity: 0 },
      { config_id: cConfig.firewall?.id || 0, quantity: 0 },
      { config_id: cConfig.sqlNone?.id || 0, quantity: 0 },
      { config_id: cConfig.veeamVm?.id || 0, quantity: 0 },
      { config_id: cConfig.veeamAgent?.id || 0, quantity: 0 },
      { config_id: cConfig.winserver2vcpuunid?.id || 0, quantity: 0 },
      { config_id: cConfig.consultoriaTecnica?.id || 0, quantity: 0 },
      { config_id: cConfig.dba?.id || 0, quantity: 0 },
    ],
  };
  const { ...form } = useForm<FormData>({
    initialData: INITIAL_DATA,
    onSubmit: async (data) => {
      console.clear();
      console.log(data);
    },
  });

  function getAddonValue(config: { id: number }) {
    return (
      form.data.addons?.find((a) => a.config_id === config?.id)?.quantity || 0
    );
  }

  function onAddonChange(
    e: React.ChangeEvent<HTMLInputElement>,
    config: { id: number },
  ) {
    form.setData({
      ...form.data,
      addons: form.data.addons.map((addon) =>
        addon.config_id === config.id
          ? { ...addon, quantity: parseInt(e.target.value) || 0 }
          : addon,
      ),
    });
  }

  function getServerSpecValue(index, config: { id: number }) {
    return (
      form.data.servers[index]?.specs.find((a) => a.config_id === config?.id)
        ?.quantity || 0
    );
  }

  function onServerSpecChange(
    e: React.ChangeEvent<HTMLInputElement>,
    index: number,
    config: { id: number },
  ) {
    form.setData({
      ...form.data,
      servers: form.data.servers.map((server, i) =>
        i === index
          ? {
              ...server,
              specs: server.specs.map((spec) =>
                spec.config_id === config.id
                  ? { ...spec, quantity: parseInt(e.target.value) || 0 }
                  : spec,
              ),
            }
          : server,
      ),
    });
  }

  // Define a data de vencimento da proposta sempre que o campo Validade mudar
  useEffect(() => {
    form.handleChange(
      dayjs().add(form.data.validityDays, "day").format("YYYY-MM-DD"),
      "due_at",
    );
  }, [form.data.validityDays]);

  // Faz o controle do addon SQL Server para enviar o payload correto para a API.
  useEffect(() => {
    const sqlConfig = cConfig.sqlConfigs.find(
      (c) => c?.key === form.data.addonSqlServer,
    );
    const ids = cConfig.sqlConfigs.map((c) => c?.id);
    form.setData({
      ...form.data,
      addons: form.data.addons.map((addon) =>
        ids.includes(addon.config_id)
          ? {
              ...addon,
              quantity:
                sqlConfig.key === cConfig.sqlNone?.key
                  ? 0
                  : form.data.addonSqlServerQty > 1
                    ? form.data.addonSqlServerQty
                    : 1,
              config_id: sqlConfig.id,
            }
          : addon,
      ),
    });
  }, [form.data.addonSqlServer, form.data.addonSqlServerQty]);

  // IA
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const {
    config,
    isLoading: configLoading,
    refetch: refetchConfig,
  } = useConfigWithFallback();

  // URL-based edit mode detection (edit=1&id=...)
  const urlEditParam = searchParams.get("edit");
  const urlIdParam = searchParams.get("id");
  const isUrlEditMode = urlEditParam === "1" && !!urlIdParam;

  // Track if we're loading the proposal for edit mode from API
  const [loadingEditProposal, setLoadingEditProposal] = useState(false);
  const [editModeError, setEditModeError] = useState<string | null>(null);
  const initializedEditModeRef = useRef(false);

  // Get user context (works for both internal users and partners)
  const userContext = useMemo((): CalculatorUserContext => {
    const isPartnerRoute = location.pathname.startsWith("/parceiro");

    // On partner routes, ALWAYS prefer partner session to avoid mixed-session bugs
    if (isPartnerRoute) {
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
    }

    // Internal routes: prefer internal auth
    const internalSession = authService.getSession();
    if (internalSession) {
      const partnerType = internalSession.apiUser?.partner?.type || null;
      const rules = getPricingRules(internalSession.level);
      return {
        userLevel: internalSession.level,
        partnerType,
        pricingRules: rules,
        partnerDiscount: rules.canApplyPartnerDiscounts
          ? getPartnerTypeDiscount(partnerType)
          : 0,
        profileLabel: getPricingProfileLabel(
          internalSession.level,
          partnerType || undefined,
        ),
      };
    }

    // If not internal (or internal missing), try partner auth (legacy / edge cases)
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
      profileLabel: "Visitante",
    };
  }, [location.pathname]);

  // SECURITY: Architects (level 690) cannot create or edit proposals
  const isArchitect = userContext.userLevel === 690;

  // Block architects from accessing calculator in edit mode
  useEffect(() => {
    if (isArchitect && isUrlEditMode) {
      toast({
        title: "Acesso restrito",
        description: "Arquitetos não podem editar propostas",
        variant: "destructive",
      });
      navigate("/modulos/comercial/propostas");
    }
  }, [isArchitect, isUrlEditMode, navigate, toast]);

  // Block architects from creating new proposals
  useEffect(() => {
    if (isArchitect && !isUrlEditMode) {
      toast({
        title: "Acesso restrito",
        description: "Arquitetos não podem criar propostas",
        variant: "destructive",
      });
      navigate("/modulos/comercial/propostas");
    }
  }, [isArchitect, isUrlEditMode, navigate, toast]);

  // =========================================================================
  // CRITICAL: Route-based state reset for CREATE mode
  // When navigating to /criar, MUST reset all edit-related state to prevent
  // accidentally sending PUT instead of POST for new proposals.
  // This runs on EVERY pathname change to ensure clean state transitions.
  // =========================================================================
  useEffect(() => {
    const isCreateRoute =
      location.pathname.includes("/criar") ||
      location.pathname.endsWith("/calculadora");
    const hasEditParams = urlEditParam === "1" && !!urlIdParam;

    // If we're on a create route WITHOUT edit params, force reset edit state
    if (isCreateRoute && !hasEditParams) {
      console.log(
        "[OpenCalculator] CREATE_ROUTE_DETECTED - Resetting edit state",
      );

      // Reset edit mode flags
      setIsEditMode(false);
      setEditingProposalId(null);
      initializedEditModeRef.current = false;

      // Reset initialized flag to allow fresh VM creation
      setInitialized(false);
    }
  }, [location.pathname, urlEditParam, urlIdParam]);

  // Determine if this is a partner context for saving
  const isPartnerContext = userContext.userLevel === 200;
  const partnerSession = isPartnerContext
    ? partnerAuthService.getSession()
    : null;

  // Use appropriate save mutation based on context
  const saveInternalProposalMutation = useSaveProposal();
  const savePartnerProposalMutation = useSavePartnerProposal();

  // State
  // FX is now fixed at 1 (all prices are in BRL)
  const fx = 1;
  const [selectedTerm, setSelectedTerm] = useState("1");
  const [datacenter, setDatacenter] = useState<"SP1" | "SP2" | "FL1" | "CE1">(
    "SP1",
  );
  const [client, setClient] = useState<ClientInfo>({
    name: "",
    company: "",
    phone: "",
    email: "",
  });
  // Collapsible sections state
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(
    new Set(),
  );
  // Generate stable proposal ID using nanoid-style UUID
  const [proposal, setProposal] = useState<ProposalMeta>(() => ({
    id: generateProposalId(),
    validityDays: 7,
    createdAt: new Date().toISOString(),
  }));
  const [items, setItems] = useState<ServerItem[]>([]);

  // Owner tracking for proposal persistence
  const getOwnerInfo = useCallback(() => {
    const internalSession = authService.getSession();
    const partnerSess = partnerAuthService.getSession();

    if (internalSession) {
      return {
        ownerUserId:
          internalSession.apiUser?.id?.toString() || internalSession.userId,
        ownerEmail: internalSession.apiUser?.email || internalSession.email,
        ownerName: internalSession.apiUser?.name || internalSession.name,
        ownerLevel: internalSession.level,
        ownerRole:
          internalSession.level >= 1000
            ? "ADMIN"
            : internalSession.level >= 750
              ? "GERENTE"
              : "EXECUTIVO",
      };
    }

    if (partnerSess) {
      return {
        ownerUserId: partnerSess.partnerId,
        ownerEmail: partnerSess.email || "",
        ownerName: partnerSess.empresa,
        ownerLevel: 200,
        ownerRole: "PARCEIRO",
      };
    }

    return {
      ownerUserId: "anonymous",
      ownerEmail: "",
      ownerName: "Visitante",
      ownerLevel: 0,
      ownerRole: "VISITANTE",
    };
  }, []);
  const [addons, setAddons] = useState<AddonsState>({
    backupPlan: "none",
    backupGb: 0,
    antivirus: 0,
    firewall: 0, // Changed from false to 0
    tsplus: 0,
    cal: 0,
    sql: "none",
    sqlQty: 0,
    veeamVm: 0,
    veeamAg: 0,
    winserver: 0,
    support: { level: "none", price: 0 },
    consulting: { quantity: 0, unitPrice: 200 },
    dba: { quantity: 0, unitPrice: 250 },
  });
  const [kubernetes, setKubernetes] = useState<KubernetesState>({
    enabled: false,
    plan: "k8s_small",
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
  const [reseller, setReseller] = useState<ResellerState>(
    DEFAULT_RESELLER_STATE,
  );
  const [openSaas, setOpenSaas] = useState<OpenSaaSState>(
    DEFAULT_OPEN_SAAS_STATE,
  );
  const [result, setResult] = useState<CalculationResult | null>(null);
  // Price overrides - manual markup adjustments per row (rowKey -> overrideTotal)
  const [priceOverrides, setPriceOverrides] = useState<PriceOverrideMap>({});
  // REMOVED: antivirusManuallySet - antivirus is now 100% user-controlled, no auto-sync
  const [sendingEmail, setSendingEmail] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [includeCommissionInPdf, setIncludeCommissionInPdf] = useState(true);
  const [observacao, setObservacao] = useState("");
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingProposalId, setEditingProposalId] = useState<string | null>(
    null,
  );
  // Architect participant (level 690) - null means no architect assigned
  const [selectedArchitectId, setSelectedArchitectId] = useState<number | null>(
    null,
  );

  // Check if user can edit prices (markup)
  const canEditMarkup = canEditPriceMarkup(userContext.userLevel);

  // Only show architect selector for internal users (not partners)
  const showArchitectSelector =
    !isPartnerContext && userContext.userLevel && userContext.userLevel >= 700;

  // FX is now fixed at 1 (removed - all prices are BRL)

  // Add VM
  const addVM = useCallback(() => {
    const newItem: VMItem = {
      type: "vm",
      id: crypto.randomUUID(),
      gpu: "Sem GPU",
      gpuQty: 0,
      vcpu: 16,
      ramGb: 128,
      nvmeTb: 0.09765625, // 100GB = 100/1024 TB (stored in TB for calculation compatibility)
      trafficTb: 5,
      ips: 1,
      qtyServers: 1,
    };
    setItems((prev) => [...prev, newItem]);
    setExpandedItems((prev) => new Set([...prev, newItem.id]));
  }, []);

  // Add BareMetal
  const addBM = useCallback(() => {
    if (
      !config?.baremetal?.cpu_models?.length ||
      !config?.baremetal?.ram_tiers?.length ||
      !config?.baremetal?.disks?.length
    ) {
      toast({
        title: "Erro",
        description: "Configuração de BareMetal não carregada",
        variant: "destructive",
      });
      return;
    }
    const newItem: BMItem = {
      type: "bm",
      id: crypto.randomUUID(),
      gpu: "Sem GPU",
      gpuQty: 0,
      bmCpu: config.baremetal.cpu_models[0].id,
      bmRam: config.baremetal.ram_tiers[0].id,
      disks: [{ type: config.baremetal.disks[0].id, qty: 1, desc: "" }],
      trafficTb: 5,
      ips: 1,
      qtyServers: 1,
    };
    setItems((prev) => [...prev, newItem]);
    setExpandedItems((prev) => new Set([...prev, newItem.id]));
  }, [config, toast]);

  // Add Storage
  const addStorage = useCallback(() => {
    const newItem: StorageItem = {
      id: crypto.randomUUID(),
      storageType: "sas",
      region: "BR",
      volumeTB: 1,
    };
    setStorageItems((prev) => [...prev, newItem]);
  }, []);

  // Remove Storage
  const removeStorage = useCallback((id: string) => {
    setStorageItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  // Update Storage
  const updateStorage = useCallback(
    (id: string, updates: Partial<StorageItem>) => {
      setStorageItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...updates } : item)),
      );
    },
    [],
  );

  // Remove item
  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
    setExpandedItems((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  // Update item
  const updateItem = useCallback((id: string, updates: Partial<ServerItem>) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? ({ ...item, ...updates } as ServerItem) : item,
      ),
    );
  }, []);

  // Add disk to BM
  const addDisk = useCallback(
    (itemId: string) => {
      if (!config?.baremetal?.disks?.length) return;
      setItems((prev) =>
        prev.map((item) => {
          if (item.id === itemId && item.type === "bm") {
            return {
              ...item,
              disks: [
                ...item.disks,
                { type: config.baremetal.disks[0].id, qty: 1, desc: "" },
              ],
            };
          }
          return item;
        }),
      );
    },
    [config],
  );

  // Remove disk from BM
  const removeDisk = useCallback((itemId: string, diskIndex: number) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id === itemId && item.type === "bm") {
          const disks = Array.isArray(item.disks) ? item.disks : [];
          if (disks.length > 1) {
            return {
              ...item,
              disks: disks.filter((_, i) => i !== diskIndex),
            };
          }
        }
        return item;
      }),
    );
  }, []);

  // Update disk in BM
  const updateDisk = useCallback(
    (itemId: string, diskIndex: number, updates: Partial<DiskItem>) => {
      setItems((prev) =>
        prev.map((item) => {
          if (item.id === itemId && item.type === "bm") {
            const disks = Array.isArray(item.disks) ? item.disks : [];
            return {
              ...item,
              disks: disks.map((disk, i) =>
                i === diskIndex ? { ...disk, ...updates } : disk,
              ),
            };
          }
          return item;
        }),
      );
    },
    [],
  );

  // Toggle expand
  const toggleExpand = useCallback((id: string) => {
    setExpandedItems((prev) => {
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
    setCollapsedSections((prev) => {
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
    let rowCounter = 0; // For generating unique row keys

    // Helper to safely convert any value to a number, defaulting to fallback
    const toNum = (val: any, fallback = 0): number => {
      if (val === undefined || val === null || val === "") return fallback;
      const parsed =
        typeof val === "string"
          ? parseFloat(val.replace(",", "."))
          : Number(val);
      return Number.isFinite(parsed) ? parsed : fallback;
    };

    // Helper to add row with markup support
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
        subtotal: finalTotal, // Use finalTotal for display and calculation
        baseUnitPrice: unitPrice,
        baseTotal,
        overrideTotal,
        finalTotal,
        rowKey,
      });

      return finalTotal; // Return finalTotal for subtotal calculations
    };

    items.forEach((item, idx) => {
      const qtyServers = Math.max(1, toNum(item.qtyServers, 1));
      const ips = Math.max(0, toNum(item.ips, 0));
      totalServers += qtyServers;
      const itemPrefix = item.type === "vm" ? `vm_${idx}` : `bm_${idx}`;

      if (item.type === "vm") {
        const vcpu = Math.max(1, toNum(item.vcpu, 1));
        const ramGb = Math.max(1, toNum(item.ramGb, 1));
        const nvmeTbVal = toNum(item.nvmeTb, 0);
        const nvmeGb = Math.max(0, nvmeTbVal) * 1024;

        // CPU
        const cpuPrice = toNum(config.vm_prices_brl.vcpu, 0);
        const cpuUnit = vcpu * cpuPrice;
        const cpuSub = cpuUnit * qtyServers;
        subRec += addRow(
          `VM #${idx + 1} — vCPU (${vcpu} por srv)`,
          qtyServers,
          cpuUnit,
          cpuSub,
          `${itemPrefix}_cpu`,
        );

        // RAM
        const ramPrice = toNum(config.vm_prices_brl.ram_per_gb, 0);
        const ramUnit = ramGb * ramPrice;
        const ramSub = ramUnit * qtyServers;
        subRec += addRow(
          `VM #${idx + 1} — RAM (${ramGb} GB por srv)`,
          qtyServers,
          ramUnit,
          ramSub,
          `${itemPrefix}_ram`,
        );

        // Disk
        const diskPrice = toNum(config.vm_prices_brl.nvme_per_gb, 0);
        const diskUnit = nvmeGb * diskPrice;
        const diskSub = diskUnit * qtyServers;
        subRec += addRow(
          `VM #${idx + 1} — NVMe (${nvmeTbVal.toFixed(2)} TB por srv)`,
          qtyServers,
          diskUnit,
          diskSub,
          `${itemPrefix}_disk`,
        );
      } else {
        // BareMetal
        const cpu =
          config.baremetal.cpu_models.find((c) => c.id === item.bmCpu) ||
          config.baremetal.cpu_models[0];
        const ram =
          config.baremetal.ram_tiers.find((r) => r.id === item.bmRam) ||
          config.baremetal.ram_tiers[0];

        if (cpu && ram) {
          // CPU
          const cpuSub = cpu.price * qtyServers;
          subRec += addRow(
            `BareMetal #${idx + 1} — CPU (${cpu.label})`,
            qtyServers,
            cpu.price,
            cpuSub,
            `${itemPrefix}_cpu`,
          );

          // RAM
          const ramSub = ram.price * qtyServers;
          subRec += addRow(
            `BareMetal #${idx + 1} — RAM (${ram.label})`,
            qtyServers,
            ram.price,
            ramSub,
            `${itemPrefix}_ram`,
          );
        }

        // Disks - safe iteration with null check
        let diskUnitTotal = 0;
        const itemDisks = Array.isArray(item.disks) ? item.disks : [];
        itemDisks.forEach((disk) => {
          const d =
            config.baremetal.disks.find((x) => x.id === disk.type) ||
            config.baremetal.disks[0];
          if (d) {
            diskUnitTotal += d.price * Math.max(1, disk.qty);
          }
        });
        if (diskUnitTotal > 0) {
          const diskSub = diskUnitTotal * qtyServers;
          subRec += addRow(
            `BareMetal #${idx + 1} — Discos NVMe`,
            qtyServers,
            diskUnitTotal,
            diskSub,
            `${itemPrefix}_disks`,
          );
        }
      }

      // IPs
      if (ips > 0) {
        const ipPrice = toNum(config.vm_prices_brl.ip_public, 0);
        const ipUnit = ips * ipPrice;
        const ipSub = ipUnit * qtyServers;
        subIps += addRow(
          `${item.type === "vm" ? "VM" : "BareMetal"} #${idx + 1} — IPs públicos (${ips} por srv)`,
          qtyServers,
          ipUnit,
          ipSub,
          `${itemPrefix}_ips`,
        );
      }

      // GPU - NOW DIRECT BRL (no FX conversion)
      const gpuQty =
        item.gpu === "Sem GPU"
          ? 0
          : Math.max(1, Math.min(8, toNum(item.gpuQty, 0)));
      const gpuBrlUnit = toNum(config.gpu_usd[item.gpu], 0); // Now directly BRL (despite the field name)
      if (gpuQty > 0 && gpuBrlUnit > 0) {
        const gpuBrlPerServer = gpuBrlUnit * gpuQty;
        const gpuBrl = gpuBrlPerServer * qtyServers;
        subRec += addRow(
          `${item.type === "vm" ? "VM" : "BareMetal"} #${idx + 1} — GPU (${item.gpu}, ${gpuQty}x por srv)`,
          qtyServers,
          gpuBrlPerServer,
          gpuBrl,
          `${itemPrefix}_gpu`,
        );
        gpuBrlTotal += gpuBrl;
      }
    });

    // REMOVED: Auto-set antivirus - now 100% user-controlled
    // Antivirus quantity is ONLY set by user input, never auto-synced with VM count

    // Services - using toNum for all pricing
    const antivirusQty = toNum(addons.antivirus, 0);
    if (antivirusQty > 0) {
      const unitPrice = toNum(config.addons_brl.antivirus_unit, 0);
      const st = unitPrice * antivirusQty;
      subServices += addRow(
        "Antivirus",
        antivirusQty,
        unitPrice,
        st,
        "svc_antivirus",
      );
    }
    const firewallQty = toNum(addons.firewall, 0);
    if (firewallQty > 0) {
      const unitPrice = toNum(config.addons_brl.firewall_pfsense, 0);
      const st = unitPrice * firewallQty;
      subServices += addRow(
        "Firewall (qtd)",
        firewallQty,
        unitPrice,
        st,
        "svc_firewall",
      );
    }
    const tsplusQty = toNum(addons.tsplus, 0);
    if (tsplusQty > 0) {
      const unitPrice = toNum(config.addons_brl.tsplus_unit, 0);
      const st = unitPrice * tsplusQty;
      subServices += addRow("TS PLUS", tsplusQty, unitPrice, st, "svc_tsplus");
    }
    const calQty = toNum(addons.cal, 0);
    if (calQty > 0) {
      const unitPrice = toNum(config.addons_brl.cal_unit, 0);
      const st = unitPrice * calQty;
      subServices += addRow("CAL / TS-CAL", calQty, unitPrice, st, "svc_cal");
    }
    const sqlQty = toNum(addons.sqlQty, 0);
    if (addons.sql !== "none" && sqlQty > 0) {
      const unitPrice = toNum(config.addons_brl.sql?.[addons.sql], 0);
      const st = unitPrice * sqlQty;
      subServices += addRow(
        `Licença SQL (${addons.sql.toUpperCase()})`,
        sqlQty,
        unitPrice,
        st,
        `svc_sql_${addons.sql}`,
      );
    }
    const veeamVmQty = toNum(addons.veeamVm, 0);
    if (veeamVmQty > 0) {
      const unitPrice = toNum(config.addons_brl.veeam_vm_unit, 0);
      const st = unitPrice * veeamVmQty;
      subServices += addRow(
        "Veeam Backup (VM)",
        veeamVmQty,
        unitPrice,
        st,
        "svc_veeam_vm",
      );
    }
    const veeamAgQty = toNum(addons.veeamAg, 0);
    if (veeamAgQty > 0) {
      const unitPrice = toNum(config.addons_brl.veeam_agent_unit, 0);
      const st = unitPrice * veeamAgQty;
      subServices += addRow(
        "Veeam Agent (Workstation)",
        veeamAgQty,
        unitPrice,
        st,
        "svc_veeam_agent",
      );
    }
    const winserverQty = toNum(addons.winserver, 0);
    if (winserverQty > 0) {
      const unitPrice = toNum(config.addons_brl.winserver_2vcpu_unit, 0);
      const st = unitPrice * winserverQty;
      subServices += addRow(
        "WinServer(2vCPU/unid.)",
        winserverQty,
        unitPrice,
        st,
        "svc_winserver",
      );
    }

    // NEW ADD-ONS: Suporte, Consultoria, DBA
    if (addons.support.level !== "none" && addons.support.price > 0) {
      const label = `Suporte ${SUPPORT_LEVEL_LABELS[addons.support.level as SupportLevel] || addons.support.level}`;
      subServices += addRow(
        label,
        1,
        addons.support.price,
        addons.support.price,
        "svc_support",
      );
    }

    const consultingQty = toNum(addons.consulting.quantity, 0);
    if (consultingQty > 0) {
      const unitPrice = toNum(addons.consulting.unitPrice, 200);
      const st = unitPrice * consultingQty;
      subServices += addRow(
        "Consultoria Técnica",
        `${consultingQty} h`,
        unitPrice,
        st,
        "svc_consulting",
      );
    }

    const dbaQty = toNum(addons.dba.quantity, 0);
    if (dbaQty > 0) {
      const unitPrice = toNum(addons.dba.unitPrice, 250);
      const st = unitPrice * dbaQty;
      subServices += addRow("DBA", `${dbaQty} h`, unitPrice, st, "svc_dba");
    }

    // Custom add-ons (dynamic from config)
    const standardAddonKeys = [
      "antivirus_unit",
      "firewall_pfsense",
      "tsplus_unit",
      "cal_unit",
      "sql",
      "veeam_vm_unit",
      "veeam_agent_unit",
      "winserver_2vcpu_unit",
      "support_basic",
      "support_intermediate",
      "support_advanced",
      "consulting_hours",
      "dba_hours",
    ];
    Object.entries(config.addons_brl).forEach(([key, price]) => {
      if (!standardAddonKeys.includes(key) && typeof price === "number") {
        const qty = toNum(addons.customAddons?.[key], 0);
        const unitPrice = toNum(price, 0);
        if (qty > 0 && unitPrice > 0) {
          const st = unitPrice * qty;
          const label = key
            .replace(/_/g, " ")
            .replace(/\b\w/g, (c) => c.toUpperCase());
          subServices += addRow(label, qty, unitPrice, st, `svc_custom_${key}`);
        }
      }
    });

    // Backup - with safe number conversion
    const backupGbQty = toNum(addons.backupGb, 0);
    let subBackup = 0;
    const backupBasePrice = calculateBackupPrice(
      config,
      addons.backupPlan,
      backupGbQty,
    );
    if (Number.isFinite(backupBasePrice) && backupBasePrice > 0) {
      const unit = backupBasePrice / Math.max(1, backupGbQty);
      subBackup = addRow(
        `Backup ${addons.backupPlan} dias`,
        `${backupGbQty} GB`,
        unit,
        backupBasePrice,
        `backup_${addons.backupPlan}`,
      );
    }

    // Kubernetes
    let subKubernetes = 0;
    if (kubernetes.enabled) {
      const planInfo = K8S_PLANS[kubernetes.plan];
      const basePriceMonthly = toNum(
        getK8sPlanBasePrice(kubernetes.plan, config),
        0,
      );
      subKubernetes += addRow(
        `Kubernetes Gerenciado — ${planInfo.shortLabel} (base)`,
        1,
        basePriceMonthly,
        basePriceMonthly,
        `k8s_base_${kubernetes.plan}`,
      );

      // K8s extras (additional resources using VM pricing)
      const extras = kubernetes.extras || { vcpu: 0, ramGB: 0, diskGB: 0 };
      const extrasVcpu = toNum(extras.vcpu, 0);
      const extrasRamGB = toNum(extras.ramGB, 0);
      const extrasDiskGB = toNum(extras.diskGB, 0);

      if (extrasVcpu > 0) {
        const vcpuPrice = toNum(config.vm_prices_brl.vcpu, 0);
        const vcpuCost = extrasVcpu * vcpuPrice;
        subKubernetes += addRow(
          `K8s — + ${extrasVcpu} vCPU adicional`,
          1,
          vcpuCost,
          vcpuCost,
          "k8s_extra_vcpu",
        );
      }
      if (extrasRamGB > 0) {
        const ramPrice = toNum(config.vm_prices_brl.ram_per_gb, 0);
        const ramCost = extrasRamGB * ramPrice;
        subKubernetes += addRow(
          `K8s — + ${extrasRamGB} GB RAM adicional`,
          1,
          ramCost,
          ramCost,
          "k8s_extra_ram",
        );
      }
      if (extrasDiskGB > 0) {
        const diskPrice = toNum(config.vm_prices_brl.nvme_per_gb, 0);
        const diskCost = extrasDiskGB * diskPrice;
        subKubernetes += addRow(
          `K8s — + ${extrasDiskGB} GB Disco adicional`,
          1,
          diskCost,
          diskCost,
          "k8s_extra_disk",
        );
      }

      // K8s add-ons (using configurable prices)
      if (kubernetes.addons.support_24x7) {
        const price = toNum(getK8sAddonPrice("support_24x7", config), 0);
        subKubernetes += addRow(
          "K8s — Suporte 24×7",
          1,
          price,
          price,
          "k8s_addon_support",
        );
      }
      if (kubernetes.addons.backup_velero) {
        const price = toNum(getK8sAddonPrice("backup_velero", config), 0);
        subKubernetes += addRow(
          "K8s — Backup (Velero)",
          1,
          price,
          price,
          "k8s_addon_backup",
        );
      }
      if (kubernetes.addons.dr_multisite) {
        const price = toNum(getK8sAddonPrice("dr_multisite", config), 0);
        subKubernetes += addRow(
          "K8s — DR multi-site",
          1,
          price,
          price,
          "k8s_addon_dr",
        );
      }
      if (kubernetes.addons.observability) {
        const price = toNum(getK8sAddonPrice("observability", config), 0);
        subKubernetes += addRow(
          "K8s — Observabilidade avançada",
          1,
          price,
          price,
          "k8s_addon_obs",
        );
      }
      if (kubernetes.addons.cicd_managed) {
        const price = toNum(getK8sAddonPrice("cicd_managed", config), 0);
        subKubernetes += addRow(
          "K8s — CI/CD gerenciado",
          1,
          price,
          price,
          "k8s_addon_cicd",
        );
      }
      const devopsHours = toNum(kubernetes.addons.devops_hours, 0);
      if (devopsHours > 0) {
        const price = toNum(getK8sAddonPrice("devops_hours", config), 0);
        const devopsSubtotal = devopsHours * price;
        subKubernetes += addRow(
          "K8s — Horas DevOps",
          devopsHours,
          price,
          devopsSubtotal,
          "k8s_addon_devops",
        );
      }
    }

    // Storage
    let subStorage = 0;
    storageItems.forEach((storage, idx) => {
      const storageType = storage.storageType || "sas";
      const typeLabel = STORAGE_TYPE_LABELS[storageType];

      if (storageType === "nvme") {
        // NVMe uses GB
        const volumeGB =
          toNum(storage.volumeGB, 0) || toNum(storage.volumeTB, 0) * 1024 || 1;
        if (volumeGB >= 1) {
          const pricePerGB = toNum(getNvmePricePerGB(config), 0);
          const monthlyTotal = volumeGB * pricePerGB;
          subStorage += addRow(
            `${typeLabel} — ${volumeGB} GB`,
            1,
            pricePerGB,
            monthlyTotal,
            `storage_${idx}_nvme`,
          );
        }
      } else {
        // SAS and S3 use TB (S3 uses same pricing as SAS)
        const volumeTB = toNum(storage.volumeTB, 0);
        if (volumeTB >= 1) {
          const pricePerTB = toNum(
            getStoragePricePerTB(volumeTB, storage.region, config, storageType),
            0,
          );
          const monthlyTotal = toNum(
            calculateStorageMonthly(
              volumeTB,
              storage.region,
              config,
              storageType,
            ),
            0,
          );
          const tierLabel = getStorageTierLabel(volumeTB);
          subStorage += addRow(
            `${typeLabel} ${storage.region} — ${volumeTB} TB (${tierLabel})`,
            1,
            pricePerTB,
            monthlyTotal,
            `storage_${idx}_${storageType}`,
          );
        }
      }
    });

    // OPEN SaaS (minimum 5 users enforced)
    let subOpenSaas = 0;
    const openSaasUsers = toNum(openSaas.users, 0);
    if (openSaas.enabled && openSaasUsers >= 5) {
      const pricePerUser = toNum(config.open_saas_price_per_user, 85);
      const users = Math.max(5, openSaasUsers); // Enforce minimum
      const monthlyTotal = users * pricePerUser;
      subOpenSaas = addRow(
        `OPEN SaaS — ${users} usuário(s) × R$ ${formatCurrency(pricePerUser)}/usuário`,
        users,
        pricePerUser,
        monthlyTotal,
        "open_saas",
      );
    }

    // Calculate subtotal (price list) before discount - ensure all are numbers
    const safeSubRec = Number.isFinite(subRec) ? subRec : 0;
    const safeSubIps = Number.isFinite(subIps) ? subIps : 0;
    const safeSubServices = Number.isFinite(subServices) ? subServices : 0;
    const safeSubBackup = Number.isFinite(subBackup) ? subBackup : 0;
    const safeSubKubernetes = Number.isFinite(subKubernetes)
      ? subKubernetes
      : 0;
    const safeSubStorage = Number.isFinite(subStorage) ? subStorage : 0;
    const safeSubOpenSaas = Number.isFinite(subOpenSaas) ? subOpenSaas : 0;

    const preTotal =
      safeSubRec +
      safeSubIps +
      safeSubServices +
      safeSubBackup +
      safeSubKubernetes +
      safeSubStorage +
      safeSubOpenSaas;
    const discountPct = toNum(config.discount[selectedTerm], 0);
    const discountValue = preTotal * discountPct;
    const grandTotalBeforePartner = preTotal - discountValue;

    // Apply partner discount if available (from userContext)
    const partnerDiscountPct = toNum(userContext.partnerDiscount, 0);
    const partnerDiscountValue = grandTotalBeforePartner * partnerDiscountPct;
    const grandTotal = grandTotalBeforePartner - partnerDiscountValue;

    // Calculate over values (reseller margin) - sem limite máximo
    const resellerOverValue = toNum(reseller.overValue, 0);
    const overValue = Math.max(0, resellerOverValue);
    const overPercent = grandTotal > 0 ? (overValue / grandTotal) * 100 : 0;
    const totalWithOver = grandTotal + overValue;

    // Update approval requirement based on overPercent and pricing rules
    const overrideCheck = isOverrideAllowed(overPercent, userContext.userLevel);
    const approvalRequired = overrideCheck.requiresApproval;
    if (approvalRequired !== reseller.approvalRequired) {
      setReseller((prev) => ({
        ...prev,
        approvalRequired,
        // Clear approval if no longer required
        ...(approvalRequired
          ? {}
          : {
              approvalStatus: "Pendente" as const,
              approver: "",
              approvedAt: null,
            }),
      }));
    }

    // Debug NaN detection - log if any subtotal is NaN
    if (
      !Number.isFinite(safeSubRec) ||
      !Number.isFinite(safeSubServices) ||
      !Number.isFinite(grandTotal)
    ) {
      console.warn("[Calculator] NaN detected in calculation:", {
        subRec,
        subIps,
        subServices,
        subBackup,
        subKubernetes,
        subStorage,
        subOpenSaas,
        grandTotal,
        preTotal,
        discountPct,
        discountValue,
      });
    }

    setResult({
      rows,
      subRec: safeSubRec,
      subIps: safeSubIps,
      subServices: safeSubServices,
      subBackup: safeSubBackup,
      subKubernetes: safeSubKubernetes,
      subStorage: safeSubStorage,
      subOpenSaas: safeSubOpenSaas,
      discountPct: Number.isFinite(discountPct) ? discountPct : 0,
      discountValue: Number.isFinite(discountValue) ? discountValue : 0,
      grandTotal: Number.isFinite(grandTotal) ? grandTotal : 0,
      totalServers,
      gpuUsdTotal: Number.isFinite(gpuUsdTotal) ? gpuUsdTotal : 0,
      gpuBrlTotal: Number.isFinite(gpuBrlTotal) ? gpuBrlTotal : 0,
      subtotalPriceList: Number.isFinite(grandTotalBeforePartner)
        ? grandTotalBeforePartner
        : 0,
      overValue: Number.isFinite(overValue) ? overValue : 0,
      overPercent: Number.isFinite(overPercent) ? overPercent : 0,
      totalWithOver: Number.isFinite(totalWithOver) ? totalWithOver : 0,
      partnerDiscountPct: Number.isFinite(partnerDiscountPct)
        ? partnerDiscountPct
        : 0,
      partnerDiscountValue: Number.isFinite(partnerDiscountValue)
        ? partnerDiscountValue
        : 0,
    });
  }, [
    items,
    addons,
    kubernetes,
    storageItems,
    openSaas,
    selectedTerm,
    config,
    reseller.overValue,
    reseller.approvalRequired,
    userContext,
    priceOverrides,
  ]);

  // Recalculate on changes
  useEffect(() => {
    calculate();
  }, [calculate]);

  // Helper function to apply normalized state to calculator
  const applyNormalizedState = useCallback(
    (
      normalized: ReturnType<typeof normalizeProposalForEdit>,
      displayId: string,
    ) => {
      console.log("[OpenCalculator] EDIT_MODE_HYDRATION_COMPLETE:", {
        vmCount: normalized.vmItems.length,
        bmCount: normalized.baremetalItems.length,
        storageCount: normalized.storageItems.length,
        kubernetesEnabled: normalized.kubernetes.enabled,
        openSaasEnabled: normalized.openSaas.enabled,
        openSaasUsers: normalized.openSaas.users,
        selectedTerm: normalized.selectedTerm,
        addons: normalized.addons,
        priceOverrides: Object.keys(normalized.priceOverrides).length,
        grandTotal: normalized.totals.grandTotal,
      });

      // Apply normalized state to calculator
      // FX is now fixed at 1, no need to restore it
      setSelectedTerm(normalized.selectedTerm);
      setDatacenter(normalized.datacenter);
      setClient(normalized.client);
      setProposal(normalized.proposal);

      // Merge VM and BM items into single items array
      // CRITICAL: Do NOT create default BareMetal when there are no servers
      const allItems = normalizedToCalculatorItems(normalized);
      setItems(allItems);

      setAddons(normalized.addons);
      setKubernetes(normalized.kubernetes);
      setStorageItems(normalized.storageItems);
      setReseller(normalized.reseller);
      setOpenSaas(normalized.openSaas);
      setPriceOverrides(normalized.priceOverrides);
      setObservacao(normalized.observacao);

      // Load architect participant from dados_proposta if present
      const savedArchitectId = (normalized as any).selectedArchitectId ?? null;
      setSelectedArchitectId(savedArchitectId);

      // Expand all loaded items
      const allItemIds = allItems.map((item: any) => item.id);
      setExpandedItems(new Set(allItemIds));

      // Mark as edit mode with API numeric ID (critical for updates)
      setIsEditMode(true);
      setEditingProposalId(normalized.apiId ? String(normalized.apiId) : null);

      // If we have an apiId but no architect from dados_proposta, try loading from proposal_participants
      const proposalId = normalized.apiId ? String(normalized.apiId) : null;
      if (proposalId && !savedArchitectId) {
        getArchitectParticipant(proposalId)
          .then((participant) => {
            if (participant) {
              console.log(
                "[OpenCalculator] Loaded architect from participants:",
                participant.external_user_id,
              );
              setSelectedArchitectId(participant.external_user_id);
            }
          })
          .catch((err) => {
            console.warn(
              "[OpenCalculator] Could not load architect participant:",
              err,
            );
          });
      }

      console.log("[OpenCalculator] EDIT_MODE activated:", {
        apiNumericId: normalized.apiId,
        displayId,
        isEditMode: true,
        hydratedItemsCount: allItems.length,
        storageCount: normalized.storageItems.length,
        kubernetesEnabled: normalized.kubernetes.enabled,
        openSaasEnabled: normalized.openSaas.enabled,
        openSaasUsers: normalized.openSaas.users,
        selectedArchitectId: savedArchitectId,
      });

      setInitialized(true);

      // Clear the navigation state to prevent re-loading on refresh
      window.history.replaceState({}, document.title);

      toast({
        title: "Proposta carregada",
        description: `Editando proposta ${displayId}`,
      });
    },
    [toast],
  );

  // CRITICAL: Reset state when route changes from edit to create
  // This ensures that navigating from edit mode back to /criar starts fresh
  useEffect(() => {
    // If we're NOT in URL edit mode (no edit=1 param), ALWAYS reset edit state
    // This prevents stale edit state from causing PUT instead of POST
    if (!isUrlEditMode) {
      // Always reset edit mode flags when on create route
      if (isEditMode || editingProposalId) {
        console.log(
          "[OpenCalculator] Resetting edit state for new proposal creation",
        );
        setIsEditMode(false);
        setEditingProposalId(null);
      }
      // Only reset items if we were previously initialized (meaning we came from edit mode)
      if (initializedEditModeRef.current) {
        console.log("[OpenCalculator] Full state reset for new proposal");
        initializedEditModeRef.current = false;
        setInitialized(false);
        // Reset items to trigger addVM in the main initialization effect
        setItems([]);
      }
    }
  }, [isUrlEditMode, isEditMode, editingProposalId]);

  // MAIN INITIALIZATION: Add initial VM OR load proposal for editing
  // CRITICAL: This effect is now URL-based (edit=1&id=...) and self-sufficient
  useEffect(() => {
    if (configLoading) return;

    // Prevent duplicate initialization
    if (initializedEditModeRef.current) return;

    // CASE 1: URL-based edit mode (edit=1&id=...)
    // This is the PRIMARY source of truth for edit mode
    if (isUrlEditMode && urlIdParam) {
      console.log("[OpenCalculator] EDIT_MODE_DETECTED via URL:", {
        edit: urlEditParam,
        id: urlIdParam,
      });

      // Check if we have proposal data from navigation state (optimization)
      const editProposalFromState = location.state?.editProposal;

      if (editProposalFromState) {
        // We have proposal data from navigation - use it directly
        console.log("[OpenCalculator] PROPOSAL_LOADED_FROM_STATE");
        initializedEditModeRef.current = true;

        const normalized = normalizeProposalForEdit(editProposalFromState);
        applyNormalizedState(normalized, normalized.displayId);
      } else {
        // NO state data - MUST fetch from API
        console.log(
          "[OpenCalculator] FETCHING_FULL_PROPOSAL from API:",
          urlIdParam,
        );
        initializedEditModeRef.current = true;
        setLoadingEditProposal(true);
        setEditModeError(null);

        // Fetch complete proposal from API
        const fetchProposal = async () => {
          try {
            const fullProposal = await openApi.getProposal(urlIdParam);

            // Detailed logging for debugging dados_proposta issues
            const rawDadosProposta = (fullProposal as any)?.dados_proposta;
            const parsedDadosProposta =
              typeof rawDadosProposta === "string"
                ? (() => {
                    try {
                      return JSON.parse(rawDadosProposta);
                    } catch {
                      return null;
                    }
                  })()
                : rawDadosProposta;

            console.log("[OpenCalculator] PROPOSAL_LOADED_FROM_API:", {
              id: (fullProposal as any)?.id,
              hasDadosProposta: Boolean(parsedDadosProposta),
              dadosPropostaType: typeof rawDadosProposta,
              dadosPropostaKeys: parsedDadosProposta
                ? Object.keys(parsedDadosProposta)
                : [],
              hasStorageItems: Boolean(
                parsedDadosProposta?.storageItems?.length,
              ),
              hasKubernetes: Boolean(parsedDadosProposta?.kubernetes?.enabled),
              hasOpenSaas: Boolean(parsedDadosProposta?.openSaas?.enabled),
              hasAddons: Boolean(parsedDadosProposta?.addons),
              addonsCount: (fullProposal as any)?.addons?.length || 0,
              serversCount: (fullProposal as any)?.servers?.length || 0,
            });

            // Convert API response to local format
            // apiToLocal will handle both new format (dados_proposta) and legacy format (addons[])
            const localProposal = apiToLocal(fullProposal as any);

            // Log the converted proposal to verify reconstruction
            console.log("[OpenCalculator] CONVERTED_LOCAL_PROPOSAL:", {
              storageItemsCount: localProposal.storageItems?.length || 0,
              kubernetesEnabled: Boolean(
                (localProposal.kubernetes as any)?.enabled,
              ),
              openSaasEnabled: Boolean(
                (localProposal.openSaas as any)?.enabled,
              ),
              openSaasUsers: (localProposal.openSaas as any)?.users || 0,
              addons: localProposal.addons,
              itemsCount: localProposal.items?.length || 0,
            });

            // Normalize for calculator (cast to Record for normalizer compatibility)
            const normalized = normalizeProposalForEdit(
              localProposal as unknown as Record<string, unknown>,
            );

            applyNormalizedState(normalized, normalized.displayId);
          } catch (error: any) {
            console.error("[OpenCalculator] ERROR fetching proposal:", error);
            setEditModeError(
              error.response?.data?.message ||
                error.message ||
                "Erro ao carregar proposta",
            );
            toast({
              title: "Erro ao carregar proposta",
              description:
                error.response?.data?.message ||
                "Não foi possível carregar os dados da proposta.",
              variant: "destructive",
            });
            // Reset to allow creating new proposal
            setInitialized(true);
          } finally {
            setLoadingEditProposal(false);
          }
        };

        fetchProposal();
      }

      return;
    }

    // CASE 2: New proposal (no edit mode)
    // CRITICAL: Explicitly reset edit mode state when creating a new proposal
    // This prevents residual state from previous edit sessions causing PUT instead of POST
    if (!initialized && items.length === 0) {
      // Ensure we're in CREATE mode, not EDIT mode
      setIsEditMode(false);
      setEditingProposalId(null);

      // Only add default VM for NEW proposals, not edits
      // Do NOT create default BareMetal when editing proposals without servers
      addVM();
      setInitialized(true);
    }
  }, [
    configLoading,
    initialized,
    items.length,
    addVM,
    location.state,
    toast,
    isUrlEditMode,
    urlIdParam,
    urlEditParam,
    applyNormalizedState,
  ]);

  // Check if approval is required and pending
  const isApprovalPending =
    reseller.approvalRequired && reseller.approvalStatus !== "Aprovado";

  // Check if a VM item has at least one resource defined (not completely empty)
  // A VM is valid if it has: vCPU > 0 OR RAM > 0 OR NVMe > 0 OR IPs > 0 OR GPU selected OR trafficTb > 0
  const isVMValid = useCallback((item: ServerItem): boolean => {
    if (item.type !== "vm") return true; // Non-VM items are always valid here
    const vm = item as VMItem;
    const hasVcpu = (vm.vcpu ?? 0) > 0;
    const hasRam = (vm.ramGb ?? 0) > 0;
    const hasNvme = (vm.nvmeTb ?? 0) > 0;
    const hasIps = (vm.ips ?? 0) > 0;
    const hasTraffic = (vm.trafficTb ?? 0) > 0;
    const hasGpu = vm.gpu && vm.gpu !== "Sem GPU";
    return hasVcpu || hasRam || hasNvme || hasIps || hasTraffic || hasGpu;
  }, []);

  // Get list of empty VM items (for validation error messages)
  const getEmptyVMItems = useCallback((): { index: number; id: string }[] => {
    return items
      .map((item, index) => ({ item, index, id: item.id }))
      .filter(({ item }) => item.type === "vm" && !isVMValid(item))
      .map(({ index, id }) => ({ index: index + 1, id })); // 1-indexed for display
  }, [items, isVMValid]);

  // Check if there's at least one sellable item (servers OR any product/addon)
  // IMPORTANT: Storage, Kubernetes, OPEN SaaS are now independent products that DON'T require VM/BM
  const hasAnyItem = useCallback(() => {
    // Core products (servers) - VMs must be valid (not empty)
    const hasValidVM = items.some((i) => i.type === "vm" && isVMValid(i));
    const hasBareMetal = items.some((i) => i.type === "bm");

    // Independent products (don't require servers)
    const hasKubernetes = kubernetes.enabled;
    const hasStorage = storageItems.some((s) => s.volumeTB >= 1);
    const hasOpenSaaS = openSaas.enabled && openSaas.users >= 5;

    // Add-ons (also considered valid items for saving)
    const hasAddons =
      addons.backupPlan !== "none" ||
      addons.backupGb > 0 ||
      addons.antivirus > 0 ||
      addons.firewall ||
      addons.tsplus > 0 ||
      addons.cal > 0 ||
      addons.sql !== "none" ||
      addons.veeamVm > 0 ||
      addons.veeamAg > 0;

    return (
      hasValidVM ||
      hasBareMetal ||
      hasKubernetes ||
      hasStorage ||
      hasOpenSaaS ||
      hasAddons
    );
  }, [
    items,
    kubernetes.enabled,
    storageItems,
    openSaas.enabled,
    openSaas.users,
    addons,
    isVMValid,
  ]);

  // Save proposal via API
  const handleSave = async () => {
    if (!client.name.trim() && !client.company.trim()) {
      toast({
        title: "Erro",
        description: "Informe o nome do cliente ou empresa",
        variant: "destructive",
      });
      return;
    }
    // Validate: check for empty VM items first
    const emptyVMs = getEmptyVMItems();
    if (emptyVMs.length > 0) {
      const vmNumbers = emptyVMs.map((v) => `#${v.index}`).join(", ");
      toast({
        title: "VM sem recursos",
        description: `VM ${vmNumbers} está sem nenhum recurso selecionado. Defina pelo menos um upgrade (vCPU, RAM, disco, IP ou GPU) ou remova o item.`,
        variant: "destructive",
      });
      return;
    }

    // Validate: at least one item (server, product, or addon) must exist
    if (!hasAnyItem()) {
      toast({
        title: "Erro",
        description:
          "Adicione ao menos 1 item (Servidor, Storage, Kubernetes, OPEN SaaS ou Serviço) para salvar a proposta.",
        variant: "destructive",
      });
      return;
    }
    // Block save if approval is pending
    if (isApprovalPending) {
      toast({
        title: "Aprovação pendente",
        description:
          "Preencha o Aprovador e marque como aprovado antes de salvar.",
        variant: "destructive",
      });
      return;
    }

    // DEBUG: Log save operation mode + ownership context
    const numericApiId = editingProposalId
      ? parseInt(editingProposalId, 10)
      : null;
    const internalSession = authService.getSession();
    const partnerSess = partnerAuthService.getSession();
    console.log("[OpenCalculator] handleSave:", {
      mode: isEditMode ? "EDIT" : "CREATE",
      route: location.pathname,
      editingProposalId,
      numericApiId,
      displayProposalId: proposal.id,
      total: result?.grandTotal,
      inferred_user_level: userContext.userLevel,
      internal_session_level: internalSession?.level ?? null,
      partner_session_partnerId: partnerSess?.partnerId ?? null,
      intended_channel_type: isPartnerContext ? "PARCEIRO" : "CLIENTE",
    });

    // Validate contract term before saving
    if (!isValidContractMonth(selectedTerm)) {
      console.error(
        "[OpenCalculator] INVALID selectedTerm before save:",
        selectedTerm,
      );
      toast({
        title: "Erro",
        description: "Vigência inválida selecionada.",
        variant: "destructive",
      });
      return;
    }
    console.log("[OpenCalculator] Saving with selectedTerm=", selectedTerm);

    setSaving(true);
    try {
      // Get owner info for tracking
      const ownerInfo = getOwnerInfo();

      // Build complete draftState - this is the SOURCE OF TRUTH for proposal data
      const draftState = {
        fx,
        selectedTerm, // Validated above
        datacenter,
        client,
        proposal,
        items, // Complete items array with all VM/BM details
        addons, // Complete addons object
        kubernetes, // Complete kubernetes state
        storageItems, // Complete storage items
        reseller, // Complete reseller state
        openSaas, // Complete OpenSaaS state
        priceOverrides, // Manual price adjustments (markup)
        result, // Computed result for reference
        observacao: observacao.trim() || undefined,
        selectedArchitectId, // Architect participant for commission tracking
        // Owner tracking (required for persistence)
        created_by_user_id: ownerInfo.ownerUserId,
        created_by_email: ownerInfo.ownerEmail,
        created_by_name: ownerInfo.ownerName,
        created_by_level: ownerInfo.ownerLevel,
        created_by_role: ownerInfo.ownerRole,
      };

      if (isPartnerContext && partnerSession) {
        // Partner context: use partner proposal hook
        // For EDIT mode, use PROP-{numericId} format so the hook detects update
        const propostaId =
          isEditMode && numericApiId ? `PROP-${numericApiId}` : proposal.id;

        const partnerProposalData = {
          proposta_id: propostaId,
          cliente_nome: client.name || client.company || "",
          cliente_email: client.email,
          valor_total: result?.grandTotal || 0,
          status_proposta: "Rascunho" as const,
          dados_proposta: draftState, // Use complete draftState
        };

        const saveResult =
          await savePartnerProposalMutation.mutateAsync(partnerProposalData);
        const partnerApiId = saveResult.data?.api_id;
        console.log("[OpenCalculator] Partner save result:", {
          isUpdate: saveResult.isUpdate,
          id: partnerApiId,
        });
        // Note: Partner proposals don't include PDF in the same request yet (separate flow)
      } else {
        // Internal context: use internal proposal hook
        // For EDIT mode, pass the API numeric ID so the hook performs UPDATE
        const proposalData: SavedProposal = {
          id: numericApiId || undefined, // CRITICAL: API numeric ID for update detection
          ...draftState, // Spread complete draftState
          total: result?.grandTotal || 0,
          savedAt: new Date().toISOString(),
        };

        // Generate PDF blob to send along with the proposal data
        let pdfBlob: Blob | undefined;
        try {
          console.log(
            "[OpenCalculator] Generating PDF blob for proposal save...",
          );
          const { generateOpenPDFBlob } = await import("@/lib/pdfGenerator");
          const pdfResult = await generateOpenPDFBlob({
            client,
            proposal,
            result: result!,
            selectedTerm,
            datacenter,
            reseller,
            includeCommission: includeCommissionInPdf,
            observacao: observacao.trim() || undefined,
          });
          pdfBlob = pdfResult.blob;
          console.log("[OpenCalculator] PDF blob generated:", {
            size: pdfBlob.size,
          });
        } catch (pdfError) {
          console.warn(
            "[OpenCalculator] Failed to generate PDF blob, will save without file:",
            pdfError,
          );
          // Don't fail the save if PDF generation fails
        }

        // Save proposal with PDF file attached in the same request
        const saveResult = await saveInternalProposalMutation.mutateAsync({
          proposal: proposalData,
          pdfBlob,
        });
        const savedData = saveResult.data as { id?: number } | undefined;
        console.log("[OpenCalculator] Internal save result:", {
          isUpdate: saveResult.isUpdate,
          id: savedData?.id,
          hadPdf: !!pdfBlob,
        });

        // After successful save, update editingProposalId with the returned ID (for new proposals)
        const savedProposalId = savedData?.id
          ? String(savedData.id)
          : editingProposalId;
        if (!isEditMode && savedData?.id) {
          setIsEditMode(true);
          setEditingProposalId(String(savedData.id));
        }

        // Link or unlink architect participant after proposal is saved
        if (savedProposalId) {
          try {
            if (selectedArchitectId) {
              await setArchitectParticipant(
                savedProposalId,
                selectedArchitectId,
              );
              console.log("[OpenCalculator] Architect linked:", {
                proposalId: savedProposalId,
                architectId: selectedArchitectId,
              });
            } else {
              // If architect was removed, unlink from proposal
              await removeArchitectParticipant(savedProposalId);
              console.log(
                "[OpenCalculator] Architect unlinked from proposal:",
                savedProposalId,
              );
            }
          } catch (architectError) {
            console.warn(
              "[OpenCalculator] Failed to update architect participant:",
              architectError,
            );
            // Don't fail the save operation if architect linking fails
          }
        }
      }

      const toastTitle = isEditMode ? "Proposta atualizada" : "Proposta salva";
      const toastDesc = isEditMode
        ? `Proposta ${proposal.id} atualizada com sucesso`
        : `Proposta ${proposal.id} salva com sucesso`;
      toast({ title: toastTitle, description: toastDesc });
    } catch (error: any) {
      console.error("Error saving proposal:", error);

      // Handle 401 specifically for better UX
      const is401 =
        error.response?.status === 401 || error.message?.includes("401");
      toast({
        title: is401 ? "Sessão expirada" : "Erro ao salvar",
        description: is401
          ? "Faça login novamente para continuar."
          : error.message || "Tente novamente mais tarde",
        variant: "destructive",
      });

      // Redirect to login if 401 in partner context
      if (is401 && isPartnerContext) {
        navigate("/parceiro/login");
      }
    } finally {
    }
  };

  // Generate/Download PDF
  const handleGeneratePDF = async () => {
    if (!hasAnyItem()) {
      toast({
        title: "Erro",
        description:
          "Adicione ao menos 1 item (Servidor, Storage, Kubernetes, OPEN SaaS ou Serviço) para gerar o PDF.",
        variant: "destructive",
      });
      return;
    }
    // Block PDF if approval is pending
    if (isApprovalPending) {
      toast({
        title: "Aprovação pendente",
        description:
          "Preencha o Aprovador e marque como aprovado antes de gerar o PDF.",
        variant: "destructive",
      });
      return;
    }

    // If proposal is saved, try to download from API first
    if (editingProposalId) {
      console.log(
        "[OpenCalculator] Proposal saved, attempting API download:",
        editingProposalId,
      );
      const apiResult = await downloadProposalPdfFromApi(editingProposalId);

      if (apiResult.success) {
        toast({
          title: "PDF baixado",
          description: "O download do PDF foi iniciado",
        });
        return;
      }

      // If API download fails, fall through to local generation with a warning
      console.warn(
        "[OpenCalculator] API download failed, generating locally:",
        apiResult.error,
      );
    }

    // Fallback: Generate PDF locally (for unsaved proposals or when API fails)
    console.log("[OpenCalculator] Generating PDF locally");
    const { generateOpenPDF } = await import("@/lib/pdfGenerator");
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
    toast({
      title: "PDF gerado",
      description: "O download do PDF foi iniciado",
    });
  };

  // Send by email via edge function - uses canonical approval link with token
  const handleSendEmail = async () => {
    if (!client.email?.trim()) {
      toast({
        title: "Erro",
        description: "Informe o e-mail do cliente para enviar a proposta",
        variant: "destructive",
      });
      return;
    }
    if (!hasAnyItem()) {
      toast({
        title: "Erro",
        description:
          "Adicione ao menos 1 item (Servidor, Storage, Kubernetes, OPEN SaaS ou Serviço) para enviar a proposta.",
        variant: "destructive",
      });
      return;
    }

    // First save to ensure we have a valid proposal ID
    await handleSave();
    setSendingEmail(true);

    const validityDateStr = getValidityDate(
      proposal.createdAt,
      proposal.validityDays,
    ).toLocaleDateString("pt-BR");

    try {
      // CRITICAL: Get canonical approval link with token
      console.log("[OpenCalculator] Fetching approval link for email send...");
      const { buildApprovalLinkFromId } =
        await import("@/services/approvalLinkService");

      // Get the saved proposal ID - editingProposalId is set after handleSave() completes
      const proposalApiId = editingProposalId || proposal.id;

      if (!proposalApiId) {
        throw new Error("Proposta precisa ser salva antes de enviar por email");
      }

      let proposalLink: string;
      try {
        const result = await buildApprovalLinkFromId(proposalApiId);
        proposalLink = result.link;
        console.log("[OpenCalculator] Got canonical approval link for email");
      } catch (linkError: any) {
        console.error(
          "[OpenCalculator] Failed to get approval link:",
          linkError,
        );
        toast({
          title: "Erro ao gerar link",
          description:
            linkError.message || "Não foi possível gerar link de aprovação",
          variant: "destructive",
        });
        setSendingEmail(false);
        return;
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(
        `${supabaseUrl}/functions/v1/send-proposal-email`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientName: client.name || client.company || "Cliente",
            clientEmail: client.email,
            proposalId: proposal.id,
            proposalLink, // Now uses canonical link with token
            totalValue: `R$ ${formatCurrency(result?.grandTotal || 0)}`,
            validityDate: validityDateStr,
          }),
        },
      );

      const resultData = await response.json();

      if (!response.ok || !resultData.success) {
        throw new Error(resultData.error || "Falha ao enviar email");
      }

      toast({
        title: "Email enviado!",
        description: `Proposta enviada para ${client.email}`,
      });
    } catch (error: any) {
      toast({
        title: "Erro ao enviar email",
        description: error.message || "Falha ao enviar email",
        variant: "destructive",
      });
    } finally {
      setSendingEmail(false);
    }
  };

  // Handle price override change from EditablePriceCell
  const handleOverrideChange = useCallback(
    (rowIndex: number, newTotal: number | null, rowKey?: string) => {
      if (!rowKey) return;
      setPriceOverrides((prev) => {
        const next = { ...prev };
        if (newTotal === null) {
          delete next[rowKey];
        } else {
          next[rowKey] = newTotal;
        }
        return next;
      });
    },
    [],
  );

  // Add OPEN SaaS (only 1 allowed) - starts with minimum 5 users
  const addOpenSaas = useCallback(() => {
    if (openSaas.enabled) {
      // Already enabled, scroll to section or focus
      toast({
        title: "OPEN SaaS já adicionado",
        description: "Você só pode adicionar 1 OPEN SaaS por proposta.",
      });
      return;
    }
    setOpenSaas({ enabled: true, users: 5 });
  }, [openSaas.enabled, toast]);

  // Handle marking as approved
  const handleApprove = () => {
    if (!reseller.approver.trim()) {
      toast({
        title: "Erro",
        description: "Informe o nome do Aprovador",
        variant: "destructive",
      });
      return;
    }
    setReseller((prev) => ({
      ...prev,
      approvalStatus: "Aprovado",
      approvedAt: new Date().toISOString(),
    }));
    toast({ title: "Aprovado", description: "Proposta marcada como aprovada" });
  };

  // Loading state - check both configLoading AND config existence
  // This ensures we don't render the calculator UI until config is fully loaded
  // Also check if we're loading a proposal for edit mode
  if (configLoading || !config || loadingEditProposal) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <span className="text-2xl font-bold tracking-wide text-foreground">
              OPEN — Calculadora VM + BareMetal
            </span>
            <Skeleton className="h-10 w-32" />
          </div>
        </header>
        <main className="container mx-auto px-4 py-6">
          <div className="grid lg:grid-cols-[1.15fr_0.85fr] gap-6">
            <div className="space-y-6">
              {loadingEditProposal ? (
                <>
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Carregando proposta para edição...</span>
                  </div>
                  <Skeleton className="h-64 w-full" />
                  <Skeleton className="h-48 w-full" />
                </>
              ) : (
                <>
                  <Skeleton className="h-8 w-96" />
                  <Skeleton className="h-64 w-full" />
                  <Skeleton className="h-48 w-full" />
                </>
              )}
            </div>
            <div className="space-y-6">
              <Skeleton className="h-96 w-full" />
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Error state for edit mode
  if (editModeError && isUrlEditMode) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <span className="text-2xl font-bold tracking-wide text-foreground">
              OPEN — Calculadora VM + BareMetal
            </span>
          </div>
        </header>
        <main className="container mx-auto px-4 py-6">
          <div className="max-w-lg mx-auto text-center py-12">
            <div className="h-16 w-16 rounded-full bg-destructive/20 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">
              Erro ao carregar proposta
            </h2>
            <p className="text-muted-foreground mb-6">{editModeError}</p>
            <div className="flex gap-3 justify-center">
              <Button variant="outline" onClick={() => navigate(-1)}>
                Voltar
              </Button>
              <Button
                onClick={() => {
                  setEditModeError(null);
                  initializedEditModeRef.current = false;
                  navigate("/modulos/comercial/propostas/criar", {
                    replace: true,
                  });
                }}
              >
                Nova Proposta
              </Button>
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
                  Editando proposta existente — alterações serão salvas sobre a
                  versão atual
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge className="bg-amber-500/30 text-amber-400 border-amber-500/50 font-mono text-sm px-3 py-1">
                PROP-{editingProposalId}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                className="text-amber-400 hover:text-amber-300 hover:bg-amber-500/20"
                onClick={() => form.setData(INITIAL_DATA)}
              >
                Cancelar Edição
              </Button>
            </div>
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
                  {(userContext.partnerDiscount * 100).toFixed(0)}% aplicado
                  automaticamente no valor final
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
            <span className="text-2xl font-bold tracking-wide text-foreground">
              OPEN — Calculadora VM + BareMetal
            </span>
            <p className="text-muted-foreground text-sm">Preços em R$ (BRL).</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Profile badge */}
            <Badge
              variant="outline"
              className="hidden sm:flex gap-1 items-center"
            >
              <Shield className="w-3 h-3" />
              {userContext.profileLabel}
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              title="Atualizar Preços"
              onClick={() => refetchConfig()}
            >
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
          {/* Left Column */}
          <div className="space-y-6">
            <OpenCard title="Configuração">
              <InputWithLabel
                readOnly
                label="Preços VM"
                value={`vCPU: R$ ${cConfig.vcpu?.value} | RAM: R$ ${cConfig.ram?.value}/GB | NVMe: R$ ${cConfig.nvme?.value}/GB | IP: R$ ${cConfig.ipPublico?.value}`}
              />

              <ToggleOptions
                label="Vigência (desconto)"
                {...form.register("contract_duration")}
                options={cConfig.contractPlans.map((plan) => ({
                  value: Number(plan.key.split("-")[0]),
                  label: `${plan.label} (-${plan.value}%)`,
                }))}
              />

              <SelectWithLabel
                label="Datacenter"
                {...form.register("datacenter")}
                options={dataCenters.map((dc) => ({
                  value: dc.key,
                  label: `${dc.city} (${dc.key})`,
                }))}
              />
            </OpenCard>

            <OpenCard
              title="Dados do Cliente"
              contentClassName="grid md:grid-cols-2 gap-4"
            >
              <InputWithLabel
                label="Nome"
                placeholder="Nome do cliente"
                {...form.register("name")}
              />

              <InputWithLabel
                label="Empresa"
                placeholder="Nome da empresa"
                {...form.register("company")}
              />

              <InputWithLabel
                label="Telefone"
                placeholder="(00) 00000-0000"
                {...form.register("phone")}
                setValue={(v) => form.handleChange(maskPhone(v), "phone")}
              />

              <InputWithLabel
                type="email"
                label="E-mail"
                placeholder="email@empresa.com"
                {...form.register("email")}
              />
            </OpenCard>

            <OpenCard title="Proposta">
              <div
                className={tw("grid gap-4", form.data.id && "md:grid-cols-3")}
              >
                {!!form.data.id && (
                  <InputWithLabel readOnly label="ID" value={form.data.id} />
                )}
                {!!form.data.id && (
                  <InputWithLabel
                    readOnly
                    label="Data"
                    value={formatDateBR(form.data.created_at)}
                  />
                )}

                <SelectWithLabel
                  asNumber
                  label="Validade (dias)"
                  {...form.register("validityDays")}
                  options={proposalAcceptanceDays}
                  sub={`Válida até: ${dayjs(form.data.due_at).format("DD/MM/YYYY")}`}
                />
              </div>

              {/* Architect Selector - only for internal users level 700+ */}
              {showArchitectSelector && (
                <div className="mt-4 pt-4 border-t border-border">
                  <ArchitectSelector
                    value={selectedArchitectId}
                    onChange={setSelectedArchitectId}
                  />
                </div>
              )}

              {/* Observação field */}
              <div className="mt-4">
                <LabelSecondary>Observação</LabelSecondary>
                <textarea
                  value={form.data.observations}
                  onChange={(e) =>
                    form.handleChange(
                      e.target.value.slice(0, 2000),
                      "observations",
                    )
                  }
                  placeholder="Digite aqui informações relevantes para o cliente (escopo, premissas, prazos, ressalvas etc.)"
                  className="w-full min-h-[100px] p-3 rounded-md bg-input border border-border text-foreground placeholder:text-muted-foreground resize-y"
                  maxLength={2000}
                />
                <p className="text-xs text-muted-foreground mt-1 text-right">
                  {form.data.observations?.length ?? 0}/2000 caracteres
                </p>
              </div>
            </OpenCard>

            {/* Servers */}
            <div className="open-card">
              <SectionTitle>Servidores</SectionTitle>
              <div className="flex items-center justify-between mb-4">
                <div className="flex gap-2 flex-wrap">
                  <Button variant="server-badge" size="badge" onClick={addVM}>
                    <ProductIcon type="vm" size={14} className="text-white" />
                    <Plus className="w-3 h-3" /> VM
                  </Button>
                  <Button variant="server-badge" size="badge" onClick={addBM}>
                    <ProductIcon
                      type="baremetal"
                      size={14}
                      className="text-white"
                    />
                    <Plus className="w-3 h-3" /> BareMetal
                  </Button>
                  <Button
                    variant="server-badge"
                    size="badge"
                    onClick={() =>
                      setKubernetes((prev) => ({ ...prev, enabled: true }))
                    }
                    disabled={kubernetes.enabled}
                  >
                    <ProductIcon
                      type="kubernetes"
                      size={14}
                      className="text-white"
                    />
                    <Plus className="w-3 h-3" /> Kubernetes
                  </Button>
                  <Button
                    variant="server-badge"
                    size="badge"
                    onClick={addStorage}
                  >
                    <ProductIcon
                      type="storage-volume"
                      size={14}
                      className="text-white"
                    />
                    <Plus className="w-3 h-3" /> Storage
                  </Button>
                  <Button
                    variant="server-badge"
                    size="badge"
                    onClick={addOpenSaas}
                    disabled={openSaas.enabled}
                  >
                    <ProductIcon
                      type="open-saas"
                      size={14}
                      className="text-white"
                    />
                    <Plus className="w-3 h-3" /> OPEN SaaS
                  </Button>
                </div>
              </div>
              {form.data.servers.map((server, idx) => (
                <ServerVm
                  key={server.name}
                  form={form}
                  index={idx}
                  expandedItems={expandedItems}
                  toggleExpand={toggleExpand}
                  server={server}
                  config={cConfig}
                  remove={() => {}}
                  getServerSpecValue={getServerSpecValue}
                  onServerSpecChange={onServerSpecChange}
                />
              ))}
            </div>

            <div className="open-card">
              <SectionTitle>Servidores</SectionTitle>
              <div className="flex items-center justify-between mb-4">
                <div className="flex gap-2 flex-wrap">
                  <Button variant="server-badge" size="badge" onClick={addVM}>
                    <ProductIcon type="vm" size={14} className="text-white" />
                    <Plus className="w-3 h-3" /> VM
                  </Button>
                  <Button variant="server-badge" size="badge" onClick={addBM}>
                    <ProductIcon
                      type="baremetal"
                      size={14}
                      className="text-white"
                    />
                    <Plus className="w-3 h-3" /> BareMetal
                  </Button>
                  <Button
                    variant="server-badge"
                    size="badge"
                    onClick={() =>
                      setKubernetes((prev) => ({ ...prev, enabled: true }))
                    }
                    disabled={kubernetes.enabled}
                  >
                    <ProductIcon
                      type="kubernetes"
                      size={14}
                      className="text-white"
                    />
                    <Plus className="w-3 h-3" /> Kubernetes
                  </Button>
                  <Button
                    variant="server-badge"
                    size="badge"
                    onClick={addStorage}
                  >
                    <ProductIcon
                      type="storage-volume"
                      size={14}
                      className="text-white"
                    />
                    <Plus className="w-3 h-3" /> Storage
                  </Button>
                  <Button
                    variant="server-badge"
                    size="badge"
                    onClick={addOpenSaas}
                    disabled={openSaas.enabled}
                  >
                    <ProductIcon
                      type="open-saas"
                      size={14}
                      className="text-white"
                    />
                    <Plus className="w-3 h-3" /> OPEN SaaS
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                {/* VM and BareMetal items */}
                {items.map((item, idx) => {
                  const isExpanded = expandedItems.has(item.id);
                  const gpuOptions = Object.keys(config.gpu_usd);
                  const isEmptyVM = item.type === "vm" && !isVMValid(item);

                  return (
                    <div
                      key={item.id}
                      className={`border rounded-lg overflow-hidden bg-card/50 ${
                        isEmptyVM
                          ? "border-destructive border-2"
                          : "border-border"
                      }`}
                    >
                      {/* Header */}
                      <div
                        className={`flex items-center justify-between px-4 py-3 cursor-pointer ${
                          isEmptyVM ? "bg-destructive/10" : "bg-muted/30"
                        }`}
                        onClick={() => toggleExpand(item.id)}
                      >
                        <div className="flex items-center gap-3">
                          <ProductIcon
                            type={item.type === "vm" ? "vm" : "baremetal"}
                            size={18}
                            className={
                              isEmptyVM
                                ? "text-destructive"
                                : "text-emerald-400"
                            }
                          />
                          <span
                            className={`text-white text-xs font-bold uppercase px-2 py-1 rounded-full ${
                              isEmptyVM ? "bg-destructive" : "bg-emerald-500"
                            }`}
                          >
                            {item.type === "vm" ? "VM" : "BAREMETAL"}
                          </span>
                          <span className="font-medium text-foreground">
                            {item.type === "vm"
                              ? `VM #${idx + 1}`
                              : `BareMetal #${idx + 1}`}
                          </span>
                          {isEmptyVM && (
                            <span className="text-xs text-destructive font-medium">
                              (Sem recursos definidos)
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {item.qtyServers}x servidor(es)
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeItem(item.id);
                            }}
                            className="h-8 w-8 text-destructive hover:bg-destructive/20"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </div>
                      </div>

                      {/* Content */}
                      {isExpanded && (
                        <div className="p-4 space-y-4">
                          {/* Common fields */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div>
                              <LabelSecondary>Qtd Servidores</LabelSecondary>
                              <Input
                                type="number"
                                value={item.qtyServers}
                                onChange={(e) =>
                                  updateItem(item.id, {
                                    qtyServers: parseInt(e.target.value) || 1,
                                  })
                                }
                                min={1}
                                className="bg-input border-border"
                              />
                            </div>
                            <div>
                              <LabelSecondary>IPs Públicos</LabelSecondary>
                              <Input
                                type="number"
                                value={item.ips}
                                onChange={(e) =>
                                  updateItem(item.id, {
                                    ips: parseInt(e.target.value) || 0,
                                  })
                                }
                                min={0}
                                className="bg-input border-border"
                              />
                            </div>
                            <div>
                              <LabelSecondary>GPU</LabelSecondary>
                              <Select
                                value={item.gpu}
                                onValueChange={(v) =>
                                  updateItem(item.id, {
                                    gpu: v,
                                    gpuQty:
                                      v === "Sem GPU"
                                        ? 0
                                        : Math.max(1, item.gpuQty),
                                  })
                                }
                              >
                                <SelectTrigger className="bg-input border-border">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {gpuOptions.map((gpu) => (
                                    <SelectItem key={gpu} value={gpu}>
                                      {gpu}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            {item.gpu !== "Sem GPU" && (
                              <div>
                                <LabelSecondary>Qtd GPU</LabelSecondary>
                                <Input
                                  type="number"
                                  value={item.gpuQty}
                                  onChange={(e) =>
                                    updateItem(item.id, {
                                      gpuQty: parseInt(e.target.value) || 1,
                                    })
                                  }
                                  min={1}
                                  max={8}
                                  className="bg-input border-border"
                                />
                              </div>
                            )}
                          </div>

                          {/* VM-specific fields */}
                          {item.type === "vm" && (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                              <div>
                                <LabelSecondary>vCPU</LabelSecondary>
                                <Input
                                  type="number"
                                  value={item.vcpu}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value);
                                    updateItem(item.id, {
                                      vcpu:
                                        Number.isNaN(val) || val < 0 ? 0 : val,
                                    });
                                  }}
                                  min={0}
                                  className="bg-input border-border"
                                />
                              </div>
                              <div>
                                <LabelSecondary>RAM (GB)</LabelSecondary>
                                <Input
                                  type="number"
                                  value={item.ramGb}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value);
                                    updateItem(item.id, {
                                      ramGb:
                                        Number.isNaN(val) || val < 0 ? 0 : val,
                                    });
                                  }}
                                  min={0}
                                  className="bg-input border-border"
                                />
                              </div>
                              <div>
                                <LabelSecondary>NVMe (GB)</LabelSecondary>
                                <Input
                                  type="number"
                                  value={Math.round(item.nvmeTb * 1024)}
                                  onChange={(e) =>
                                    updateItem(item.id, {
                                      nvmeTb:
                                        (parseInt(e.target.value) || 0) / 1024,
                                    })
                                  }
                                  min={0}
                                  step={50}
                                  className="bg-input border-border"
                                />
                              </div>
                            </div>
                          )}

                          {/* BM-specific fields */}
                          {item.type === "bm" && (
                            <>
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <LabelSecondary>CPU</LabelSecondary>
                                  <Select
                                    value={item.bmCpu}
                                    onValueChange={(v) =>
                                      updateItem(item.id, { bmCpu: v })
                                    }
                                  >
                                    <SelectTrigger className="bg-input border-border">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {config.baremetal.cpu_models.map(
                                        (cpu) => (
                                          <SelectItem
                                            key={cpu.id}
                                            value={cpu.id}
                                          >
                                            {cpu.label} - R${" "}
                                            {formatCurrency(cpu.price)}
                                          </SelectItem>
                                        ),
                                      )}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div>
                                  <LabelSecondary>RAM</LabelSecondary>
                                  <Select
                                    value={item.bmRam}
                                    onValueChange={(v) =>
                                      updateItem(item.id, { bmRam: v })
                                    }
                                  >
                                    <SelectTrigger className="bg-input border-border">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {config.baremetal.ram_tiers.map((ram) => (
                                        <SelectItem key={ram.id} value={ram.id}>
                                          {ram.label} - R${" "}
                                          {formatCurrency(ram.price)}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>

                              {/* Disks */}
                              <div>
                                <div className="flex items-center justify-between mb-2">
                                  <label className="block text-xs text-muted-foreground">
                                    Discos NVMe
                                  </label>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => addDisk(item.id)}
                                  >
                                    <Plus className="w-3 h-3 mr-1" /> Disco
                                  </Button>
                                </div>
                                <div className="space-y-2">
                                  {(Array.isArray(item.disks)
                                    ? item.disks
                                    : []
                                  ).map((disk, diskIdx) => (
                                    <div
                                      key={diskIdx}
                                      className="flex gap-2 items-center"
                                    >
                                      <Select
                                        value={disk.type}
                                        onValueChange={(v) =>
                                          updateDisk(item.id, diskIdx, {
                                            type: v,
                                          })
                                        }
                                      >
                                        <SelectTrigger className="flex-1 bg-input border-border">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {config.baremetal.disks.map((d) => (
                                            <SelectItem key={d.id} value={d.id}>
                                              {d.label} - R${" "}
                                              {formatCurrency(d.price)}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                      <Input
                                        type="number"
                                        value={disk.qty}
                                        onChange={(e) =>
                                          updateDisk(item.id, diskIdx, {
                                            qty: parseInt(e.target.value) || 1,
                                          })
                                        }
                                        min={1}
                                        className="w-20 bg-input border-border"
                                        placeholder="Qtd"
                                      />
                                      {(Array.isArray(item.disks)
                                        ? item.disks
                                        : []
                                      ).length > 1 && (
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          onClick={() =>
                                            removeDisk(item.id, diskIdx)
                                          }
                                          className="h-8 w-8"
                                        >
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
                        onClick={() => toggleSectionCollapse("kubernetes")}
                      >
                        <ProductIcon
                          type="kubernetes"
                          size={18}
                          className="text-emerald-400"
                        />
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
                          onClick={() =>
                            setKubernetes({
                              enabled: false,
                              plan: "k8s_small",
                              addons: {
                                support_24x7: false,
                                backup_velero: false,
                                dr_multisite: false,
                                observability: false,
                                cicd_managed: false,
                                devops_hours: 0,
                              },
                              extras: { vcpu: 0, ramGB: 0, diskGB: 0 },
                            })
                          }
                          className="h-8 w-8 text-destructive hover:bg-destructive/20"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => toggleSectionCollapse("kubernetes")}
                        >
                          {collapsedSections.has("kubernetes") ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronUp className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* Content - collapsible */}
                    {!collapsedSections.has("kubernetes") && (
                      <div className="p-4 space-y-4">
                        {/* Plan selector */}
                        <div>
                          <label className="block text-xs text-muted-foreground mb-2">
                            Plano
                          </label>
                          <Select
                            value={kubernetes.plan}
                            onValueChange={(v) =>
                              setKubernetes((prev) => ({
                                ...prev,
                                plan: v as K8sPlan,
                                extras: { vcpu: 0, ramGB: 0, diskGB: 0 }, // Reset extras when changing plan
                              }))
                            }
                          >
                            <SelectTrigger className="bg-input border-border">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {(
                                Object.entries(K8S_PLANS) as [
                                  K8sPlan,
                                  K8sPlanSpec,
                                ][]
                              ).map(([planId, planInfo]) => {
                                const basePrice = getK8sPlanBasePrice(
                                  planId,
                                  config,
                                );
                                return (
                                  <SelectItem key={planId} value={planId}>
                                    {planInfo.label} — R${" "}
                                    {formatCurrency(basePrice)}/mês
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground mt-2">
                            Plano selecionado:{" "}
                            <span className="text-foreground font-medium">
                              {K8S_PLANS[kubernetes.plan].shortLabel} — R${" "}
                              {formatCurrency(
                                getK8sPlanBasePrice(kubernetes.plan, config),
                              )}
                              /mês
                            </span>
                          </p>
                        </div>

                        {/* Recursos Base e Extras */}
                        <div className="border border-border rounded-lg p-3 bg-muted/20">
                          <label className="block text-xs text-muted-foreground mb-3">
                            Recursos do Plano
                          </label>
                          {(() => {
                            const planSpec = K8S_PLANS[kubernetes.plan];
                            const baseResources = getK8sPlanBaseResources(
                              kubernetes.plan,
                            );
                            const extras = kubernetes.extras || {
                              vcpu: 0,
                              ramGB: 0,
                              diskGB: 0,
                            };
                            const extrasPrice = calculateK8sExtrasPrice(
                              extras,
                              config,
                            );

                            return (
                              <>
                                {/* Base resources (read-only) */}
                                <div className="grid grid-cols-3 gap-3 mb-4">
                                  <div className="bg-muted/30 rounded px-2 py-1.5">
                                    <span className="text-xs text-muted-foreground block">
                                      vCPU base
                                    </span>
                                    <span className="text-sm font-medium text-foreground">
                                      {baseResources.vcpu} vCPU
                                    </span>
                                    <span className="text-xs text-muted-foreground block">
                                      ({planSpec.nodes} nodes ×{" "}
                                      {planSpec.vcpu_per_node})
                                    </span>
                                  </div>
                                  <div className="bg-muted/30 rounded px-2 py-1.5">
                                    <span className="text-xs text-muted-foreground block">
                                      RAM base
                                    </span>
                                    <span className="text-sm font-medium text-foreground">
                                      {baseResources.ramGB} GB
                                    </span>
                                    <span className="text-xs text-muted-foreground block">
                                      ({planSpec.nodes} nodes ×{" "}
                                      {planSpec.ram_gb_per_node})
                                    </span>
                                  </div>
                                  <div className="bg-muted/30 rounded px-2 py-1.5">
                                    <span className="text-xs text-muted-foreground block">
                                      Disco base
                                    </span>
                                    <span className="text-sm font-medium text-foreground">
                                      {baseResources.diskGB} GB
                                    </span>
                                    <span className="text-xs text-muted-foreground block">
                                      ({planSpec.nodes} nodes ×{" "}
                                      {planSpec.disk_gb_per_node})
                                    </span>
                                  </div>
                                </div>

                                {/* Extra resources (editable) */}
                                <label className="block text-xs text-muted-foreground mb-2">
                                  Recursos Adicionais (opcional)
                                </label>
                                <div className="grid grid-cols-3 gap-3">
                                  <div>
                                    <LabelSecondary>+ vCPU</LabelSecondary>
                                    <Input
                                      type="number"
                                      value={extras.vcpu}
                                      onChange={(e) =>
                                        setKubernetes((prev) => ({
                                          ...prev,
                                          extras: {
                                            ...prev.extras,
                                            vcpu: Math.max(
                                              0,
                                              parseInt(e.target.value) || 0,
                                            ),
                                          },
                                        }))
                                      }
                                      min={0}
                                      step={1}
                                      className="bg-input border-border"
                                    />
                                    <span className="text-xs text-muted-foreground">
                                      R${" "}
                                      {formatCurrency(
                                        config.vm_prices_brl.vcpu,
                                      )}
                                      /vCPU
                                    </span>
                                  </div>
                                  <div>
                                    <LabelSecondary>+ RAM (GB)</LabelSecondary>
                                    <Input
                                      type="number"
                                      value={extras.ramGB}
                                      onChange={(e) =>
                                        setKubernetes((prev) => ({
                                          ...prev,
                                          extras: {
                                            ...prev.extras,
                                            ramGB: Math.max(
                                              0,
                                              parseInt(e.target.value) || 0,
                                            ),
                                          },
                                        }))
                                      }
                                      min={0}
                                      step={1}
                                      className="bg-input border-border"
                                    />
                                    <span className="text-xs text-muted-foreground">
                                      R${" "}
                                      {formatCurrency(
                                        config.vm_prices_brl.ram_per_gb,
                                      )}
                                      /GB
                                    </span>
                                  </div>
                                  <div>
                                    <LabelSecondary>
                                      + Disco (GB)
                                    </LabelSecondary>
                                    <Input
                                      type="number"
                                      value={extras.diskGB}
                                      onChange={(e) =>
                                        setKubernetes((prev) => ({
                                          ...prev,
                                          extras: {
                                            ...prev.extras,
                                            diskGB: Math.max(
                                              0,
                                              parseInt(e.target.value) || 0,
                                            ),
                                          },
                                        }))
                                      }
                                      min={0}
                                      step={1}
                                      className="bg-input border-border"
                                    />
                                    <span className="text-xs text-muted-foreground">
                                      R${" "}
                                      {formatCurrency(
                                        config.vm_prices_brl.nvme_per_gb,
                                      )}
                                      /GB
                                    </span>
                                  </div>
                                </div>

                                {/* Extras price summary */}
                                {extrasPrice > 0 && (
                                  <div className="mt-3 pt-3 border-t border-border/50">
                                    <div className="flex justify-between items-center">
                                      <span className="text-xs text-muted-foreground">
                                        Custo adicional mensal:
                                      </span>
                                      <span className="text-sm font-medium text-primary">
                                        + R$ {formatCurrency(extrasPrice)}/mês
                                      </span>
                                    </div>
                                  </div>
                                )}
                              </>
                            );
                          })()}
                        </div>

                        {/* K8s Add-ons */}
                        <div>
                          <label className="block text-xs text-muted-foreground mb-2">
                            Add-ons Kubernetes
                          </label>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={kubernetes.addons.support_24x7}
                                onChange={(e) =>
                                  setKubernetes((prev) => ({
                                    ...prev,
                                    addons: {
                                      ...prev.addons,
                                      support_24x7: e.target.checked,
                                    },
                                  }))
                                }
                                className="rounded border-border"
                              />
                              <div>
                                <label className="block text-xs text-foreground">
                                  Suporte 24×7
                                </label>
                                <span className="text-xs text-muted-foreground">
                                  R${" "}
                                  {formatCurrency(
                                    getK8sAddonPrice("support_24x7", config),
                                  )}
                                  /mês
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={kubernetes.addons.backup_velero}
                                onChange={(e) =>
                                  setKubernetes((prev) => ({
                                    ...prev,
                                    addons: {
                                      ...prev.addons,
                                      backup_velero: e.target.checked,
                                    },
                                  }))
                                }
                                className="rounded border-border"
                              />
                              <div>
                                <label className="block text-xs text-foreground">
                                  Backup (Velero)
                                </label>
                                <span className="text-xs text-muted-foreground">
                                  R${" "}
                                  {formatCurrency(
                                    getK8sAddonPrice("backup_velero", config),
                                  )}
                                  /mês
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={kubernetes.addons.dr_multisite}
                                onChange={(e) =>
                                  setKubernetes((prev) => ({
                                    ...prev,
                                    addons: {
                                      ...prev.addons,
                                      dr_multisite: e.target.checked,
                                    },
                                  }))
                                }
                                className="rounded border-border"
                              />
                              <div>
                                <label className="block text-xs text-foreground">
                                  DR multi-site
                                </label>
                                <span className="text-xs text-muted-foreground">
                                  R${" "}
                                  {formatCurrency(
                                    getK8sAddonPrice("dr_multisite", config),
                                  )}
                                  /mês
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={kubernetes.addons.observability}
                                onChange={(e) =>
                                  setKubernetes((prev) => ({
                                    ...prev,
                                    addons: {
                                      ...prev.addons,
                                      observability: e.target.checked,
                                    },
                                  }))
                                }
                                className="rounded border-border"
                              />
                              <div>
                                <label className="block text-xs text-foreground">
                                  Observabilidade avançada
                                </label>
                                <span className="text-xs text-muted-foreground">
                                  R${" "}
                                  {formatCurrency(
                                    getK8sAddonPrice("observability", config),
                                  )}
                                  /mês
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={kubernetes.addons.cicd_managed}
                                onChange={(e) =>
                                  setKubernetes((prev) => ({
                                    ...prev,
                                    addons: {
                                      ...prev.addons,
                                      cicd_managed: e.target.checked,
                                    },
                                  }))
                                }
                                className="rounded border-border"
                              />
                              <div>
                                <label className="block text-xs text-foreground">
                                  CI/CD gerenciado
                                </label>
                                <span className="text-xs text-muted-foreground">
                                  R${" "}
                                  {formatCurrency(
                                    getK8sAddonPrice("cicd_managed", config),
                                  )}
                                  /mês
                                </span>
                              </div>
                            </div>
                            <div>
                              <LabelSecondary>Horas DevOps</LabelSecondary>
                              <Input
                                type="number"
                                value={kubernetes.addons.devops_hours}
                                onChange={(e) =>
                                  setKubernetes((prev) => ({
                                    ...prev,
                                    addons: {
                                      ...prev.addons,
                                      devops_hours:
                                        parseInt(e.target.value) || 0,
                                    },
                                  }))
                                }
                                min={0}
                                className="bg-input border-border"
                              />
                              <span className="text-xs text-muted-foreground">
                                R${" "}
                                {formatCurrency(
                                  getK8sAddonPrice("devops_hours", config),
                                )}
                                /hora
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Storage items */}
                {storageItems.map((storage, idx) => {
                  const storageType = storage.storageType || "sas";
                  const isNvme = storageType === "nvme";
                  const typeLabel = STORAGE_TYPE_LABELS[storageType];

                  // Calculate pricing based on storage type
                  let pricePerUnit: number;
                  let monthlyTotal: number;
                  let unitLabel: string;
                  let volumeDisplay: number;
                  let tierLabel: string = "";

                  if (isNvme) {
                    // NVMe: GB, fixed price
                    const volumeGB = storage.volumeGB || 100;
                    pricePerUnit = getNvmePricePerGB(config);
                    monthlyTotal = volumeGB * pricePerUnit;
                    unitLabel = "GB";
                    volumeDisplay = volumeGB;
                  } else {
                    // SAS and S3: TB, tiered pricing (S3 uses same pricing as SAS)
                    pricePerUnit = getStoragePricePerTB(
                      storage.volumeTB,
                      storage.region,
                      config,
                      storageType,
                    );
                    monthlyTotal = calculateStorageMonthly(
                      storage.volumeTB,
                      storage.region,
                      config,
                      storageType,
                    );
                    unitLabel = "TB";
                    volumeDisplay = storage.volumeTB;
                    tierLabel = getStorageTierLabel(storage.volumeTB);
                  }

                  const sectionId = `storage-${storage.id}`;
                  return (
                    <div
                      key={storage.id}
                      className="border border-border rounded-lg overflow-hidden bg-card/50"
                    >
                      {/* Header */}
                      <div className="flex items-center justify-between px-4 py-3 bg-muted/30">
                        <div
                          className="flex items-center gap-3 flex-1 cursor-pointer"
                          onClick={() => toggleSectionCollapse(sectionId)}
                        >
                          <ProductIcon
                            type={
                              storageType === "s3"
                                ? "storage-s3"
                                : storageType === "nvme"
                                  ? "storage-nvme"
                                  : "storage-volume"
                            }
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
                            {isNvme ? "" : `${storage.region} — `}
                            {volumeDisplay} {unitLabel}
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
                            {collapsedSections.has(sectionId) ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronUp className="w-4 h-4" />
                            )}
                          </Button>
                        </div>
                      </div>

                      {/* Content - collapsible */}
                      {!collapsedSections.has(sectionId) && (
                        <div className="p-4 space-y-4">
                          <div
                            className={`grid gap-3 ${isNvme ? "grid-cols-2 md:grid-cols-4" : "grid-cols-2 md:grid-cols-5"}`}
                          >
                            <div>
                              <LabelSecondary>Tipo de Storage</LabelSecondary>
                              <Select
                                value={storageType}
                                onValueChange={(v) => {
                                  const newType = v as StorageType;
                                  // When switching to NVMe, initialize volumeGB; when switching away, clear it
                                  if (newType === "nvme") {
                                    updateStorage(storage.id, {
                                      storageType: newType,
                                      volumeGB: storage.volumeGB || 100,
                                    });
                                  } else {
                                    updateStorage(storage.id, {
                                      storageType: newType,
                                      volumeGB: undefined,
                                    });
                                  }
                                }}
                              >
                                <SelectTrigger className="bg-input border-border">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="sas">
                                    Storage SAS
                                  </SelectItem>
                                  <SelectItem value="s3">Bucket S3</SelectItem>
                                  <SelectItem value="nvme">SSD NVMe</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            {!isNvme && (
                              <div>
                                <LabelSecondary>Região</LabelSecondary>
                                <Select
                                  value={storage.region}
                                  onValueChange={(v) =>
                                    updateStorage(storage.id, {
                                      region: v as StorageRegion,
                                    })
                                  }
                                >
                                  <SelectTrigger className="bg-input border-border">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="BR">
                                      Brasil (BR)
                                    </SelectItem>
                                    <SelectItem value="USA">
                                      Estados Unidos (USA)
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            )}
                            <div>
                              <LabelSecondary>
                                Volume ({isNvme ? "GB" : "TB"})
                              </LabelSecondary>
                              <Input
                                type="number"
                                value={
                                  isNvme
                                    ? storage.volumeGB || 100
                                    : storage.volumeTB
                                }
                                onChange={(e) => {
                                  if (isNvme) {
                                    updateStorage(storage.id, {
                                      volumeGB: parseFloat(e.target.value) || 1,
                                    });
                                  } else {
                                    updateStorage(storage.id, {
                                      volumeTB: parseFloat(e.target.value) || 1,
                                    });
                                  }
                                }}
                                min={1}
                                step={isNvme ? 50 : 0.1}
                                className="bg-input border-border"
                              />
                            </div>
                            <div>
                              <LabelSecondary>
                                Preço por {isNvme ? "GB" : "TB"}
                                {!isNvme && " (faixa)"}
                              </LabelSecondary>
                              <div className="text-sm bg-muted/30 rounded px-3 py-2 text-foreground">
                                R$ {formatCurrency(pricePerUnit)}/{unitLabel}
                              </div>
                              {!isNvme && (
                                <span className="text-xs text-muted-foreground">
                                  Faixa: {tierLabel}
                                </span>
                              )}
                            </div>
                            <div>
                              <LabelSecondary>Total mensal</LabelSecondary>
                              <div className="text-sm font-medium text-primary bg-muted/30 rounded px-3 py-2">
                                R$ {formatCurrency(monthlyTotal)}
                              </div>
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {typeLabel}
                            {!isNvme && ` ${storage.region}`} — {volumeDisplay}{" "}
                            {unitLabel} — R$ {formatCurrency(pricePerUnit)}/
                            {unitLabel} — Total: R${" "}
                            {formatCurrency(monthlyTotal)}/mês
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
                        onClick={() => toggleSectionCollapse("open-saas")}
                      >
                        <ProductIcon
                          type="open-saas"
                          size={18}
                          className="text-blue-400"
                        />
                        <span className="bg-blue-500 text-white text-xs font-bold uppercase px-2 py-1 rounded-full">
                          SAAS
                        </span>
                        <span className="font-medium text-foreground">
                          OPEN SaaS
                        </span>
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
                          onClick={() => toggleSectionCollapse("open-saas")}
                        >
                          {collapsedSections.has("open-saas") ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronUp className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                    {!collapsedSections.has("open-saas") && (
                      <div className="p-4 space-y-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div>
                            <LabelSecondary>Usuários (mínimo 5)</LabelSecondary>
                            <Input
                              type="number"
                              value={openSaas.users}
                              onChange={(e) =>
                                setOpenSaas((prev) => ({
                                  ...prev,
                                  users: parseInt(e.target.value) || 5,
                                }))
                              }
                              onBlur={(e) => {
                                const val = parseInt(e.target.value) || 5;
                                if (val < 5)
                                  setOpenSaas((prev) => ({
                                    ...prev,
                                    users: 5,
                                  }));
                              }}
                              min={5}
                              className="bg-input border-border"
                            />
                          </div>
                          <div>
                            <LabelSecondary>Preço por usuário</LabelSecondary>
                            <div className="text-sm text-foreground bg-muted/30 rounded px-3 py-2">
                              R${" "}
                              {formatCurrency(
                                config.open_saas_price_per_user || 85,
                              )}
                              /usuário
                            </div>
                          </div>
                          <div>
                            <LabelSecondary>Total mensal</LabelSecondary>
                            <div className="text-sm font-medium text-primary bg-muted/30 rounded px-3 py-2">
                              R${" "}
                              {formatCurrency(
                                openSaas.users *
                                  (config.open_saas_price_per_user || 85),
                              )}
                            </div>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          OPEN SaaS — {openSaas.users} usuário(s) × R${" "}
                          {formatCurrency(
                            config.open_saas_price_per_user || 85,
                          )}
                          /usuário — Total: R${" "}
                          {formatCurrency(
                            openSaas.users *
                              (config.open_saas_price_per_user || 85),
                          )}
                          /mês
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {items.length === 0 &&
                  !kubernetes.enabled &&
                  storageItems.length === 0 &&
                  !openSaas.enabled && (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>Nenhum servidor adicionado.</p>
                      <p className="text-sm">
                        Clique em "+ VM", "+ BareMetal", "+ Kubernetes", "+
                        Storage" ou "+ OPEN SaaS" para começar.
                      </p>
                    </div>
                  )}
              </div>
            </div>

            <div className="open-card">
              <SectionTitle>Add-ons & Serviços</SectionTitle>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <InputWithLabel
                  label={cConfig?.antivirus?.label}
                  value={getAddonValue(cConfig.antivirus)}
                  onChange={(e) => onAddonChange(e, cConfig.antivirus)}
                  sub={`R$ ${cConfig?.antivirus?.value}/unid.`}
                />

                <InputWithLabel
                  label={cConfig?.tsplus?.label}
                  value={getAddonValue(cConfig.tsplus)}
                  onChange={(e) => onAddonChange(e, cConfig.tsplus)}
                  sub={`R$ ${cConfig?.tsplus?.value}/unid.`}
                />

                <InputWithLabel
                  label={cConfig?.cal?.label}
                  value={getAddonValue(cConfig.cal)}
                  onChange={(e) => onAddonChange(e, cConfig.cal)}
                  sub={`R$ ${cConfig?.cal?.value}/unid.`}
                />

                <InputWithLabel
                  label={cConfig?.firewall?.label}
                  value={getAddonValue(cConfig.firewall)}
                  onChange={(e) => onAddonChange(e, cConfig.firewall)}
                  sub={`R$ ${cConfig?.firewall?.value}/unid.`}
                />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-4">
                <SelectWithLabel
                  label="SQL Server"
                  value={form.data.addonSqlServer}
                  onChange={(e) =>
                    form.handleChange(e.target.value, "addonSqlServer")
                  }
                  options={cConfig.sqlConfigs.map((config) => ({
                    label: config?.label,
                    value: config?.key,
                  }))}
                />

                {form.data.addonSqlServer !== cConfig.sqlNone?.key && (
                  <InputWithLabel
                    label="Qtd Licenças SQL"
                    value={form.data.addonSqlServerQty}
                    onChange={(e) =>
                      form.handleChange(e.target.value, "addonSqlServerQty")
                    }
                  />
                )}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-4">
                <InputWithLabel
                  label={cConfig?.veeamVm?.label}
                  value={getAddonValue(cConfig.veeamVm)}
                  onChange={(e) => onAddonChange(e, cConfig.veeamVm)}
                  sub={`R$ ${cConfig?.veeamVm?.value}/unid.`}
                />

                <InputWithLabel
                  label={cConfig?.veeamAgent?.label}
                  value={getAddonValue(cConfig.veeamAgent)}
                  onChange={(e) => onAddonChange(e, cConfig.veeamAgent)}
                  sub={`R$ ${cConfig?.veeamAgent?.value}/unid.`}
                />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-4">
                <InputWithLabel
                  label={cConfig?.winserver2vcpuunid?.label}
                  value={getAddonValue(cConfig.winserver2vcpuunid)}
                  onChange={(e) => onAddonChange(e, cConfig.winserver2vcpuunid)}
                  sub={`R$ ${cConfig?.winserver2vcpuunid?.value}/unid.`}
                />
              </div>

              {/* Backup */}
              <div className="mt-4 grid grid-cols-2 gap-4">
                <div className="relative">
                  <LabelSecondary>Plano de Backup</LabelSecondary>
                  <Select
                    value={addons.backupPlan}
                    onValueChange={(v) =>
                      setAddons((prev) => ({ ...prev, backupPlan: v }))
                    }
                  >
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
                {addons.backupPlan !== "none" && (
                  <div>
                    <LabelSecondary>Backup (GB)</LabelSecondary>
                    <Input
                      type="number"
                      value={addons.backupGb}
                      onChange={(e) =>
                        setAddons((prev) => ({
                          ...prev,
                          backupGb: parseInt(e.target.value) || 0,
                        }))
                      }
                      min={0}
                      className="bg-input border-border"
                    />
                  </div>
                )}
              </div>

              {/* SERVIÇOS ESPECIALIZADOS: Suporte, Consultoria, DBA - Preços carregados do Admin */}
              <div className="mt-4 border-t border-border pt-4">
                <label className="block text-sm font-medium text-foreground mb-3">
                  Serviços Especializados
                </label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Suporte - dropdown apenas, preço vem do Admin */}
                  <div className="p-3 border border-border rounded-lg bg-muted/20">
                    <LabelSecondary>Suporte</LabelSecondary>
                    <Select
                      value={addons.support.level}
                      onValueChange={(v) => {
                        const level = v as SupportLevel;
                        // Carrega preço do Admin config (addons_brl.support_*)
                        const adminPrice =
                          level === "basic"
                            ? (config.addons_brl?.support_basic ?? 1)
                            : level === "intermediate"
                              ? (config.addons_brl?.support_intermediate ?? 500)
                              : level === "advanced"
                                ? (config.addons_brl?.support_advanced ?? 900)
                                : 0;
                        setAddons((prev) => ({
                          ...prev,
                          support: { level, price: adminPrice },
                        }));
                      }}
                    >
                      <SelectTrigger className="bg-input border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sem Suporte</SelectItem>
                        <SelectItem value="basic">
                          Básico - R${" "}
                          {formatCurrency(
                            config.addons_brl?.support_basic ?? 1,
                          )}
                        </SelectItem>
                        <SelectItem value="intermediate">
                          Intermediário - R${" "}
                          {formatCurrency(
                            config.addons_brl?.support_intermediate ?? 500,
                          )}
                        </SelectItem>
                        <SelectItem value="advanced">
                          Avançado - R${" "}
                          {formatCurrency(
                            config.addons_brl?.support_advanced ?? 900,
                          )}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    {addons.support.level !== "none" && (
                      <span className="text-xs text-muted-foreground mt-1 block">
                        Valor: R$ {formatCurrency(addons.support.price)}/mês
                      </span>
                    )}
                  </div>

                  <div className="p-3 border border-border rounded-lg bg-muted/20">
                    <InputWithLabel
                      label={cConfig?.consultoriaTecnica?.label}
                      value={getAddonValue(cConfig.consultoriaTecnica)}
                      onChange={(e) =>
                        onAddonChange(e, cConfig.consultoriaTecnica)
                      }
                      sub={`R$ ${cConfig?.consultoriaTecnica?.value}/hora.`}
                    />
                  </div>

                  <div className="p-3 border border-border rounded-lg bg-muted/20">
                    <InputWithLabel
                      label={cConfig?.dba?.label}
                      value={getAddonValue(cConfig.dba)}
                      onChange={(e) => onAddonChange(e, cConfig.dba)}
                      sub={`R$ ${cConfig?.dba?.value}/hora.`}
                    />
                  </div>
                </div>
              </div>

              {/* Custom Add-ons (dynamic from config) */}
              {/* {(() => {
                const standardAddonKeys = [
                  "antivirus_unit",
                  "firewall_pfsense",
                  "tsplus_unit",
                  "cal_unit",
                  "sql",
                  "veeam_vm_unit",
                  "veeam_agent_unit",
                  "winserver_2vcpu_unit",
                  "support_basic",
                  "support_intermediate",
                  "support_advanced",
                  "consulting_hours",
                  "dba_hours",
                ];
                const customAddonEntries = Object.entries(
                  config.addons_brl,
                ).filter(
                  ([key, value]) =>
                    !standardAddonKeys.includes(key) &&
                    typeof value === "number",
                );

                if (customAddonEntries.length === 0) return null;

                return (
                  <div className="mt-4">
                    <label className="block text-xs text-muted-foreground mb-2">
                      Add-ons Customizados
                    </label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {customAddonEntries.map(([key, price]) => (
                        <div key={key} className="relative">
                          <label className="block text-xs text-muted-foreground mb-1 capitalize">
                            {key.replace(/_/g, " ")}
                          </label>
                          <Input
                            type="number"
                            value={addons.customAddons?.[key] || 0}
                            onChange={(e) =>
                              setAddons((prev) => ({
                                ...prev,
                                customAddons: {
                                  ...prev.customAddons,
                                  [key]: parseInt(e.target.value) || 0,
                                },
                              }))
                            }
                            min={0}
                            className="bg-input border-border"
                          />
                          <span className="text-xs text-muted-foreground">
                            R$ {formatCurrency(price as number)}/unid.
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()} */}
            </div>

            {/* Canal / Parceiro Section */}
            <div className="open-card">
              <div className="flex items-center justify-between mb-4">
                <SectionTitle>Canal / Parceiro</SectionTitle>
                <div className="flex gap-2">
                  <Button
                    variant={
                      form.data.channel_type === "PARCEIRO"
                        ? "default"
                        : "outline"
                    }
                    size="sm"
                    onClick={() =>
                      form.handleChange("PARCEIRO", "channel_type")
                    }
                  >
                    PARCEIRO
                  </Button>
                  <Button
                    variant={
                      form.data.channel_type === "CLIENTE"
                        ? "default"
                        : "outline"
                    }
                    size="sm"
                    onClick={() => form.handleChange("CLIENTE", "channel_type")}
                  >
                    CLIENTE
                  </Button>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <InputWithLabel
                  label="Revendedor"
                  value={form.data.reseller_name}
                  placeholder="Nome do revendedor"
                  onChange={(e) =>
                    form.handleChange(e.target.value, "reseller_name")
                  }
                />

                <InputWithLabel
                  type="number"
                  label="Comissão Parceiro (R$)"
                  value={form.data.commission_value}
                  onChange={(e) =>
                    form.handleChange(e.target.value, "commission_value")
                  }
                />

                <InputWithLabel
                  label="Motivo da Comissão"
                  value={form.data.commission_reason}
                  onChange={(e) =>
                    form.handleChange(e.target.value, "commission_reason")
                  }
                />

                <InputWithLabel
                  label="Observações"
                  value={form.data.observations}
                  onChange={(e) =>
                    form.handleChange(e.target.value, "observations")
                  }
                />

                {/* <div>
                  <LabelSecondary>Motivo da Comissão</LabelSecondary>
                  <Input
                    value={reseller.overReason}
                    onChange={(e) =>
                      setReseller((prev) => ({
                        ...prev,
                        overReason: e.target.value,
                      }))
                    }
                    placeholder="Motivo"
                    className="bg-input border-border"
                    disabled={reseller.approvalStatus === "Aprovado"}
                  />
                </div> */}

                {/* <div>
                  <LabelSecondary>Observações</LabelSecondary>
                  <Input
                    value={reseller.observations}
                    onChange={(e) =>
                      setReseller((prev) => ({
                        ...prev,
                        observations: e.target.value,
                      }))
                    }
                    placeholder="Observações"
                    className="bg-input border-border"
                    disabled={reseller.approvalStatus === "Aprovado"}
                  />
                </div> */}
              </div>

              {/* Approval Section - Only shown when approvalRequired */}
              {reseller.approvalRequired && reseller.viewMode === "INTERNO" && (
                <div className="mt-4 p-4 border border-yellow-500/50 bg-yellow-500/10 rounded-lg">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="w-5 h-5 text-yellow-500" />
                    <span className="text-sm font-medium text-yellow-500">
                      Comissão acima de 20%: requer aprovação antes de gerar PDF
                      e salvar.
                    </span>
                  </div>

                  <div className="grid md:grid-cols-3 gap-4">
                    <div>
                      <LabelSecondary>Aprovador *</LabelSecondary>
                      <Input
                        value={reseller.approver}
                        onChange={(e) =>
                          setReseller((prev) => ({
                            ...prev,
                            approver: e.target.value,
                          }))
                        }
                        placeholder="Nome do aprovador"
                        className="bg-input border-border"
                        disabled={reseller.approvalStatus === "Aprovado"}
                      />
                    </div>
                    <div>
                      <LabelSecondary>Status</LabelSecondary>
                      <div
                        className={`flex items-center gap-2 px-3 py-2 rounded ${reseller.approvalStatus === "Aprovado" ? "bg-green-500/20 text-green-500" : "bg-yellow-500/20 text-yellow-500"}`}
                      >
                        {reseller.approvalStatus === "Aprovado" ? (
                          <CheckCircle className="w-4 h-4" />
                        ) : (
                          <Lock className="w-4 h-4" />
                        )}
                        <span className="text-sm font-medium">
                          {reseller.approvalStatus}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-end">
                      {reseller.approvalStatus !== "Aprovado" && (
                        <Button onClick={handleApprove} className="w-full">
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Marcar como Aprovado
                        </Button>
                      )}
                      {reseller.approvalStatus === "Aprovado" &&
                        reseller.approvedAt && (
                          <div className="text-xs text-muted-foreground">
                            Aprovado em:{" "}
                            {new Date(reseller.approvedAt).toLocaleString(
                              "pt-BR",
                            )}
                          </div>
                        )}
                    </div>
                  </div>
                </div>
              )}

              {/* Approval pending message for CLIENT mode */}
              {isApprovalPending && reseller.viewMode === "CLIENTE" && (
                <div className="mt-4 p-3 border border-red-500/50 bg-red-500/10 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-red-500" />
                    <span className="text-sm text-red-500">
                      Aprovação pendente: alterne para modo PARCEIRO para
                      aprovar.
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Summary */}
          <div className="lg:sticky lg:top-24 space-y-6">
            <OpenCard title="Resumo">
              {result && (
                <>
                  {/* Summary rows with editable prices */}
                  <div className="space-y-2 max-h-[400px] overflow-y-auto mb-4">
                    {result.rows.map((row, idx) => (
                      <div
                        key={row.rowKey || idx}
                        className="group flex justify-between items-center text-sm py-1 border-b border-border/50"
                      >
                        <span className="text-muted-foreground flex-1 pr-2">
                          {row.label}
                        </span>
                        <EditablePriceCell
                          rowIndex={idx}
                          label={row.label}
                          baseTotal={row.baseTotal || row.subtotal}
                          currentTotal={row.finalTotal || row.subtotal}
                          overrideTotal={row.overrideTotal || null}
                          canEdit={canEditMarkup}
                          onOverrideChange={(rowIdx, newTotal) =>
                            handleOverrideChange(rowIdx, newTotal, row.rowKey)
                          }
                        />
                      </div>
                    ))}
                  </div>

                  {/* Subtotals */}
                  <div className="space-y-2 py-3 border-t border-border">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        Subtotal Recursos
                      </span>
                      <span className="text-foreground">
                        {formatCurrencyBRL(result.subRec)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        Subtotal IPs
                      </span>
                      <span className="text-foreground">
                        {formatCurrencyBRL(result.subIps)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        Subtotal Serviços
                      </span>
                      <span className="text-foreground">
                        {formatCurrencyBRL(result.subServices)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        Subtotal Backup
                      </span>
                      <span className="text-foreground">
                        {formatCurrencyBRL(result.subBackup)}
                      </span>
                    </div>
                    {(result.subKubernetes ?? 0) > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          Subtotal Kubernetes
                        </span>
                        <span className="text-foreground">
                          {formatCurrencyBRL(result.subKubernetes)}
                        </span>
                      </div>
                    )}
                    {(result.subStorage ?? 0) > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          Subtotal Storage
                        </span>
                        <span className="text-foreground">
                          {formatCurrencyBRL(result.subStorage)}
                        </span>
                      </div>
                    )}
                    {(result.discountValue ?? 0) > 0 && (
                      <div className="flex justify-between text-sm text-green-500">
                        <span>
                          Desconto prazo (
                          {(result.discountPct * 100).toFixed(0)}%)
                        </span>
                        <span>-{formatCurrencyBRL(result.discountValue)}</span>
                      </div>
                    )}
                    {(result.partnerDiscountValue ?? 0) > 0 && (
                      <div className="flex justify-between text-sm text-emerald-500">
                        <span>
                          Desconto parceiro (
                          {((result.partnerDiscountPct || 0) * 100).toFixed(0)}
                          %)
                        </span>
                        <span>
                          -{formatCurrencyBRL(result.partnerDiscountValue)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Vigência</span>
                      <span className="text-foreground">
                        {selectedTerm}{" "}
                        {parseInt(selectedTerm) === 1 ? "mês" : "meses"}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Datacenter</span>
                      <span className="text-foreground">{datacenter}</span>
                    </div>
                  </div>

                  {/* Total */}
                  <div className="py-4 border-t border-border">
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-semibold text-foreground">
                        TOTAL MENSAL
                      </span>
                      <span className="text-2xl font-bold text-primary">
                        {formatCurrencyBRL(result.grandTotal)}
                      </span>
                    </div>
                  </div>

                  {/* Comissão Parceiro section - only in PARCEIRO mode */}
                  {reseller.viewMode === "INTERNO" &&
                    (result.overValue ?? 0) > 0 && (
                      <div className="py-3 border-t border-border space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">
                            Comissão Parceiro ({result.overPercent.toFixed(1)}%)
                          </span>
                          <span className="text-amber-500 font-medium">
                            +{formatCurrencyBRL(result.overValue)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-lg font-semibold text-foreground">
                            TOTAL COM COMISSÃO
                          </span>
                          <span className="text-2xl font-bold text-amber-500">
                            {formatCurrencyBRL(result.totalWithOver)}
                          </span>
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
                  {(result.gpuUsdTotal ?? 0) > 0 && (
                    <div className="text-xs text-muted-foreground py-2 border-t border-border">
                      GPU: USD {formatCurrency(result.gpuUsdTotal)} × {fx} = R${" "}
                      {formatCurrency(result.gpuBrlTotal)}
                    </div>
                  )}
                </>
              )}

              {/* Actions */}
              <div className="space-y-2 pt-4 border-t border-border">
                {/* Commission checkbox - only show if there's commission configured */}
                {result && (result.overValue ?? 0) > 0 && (
                  <div className="flex items-center gap-2 pb-2">
                    <input
                      type="checkbox"
                      id="includeCommission"
                      checked={includeCommissionInPdf}
                      onChange={(e) =>
                        setIncludeCommissionInPdf(e.target.checked)
                      }
                      className="rounded border-border"
                    />
                    <label
                      htmlFor="includeCommission"
                      className="text-xs text-muted-foreground cursor-pointer"
                    >
                      Incluir comissão no PDF
                    </label>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="open-outline"
                    onClick={() => form.onSubmit()}
                    disabled={form.isLoading}
                  >
                    {form.isLoading ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4 mr-2" />
                    )}
                    {form.isLoading ? "Salvando..." : "Salvar"}
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
                <Button
                  variant="ghost"
                  className="w-full text-muted-foreground"
                  onClick={() => form.setData(INITIAL_DATA)}
                >
                  Nova Proposta
                </Button>
              </div>
            </OpenCard>
          </div>
        </div>
      </main>
    </div>
  );
};

export default OpenCalculator;

const ServerVm = (props: {
  server: CalculatorProposalServer;
  expandedItems: Set<string>;
  toggleExpand: (name: string) => void;
  remove: (name: string) => void;
  form: UseFormReturn<CalculatorProposal>;
  config: ReturnType<typeof useCalculatorConfig>;
  index: number;
  getServerSpecValue: (index: number, config: { id: number }) => number;
  onServerSpecChange: (
    e: React.ChangeEvent<HTMLInputElement>,
    index: number,
    config: { id: number },
  ) => void;
}) => {
  return (
    <BaseServer
      server={props.server}
      expandedItems={props.expandedItems}
      toggleExpand={props.toggleExpand}
      remove={props.remove}
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <InputWithLabel
          type="number"
          label="Qtd Servidores"
          value={props.form.data.servers[props.index].quantity}
          onChange={(e) =>
            props.form.setData({
              ...props.form.data,
              servers: props.form.data.servers.map((srv, idx) =>
                idx === props.index
                  ? { ...srv, quantity: parseInt(e.target.value) || 1 }
                  : srv,
              ),
            })
          }
        />

        <InputWithLabel
          type="number"
          label={props.config?.ipPublico?.label}
          value={props.getServerSpecValue(props.index, props.config.ipPublico)}
          onChange={(e) =>
            props.onServerSpecChange(e, props.index, {
              id: props.config.ipPublico.id,
            })
          }
        />

        <SelectWithLabel
          label="GPU"
          options={props.config.gpus.map((config) => ({
            label: config?.label,
            value: config?.key,
          }))}
        />

        <InputWithLabel
          type="number"
          label={props.config?.vcpu?.label}
          value={props.getServerSpecValue(props.index, props.config.vcpu)}
          onChange={(e) =>
            props.onServerSpecChange(e, props.index, {
              id: props.config.vcpu.id,
            })
          }
        />

        <InputWithLabel
          type="number"
          label={props.config?.ram?.label}
          value={props.getServerSpecValue(props.index, props.config.ram)}
          onChange={(e) =>
            props.onServerSpecChange(e, props.index, {
              id: props.config.ram.id,
            })
          }
        />

        <InputWithLabel
          type="number"
          step={50}
          label={props.config?.nvme?.label}
          value={props.getServerSpecValue(props.index, props.config.nvme)}
          onChange={(e) =>
            props.onServerSpecChange(e, props.index, {
              id: props.config.nvme.id,
            })
          }
        />
      </div>
    </BaseServer>
  );
};

const BaseServer = (props: {
  server: CalculatorProposalServer;
  expandedItems: Set<string>;
  toggleExpand: (name: string) => void;
  remove: (name: string) => void;
  children?: React.ReactNode;
}) => {
  const isExpanded = props.expandedItems.has(props.server.name);
  const isEmptyVM = props.server.type === "vm" && false; //!isVMValid(item);

  return (
    <div
      key={props.server.name}
      className={`border rounded-lg overflow-hidden bg-card/50 ${
        isEmptyVM ? "border-destructive border-2" : "border-border"
      }`}
    >
      {/* Header */}
      <div
        className={`flex items-center justify-between px-4 py-3 cursor-pointer ${
          isEmptyVM ? "bg-destructive/10" : "bg-muted/30"
        }`}
        onClick={() => props.toggleExpand(props.server.name)}
      >
        <div className="flex items-center gap-3">
          <ProductIcon
            type="vm"
            size={18}
            className={isEmptyVM ? "text-destructive" : "text-emerald-400"}
          />
          <span
            className={`text-white text-xs font-bold uppercase px-2 py-1 rounded-full ${
              isEmptyVM ? "bg-destructive" : "bg-emerald-500"
            }`}
          >
            VM
          </span>
          <span className="font-medium text-foreground">
            {props.server.name}
          </span>
          {isEmptyVM && (
            <span className="text-xs text-destructive font-medium">
              (Sem recursos definidos)
            </span>
          )}
          <span className="text-xs text-muted-foreground">
            {props.server.quantity}x servidor(es)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              props.remove(props.server.name);
            }}
            className="h-8 w-8 text-destructive hover:bg-destructive/20"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </div>
      </div>

      <div className="p-4 space-y-4">{props.children}</div>
    </div>
  );
};
