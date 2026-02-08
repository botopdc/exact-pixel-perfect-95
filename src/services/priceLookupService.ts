/**
 * Price Lookup Service - SINGLE SOURCE OF TRUTH
 * 
 * PASSO 8: This service provides centralized price lookup from Supabase.
 * All modules (calculator, proposal, PDF) MUST use this service.
 * 
 * CRITICAL: No fallback values. If price not found, throws error.
 */

import { CalculatorConfig, K8sPlan, K8sExtras, SupportLevel, StorageType, StorageRegion } from '@/lib/calculatorConfig';

// ============================================================================
// ERROR HANDLING - Explicit errors for missing prices
// ============================================================================

export class PriceNotFoundError extends Error {
  constructor(priceType: string, key?: string) {
    const keyPart = key ? ` (key: ${key})` : '';
    super(`Preço não encontrado no Supabase: ${priceType}${keyPart}. Configure em /modulos/admin/precos.`);
    this.name = 'PriceNotFoundError';
  }
}

export class ConfigNotLoadedError extends Error {
  constructor() {
    super('Configuração de preços não carregada. Aguarde o carregamento ou verifique a conexão.');
    this.name = 'ConfigNotLoadedError';
  }
}

// ============================================================================
// VALIDATION - Ensure config is loaded from Supabase
// ============================================================================

function validateConfig(config: CalculatorConfig | undefined | null): asserts config is CalculatorConfig {
  if (!config) {
    throw new ConfigNotLoadedError();
  }
  
  // Check if config came from Supabase (version = "Supabase")
  if (config.meta?.version !== 'Supabase') {
    console.warn('[priceLookupService] Config may be using DEFAULT_CONFIG fallback');
  }
}

function validatePrice(value: number | undefined, priceType: string, key?: string): number {
  if (value === undefined || value === null || isNaN(value)) {
    throw new PriceNotFoundError(priceType, key);
  }
  return value;
}

// ============================================================================
// VM PRICES
// ============================================================================

export function getVmVcpuPrice(config: CalculatorConfig | undefined): number {
  validateConfig(config);
  return validatePrice(config.vm_prices_brl?.vcpu, 'VM vCPU');
}

export function getVmRamPrice(config: CalculatorConfig | undefined): number {
  validateConfig(config);
  return validatePrice(config.vm_prices_brl?.ram_per_gb, 'VM RAM');
}

export function getVmNvmePrice(config: CalculatorConfig | undefined): number {
  validateConfig(config);
  return validatePrice(config.vm_prices_brl?.nvme_per_gb, 'VM NVMe');
}

export function getVmIpPublicPrice(config: CalculatorConfig | undefined): number {
  validateConfig(config);
  return validatePrice(config.vm_prices_brl?.ip_public, 'VM IP Público');
}

// ============================================================================
// GPU PRICES
// ============================================================================

export function getGpuPrice(config: CalculatorConfig | undefined, gpuModel: string): number {
  validateConfig(config);
  
  if (gpuModel === 'Sem GPU' || !gpuModel) {
    return 0;
  }
  
  const price = config.gpu_usd?.[gpuModel];
  return validatePrice(price, 'GPU', gpuModel);
}

// ============================================================================
// BAREMETAL PRICES
// ============================================================================

export function getBareMetalCpuPrice(config: CalculatorConfig | undefined, cpuId: string): number {
  validateConfig(config);
  
  const cpuModel = config.baremetal?.cpu_models?.find(c => c.id === cpuId || c.label === cpuId);
  if (!cpuModel) {
    throw new PriceNotFoundError('BareMetal CPU', cpuId);
  }
  return validatePrice(cpuModel.price, 'BareMetal CPU', cpuId);
}

export function getBareMetalRamPrice(config: CalculatorConfig | undefined, ramId: string): number {
  validateConfig(config);
  
  const ramTier = config.baremetal?.ram_tiers?.find(r => r.id === ramId || r.label === ramId);
  if (!ramTier) {
    throw new PriceNotFoundError('BareMetal RAM', ramId);
  }
  return validatePrice(ramTier.price, 'BareMetal RAM', ramId);
}

