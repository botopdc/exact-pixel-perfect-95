// ============================================================================
// OPEN API CLIENT - HTTP Client for OPDC API
// ============================================================================

import axios, { AxiosInstance, AxiosError } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://apiv2.opendata.center/api';
const AUTH_TOKEN_KEY = 'open_api_token';

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
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    // Request interceptor - add auth token
    this.client.interceptors.request.use((config) => {
      const token = this.getToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    // Response interceptor - handle errors
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError<ApiError>) => {
        if (error.response?.status === 401) {
          this.clearToken();
        }
        return Promise.reject(error);
      }
    );
  }

  // Token management
  getToken(): string | null {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  }

  setToken(token: string): void {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
  }

  clearToken(): void {
    localStorage.removeItem(AUTH_TOKEN_KEY);
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
    const response = await this.client.get<CalculatorConfigApiResponse>('/calculator-config');
    return response.data;
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
