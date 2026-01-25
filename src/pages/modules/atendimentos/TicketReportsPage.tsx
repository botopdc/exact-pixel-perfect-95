// ============================================================================
// TICKET REPORTS PAGE - Admin only
// ============================================================================

import { useState } from 'react';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  BarChart3,
  Calendar,
  Download,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
} from 'recharts';
import { useTicketReports } from '@/hooks/useSupportTickets';
import {
  TicketReportFilters,
  TEAM_LABELS,
  SupportTeam,
  canManageSLAs,
} from '@/types/supportTicket';
import { authService } from '@/services/authService';

export default function TicketReportsPage() {
  const session = authService.getSession();
  const userLevel = session?.level ?? 0;

  // Default to current month
  const [filters, setFilters] = useState<TicketReportFilters>({
    date_from: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    date_to: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
    group_by: 'day',
  });

  const { reports, isLoading, canView, refetch } = useTicketReports(filters);

  // Check access
  if (!canManageSLAs(userLevel)) {
    return (
      <div className="flex items-center justify-center h-96">
        <Card className="p-8 text-center">
          <AlertTriangle className="h-12 w-12 mx-auto text-destructive mb-4" />
          <h2 className="text-xl font-semibold mb-2">Acesso Negado</h2>
          <p className="text-muted-foreground">
            Apenas administradores podem visualizar relatórios.
          </p>
        </Card>
      </div>
    );
  }

  // Calculate summary stats
  const totalOpened = reports.reduce((sum, r) => sum + r.opened, 0);
  const totalResolved = reports.reduce((sum, r) => sum + r.resolved, 0);
  const avgSlaCompliance = reports.length > 0
    ? reports.reduce((sum, r) => sum + r.sla_compliance_pct, 0) / reports.length
    : 0;
  const avgResolutionMinutes = reports.length > 0
    ? reports.reduce((sum, r) => sum + r.avg_resolution_minutes, 0) / reports.length
    : 0;

  // Prepare chart data
  const chartData = reports.map((r) => ({
    period: r.period,
    abertos: r.opened,
    resolvidos: r.resolved,
    sla: r.sla_compliance_pct,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Relatórios de Chamados</h1>
            <p className="text-muted-foreground">Análise de desempenho e métricas</p>
          </div>
        </div>
        <Button variant="outline" onClick={() => refetch()} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-2">
              <Label>Data Inicial</Label>
              <Input
                type="date"
                value={filters.date_from}
                onChange={(e) => setFilters({ ...filters, date_from: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Data Final</Label>
              <Input
                type="date"
                value={filters.date_to}
                onChange={(e) => setFilters({ ...filters, date_to: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Agrupar por</Label>
              <Select
                value={filters.group_by}
                onValueChange={(v) => setFilters({ ...filters, group_by: v as 'day' | 'week' | 'month' })}
              >
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">Dia</SelectItem>
                  <SelectItem value="week">Semana</SelectItem>
                  <SelectItem value="month">Mês</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Equipe</Label>
              <Select
                value={filters.team || '__all__'}
                onValueChange={(v) => setFilters({ ...filters, team: v === '__all__' ? undefined : v as SupportTeam })}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todas</SelectItem>
                  {Object.entries(TEAM_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <Skeleton className="h-80" />
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/20">
                    <TrendingUp className="h-5 w-5 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{totalOpened}</p>
                    <p className="text-xs text-muted-foreground">Abertos</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-500/20">
                    <CheckCircle2 className="h-5 w-5 text-green-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{totalResolved}</p>
                    <p className="text-xs text-muted-foreground">Resolvidos</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${avgSlaCompliance >= 90 ? 'bg-green-500/20' : avgSlaCompliance >= 70 ? 'bg-yellow-500/20' : 'bg-red-500/20'}`}>
                    <BarChart3 className={`h-5 w-5 ${avgSlaCompliance >= 90 ? 'text-green-400' : avgSlaCompliance >= 70 ? 'text-yellow-400' : 'text-red-400'}`} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{avgSlaCompliance.toFixed(1)}%</p>
                    <p className="text-xs text-muted-foreground">SLA Compliance</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-500/20">
                    <Calendar className="h-5 w-5 text-purple-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      {Math.floor(avgResolutionMinutes / 60)}h {Math.round(avgResolutionMinutes % 60)}m
                    </p>
                    <p className="text-xs text-muted-foreground">Tempo Médio Resolução</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts */}
          {reports.length > 0 && (
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Volume Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Volume de Chamados</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="period" className="text-xs" />
                      <YAxis className="text-xs" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                      />
                      <Legend />
                      <Bar dataKey="abertos" name="Abertos" fill="hsl(var(--primary))" />
                      <Bar dataKey="resolvidos" name="Resolvidos" fill="hsl(142 76% 36%)" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* SLA Trend Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Tendência de SLA</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="period" className="text-xs" />
                      <YAxis domain={[0, 100]} className="text-xs" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="sla"
                        name="SLA Compliance %"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        dot={{ fill: 'hsl(var(--primary))' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Data Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Dados Detalhados</CardTitle>
            </CardHeader>
            <CardContent>
              {reports.length === 0 ? (
                <div className="py-8 text-center">
                  <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    Nenhum dado disponível para o período selecionado.
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Período</TableHead>
                      <TableHead className="text-right">Abertos</TableHead>
                      <TableHead className="text-right">Resolvidos</TableHead>
                      <TableHead className="text-right">Encerrados</TableHead>
                      <TableHead className="text-right">1ª Resposta (min)</TableHead>
                      <TableHead className="text-right">Resolução (min)</TableHead>
                      <TableHead className="text-right">SLA %</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reports.map((report, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{report.period}</TableCell>
                        <TableCell className="text-right">{report.opened}</TableCell>
                        <TableCell className="text-right">{report.resolved}</TableCell>
                        <TableCell className="text-right">{report.closed}</TableCell>
                        <TableCell className="text-right">
                          {Math.round(report.avg_first_response_minutes)}
                        </TableCell>
                        <TableCell className="text-right">
                          {Math.round(report.avg_resolution_minutes)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge
                            variant="outline"
                            className={
                              report.sla_compliance_pct >= 90
                                ? 'bg-green-500/20 text-green-500'
                                : report.sla_compliance_pct >= 70
                                ? 'bg-yellow-500/20 text-yellow-500'
                                : 'bg-red-500/20 text-red-500'
                            }
                          >
                            {report.sla_compliance_pct.toFixed(1)}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
