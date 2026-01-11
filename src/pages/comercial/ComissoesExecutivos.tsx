import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DollarSign,
  TrendingUp,
  Calendar,
  Calculator,
  PieChart,
  Search,
  CheckCircle,
  Clock,
  AlertTriangle,
  Info,
  Users,
  Building2,
  Shield,
  Ban,
  Eye,
  RefreshCw,
} from 'lucide-react';
import { formatCurrencyBRL } from '@/lib/calculatorConfig';
import {
  COMMISSION_CAPS,
  COMMISSION_RATES,
  CommissionCalculation,
  ExecutiveCommissionSummary,
  calculateCommissionStats,
  getCalculatedCommissions,
  groupByExecutive,
} from '@/services/executiveCommissionService';

const ComissoesExecutivos = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedCommission, setSelectedCommission] = useState<CommissionCalculation | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Load calculated commissions
  const allCommissions = useMemo(() => getCalculatedCommissions(), []);
  
  // Apply filters
  const filteredCommissions = useMemo(() => {
    let filtered = [...allCommissions];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.cliente_nome.toLowerCase().includes(term) ||
          c.executivo_nome.toLowerCase().includes(term)
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter((c) => {
        if (statusFilter === 'pendente') return c.parcelas.some((p) => p.status === 'pendente');
        if (statusFilter === 'pago') return c.parcelas.every((p) => p.status === 'pago');
        if (statusFilter === 'suspenso') return c.parcelas.some((p) => p.status === 'suspenso');
        if (statusFilter === 'com-cap') return c.cap_meses_aplicado || c.cap_valor_aplicado;
        return true;
      });
    }

    return filtered;
  }, [allCommissions, searchTerm, statusFilter]);

  // Calculate stats
  const stats = useMemo(() => calculateCommissionStats(allCommissions), [allCommissions]);
  const executiveSummaries = useMemo(() => groupByExecutive(allCommissions), [allCommissions]);

  // Status badge for installments
  const getInstallmentBadge = (status: string) => {
    const styles: Record<string, { className: string; icon: React.ReactNode }> = {
      pendente: {
        className: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/50',
        icon: <Clock className="h-3 w-3" />,
      },
      pago: {
        className: 'bg-green-500/20 text-green-500 border-green-500/50',
        icon: <CheckCircle className="h-3 w-3" />,
      },
      suspenso: {
        className: 'bg-red-500/20 text-red-500 border-red-500/50',
        icon: <Ban className="h-3 w-3" />,
      },
      cancelado: {
        className: 'bg-muted text-muted-foreground border-muted',
        icon: <AlertTriangle className="h-3 w-3" />,
      },
    };
    const style = styles[status] || styles.pendente;
    return (
      <Badge className={`${style.className} flex items-center gap-1`}>
        {style.icon}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  // CAP badge
  const getCapBadge = (commission: CommissionCalculation) => {
    const hasCap = commission.cap_meses_aplicado || commission.cap_valor_aplicado;
    if (!hasCap) return null;

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge className="bg-primary/20 text-primary border-primary/50 flex items-center gap-1 cursor-help">
              <Shield className="h-3 w-3" />
              CAP APLICADO
            </Badge>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <p className="text-sm">
              Comissão limitada a {COMMISSION_CAPS.MAX_COMMISSIONABLE_MONTHS} meses e teto de{' '}
              {formatCurrencyBRL(COMMISSION_CAPS.MAX_COMMISSION_PER_PROPOSAL)} por proposta conforme
              política OPEN.
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  // Open details drawer
  const openDetails = (commission: CommissionCalculation) => {
    setSelectedCommission(commission);
    setDrawerOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2 flex items-center gap-2">
            <DollarSign className="h-8 w-8 text-primary" />
            Gestão de Comissões — Executivos
          </h1>
          <p className="text-muted-foreground">
            Acompanhamento e cálculo de comissões da equipe comercial interna
          </p>
        </div>
        <Button variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Previsto</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">
              {formatCurrencyBRL(stats.total_previsto)}
            </div>
            <p className="text-xs text-muted-foreground">Este mês</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">A Pagar</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-500">
              {formatCurrencyBRL(stats.total_a_pagar)}
            </div>
            <p className="text-xs text-muted-foreground">Pendente</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pago</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrencyBRL(stats.total_pago)}</div>
            <p className="text-xs text-muted-foreground">Últimos 30 dias</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Executivos</CardTitle>
            <PieChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_executivos_ativos}</div>
            <p className="text-xs text-muted-foreground">Com comissão ativa</p>
          </CardContent>
        </Card>
      </div>

      {/* CAP Info Card (Admin View) */}
      <Card className="bg-muted/30 border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Shield className="h-5 w-5 text-primary" />
            Regras de CAP — Política OPEN 2026
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="flex items-center gap-3 p-3 bg-background rounded-lg border">
              <Calendar className="h-8 w-8 text-primary" />
              <div>
                <p className="text-sm font-medium">Cap de Meses</p>
                <p className="text-2xl font-bold">{COMMISSION_CAPS.MAX_COMMISSIONABLE_MONTHS}</p>
                <p className="text-xs text-muted-foreground">Máximo comissionável</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-background rounded-lg border">
              <DollarSign className="h-8 w-8 text-primary" />
              <div>
                <p className="text-sm font-medium">Cap por Proposta</p>
                <p className="text-2xl font-bold">
                  {formatCurrencyBRL(COMMISSION_CAPS.MAX_COMMISSION_PER_PROPOSAL)}
                </p>
                <p className="text-xs text-muted-foreground">Valor máximo</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-background rounded-lg border">
              <AlertTriangle className="h-8 w-8 text-yellow-500" />
              <div>
                <p className="text-sm font-medium">Propostas com CAP</p>
                <p className="text-2xl font-bold">
                  {stats.propostas_com_cap_meses + stats.propostas_com_cap_valor}
                </p>
                <p className="text-xs text-muted-foreground">Limitadas este mês</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-background rounded-lg border">
              <TrendingUp className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-sm font-medium">Economia Total</p>
                <p className="text-2xl font-bold text-green-500">
                  {formatCurrencyBRL(stats.economia_cap_meses + stats.economia_cap_valor)}
                </p>
                <p className="text-xs text-muted-foreground">Via aplicação de CAPs</p>
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-4 flex items-center gap-1">
            <Info className="h-3 w-3" />
            Taxas: 12 meses = {(COMMISSION_RATES.SHORT_TERM * 100).toFixed(0)}% | 24/36/48 meses ={' '}
            {(COMMISSION_RATES.LONG_TERM * 100).toFixed(1)}% • Comissão dividida em 3 parcelas
            mensais
          </p>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por cliente ou executivo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pendente">Pendentes</SelectItem>
                <SelectItem value="pago">Pagos</SelectItem>
                <SelectItem value="suspenso">Suspensos</SelectItem>
                <SelectItem value="com-cap">Com CAP aplicado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Commissions by Executive */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Executive Summary Cards */}
        <div className="lg:col-span-1 space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Users className="h-5 w-5" />
            Por Executivo
          </h2>
          {executiveSummaries.map((exec) => (
            <Card key={exec.executivo_id} className="hover:border-primary/50 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium">{exec.executivo_nome}</h3>
                  {exec.propostas_com_cap > 0 && (
                    <Badge variant="outline" className="text-xs">
                      {exec.propostas_com_cap} CAP
                    </Badge>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-muted-foreground">Propostas</p>
                    <p className="font-semibold">{exec.total_propostas}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Previsto</p>
                    <p className="font-semibold text-green-500">
                      {formatCurrencyBRL(exec.total_previsto)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">A Pagar</p>
                    <p className="font-semibold text-yellow-500">
                      {formatCurrencyBRL(exec.total_a_pagar)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Pago</p>
                    <p className="font-semibold">{formatCurrencyBRL(exec.total_pago)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Commissions List */}
        <div className="lg:col-span-2">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Comissões por Proposta ({filteredCommissions.length})
          </h2>

          {filteredCommissions.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12 text-muted-foreground">
                <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhuma comissão encontrada</p>
              </CardContent>
            </Card>
          ) : (
            <Accordion type="single" collapsible className="space-y-2">
              {filteredCommissions.map((commission) => (
                <AccordionItem
                  key={commission.proposal_id}
                  value={commission.proposal_id}
                  className="border rounded-lg bg-card overflow-hidden"
                >
                  <AccordionTrigger className="px-4 py-3 hover:bg-muted/50 hover:no-underline">
                    <div className="flex flex-1 items-center justify-between gap-4 pr-4">
                      <div className="text-left">
                        <p className="font-medium">{commission.cliente_nome}</p>
                        <p className="text-xs text-muted-foreground">
                          {commission.executivo_nome} • {commission.prazo_meses} meses
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <p className="font-semibold text-primary">
                            {formatCurrencyBRL(commission.comissao_apos_cap)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            MRR: {formatCurrencyBRL(commission.mrr_total)}
                          </p>
                        </div>
                        {getCapBadge(commission)}
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">
                    <div className="space-y-4">
                      {/* Quick info */}
                      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Aprovado: {new Date(commission.data_aprovacao).toLocaleDateString('pt-BR')}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calculator className="h-3 w-3" />
                          Taxa: {(commission.taxa_comissao * 100).toFixed(1)}%
                        </span>
                        {commission.cap_meses_aplicado && (
                          <span className="text-primary flex items-center gap-1">
                            <Shield className="h-3 w-3" />
                            Cap meses: {commission.prazo_meses} → {commission.meses_comissionaveis}
                          </span>
                        )}
                      </div>

                      {/* Installments table */}
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Parcela</TableHead>
                            <TableHead>Valor</TableHead>
                            <TableHead>Previsão</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {commission.parcelas.map((parcela) => (
                            <TableRow key={parcela.numero}>
                              <TableCell className="font-medium">{parcela.numero}/3</TableCell>
                              <TableCell>{formatCurrencyBRL(parcela.valor)}</TableCell>
                              <TableCell>
                                {new Date(parcela.data_prevista).toLocaleDateString('pt-BR')}
                              </TableCell>
                              <TableCell>{getInstallmentBadge(parcela.status)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>

                      {/* Details button */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openDetails(commission)}
                        className="w-full"
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        Detalhar Comissão
                      </Button>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </div>
      </div>

      {/* Details Drawer */}
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Detalhamento da Comissão
            </DrawerTitle>
            <DrawerDescription>
              {selectedCommission?.cliente_nome} — {selectedCommission?.executivo_nome}
            </DrawerDescription>
          </DrawerHeader>

          {selectedCommission && (
            <div className="px-4 pb-4 space-y-6">
              {/* Base info */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-xs text-muted-foreground">MRR</p>
                  <p className="text-lg font-bold">
                    {formatCurrencyBRL(selectedCommission.mrr_total)}
                  </p>
                </div>
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-xs text-muted-foreground">Prazo Contrato</p>
                  <p className="text-lg font-bold">{selectedCommission.prazo_meses} meses</p>
                </div>
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-xs text-muted-foreground">Meses Comissionáveis</p>
                  <p className="text-lg font-bold flex items-center gap-2">
                    {selectedCommission.meses_comissionaveis}
                    {selectedCommission.cap_meses_aplicado && (
                      <Badge className="bg-primary/20 text-primary text-xs">CAP</Badge>
                    )}
                  </p>
                </div>
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-xs text-muted-foreground">Taxa</p>
                  <p className="text-lg font-bold">
                    {(selectedCommission.taxa_comissao * 100).toFixed(1)}%
                  </p>
                </div>
              </div>

              {/* Calculation breakdown */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Memória de Cálculo</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Base de cálculo (MRR × meses):</span>
                    <span>{formatCurrencyBRL(selectedCommission.base_calculo)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      Comissão bruta ({(selectedCommission.taxa_comissao * 100).toFixed(1)}%):
                    </span>
                    <span>{formatCurrencyBRL(selectedCommission.comissao_bruta)}</span>
                  </div>
                  {selectedCommission.bonus_atingimento > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Bônus atingimento:</span>
                      <span className="text-green-500">
                        +{formatCurrencyBRL(selectedCommission.bonus_atingimento)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-medium border-t pt-2">
                    <span>Comissão antes do CAP:</span>
                    <span>{formatCurrencyBRL(selectedCommission.comissao_antes_cap)}</span>
                  </div>

                  {/* CAP application */}
                  {(selectedCommission.cap_meses_aplicado ||
                    selectedCommission.cap_valor_aplicado) && (
                    <div className="bg-primary/10 rounded-lg p-3 space-y-2">
                      <div className="flex items-center gap-2 text-primary font-medium">
                        <Shield className="h-4 w-4" />
                        CAPs Aplicados
                      </div>
                      {selectedCommission.cap_meses_aplicado && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">
                            Economia cap de meses ({selectedCommission.prazo_meses} →{' '}
                            {selectedCommission.meses_comissionaveis}):
                          </span>
                          <span className="text-green-500">
                            -{formatCurrencyBRL(selectedCommission.valor_economizado_cap_meses)}
                          </span>
                        </div>
                      )}
                      {selectedCommission.cap_valor_aplicado && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">
                            Economia cap de valor (máx{' '}
                            {formatCurrencyBRL(COMMISSION_CAPS.MAX_COMMISSION_PER_PROPOSAL)}):
                          </span>
                          <span className="text-green-500">
                            -{formatCurrencyBRL(selectedCommission.valor_economizado_cap_valor)}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex justify-between text-lg font-bold border-t pt-2">
                    <span>Comissão Final:</span>
                    <span className="text-primary">
                      {formatCurrencyBRL(selectedCommission.comissao_apos_cap)}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Installments */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Parcelas</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Parcela</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Previsão</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedCommission.parcelas.map((parcela) => (
                        <TableRow key={parcela.numero}>
                          <TableCell className="font-medium">{parcela.numero}/3</TableCell>
                          <TableCell>{formatCurrencyBRL(parcela.valor)}</TableCell>
                          <TableCell>
                            {new Date(parcela.data_prevista).toLocaleDateString('pt-BR')}
                          </TableCell>
                          <TableCell>{getInstallmentBadge(parcela.status)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Tooltip explanation */}
              <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground flex items-start gap-2">
                <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <p>
                  Comissão limitada a {COMMISSION_CAPS.MAX_COMMISSIONABLE_MONTHS} meses e teto de{' '}
                  {formatCurrencyBRL(COMMISSION_CAPS.MAX_COMMISSION_PER_PROPOSAL)} por proposta
                  conforme política OPEN. Inadimplência &gt; 30 dias suspende comissão.
                  Cancelamento ≤ 90 dias remove última parcela.
                </p>
              </div>
            </div>
          )}

          <DrawerFooter>
            <DrawerClose asChild>
              <Button variant="outline">Fechar</Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
};

export default ComissoesExecutivos;
