// ============================================================================
// USE COMPANIES HOOKS - React Query hooks for /api/company
// ============================================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { companyService, CompanyFilters, CompanyStoreRequest, CompanyUpdateRequest } from '@/services/companyService';
import { toast } from 'sonner';

// ============================================================================
// LIST / GET
// ============================================================================

/**
 * Get paginated list of companies
 */
export function useCompanies(filters: CompanyFilters = {}) {
  return useQuery({
    queryKey: ['companies', filters],
    queryFn: () => companyService.getCompanies(filters),
    staleTime: 0,
    gcTime: 0,
  });
}

/**
 * Get all companies (unpaginated)
 */
export function useAllCompanies() {
  return useQuery({
    queryKey: ['companies', 'all'],
    queryFn: companyService.getAllCompanies,
    staleTime: 0,
    gcTime: 0,
  });
}

/**
 * Get a specific company by ID
 */
export function useCompany(id: number | string | undefined) {
  return useQuery({
    queryKey: ['company', id],
    queryFn: () => companyService.getCompany(id!),
    enabled: !!id,
    staleTime: 0,
    gcTime: 0,
  });
}

// ============================================================================
// MUTATIONS
// ============================================================================

/**
 * Create a new company
 */
export function useCreateCompany() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: CompanyStoreRequest) => companyService.createCompany(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      toast.success('Cliente criado com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao criar cliente: ${error.message}`);
    },
  });
}

/**
 * Update an existing company
 */
export function useUpdateCompany() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: number | string; data: CompanyUpdateRequest }) =>
      companyService.updateCompany(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      queryClient.invalidateQueries({ queryKey: ['company', id] });
      toast.success('Cliente atualizado com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar cliente: ${error.message}`);
    },
  });
}

/**
 * Delete a company
 */
export function useDeleteCompany() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: number | string) => companyService.deleteCompany(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      toast.success('Cliente removido com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao remover cliente: ${error.message}`);
    },
  });
}

// ============================================================================
// SEARCH
// ============================================================================

/**
 * Search companies by query
 */
export function useCompanySearch(query: string) {
  return useQuery({
    queryKey: ['companies', 'search', query],
    queryFn: () => companyService.searchCompanies(query),
    enabled: query.length >= 2,
    staleTime: 0,
    gcTime: 0,
  });
}
