// Job types - Frontend model and API mappings
// Based on OpenAPI OpdcJob schema

export type JobStatus = 'draft' | 'published' | 'closed';
export type Department = 'Comercial' | 'TI' | 'CS' | 'Marketing' | 'Adm/Fin' | 'Operações';
export type Seniority = 'Junior' | 'Pleno' | 'Senior' | 'Especialista';
export type WorkModel = 'Presencial' | 'Híbrido' | 'Remoto';
export type EmploymentType = 'CLT' | 'PJ' | 'Estágio';

// API Status mapping
export const API_STATUS_MAP: Record<string, JobStatus> = {
  'Rascunho': 'draft',
  'Publicada': 'published',
  'Encerrada': 'closed',
  'draft': 'draft',
  'published': 'published',
  'closed': 'closed',
};

export const STATUS_TO_API: Record<JobStatus, string> = {
  'draft': 'Rascunho',
  'published': 'Publicada',
  'closed': 'Encerrada',
};

// Frontend Job model
export interface Job {
  id: string;
  slug: string;
  
  // Portuguese content
  titlePt: string;
  descriptionPt: string;
  functionPt: string;
  
  // English content
  titleEn: string;
  descriptionEn: string;
  functionEn: string;
  
  // Details
  address: string;
  totalAmount: number;
  applyUrl: string;
  
  // Categories
  department: Department;
  seniority: Seniority;
  workModel: WorkModel;
  employmentType: EmploymentType;
  
  // Optional
  salaryRange?: string;
  benefits: string[];
  
