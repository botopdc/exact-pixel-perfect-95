import axios from 'axios';
import {
  Job,
  JobFormData,
  JobFilters,
  JobStatus,
  ApiOpdcJob,
  mapApiJobToFrontend,
  mapFrontendToApiStore,
  mapFrontendToApiUpdate,
  STATUS_TO_API,
} from '@/types/job';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
if (!API_BASE_URL) {
  throw new Error('VITE_API_BASE_URL não está definida.');
}

const AUTH_TOKEN_KEY = 'open_access_token';

const getToken = (): string | null => {
  return localStorage.getItem(AUTH_TOKEN_KEY);
};

// Axios instance for authenticated requests
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Axios instance for public requests (no auth)
const publicClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

interface PaginatedResponse<T> {
  current_page: number;
  data: T[];
  from: number | null;
  last_page: number;
  per_page: number;
  to: number | null;
  total: number;
}

// Helper to generate slug
const generateSlug = (title: string): string => {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
};

// Helper to build query params from filters
const buildQueryParams = (filters?: JobFilters): Record<string, string> => {
  const params: Record<string, string> = {};
  
  if (filters?.search) {
    params.__q = filters.search;
  }
  if (filters?.status && filters.status !== 'all') {
    params.status = STATUS_TO_API[filters.status] || filters.status;
  }
  if (filters?.department && filters.department !== 'all') {
    params.department = filters.department;
  }
  if (filters?.seniority && filters.seniority !== 'all') {
    params.seniority = filters.seniority;
  }
  if (filters?.address) {
    params.address = filters.address;
  }
  
  return params;
};

export const jobsService = {
  /**
   * Lista todas as vagas (autenticado)
   * GET /api/opdc-job
   */
  async list(filters?: JobFilters): Promise<Job[]> {
    const params = buildQueryParams(filters);
    params.per_page = '100'; // Get all jobs
    
    const response = await apiClient.get<PaginatedResponse<ApiOpdcJob>>('/opdc-job', { params });
    
    return response.data.data.map(mapApiJobToFrontend);
  },

  /**
   * Lista vagas publicadas (público, sem auth)
   * GET /api/opdc-job - retorna apenas status=Publicada
   */
  async listPublished(): Promise<Job[]> {
    try {
      const params: Record<string, string> = {
        status: 'Publicada',
        per_page: '100',
      };
      
      const response = await publicClient.get<PaginatedResponse<ApiOpdcJob>>('/opdc-job', { params });
      
      return response.data.data.map(mapApiJobToFrontend);
    } catch (error) {
      console.error('Error fetching published jobs:', error);
      return [];
    }
  },

  /**
   * Busca vaga por ID
   * GET /api/opdc-job/{id}
   */
  async getById(id: string): Promise<Job | null> {
    try {
      const response = await apiClient.get<{ data: ApiOpdcJob }>(`/opdc-job/${id}`);
      return mapApiJobToFrontend(response.data.data);
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  },

  /**
   * Busca vaga por slug (público)
   * GET /api/opdc-job/{slug}
   */
  async getBySlug(slug: string): Promise<Job | null> {
    try {
      // Try public client first (for public pages)
      const response = await publicClient.get<{ data: ApiOpdcJob }>(`/opdc-job/${slug}`);
      return mapApiJobToFrontend(response.data.data);
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      // Try with auth if public fails
      try {
        const authResponse = await apiClient.get<{ data: ApiOpdcJob }>(`/opdc-job/${slug}`);
        return mapApiJobToFrontend(authResponse.data.data);
      } catch {
        return null;
      }
    }
  },

  /**
   * Cria uma nova vaga
   * POST /api/opdc-job
   */
  async create(data: JobFormData): Promise<Job> {
    const payload = mapFrontendToApiStore(data);
    const response = await apiClient.post<{ data: ApiOpdcJob }>('/opdc-job', payload);
    return mapApiJobToFrontend(response.data.data);
  },

  /**
   * Atualiza uma vaga
   * PUT /api/opdc-job/{id}
   */
  async update(id: string, data: Partial<JobFormData>): Promise<Job | null> {
    try {
      const payload = mapFrontendToApiUpdate(data);
      const response = await apiClient.put<{ data: ApiOpdcJob }>(`/opdc-job/${id}`, payload);
      return mapApiJobToFrontend(response.data.data);
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  },

  /**
   * Exclui uma vaga
   * DELETE /api/opdc-job/{id}
   */
  async remove(id: string): Promise<void> {
    await apiClient.delete(`/opdc-job/${id}`);
  },

  /**
   * Duplica uma vaga
   */
  async duplicate(id: string): Promise<Job | null> {
    const existing = await this.getById(id);
    if (!existing) return null;

    const duplicatedData: JobFormData = {
      titlePt: `${existing.titlePt} (Cópia)`,
      titleEn: `${existing.titleEn} (Copy)`,
      descriptionPt: existing.descriptionPt,
      descriptionEn: existing.descriptionEn,
      functionPt: existing.functionPt,
      functionEn: existing.functionEn,
      slug: `${existing.slug}-copy-${Date.now().toString(36)}`,
      address: existing.address,
      totalAmount: existing.totalAmount,
      applyUrl: existing.applyUrl,
      department: existing.department,
      seniority: existing.seniority,
      workModel: existing.workModel,
      employmentType: existing.employmentType,
      salaryRange: existing.salaryRange,
      benefits: existing.benefits,
      status: 'draft',
    };

    return this.create(duplicatedData);
  },

  /**
   * Publica uma vaga
   */
  async publish(id: string): Promise<Job | null> {
    return this.update(id, { status: 'published' });
  },

  /**
   * Despublica uma vaga
   */
  async unpublish(id: string): Promise<Job | null> {
    return this.update(id, { status: 'draft' });
  },

  /**
   * Encerra uma vaga
   */
  async close(id: string): Promise<Job | null> {
    return this.update(id, { status: 'closed' });
  },

  /**
   * Verifica se slug é único
   */
  async isSlugUnique(slug: string, excludeId?: string): Promise<boolean> {
    try {
      const existingJob = await this.getBySlug(slug);
      if (!existingJob) return true;
      return existingJob.id === excludeId;
    } catch {
      return true;
    }
  },

  generateSlug,

  /**
   * Retorna JSON público das vagas (para integração externa)
   */
  async getPublicJson(): Promise<object[]> {
    const jobs = await this.listPublished();
    return jobs.map(job => ({
      id: job.id,
      slug: job.slug,
      title: {
        pt: job.titlePt,
        en: job.titleEn,
      },
      description: {
        pt: job.descriptionPt,
        en: job.descriptionEn,
      },
      function: {
        pt: job.functionPt,
        en: job.functionEn,
      },
      address: job.address,
      totalAmount: job.totalAmount,
      applyUrl: job.applyUrl,
      department: job.department,
      seniority: job.seniority,
      workModel: job.workModel,
      employmentType: job.employmentType,
      salaryRange: job.salaryRange || null,
      benefits: job.benefits,
      updatedAt: job.updatedAt,
    }));
  },
};
