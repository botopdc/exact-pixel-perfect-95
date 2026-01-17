// ============================================================================
// NOC HOME PAGE - Centro de Operações Técnicas
// ============================================================================

import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Activity,
  Server,
  Users,
  Clock,
  Plus,
  Search,
  Phone,
  ArrowUpRight,
  Database,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ModuleHeader, KPICard, SectionTitle } from '@/components/navigation/ModuleCard';
import {
  getIncidentStats,
  getIncidents,
  getCurrentOnCallUsers,
} from '@/services/techOpsService';
import type { TechIncident, TechOnCallShift } from '@/types/techOps';
import {
  INCIDENT_SEVERITY_LABELS,
  INCIDENT_SEVERITY_COLORS,
  INCIDENT_STATUS_LABELS,
  INCIDENT_STATUS_COLORS,
} from '@/types/techOps';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function NOCHomePage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [stats, setStats] = useState({
    abertos: 0,
    em_atendimento: 0,
    escalados: 0,
    s1_ativos: 0,
  });
  const [recentIncidents, setRecentIncidents] = useState<TechIncident[]>([]);
  const [onCallUsers, setOnCallUsers] = useState<TechOnCallShift[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [statsData, incidents, onCall] = await Promise.all([
        getIncidentStats(),
        getIncidents({ status: ['ABERTO', 'CLASSIFICADO', 'EM_ATENDIMENTO', 'ESCALADO'] }),
        getCurrentOnCallUsers(),
      ]);
      setStats(statsData);
      setRecentIncidents(incidents.slice(0, 10));
      setOnCallUsers(onCall);
    } catch (error) {
      console.error('Erro ao carregar dados do NOC:', error);
    } finally {
      setLoading(false);
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/modulos/atendimentos/suporte-tecnico/incidentes?q=${encodeURIComponent(searchQuery)}`);
    }
  };

  return (
    <div className="space-y-6">
      <ModuleHeader
        title="Centro de Operações (NOC)"
        description="Monitoramento e gestão de incidentes técnicos"
        icon={Activity}
        actions={
          <Link to="/modulos/atendimentos/suporte-tecnico/incidentes/criar">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Novo Incidente
            </Button>
          </Link>
        }
      />

      {/* Search Bar */}
      <form onSubmit={handleSearch}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por cliente, IP, ID do incidente..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-12"
          />
        </div>
      </form>

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Incidentes Abertos"
          value={stats.abertos.toString()}
          description="Aguardando classificação"
          icon={AlertTriangle}
          className={stats.abertos > 0 ? 'border-yellow-500/30' : ''}
        />
        <KPICard
          title="Em Atendimento"
          value={stats.em_atendimento.toString()}
          description="Sendo trabalhados"
          icon={Activity}
        />
        <KPICard
          title="Escalados"
          value={stats.escalados.toString()}
          description="Necessitam atenção"
          icon={ArrowUpRight}
          className={stats.escalados > 0 ? 'border-orange-500/30' : ''}
        />
        <KPICard
          title="S1 Ativos"
          value={stats.s1_ativos.toString()}
          description="Severidade crítica"
          icon={AlertTriangle}
          className={stats.s1_ativos > 0 ? 'border-red-500/30' : ''}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Incidents */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Incidentes Recentes</CardTitle>
              <Link to="/modulos/atendimentos/suporte-tecnico/incidentes">
                <Button variant="ghost" size="sm">Ver todos</Button>
              </Link>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
                </div>
              ) : recentIncidents.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Activity className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Nenhum incidente ativo</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentIncidents.map((incident) => (
                    <Link
                      key={incident.id}
                      to={`/modulos/atendimentos/suporte-tecnico/incidentes/${incident.id}`}
                      className="block p-3 rounded-lg border hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge className={INCIDENT_SEVERITY_COLORS[incident.severidade]}>
                              {INCIDENT_SEVERITY_LABELS[incident.severidade]}
                            </Badge>
                            <Badge variant="outline" className={INCIDENT_STATUS_COLORS[incident.status]}>
                              {INCIDENT_STATUS_LABELS[incident.status]}
                            </Badge>
                          </div>
                          <p className="font-medium truncate">{incident.title}</p>
                          <p className="text-sm text-muted-foreground truncate">
                            {incident.client?.razao_social || incident.client?.nome_fantasia}
                            {incident.asset && ` • ${incident.asset.identificador}`}
                          </p>
                        </div>
                        <div className="text-right text-sm text-muted-foreground whitespace-nowrap">
                          <Clock className="h-3 w-3 inline mr-1" />
                          {formatDistanceToNow(new Date(incident.opened_at), { addSuffix: true, locale: ptBR })}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* On-Call Widget */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Phone className="h-5 w-5" />
                Plantão Ativo
              </CardTitle>
            </CardHeader>
            <CardContent>
              {onCallUsers.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Nenhum plantonista ativo</p>
                  <Link to="/modulos/atendimentos/suporte-tecnico/plantao">
                    <Button variant="outline" size="sm" className="mt-3">
                      Configurar Plantão
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {onCallUsers.map((shift) => (
                    <div key={shift.id} className="flex items-center gap-3 p-2 rounded-lg bg-accent/30">
                      <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
                        <Users className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-sm">{shift.user?.name}</p>
                        <p className="text-xs text-muted-foreground">{shift.level}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Links */}
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-lg">Acesso Rápido</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link to="/modulos/atendimentos/suporte-tecnico/clientes" className="block">
                <Button variant="outline" className="w-full justify-start">
                  <Users className="h-4 w-4 mr-2" />
                  Clientes
                </Button>
              </Link>
              <Link to="/modulos/atendimentos/suporte-tecnico/infra" className="block">
                <Button variant="outline" className="w-full justify-start">
                  <Server className="h-4 w-4 mr-2" />
                  Infraestrutura
                </Button>
              </Link>
              <Link to="/modulos/atendimentos/suporte-tecnico/seed" className="block">
                <Button variant="outline" className="w-full justify-start text-muted-foreground">
                  <Database className="h-4 w-4 mr-2" />
                  Dados de Exemplo (Admin)
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
