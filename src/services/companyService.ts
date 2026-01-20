// ============================================================================
// COMPANY SERVICE - CRUD for /api/company
// Using OpenApiClient methods
// ============================================================================

import { openApi, ApiCompany } from '@/lib/openApi';
import { logDataSource } from '@/lib/logDataSource';

const MODULE = 'CompanyService';

// Re-export types
export type { ApiCompany as Company };

export interface CompanyFilters {
  __q?: string;
  name?: string;
  docnum?: string;
  city?: string;
  uf?: string;
  __page?: number;
  __perPage?: number;
  __order?: string;
}

export interface CompanyPaginatedResponse {
  current_page: number;
  data: ApiCompany[];
  from: number;
  last_page: number;
  per_page: number;
  to: number;
  total: number;
}

export interface CompanySearchResult {
  type: 'company';
  id: number;
  title: string;
  subtitle: string;
}

// ============================================================================
// LIST / GET
// ============================================================================

export async function getCompanies(filters: CompanyFilters = {}): Promise<CompanyPaginatedResponse> {
  logDataSource({ module: MODULE, source: 'API', operation: 'READ', endpoint: '/api/company', details: 'List companies' });
  
  const params: Record<string, string | number> = {};
  
  if (filters.__q) params.__q = filters.__q;
  if (filters.name) params.name = filters.name;
  if (filters.docnum) params.docnum = filters.docnum;
  if (filters.city) params.city = filters.city;
  if (filters.uf) params.uf = filters.uf;
  if (filters.__page) params.__page = filters.__page;
  if (filters.__perPage) params.__perPage = filters.__perPage;
  
  // Default pagination
  if (!params.__perPage) params.__perPage = 50;
  
  return await openApi.getCompanies(params as CompanyFilters);
}

export async function getAllCompanies(): Promise<ApiCompany[]> {
  logDataSource({ module: MODULE, source: 'API', operation: 'READ', endpoint: '/api/company', details: 'List all companies' });
  
  const response = await openApi.getCompanies({ __perPage: 1000 });
  return response.data;
}

export async function getCompany(id: number | string): Promise<ApiCompany> {
  logDataSource({ module: MODULE, source: 'API', operation: 'READ', endpoint: `/api/company/${id}`, details: 'Get company' });
  
  return await openApi.getCompany(id);
}

// ============================================================================
// CREATE / UPDATE / DELETE
// ============================================================================

export interface CompanyStoreRequest {
  name: string;
  legal_name?: string | null;
  docnum?: string | null;
  work_area?: string | null;
  city?: string | null;
  uf?: string | null;
  has_support?: boolean | null;
  obs?: string | null;
}

export interface CompanyUpdateRequest {
  name?: string;
  legal_name?: string | null;
  docnum?: string | null;
  work_area?: string | null;
  city?: string | null;
  uf?: string | null;
  has_support?: boolean | null;
  obs?: string | null;
}

export async function createCompany(data: CompanyStoreRequest): Promise<ApiCompany> {
  logDataSource({ module: MODULE, source: 'API', operation: 'WRITE', endpoint: '/api/company', details: 'Create company' });
  
  return await openApi.createCompany(data);
}

export async function updateCompany(id: number | string, data: CompanyUpdateRequest): Promise<ApiCompany> {
  logDataSource({ module: MODULE, source: 'API', operation: 'WRITE', endpoint: `/api/company/${id}`, details: 'Update company' });
  
  return await openApi.updateCompany(id, data);
}

export async function deleteCompany(id: number | string): Promise<void> {
  logDataSource({ module: MODULE, source: 'API', operation: 'DELETE', endpoint: `/api/company/${id}`, details: 'Delete company' });
  
  await openApi.deleteCompany(id);
}

// ============================================================================
// SEARCH
// ============================================================================

export async function searchCompanies(query: string): Promise<CompanySearchResult[]> {
  if (query.length < 2) return [];
  
  logDataSource({ module: MODULE, source: 'API', operation: 'READ', endpoint: '/api/company', details: `Search: ${query}` });
  
  const companies = await openApi.searchCompanies(query);
  
  return companies.map((company) => ({
    type: 'company' as const,
    id: company.id,
    title: company.name,
    subtitle: [company.docnum, company.city, company.uf].filter(Boolean).join(' • ') || 'Sem detalhes',
  }));
}

// ============================================================================
// EXPORT SERVICE OBJECT
// ============================================================================

export const companyService = {
  getCompanies,
  getAllCompanies,
  getCompany,
  createCompany,
  updateCompany,
  deleteCompany,
  searchCompanies,
};

export default companyService;
