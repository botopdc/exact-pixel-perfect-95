// ============================================================================
// OPEN API CLIENT - HTTP Client for OPDC API
// ============================================================================

import axios, { AxiosError, AxiosInstance } from 'axios';
import { toast } from 'sonner';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
if (!API_BASE_URL) {
  throw new Error('VITE_API_BASE_URL não está definida. Configure a variável de ambiente.');
}
const AUTH_TOKEN_KEY = 'open_access_token';
const LEGACY_AUTH_TOKEN_KEY = 'open_api_token';
const INTERNAL_SESSION_KEY = 'open_auth_session_v1';
const PARTNER_SESSION_KEY = 'open_partner_session_v1';

// ============================================================================
// ADDON LABEL MAP - Technical keys for addons (never use visual labels as keys)
// ============================================================================

const ADDON_LABEL_TO_KEY: Record<string, string> = {
  'Antivírus': 'antivirus_unit',
  'Antivirus': 'antivirus_unit',
  'Firewall pfSense': 'firewall_pfsense',
  'TSplus': 'tsplus_unit',
  'CAL': 'cal_unit',
  'Veeam VM': 'veeam_vm_unit',
  'Veeam Agent': 'veeam_agent_unit',
  'WinServer(2vCPU/unid.)': 'winserver_2vcpu_unit',
};

// Storage Advanced labels to keys
const STORAGE_LABEL_TO_KEY: Record<string, { region: 'br' | 'usa'; tier: string } | { type: 'nvme' }> = {
  'sas_br_pricePerTB_1_10': { region: 'br', tier: 'pricePerTB_1_10' },
  'sas_br_pricePerTB_11_100': { region: 'br', tier: 'pricePerTB_11_100' },
  'sas_br_pricePerTB_101_500': { region: 'br', tier: 'pricePerTB_101_500' },
  'sas_br_pricePerTB_501_1024': { region: 'br', tier: 'pricePerTB_501_1024' },
  'sas_br_pricePerTB_gt_1024': { region: 'br', tier: 'pricePerTB_gt_1024' },
  'sas_usa_pricePerTB_1_10': { region: 'usa', tier: 'pricePerTB_1_10' },
  'sas_usa_pricePerTB_11_100': { region: 'usa', tier: 'pricePerTB_11_100' },
  'sas_usa_pricePerTB_101_500': { region: 'usa', tier: 'pricePerTB_101_500' },
  'sas_usa_pricePerTB_501_1024': { region: 'usa', tier: 'pricePerTB_501_1024' },
  'sas_usa_pricePerTB_gt_1024': { region: 'usa', tier: 'pricePerTB_gt_1024' },
  'nvme_pricePerGB': { type: 'nvme' },
};

// ============================================================================
// TYPES
// ============================================================================

// Company entity from API
export interface ApiCompany {
  id: number;
  uuid?: string;
  name: string;
  legal_name: string | null;
  docnum: string | null;
  work_area: string | null;
  city: string | null;
  uf: string | null;
  has_support: boolean | null;
  obs: string | null;
  created_at: string;
  updated_at: string;
}

