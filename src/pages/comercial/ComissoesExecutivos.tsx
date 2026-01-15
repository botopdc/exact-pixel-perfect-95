/**
 * Gestão de Comissões - Executivos
 * OPEN 2026 Commission Policy v3 - SEM CAP
 * 
 * Regras:
 * - 1, 12m: 4% do TCV
 * - 24, 36, 48m: 2.5% do TCV
 * - Fallback: < 24m = 4%, >= 24m = 2.5%
 * - Pagamento em 3x
 * 
 * Metas MRR:
 * - Admin (1000) e Gerente (750) podem editar metas
 * - Metas são salvas em calculator/config com category="Comissões", section="Metas MRR Executivos"
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
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
  Ban,
  Eye,
  RefreshCw,
  AlertCircle,
  FileText,
  Percent,
  Target,
  Save,
} from 'lucide-react';
import { formatCurrencyBRL } from '@/lib/calculatorConfig';
import {
  COMMISSION_RATES,
  CommissionCalculation,
  ExecutiveCommissionSummary,
} from '@/services/executiveCommissionService';
import { useExecutiveCommissions } from '@/hooks/useExecutiveCommissions';
import { useMRRGoals, ExecutiveMRRGoal } from '@/hooks/useMRRGoals';
import { openApi } from '@/lib/openApi';

const ComissoesExecutivos = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedCommission, setSelectedCommission] = useState<CommissionCalculation | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [userLevel, setUserLevel] = useState<number>(0);
  
  // Local state for editing goals
  const [localGoals, setLocalGoals] = useState<Record<number, number>>({});
  const [hasChanges, setHasChanges] = useState(false);

  const {
    commissions: allCommissions,
    stats,
    executiveSummaries,
    isLoading,
    isError,
    error,
    refetch,
  } = useExecutiveCommissions();
  
  const {
    goals: mrrGoals,
    isLoading: isLoadingGoals,
    saveGoals,
    isSaving,
    getGoalForExecutive,
  } = useMRRGoals();
  
  // Check user level on mount
  useEffect(() => {
    openApi.getCurrentUser().then((user) => {
      setUserLevel(user.level);
    }).catch(() => {
      setUserLevel(0);
    });
  }, []);
  
  // Initialize local goals when mrrGoals load
  useEffect(() => {
    const goalsMap: Record<number, number> = {};
    mrrGoals.forEach((g) => {
      goalsMap[g.executiveId] = g.metaMRR;
    });
    setLocalGoals(goalsMap);
  }, [mrrGoals]);
  
  const canEditGoals = userLevel === 1000 || userLevel === 750;
  
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
        return true;
      });
    }

    return filtered;
  }, [allCommissions, searchTerm, statusFilter]);

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
            Política OPEN 2026 - Comissão sobre TCV
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          {isLoading ? 'Carregando...' : 'Atualizar'}
        </Button>
      </div>

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
            <CardTitle className="text-sm font-medium">Comissão Total</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <div className="text-2xl font-bold text-green-500">
                {formatCurrencyBRL(stats.total_comissao)}
              </div>
            )}
            <p className="text-xs text-muted-foreground">Soma total</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">TCV Total</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <div className="text-2xl font-bold text-blue-500">
                {formatCurrencyBRL(stats.total_tcv)}
              </div>
            )}
            <p className="text-xs text-muted-foreground">Valor total dos contratos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Contratos</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <div className="text-2xl font-bold">{stats.total_contratos}</div>
            )}
            <p className="text-xs text-muted-foreground">Propostas aprovadas</p>
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

      {/* Policy Summary */}
      <Card className="bg-muted/30 border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-5 w-5 text-primary" />
            Comissões — Política OPEN 2026
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Comissão: 1/12m = 4% do TCV | 24/36/48m = 2,5% do TCV | Pagamento em 3x
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <div className="flex items-center gap-3 p-3 bg-background rounded-lg border">
              <Percent className="h-8 w-8 text-primary" />
              <div>
                <p className="text-sm font-medium">Taxa Média</p>
                <p className="text-2xl font-bold">{(stats.taxa_media_ponderada * 100).toFixed(2)}%</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-background rounded-lg border">
              <Calendar className="h-8 w-8 text-primary" />
              <div>
                <p className="text-sm font-medium">Pagamento</p>
                <p className="text-2xl font-bold">3x</p>
                <p className="text-xs text-muted-foreground">Parcelas iguais</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-background rounded-lg border">
              <TrendingUp className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-sm font-medium">Contratos Ativos</p>
                <p className="text-2xl font-bold text-green-500">{stats.total_contratos}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* MRR Goals Section - Only visible to Admin (1000) and Manager (750) */}
      {(userLevel === 1000 || userLevel === 750) && (
        <Card className="border-primary/30">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-primary" />
                  Metas MRR por Executivo
                </CardTitle>
                <CardDescription>
                  Configure metas mensais de MRR para cada executivo
                </CardDescription>
              </div>
              <Button
                onClick={() => {
                  const goalsToSave: ExecutiveMRRGoal[] = Object.entries(localGoals).map(([id, meta]) => ({
                    executiveId: parseInt(id, 10),
                    metaMRR: meta,
                  }));
                  saveGoals(goalsToSave);
                  setHasChanges(false);
                }}
                disabled={!hasChanges || isSaving}
                className="min-w-[120px]"
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Salvar Metas
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading || isLoadingGoals ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : executiveSummaries.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                Nenhum executivo com propostas aprovadas encontrado
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Executivo</TableHead>
                    <TableHead className="text-right">MRR Atual (R$)</TableHead>
                    <TableHead className="text-right">Meta MRR (R$)</TableHead>
                    <TableHead className="w-[200px]">Progresso</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {executiveSummaries.map((exec) => {
                    const execId = parseInt(exec.executivo_id, 10);
                    // Calculate MRR: for each proposal, MRR = total / contract_duration
                    const execCommissions = allCommissions.filter((c) => c.executivo_id === exec.executivo_id);
                    const mrrAtual = execCommissions.reduce((sum, c) => {
                      const months = c.contract_term_months || 1;
                      return sum + (c.tcv / months);
                    }, 0);
                    const metaMRR = localGoals[execId] || 0;
                    const progress = metaMRR > 0 ? Math.min((mrrAtual / metaMRR) * 100, 100) : 0;
                    const gap = Math.max(metaMRR - mrrAtual, 0);
                    
                    return (
                      <TableRow key={exec.executivo_id}>
                        <TableCell className="font-medium">{exec.executivo_nome}</TableCell>
                        <TableCell className="text-right">
                          <span className="font-semibold text-blue-500">
                            {formatCurrencyBRL(mrrAtual)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          {canEditGoals ? (
                            <Input
                              type="number"
                              min={0}
                              step={1000}
                              className="w-32 text-right ml-auto"
                              value={localGoals[execId] || ''}
                              placeholder="0"
                              onChange={(e) => {
                                const value = parseFloat(e.target.value) || 0;
                                setLocalGoals((prev) => ({ ...prev, [execId]: value }));
                                setHasChanges(true);
                              }}
                            />
                          ) : (
                            <span>{formatCurrencyBRL(metaMRR)}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <Progress value={progress} className="h-2" />
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>{progress.toFixed(0)}%</span>
                              {gap > 0 && (
                                <span className="text-amber-500">
                                  Falta: {formatCurrencyBRL(gap)}
                                </span>
                              )}
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

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
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Commissions by Executive */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Users className="h-5 w-5" />
            Por Executivo
          </h2>
          {isLoading ? (
            [1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="p-4 space-y-3">
                  <Skeleton className="h-5 w-32" />
                  <div className="grid grid-cols-2 gap-2">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                </CardContent>
              </Card>
            ))
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
                  <h3 className="font-medium mb-2">{exec.executivo_nome}</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-muted-foreground">Propostas</p>
                      <p className="font-semibold">{exec.total_propostas}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Comissão</p>
                      <p className="font-semibold text-green-500">
                        {formatCurrencyBRL(exec.total_comissao)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">TCV</p>
                      <p className="font-semibold text-blue-500">
                        {formatCurrencyBRL(exec.total_tcv)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Taxa Média</p>
                      <p className="font-semibold">{(exec.taxa_media_ponderada * 100).toFixed(2)}%</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

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
                            {formatCurrencyBRL(commission.commission_value)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            TCV: {formatCurrencyBRL(commission.tcv)}
                          </p>
                        </div>
                        {!commission.is_standard_duration && (
                          <Badge variant="outline" className="text-xs text-yellow-600 border-yellow-500/30">
                            Duração não padrão
                          </Badge>
                        )}
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">
                    <div className="space-y-4">
                      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Aprovado: {new Date(commission.data_aprovacao).toLocaleDateString('pt-BR')}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calculator className="h-3 w-3" />
                          Taxa: {(commission.commission_rate * 100).toFixed(1)}%
                        </span>
                      </div>

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
                                {parcela.data_prevista 
                                  ? new Date(parcela.data_prevista).toLocaleDateString('pt-BR')
                                  : 'A definir'}
                              </TableCell>
                              <TableCell>{getInstallmentBadge(parcela.status)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>

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
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-xs text-muted-foreground">TCV</p>
                  <p className="text-lg font-bold">
                    {formatCurrencyBRL(selectedCommission.tcv)}
                  </p>
                </div>
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-xs text-muted-foreground">Duração</p>
                  <p className="text-lg font-bold">{selectedCommission.contract_term_months} meses</p>
                </div>
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-xs text-muted-foreground">Taxa</p>
                  <p className="text-lg font-bold">
                    {(selectedCommission.commission_rate * 100).toFixed(1)}%
                  </p>
                </div>
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-xs text-muted-foreground">Comissão</p>
                  <p className="text-lg font-bold text-primary">
                    {formatCurrencyBRL(selectedCommission.commission_value)}
                  </p>
                </div>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Memória de Cálculo</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">TCV (Total Contract Value):</span>
                    <span>{formatCurrencyBRL(selectedCommission.tcv)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Duração do contrato:</span>
                    <span>{selectedCommission.contract_term_months} meses</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Taxa de comissão:</span>
                    <span>{(selectedCommission.commission_rate * 100).toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold border-t pt-2">
                    <span>Comissão = TCV × Taxa:</span>
                    <span className="text-primary">
                      {formatCurrencyBRL(selectedCommission.commission_value)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Parcela (÷3):</span>
                    <span>{formatCurrencyBRL(selectedCommission.installment_value)}</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Parcelas (3x)</CardTitle>
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
                            {parcela.data_prevista 
                              ? new Date(parcela.data_prevista).toLocaleDateString('pt-BR')
                              : 'A definir'}
                          </TableCell>
                          <TableCell>{getInstallmentBadge(parcela.status)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground flex items-start gap-2">
                <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <p>
                  <strong>Política OPEN 2026:</strong> 1/12m = 4% do TCV | 24/36/48m = 2,5% do TCV | 
                  Pagamento em 3 parcelas.
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
