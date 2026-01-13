/**
 * Gestão de Comissões - Executivos
 * OPEN v2 Commission Policy
 * 
 * Regras:
 * - <= 12m: 4%, meses = prazo
 * - > 12m: 2.5%, meses = 18 (CAP)
 * - CAP financeiro por ticket:
 *   - <= R$ 50k: R$ 20k
 *   - R$ 50k-150k: R$ 35k
 *   - > R$ 150k: R$ 50k
 */

import React, { useState } from 'react';
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
import { Skeleton } from '@/components/ui/skeleton';
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
  AlertCircle,
} from 'lucide-react';
import { formatCurrencyBRL } from '@/lib/calculatorConfig';
import {
  COMMISSION_RATES,
  CommissionCalculation,
  getCapByTicket,
} from '@/services/executiveCommissionService';
import { useExecutiveCommissions } from '@/hooks/useExecutiveCommissions';

const ComissoesExecutivos = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedCommission, setSelectedCommission] = useState<CommissionCalculation | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Load commissions from real API
  const {
    commissions: allCommissions,
    stats,
    executiveSummaries,
    isLoading,
    isError,
    error,
    refetch,
  } = useExecutiveCommissions();
  
  // Apply filters
  const filteredCommissions = React.useMemo(() => {
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
        if (statusFilter === 'com-cap') return c.cap_applied || c.cap_meses_aplicado;
        return true;
      });
    }

    return filtered;
  }, [allCommissions, searchTerm, statusFilter]);

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
    const hasCap = commission.cap_applied || commission.cap_meses_aplicado;
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
              Comissão limitada pelo CAP de ticket ({formatCurrencyBRL(commission.cap)}) 
              ou meses (18 máx) conforme política OPEN v2.
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
            Política OPEN v2 - Acompanhamento e cálculo de comissões
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          {isLoading ? 'Carregando...' : 'Atualizar'}
        </Button>
      </div>

      {/* Error state */}
      {isError && (
        <Card className="border-destructive bg-destructive/10">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <div>
              <p className="font-medium text-destructive">Erro ao carregar comissões</p>
              <p className="text-sm text-muted-foreground">{error?.message || 'Tente novamente mais tarde'}</p>
            </div>
            <Button variant="outline" size="sm" className="ml-auto" onClick={() => refetch()}>
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Previsto</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <div className="text-2xl font-bold text-green-500">
                {formatCurrencyBRL(stats.total_previsto)}
              </div>
            )}
            <p className="text-xs text-muted-foreground">Este mês</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">A Pagar</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <div className="text-2xl font-bold text-yellow-500">
                {formatCurrencyBRL(stats.total_a_pagar)}
              </div>
            )}
            <p className="text-xs text-muted-foreground">Pendente</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pago</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <div className="text-2xl font-bold">{formatCurrencyBRL(stats.total_pago)}</div>
            )}
            <p className="text-xs text-muted-foreground">Últimos 30 dias</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Executivos</CardTitle>
            <PieChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{stats.total_executivos_ativos}</div>
            )}
            <p className="text-xs text-muted-foreground">Com comissão ativa</p>
          </CardContent>
        </Card>
      </div>

      {/* CAP Info Card - OPEN v2 */}
      <Card className="bg-muted/30 border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Shield className="h-5 w-5 text-primary" />
            Regras de CAP — Política OPEN v2
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="flex items-center gap-3 p-3 bg-background rounded-lg border">
              <Calendar className="h-8 w-8 text-primary" />
              <div>
                <p className="text-sm font-medium">Meses Comissionáveis</p>
                <p className="text-2xl font-bold">18 máx</p>
                <p className="text-xs text-muted-foreground">Para contratos &gt; 12m</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-background rounded-lg border">
              <DollarSign className="h-8 w-8 text-primary" />
              <div>
                <p className="text-sm font-medium">CAP por Ticket</p>
                <p className="text-lg font-bold">R$ 20k - 50k</p>
                <p className="text-xs text-muted-foreground">Baseado no valor mensal</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-background rounded-lg border">
              <AlertTriangle className="h-8 w-8 text-yellow-500" />
              <div>
                <p className="text-sm font-medium">Propostas com CAP</p>
                <p className="text-2xl font-bold">{stats.propostas_com_cap}</p>
                <p className="text-xs text-muted-foreground">Limitadas este mês</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-background rounded-lg border">
              <TrendingUp className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-sm font-medium">Economia Total</p>
                <p className="text-2xl font-bold text-green-500">
                  {formatCurrencyBRL(stats.economia_cap)}
                </p>
                <p className="text-xs text-muted-foreground">Via aplicação de CAPs</p>
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-4 flex items-center gap-1">
            <Info className="h-3 w-3" />
            Taxas: ≤12m = {(COMMISSION_RATES.SHORT_TERM * 100).toFixed(0)}% | &gt;12m ={' '}
            {(COMMISSION_RATES.LONG_TERM * 100).toFixed(1)}% • CAP por ticket: ≤R$50k=R$20k | R$50k-150k=R$35k | &gt;R$150k=R$50k • 3 parcelas
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
          {isLoading ? (
            <>
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardContent className="p-4 space-y-3">
                    <Skeleton className="h-5 w-32" />
                    <div className="grid grid-cols-2 gap-2">
                      <Skeleton className="h-12 w-full" />
                      <Skeleton className="h-12 w-full" />
                      <Skeleton className="h-12 w-full" />
                      <Skeleton className="h-12 w-full" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </>
          ) : executiveSummaries.length === 0 ? (
            <Card>
              <CardContent className="p-4 text-center text-muted-foreground">
                <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Nenhum executivo com comissão</p>
              </CardContent>
            </Card>
          ) : (
            executiveSummaries.map((exec) => (
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
            ))
          )}
        </div>

        {/* Commissions List */}
        <div className="lg:col-span-2">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Comissões por Proposta ({filteredCommissions.length})
          </h2>

          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <Card key={i}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="space-y-2">
                      <Skeleton className="h-5 w-48" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                    <Skeleton className="h-6 w-24" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredCommissions.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12 text-muted-foreground">
                <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhuma comissão encontrada</p>
                {allCommissions.length === 0 && !isLoading && (
                  <p className="text-sm mt-2">Não há propostas APPROVED para calcular comissões</p>
                )}
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
                          {commission.executivo_nome} • {commission.contract_term_months}m
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <p className="font-semibold text-primary">
                            {formatCurrencyBRL(commission.final_commission)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            MRR: {formatCurrencyBRL(commission.monthly_value)}
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
                          Taxa: {(commission.commission_rate * 100).toFixed(1)}%
                        </span>
                        {commission.cap_meses_aplicado && (
                          <span className="text-primary flex items-center gap-1">
                            <Shield className="h-3 w-3" />
                            Cap meses: {commission.contract_term_months} → {commission.months_commissioned}
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
              Detalhamento da Comissão - OPEN v2
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
                  <p className="text-xs text-muted-foreground">Valor Mensal</p>
                  <p className="text-lg font-bold">
                    {formatCurrencyBRL(selectedCommission.monthly_value)}
                  </p>
                </div>
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-xs text-muted-foreground">Prazo Contrato</p>
                  <p className="text-lg font-bold">{selectedCommission.contract_term_months} meses</p>
                </div>
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-xs text-muted-foreground">Meses Comissionáveis</p>
                  <p className="text-lg font-bold flex items-center gap-2">
                    {selectedCommission.months_commissioned}
                    {selectedCommission.cap_meses_aplicado && (
                      <Badge className="bg-primary/20 text-primary text-xs">CAP</Badge>
                    )}
                  </p>
                </div>
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-xs text-muted-foreground">Taxa</p>
                  <p className="text-lg font-bold">
                    {(selectedCommission.commission_rate * 100).toFixed(1)}%
                  </p>
                </div>
              </div>

              {/* Calculation breakdown */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Memória de Cálculo - OPEN v2</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      Comissão bruta (valor × meses × taxa):
                    </span>
                    <span>{formatCurrencyBRL(selectedCommission.gross_commission)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      CAP aplicável (baseado em {formatCurrencyBRL(selectedCommission.monthly_value)}):
                    </span>
                    <span>{formatCurrencyBRL(selectedCommission.cap)}</span>
                  </div>

                  {/* CAP application */}
                  {(selectedCommission.cap_meses_aplicado || selectedCommission.cap_applied) && (
                    <div className="bg-primary/10 rounded-lg p-3 space-y-2">
                      <div className="flex items-center gap-2 text-primary font-medium">
                        <Shield className="h-4 w-4" />
                        CAPs Aplicados
                      </div>
                      {selectedCommission.cap_meses_aplicado && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">
                            Cap de meses ({selectedCommission.contract_term_months} → {selectedCommission.months_commissioned}):
                          </span>
                          <span className="text-primary">Aplicado</span>
                        </div>
                      )}
                      {selectedCommission.cap_applied && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">
                            Cap financeiro ({formatCurrencyBRL(selectedCommission.cap)}):
                          </span>
                          <span className="text-green-500">
                            -{formatCurrencyBRL(selectedCommission.valor_economizado)}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex justify-between text-lg font-bold border-t pt-2">
                    <span>Comissão Final:</span>
                    <span className="text-primary">
                      {formatCurrencyBRL(selectedCommission.final_commission)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Parcela mensal (÷3):</span>
                    <span>{formatCurrencyBRL(selectedCommission.monthly_installment)}</span>
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
                  <strong>Política OPEN v2:</strong> ≤12m = 4% (meses = prazo) | &gt;12m = 2.5% (meses = 18 máx) | 
                  CAP por ticket: ≤R$50k = R$20k | R$50k-150k = R$35k | &gt;R$150k = R$50k | 
                  3 parcelas mensais.
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