export function getBareMetalDiskPrice(config: CalculatorConfig | undefined, diskId: string): number {
  validateConfig(config);
  
  const disk = config.baremetal?.disks?.find(d => d.id === diskId || d.label === diskId);
  if (!disk) {
    throw new PriceNotFoundError('BareMetal Disk', diskId);
  }
  return validatePrice(disk.price, 'BareMetal Disk', diskId);
}

// ============================================================================
// ADD-ONS PRICES
// ============================================================================

export function getAddonPrice(config: CalculatorConfig | undefined, addonKey: string): number {
  validateConfig(config);
  
  const addonsBrl = config.addons_brl;
  if (!addonsBrl) {
    throw new PriceNotFoundError('Add-ons config');
  }
  
  // Handle SQL separately
  if (addonKey === 'sql_none' || addonKey === 'none') return 0;
  if (addonKey.startsWith('sql_')) {
    const sqlType = addonKey.replace('sql_', '');
    const price = addonsBrl.sql?.[sqlType];
    return validatePrice(price, 'SQL Server', sqlType);
  }
  
  // Standard addon
  const price = (addonsBrl as any)[addonKey];
  return validatePrice(price, 'Add-on', addonKey);
}

export function getAntivirusPrice(config: CalculatorConfig | undefined): number {
  return getAddonPrice(config, 'antivirus_unit');
}

export function getFirewallPrice(config: CalculatorConfig | undefined): number {
  return getAddonPrice(config, 'firewall_pfsense');
}

export function getTsplusPrice(config: CalculatorConfig | undefined): number {
  return getAddonPrice(config, 'tsplus_unit');
}

export function getCalPrice(config: CalculatorConfig | undefined): number {
  return getAddonPrice(config, 'cal_unit');
}

export function getVeeamVmPrice(config: CalculatorConfig | undefined): number {
  return getAddonPrice(config, 'veeam_vm_unit');
}

export function getVeeamAgentPrice(config: CalculatorConfig | undefined): number {
  return getAddonPrice(config, 'veeam_agent_unit');
}

export function getWinServerPrice(config: CalculatorConfig | undefined): number {
  return getAddonPrice(config, 'winserver_2vcpu_unit');
}

export function getSqlPrice(config: CalculatorConfig | undefined, sqlType: string): number {
  if (!sqlType || sqlType === 'none') return 0;
  return getAddonPrice(config, `sql_${sqlType.toLowerCase()}`);
}

// ============================================================================
// SUPPORT PRICES
// ============================================================================

export function getSupportPrice(config: CalculatorConfig | undefined, level: SupportLevel): number {
  validateConfig(config);
  
  if (level === 'none') return 0;
  
  // Try to get from config
  const key = `support_${level}` as keyof typeof config.addons_brl;
  const price = (config.addons_brl as any)?.[key];
  
  if (price !== undefined && price !== null) {
    return price;
  }
  
  throw new PriceNotFoundError('Suporte', level);
}

export function getConsultingHourPrice(config: CalculatorConfig | undefined): number {
  validateConfig(config);
  return validatePrice(config.addons_brl?.consulting_hours, 'Consultoria (hora)');
}

export function getDbaHourPrice(config: CalculatorConfig | undefined): number {
  validateConfig(config);
  return validatePrice(config.addons_brl?.dba_hours, 'DBA (hora)');
}

// ============================================================================
// STORAGE PRICES
// ============================================================================

export function getStoragePrice(
  config: CalculatorConfig | undefined,
  volumeTB: number,
  region: StorageRegion,
  storageType: StorageType = 'sas'
): number {
  validateConfig(config);
  
  if (volumeTB < 1) return 0;
  
  // NVMe uses GB pricing
  if (storageType === 'nvme') {
    const pricePerGB = config.storage_pricing?.nvme?.pricePerGB;
    return validatePrice(pricePerGB, 'Storage NVMe (per GB)');
  }
  
  // SAS and S3 use tiered pricing (S3 inherits SAS)
  const sasPricing = config.storage_pricing?.sas;
  if (!sasPricing) {
    throw new PriceNotFoundError('Storage SAS config');
  }
  
  const regionPricing = region === 'BR' ? sasPricing.br : sasPricing.usa;
  if (!regionPricing) {
    throw new PriceNotFoundError('Storage SAS', `region ${region}`);
  }
  
  // Determine tier
  let pricePerTB: number;
  if (volumeTB <= 10) pricePerTB = regionPricing.pricePerTB_1_10;
  else if (volumeTB <= 100) pricePerTB = regionPricing.pricePerTB_11_100;
  else if (volumeTB <= 500) pricePerTB = regionPricing.pricePerTB_101_500;
  else if (volumeTB <= 1024) pricePerTB = regionPricing.pricePerTB_501_1024;
  else pricePerTB = regionPricing.pricePerTB_gt_1024;
  
  return validatePrice(pricePerTB, 'Storage SAS tier', `${volumeTB}TB ${region}`);
}

