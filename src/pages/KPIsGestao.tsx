import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { KPICard } from '@/components/kpis/KPICard';
import { KPIFilters } from '@/components/kpis/KPIFilters';
import { AlertCard } from '@/components/kpis/AlertCard';
import { 
  kpiService, 
  formatarTempo, 
  PeriodoFiltro, 
  TimeFiltro,
  getFilterOptions 
} from '@/services/kpiService';
import { STATUS_LABELS } from '@/types/ticket';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line
} from 'recharts';
import { 
  Clock, 
  Target, 
  AlertTriangle, 
  TrendingUp,
  TicketCheck,
  Timer,
  Building2
} from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

export default function KPIsGestao() {
  const [periodo, setPeriodo] = useState<PeriodoFiltro>('mes');
  const [time, setTime] = useState<TimeFiltro>('todos');
  const [data, setData] = useState<ReturnType<typeof kpiService.getDashboardGestao> | null>(null);
  const [alertas, setAlertas] = useState<ReturnType<typeof kpiService.getAlertas>>([]);
  const [filterOptions, setFilterOptions] = useState<{ empresas: string[]; servicos: string[] }>({ empresas: [], servicos: [] });

  useEffect(() => {
    const dashboard = kpiService.getDashboardGestao({ periodo, time });
    setData(dashboard);
    setAlertas(kpiService.getAlertas());
    setFilterOptions(getFilterOptions());
  }, [periodo, time]);

  if (!data) return null;

  // Prepare chart data
  const statusData = Object.entries(data.porStatus).map(([key, value]) => ({
    name: STATUS_LABELS[key as keyof typeof STATUS_LABELS] || key,
    value
  }));

  const origensData = Object.entries(data.origens).map(([key, value]) => ({
    name: key === 'manual' ? 'Manual' : key === 'cliente' ? 'Cliente' : 'Monitoramento',
    value
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Dashboard Executivo</h2>
          <p className="text-muted-foreground">Visão consolidada de atendimento</p>
        </div>
        <KPIFilters
          periodo={periodo}
          onPeriodoChange={setPeriodo}
          time={time}
          onTimeChange={setTime}
          showTimeFilter
          showEmpresaFilter
          empresas={filterOptions.empresas}
          showServicoFilter
          servicos={filterOptions.servicos}
        />
      </div>

      {/* Alertas */}
      {alertas.length > 0 && (
        <div className="space-y-2">
          {alertas.slice(0, 3).map((alerta, i) => (
            <AlertCard key={i} {...alerta} />
          ))}
        </div>
      )}

      {/* Main KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Volume Total"
          value={data.volumeTotal}
          subtitle="Tickets no período"
          icon={<TicketCheck className="h-4 w-4" />}
        />
        <KPICard
          title="SLA Geral"
          value={`${data.slaGeral.toFixed(1)}%`}
          subtitle="Tickets dentro do prazo"
          icon={<Target className="h-4 w-4" />}
          variant={data.slaGeral >= 80 ? 'success' : data.slaGeral >= 60 ? 'warning' : 'error'}
        />
        <KPICard
          title="Tempo Médio Ponta a Ponta"
          value={formatarTempo(data.tempoMedioPontaAPonta)}
          subtitle="Da criação ao encerramento"
          icon={<Timer className="h-4 w-4" />}
        />
        <KPICard
          title="SLA 1ª Resposta"
          value={`${data.slaPrimeiraResposta.toFixed(1)}%`}
          subtitle="Primeira resposta no prazo"
          icon={<Clock className="h-4 w-4" />}
          variant={data.slaPrimeiraResposta >= 90 ? 'success' : data.slaPrimeiraResposta >= 70 ? 'warning' : 'error'}
        />
      </div>

      {/* Gargalo Principal */}
      {data.gargaloPrincipal && (
        <Card className="border-yellow-500/30 bg-yellow-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
              <AlertTriangle className="h-4 w-4" />
              Gargalo Principal do Fluxo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <span className="text-2xl font-bold">
                {STATUS_LABELS[data.gargaloPrincipal.etapa as keyof typeof STATUS_LABELS] || data.gargaloPrincipal.etapa}
              </span>
              <span className="text-muted-foreground">
                com <strong>{data.gargaloPrincipal.count}</strong> tickets acumulados
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts Row 1 */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Por Status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Distribuição por Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                  >
                    {statusData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Por Origem */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Origem dos Tickets</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              {origensData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={origensData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="name" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip />
                    <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
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
      </div>

      {/* Top 10 Clientes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Top 10 Clientes com Maior Volume de Tickets
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.top10Clientes.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead className="text-right">Tickets</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.top10Clientes.map((cliente, index) => (
                  <TableRow key={cliente.empresa}>
                    <TableCell className="font-medium">{index + 1}</TableCell>
                    <TableCell>{cliente.empresa}</TableCell>
                    <TableCell className="text-right font-semibold">{cliente.count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum dado disponível
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
