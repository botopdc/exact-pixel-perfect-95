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

export interface ApiUser {
  id: number;
  uuid: string;
  entity_id: number;
  name: string;
  email: string;
  level: number; // 1=Cliente, 600=RH, 700=Comercial, 750=Gerente Comercial, 775=CS, 900=Suporte, 950=Gerente Suporte, 1000=Admin
  roles: string[];
  preferences: Record<string, unknown>;
  phones: string[];
  birthday: string | null;
  avatar: string | null;
  created_at: string;
  updated_at: string;
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
export const USER_LEVELS = {
  CLIENTE: 1,
  RH: 600,
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

  async getCurrentUser(): Promise<ApiUser> {
    const response = await this.client.get<ApiUser>('/auth/me');
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
      
      switch (item.category) {
        case 'Geral':
          if (item.section === 'Configurações Gerais') {
            for (const entry of configData || []) {
              if (entry.label === 'FX Padrão') config.fx_default = entry.price || 5.5;
            }
          }
          if (item.section === 'Descontos por Prazo') {
            for (const entry of configData || []) {
              const months = entry.label?.replace(' meses', '').replace(' mês', '');
              if (months) config.discount[months] = (entry.price || 0) / 100;
            }
          }
          break;
          
        case 'VM':
          if (item.section === 'Preços de VM') {
            for (const entry of configData || []) {
              if (entry.label === 'vCPU') config.vm_prices_brl.vcpu = entry.price || 0;
              if (entry.label === 'RAM por GB') config.vm_prices_brl.ram_per_gb = entry.price || 0;
              if (entry.label === 'NVMe por GB') config.vm_prices_brl.nvme_per_gb = entry.price || 0;
              if (entry.label === 'IP Público') config.vm_prices_brl.ip_public = entry.price || 0;
            }
          }
          break;
          
        case 'GPU':
          for (const entry of configData || []) {
            if (entry.label) config.gpu_usd[entry.label] = entry.price || 0;
          }
          break;
          
        case 'BareMetal':
          if (item.section === 'Modelos de CPU') {
            config.baremetal.cpu_models = (configData || []).map((e: any) => ({
              id: e.label || '',
              label: e.label || '',
              price: e.price || 0,
            }));
          }
          if (item.section === 'Tiers de RAM') {
            config.baremetal.ram_tiers = (configData || []).map((e: any) => ({
              id: e.label || '',
              label: e.label || '',
              gb: e.gb || 0,
              price: e.price || 0,
            }));
          }
          if (item.section === 'Discos') {
            config.baremetal.disks = (configData || []).map((e: any) => ({
              id: e.label || '',
              label: e.label || '',
              tb: e.tb || 0,
              price: e.price || 0,
            }));
          }
          break;
          
        case 'Add-ons':
          for (const entry of configData || []) {
            if (entry.label) config.addons_brl[entry.label] = entry.price || 0;
          }
          break;
          
        case 'Storage':
          if (!config.storage_prices) config.storage_prices = {};
          for (const entry of configData || []) {
            if (entry.label) config.storage_prices[entry.label] = entry.price || 0;
          }
          break;
          
        case 'Kubernetes':
          if (!config.kubernetes_pricing) config.kubernetes_pricing = {};
          if (!config.kubernetes_addons_pricing) config.kubernetes_addons_pricing = {};
          for (const entry of configData || []) {
            if (entry.type === 'addon') {
              config.kubernetes_addons_pricing[entry.label] = entry.price || 0;
            } else {
              config.kubernetes_pricing[entry.label] = { basePriceMonthly: entry.price || 0 };
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

  async getProposal(id: number): Promise<unknown> {
    const response = await this.client.get(`/calculator/proposal/${id}`);
    return response.data;
  }

  async updateProposal(id: number, data: unknown): Promise<unknown> {
    const response = await this.client.put(`/calculator/proposal/${id}`, data);
    return response.data;
  }

  async deleteProposal(id: number): Promise<void> {
    await this.client.delete(`/calculator/proposal/${id}`);
  }

  // ============================================================================
  // USERS ENDPOINTS
  // ============================================================================

  async getUsers(params?: {
    name?: string;
    email?: string;
    level?: number;
    __page?: number;
    __perPage?: number;
  }): Promise<{ data: ApiUser[]; total: number }> {
    const response = await this.client.get('/user', { params });
    return response.data;
  }

  async getUser(id: string | number): Promise<ApiUser> {
    const response = await this.client.get(`/user/${id}`);
    return response.data;
  }
}

// Singleton instance
export const openApi = new OpenApiClient();
