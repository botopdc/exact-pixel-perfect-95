// ============================================================================
// KPIs SUPORTE — Operational support metrics from support_tickets (real data)
// ============================================================================

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { KPICard } from '@/components/kpis/KPICard';
import { useSupportTicketList } from '@/hooks/useSupportTicketCore';
import { CoreTicket } from '@/services/supportTicketCoreService';
import {
  Clock, Users, Inbox, Target, AlertTriangle,
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

export default function KPIsSuporte() {
  // Fetch open tickets (N1/N2/N3 — NOT encerrado or CS)
  const { tickets: allOpen } = useSupportTicketList({
    per_page: 100,
  });

  const metrics = useMemo(() => {
    const now = new Date();

    // Separate by support vs CS
    const supportTickets = allOpen.filter(t =>
      !['encerrado_cs', 'cancelado'].includes(t.status) &&
      t.current_support_level !== 'CS'
    );

    const backlog = supportTickets.filter(t =>
      ['novo', 'triagem', 'em_atendimento', 'aguardando_cliente', 'aguardando_terceiro', 'reaberto'].includes(t.status)
    );

    // By queue
    const byQueue: Record<string, number> = { N1: 0, N2: 0, N3: 0 };
    backlog.forEach(t => {
      const q = t.queue_code || t.current_support_level || 'N1';
      if (byQueue[q] !== undefined) byQueue[q]++;
    });

    // By severity
    const bySeverity: Record<string, number> = {};
    backlog.forEach(t => {
      bySeverity[t.severity] = (bySeverity[t.severity] || 0) + 1;
    });

    // SLA breached
    const breached = backlog.filter(t =>
      t.resolution_due_at && new Date(t.resolution_due_at) < now && !t.resolved_at
    );

    // Opened today
    const openedToday = allOpen.filter(t => isToday(new Date(t.created_at)));

    // MTTA (first response)
    const mttaValues = allOpen
      .filter(t => t.first_response_at && t.created_at)
      .map(t => differenceInMinutes(new Date(t.first_response_at!), new Date(t.created_at)))
      .filter(m => m >= 0);
    const mtta = mttaValues.length > 0
      ? mttaValues.reduce((a, b) => a + b, 0) / mttaValues.length
      : 0;

    // MTTR (resolution)
    const mttrValues = allOpen
      .filter(t => t.resolved_at && t.created_at)
      .map(t => differenceInMinutes(new Date(t.resolved_at!), new Date(t.created_at)))
      .filter(m => m >= 0);
    const mttr = mttrValues.length > 0
      ? mttrValues.reduce((a, b) => a + b, 0) / mttrValues.length
      : 0;

    // By assigned
    const byAnalyst: Record<string, number> = {};
    backlog.forEach(t => {
      const name = t.assigned_to_name || 'Não atribuído';
      byAnalyst[name] = (byAnalyst[name] || 0) + 1;
    });

    const analystData = Object.entries(byAnalyst)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 6)
      .map(([name, count]) => ({
        name: name.length > 15 ? name.slice(0, 15) + '…' : name,
        count,
      }));

    // By category
    const byCategory: Record<string, number> = {};
    backlog.forEach(t => {
      byCategory[t.category || 'Outros'] = (byCategory[t.category || 'Outros'] || 0) + 1;
    });
    const categoryData = Object.entries(byCategory)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([name, value]) => ({ name, value }));

    const queueData = Object.entries(byQueue).map(([name, value]) => ({ name, value }));
    const severityData = Object.entries(bySeverity).map(([name, value]) => ({ name, value }));

    return {
      backlogCount: backlog.length,
      openedToday: openedToday.length,
      breachedCount: breached.length,
      mtta,
      mttr,
      queueData,
      severityData,
      analystData,
      categoryData,
    };
  }, [allOpen]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">KPIs — Suporte Técnico</h2>
        <p className="text-muted-foreground">Métricas operacionais do time técnico (N1/N2/N3)</p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <KPICard
          title="Backlog"
          value={metrics.backlogCount}
          subtitle="Tickets em aberto"
          icon={<Inbox className="h-4 w-4" />}
          variant={metrics.backlogCount > 10 ? 'warning' : 'default'}
        />
        <KPICard
          title="Abertos Hoje"
          value={metrics.openedToday}
          subtitle="Novos tickets"
          icon={<Target className="h-4 w-4" />}
        />
        <KPICard
          title="SLA Vencido"
          value={metrics.breachedCount}
          subtitle="Tickets além do prazo"
          icon={<AlertTriangle className="h-4 w-4" />}
          variant={metrics.breachedCount > 0 ? 'error' : 'success'}
        />
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
      </div>

      {/* Charts Row 1 */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* By Queue */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Backlog por Fila</CardTitle>
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

        {/* By Severity */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Distribuição por Severidade</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              {metrics.severityData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={metrics.severityData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {metrics.severityData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  Nenhum dado disponível
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* By Analyst */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Volume por Analista</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              {metrics.analystData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={metrics.analystData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis type="number" className="text-xs" />
                    <YAxis dataKey="name" type="category" width={120} className="text-xs" />
                    <Tooltip />
                    <Bar dataKey="count" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  Nenhum dado disponível
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* By Category */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Gargalos por Categoria</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              {metrics.categoryData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={metrics.categoryData}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {metrics.categoryData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  Nenhum dado disponível
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
