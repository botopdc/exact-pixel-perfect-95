// ============================================================================
// KPIs CS — Operational CS metrics from support_tickets (real data)
// ============================================================================

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { KPICard } from '@/components/kpis/KPICard';
import { useSupportTicketList } from '@/hooks/useSupportTicketCore';
import { CoreTicket } from '@/services/supportTicketCoreService';
import { Clock, CheckCircle2, RefreshCw, Users, Timer } from 'lucide-react';
import { differenceInMinutes } from 'date-fns';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';

const COLORS = [
  'hsl(var(--primary))', 'hsl(var(--chart-2))',
  'hsl(var(--chart-3))', 'hsl(var(--chart-4))',
];

function formatMinutes(m: number): string {
  if (m < 60) return `${Math.round(m)}min`;
  if (m < 1440) return `${(m / 60).toFixed(1)}h`;
  return `${(m / 1440).toFixed(1)}d`;
}

export default function KPIsCS() {
  // Fetch all CS-relevant tickets
  const { tickets: aguardando } = useSupportTicketList({
    status: 'resolvido_suporte',
    current_queue: 'CS',
    per_page: 100,
  });

  const { tickets: encerrados } = useSupportTicketList({
    status: 'encerrado_cs',
    per_page: 100,
  });

  const { tickets: reabertos } = useSupportTicketList({
    status: 'reaberto',
    per_page: 100,
  });

  const metrics = useMemo(() => {
    // Tempo médio entre resolvido_suporte e encerrado_cs
    const closeTimes = encerrados
      .filter(t => t.resolved_at && t.closed_at)
      .map(t => differenceInMinutes(new Date(t.closed_at!), new Date(t.resolved_at!)))
      .filter(m => m >= 0);

    const avgCloseTime = closeTimes.length > 0
      ? closeTimes.reduce((a, b) => a + b, 0) / closeTimes.length
      : 0;

    // Volume por responsável CS (who closed)
    const closedByMap: Record<string, number> = {};
    encerrados.forEach(t => {
      const name = t.metadata?.closed_by_name as string || 'Não identificado';
      closedByMap[name] = (closedByMap[name] || 0) + 1;
    });

    const closedByData = Object.entries(closedByMap)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([name, count]) => ({ name: name.length > 15 ? name.slice(0, 15) + '…' : name, count }));

    // Severity distribution of waiting tickets
    const severityMap: Record<string, number> = {};
    aguardando.forEach(t => {
      severityMap[t.severity] = (severityMap[t.severity] || 0) + 1;
    });

    const severityData = Object.entries(severityMap)
      .map(([name, value]) => ({ name, value }));

    return {
      aguardandoCount: aguardando.length,
      encerradosCount: encerrados.length,
      reabertosCount: reabertos.length,
      avgCloseTime,
      closedByData,
      severityData,
    };
  }, [aguardando, encerrados, reabertos]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">KPIs — Customer Success Operacional</h2>
        <p className="text-muted-foreground">Métricas de validação e encerramento de tickets</p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Aguardando Validação"
          value={metrics.aguardandoCount}
          subtitle="Tickets resolvidos pelo suporte"
          icon={<Timer className="h-4 w-4" />}
          variant={metrics.aguardandoCount > 5 ? 'warning' : 'default'}
        />
        <KPICard
          title="Encerrados"
          value={metrics.encerradosCount}
          subtitle="Tickets validados e encerrados"
          icon={<CheckCircle2 className="h-4 w-4" />}
          variant="success"
        />
        <KPICard
          title="Reabertos"
          value={metrics.reabertosCount}
          subtitle="Devolvidos ao suporte"
          icon={<RefreshCw className="h-4 w-4" />}
          variant={metrics.reabertosCount > 0 ? 'error' : 'default'}
        />
        <KPICard
          title="Tempo Médio de Validação"
          value={metrics.avgCloseTime > 0 ? formatMinutes(metrics.avgCloseTime) : '—'}
          subtitle="Resolvido → Encerrado"
          icon={<Clock className="h-4 w-4" />}
        />
      </div>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Severity distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Severidade dos Aguardando</CardTitle>
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
                      {metrics.severityData.map((_, index) => (
                        <Cell key={index} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  Nenhum ticket aguardando
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Closed by */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Volume por Responsável CS</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              {metrics.closedByData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={metrics.closedByData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis type="number" className="text-xs" />
                    <YAxis dataKey="name" type="category" width={120} className="text-xs" />
                    <Tooltip />
                    <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  Nenhum encerramento registrado
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
