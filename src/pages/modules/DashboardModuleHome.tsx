import React from 'react';
import { 
  LayoutDashboard, 
  AlertTriangle, 
  TrendingUp, 
  Users, 
  FileStack, 
  HeadphonesIcon,
  DollarSign,
} from 'lucide-react';
import { ModuleHeader, KPICard, ShortcutCard, SectionTitle } from '@/components/navigation/ModuleCard';
import { authService } from '@/services/authService';
import { USER_LEVELS } from '@/config/modulesConfig';

export default function DashboardModuleHome() {
  const user = authService.getCurrentUser();
  const userLevel = user?.level ?? null;
  const isAdmin = userLevel === USER_LEVELS.ADMIN;
  const isManager = userLevel === USER_LEVELS.GERENTE_COMERCIAL || userLevel === USER_LEVELS.GERENTE_SUPORTE;

  return (
    <div className="space-y-8">
      <ModuleHeader
        title="Dashboard"
        description="Visão geral do sistema OPEN Datacenter"
        icon={LayoutDashboard}
      />

      {/* KPIs Section */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Propostas Abertas"
          value="24"
          description="Aguardando aprovação"
          icon={FileStack}
          trend={{ value: 12, label: 'vs mês anterior', positive: true }}
        />
        <KPICard
          title="Tickets Abertos"
          value="18"
          description="Em atendimento"
          icon={HeadphonesIcon}
          trend={{ value: 5, label: 'vs mês anterior', positive: false }}
        />
        <KPICard
          title="MRR Atual"
          value="R$ 245.800"
          description="Receita recorrente mensal"
          icon={DollarSign}
          trend={{ value: 8.5, label: 'vs mês anterior', positive: true }}
        />
        <KPICard
          title="Clientes Ativos"
          value="156"
          description="Contratos ativos"
          icon={Users}
          trend={{ value: 3, label: 'vs mês anterior', positive: true }}
        />
      </div>

      {/* Quick Actions Section */}
      <div>
        <SectionTitle 
          title="Atalhos Rápidos" 
          description="Acesse rapidamente as funcionalidades mais utilizadas"
        />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {(isAdmin || isManager || userLevel === USER_LEVELS.COMERCIAL) && (
            <ShortcutCard
              title="Nova Proposta"
              description="Criar uma nova proposta comercial"
              icon={FileStack}
              href="/modulos/comercial/propostas/criar"
            />
          )}
          {(isAdmin || userLevel === USER_LEVELS.SUPORTE || userLevel === USER_LEVELS.GERENTE_SUPORTE) && (
            <ShortcutCard
              title="Tickets de Suporte"
              description="Ver fila de atendimentos"
              icon={HeadphonesIcon}
              href="/modulos/atendimentos/suporte"
            />
          )}
          {(isAdmin || isManager) && (
            <ShortcutCard
              title="Indicadores"
              description="Visualizar indicadores-chave"
              icon={TrendingUp}
              href="/modulos/dashboard/indicadores"
            />
          )}
        </div>
      </div>

      {/* Alerts Section - Only for managers and admin */}
      {(isAdmin || isManager) && (
        <div>
          <SectionTitle 
            title="Alertas" 
            description="Itens que requerem atenção"
          />
          <div className="grid gap-4 md:grid-cols-2">
            <div className="p-4 rounded-lg border border-yellow-500/30 bg-yellow-500/5">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
                <div>
                  <p className="font-medium text-yellow-600 dark:text-yellow-400">3 propostas expiram em 7 dias</p>
                  <p className="text-sm text-muted-foreground">Verifique as propostas pendentes</p>
                </div>
              </div>
            </div>
            <div className="p-4 rounded-lg border border-red-500/30 bg-red-500/5">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                <div>
                  <p className="font-medium text-red-600 dark:text-red-400">2 tickets com SLA crítico</p>
                  <p className="text-sm text-muted-foreground">Requer atenção imediata</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
