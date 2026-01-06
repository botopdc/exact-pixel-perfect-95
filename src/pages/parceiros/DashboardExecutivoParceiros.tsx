import React, { useState, useMemo } from 'react';
import { partnersService, referralsService, commissionsService } from '@/services/partnersService';
import { Partner, PartnerType, Referral, Commission, ReferralStatus } from '@/types/partner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Users,
  TrendingUp,
  DollarSign,
  Target,
  AlertTriangle,
  CheckCircle,
  Clock,
  Building2,
  Award,
  PieChart,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Percent,
  Wallet,
  CreditCard,
  ShieldAlert,
} from 'lucide-react';
import { formatCurrencyBRL } from '@/lib/calculatorConfig';
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
  Cell,
  PieChart as RechartsPieChart,
  Pie,
  Legend,
} from 'recharts';

// Period filter options
const PERIOD_OPTIONS = [
  { value: '30', label: 'Últimos 30 dias' },
  { value: '60', label: 'Últimos 60 dias' },
  { value: '90', label: 'Últimos 90 dias' },
  { value: 'all', label: 'Todo período' },
];

const PARTNER_TYPE_OPTIONS = [
  { value: 'all', label: 'Todos os tipos' },
  { value: 'ISV', label: 'ISV' },
  { value: 'VAR', label: 'VAR' },
  { value: 'FINDER', label: 'FINDER' },
];

const STATUS_OPTIONS = [
  { value: 'all', label: 'Todos os status' },
  { value: 'Novo', label: 'Novo' },
  { value: 'Em contato', label: 'Em contato' },
  { value: 'Proposta', label: 'Proposta' },
  { value: 'Fechado', label: 'Fechado' },
  { value: 'Perdido', label: 'Perdido' },
];

const CHART_COLORS = {
  ISV: 'hsl(var(--chart-1))',
  VAR: 'hsl(var(--chart-2))',
  FINDER: 'hsl(var(--chart-3))',
};

