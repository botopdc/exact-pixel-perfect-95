// ============================================================================
// ATENDIMENTOS MODULE HOME - Dashboard Operacional NOC
// OPTIMIZED: Progressive loading with skeletons, no render blocking
// ============================================================================

import React, { useState } from 'react';
import { HeadphonesIcon, Plus, RefreshCw } from 'lucide-react';
import { ModuleHeader } from '@/components/navigation/ModuleCard';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useSupportDashboard } from '@/hooks/useSupportDashboard';
import { SLAKPICards } from '@/components/atendimentos/SLAKPICards';
import { QueueDistributionCard } from '@/components/atendimentos/QueueDistributionCard';
import { ResponseTimeCard } from '@/components/atendimentos/ResponseTimeCard';
import { OnCallWidget } from '@/components/atendimentos/OnCallWidget';
import { ServiceStatusCard } from '@/components/atendimentos/ServiceStatusCard';
import { ActiveIncidentsCard } from '@/components/atendimentos/ActiveIncidentsCard';
import { TeamCapacityCard } from '@/components/atendimentos/TeamCapacityCard';
import { TicketCreateModal } from '@/components/tickets-core/TicketCreateModal';

function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-40 rounded-lg" />
        <Skeleton className="h-40 rounded-lg" />
      </div>
      <Skeleton className="h-32 rounded-lg" />
      <div className="grid gap-4 md:grid-cols-4">
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-24 rounded-lg" />
      </div>
    </div>
  );
}

export default function AtendimentosModuleHome() {
  const { stats, isLoading, refetch } = useSupportDashboard();
  const [showCreateModal, setShowCreateModal] = useState(false);

  return (
    <div className="space-y-6">
      <ModuleHeader
        title="Centro de Operações"
        description="Dashboard operacional — NOC em tempo real"
        icon={HeadphonesIcon}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-1" /> Atualizar
            </Button>
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus className="h-4 w-4 mr-2" /> Abrir Chamado
            </Button>
          </div>
        }
      />

      {isLoading && !stats ? (
        <DashboardSkeleton />
      ) : (
        <>
          {/* Linha 1: SLA Hoje (highest priority — shows immediately) */}
          <SLAKPICards
            openTickets={stats?.open_tickets ?? 0}
            slaOk={stats?.sla_ok ?? 0}
            slaBreached={stats?.sla_breached ?? 0}
            criticalCount={stats?.critical_count ?? 0}
            loading={false}
          />

          {/* Linha 2: Incidentes Ativos + Distribuição */}
          <div className="grid gap-4 md:grid-cols-2">
            <ActiveIncidentsCard
              incidents={stats?.active_incidents ?? []}
              loading={false}
            />
            <QueueDistributionCard
              distribution={stats?.queue_distribution ?? { N1: 0, N2: 0, N3: 0, CS: 0 }}
              loading={false}
            />
          </div>

          {/* Linha 3: Tempo Médio + Capacidade */}
          <div className="grid gap-4 md:grid-cols-2">
            <ResponseTimeCard
              avgFirstResponseMinutes={stats?.avg_first_response_minutes ?? 0}
              avgResolutionMinutes={stats?.avg_resolution_minutes ?? 0}
              loading={false}
            />
            <TeamCapacityCard
              distribution={stats?.queue_distribution ?? { N1: 0, N2: 0, N3: 0, CS: 0 }}
              unassigned={stats?.queue_unassigned ?? { N1: 0, N2: 0, N3: 0, CS: 0 }}
              breached={stats?.queue_breached ?? { N1: 0, N2: 0, N3: 0, CS: 0 }}
              loading={false}
            />
          </div>

          {/* Linha 4: Status Ambiente + Plantão (secondary data) */}
          <div className="grid gap-4 md:grid-cols-2">
            <ServiceStatusCard
              services={stats?.service_status ?? []}
              loading={false}
            />
            <OnCallWidget
              shifts={stats?.oncall_shifts ?? []}
              loading={false}
            />
          </div>
        </>
      )}

      <TicketCreateModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
      />
    </div>
  );
}
