export type JobStatus = 'draft' | 'published' | 'closed';
export type Department = 'Comercial' | 'TI' | 'CS' | 'Marketing' | 'Adm/Fin' | 'Operações';
export type Seniority = 'Junior' | 'Pleno' | 'Senior' | 'Especialista';
export type WorkModel = 'Presencial' | 'Híbrido' | 'Remoto';
export type EmploymentType = 'CLT' | 'PJ' | 'Estágio';

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

export interface JobFilters {
  search?: string;
  status?: JobStatus | 'all';
  department?: Department | 'all';
  address?: string;
  seniority?: Seniority | 'all';
}
