import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  JobApplication,
  JobApplicationFilters,
  ApplicationStatus,
} from '@/types/jobApplication';
import { jobApplicationService } from '@/services/jobApplicationService';

/**
 * Hook para gerenciar candidaturas de uma vaga específica
 */
export function useJobApplications(jobId: string, initialFilters?: JobApplicationFilters) {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<JobApplicationFilters>(initialFilters || {});

  const {
    data: applications = [],
    isLoading: loading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['job-applications', jobId, filters],
    queryFn: () => jobApplicationService.listByJob(jobId, filters),
    enabled: !!jobId,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ applicationId, status }: { applicationId: string; status: ApplicationStatus }) =>
      jobApplicationService.updateStatus(jobId, applicationId, { status }),
    onSuccess: () => {
      toast.success('Status atualizado com sucesso');
      queryClient.invalidateQueries({ queryKey: ['job-applications', jobId] });
    },
    onError: () => {
      toast.error('Erro ao atualizar status');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (applicationId: string) =>
      jobApplicationService.remove(jobId, applicationId),
    onSuccess: () => {
      toast.success('Candidatura excluída com sucesso');
      queryClient.invalidateQueries({ queryKey: ['job-applications', jobId] });
    },
    onError: () => {
      toast.error('Erro ao excluir candidatura');
    },
  });

  const updateStatus = useCallback(
    (applicationId: string, status: ApplicationStatus) => {
      updateStatusMutation.mutate({ applicationId, status });
    },
    [updateStatusMutation]
  );

  const deleteApplication = useCallback(
    (applicationId: string) => {
      deleteMutation.mutate(applicationId);
    },
    [deleteMutation]
  );

  const exportToCsv = useCallback(
    (jobTitle: string) => {
      if (applications.length === 0) {
        toast.error('Nenhuma candidatura para exportar');
        return;
      }
      jobApplicationService.downloadCsv(applications, jobTitle);
      toast.success('CSV exportado com sucesso');
    },
    [applications]
  );

  return {
    applications,
    loading,
    error,
    filters,
    setFilters,
    refetch,
    updateStatus,
    deleteApplication,
    exportToCsv,
    isUpdating: updateStatusMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}

/**
 * Hook para estatísticas de candidaturas
 */
export function useJobApplicationStats(jobId: string) {
  return useQuery({
    queryKey: ['job-application-stats', jobId],
    queryFn: () => jobApplicationService.getStats(jobId),
    enabled: !!jobId,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
  });
}

/**
 * Hook para candidatura pública (sem auth)
 */
export function usePublicJobApplication() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(
    async (jobIdOrSlug: string, data: {
      name: string;
      email: string;
      phone: string;
      linkedin_url?: string;
      resume_url?: string;
      message?: string;
      lgpd_consent: boolean;
      website?: string; // honeypot
    }) => {
      setIsSubmitting(true);
      setError(null);
      setIsSuccess(false);

      // Honeypot check - se preenchido, simular sucesso mas não enviar
      if (data.website) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        setIsSubmitting(false);
        setIsSuccess(true);
        return { ok: true, application_id: 'fake' };
      }

      try {
        const result = await jobApplicationService.apply(jobIdOrSlug, data);
        setIsSuccess(true);
        return result;
      } catch (err: any) {
        const message = err.response?.data?.message || 'Erro ao enviar candidatura';
        setError(message);
        throw err;
      } finally {
        setIsSubmitting(false);
      }
    },
    []
  );

  const reset = useCallback(() => {
    setIsSubmitting(false);
    setIsSuccess(false);
    setError(null);
  }, []);

  return {
    submit,
    isSubmitting,
    isSuccess,
    error,
    reset,
  };
}
