// ============================================================================
// ATENDIMENTOS MODULE HOME - Centro de Operações Técnicas
// ============================================================================

import React, { useEffect, useState } from 'react';
import { 
  HeadphonesIcon, 
  Activity, 
  Users, 
  BarChart3, 
  AlertTriangle,
  Clock,
  CheckCircle,
  Plus,
  Server,
  Phone,
  Building2,
} from 'lucide-react';
import { ModuleHeader, KPICard, ShortcutCard, SectionTitle } from '@/components/navigation/ModuleCard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { authService } from '@/services/authService';
import { USER_LEVELS } from '@/config/modulesConfig';
import { getIncidentStats, getCurrentOnCallUsers } from '@/services/techOpsService';
import type { TechOnCallShift } from '@/types/techOps';

export default function AtendimentosModuleHome() {
  const user = authService.getCurrentUser();
  const userLevel = user?.level ?? null;
  const isSupport = userLevel === USER_LEVELS.SUPORTE || userLevel === USER_LEVELS.GERENTE_SUPORTE;
  const isCS = userLevel === USER_LEVELS.SUCESSO_CLIENTE;
  const isAdmin = userLevel === USER_LEVELS.ADMIN;

  const [stats, setStats] = useState({
    abertos: 0,
    em_atendimento: 0,
    escalados: 0,
    s1_ativos: 0,
  });
  const [onCallUsers, setOnCallUsers] = useState<TechOnCallShift[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [statsData, onCall] = await Promise.all([
        getIncidentStats(),
        getCurrentOnCallUsers(),
      ]);
      setStats(statsData);
      setOnCallUsers(onCall);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <ModuleHeader
        title="Centro de Operações"
        description="Gestão de incidentes, infraestrutura e suporte técnico"
        icon={HeadphonesIcon}
        actions={
          <Link to="/modulos/atendimentos/suporte-tecnico/incidentes/criar">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Novo Incidente
            </Button>
          </Link>
        }
      />

      {/* KPIs Section */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Incidentes Abertos"
          value={loading ? '...' : stats.abertos.toString()}
          description="Aguardando classificação"
          icon={AlertTriangle}
          className={stats.abertos > 0 ? 'border-yellow-500/30' : ''}
        />
        <KPICard
          title="Em Atendimento"
          value={loading ? '...' : stats.em_atendimento.toString()}
          description="Sendo trabalhados"
          icon={Activity}
        />
        <KPICard
          title="Escalados"
          value={loading ? '...' : stats.escalados.toString()}
          description="Necessitam atenção"
          icon={Clock}
          className={stats.escalados > 0 ? 'border-orange-500/30' : ''}
        />
        <KPICard
          title="S1 Ativos"
          value={loading ? '...' : stats.s1_ativos.toString()}
          description="Severidade crítica"
          icon={AlertTriangle}
          className={stats.s1_ativos > 0 ? 'border-red-500/30' : ''}
        />
      </div>

      {/* Alerts Section */}
      {(stats.s1_ativos > 0 || stats.escalados > 0) && (
        <div>
          <SectionTitle 
            title="Alertas Críticos" 
            description="Itens que requerem atenção imediata"
          />
          <div className="grid gap-4 md:grid-cols-2">
            {stats.s1_ativos > 0 && (
              <Link 
                to="/modulos/atendimentos/suporte-tecnico/incidentes?severidade=S1"
                className="p-4 rounded-lg border border-red-500/30 bg-red-500/5 hover:bg-red-500/10 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                  <div>
                    <p className="font-medium text-red-600 dark:text-red-400">
                      {stats.s1_ativos} incidente(s) S1 ativo(s)
                    </p>
                    <p className="text-sm text-muted-foreground">Severidade crítica - ação imediata</p>
                  </div>
                </div>
              </Link>
            )}
            {stats.escalados > 0 && (
              <Link 
                to="/modulos/atendimentos/suporte-tecnico/incidentes?status=ESCALADO"
                className="p-4 rounded-lg border border-orange-500/30 bg-orange-500/5 hover:bg-orange-500/10 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-orange-500" />
                  <div>
                    <p className="font-medium text-orange-600 dark:text-orange-400">
                      {stats.escalados} incidente(s) escalado(s)
                    </p>
                    <p className="text-sm text-muted-foreground">Verificar status de escalação</p>
                  </div>
                </div>
              </Link>
            )}
          </div>
        </div>
      )}

      {/* On-Call Widget */}
      <div>
        <SectionTitle 
          title="Plantão Ativo" 
          description="Técnicos de plantão no momento"
        />
        <div className="p-4 rounded-lg border bg-card">
          {onCallUsers.length === 0 ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Phone className="h-5 w-5 text-muted-foreground" />
                <p className="text-muted-foreground">Nenhum plantonista ativo no momento</p>
              </div>
              <Link to="/modulos/atendimentos/suporte-tecnico/plantao">
                <Button variant="outline" size="sm">Configurar Plantão</Button>
              </Link>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {onCallUsers.map((shift) => (
                  <div key={shift.id} className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      {shift.user?.name} ({shift.level})
                    </Badge>
                  </div>
                ))}
              </div>
              <Link to="/modulos/atendimentos/suporte-tecnico/plantao">
                <Button variant="ghost" size="sm">Ver Escala</Button>
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions Section */}
      <div>
        <SectionTitle 
          title="Atalhos Rápidos" 
          description="Acesse rapidamente as funcionalidades"
        />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* Chamados — fluxo unificado */}
          <ShortcutCard
            title="Meus Chamados"
            description="Abrir e acompanhar chamados"
            icon={HeadphonesIcon}
            href="/modulos/atendimentos/suporte-tecnico"
          />
          
          {/* Fila de Suporte (apenas para suporte 900+) */}
          {(isSupport || isAdmin) && (
            <ShortcutCard
              title="Fila de Suporte"
              description="Gerenciar todos chamados"
              icon={Users}
              href="/modulos/atendimentos/suporte"
            />
          )}
          
          {/* Main TechOps shortcuts */}
          <ShortcutCard
            title="NOC / TechOps"
            description="Centro de operações"
            icon={Activity}
            href="/modulos/atendimentos/suporte-tecnico"
          />
          <ShortcutCard
            title="Incidentes"
            description="Lista de incidentes"
            icon={AlertTriangle}
            href="/modulos/atendimentos/suporte-tecnico/incidentes"
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
          
          {/* Legacy/CS shortcuts */}
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