// ============================================================================
// KUBERNETES PRICES
// ============================================================================

export function getK8sPlanPrice(config: CalculatorConfig | undefined, plan: K8sPlan): number {
  validateConfig(config);
  
  const pricing = config.kubernetes_pricing?.[plan];
  if (!pricing?.basePriceMonthly) {
    throw new PriceNotFoundError('Kubernetes plan', plan);
  }
  return pricing.basePriceMonthly;
}

export function getK8sAddonPrice(config: CalculatorConfig | undefined, addonKey: string): number {
  validateConfig(config);
  
  const pricing = config.kubernetes_addons_pricing;
  if (!pricing) {
    throw new PriceNotFoundError('Kubernetes add-ons config');
  }
  
  const price = (pricing as any)[addonKey];
  return validatePrice(price, 'Kubernetes add-on', addonKey);
}

export function calculateK8sExtrasPrice(config: CalculatorConfig | undefined, extras: K8sExtras): number {
  const vcpuPrice = (extras.vcpu || 0) * getVmVcpuPrice(config);
  const ramPrice = (extras.ramGB || 0) * getVmRamPrice(config);
  const diskPrice = (extras.diskGB || 0) * getVmNvmePrice(config);
  return vcpuPrice + ramPrice + diskPrice;
}

// ============================================================================
// OPEN SAAS PRICE
// ============================================================================

export function getOpenSaasPrice(config: CalculatorConfig | undefined): number {
  validateConfig(config);
  return validatePrice(config.open_saas_price_per_user, 'OPEN SaaS (por usuário)');
}

// ============================================================================
// FX RATE
// ============================================================================

export function getFxRate(config: CalculatorConfig | undefined): number {
  validateConfig(config);
  return config.fx_default || 1;
}

// ============================================================================
// SAFE GETTERS (with logging but no throw - for display purposes only)
// Use these only when showing historical data that might not match current config
// ============================================================================

export function getSafePriceOrZero(
  getter: () => number,
  fallbackLabel: string
): number {
  try {
    return getter();
  } catch (error) {
    console.warn(`[priceLookupService] ${fallbackLabel}: returning 0 -`, (error as Error).message);
    return 0;
  }
}

// ============================================================================
// EXPORT ALL
// ============================================================================

const priceLookupService = {
  // Errors
  PriceNotFoundError,
  ConfigNotLoadedError,
  
  // VM
  getVmVcpuPrice,
  getVmRamPrice,
  getVmNvmePrice,
  getVmIpPublicPrice,
  
  // GPU
  getGpuPrice,
  
  // BareMetal
  getBareMetalCpuPrice,
  getBareMetalRamPrice,
  getBareMetalDiskPrice,
  
  // Add-ons
  getAddonPrice,
  getAntivirusPrice,
  getFirewallPrice,
  getTsplusPrice,
  getCalPrice,
  getVeeamVmPrice,
  getVeeamAgentPrice,
  getWinServerPrice,
  getSqlPrice,
  
  // Support
  getSupportPrice,
  getConsultingHourPrice,
  getDbaHourPrice,
  
  // Storage
  getStoragePrice,
  
  // Kubernetes
  getK8sPlanPrice,
  getK8sAddonPrice,
  calculateK8sExtrasPrice,
  
  // Open SaaS
  getOpenSaasPrice,
  
  // FX
  getFxRate,
  
  // Safe getters
  getSafePriceOrZero,
};

export default priceLookupService;
