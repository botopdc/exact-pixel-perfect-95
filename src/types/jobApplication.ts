// Job Application Types - Integração com API Laravel /api/opdc-job/{id}/applications

export type ApplicationStatus = 'novo' | 'em_analise' | 'aprovado' | 'reprovado';

export interface JobApplication {
  id: string;
  job_id: string;
  name: string;
  email: string;
  phone: string;
  linkedin_url?: string | null;
  resume_url?: string | null;
  message?: string | null;
  source: string;
  status: ApplicationStatus;
  created_at: string;
  updated_at?: string;
}

export interface JobApplicationFilters {
  status?: ApplicationStatus | 'all';
  search?: string;
}

export interface JobApplicationStoreRequest {
  name: string;
  email: string;
  phone: string;
  linkedin_url?: string;
  resume_url?: string;
  message?: string;
  lgpd_consent: boolean;
  // Honeypot field for anti-spam
  website?: string;
}

export interface JobApplicationUpdateRequest {
  status: ApplicationStatus;
}

// Status labels and colors
export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  novo: 'Novo',
  em_analise: 'Em Análise',
  aprovado: 'Aprovado',
  reprovado: 'Reprovado',
};

export const APPLICATION_STATUS_COLORS: Record<ApplicationStatus, string> = {
  novo: 'bg-blue-500/20 text-blue-700 dark:text-blue-400',
  em_analise: 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400',
  aprovado: 'bg-green-500/20 text-green-700 dark:text-green-400',
  reprovado: 'bg-red-500/20 text-red-700 dark:text-red-400',
};
