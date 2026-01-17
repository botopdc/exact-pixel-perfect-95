import React from 'react';
import { 
  HeadphonesIcon, 
  Wrench, 
  Users, 
  BarChart3, 
  AlertTriangle,
  Clock,
  CheckCircle,
  Plus,
} from 'lucide-react';
import { ModuleHeader, KPICard, ShortcutCard, SectionTitle } from '@/components/navigation/ModuleCard';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { authService } from '@/services/authService';
import { USER_LEVELS } from '@/config/modulesConfig';

export default function AtendimentosModuleHome() {
  const user = authService.getCurrentUser();
  const userLevel = user?.level ?? null;
  const isSupport = userLevel === USER_LEVELS.SUPORTE || userLevel === USER_LEVELS.GERENTE_SUPORTE;
  const isCS = userLevel === USER_LEVELS.SUCESSO_CLIENTE;
  const isAdmin = userLevel === USER_LEVELS.ADMIN;

  return (
    <div className="space-y-8">
      <ModuleHeader
        title="Atendimentos"
        description="Tickets, suporte e customer success"
        icon={HeadphonesIcon}
        actions={
          <Link to="/modulos/atendimentos/suporte">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Novo Ticket
            </Button>
          </Link>
        }
      />

      {/* KPIs Section */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Tickets Abertos"
          value="18"
          description="Em atendimento"
          icon={Clock}
          trend={{ value: 5, label: 'vs ontem', positive: false }}
        />
        <KPICard
          title="SLA Crítico"
          value="2"
          description="Requer ação imediata"
          icon={AlertTriangle}
        />
        <KPICard
          title="Resolvidos Hoje"
          value="12"
          description="Tickets fechados"
          icon={CheckCircle}
          trend={{ value: 20, label: 'vs ontem', positive: true }}
        />
        <KPICard
          title="Tempo Médio"
          value="2h 45m"
          description="Para primeira resposta"
          icon={Clock}
        />
      </div>

      {/* Alerts Section */}
      <div>
        <SectionTitle 
          title="Alertas Críticos" 
          description="Itens que requerem atenção imediata"
        />
        <div className="grid gap-4 md:grid-cols-2">
          <div className="p-4 rounded-lg border border-red-500/30 bg-red-500/5">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <div>
                <p className="font-medium text-red-600 dark:text-red-400">2 tickets com SLA estourado</p>
                <p className="text-sm text-muted-foreground">Clientes: Empresa ABC, Tech Solutions</p>
              </div>
            </div>
          </div>
          <div className="p-4 rounded-lg border border-yellow-500/30 bg-yellow-500/5">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-yellow-500" />
              <div>
                <p className="font-medium text-yellow-600 dark:text-yellow-400">5 tickets sem resposta há 4h+</p>
                <p className="text-sm text-muted-foreground">Verificar fila de atendimento</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions Section */}
      <div>
        <SectionTitle 
          title="Atalhos Rápidos" 
          description="Acesse rapidamente as funcionalidades"
        />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {(isSupport || isAdmin) && (
            <ShortcutCard
              title="Fila de Suporte"
              description="Ver tickets de suporte"
              icon={Wrench}
              href="/modulos/atendimentos/suporte"
            />
          )}
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
    </div>
  );
}
