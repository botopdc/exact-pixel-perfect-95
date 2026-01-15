/**
 * Gestão de Comissões - Executivos
 * OPEN 2026 Commission Policy v3 - SEM CAP
 * 
 * Metas MRR agora são somente leitura - edição na página METAS
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
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
  PieChart,
  Search,
  CheckCircle,
  Clock,
  AlertTriangle,
  Users,
  Ban,
  Eye,
  RefreshCw,
  AlertCircle,
  FileText,
  Percent,
  Target,
  ChevronDown,
  ExternalLink,
} from 'lucide-react';
import { formatCurrencyBRL } from '@/lib/calculatorConfig';
import {
  CommissionCalculation,
} from '@/services/executiveCommissionService';
import { useExecutiveCommissions } from '@/hooks/useExecutiveCommissions';
import { useMetasComerciais } from '@/hooks/useMetasComerciais';
import { openApi } from '@/lib/openApi';

const ComissoesExecutivos = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedCommission, setSelectedCommission] = useState<CommissionCalculation | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [userLevel, setUserLevel] = useState<number>(0);
  const [metasOpen, setMetasOpen] = useState(false);

  const {
    commissions: allCommissions,
    stats,
    executiveSummaries,
    isLoading,
    isError,
    error,
    refetch,
  } = useExecutiveCommissions();

  const currentYear = new Date().getFullYear();
  const {
    getExecutivesWithGoals,
    isLoading: isLoadingMetas,
  } = useMetasComerciais();

  const executivesWithGoals = useMemo(() => {
    return getExecutivesWithGoals(currentYear);
  }, [getExecutivesWithGoals, currentYear]);

  useEffect(() => {
    openApi.getCurrentUser().then((user) => {
      setUserLevel(user.level);
    }).catch(() => {
      setUserLevel(0);
    });
  }, []);

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
        return true;
      });
    }
    return filtered;
  }, [allCommissions, searchTerm, statusFilter]);

  const getInstallmentBadge = (status: string) => {
    const styles: Record<string, { className: string; icon: React.ReactNode }> = {
      pendente: { className: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/50', icon: <Clock className="h-3 w-3" /> },
      pago: { className: 'bg-green-500/20 text-green-500 border-green-500/50', icon: <CheckCircle className="h-3 w-3" /> },
      suspenso: { className: 'bg-red-500/20 text-red-500 border-red-500/50', icon: <Ban className="h-3 w-3" /> },
      cancelado: { className: 'bg-muted text-muted-foreground border-muted', icon: <AlertTriangle className="h-3 w-3" /> },
    };
    const style = styles[status] || styles.pendente;
    return <Badge className={`${style.className} flex items-center gap-1`}>{style.icon}{status.charAt(0).toUpperCase() + status.slice(1)}</Badge>;
  };

  const openDetails = (commission: CommissionCalculation) => {
    setSelectedCommission(commission);
    setDrawerOpen(true);
  };

  // Normalize stats to avoid NaN
  const safeTcv = typeof stats.total_tcv === 'number' && !isNaN(stats.total_tcv) ? stats.total_tcv : 0;
  const safeComissao = typeof stats.total_comissao === 'number' && !isNaN(stats.total_comissao) ? stats.total_comissao : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2 flex items-center gap-2">
            <DollarSign className="h-8 w-8 text-primary" />
            Gestão de Comissões — Executivos
          </h1>
          <p className="text-muted-foreground">Política OPEN 2026 - Comissão sobre TCV</p>
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
            <p className="text-destructive">{error?.message || 'Erro ao carregar comissões'}</p>
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
            {isLoading ? <Skeleton className="h-8 w-32" /> : (
              <div className="text-2xl font-bold text-green-500">{formatCurrencyBRL(safeComissao)}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">TCV Total</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-32" /> : (
              <div className="text-2xl font-bold text-blue-500">{formatCurrencyBRL(safeTcv)}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Contratos</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-16" /> : (
              <div className="text-2xl font-bold">{stats.total_contratos || 0}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Executivos</CardTitle>
            <PieChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-16" /> : (
              <div className="text-2xl font-bold">{stats.total_executivos_ativos || 0}</div>
            )}
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
                <p className="text-2xl font-bold">{((stats.taxa_media_ponderada || 0) * 100).toFixed(2)}%</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-background rounded-lg border">
              <Calendar className="h-8 w-8 text-primary" />
              <div>
                <p className="text-sm font-medium">Pagamento</p>
                <p className="text-2xl font-bold">3x</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-background rounded-lg border">
              <TrendingUp className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-sm font-medium">Contratos Ativos</p>
                <p className="text-2xl font-bold text-green-500">{stats.total_contratos || 0}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* MRR Goals Section - Collapsible, Read-Only */}
      {(userLevel === 1000 || userLevel === 750) && (
        <Collapsible open={metasOpen} onOpenChange={setMetasOpen}>
          <Card className="border-primary/30">
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Target className="h-5 w-5 text-primary" />
                    <div>
                      <CardTitle className="text-base">Metas MRR por Executivo</CardTitle>
                      <CardDescription>Ano: {currentYear} • {executivesWithGoals.length} executivo(s) com meta</CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate('/comercial/metas');
                      }}
                    >
                      <ExternalLink className="h-4 w-4 mr-1" />
                      Ir para METAS
                    </Button>
                    <ChevronDown className={`h-5 w-5 transition-transform ${metasOpen ? 'rotate-180' : ''}`} />
                  </div>
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent>
                {isLoading || isLoadingMetas ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
                  </div>
                ) : executivesWithGoals.length === 0 ? (
                  <div className="text-center py-8">
                    <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-muted-foreground">Nenhuma meta definida para {currentYear}</p>
                    <Button variant="link" onClick={() => navigate('/comercial/metas')}>
                      Definir metas na página METAS
                    </Button>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Executivo</TableHead>
                        <TableHead className="text-right">MRR Atual (R$)</TableHead>
                        <TableHead className="text-right">Meta MRR (R$)</TableHead>
                        <TableHead className="w-[200px]">Progresso</TableHead>
                        <TableHead className="text-right">Falta (R$)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {executivesWithGoals.map((exec) => {
                        const execCommissions = allCommissions.filter((c) => parseInt(c.executivo_id, 10) === exec.id);
                        const mrrAtual = execCommissions.reduce((sum, c) => {
                          const months = c.contract_term_months || 1;
                          return sum + (c.tcv / months);
                        }, 0);
                        const metaMRR = exec.monthlyMRRTarget || 0;
                        const progress = metaMRR > 0 ? Math.min((mrrAtual / metaMRR) * 100, 100) : 0;
                        const gap = Math.max(metaMRR - mrrAtual, 0);

                        return (
                          <TableRow key={exec.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium">{exec.name}</p>
                                <p className="text-xs text-muted-foreground">{exec.email}</p>
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-semibold text-blue-500">
                              {formatCurrencyBRL(mrrAtual)}
                            </TableCell>
                            <TableCell className="text-right">{formatCurrencyBRL(metaMRR)}</TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                <Progress value={progress} className="h-2" />
                                <span className="text-xs text-muted-foreground">{progress.toFixed(0)}%</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              {gap > 0 ? (
                                <span className="text-amber-500">{formatCurrencyBRL(gap)}</span>
                              ) : (
                                <span className="text-green-500">Meta atingida!</span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
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
              <CardContent className="p-8 text-center text-muted-foreground">
                Nenhum executivo encontrado
              </CardContent>
            </Card>
          ) : (
            executiveSummaries.map((exec) => (
              <Card key={exec.executivo_id} className="hover:border-primary/50 transition-colors">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="font-semibold">{exec.executivo_nome}</p>
                      <p className="text-xs text-muted-foreground">{exec.total_contratos} contrato(s)</p>
                    </div>
                    <Badge variant="outline">{((exec.taxa_media || 0) * 100).toFixed(1)}%</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-2 bg-muted/50 rounded-lg">
                      <p className="text-xs text-muted-foreground">TCV</p>
                      <p className="font-bold text-blue-500">{formatCurrencyBRL(exec.total_tcv || 0)}</p>
                    </div>
                    <div className="p-2 bg-muted/50 rounded-lg">
                      <p className="text-xs text-muted-foreground">Comissão</p>
                      <p className="font-bold text-green-500">{formatCurrencyBRL(exec.total_comissao || 0)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Commissions Table */}
        <div className="lg:col-span-2">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Detalhamento de Comissões
          </h2>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Executivo</TableHead>
                    <TableHead className="text-right">TCV</TableHead>
                    <TableHead className="text-right">Comissão</TableHead>
                    <TableHead>Parcelas</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    [1, 2, 3, 4, 5].map((i) => (
                      <TableRow key={i}>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                      </TableRow>
                    ))
                  ) : filteredCommissions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        Nenhuma comissão encontrada
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredCommissions.slice(0, 20).map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.cliente_nome}</TableCell>
                        <TableCell>{c.executivo_nome}</TableCell>
                        <TableCell className="text-right text-blue-500">{formatCurrencyBRL(c.tcv)}</TableCell>
                        <TableCell className="text-right text-green-500">{formatCurrencyBRL(c.comissao_total)}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {c.parcelas.slice(0, 3).map((p, i) => getInstallmentBadge(p.status))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" onClick={() => openDetails(c)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Details Drawer */}
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Detalhes da Comissão</DrawerTitle>
            <DrawerDescription>{selectedCommission?.cliente_nome}</DrawerDescription>
          </DrawerHeader>
          {selectedCommission && (
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Executivo</p>
                  <p className="font-medium">{selectedCommission.executivo_nome}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Prazo</p>
                  <p className="font-medium">{selectedCommission.contract_term_months} meses</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">TCV</p>
                  <p className="font-medium text-blue-500">{formatCurrencyBRL(selectedCommission.tcv)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Taxa</p>
                  <p className="font-medium">{(selectedCommission.taxa_comissao * 100).toFixed(1)}%</p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-muted-foreground">Comissão Total</p>
                  <p className="text-2xl font-bold text-green-500">{formatCurrencyBRL(selectedCommission.comissao_total)}</p>
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-2">Parcelas</p>
                <div className="space-y-2">
                  {selectedCommission.parcelas.map((p, i) => (
                    <div key={i} className="flex justify-between items-center p-2 bg-muted/50 rounded-lg">
                      <span>Parcela {i + 1}</span>
                      <span className="font-medium">{formatCurrencyBRL(p.valor)}</span>
                      {getInstallmentBadge(p.status)}
                    </div>
                  ))}
                </div>
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