// Forward declare for circular reference
export interface ApiPartner {
  id: number;
  name: string;
  docnum: string;
  type: 'ISV' | 'VAR' | 'FINDER';
  status: 'Pendente' | 'Aprovado' | 'Reprovado';
  responsible_id: number | null;
  responsible?: ApiUser | null;
  contract_accepted?: boolean;
  contract_accepted_at?: string | null;
  contract_version?: string | null;
  contract_ip?: string | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface ApiUser {
  id: number;
  uuid: string;
  entity_id: number;
  name: string;
  email: string;
  level: number; // 1=Cliente, 200=Parceiro, 600=RH, 680=BDR, 690=Arquiteto de soluções, 700=Comercial, 750=Gerente Comercial, 775=CS, 900=Suporte, 950=Gerente Suporte, 1000=Admin
  roles: string[];
  preferences: Record<string, unknown>;
  phones: string[];
  birthday: string | null;
  avatar: string | null;
  oauth_google?: string | null;
  hr_name?: string | null;
  email_verified_at?: string | null;
  can_receive_emails?: boolean;
  is_login_ldap?: boolean;
  last_login_at?: string | null;
  last_ip?: string | null;
  sprite?: string | null;
  obs?: string | null;
  demo?: boolean;
  authcode?: string | null;
  authcode_at?: string | null;
  cs_contact_preference?: string | null;
  created_by?: number | null;
  updated_by?: number | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  postponed?: boolean;
  docnum?: string | null;
  signer?: boolean;
  tags?: string[];
  // Partner data (when requested with __with=partner)
  partner?: ApiPartner | null;
}

export interface LoginResponse {
  user: ApiUser;
  token: string;
}

export interface ApiError {
  message: string;
  errors?: Record<string, string[]>;
}

// Article type from API
export interface ApiArticle {
  id: number;
  title: string;
  content: string;
  category: string;
  visibility: 'private' | 'internal';
  tags: string[];
  status: 'draft' | 'published';
  author: string;
  reading_time_minutes?: number;
  views_count?: number;
  helpful_yes?: number;
  helpful_no?: number;
  created_at: string;
  updated_at: string;
}

// Calculator config from API
export interface CalculatorConfigApiResponse {
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
    cpu_models: Array<{ id: string; label: string; price: number }>;
    ram_tiers: Array<{ id: string; label: string; gb: number; price: number }>;
    disks: Array<{ id: string; label: string; tb: number; price: number }>;
  };
  addons_brl: Record<string, number | Record<string, number>>;
  backup_tables_brl_per_gb: Record<string, Array<{ min: number; max: number; price: number }>>;
  open_saas_price_per_user?: number;
  storage_prices?: Record<string, number>;
  storage_pricing?: {
    sas: {
      br: Record<string, number>;
      usa: Record<string, number>;
    };
    nvme: { pricePerGB: number };
  };
  kubernetes_pricing?: Record<string, { basePriceMonthly: number }>;
  kubernetes_addons_pricing?: Record<string, number>;
}

// User level mapping
// 1=Cliente, 200=Parceiro, 600=RH, 680=BDR, 690=Arquiteto de soluções, 700=Comercial, 750=Gerente Comercial, 775=Sucesso do Cliente, 900=Suporte, 950=Gerente de Suporte, 1000=Admin
export const USER_LEVELS = {
  CLIENTE: 1,
  PARCEIRO: 200,
  RH: 600,
  BDR: 680,
  ARQUITETO_SOLUCOES: 690,
  COMERCIAL: 700,
  GERENTE_COMERCIAL: 750,
  SUCESSO_CLIENTE: 775,
  SUPORTE: 900,
  GERENTE_SUPORTE: 950,
  ADMIN: 1000,
} as const;

// ============================================================================
// API CLIENT
// ============================================================================

class OpenApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    // Request interceptor - add auth token
    this.client.interceptors.request.use((config) => {
      const token = this.getToken();
      const headers: any = config.headers ?? {};

      headers.Accept = headers.Accept ?? 'application/json';

      // Only set JSON content-type for non-multipart requests
      if (!(typeof FormData !== 'undefined' && config.data instanceof FormData)) {
        headers['Content-Type'] = headers['Content-Type'] ?? 'application/json';
      }

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      config.headers = headers;
      return config;
    });

    // Response interceptor - handle errors
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError<ApiError>) => {
        const status = error.response?.status;

        if (status === 401 || status === 403) {
          this.clearToken();
          localStorage.removeItem(INTERNAL_SESSION_KEY);
          localStorage.removeItem(PARTNER_SESSION_KEY);

          const pathname = window.location.pathname;
          const isPartner = pathname.startsWith('/parceiro');
          const loginPath = isPartner ? '/parceiro/login' : '/login';

          // Avoid redirect loops
          if (!pathname.startsWith(loginPath)) {
            toast.error('Sessão expirada. Faça login novamente.');
            window.location.replace(loginPath);
          }
        }

        if (status && status >= 500) {
          console.error('[API] Erro no servidor:', {
            status,
            url: error.config?.url,
            data: error.response?.data,
          });
        }

        return Promise.reject(error);
      }
    );
  }

  // Token management
  getToken(): string | null {
    return localStorage.getItem(AUTH_TOKEN_KEY) || localStorage.getItem(LEGACY_AUTH_TOKEN_KEY);
  }

  setToken(token: string): void {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    // Backwards-compatible key (older builds)
    localStorage.setItem(LEGACY_AUTH_TOKEN_KEY, token);
  }

  clearToken(): void {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(LEGACY_AUTH_TOKEN_KEY);
  }

  // ============================================================================
  // AUTH ENDPOINTS
  // ============================================================================

  async login(email: string, password: string): Promise<LoginResponse> {
    const response = await this.client.post<LoginResponse>('/auth/login', {
      email,
      password,
    });
    
    // Store token
    this.setToken(response.data.token);
    
    return response.data;
  }

  async getCurrentUser(params?: {
    __with?: string; // e.g. 'partner' to include partner data
  }): Promise<ApiUser & { partner?: ApiPartner | null }> {
    const response = await this.client.get<ApiUser & { partner?: ApiPartner | null }>('/auth/me', { params });
    return response.data;
  }

  async requestPasswordReset(email: string): Promise<{ success: boolean; message?: string }> {
    // POST to password reset endpoint - always returns success for security
    try {
      const response = await this.client.post<{ success: boolean; message?: string }>('/auth/forgot-password', {
        email: email.toLowerCase().trim(),
      });
      return response.data;
    } catch {
      // Return success even on error to not expose if email exists
      return { success: true };
    }
  }

  // ============================================================================
  // CALCULATOR CONFIG ENDPOINTS
  // ============================================================================

  async getCalculatorConfig(): Promise<CalculatorConfigApiResponse> {
    // API returns paginated response with 'data' array
    const response = await this.client.get<{ data: Array<{ category: string; section: string; config: unknown }> }>('/calculator/config', {
      params: { __perPage: 100 }
    });
    
    // Transform paginated config items into flat config object
    const configItems = response.data.data || [];
    return this.parseConfigItems(configItems);
  }

  // Parse config items from API into CalculatorConfigApiResponse
  private parseConfigItems(items: Array<{ category: string; section: string; config: unknown }>): CalculatorConfigApiResponse {
    const config: CalculatorConfigApiResponse = {
      fx_default: 1.0, // Fixed at 1 - all prices are now in BRL
      discount: { '1': 0, '12': 0.05, '24': 0.10, '36': 0.12, '48': 0.15 },
      gpu_usd: {}, // Field name kept for compatibility, but values are now in BRL
      vm_prices_brl: { vcpu: 0, ram_per_gb: 0, nvme_per_gb: 0, ip_public: 0 },
      baremetal: { cpu_models: [], ram_tiers: [], disks: [] },
      // CRITICAL: Initialize addons_brl with sql as empty object to prevent null-safety crashes
      addons_brl: {
        antivirus_unit: 0,
        firewall_pfsense: 0,
        tsplus_unit: 0,
        cal_unit: 0,
        sql: {}, // Always initialize sql to prevent Object.keys() crash
        veeam_vm_unit: 0,
        veeam_agent_unit: 0,
        winserver_2vcpu_unit: 45.0,
      },
      backup_tables_brl_per_gb: {},
      // Initialize storage_pricing structure
      storage_pricing: {
        sas: {
          br: { pricePerTB_1_10: 119, pricePerTB_11_100: 99, pricePerTB_101_500: 75, pricePerTB_501_1024: 55, pricePerTB_gt_1024: 45 },
          usa: { pricePerTB_1_10: 99, pricePerTB_11_100: 79, pricePerTB_101_500: 55, pricePerTB_501_1024: 45, pricePerTB_gt_1024: 42 },
        },
        nvme: { pricePerGB: 0.90 },
      },
    };

    for (const item of items) {
      const category = String(item.category ?? '').trim().toLowerCase();
      const section = String(item.section ?? '').trim().toLowerCase();
      const configData = Array.isArray(item.config) ? (item.config as any[]) : [];

      // Helper: get value from entry (API uses `value`, but accept `price` for backward compat)
      const getValue = (entry: any, defaultValue: number = 0): number => {
        return entry.value ?? entry.price ?? defaultValue;
      };

      switch (category) {
        case 'geral':
          if (section === 'configurações gerais') {
            // FX is now fixed at 1, ignore API value
            config.fx_default = 1.0;
          }
          if (section === 'descontos por prazo') {
            for (const entry of configData || []) {
              const months = entry.label?.replace(' meses', '').replace(' mês', '');
              if (months) config.discount[months] = getValue(entry) / 100;
            }
          }
          break;

        case 'vm':
          if (section === 'preços de vm') {
            for (const entry of configData || []) {
              const v = getValue(entry);
              if (entry.label === 'vCPU') config.vm_prices_brl.vcpu = v;
              // CSV uses "RAM" with "by: GB", not "RAM por GB"
              if (entry.label === 'RAM') config.vm_prices_brl.ram_per_gb = v;
              // CSV uses "NVMe" with "by: GB", not "NVMe por GB"
              if (entry.label === 'NVMe') config.vm_prices_brl.nvme_per_gb = v;
              if (entry.label === 'IP Público') config.vm_prices_brl.ip_public = v;
            }
          }
          break;

        case 'gpu':
          for (const entry of configData || []) {
            if (entry?.label) config.gpu_usd[entry.label] = getValue(entry);
          }
          break;
          
        case 'baremetal':
          // Match case-insensitive section names
          if (section === 'modelos de cpu') {
            config.baremetal.cpu_models = (configData || []).map((e: any) => ({
              id: e.label || '',
              label: e.label || '',
              price: getValue(e),
            }));
          }
          // Match exact section name from API: "Opções de RAM"
          if (section === 'opções de ram') {
            config.baremetal.ram_tiers = (configData || []).map((e: any) => {
              // Extract GB from label if not provided (e.g., "128GB" -> 128)
              let gb = e.gb || 0;
              if (!gb && e.label) {
                const match = e.label.match(/^(\d+)GB$/i);
                if (match) gb = parseInt(match[1], 10);
              }
              return {
                id: e.label || '',
                label: e.label || '',
                gb,
                price: getValue(e),
              };
            });
          }
          // Match exact section name from API: "Opções de Disco"
          if (section === 'opções de disco') {
            config.baremetal.disks = (configData || []).map((e: any) => {
              // Extract TB from label if not provided (e.g., "1TB NVMe" -> 1)
              let tb = e.tb || 0;
              if (!tb && e.label) {
                const match = e.label.match(/^(\d+)TB/i);
                if (match) tb = parseInt(match[1], 10);
              }
              return {
                id: e.label || '',
                label: e.label || '',
                tb,
                price: getValue(e),
              };
            });
          }
          break;
          
        case 'add-ons':
          // Handle different Add-ons sections
          if (section === 'serviços especializados') {
            // ID 16 - Serviços Especializados
            // Labels from API: support_basic, support_intermediate, support_advanced, consulting_hours, dba_hours
            for (const entry of configData || []) {
              if (entry.label) {
                const v = getValue(entry);
                // Map API labels directly to addons_brl keys
                if (entry.label === 'support_basic') config.addons_brl.support_basic = v;
                else if (entry.label === 'support_intermediate') config.addons_brl.support_intermediate = v;
                else if (entry.label === 'support_advanced') config.addons_brl.support_advanced = v;
                else if (entry.label === 'consulting_hours') config.addons_brl.consulting_hours = v;
                else if (entry.label === 'dba_hours') config.addons_brl.dba_hours = v;
              }
            }
          } else if (section === 'windows server') {
            // ID 17 - Windows Server (standalone config)
            for (const entry of configData || []) {
              if (entry.label === 'winserver_2vcpu_unit') {
                config.addons_brl.winserver_2vcpu_unit = getValue(entry);
              }
            }
          } else {
            // ID 6 - Standard Add-ons
            // Use technical keys, not visual labels
            // NOTE: Preserve the sql object when adding other addons
            for (const entry of configData || []) {
              if (entry.label) {
                const technicalKey = ADDON_LABEL_TO_KEY[entry.label] || entry.label;
                // Don't overwrite sql object with a scalar
                if (technicalKey !== 'sql') {
                  config.addons_brl[technicalKey] = getValue(entry);
                }
              }
            }
          }
          break;
          
        case 'storage':
          // Handle legacy "Preços de Storage"
          if (section === 'preços de storage') {
            if (!config.storage_prices) config.storage_prices = {};
            for (const entry of configData || []) {
              if (entry.label) config.storage_prices[entry.label] = getValue(entry);
            }
          }
          // Handle new "Storage Avançado" or "Storage SAS" or "SSD NVMe"
          if (section === 'storage avançado' || section === 'storage sas' || section === 'ssd nvme') {
            // Ensure storage_pricing is initialized
            if (!config.storage_pricing) {
              config.storage_pricing = {
                sas: {
                  br: { pricePerTB_1_10: 119, pricePerTB_11_100: 99, pricePerTB_101_500: 75, pricePerTB_501_1024: 55, pricePerTB_gt_1024: 45 },
                  usa: { pricePerTB_1_10: 99, pricePerTB_11_100: 79, pricePerTB_101_500: 55, pricePerTB_501_1024: 45, pricePerTB_gt_1024: 42 },
                },
                nvme: { pricePerGB: 0.90 },
              };
            }
            
            for (const entry of configData || []) {
              const mapping = STORAGE_LABEL_TO_KEY[entry.label];
              if (mapping) {
                const v = getValue(entry);
                if ('type' in mapping && mapping.type === 'nvme') {
                  config.storage_pricing.nvme.pricePerGB = v;
                } else if ('region' in mapping) {
                  (config.storage_pricing.sas[mapping.region] as any)[mapping.tier] = v;
                }
              }
            }
          }
          break;
          
        case 'kubernetes':
          if (!config.kubernetes_pricing) config.kubernetes_pricing = {};
          if (!config.kubernetes_addons_pricing) config.kubernetes_addons_pricing = {};
          
          if (section === 'planos kubernetes') {
            for (const entry of configData || []) {
              const v = getValue(entry);
              config.kubernetes_pricing[entry.label] = { basePriceMonthly: v };
            }
          }
          if (section === 'add-ons kubernetes') {
            for (const entry of configData || []) {
              const v = getValue(entry);
              config.kubernetes_addons_pricing[entry.label] = v;
            }
          }
          break;
          
        case 'sql server':
          // SQL prices go into addons_brl.sql
          // Ensure sql is always an object (already initialized above, but defensive check)
          if (!config.addons_brl.sql || typeof config.addons_brl.sql !== 'object') {
            config.addons_brl.sql = {};
          }
          for (const entry of configData || []) {
            if (entry.label) {
              const sqlKey = entry.label.toLowerCase() === 'nenhum' ? 'none' : entry.label.toLowerCase();
              (config.addons_brl.sql as Record<string, number>)[sqlKey] = getValue(entry);
            }
          }
          break;
          
        case 'backup':
          // Parse backup pricing table from API format
          // Format: label = "7_dias_1_100" or "7_dias_501_plus", value = 0.5
          for (const entry of configData || []) {
            if (!entry.label) continue;
            
            // Parse label like "7_dias_1_100" → retention=7, min=1, max=100
            // Also handle "7_dias_501_plus" → retention=7, min=501, max=999999
            const matchStandard = entry.label.match(/^(\d+)_dias_(\d+)_(\d+)$/);
            const matchPlus = entry.label.match(/^(\d+)_dias_(\d+)_plus$/);
            
            let retention: string | null = null;
            let min = 0;
            let max = 0;
            
            if (matchStandard) {
              retention = matchStandard[1];
              min = parseInt(matchStandard[2], 10);
              max = parseInt(matchStandard[3], 10);
            } else if (matchPlus) {
              retention = matchPlus[1];
              min = parseInt(matchPlus[2], 10);
              max = 999999; // "plus" means unlimited
            }
            
            if (retention) {
              const price = getValue(entry);
              
              if (!config.backup_tables_brl_per_gb[retention]) {
                config.backup_tables_brl_per_gb[retention] = [];
              }
              
              config.backup_tables_brl_per_gb[retention].push({ min, max, price });
            }
          }
          
          // Sort each retention's ranges by min value
          for (const retention of Object.keys(config.backup_tables_brl_per_gb)) {
            config.backup_tables_brl_per_gb[retention].sort((a, b) => a.min - b.min);
          }
          break;
      }
    }

    return config;
  }

  // ============================================================================
  // PROPOSALS ENDPOINTS
  // ============================================================================

  async getProposals(params?: {
    channel_type?: 'PARCEIRO' | 'CLIENTE';
    email?: string;
    status?: string;
    __page?: number;
    __perPage?: number;
    __with?: string;
    __order?: string;
    __q?: string;
  }): Promise<{ data: unknown[]; total: number; current_page?: number; last_page?: number }> {
    // Always include creator for RBAC and executive column display
    // Always order by id:DESC for newest first
    const enrichedParams = {
      ...params,
      __with: params?.__with || 'creator',
      __order: params?.__order || 'id:DESC',
    };
    const response = await this.client.get('/calculator/proposal', { params: enrichedParams });
    return response.data;
  }

  /**
   * Create a new proposal with optional file upload
   * Uses multipart/form-data when file is provided
   * 
   * @param data - Proposal data
   * @param file - Optional PDF file blob to attach
   */
  async createProposal(data: unknown, file?: Blob): Promise<unknown> {
    if (file) {
      // Use multipart/form-data to send data + file together
      const formData = this.buildProposalFormData(data, file);
      console.log('[openApi] Creating proposal with file:', { fileSize: file.size });
      
      const response = await this.client.post('/calculator/proposal', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data;
    }
    
    // Standard JSON request without file
    const response = await this.client.post('/calculator/proposal', data);
    return response.data;
  }

  async getProposal(idOrUuid: number | string, params?: { __with?: string }): Promise<unknown> {
    // Default to including files and creator for complete data in a single request
    const enrichedParams = {
      __with: params?.__with || 'files,creator',
    };
    const response = await this.client.get(`/calculator/proposal/${idOrUuid}`, { params: enrichedParams });
    return response.data;
  }

  /**
   * Update an existing proposal with optional file upload
   * Uses multipart/form-data when file is provided
   * 
   * @param id - Proposal numeric ID
   * @param data - Proposal data
   * @param file - Optional PDF file blob to attach
   */
  async updateProposal(id: number, data: unknown, file?: Blob): Promise<unknown> {
    if (file) {
      // Use multipart/form-data to send data + file together
      const formData = this.buildProposalFormData(data, file);
      console.log('[openApi] Updating proposal with file:', { id, fileSize: file.size });
      
      const response = await this.client.put(`/calculator/proposal/${id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data;
    }
    
    // Standard JSON request without file
    const response = await this.client.put(`/calculator/proposal/${id}`, data);
    return response.data;
  }
  
  /**
   * Build FormData from proposal data and file
   * Flattens nested objects and adds the file
   */
  private buildProposalFormData(data: unknown, file: Blob): FormData {
    const formData = new FormData();
    const payload = data as Record<string, any>;
    
    // Add all top-level fields
    for (const [key, value] of Object.entries(payload)) {
      if (value === null || value === undefined) continue;
      
      if (key === 'dados_proposta' || key === 'servers' || key === 'addons') {
        // Complex objects/arrays: serialize as JSON string
        formData.append(key, JSON.stringify(value));
      } else if (typeof value === 'object') {
        // Other objects: serialize as JSON string
        formData.append(key, JSON.stringify(value));
      } else {
        // Primitives: add directly
        formData.append(key, String(value));
      }
    }
    
    // Add the file
    formData.append('file', file, 'proposta.pdf');
    
    return formData;
  }

  async deleteProposal(id: number): Promise<void> {
    await this.client.delete(`/calculator/proposal/${id}`);
  }

  /**
   * Get approval token for a proposal
   * 
   * GET /api/calculator/proposal/{id}/get-approval-token
   * 
   * @param idOrUuid - Proposal ID (numeric) or UUID (string)
   * @returns Approval token for the proposal
   */
  async getProposalApprovalToken(idOrUuid: string | number): Promise<{ token: string }> {
    const response = await this.client.get<{ token: string }>(
      `/calculator/proposal/${idOrUuid}/get-approval-token`
    );
    return response.data;
  }

  /**
   * Define proposal acceptance (approve or reject)
   * 
   * POST /api/calculator/proposal/define-acceptance
   * 
   * CRITICAL: Per OpenAPI spec (DefineProposalAcceptanceRequest):
   * - status MUST be "Aprovado" or "Recusado" (NOT "Reprovado")
   * 
   * @param payload - Acceptance payload per DefineProposalAcceptanceRequest schema
   */
  async defineProposalAcceptance(payload: {
    proposal_id: number;
    approval_token: string;
    status: 'Aprovado' | 'Recusado'; // FIXED: "Recusado" not "Reprovado" per API spec
  }): Promise<void> {
    await this.client.post('/calculator/proposal/define-acceptance', payload);
  }

  // ============================================================================
  // USERS ENDPOINTS
  // ============================================================================

  async getUsers(params?: {
    __q?: string; // Search parameter
    name?: string;
    email?: string;
    level?: number;
    entity_id?: number;
    __page?: number;
    __perPage?: number;
    __with?: string;
    __order?: string;
  }): Promise<{ data: ApiUser[]; total: number; current_page?: number; last_page?: number }> {
    const response = await this.client.get('/user', { params });
    return response.data;
}

  // ============================================================================
  // ARTICLES ENDPOINTS
  // ============================================================================

  async getArticles(params?: {
    category?: string;
    author?: string;
    status?: string;
    title?: string;
    __page?: number;
    __perPage?: number;
  }): Promise<{ data: ApiArticle[]; total: number }> {
    const response = await this.client.get('/article', { params });
    return response.data;
  }

  async getArticle(id: number): Promise<ApiArticle> {
    const response = await this.client.get<ApiArticle>(`/article/${id}`);
    return response.data;
  }

  async createArticle(data: {
    title: string;
    content: string;
    category: string;
    visibility: 'private' | 'internal';
    tags?: string[];
    status: 'draft' | 'published';
    author: string;
  }): Promise<ApiArticle> {
    const response = await this.client.post<ApiArticle>('/article', data);
    return response.data;
  }

  async updateArticle(id: number, data: Partial<{
    title: string;
    content: string;
    category: string;
    visibility: 'private' | 'internal';
    tags: string[];
    status: 'draft' | 'published';
    author: string;
  }>): Promise<ApiArticle> {
    const response = await this.client.put<ApiArticle>(`/article/${id}`, data);
    return response.data;
  }

  async deleteArticle(id: number): Promise<void> {
    await this.client.delete(`/article/${id}`);
  }

  async incrementArticleViews(id: number): Promise<void> {
    await this.client.post(`/article/${id}/view`);
  }

  async rateArticle(id: number, helpful: boolean): Promise<void> {
    await this.client.post(`/article/${id}/rate`, { helpful });
  }

  async getUser(id: string | number): Promise<ApiUser> {
    const response = await this.client.get(`/user/${id}`);
    return response.data;
  }

  async createUser(data: {
    entity_id?: number;
    name: string;
    email: string;
    password: string;
    password_confirmation: string;
    level?: number;
    phones?: string[];
    birthday?: string | null;
    tags?: string[];
  }): Promise<ApiUser> {
    const response = await this.client.post<ApiUser>('/user', data);
    return response.data;
  }

  async updateUser(id: string | number, data: {
    entity_id?: number;
    name?: string;
    email?: string;
    password?: string;
    password_confirmation?: string;
    phones?: string[];
    birthday?: string | null;
    tags?: string[];
    is_active?: boolean;
  }): Promise<ApiUser> {
    const response = await this.client.put<ApiUser>(`/user/${id}`, data);
    return response.data;
  }

  async deleteUser(id: string | number): Promise<void> {
    await this.client.delete(`/user/${id}`);
  }

  // ============================================================================
  // PARTNERS ENDPOINTS
  // ============================================================================

  async createPartner(data: {
    name: string;
    docnum: string;
    type: 'ISV' | 'VAR' | 'FINDER';
    status?: 'Pendente' | 'Aprovado' | 'Reprovado';
    responsible_name?: string;
    responsible_email?: string;
    responsible_phone?: string[];
    responsible_password?: string;
    responsible_password_confirmation?: string;
  }): Promise<ApiPartner> {
    const response = await this.client.post<ApiPartner>('/partner', data);
    return response.data;
  }

  async getPartners(params?: {
    __q?: string;
    name?: string;
    type?: string;
    status?: string;
    __page?: number;
    __perPage?: number;
    __with?: string;
  }): Promise<{ data: ApiPartner[]; total: number; current_page?: number; last_page?: number }> {
    const response = await this.client.get('/partner', { params });
    return response.data;
  }

  async getPartner(id: string | number): Promise<ApiPartner> {
    const response = await this.client.get(`/partner/${id}`);
    return response.data;
  }

  async updatePartner(id: string | number, data: Partial<{
    name: string;
    docnum: string;
    type: 'ISV' | 'VAR' | 'FINDER';
    status: 'Pendente' | 'Aprovado' | 'Reprovado';
    responsible_id: number | null;
  }>): Promise<ApiPartner> {
    const response = await this.client.put<ApiPartner>(`/partner/${id}`, data);
    return response.data;
  }

  async deletePartner(id: string | number): Promise<void> {
    await this.client.delete(`/partner/${id}`);
  }

  // ============================================================================
  // FILE UPLOAD ENDPOINTS
  // ============================================================================

  async uploadProposalFile(proposalId: number | string, file: File): Promise<{ url: string; filename: string }> {
    const formData = new FormData();
    formData.append('file', file);
    
    // Use axios directly without default JSON headers for multipart/form-data
    const response = await this.client.post<{ url: string; filename: string }>(
      `/calculator/proposal/${proposalId}/file`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return response.data;
  }

  /**
   * Upload proposal PDF as blob
   * Used after saving a proposal to persist the generated PDF
   */
  async uploadProposalPdfBlob(proposalId: number | string, pdfBlob: Blob, filename: string): Promise<{ url: string; filename: string }> {
    const formData = new FormData();
    formData.append('file', pdfBlob, filename);
    
    console.log('[openApi] Uploading PDF blob:', { proposalId, filename, blobSize: pdfBlob.size, blobType: pdfBlob.type });
    
    // Use axios directly without default JSON headers for multipart/form-data
    const response = await this.client.post<{ url: string; filename: string }>(
      `/calculator/proposal/${proposalId}/file`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return response.data;
  }

  async getProposalFiles(proposalId: number | string): Promise<Array<{ id: number; filename: string; url: string; created_at: string }>> {
    const response = await this.client.get(`/calculator/proposal/${proposalId}/files`);
    return response.data;
  }

  async deleteProposalFile(proposalId: number | string, fileId: number): Promise<void> {
    await this.client.delete(`/calculator/proposal/${proposalId}/file/${fileId}`);
  }

  /**
   * Download proposal file from API
   * GET /api/calculator/proposal/{id}/file/download?token=
   * Returns the file as blob
   */
  async downloadProposalFile(proposalId: number | string, token: string): Promise<Blob> {
    const response = await this.client.get(
      `/calculator/proposal/${proposalId}/file/download`,
      {
        params: { token },
        responseType: 'blob',
      }
    );
    return response.data;
  }

  /**
   * Check if proposal has a file attached
   * Returns the file info or null if no file exists
   */
  async getProposalFileInfo(proposalId: number | string): Promise<{ has_file: boolean; file_url?: string; file_token?: string } | null> {
    try {
      const proposal = await this.getProposal(proposalId);
      // Check if proposal has file info
      const hasFile = !!(proposal as any).file_url || !!(proposal as any).file_path;
      return {
        has_file: hasFile,
        file_url: (proposal as any).file_url,
        file_token: (proposal as any).uuid, // UUID serves as file access token
      };
    } catch {
      return null;
    }
  }

  // ============================================================================
  // COMPANY ENDPOINTS
  // ============================================================================

  async getCompanies(params?: {
    __q?: string;
    name?: string;
    docnum?: string;
    city?: string;
    uf?: string;
    __page?: number;
    __perPage?: number;
    __order?: string;
  }): Promise<{ 
    data: ApiCompany[]; 
    total: number; 
    current_page: number; 
    last_page: number;
    per_page: number;
    from: number;
    to: number;
  }> {
    const response = await this.client.get('/company', { params });
    return response.data;
  }

  async getCompany(id: number | string): Promise<ApiCompany> {
    const response = await this.client.get(`/company/${id}`);
    return response.data;
  }

  async createCompany(data: {
    name: string;
    legal_name?: string | null;
    docnum?: string | null;
    work_area?: string | null;
    city?: string | null;
    uf?: string | null;
    has_support?: boolean | null;
    obs?: string | null;
  }): Promise<ApiCompany> {
    const response = await this.client.post<ApiCompany>('/company', data);
    return response.data;
  }

  async updateCompany(id: number | string, data: {
    name?: string;
    legal_name?: string | null;
    docnum?: string | null;
    work_area?: string | null;
    city?: string | null;
    uf?: string | null;
    has_support?: boolean | null;
    obs?: string | null;
  }): Promise<ApiCompany> {
    const response = await this.client.put<ApiCompany>(`/company/${id}`, data);
    return response.data;
  }

  async deleteCompany(id: number | string): Promise<void> {
    await this.client.delete(`/company/${id}`);
  }

  async searchCompanies(query: string): Promise<ApiCompany[]> {
    if (query.length < 2) return [];
    const response = await this.client.get('/company', {
      params: { __q: query, __perPage: 20 }
    });
    return response.data.data || [];
  }
}

// Export singleton instance
export const openApi = new OpenApiClient();
