// ============================================================================
// ATENDIMENTOS MODULE HOME - Dashboard Operacional NOC
// ============================================================================

import React, { useState } from 'react';
import { HeadphonesIcon, Plus, RefreshCw } from 'lucide-react';
import { ModuleHeader } from '@/components/navigation/ModuleCard';
import { Button } from '@/components/ui/button';
import { useSupportDashboard } from '@/hooks/useSupportDashboard';
import { SLAKPICards } from '@/components/atendimentos/SLAKPICards';
import { QueueDistributionCard } from '@/components/atendimentos/QueueDistributionCard';
import { ResponseTimeCard } from '@/components/atendimentos/ResponseTimeCard';
import { OnCallWidget } from '@/components/atendimentos/OnCallWidget';
import { ServiceStatusCard } from '@/components/atendimentos/ServiceStatusCard';
import { ActiveIncidentsCard } from '@/components/atendimentos/ActiveIncidentsCard';
import { TeamCapacityCard } from '@/components/atendimentos/TeamCapacityCard';
import { TicketCreateModal } from '@/components/tickets-core/TicketCreateModal';

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

      {/* Linha 1: Status do Ambiente + Plantão Ativo */}
      <div className="grid gap-4 md:grid-cols-2">
        <ServiceStatusCard
          services={stats?.service_status ?? []}
          loading={isLoading}
        />
        <OnCallWidget
          shifts={stats?.oncall_shifts ?? []}
          loading={isLoading}
        />
      </div>

      {/* Linha 2: Incidentes Ativos */}
      <ActiveIncidentsCard
        incidents={stats?.active_incidents ?? []}
        loading={isLoading}
      />

      {/* Linha 3: SLA Hoje */}
      <SLAKPICards
        openTickets={stats?.open_tickets ?? 0}
        slaOk={stats?.sla_ok ?? 0}
        slaBreached={stats?.sla_breached ?? 0}
        criticalCount={stats?.critical_count ?? 0}
        loading={isLoading}
      />

      {/* Linha 4: Tempo Médio + Distribuição */}
      <div className="grid gap-4 md:grid-cols-2">
        <ResponseTimeCard
          avgFirstResponseMinutes={stats?.avg_first_response_minutes ?? 0}
          avgResolutionMinutes={stats?.avg_resolution_minutes ?? 0}
          loading={isLoading}
        />
        <QueueDistributionCard
          distribution={stats?.queue_distribution ?? { N1: 0, N2: 0, N3: 0, CS: 0 }}
          loading={isLoading}
        />
      </div>

      {/* Linha 5: Capacidade do Time */}
      <TeamCapacityCard
        distribution={stats?.queue_distribution ?? { N1: 0, N2: 0, N3: 0, CS: 0 }}
        unassigned={stats?.queue_unassigned ?? { N1: 0, N2: 0, N3: 0, CS: 0 }}
        breached={stats?.queue_breached ?? { N1: 0, N2: 0, N3: 0, CS: 0 }}
        loading={isLoading}
      />

      {/* Ticket Create Modal */}
      <TicketCreateModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
      />
    </div>
  );
}
