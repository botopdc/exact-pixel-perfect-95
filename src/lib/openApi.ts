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

// Calculator config from API - NEW FLAT FORMAT
// Each item in the API response is: { id, label, value, meta: { category, section, by, type, ... } }
export interface CalculatorConfigFlatItem {
  id: number;
  label: string;
  value: number;
  meta: {
    category: string;
    section: string;
    by?: string;
    type?: string;
    region?: string;
    retention?: string;
    min?: number;
    max?: number;
    description?: string;
  };
  created_at?: string;
  updated_at?: string;
}

// Transformed config for internal use
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
  kubernetes_pricing?: Record<string, { basePriceMonthly: number; description?: string }>;
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
    // NEW FLAT FORMAT: each item is { id, label, value, meta: { category, section, by, type, ... } }
    const response = await this.client.get<{ data: CalculatorConfigFlatItem[]; total?: number }>('/calculator/config', {
      params: { __perPage: 500 } // Increased to ensure all items are fetched
    });
    
    console.log('[openApi] Calculator config raw response:', response.data.data?.length || 0, 'items');
    
    // Transform flat config items into structured config object
    const configItems = response.data.data || [];
    return this.parseFlatConfigItems(configItems);
  }

  // Parse FLAT config items from API into CalculatorConfigApiResponse
  // NEW FORMAT: Each item has { id, label, value, meta: { category, section, ... } }
  private parseFlatConfigItems(items: CalculatorConfigFlatItem[]): CalculatorConfigApiResponse {
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
          br: { pricePerTB_1_10: 0, pricePerTB_11_100: 0, pricePerTB_101_500: 0, pricePerTB_501_1024: 0, pricePerTB_gt_1024: 0 },
          usa: { pricePerTB_1_10: 0, pricePerTB_11_100: 0, pricePerTB_101_500: 0, pricePerTB_501_1024: 0, pricePerTB_gt_1024: 0 },
        },
        nvme: { pricePerGB: 0 },
      },
      kubernetes_pricing: {},
      kubernetes_addons_pricing: {},
    };

    console.log('[openApi] Parsing', items.length, 'flat config items');

    for (const item of items) {
      if (!item.meta) {
        console.warn('[openApi] Config item missing meta:', item);
        continue;
      }

      const category = String(item.meta.category ?? '').trim().toLowerCase();
      const section = String(item.meta.section ?? '').trim().toLowerCase();
      const label = String(item.label ?? '').trim();
      const value = Number(item.value) || 0;

      switch (category) {
        case 'geral':
          if (section === 'taxa de câmbio') {
            // FX is now fixed at 1, but store it anyway
            config.fx_default = value || 1.0;
          }
          if (section === 'descontos por vigência') {
            // Parse "12 meses" or "1 mês" → key "12" or "1"
            const months = label.replace(' meses', '').replace(' mês', '');
            if (months) {
              // Value is already percentage (e.g., 5 for 5%), convert to decimal
              config.discount[months] = value / 100;
            }
          }
          break;

        case 'vm':
          if (section === 'preços de vm') {
            if (label === 'vCPU') config.vm_prices_brl.vcpu = value;
            if (label === 'RAM') config.vm_prices_brl.ram_per_gb = value;
            if (label === 'NVMe') config.vm_prices_brl.nvme_per_gb = value;
            if (label === 'IP Público') config.vm_prices_brl.ip_public = value;
          }
          break;

        case 'gpu':
          if (section === 'preços de gpu' && label) {
            config.gpu_usd[label] = value;
          }
          break;

        case 'baremetal':
          if (section === 'modelos de cpu' && label) {
            config.baremetal.cpu_models.push({
              id: String(item.id),
              label,
              price: value,
            });
          }
          if (section === 'opções de ram' && label) {
            // Extract GB from label if not provided (e.g., "128GB" -> 128)
            let gb = 0;
            const match = label.match(/^(\d+)GB$/i);
            if (match) gb = parseInt(match[1], 10);
            
            config.baremetal.ram_tiers.push({
              id: String(item.id),
              label,
              gb,
              price: value,
            });
          }
          if (section === 'opções de disco' && label) {
            // Extract TB from label if not provided (e.g., "1TB NVMe" -> 1)
            let tb = 0;
            const match = label.match(/^(\d+)TB/i);
            if (match) tb = parseInt(match[1], 10);
            
            config.baremetal.disks.push({
              id: String(item.id),
              label,
              tb,
              price: value,
            });
          }
          break;

        case 'add-ons':
          if (section === 'add-ons') {
            // Map labels to technical keys
            const technicalKey = ADDON_LABEL_TO_KEY[label] || label;
            if (technicalKey !== 'sql') {
              config.addons_brl[technicalKey] = value;
            }
          }
          if (section === 'serviços especializados' && label) {
            // Map API labels directly to addons_brl keys
            config.addons_brl[label] = value;
          }
          if (section === 'windows server' && label) {
            if (label === 'winserver_2vcpu_unit' || label === 'WinServer(2vCPU/unid.)') {
              config.addons_brl.winserver_2vcpu_unit = value;
            }
          }
          break;

        case 'sql server':
          if (label) {
            const sqlKey = label.toLowerCase() === 'nenhum' ? 'none' : label.toLowerCase();
            (config.addons_brl.sql as Record<string, number>)[sqlKey] = value;
          }
          break;

        case 'storage':
          if (section === 'storage sas') {
            // Get region from meta
            const region = String(item.meta.region ?? '').toLowerCase();
            
            // Map labels to tier keys
            let tierKey = '';
            if (label === '1-10 TB') tierKey = 'pricePerTB_1_10';
            else if (label === '11-100 TB') tierKey = 'pricePerTB_11_100';
            else if (label === '101-500 TB') tierKey = 'pricePerTB_101_500';
            else if (label === '501-1024 TB') tierKey = 'pricePerTB_501_1024';
            else if (label === '>1024 TB') tierKey = 'pricePerTB_gt_1024';
            
            if (tierKey) {
              if (region === 'brasil' || region === 'br') {
                (config.storage_pricing!.sas.br as any)[tierKey] = value;
              } else if (region === 'estados unidos' || region === 'usa') {
                (config.storage_pricing!.sas.usa as any)[tierKey] = value;
              }
            }
          }
          if (section === 'ssd nvme' && (label === 'Preço por GB' || label === 'pricePerGB')) {
            config.storage_pricing!.nvme.pricePerGB = value;
          }
          break;

        case 'kubernetes':
          if (section === 'preços base dos planos' && label) {
            config.kubernetes_pricing![label] = { 
              basePriceMonthly: value,
              description: item.meta.description 
            };
          }
          if (section === 'add-ons kubernetes' && label) {
            config.kubernetes_addons_pricing![label] = value;
          }
          break;

        case 'backup':
          // Parse backup pricing from meta fields (retention, min, max) or label
          if (section === 'backup por retenção') {
            const retention = item.meta.retention?.replace(' dias', '') ?? '';
            const min = item.meta.min ?? 0;
            const max = item.meta.max ?? 999999;
            
            if (retention) {
              if (!config.backup_tables_brl_per_gb[retention]) {
                config.backup_tables_brl_per_gb[retention] = [];
              }
              config.backup_tables_brl_per_gb[retention].push({ min, max, price: value });
            }
          }
          break;
      }
    }

    // Sort backup ranges by min value
    for (const retention of Object.keys(config.backup_tables_brl_per_gb)) {
      config.backup_tables_brl_per_gb[retention].sort((a, b) => a.min - b.min);
    }

    console.log('[openApi] Parsed config:', {
      vm: config.vm_prices_brl,
      gpu_count: Object.keys(config.gpu_usd).length,
      cpu_count: config.baremetal.cpu_models.length,
      ram_count: config.baremetal.ram_tiers.length,
      disk_count: config.baremetal.disks.length,
    });

    return config;
  }

  // Legacy method for backwards compatibility - delegates to new parser
  private parseConfigItems(items: Array<{ category: string; section: string; config: unknown }>): CalculatorConfigApiResponse {
    // Convert old format to new flat format for parsing
    const flatItems: CalculatorConfigFlatItem[] = [];
    
    for (const item of items) {
      const category = item.category;
      const section = item.section;
      const configData = Array.isArray(item.config) ? (item.config as any[]) : [];
      
      for (const entry of configData) {
        flatItems.push({
          id: entry.id ?? 0,
          label: entry.label ?? '',
          value: entry.value ?? entry.price ?? 0,
          meta: {
            category,
            section,
            by: entry.by,
            type: entry.type,
          }
        });
      }
    }
    
    return this.parseFlatConfigItems(flatItems);
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
   * @param payload - Acceptance payload per DefineProposalAcceptanceRequest schema
   */
  async defineProposalAcceptance(payload: {
    proposal_id: number;
    approval_token: string;
    status: 'Aprovado' | 'Reprovado';
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
