// ============================================================================
// ACADEMY TYPES - Types for OPEN Academy management
// ============================================================================

export type AcademyEnrollmentStatus = 'pending' | 'active' | 'suspended' | 'expired' | 'rejected';

export type AcademyLevel = 50 | 55 | 60;

export const ACADEMY_LEVELS = {
  ALUNO: 50,
  PROFESSOR: 55,
  INSTITUICAO: 60,
} as const;

export const ACADEMY_LEVEL_LABELS: Record<AcademyLevel, string> = {
  50: 'Aluno',
  55: 'Professor',
  60: 'Instituição / Coordenador',
};

export const ACADEMY_STATUS_LABELS: Record<AcademyEnrollmentStatus, string> = {
  pending: 'Pendente',
  active: 'Ativo',
  suspended: 'Suspenso',
  expired: 'Expirado',
  rejected: 'Rejeitado',
};

export const ACADEMY_STATUS_COLORS: Record<AcademyEnrollmentStatus, string> = {
  pending: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
  active: 'bg-green-500/10 text-green-600 border-green-500/20',
  suspended: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  expired: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
  rejected: 'bg-red-500/10 text-red-600 border-red-500/20',
};

export const INSTITUTION_TYPES = [
  'Universidade',
  'Escola',
  'Instituto',
  'Empresa',
] as const;

export type InstitutionType = typeof INSTITUTION_TYPES[number];

export interface AcademyEnrollment {
  id: string;
  user_id: string;
  academy_level: AcademyLevel;
  full_name: string;
  email: string;
  institution_name: string | null;
  institution_type: string | null;
  course_area: string | null;
  proof_url: string | null;
  proof_file_id: string | null;
  discount_pct: number;
  status: AcademyEnrollmentStatus;
  valid_from: string;
  valid_until: string;
  approved_by: string | null;
  approved_at: string | null;
  last_renewed_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AcademyEnrollmentInsert {
  user_id: string;
  academy_level: AcademyLevel;
  full_name: string;
  email: string;
  institution_name?: string | null;
  institution_type?: string | null;
  course_area?: string | null;
  proof_url?: string | null;
  proof_file_id?: string | null;
  discount_pct?: number;
  status?: AcademyEnrollmentStatus;
  valid_from?: string;
  valid_until?: string;
}

export interface AcademyEnrollmentUpdate {
  academy_level?: AcademyLevel;
  full_name?: string;
  email?: string;
  institution_name?: string | null;
  institution_type?: string | null;
  course_area?: string | null;
  proof_url?: string | null;
  discount_pct?: number;
  status?: AcademyEnrollmentStatus;
  valid_from?: string;
  valid_until?: string;
  approved_by?: string | null;
  approved_at?: string | null;
  last_renewed_at?: string | null;
  notes?: string | null;
}

export interface AcademyKPIs {
  pending: number;
  active: number;
  expiring_30_days: number;
  expired: number;
  suspended: number;
}

// Application request from external site
export interface AcademyApplicationRequest {
  full_name: string;
  email: string;
  academy_level: AcademyLevel;
  institution_name?: string;
  institution_type?: string;
  course_area?: string;
  proof_url?: string;
}
