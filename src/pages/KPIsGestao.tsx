// ============================================================================
// KPIs GESTÃO — Management overview from support_tickets (real data)
// ============================================================================

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { KPICard } from '@/components/kpis/KPICard';
import { useSupportTicketList } from '@/hooks/useSupportTicketCore';
import {
  BarChart3, Clock, Inbox, Target, AlertTriangle,
  TrendingUp,
} from 'lucide-react';
import { differenceInMinutes, isToday } from 'date-fns';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';

const COLORS = [
  'hsl(var(--primary))', 'hsl(var(--chart-2))',
  'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))',
];

function formatMinutes(m: number): string {
  if (m < 60) return `${Math.round(m)}min`;
  if (m < 1440) return `${(m / 60).toFixed(1)}h`;
  return `${(m / 1440).toFixed(1)}d`;
}

export default function KPIsGestao() {
  const { tickets: allTickets } = useSupportTicketList({ per_page: 100 });

  const metrics = useMemo(() => {
    const now = new Date();

    const active = allTickets.filter(t =>
      !['encerrado_cs', 'cancelado'].includes(t.status)
    );

    const backlog = active.length;
    const openedToday = allTickets.filter(t => isToday(new Date(t.created_at))).length;

    // SLA breached
    const breached = active.filter(t =>
      t.resolution_due_at && new Date(t.resolution_due_at) < now && !t.resolved_at
    ).length;

    // Reopened
    const reopened = allTickets.filter(t => t.status === 'reaberto').length;

    // MTTA
    const mttaVals = allTickets
      .filter(t => t.first_response_at)
      .map(t => differenceInMinutes(new Date(t.first_response_at!), new Date(t.created_at)))
      .filter(m => m >= 0);
    const mtta = mttaVals.length > 0 ? mttaVals.reduce((a, b) => a + b, 0) / mttaVals.length : 0;

    // MTTR
    const mttrVals = allTickets
      .filter(t => t.resolved_at)
      .map(t => differenceInMinutes(new Date(t.resolved_at!), new Date(t.created_at)))
      .filter(m => m >= 0);
    const mttr = mttrVals.length > 0 ? mttrVals.reduce((a, b) => a + b, 0) / mttrVals.length : 0;

    // By queue
    const byQueue: Record<string, number> = { N1: 0, N2: 0, N3: 0, CS: 0 };
    allTickets.forEach(t => {
      const q = t.queue_code || t.current_support_level || 'N1';
      if (byQueue[q] !== undefined) byQueue[q]++;
      else byQueue[q] = 1;
    });

    // By status
    const byStatus: Record<string, number> = {};
    allTickets.forEach(t => {
      byStatus[t.status] = (byStatus[t.status] || 0) + 1;
    });

    // By severity
    const bySeverity: Record<string, number> = {};
    allTickets.forEach(t => {
      bySeverity[t.severity] = (bySeverity[t.severity] || 0) + 1;
    });

    // SLA compliance
    const resolved = allTickets.filter(t => t.resolved_at);
    const withinSla = resolved.filter(t =>
      t.resolution_due_at && new Date(t.resolved_at!) <= new Date(t.resolution_due_at)
    );
    const slaPercent = resolved.length > 0 ? (withinSla.length / resolved.length) * 100 : 100;

    const queueData = Object.entries(byQueue).map(([name, value]) => ({ name, value }));
    const statusData = Object.entries(byStatus).map(([name, value]) => ({ name, value }));
    const severityData = Object.entries(bySeverity).map(([name, value]) => ({ name, value }));

    return {
      backlog, openedToday, breached, reopened, mtta, mttr,
      slaPercent, queueData, statusData, severityData,
    };
  }, [allTickets]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">KPIs — Visão Gestão</h2>
        <p className="text-muted-foreground">Indicadores consolidados de toda a operação</p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Backlog Total"
          value={metrics.backlog}
          subtitle="Tickets ativos"
          icon={<Inbox className="h-4 w-4" />}
          variant={metrics.backlog > 15 ? 'warning' : 'default'}
        />
        <KPICard
          title="Abertos Hoje"
          value={metrics.openedToday}
          subtitle="Novos tickets"
          icon={<Target className="h-4 w-4" />}
        />
        <KPICard
          title="SLA Vencido"
          value={metrics.breached}
          subtitle="Além do prazo"
          icon={<AlertTriangle className="h-4 w-4" />}
          variant={metrics.breached > 0 ? 'error' : 'success'}
        />
        <KPICard
          title="SLA Global"
          value={`${metrics.slaPercent.toFixed(0)}%`}
          subtitle="Resolvidos dentro do SLA"
          icon={<TrendingUp className="h-4 w-4" />}
          variant={metrics.slaPercent >= 80 ? 'success' : metrics.slaPercent >= 60 ? 'warning' : 'error'}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="MTTA"
          value={metrics.mtta > 0 ? formatMinutes(metrics.mtta) : '—'}
          subtitle="Tempo médio 1ª resposta"
          icon={<Clock className="h-4 w-4" />}
        />
        <KPICard
          title="MTTR"
          value={metrics.mttr > 0 ? formatMinutes(metrics.mttr) : '—'}
          subtitle="Tempo médio resolução"
          icon={<Clock className="h-4 w-4" />}
        />
        <KPICard
          title="Reaberturas"
          value={metrics.reopened}
          subtitle="Tickets reabertos"
          icon={<TrendingUp className="h-4 w-4" />}
          variant={metrics.reopened > 0 ? 'warning' : 'default'}
        />
        <KPICard
          title="Total de Tickets"
          value={allTickets.length}
          subtitle="No período"
          icon={<BarChart3 className="h-4 w-4" />}
        />
      </div>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Distribuição por Fila</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metrics.queueData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tickets por Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={metrics.statusData}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {metrics.statusData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Distribuição por Severidade</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.severityData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis type="number" className="text-xs" />
                <YAxis dataKey="name" type="category" width={60} className="text-xs" />
                <Tooltip />
                <Bar dataKey="value" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
