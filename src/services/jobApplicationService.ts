import axios from 'axios';
import {
  JobApplication,
  JobApplicationFilters,
  JobApplicationStoreRequest,
  JobApplicationUpdateRequest,
} from '@/types/jobApplication';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
if (!API_BASE_URL) {
  throw new Error('VITE_API_BASE_URL não está definida.');
}

const AUTH_TOKEN_KEY = 'open_access_token';

const getToken = (): string | null => {
  return localStorage.getItem(AUTH_TOKEN_KEY);
};

// Axios instance para endpoints autenticados
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

// Axios instance para endpoints públicos (sem auth)
const publicClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// Service para integração com API Laravel de candidaturas
export const jobApplicationService = {
  /**
   * Lista candidaturas de uma vaga específica
   * GET /api/opdc-job/{jobId}/applications
   */
  async listByJob(jobId: string, filters?: JobApplicationFilters): Promise<JobApplication[]> {
    const params: Record<string, string> = {};
    
    if (filters?.status && filters.status !== 'all') {
      params.status = filters.status;
    }
    if (filters?.search) {
      params.__q = filters.search;
    }

    const response = await apiClient.get<{ data: JobApplication[] }>(
      `/opdc-job/${jobId}/applications`,
      { params }
    );
    
    return response.data.data || [];
  },

  /**
   * Obtém uma candidatura específica
   * GET /api/opdc-job/{jobId}/applications/{applicationId}
   */
  async getById(jobId: string, applicationId: string): Promise<JobApplication | null> {
    try {
      const response = await apiClient.get<{ data: JobApplication }>(
        `/opdc-job/${jobId}/applications/${applicationId}`
      );
      return response.data.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  },

  /**
   * Cria uma nova candidatura (público, sem auth)
   * POST /api/opdc-job/{jobIdOrSlug}/apply
   */
  async apply(jobIdOrSlug: string, data: JobApplicationStoreRequest): Promise<{ ok: boolean; application_id: string }> {
    const response = await publicClient.post<{ ok: boolean; application_id: string }>(
      `/opdc-job/${jobIdOrSlug}/apply`,
      {
        ...data,
        source: 'site',
      }
    );
    return response.data;
  },

  /**
   * Atualiza status de uma candidatura
   * PATCH /api/opdc-job/{jobId}/applications/{applicationId}
   */
  async updateStatus(
    jobId: string,
    applicationId: string,
    data: JobApplicationUpdateRequest
  ): Promise<JobApplication> {
    const response = await apiClient.patch<{ data: JobApplication }>(
      `/opdc-job/${jobId}/applications/${applicationId}`,
      data
    );
    return response.data.data;
  },

  /**
   * Exclui uma candidatura
   * DELETE /api/opdc-job/{jobId}/applications/{applicationId}
   */
  async remove(jobId: string, applicationId: string): Promise<void> {
    await apiClient.delete(`/opdc-job/${jobId}/applications/${applicationId}`);
  },

  /**
   * Exporta candidaturas em CSV
   * GET /api/opdc-job/{jobId}/applications/export
   */
  async exportCsv(jobId: string): Promise<Blob> {
    const response = await apiClient.get(`/opdc-job/${jobId}/applications/export`, {
      responseType: 'blob',
    });
    return response.data;
  },

  /**
   * Gera CSV localmente a partir dos dados
   */
  generateCsvFromData(applications: JobApplication[], jobTitle: string): string {
    const headers = ['Nome', 'Email', 'Telefone', 'LinkedIn', 'Currículo', 'Mensagem', 'Status', 'Data'];
    const rows = applications.map(app => [
      app.name,
      app.email,
      app.phone,
      app.linkedin_url || '',
      app.resume_url || '',
      app.message?.replace(/[\n\r]/g, ' ') || '',
      app.status,
      new Date(app.created_at).toLocaleDateString('pt-BR'),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    return csvContent;
  },

  /**
   * Download CSV
   */
  downloadCsv(applications: JobApplication[], jobTitle: string): void {
    const csvContent = this.generateCsvFromData(applications, jobTitle);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `candidaturas_${jobTitle.replace(/\s+/g, '_').toLowerCase()}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  },

  /**
   * Obtém estatísticas de candidaturas por vaga
   * GET /api/opdc-job/{jobId}/applications/stats
   */
  async getStats(jobId: string): Promise<{
    total: number;
    novo: number;
    em_analise: number;
    aprovado: number;
    reprovado: number;
  }> {
    try {
      const response = await apiClient.get<{
        data: {
          total: number;
          novo: number;
          em_analise: number;
          aprovado: number;
          reprovado: number;
        };
      }>(`/opdc-job/${jobId}/applications/stats`);
      return response.data.data;
    } catch {
      // Fallback: calcular localmente se endpoint não existir
      const applications = await this.listByJob(jobId);
      return {
        total: applications.length,
        novo: applications.filter(a => a.status === 'novo').length,
        em_analise: applications.filter(a => a.status === 'em_analise').length,
        aprovado: applications.filter(a => a.status === 'aprovado').length,
        reprovado: applications.filter(a => a.status === 'reprovado').length,
      };
    }
  },
};