  // Meta
  status: JobStatus;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

// API OpdcJob model (from OpenAPI schema)
export interface ApiOpdcJob {
  id: number;
  slug: string | null;
  title: string;
  title_en: string | null;
  description: string;
  description_en: string | null;
  status: string;
  role: string;
  role_en: string | null;
  quantity: number;
  address: string;
  subscription_url: string | null;
  department: string;
  seniority: string | null;
  work_regime: string | null;
  contract_type: string | null;
  benefits: string | null; // JSON string from API
  salary_range: number | string | null;
  created_by: number | null;
  created_at: string;
  updated_at: string;
}

// API Store Request
export interface ApiOpdcJobStoreRequest {
  title: string;
  title_en?: string | null;
  description: string;
  description_en?: string | null;
  status: string;
  role: string;
  role_en?: string | null;
  slug?: string | null;
  quantity: number;
  address: string;
  subscription_url?: string | null;
  department: string;
  seniority?: string | null;
  work_regime?: string | null;
  contract_type?: string | null;
  benefits?: string | null; // Must be JSON string
  salary_range?: number | null;
}

// API Update Request
export interface ApiOpdcJobUpdateRequest {
  title?: string;
  title_en?: string | null;
  description?: string;
  description_en?: string | null;
  status?: string;
  role?: string;
  role_en?: string | null;
  slug?: string | null;
  quantity?: number;
  address?: string;
  subscription_url?: string | null;
  department?: string;
  seniority?: string | null;
  work_regime?: string | null;
  contract_type?: string | null;
  benefits?: string | null; // Must be JSON string
  salary_range?: number | null;
}

// Form data for creating/editing jobs
export interface JobFormData {
  titlePt: string;
  descriptionPt: string;
  functionPt: string;
  titleEn: string;
  descriptionEn: string;
  functionEn: string;
  slug: string;
  address: string;
  totalAmount: number;
  applyUrl: string;
  department: Department;
  seniority: Seniority;
  workModel: WorkModel;
  employmentType: EmploymentType;
  salaryRange?: string;
  benefits: string[];
  status: JobStatus;
}

// Filters
export interface JobFilters {
  search?: string;
  status?: JobStatus | 'all';
  department?: Department | 'all';
  address?: string;
  seniority?: Seniority | 'all';
}

// Mappers - API to Frontend
export function mapApiJobToFrontend(apiJob: ApiOpdcJob): Job {
  // Parse benefits from JSON string
  let benefits: string[] = [];
  if (apiJob.benefits) {
    try {
      if (typeof apiJob.benefits === 'string') {
        const parsed = JSON.parse(apiJob.benefits);
        if (Array.isArray(parsed)) {
          benefits = parsed.map(String);
        } else if (typeof parsed === 'object' && parsed !== null) {
          benefits = Object.values(parsed).map(String);
        }
      }
    } catch {
      // If JSON parse fails, treat as empty
      benefits = [];
    }
  }

  // Parse salary range
  let salaryRange: string | undefined;
  if (apiJob.salary_range !== null && apiJob.salary_range !== undefined) {
    if (typeof apiJob.salary_range === 'number') {
      salaryRange = `R$ ${apiJob.salary_range.toLocaleString('pt-BR')}`;
    } else {
      salaryRange = String(apiJob.salary_range);
    }
  }

  // Map status
  const status = API_STATUS_MAP[apiJob.status] || 'draft';

  // Map work model (contract_type in API = workModel in frontend)
  let workModel: WorkModel = 'Presencial';
  if (apiJob.contract_type) {
    const ct = apiJob.contract_type.toLowerCase();
    if (ct.includes('remoto')) workModel = 'Remoto';
    else if (ct.includes('híbrido') || ct.includes('hibrido')) workModel = 'Híbrido';
  }

  // Map employment type (work_regime in API = employmentType in frontend)
  let employmentType: EmploymentType = 'CLT';
  if (apiJob.work_regime) {
    const wr = apiJob.work_regime.toUpperCase();
    if (wr.includes('PJ')) employmentType = 'PJ';
    else if (wr.includes('ESTÁGIO') || wr.includes('ESTAGIO')) employmentType = 'Estágio';
  }

  // Map seniority
  let seniority: Seniority = 'Pleno';
  if (apiJob.seniority) {
    const s = apiJob.seniority.toLowerCase();
    if (s.includes('junior') || s.includes('júnior')) seniority = 'Junior';
    else if (s.includes('senior') || s.includes('sênior')) seniority = 'Senior';
    else if (s.includes('especialista')) seniority = 'Especialista';
    else if (s.includes('pleno')) seniority = 'Pleno';
  }

  // Map department
  let department: Department = 'TI';
  if (apiJob.department) {
    const validDepts: Department[] = ['Comercial', 'TI', 'CS', 'Marketing', 'Adm/Fin', 'Operações'];
    const found = validDepts.find(d => d.toLowerCase() === apiJob.department.toLowerCase());
    if (found) department = found;
  }

  return {
    id: String(apiJob.id),
    slug: apiJob.slug || generateSlugFromTitle(apiJob.title),
    titlePt: apiJob.title,
    titleEn: apiJob.title_en || apiJob.title,
    descriptionPt: apiJob.description,
    descriptionEn: apiJob.description_en || apiJob.description,
    functionPt: apiJob.role,
    functionEn: apiJob.role_en || apiJob.role,
    address: apiJob.address,
    totalAmount: apiJob.quantity,
    applyUrl: apiJob.subscription_url || '',
    department,
    seniority,
    workModel,
    employmentType,
    salaryRange,
    benefits,
    status,
    createdAt: apiJob.created_at,
    updatedAt: apiJob.updated_at,
  };
}

// Mappers - Frontend to API Store Request
export function mapFrontendToApiStore(form: JobFormData): ApiOpdcJobStoreRequest {
  return {
    title: form.titlePt,
    title_en: form.titleEn || null,
    description: form.descriptionPt,
    description_en: form.descriptionEn || null,
    status: STATUS_TO_API[form.status],
    role: form.functionPt,
    role_en: form.functionEn || null,
    slug: form.slug || null,
    quantity: form.totalAmount,
    address: form.address,
    subscription_url: form.applyUrl || null,
    department: form.department,
    seniority: form.seniority,
    work_regime: form.employmentType,
    contract_type: form.workModel,
    benefits: JSON.stringify(form.benefits || []),
    salary_range: form.salaryRange ? parseSalaryToNumber(form.salaryRange) : null,
  };
}

// Mappers - Frontend to API Update Request
export function mapFrontendToApiUpdate(form: Partial<JobFormData>): ApiOpdcJobUpdateRequest {
  const update: ApiOpdcJobUpdateRequest = {};

  if (form.titlePt !== undefined) update.title = form.titlePt;
  if (form.titleEn !== undefined) update.title_en = form.titleEn || null;
  if (form.descriptionPt !== undefined) update.description = form.descriptionPt;
  if (form.descriptionEn !== undefined) update.description_en = form.descriptionEn || null;
  if (form.status !== undefined) update.status = STATUS_TO_API[form.status];
  if (form.functionPt !== undefined) update.role = form.functionPt;
  if (form.functionEn !== undefined) update.role_en = form.functionEn || null;
  if (form.slug !== undefined) update.slug = form.slug || null;
  if (form.totalAmount !== undefined) update.quantity = form.totalAmount;
  if (form.address !== undefined) update.address = form.address;
  if (form.applyUrl !== undefined) update.subscription_url = form.applyUrl || null;
  if (form.department !== undefined) update.department = form.department;
  if (form.seniority !== undefined) update.seniority = form.seniority;
  if (form.employmentType !== undefined) update.work_regime = form.employmentType;
  if (form.workModel !== undefined) update.contract_type = form.workModel;
  if (form.benefits !== undefined) update.benefits = JSON.stringify(form.benefits || []);
  if (form.salaryRange !== undefined) update.salary_range = form.salaryRange ? parseSalaryToNumber(form.salaryRange) : null;

  return update;
}

// Helper to generate slug from title
function generateSlugFromTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// Helper to parse salary string to number
function parseSalaryToNumber(salary: string): number | null {
  const cleaned = salary.replace(/[^\d.,]/g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}
