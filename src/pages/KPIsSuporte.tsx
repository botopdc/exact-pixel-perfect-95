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
import { CATEGORIA_LABELS, STATUS_LABELS, PRIORIDADE_LABELS } from '@/types/ticket';
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
  Inbox,
  Target
} from 'lucide-react';

const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

export default function KPIsSuporte() {
  const [periodo, setPeriodo] = useState<PeriodoFiltro>('mes');
  const [data, setData] = useState<ReturnType<typeof kpiService.getDashboardSuporte> | null>(null);
  const [alertas, setAlertas] = useState<ReturnType<typeof kpiService.getAlertas>>([]);
  const [filterOptions, setFilterOptions] = useState<{ empresas: string[]; servicos: string[] }>({ empresas: [], servicos: [] });

  useEffect(() => {
    const dashboard = kpiService.getDashboardSuporte({ periodo });
    setData(dashboard);
    setAlertas(kpiService.getAlertas());
    setFilterOptions(getFilterOptions());
  }, [periodo]);

  if (!data) return null;

  // Prepare chart data
  const categoriaData = Object.entries(data.porCategoria).map(([key, value]) => ({
    name: CATEGORIA_LABELS[key as keyof typeof CATEGORIA_LABELS] || key,
    value
  }));

  const prioridadeData = Object.entries(data.porPrioridade).map(([key, value]) => ({
    name: PRIORIDADE_LABELS[key as keyof typeof PRIORIDADE_LABELS] || key,
    value
  }));

  const tecnicosData = data.topTecnicos.map(t => ({
    name: t.nome.length > 15 ? t.nome.substring(0, 15) + '...' : t.nome,
    tickets: t.count
  }));

  const statusData = Object.entries(data.porStatus).map(([key, value]) => ({
    name: STATUS_LABELS[key as keyof typeof STATUS_LABELS] || key,
    value
  }));

  const alertasSuporte = alertas.filter(a => 
    a.titulo.includes('atendimento') || 
    a.titulo.includes('técnico') || 
    a.titulo.includes('Acúmulo')
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">KPIs de Suporte</h2>
          <p className="text-muted-foreground">Métricas operacionais do time técnico</p>
        </div>
        <KPIFilters
          periodo={periodo}
          onPeriodoChange={setPeriodo}
          showEmpresaFilter
          empresas={filterOptions.empresas}
          showServicoFilter
          servicos={filterOptions.servicos}
        />
      </div>

      {/* Alertas */}
      {alertasSuporte.length > 0 && (
        <div className="space-y-2">
          {alertasSuporte.map((alerta, i) => (
            <AlertCard key={i} {...alerta} />
          ))}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Backlog Atual"
          value={data.backlog}
          subtitle="Tickets em aberto"
          icon={<Inbox className="h-4 w-4" />}
          variant={data.backlog > 10 ? 'warning' : 'default'}
        />
        <KPICard
          title="Tempo Médio de Atendimento"
          value={formatarTempo(data.tempoMedioAtendimento)}
          subtitle="Da criação à resolução técnica"
          icon={<Clock className="h-4 w-4" />}
        />
        <KPICard
          title="SLA Técnico"
          value={`${data.slaTecnicoCumprido.toFixed(1)}%`}
          subtitle="Resolvidos dentro do prazo"
          icon={<Target className="h-4 w-4" />}
          variant={data.slaTecnicoCumprido >= 80 ? 'success' : data.slaTecnicoCumprido >= 60 ? 'warning' : 'error'}
        />
        <KPICard
          title="Técnicos Ativos"
          value={data.topTecnicos.length}
          subtitle="Com tickets atribuídos"
          icon={<Users className="h-4 w-4" />}
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Por Categoria */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Gargalos por Categoria</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoriaData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    labelLine={false}
                  >
                    {categoriaData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Por Prioridade */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Distribuição por Prioridade</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={prioridadeData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" className="text-xs" />
                  <YAxis dataKey="name" type="category" width={80} className="text-xs" />
                  <Tooltip />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Top Técnicos */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Técnicos com Maior Volume</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              {tecnicosData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={tecnicosData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="name" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip />
                    <Bar dataKey="tickets" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
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

        {/* Por Status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tickets por Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
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
      </div>
    </div>
  );
}
