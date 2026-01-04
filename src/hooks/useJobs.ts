import { useState, useEffect, useCallback } from 'react';
import { Job, JobFilters, JobStatus } from '@/types/job';
import { jobsService } from '@/services/jobsService';
import { toast } from 'sonner';

export function useJobs(initialFilters?: JobFilters) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<JobFilters>(initialFilters || {});

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await jobsService.list(filters);
      setJobs(data);
    } catch (error) {
      toast.error('Erro ao carregar vagas');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const deleteJob = async (id: string) => {
    try {
      await jobsService.remove(id);
      toast.success('Vaga excluída com sucesso');
      fetchJobs();
    } catch (error) {
      toast.error('Erro ao excluir vaga');
    }
  };

  const duplicateJob = async (id: string) => {
    try {
      await jobsService.duplicate(id);
      toast.success('Vaga duplicada com sucesso');
      fetchJobs();
    } catch (error) {
      toast.error('Erro ao duplicar vaga');
    }
  };

  const togglePublish = async (id: string, currentStatus: JobStatus) => {
    try {
      if (currentStatus === 'published') {
        await jobsService.unpublish(id);
        toast.success('Vaga despublicada');
      } else {
        await jobsService.publish(id);
        toast.success('Vaga publicada');
      }
      fetchJobs();
    } catch (error) {
      toast.error('Erro ao alterar status');
    }
  };

  const closeJob = async (id: string) => {
    try {
      await jobsService.close(id);
      toast.success('Vaga encerrada');
      fetchJobs();
    } catch (error) {
      toast.error('Erro ao encerrar vaga');
    }
  };

  return {
    jobs,
    loading,
    filters,
    setFilters,
    refetch: fetchJobs,
    deleteJob,
    duplicateJob,
    togglePublish,
    closeJob,
  };
}
