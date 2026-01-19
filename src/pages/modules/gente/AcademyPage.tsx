import React, { useState, useEffect } from 'react';
import { GraduationCap, Plus } from 'lucide-react';
import { ModuleHeader } from '@/components/navigation/ModuleCard';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { authService } from '@/services/authService';
import { AcademyKPICards } from '@/components/academy/AcademyKPICards';
import { AcademyEnrollmentsTable } from '@/components/academy/AcademyEnrollmentsTable';
import { AcademyFilters } from '@/components/academy/AcademyFilters';
import {
  AcademyEnrollmentModal,
  type ModalAction,
  type ModalConfirmData,
} from '@/components/academy/AcademyEnrollmentModal';
import {
  useAcademyEnrollments,
  useAcademyKPIs,
  useAcademyInstitutions,
  useApproveEnrollment,
  useRejectEnrollment,
  useSuspendEnrollment,
  useRenewEnrollment,
  useUpdateEnrollment,
  useUpdateExpiredEnrollments,
} from '@/hooks/useAcademy';
import type { AcademyEnrollment, AcademyEnrollmentStatus, AcademyLevel } from '@/types/academy';

export default function AcademyPage() {
  const user = authService.getCurrentUser();

  // Filters state
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<AcademyEnrollmentStatus | 'all'>('all');
  const [level, setLevel] = useState<AcademyLevel | 'all'>('all');
  const [expiringDays, setExpiringDays] = useState<number | 'all'>('all');
  const [institution, setInstitution] = useState('');

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedEnrollment, setSelectedEnrollment] = useState<AcademyEnrollment | null>(null);
  const [modalAction, setModalAction] = useState<ModalAction>('view');

  // Queries
  const { data: kpis, isLoading: kpisLoading } = useAcademyKPIs();
  const { data: institutions = [] } = useAcademyInstitutions();
  const { data: enrollments = [], isLoading: enrollmentsLoading } = useAcademyEnrollments({
    status: status !== 'all' ? status : undefined,
    academy_level: level !== 'all' ? level : undefined,
    search: search || undefined,
    expiring_days: expiringDays !== 'all' ? expiringDays : undefined,
    institution: institution || undefined,
  });

  // Mutations
  const approveMutation = useApproveEnrollment();
  const rejectMutation = useRejectEnrollment();
  const suspendMutation = useSuspendEnrollment();
  const renewMutation = useRenewEnrollment();
  const updateMutation = useUpdateEnrollment();
  const updateExpiredMutation = useUpdateExpiredEnrollments();

  const isActionLoading =
    approveMutation.isPending ||
    rejectMutation.isPending ||
    suspendMutation.isPending ||
    renewMutation.isPending ||
    updateMutation.isPending;

  const handleAction = (enrollment: AcademyEnrollment, action: ModalAction) => {
    setSelectedEnrollment(enrollment);
    setModalAction(action);
    setModalOpen(true);
  };

  const handleConfirm = async (data: ModalConfirmData) => {
    if (!selectedEnrollment || !user) return;

    try {
      switch (data.action) {
        case 'approve':
          await approveMutation.mutateAsync({
            id: selectedEnrollment.id,
            approvedBy: user.name || user.email,
            discountPct: data.discountPct,
            validUntil: data.validUntil,
          });
          toast.success('Inscrição aprovada com sucesso!');
          break;
        case 'reject':
          await rejectMutation.mutateAsync({
            id: selectedEnrollment.id,
            rejectedBy: user.name || user.email,
            reason: data.reason,
          });
          toast.success('Inscrição rejeitada.');
          break;
        case 'suspend':
          await suspendMutation.mutateAsync({
            id: selectedEnrollment.id,
            suspendedBy: user.name || user.email,
            reason: data.reason,
          });
          toast.success('Inscrição suspensa.');
          break;
        case 'renew':
          await renewMutation.mutateAsync({
            id: selectedEnrollment.id,
            renewedBy: user.name || user.email,
            newValidUntil: data.validUntil!,
            newDiscountPct: data.discountPct,
          });
          toast.success('Inscrição renovada com sucesso!');
          break;
        case 'edit':
          await updateMutation.mutateAsync({
            id: selectedEnrollment.id,
            data: {
              institution_name: data.institutionName || null,
              institution_type: data.institutionType || null,
              course_area: data.courseArea || null,
              discount_pct: data.discountPct,
              notes: data.notes
                ? `${selectedEnrollment.notes || ''}\n[${new Date().toLocaleString('pt-BR')}] EDITADO por ${user.name}: ${data.notes}`
                : selectedEnrollment.notes,
            },
          });
          toast.success('Inscrição atualizada com sucesso!');
          break;
      }
      setModalOpen(false);
    } catch (error) {
      toast.error('Erro ao processar ação. Tente novamente.');
    }
  };

  const handleRefreshExpired = async () => {
    try {
      const count = await updateExpiredMutation.mutateAsync();
      if (count > 0) {
        toast.success(`${count} inscrições atualizadas para expirado.`);
      } else {
        toast.info('Nenhuma inscrição expirada para atualizar.');
      }
    } catch {
      toast.error('Erro ao atualizar inscrições expiradas.');
    }
  };

  const handleFilterFromKPI = (filter: string) => {
    if (filter === 'expiring') {
      setStatus('active');
      setExpiringDays(30);
    } else if (filter === 'pending' || filter === 'active' || filter === 'expired' || filter === 'suspended') {
      setStatus(filter as AcademyEnrollmentStatus);
      setExpiringDays('all');
    }
  };

  const resetFilters = () => {
    setSearch('');
    setStatus('all');
    setLevel('all');
    setExpiringDays('all');
    setInstitution('');
  };

  return (
    <div className="space-y-6">
      <ModuleHeader
        title="OPEN Academy"
        description="Gestão de Alunos e Parceiros Acadêmicos"
        icon={GraduationCap}
      />

      {/* KPIs */}
      <AcademyKPICards
        kpis={kpis}
        isLoading={kpisLoading}
        onFilterClick={handleFilterFromKPI}
      />

      {/* Filters */}
      <AcademyFilters
        search={search}
        onSearchChange={setSearch}
        status={status}
        onStatusChange={setStatus}
        level={level}
        onLevelChange={setLevel}
        expiringDays={expiringDays}
        onExpiringDaysChange={setExpiringDays}
        institution={institution}
        onInstitutionChange={setInstitution}
        institutions={institutions}
        onReset={resetFilters}
        onRefreshExpired={handleRefreshExpired}
        isRefreshing={updateExpiredMutation.isPending}
      />

      {/* Table */}
      <AcademyEnrollmentsTable
        enrollments={enrollments}
        isLoading={enrollmentsLoading}
        onAction={handleAction}
      />

      {/* Modal */}
      <AcademyEnrollmentModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        enrollment={selectedEnrollment}
        action={modalAction}
        onConfirm={handleConfirm}
        isLoading={isActionLoading}
      />
    </div>
  );
}
