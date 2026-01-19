// ============================================================================
// ACADEMY HOOKS - React Query hooks for OPEN Academy management
// ============================================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchEnrollments,
  fetchEnrollment,
  fetchAcademyKPIs,
  createEnrollment,
  updateEnrollment,
  approveEnrollment,
  rejectEnrollment,
  suspendEnrollment,
  renewEnrollment,
  deleteEnrollment,
  updateExpiredEnrollments,
  fetchUniqueInstitutions,
  type EnrollmentFilters,
} from '@/services/academyService';
import type {
  AcademyEnrollment,
  AcademyEnrollmentInsert,
  AcademyEnrollmentUpdate,
} from '@/types/academy';

// ============================================================================
// QUERY KEYS
// ============================================================================

const ACADEMY_QUERY_KEY = 'academy-enrollments';
const ACADEMY_KPIS_KEY = 'academy-kpis';
const ACADEMY_INSTITUTIONS_KEY = 'academy-institutions';

// ============================================================================
// HOOKS
// ============================================================================

/**
 * Fetch all academy enrollments with optional filters
 */
export function useAcademyEnrollments(filters?: EnrollmentFilters) {
  return useQuery({
    queryKey: [ACADEMY_QUERY_KEY, filters],
    queryFn: () => fetchEnrollments(filters),
    // NO CACHE - Always fetch fresh data from API
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });
}

/**
 * Fetch a single enrollment by ID
 */
export function useAcademyEnrollment(id: string | null) {
  return useQuery({
    queryKey: [ACADEMY_QUERY_KEY, id],
    queryFn: () => fetchEnrollment(id!),
    enabled: !!id,
  });
}

/**
 * Fetch academy KPIs
 */
export function useAcademyKPIs() {
  return useQuery({
    queryKey: [ACADEMY_KPIS_KEY],
    queryFn: fetchAcademyKPIs,
    // NO CACHE - Always fetch fresh data from API
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });
}

/**
 * Fetch unique institution names
 */
export function useAcademyInstitutions() {
  return useQuery({
    queryKey: [ACADEMY_INSTITUTIONS_KEY],
    queryFn: fetchUniqueInstitutions,
    // NO CACHE - Always fetch fresh data from API
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });
}

/**
 * Create a new enrollment
 */
export function useCreateEnrollment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: AcademyEnrollmentInsert) => createEnrollment(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ACADEMY_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [ACADEMY_KPIS_KEY] });
    },
  });
}

/**
 * Update an enrollment
 */
export function useUpdateEnrollment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: AcademyEnrollmentUpdate }) =>
      updateEnrollment(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ACADEMY_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [ACADEMY_KPIS_KEY] });
    },
  });
}

/**
 * Approve an enrollment
 */
export function useApproveEnrollment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      approvedBy,
      discountPct,
      validUntil,
    }: {
      id: string;
      approvedBy: string;
      discountPct?: number;
      validUntil?: string;
    }) => approveEnrollment(id, approvedBy, discountPct, validUntil),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ACADEMY_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [ACADEMY_KPIS_KEY] });
    },
  });
}

/**
 * Reject an enrollment
 */
export function useRejectEnrollment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      rejectedBy,
      reason,
    }: {
      id: string;
      rejectedBy: string;
      reason?: string;
    }) => rejectEnrollment(id, rejectedBy, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ACADEMY_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [ACADEMY_KPIS_KEY] });
    },
  });
}

/**
 * Suspend an enrollment
 */
export function useSuspendEnrollment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      suspendedBy,
      reason,
    }: {
      id: string;
      suspendedBy: string;
      reason?: string;
    }) => suspendEnrollment(id, suspendedBy, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ACADEMY_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [ACADEMY_KPIS_KEY] });
    },
  });
}

/**
 * Renew an enrollment
 */
export function useRenewEnrollment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      renewedBy,
      newValidUntil,
      newDiscountPct,
    }: {
      id: string;
      renewedBy: string;
      newValidUntil: string;
      newDiscountPct?: number;
    }) => renewEnrollment(id, renewedBy, newValidUntil, newDiscountPct),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ACADEMY_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [ACADEMY_KPIS_KEY] });
    },
  });
}

/**
 * Delete an enrollment
 */
export function useDeleteEnrollment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteEnrollment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ACADEMY_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [ACADEMY_KPIS_KEY] });
    },
  });
}

/**
 * Update expired enrollments (batch operation)
 */
export function useUpdateExpiredEnrollments() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateExpiredEnrollments,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ACADEMY_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [ACADEMY_KPIS_KEY] });
    },
  });
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Calculate days until expiration
 */
export function getDaysUntilExpiration(validUntil: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expDate = new Date(validUntil);
  expDate.setHours(0, 0, 0, 0);
  const diffTime = expDate.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Get expiration warning level
 */
export function getExpirationWarning(validUntil: string): 'danger' | 'warning' | 'caution' | null {
  const days = getDaysUntilExpiration(validUntil);
  if (days <= 7) return 'danger';
  if (days <= 15) return 'warning';
  if (days <= 30) return 'caution';
  return null;
}
