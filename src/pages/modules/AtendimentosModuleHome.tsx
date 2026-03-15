// ============================================================================
// ATENDIMENTOS MODULE HOME - Dashboard Operacional (sem grid de chamados)
// ============================================================================

import React, { useState } from 'react';
import {
  HeadphonesIcon,
  Activity,
  Users,
  BarChart3,
  Plus,
  Server,
  Building2,
} from 'lucide-react';
import { ModuleHeader, ShortcutCard, SectionTitle } from '@/components/navigation/ModuleCard';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { authService } from '@/services/authService';
import { USER_LEVELS } from '@/config/modulesConfig';
import { useSupportDashboard } from '@/hooks/useSupportDashboard';
import { SLAKPICards } from '@/components/atendimentos/SLAKPICards';
import { QueueDistributionCard } from '@/components/atendimentos/QueueDistributionCard';
import { ResponseTimeCard } from '@/components/atendimentos/ResponseTimeCard';
import { OnCallWidget } from '@/components/atendimentos/OnCallWidget';
import { TicketCreateModal } from '@/components/tickets-core/TicketCreateModal';

export default function AtendimentosModuleHome() {
  const user = authService.getCurrentUser();
  const userLevel = user?.level ?? null;
  const isSupport = userLevel === USER_LEVELS.SUPORTE || userLevel === USER_LEVELS.GERENTE_SUPORTE;
  const isCS = userLevel === USER_LEVELS.SUCESSO_CLIENTE;
  const isAdmin = userLevel === USER_LEVELS.ADMIN;

  const { stats, isLoading } = useSupportDashboard();
  const [showCreateModal, setShowCreateModal] = useState(false);

  return (
    <div className="space-y-8">
      <ModuleHeader
        title="Centro de Operações"
        description="Dashboard operacional — gestão de chamados e infraestrutura"
        icon={HeadphonesIcon}
        actions={
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Abrir Chamado
          </Button>
        }
      />

      {/* SLA KPIs */}
      <SLAKPICards
        openTickets={stats?.open_tickets ?? 0}
        slaOk={stats?.sla_ok ?? 0}
        slaBreached={stats?.sla_breached ?? 0}
        criticalCount={stats?.critical_count ?? 0}
        loading={isLoading}
      />

      {/* Middle row: Queue Distribution + Response Times + On-Call */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <QueueDistributionCard
          distribution={stats?.queue_distribution ?? { N1: 0, N2: 0, N3: 0, CS: 0 }}
          loading={isLoading}
        />
        <ResponseTimeCard
          avgFirstResponseMinutes={stats?.avg_first_response_minutes ?? 0}
          avgResolutionMinutes={stats?.avg_resolution_minutes ?? 0}
          loading={isLoading}
        />
        <OnCallWidget
          shifts={stats?.oncall_shifts ?? []}
          loading={isLoading}
        />
      </div>

      {/* Quick Actions Section */}
      <div>
        <SectionTitle
          title="Atalhos Rápidos"
          description="Acesse rapidamente as funcionalidades"
        />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <ShortcutCard
            title="Meus Chamados"
            description="Abrir e acompanhar chamados"
            icon={HeadphonesIcon}
            href="/modulos/atendimentos/suporte-tecnico"
          />

          {(isSupport || isAdmin) && (
            <ShortcutCard
              title="Fila de Suporte"
              description="Gerenciar todos chamados"
              icon={Users}
              href="/modulos/atendimentos/suporte"
            />
          )}

          <ShortcutCard
            title="NOC / TechOps"
            description="Centro de operações"
            icon={Activity}
            href="/modulos/atendimentos/suporte-tecnico"
          />
          <ShortcutCard
            title="Clientes"
            description="Gestão de clientes"
            icon={Building2}
            href="/modulos/atendimentos/suporte-tecnico/clientes"
          />
          <ShortcutCard
            title="Infraestrutura"
            description="Assets e servidores"
            icon={Server}
            href="/modulos/atendimentos/suporte-tecnico/infra"
          />

          {(isCS || isAdmin) && (
            <ShortcutCard
              title="Customer Success"
              description="Atendimentos de CS"
              icon={Users}
              href="/modulos/atendimentos/cs"
            />
          )}
          <ShortcutCard
            title="KPIs de Atendimento"
            description="Métricas e indicadores"
            icon={BarChart3}
            href="/modulos/atendimentos/kpis"
          />
        </div>
      </div>

      {/* Ticket Create Modal — unified flow */}
      <TicketCreateModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
      />
    </div>
  );
}