export default function DashboardExecutivoParceiros() {
  // Filters
  const [periodFilter, setPeriodFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Load raw data
  const partners = partnersService.getAll();
  const referrals = referralsService.getAll();
  const commissions = commissionsService.getAll();

  // Filter by period
  const getDateThreshold = (days: string) => {
    if (days === 'all') return new Date(0);
    const d = new Date();
    d.setDate(d.getDate() - parseInt(days));
    return d;
  };

  // Filtered data based on selections
  const filteredData = useMemo(() => {
    const dateThreshold = getDateThreshold(periodFilter);

    let filteredPartners = partners.filter((p) => p.status === 'Ativo');
    if (typeFilter !== 'all') {
      filteredPartners = filteredPartners.filter((p) => p.tipo_parceria === typeFilter);
    }

    let filteredReferrals = referrals.filter(
      (r) => new Date(r.data_cadastro) >= dateThreshold
    );
    if (typeFilter !== 'all') {
      const partnerIds = filteredPartners.map((p) => p.id);
      filteredReferrals = filteredReferrals.filter((r) => partnerIds.includes(r.parceiro_id));
    }
    if (statusFilter !== 'all') {
      filteredReferrals = filteredReferrals.filter((r) => r.status_indicacao === statusFilter);
    }

    let filteredCommissions = commissions.filter(
      (c) => new Date(c.data_criacao) >= dateThreshold
    );
    if (typeFilter !== 'all' && typeFilter === 'FINDER') {
      const partnerIds = filteredPartners.map((p) => p.id);
      filteredCommissions = filteredCommissions.filter((c) => partnerIds.includes(c.parceiro_id));
    }

    return { filteredPartners, filteredReferrals, filteredCommissions };
  }, [partners, referrals, commissions, periodFilter, typeFilter, statusFilter]);

  // ═══════════════════════════════════════════════════════════════
  // MAIN KPIs CALCULATIONS
  // ═══════════════════════════════════════════════════════════════

  const mainKPIs = useMemo(() => {
    const { filteredPartners, filteredReferrals, filteredCommissions } = filteredData;

    const activePartners = filteredPartners.length;
    const activeReferrals = filteredReferrals.filter(
      (r) => !['Fechado', 'Perdido'].includes(r.status_indicacao)
    ).length;
    const closedReferrals = filteredReferrals.filter(
      (r) => r.status_indicacao === 'Fechado'
    ).length;
    const mrrGenerated = filteredReferrals
      .filter((r) => r.status_indicacao === 'Fechado')
      .reduce((sum, r) => sum + (r.valor_mrr_fechado || 0), 0);

    // Commission calculations
    const allInstallments = filteredCommissions.flatMap((c) => c.parcelas);
    const pendingCommission = allInstallments
      .filter((p) => p.status_pagamento === 'Pendente')
      .reduce((sum, p) => sum + p.valor, 0);
    const paidCommission = allInstallments
      .filter((p) => p.status_pagamento === 'Pago')
      .reduce((sum, p) => sum + p.valor, 0);

    return {
      activePartners,
      activeReferrals,
      closedReferrals,
      mrrGenerated,
      pendingCommission,
      paidCommission,
    };
  }, [filteredData]);

  // ═══════════════════════════════════════════════════════════════
  // PERFORMANCE BY PARTNER TYPE
  // ═══════════════════════════════════════════════════════════════

  const performanceByType = useMemo(() => {
    const types: PartnerType[] = ['ISV', 'VAR', 'FINDER'];

    return types.map((type) => {
      const partnersOfType = partners.filter(
        (p) => p.tipo_parceria === type && p.status === 'Ativo'
      );
      const partnerIds = partnersOfType.map((p) => p.id);

      const referralsOfType = referrals.filter((r) => partnerIds.includes(r.parceiro_id));
      const closedReferrals = referralsOfType.filter((r) => r.status_indicacao === 'Fechado');
      const lostReferrals = referralsOfType.filter((r) => r.status_indicacao === 'Perdido');
      const totalFinalized = closedReferrals.length + lostReferrals.length;

      const conversionRate = totalFinalized > 0
        ? (closedReferrals.length / totalFinalized) * 100
        : 0;

      const mrrGenerated = closedReferrals.reduce(
        (sum, r) => sum + (r.valor_mrr_fechado || 0),
        0
      );

      // Commission only for FINDER
      let totalCommission = 0;
      if (type === 'FINDER') {
        const commissionsOfType = commissions.filter((c) => partnerIds.includes(c.parceiro_id));
        totalCommission = commissionsOfType.reduce((sum, c) => sum + c.comissao_total, 0);
      }

      return {
        type,
        partners: partnersOfType.length,
        referrals: referralsOfType.length,
        conversionRate: conversionRate.toFixed(1),
        mrrGenerated,
        commission: totalCommission,
      };
    });
  }, [partners, referrals, commissions]);

  // ═══════════════════════════════════════════════════════════════
  // TOP PARTNERS RANKINGS
  // ═══════════════════════════════════════════════════════════════

  const topPartners = useMemo(() => {
    // Top by MRR
    const partnerMRR: Record<string, { partner: Partner; mrr: number }> = {};
    referrals
      .filter((r) => r.status_indicacao === 'Fechado')
      .forEach((r) => {
        const partner = partners.find((p) => p.id === r.parceiro_id);
        if (partner) {
          if (!partnerMRR[partner.id]) {
            partnerMRR[partner.id] = { partner, mrr: 0 };
          }
          partnerMRR[partner.id].mrr += r.valor_mrr_fechado || 0;
        }
      });

    const topByMRR = Object.values(partnerMRR)
      .sort((a, b) => b.mrr - a.mrr)
      .slice(0, 10);

    // Top FINDERs by commission
    const finderCommission: Record<string, { partner: Partner; commission: number }> = {};
    commissions.forEach((c) => {
      const partner = partners.find((p) => p.id === c.parceiro_id);
      if (partner && partner.tipo_parceria === 'FINDER') {
        if (!finderCommission[partner.id]) {
          finderCommission[partner.id] = { partner, commission: 0 };
        }
        finderCommission[partner.id].commission += c.comissao_total;
      }
    });

    const topByCommission = Object.values(finderCommission)
      .sort((a, b) => b.commission - a.commission)
      .slice(0, 10);

    // Top by conversion rate (min 3 referrals)
    const partnerConversion: Record<string, { partner: Partner; rate: number; total: number }> = {};
    partners.forEach((p) => {
      const pReferrals = referrals.filter((r) => r.parceiro_id === p.id);
      const closed = pReferrals.filter((r) => r.status_indicacao === 'Fechado').length;
      const lost = pReferrals.filter((r) => r.status_indicacao === 'Perdido').length;
      const total = closed + lost;
      if (total >= 3) {
        partnerConversion[p.id] = {
          partner: p,
          rate: (closed / total) * 100,
          total,
        };
      }
    });

    const topByConversion = Object.values(partnerConversion)
      .sort((a, b) => b.rate - a.rate)
      .slice(0, 10);

    return { topByMRR, topByCommission, topByConversion };
  }, [partners, referrals, commissions]);

  // ═══════════════════════════════════════════════════════════════
  // FINANCIAL VISION - COMMISSION FORECAST
  // ═══════════════════════════════════════════════════════════════

  const financialVision = useMemo(() => {
    const allInstallments = commissions.flatMap((c) =>
      c.parcelas.map((p) => ({ ...p, commissionId: c.id }))
    );

    const totalGenerated = commissions.reduce((sum, c) => sum + c.comissao_total, 0);
    const totalPaid = allInstallments
      .filter((p) => p.status_pagamento === 'Pago')
      .reduce((sum, p) => sum + p.valor, 0);
    const totalPending = allInstallments
      .filter((p) => p.status_pagamento === 'Pendente')
      .reduce((sum, p) => sum + p.valor, 0);
    const totalBlocked = allInstallments
      .filter((p) => p.status_pagamento === 'Bloqueado')
      .reduce((sum, p) => sum + p.valor, 0);

    // Next payments (day 20 of next 3 months)
    const now = new Date();
    const nextPayments: { month: string; value: number }[] = [];

    for (let i = 0; i < 3; i++) {
      const targetDate = new Date(now.getFullYear(), now.getMonth() + i, 20);
      const monthKey = targetDate.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });

      const monthStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
      const monthEnd = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0);

      const monthTotal = allInstallments
        .filter((p) => {
          if (!p.vencimento || p.status_pagamento !== 'Pendente') return false;
          const venc = new Date(p.vencimento);
          return venc >= monthStart && venc <= monthEnd;
        })
        .reduce((sum, p) => sum + p.valor, 0);

      nextPayments.push({ month: monthKey, value: monthTotal });
    }

    return { totalGenerated, totalPaid, totalPending, totalBlocked, nextPayments };
  }, [commissions]);

  // ═══════════════════════════════════════════════════════════════
  // RISK ALERTS
  // ═══════════════════════════════════════════════════════════════

  const alerts = useMemo(() => {
    const alertsList: { type: 'warning' | 'danger'; message: string; detail: string }[] = [];

    // Alert: High future commission
    if (financialVision.totalPending > 10000) {
      alertsList.push({
        type: 'warning',
        message: 'Alto volume de comissão pendente',
        detail: `${formatCurrencyBRL(financialVision.totalPending)} em comissões a pagar`,
      });
    }

    // Alert: High volume of lost referrals
    const lostReferrals = referrals.filter((r) => r.status_indicacao === 'Perdido').length;
    const totalReferrals = referrals.length;
    if (totalReferrals > 0 && lostReferrals / totalReferrals > 0.4) {
      alertsList.push({
        type: 'danger',
        message: 'Taxa de perda elevada',
        detail: `${((lostReferrals / totalReferrals) * 100).toFixed(0)}% das indicações foram perdidas`,
      });
    }

    // Alert: Partner with many lost referrals
    const partnerLosses: Record<string, number> = {};
    referrals
      .filter((r) => r.status_indicacao === 'Perdido')
      .forEach((r) => {
        partnerLosses[r.parceiro_id] = (partnerLosses[r.parceiro_id] || 0) + 1;
      });
    Object.entries(partnerLosses).forEach(([partnerId, count]) => {
      if (count >= 5) {
        const partner = partners.find((p) => p.id === partnerId);
        if (partner) {
          alertsList.push({
            type: 'warning',
            message: `Parceiro com muitas perdas: ${partner.empresa}`,
            detail: `${count} indicações perdidas`,
          });
        }
      }
    });

    // Alert: Revenue concentration
    if (topPartners.topByMRR.length > 0) {
      const totalMRR = topPartners.topByMRR.reduce((sum, p) => sum + p.mrr, 0);
      const topMRR = topPartners.topByMRR[0]?.mrr || 0;
      if (totalMRR > 0 && topMRR / totalMRR > 0.5) {
        alertsList.push({
          type: 'danger',
          message: 'Concentração de receita',
          detail: `${topPartners.topByMRR[0]?.partner.empresa} representa ${((topMRR / totalMRR) * 100).toFixed(0)}% do MRR`,
        });
      }
    }

    // Alert: Blocked commissions
    if (financialVision.totalBlocked > 0) {
      alertsList.push({
        type: 'warning',
        message: 'Comissões bloqueadas',
        detail: `${formatCurrencyBRL(financialVision.totalBlocked)} em parcelas bloqueadas`,
      });
    }

    return alertsList;
  }, [referrals, partners, financialVision, topPartners]);

  // ═══════════════════════════════════════════════════════════════
  // CHART DATA
  // ═══════════════════════════════════════════════════════════════

  const pieChartData = performanceByType.map((p) => ({
    name: p.type,
    value: p.mrrGenerated,
    partners: p.partners,
  }));

  const partnerDistribution = performanceByType.map((p) => ({
    name: p.type,
    value: p.partners,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <PieChart className="h-6 w-6 text-primary" />
            Dashboard Executivo de Parceiros
          </h1>
          <p className="text-muted-foreground">
            Visão consolidada de receita, custo e eficiência do canal
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card className="bg-card border-border">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <Select value={periodFilter} onValueChange={setPeriodFilter}>
              <SelectTrigger className="w-full md:w-48 bg-input border-border">
                <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                {PERIOD_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full md:w-48 bg-input border-border">
                <Users className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Tipo de parceiro" />
              </SelectTrigger>
              <SelectContent>
                {PARTNER_TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-48 bg-input border-border">
                <Target className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Status indicação" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Alerts Section */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alert, index) => (
            <div
              key={index}
              className={`flex items-center gap-3 p-3 rounded-lg border ${
                alert.type === 'danger'
                  ? 'bg-red-500/10 border-red-500/30'
                  : 'bg-yellow-500/10 border-yellow-500/30'
              }`}
            >
              <ShieldAlert
                className={`h-5 w-5 ${
                  alert.type === 'danger' ? 'text-red-500' : 'text-yellow-500'
                }`}
              />
              <div className="flex-1">
                <p
                  className={`font-medium ${
                    alert.type === 'danger' ? 'text-red-500' : 'text-yellow-500'
                  }`}
                >
                  {alert.message}
                </p>
                <p className="text-sm text-muted-foreground">{alert.detail}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Main KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{mainKPIs.activePartners}</p>
                <p className="text-xs text-muted-foreground">Parceiros Ativos</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                <Target className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-400">{mainKPIs.activeReferrals}</p>
                <p className="text-xs text-muted-foreground">Indicações Ativas</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-green-500/20 flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-500">{mainKPIs.closedReferrals}</p>
                <p className="text-xs text-muted-foreground">Indicações Fechadas</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-lg font-bold text-emerald-400">
                  {formatCurrencyBRL(mainKPIs.mrrGenerated)}
                </p>
                <p className="text-xs text-muted-foreground">MRR Gerado</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
                <Clock className="h-5 w-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-lg font-bold text-yellow-500">
                  {formatCurrencyBRL(mainKPIs.pendingCommission)}
                </p>
                <p className="text-xs text-muted-foreground">Comissão a Pagar</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                <Wallet className="h-5 w-5 text-purple-400" />
              </div>
              <div>
                <p className="text-lg font-bold text-purple-400">
                  {formatCurrencyBRL(mainKPIs.paidCommission)}
                </p>
                <p className="text-xs text-muted-foreground">Comissão Paga</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance by Partner Type + Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Performance Table */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              Performance por Tipo de Parceiro
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-center">Parceiros</TableHead>
                  <TableHead className="text-center">Indicações</TableHead>
                  <TableHead className="text-center">Conversão</TableHead>
                  <TableHead className="text-right">MRR</TableHead>
                  <TableHead className="text-right">Comissão</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {performanceByType.map((row) => (
                  <TableRow key={row.type}>
                    <TableCell>
                      <Badge
                        className={
                          row.type === 'ISV'
                            ? 'bg-purple-500/20 text-purple-400'
                            : row.type === 'VAR'
                            ? 'bg-blue-500/20 text-blue-400'
                            : 'bg-orange-500/20 text-orange-400'
                        }
                      >
                        {row.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center font-medium">{row.partners}</TableCell>
                    <TableCell className="text-center">{row.referrals}</TableCell>
                    <TableCell className="text-center">
                      <span
                        className={
                          parseFloat(row.conversionRate) >= 50
                            ? 'text-green-500'
                            : parseFloat(row.conversionRate) >= 30
                            ? 'text-yellow-500'
                            : 'text-red-500'
                        }
                      >
                        {row.conversionRate}%
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-medium text-emerald-400">
                      {formatCurrencyBRL(row.mrrGenerated)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {row.type === 'FINDER' ? formatCurrencyBRL(row.commission) : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* MRR Distribution Chart */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <PieChart className="h-5 w-5 text-primary" />
              Distribuição de MRR por Tipo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPieChart>
                  <Pie
                    data={pieChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    fill="#8884d8"
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, percent }) =>
                      `${name} ${(percent * 100).toFixed(0)}%`
                    }
                  >
                    {pieChartData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={
                          entry.name === 'ISV'
                            ? '#a855f7'
                            : entry.name === 'VAR'
                            ? '#3b82f6'
                            : '#f97316'
                        }
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => formatCurrencyBRL(value)}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                </RechartsPieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Financial Vision */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Commission Summary */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              Visão Financeira de Comissões (FINDER)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-muted/30 rounded-lg p-4">
                <p className="text-sm text-muted-foreground">Comissão Total Gerada</p>
                <p className="text-xl font-bold text-foreground">
                  {formatCurrencyBRL(financialVision.totalGenerated)}
                </p>
              </div>
              <div className="bg-green-500/10 rounded-lg p-4">
                <p className="text-sm text-green-500 flex items-center gap-1">
                  <CheckCircle className="h-3 w-3" /> Já Pago
                </p>
                <p className="text-xl font-bold text-green-500">
                  {formatCurrencyBRL(financialVision.totalPaid)}
                </p>
              </div>
              <div className="bg-yellow-500/10 rounded-lg p-4">
                <p className="text-sm text-yellow-500 flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Pendente
                </p>
                <p className="text-xl font-bold text-yellow-500">
                  {formatCurrencyBRL(financialVision.totalPending)}
                </p>
              </div>
              <div className="bg-red-500/10 rounded-lg p-4">
                <p className="text-sm text-red-500 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> Bloqueado
                </p>
                <p className="text-xl font-bold text-red-500">
                  {formatCurrencyBRL(financialVision.totalBlocked)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Commission Forecast Chart */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              Próximos Pagamentos (dia 20)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={financialVision.nextPayments}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" />
                  <YAxis stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `R$${v / 1000}k`} />
                  <Tooltip
                    formatter={(value: number) => formatCurrencyBRL(value)}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Partners Rankings */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top by MRR */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Award className="h-5 w-5 text-emerald-400" />
              Top Parceiros por MRR
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topPartners.topByMRR.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Sem dados disponíveis
              </p>
            ) : (
              <div className="space-y-2">
                {topPartners.topByMRR.slice(0, 5).map((item, index) => (
                  <div
                    key={item.partner.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-muted/30"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          index === 0
                            ? 'bg-yellow-500/20 text-yellow-500'
                            : index === 1
                            ? 'bg-gray-400/20 text-gray-400'
                            : index === 2
                            ? 'bg-orange-600/20 text-orange-600'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {index + 1}
                      </span>
                      <div>
                        <p className="text-sm font-medium truncate max-w-[120px]">
                          {item.partner.empresa}
                        </p>
                        <Badge variant="outline" className="text-[10px]">
                          {item.partner.tipo_parceria}
                        </Badge>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-emerald-400">
                      {formatCurrencyBRL(item.mrr)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top FINDERs by Commission */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-purple-400" />
              Top FINDERs por Comissão
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topPartners.topByCommission.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Sem dados disponíveis
              </p>
            ) : (
              <div className="space-y-2">
                {topPartners.topByCommission.slice(0, 5).map((item, index) => (
                  <div
                    key={item.partner.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-muted/30"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          index === 0
                            ? 'bg-yellow-500/20 text-yellow-500'
                            : index === 1
                            ? 'bg-gray-400/20 text-gray-400'
                            : index === 2
                            ? 'bg-orange-600/20 text-orange-600'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {index + 1}
                      </span>
                      <p className="text-sm font-medium truncate max-w-[140px]">
                        {item.partner.empresa}
                      </p>
                    </div>
                    <span className="text-sm font-bold text-purple-400">
                      {formatCurrencyBRL(item.commission)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top by Conversion Rate */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Percent className="h-5 w-5 text-green-500" />
              Maior Taxa de Conversão
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topPartners.topByConversion.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Sem dados suficientes (mín. 3 indicações)
              </p>
            ) : (
              <div className="space-y-2">
                {topPartners.topByConversion.slice(0, 5).map((item, index) => (
                  <div
                    key={item.partner.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-muted/30"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          index === 0
                            ? 'bg-yellow-500/20 text-yellow-500'
                            : index === 1
                            ? 'bg-gray-400/20 text-gray-400'
                            : index === 2
                            ? 'bg-orange-600/20 text-orange-600'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {index + 1}
                      </span>
                      <div>
                        <p className="text-sm font-medium truncate max-w-[120px]">
                          {item.partner.empresa}
                        </p>
                        <Badge variant="outline" className="text-[10px]">
                          {item.partner.tipo_parceria}
                        </Badge>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-bold text-green-500">
                        {item.rate.toFixed(0)}%
                      </span>
                      <p className="text-[10px] text-muted-foreground">{item.total} ind.</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
