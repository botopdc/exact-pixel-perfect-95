// ============================================================================
// USERS HOOK - React Query hooks for Users API
// Based on OpenAPI spec: GET/POST/PUT/DELETE /api/user
// ============================================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { openApi, ApiUser } from '@/lib/openApi';

// ============================================================================
// TYPES - Based on API Schema
// ============================================================================

export interface UserFilters {
  __q?: string;
  name?: string;
  email?: string;
  level?: number;
  entity_id?: number;
  __page?: number;
  __perPage?: number;
}

export interface UserStoreRequest {
  entity_id: number;
  name: string;
  email: string;
  password: string;
  password_confirmation: string;
  phones?: string[];
  birthday?: string | null;
  tags?: string[];
}

export interface UserUpdateRequest {
  entity_id?: number;
  name?: string;
  email?: string;
  password?: string;
  password_confirmation?: string;
  phones?: string[];
  birthday?: string | null;
  tags?: string[];
  is_active?: boolean;
}

// ============================================================================
// USER LEVEL LABELS
// ============================================================================

export const USER_LEVEL_OPTIONS = [
  { value: 1, label: 'Cliente' },
  { value: 200, label: 'Parceiro' },
  { value: 600, label: 'RH' },
  { value: 680, label: 'BDR' },
  { value: 690, label: 'Arquiteto de Soluções' },
  { value: 700, label: 'Comercial' },
  { value: 750, label: 'Gerente Comercial' },
  { value: 775, label: 'Sucesso do Cliente' },
  { value: 900, label: 'Suporte' },
  { value: 950, label: 'Gerente de Suporte' },
  { value: 1000, label: 'Admin' },
] as const;

export function getUserLevelLabel(level: number): string {
  const option = USER_LEVEL_OPTIONS.find(o => o.value === level);
  return option?.label || `Nível ${level}`;
}

// ============================================================================
// QUERY KEYS
// ============================================================================

const USERS_QUERY_KEY = 'users';

// ============================================================================
// HOOKS
// ============================================================================

/**
 * Fetch paginated list of users with optional filters
 */
export function useUsers(filters?: UserFilters) {
  return useQuery({
    queryKey: [USERS_QUERY_KEY, filters],
    queryFn: () => openApi.getUsers(filters),
    staleTime: 1000 * 60, // 1 minute
  });
}

/**
 * Fetch a single user by ID or UUID
 */
export function useUser(id: string | number | null) {
  return useQuery({
    queryKey: [USERS_QUERY_KEY, id],
    queryFn: () => openApi.getUser(id!),
    enabled: !!id,
  });
}

/**
 * Create a new user
 */
export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UserStoreRequest) => openApi.createUser(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [USERS_QUERY_KEY] });
    },
  });
}

/**
 * Update an existing user
 */
export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string | number; data: UserUpdateRequest }) =>
      openApi.updateUser(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [USERS_QUERY_KEY] });
    },
  });
}

/**
 * Delete a user
 */
export function useDeleteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string | number) => openApi.deleteUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [USERS_QUERY_KEY] });
    },
  });
}

export type { ApiUser };
