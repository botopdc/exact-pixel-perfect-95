import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { KPICard } from '@/components/kpis/KPICard';
import { KPIFilters } from '@/components/kpis/KPIFilters';
import { AlertCard } from '@/components/kpis/AlertCard';
import { 
  kpiService, 
  formatarTempo, 
  PeriodoFiltro, 
  getFilterOptions 
} from '@/services/kpiService';
import { TIPO_DEMANDA_LABELS } from '@/types/ticket';
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
  Legend
} from 'recharts';
import { 
  Clock, 
  Users, 
  AlertTriangle, 
  CheckCircle2,
  TrendingUp,
  ShieldAlert,
  Timer
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

export default function KPIsCS() {
  const [periodo, setPeriodo] = useState<PeriodoFiltro>('mes');
  const [data, setData] = useState<ReturnType<typeof kpiService.getDashboardCS> | null>(null);
  const [alertas, setAlertas] = useState<ReturnType<typeof kpiService.getAlertas>>([]);
  const [filterOptions, setFilterOptions] = useState<{ empresas: string[]; servicos: string[] }>({ empresas: [], servicos: [] });

  useEffect(() => {
    const dashboard = kpiService.getDashboardCS({ periodo });
    setData(dashboard);
    setAlertas(kpiService.getAlertas());
    setFilterOptions(getFilterOptions());
  }, [periodo]);

  if (!data) return null;

  // Prepare chart data
  const recorrenciaData = data.topClientesRecorrentes.map(c => ({
    name: c.empresa.length > 20 ? c.empresa.substring(0, 20) + '...' : c.empresa,
    tickets: c.count
  }));

  const impactoData = [
    { name: 'Alto', value: data.impactoAlto, color: 'hsl(var(--destructive))' },
    { name: 'Médio/Baixo', value: Math.max(0, data.aguardandoValidacao - data.impactoAlto), color: 'hsl(var(--primary))' }
  ].filter(d => d.value > 0);

  const demandaData = [
    { name: 'Risco', value: data.ticketsRisco },
    { name: 'Expansão', value: data.ticketsExpansao }
  ].filter(d => d.value > 0);

  const alertasCS = alertas.filter(a => 
    a.titulo.includes('recorrência') || 
    a.titulo.includes('cliente')
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">KPIs de Customer Success</h2>
          <p className="text-muted-foreground">Métricas de relacionamento e validação</p>
        </div>
        <KPIFilters
          periodo={periodo}
          onPeriodoChange={setPeriodo}
          showEmpresaFilter
          empresas={filterOptions.empresas}
        />
      </div>

      {/* Alertas */}
      {alertasCS.length > 0 && (
        <div className="space-y-2">
          {alertasCS.map((alerta, i) => (
            <AlertCard key={i} {...alerta} />
          ))}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Aguardando Validação"
          value={data.aguardandoValidacao}
          subtitle="Tickets pendentes de análise"
          icon={<Timer className="h-4 w-4" />}
          variant={data.aguardandoValidacao > 5 ? 'warning' : 'default'}
        />
        <KPICard
          title="Tempo Médio de Fechamento"
          value={formatarTempo(data.tempoMedioFechamento)}
          subtitle="Da criação ao encerramento"
          icon={<Clock className="h-4 w-4" />}
        />
        <KPICard
          title="Impacto Alto"
          value={data.impactoAlto}
          subtitle="Tickets com alto impacto"
          icon={<AlertTriangle className="h-4 w-4" />}
          variant={data.impactoAlto > 3 ? 'error' : 'default'}
        />
        <KPICard
          title="Clientes Críticos"
          value={data.clientesCriticos.length}
          subtitle="Com tickets de alto impacto"
          icon={<ShieldAlert className="h-4 w-4" />}
          variant={data.clientesCriticos.length > 3 ? 'warning' : 'default'}
        />
      </div>

      {/* Oportunidades */}
      <div className="grid gap-4 md:grid-cols-2">
        <KPICard
          title="Tickets de Risco"
          value={data.ticketsRisco}
          subtitle="Demandas que indicam risco de churn"
          icon={<ShieldAlert className="h-4 w-4" />}
          variant={data.ticketsRisco > 0 ? 'error' : 'success'}
        />
        <KPICard
          title="Oportunidades de Expansão"
          value={data.ticketsExpansao}
          subtitle="Demandas que indicam upsell/cross-sell"
          icon={<TrendingUp className="h-4 w-4" />}
          variant={data.ticketsExpansao > 0 ? 'success' : 'default'}
        />
      </div>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Recorrência por Cliente */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Clientes Recorrentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              {recorrenciaData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={recorrenciaData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis type="number" className="text-xs" />
                    <YAxis dataKey="name" type="category" width={120} className="text-xs" />
                    <Tooltip />
                    <Bar dataKey="tickets" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
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

        {/* Distribuição por Impacto */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Distribuição por Impacto</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              {impactoData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={impactoData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {impactoData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
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

      {/* Clientes Críticos List */}
      {data.clientesCriticos.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Clientes Críticos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {data.clientesCriticos.map((cliente) => (
                <Badge key={cliente} variant="destructive" className="text-sm">
                  {cliente}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
