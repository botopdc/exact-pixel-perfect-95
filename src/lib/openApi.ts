// ============================================================================
// OPEN API CLIENT - HTTP Client for OPDC API
// ============================================================================

import axios, { AxiosError, AxiosInstance } from 'axios';
import { toast } from 'sonner';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://apiv2.opendata.center/api';
const AUTH_TOKEN_KEY = 'open_access_token';
const LEGACY_AUTH_TOKEN_KEY = 'open_api_token';
const INTERNAL_SESSION_KEY = 'open_auth_session_v1';
const PARTNER_SESSION_KEY = 'open_partner_session_v1';

// ============================================================================
// TYPES
// ============================================================================

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

  // ============================================================================
  // CALCULATOR CONFIG ENDPOINTS
  // ============================================================================

  async getCalculatorConfig(): Promise<CalculatorConfigApiResponse> {
    // API returns paginated response with 'data' array
    const response = await this.client.get<{ data: Array<{ category: string; section: string; config: unknown }> }>('/calculator/config', {
      params: { __limit: 100 }
    });
    
    // Transform paginated config items into flat config object
    const configItems = response.data.data || [];
    return this.parseConfigItems(configItems);
  }

  // Parse config items from API into CalculatorConfigApiResponse
  private parseConfigItems(items: Array<{ category: string; section: string; config: unknown }>): CalculatorConfigApiResponse {
    const config: CalculatorConfigApiResponse = {
      fx_default: 5.5,
      discount: { '1': 0, '12': 0.05, '24': 0.10, '36': 0.15 },
      gpu_usd: {},
      vm_prices_brl: { vcpu: 0, ram_per_gb: 0, nvme_per_gb: 0, ip_public: 0 },
      baremetal: { cpu_models: [], ram_tiers: [], disks: [] },
      addons_brl: {},
      backup_tables_brl_per_gb: {},
    };

    for (const item of items) {
      const configData = item.config as any[];
      
      // Helper: get value from entry (API uses `value`, but accept `price` for backward compat)
      const getValue = (entry: any, defaultValue: number = 0): number => {
        return entry.value ?? entry.price ?? defaultValue;
      };
      
      switch (item.category) {
        case 'Geral':
          if (item.section === 'Configurações Gerais') {
            for (const entry of configData || []) {
              if (entry.label === 'FX Padrão') config.fx_default = getValue(entry, 5.5);
            }
          }
          if (item.section === 'Descontos por Prazo') {
            for (const entry of configData || []) {
              const months = entry.label?.replace(' meses', '').replace(' mês', '');
              if (months) config.discount[months] = getValue(entry) / 100;
            }
          }
          break;
          
        case 'VM':
          if (item.section === 'Preços de VM') {
            for (const entry of configData || []) {
              const v = getValue(entry);
              if (entry.label === 'vCPU') config.vm_prices_brl.vcpu = v;
              if (entry.label === 'RAM por GB') config.vm_prices_brl.ram_per_gb = v;
              if (entry.label === 'NVMe por GB') config.vm_prices_brl.nvme_per_gb = v;
              if (entry.label === 'IP Público') config.vm_prices_brl.ip_public = v;
            }
          }
          break;
          
        case 'GPU':
          for (const entry of configData || []) {
            if (entry.label) config.gpu_usd[entry.label] = getValue(entry);
          }
          break;
          
        case 'BareMetal':
          if (item.section === 'Modelos de CPU') {
            config.baremetal.cpu_models = (configData || []).map((e: any) => ({
              id: e.label || '',
              label: e.label || '',
              price: getValue(e),
            }));
          }
          if (item.section === 'Tiers de RAM') {
            config.baremetal.ram_tiers = (configData || []).map((e: any) => ({
              id: e.label || '',
              label: e.label || '',
              gb: e.gb || 0,
              price: getValue(e),
            }));
          }
          if (item.section === 'Discos') {
            config.baremetal.disks = (configData || []).map((e: any) => ({
              id: e.label || '',
              label: e.label || '',
              tb: e.tb || 0,
              price: getValue(e),
            }));
          }
          break;
          
        case 'Add-ons':
          for (const entry of configData || []) {
            if (entry.label) config.addons_brl[entry.label] = getValue(entry);
          }
          break;
          
        case 'Storage':
          if (!config.storage_prices) config.storage_prices = {};
          for (const entry of configData || []) {
            if (entry.label) config.storage_prices[entry.label] = getValue(entry);
          }
          break;
          
        case 'Kubernetes':
          if (!config.kubernetes_pricing) config.kubernetes_pricing = {};
          if (!config.kubernetes_addons_pricing) config.kubernetes_addons_pricing = {};
          for (const entry of configData || []) {
            const v = getValue(entry);
            if (entry.type === 'addon') {
              config.kubernetes_addons_pricing[entry.label] = v;
            } else {
              config.kubernetes_pricing[entry.label] = { basePriceMonthly: v };
            }
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
    __page?: number;
    __perPage?: number;
  }): Promise<{ data: unknown[]; total: number }> {
    const response = await this.client.get('/calculator/proposal', { params });
    return response.data;
  }

  async createProposal(data: unknown): Promise<unknown> {
    const response = await this.client.post('/calculator/proposal', data);
    return response.data;
  }

  async getProposal(idOrUuid: number | string): Promise<unknown> {
    const response = await this.client.get(`/calculator/proposal/${idOrUuid}`);
    return response.data;
  }

  async updateProposal(id: number, data: unknown): Promise<unknown> {
    const response = await this.client.put(`/calculator/proposal/${id}`, data);
    return response.data;
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

  async getUser(id: string | number): Promise<ApiUser> {
    const response = await this.client.get(`/user/${id}`);
    return response.data;
  }

  async createUser(data: {
    entity_id: number;
    name: string;
    email: string;
    password: string;
    password_confirmation: string;
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
    __page?: number;
    __perPage?: number;
    __with?: string; // e.g. 'responsible' to include user data
    id?: number;
    docnum?: string;
    name?: string;
    status?: 'Pendente' | 'Aprovado' | 'Reprovado';
    type?: 'ISV' | 'VAR' | 'FINDER';
  }): Promise<{ data: ApiPartner[]; total: number; current_page: number; last_page: number }> {
    const response = await this.client.get('/partner', { params });
    return response.data;
  }

  async getPartner(id: number): Promise<ApiPartner> {
    const response = await this.client.get<ApiPartner>(`/partner/${id}`);
    return response.data;
  }

  async updatePartner(id: number, data: {
    name?: string;
    docnum?: string;
    type?: 'ISV' | 'VAR' | 'FINDER';
    status?: 'Pendente' | 'Aprovado' | 'Reprovado';
    responsible_id?: number | null;
    contract_accepted?: boolean;
    contract_accepted_at?: string;
    contract_version?: string;
    contract_ip?: string;
  }): Promise<ApiPartner> {
    const response = await this.client.put<ApiPartner>(`/partner/${id}`, data);
    return response.data;
  }

  async deletePartner(id: number): Promise<void> {
    await this.client.delete(`/partner/${id}`);
  }

  // ============================================================================
  // ARTICLES ENDPOINTS
  // ============================================================================

  async getArticles(params?: {
    __page?: number;
    __perPage?: number;
    __limit?: number;
    category?: string;
    author?: string;
    status?: 'draft' | 'published';
    search?: string;
    title?: string;
  }): Promise<{ data: ApiArticle[]; total: number; current_page?: number; last_page?: number }> {
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
    views_count: number;
    helpful_yes: number;
    helpful_no: number;
  }>): Promise<ApiArticle> {
    const response = await this.client.put<ApiArticle>(`/article/${id}`, data);
    return response.data;
  }

  async deleteArticle(id: number): Promise<void> {
    await this.client.delete(`/article/${id}`);
  }

  async incrementArticleViews(id: number): Promise<void> {
    try {
      const article = await this.getArticle(id);
      await this.updateArticle(id, { views_count: (article.views_count || 0) + 1 });
    } catch (error) {
      console.warn('[API] Failed to increment article views:', error);
    }
  }

  async rateArticle(id: number, helpful: boolean): Promise<void> {
    try {
      const article = await this.getArticle(id);
      if (helpful) {
        await this.updateArticle(id, { helpful_yes: (article.helpful_yes || 0) + 1 });
      } else {
        await this.updateArticle(id, { helpful_no: (article.helpful_no || 0) + 1 });
      }
    } catch (error) {
      console.warn('[API] Failed to rate article:', error);
    }
  }
}

// API Article type matching external API
export interface ApiArticle {
  id: number;
  title: string;
  content: string;
  category: string;
  visibility: 'private' | 'internal';
  tags: string[];
  status: 'draft' | 'published';
  author: string;
  views_count: number;
  helpful_yes: number;
  helpful_no: number;
  reading_time_minutes: number;
  created_at: string;
  updated_at: string;
}

// Singleton instance
export const openApi = new OpenApiClient();
