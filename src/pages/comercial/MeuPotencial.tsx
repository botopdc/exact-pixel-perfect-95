/**
 * Meu Potencial - Executive Earnings Dashboard
 * OPEN 2026 Commission Policy v3 - SEM CAP
 * 
 * ============================================
 * REGRAS IMPLEMENTADAS:
 * ============================================
 * 
 * 1️⃣ COMISSÃO POR DURAÇÃO:
 * - 1, 12 meses = 4% do TCV
 * - 24, 36, 48 meses = 2.5% do TCV
 * - Fallback: < 24m = 4%, >= 24m = 2.5%
 * 
 * 2️⃣ TCV = campo "total" da proposta
 * 
 * 3️⃣ SEM CAP - Sem teto de comissão
 * 
 * 4️⃣ PAGAMENTO: Sempre 3 parcelas iguais
 * 
 * 5️⃣ SOMENTE status = APPROVED
 */

import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { openApi } from '@/lib/openApi';
import { normalizeStatus } from '@/hooks/useProposals';
import {
  computeCommissionPct,
  computeCommissionValue,
  computeInstallments,
  isStandardDuration,
  STANDARD_DURATIONS,
} from '@/services/executiveCommissionService';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Clock,
  DollarSign,
  Eye,
  ChevronDown,
  Calculator,
  Target,
  Wallet,
  BarChart3,
  FileText,
  Percent,
  Lightbulb,
  ArrowUp,
  Calendar,
} from 'lucide-react';

// ============================================
// TYPES
// ============================================

interface ApiProposal {
  id: number;
  name: string;
  company: string;
  email: string;
  phone: string;
  total: number; // TCV
  contract_duration: number;
  status?: string;
  channel_type?: string;
  created_by?: number;
  created_at: string;
  updated_at: string;
  accepted_at?: string;
  approved_at?: string;
  dados_proposta?: {
    cliente?: {
      nome?: string;
      empresa?: string;
    };
    config?: {
      vigencia?: number;
    };
  };
}

interface ProcessedProposal {
  id: number;
  cliente: string;
  empresa: string;
  tcv: number; // Total Contract Value
  contract_term_months: number;
  commission_rate: number;
  commission_value: number;
  p1: number;
  p2: number;
  p3: number;
  is_standard_duration: boolean;
  dataAprovacao: string;
  dadosIncompletos: boolean;
  mrr: number; // MRR estimado = TCV / duração
  basePaymentMonth: number | null; // Month index (0-11) from accepted_at/approved_at/created_at
}

// ============================================
// MRR CONFIGURATION
// ============================================

const METAS_MRR = [50000, 100000, 150000, 200000];

// ============================================
// MONTH NAMES & HELPERS
// ============================================

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const MONTH_NAMES_SHORT = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
];

const LOCALSTORAGE_KEY = 'commission_installment_start_month';

/**
 * Get 3 consecutive months starting from baseMonthIndex (0-11)
 * Returns array of [m1, m2, m3] with wrap-around (Dec -> Jan)
 */
function getInstallmentMonths(baseMonthIndex: number): [number, number, number] {
  const m1 = baseMonthIndex % 12;
  const m2 = (baseMonthIndex + 1) % 12;
  const m3 = (baseMonthIndex + 2) % 12;
  return [m1, m2, m3];
}

/**
 * Extract month index from a date string (ISO format)
 * Returns null if invalid
 */
function getMonthFromDateString(dateStr: string | undefined | null): number | null {
  if (!dateStr) return null;
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return null;
    return date.getMonth(); // 0-11
  } catch {
    return null;
  }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function formatCurrency(value: number): string {
  if (isNaN(value) || value === null || value === undefined) {
    return 'R$ 0,00';
  }
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

// ============================================
// COMPONENT
// ============================================

export default function MeuPotencial() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [propostas, setPropostas] = useState<ProcessedProposal[]>([]);
  const [userId, setUserId] = useState<number | null>(null);
  
  // Global dropdown for start month (0-11), default to current month
  const [selectedStartMonth, setSelectedStartMonth] = useState<number>(() => {
    const stored = localStorage.getItem(LOCALSTORAGE_KEY);
    if (stored !== null) {
      const parsed = parseInt(stored, 10);
      if (!isNaN(parsed) && parsed >= 0 && parsed <= 11) {
        return parsed;
      }
    }
    return new Date().getMonth();
  });

  // Persist selection to localStorage
  const handleStartMonthChange = (value: string) => {
    const month = parseInt(value, 10);
    setSelectedStartMonth(month);
    localStorage.setItem(LOCALSTORAGE_KEY, value);
  };

  useEffect(() => {
    let mounted = true;

    async function loadData() {
      try {
        const user = await openApi.getCurrentUser();
        
        if (!mounted) return;
        
        if (!user || user.level !== 700) {
          toast.error('Acesso restrito a Executivos');
          navigate('/login', { replace: true });
          return;
        }
        
        setUserId(user.id);
        
        const response = await openApi.getProposals({
          __perPage: 500,
        });
        
        if (!mounted) return;
        
        const allProposals = (response.data || []) as ApiProposal[];
        
        // RULE: ONLY APPROVED proposals created by this user
        const filteredProposals = allProposals.filter((p) => {
          const normalizedStatus = normalizeStatus(p.status);
          const isApproved = normalizedStatus === 'APPROVED';
          const isOwner = p.created_by === user.id;
          return isApproved && isOwner;
        });

        // Process proposals
        const processed: ProcessedProposal[] = filteredProposals.map((p) => {
          const tcv = p.total || 0;
          const duration = p.contract_duration || p.dados_proposta?.config?.vigencia || 0;
          const rate = computeCommissionPct(duration);
          const commission = computeCommissionValue(tcv, duration);
          const installments = computeInstallments(commission);
          
          // Calculate MRR (only if duration > 0)
          const mrr = duration > 0 ? tcv / duration : 0;
          
          // Determine base payment month from dates (priority: accepted_at > approved_at > updated_at > created_at)
          const basePaymentMonth = 
            getMonthFromDateString(p.accepted_at) ??
            getMonthFromDateString(p.approved_at) ??
            getMonthFromDateString(p.updated_at) ??
            getMonthFromDateString(p.created_at);
          
          return {
            id: p.id,
            cliente: p.name || p.dados_proposta?.cliente?.nome || 'N/A',
            empresa: p.company || p.dados_proposta?.cliente?.empresa || 'N/A',
            tcv,
            contract_term_months: duration,
            commission_rate: rate,
            commission_value: commission,
            p1: installments.p1,
            p2: installments.p2,
            p3: installments.p3,
            is_standard_duration: isStandardDuration(duration),
            dataAprovacao: p.updated_at,
            dadosIncompletos: !tcv || !duration,
            mrr,
            basePaymentMonth,
          };
        });

        // Sort by commission value descending
        processed.sort((a, b) => b.commission_value - a.commission_value);
        
        setPropostas(processed);
        setError(null);
      } catch (err: any) {
        console.error('[MeuPotencial] Error:', err);
        if (mounted) {
          setError(err.message || 'Erro ao carregar dados');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadData();

    return () => {
      mounted = false;
    };
  }, [navigate]);

  // ============================================
  // COMPUTED VALUES
  // ============================================

  const stats = useMemo(() => {
    const totalCommission = propostas.reduce((sum, p) => sum + p.commission_value, 0);
    const totalTCV = propostas.reduce((sum, p) => sum + p.tcv, 0);
    const contractCount = propostas.length;
    
    // Weighted average rate
    const avgRate = totalTCV > 0
      ? propostas.reduce((sum, p) => sum + (p.commission_rate * p.tcv), 0) / totalTCV
      : 0;
    
    // Sum of all installments
    const totalP1 = propostas.reduce((sum, p) => sum + p.p1, 0);
    const totalP2 = propostas.reduce((sum, p) => sum + p.p2, 0);
    const totalP3 = propostas.reduce((sum, p) => sum + p.p3, 0);

    return {
      totalCommission,
      totalTCV,
      contractCount,
      avgRate,
      totalP1,
      totalP2,
      totalP3,
    };
  }, [propostas]);

  // ============================================
  // MRR CALCULATIONS
  // ============================================

  const mrrStats = useMemo(() => {
    // Only consider proposals with valid duration for MRR
    const validProposals = propostas.filter(p => p.contract_term_months > 0);
    const mrrAtual = validProposals.reduce((sum, p) => sum + p.mrr, 0);
    
    // Find next target above current MRR
    const sortedMetas = [...METAS_MRR].sort((a, b) => a - b);
    const proximaMeta = sortedMetas.find(meta => meta > mrrAtual) || sortedMetas[sortedMetas.length - 1];
    
    const gap = Math.max(0, proximaMeta - mrrAtual);
    const metaAtingida = mrrAtual >= proximaMeta;
    
    // Count proposals without valid duration
    const invalidDurationCount = propostas.filter(p => p.contract_term_months <= 0).length;

    return {
      mrrAtual,
      proximaMeta,
      gap,
      metaAtingida,
      invalidDurationCount,
    };
  }, [propostas]);

  // ============================================
  // INSTALLMENT MONTHS (global from dropdown)
  // ============================================

  const globalInstallmentMonths = useMemo(() => {
    return getInstallmentMonths(selectedStartMonth);
  }, [selectedStartMonth]);

  // ============================================
  // RENDER LOADING
  // ============================================

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  // ============================================
  // RENDER ERROR
  // ============================================

  if (error) {
    return (
      <div className="p-6">
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Erro ao carregar dados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{error}</p>
            <Button 
              className="mt-4" 
              variant="outline"
              onClick={() => window.location.reload()}
            >
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ============================================
  // MAIN RENDER
  // ============================================

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <TrendingUp className="h-6 w-6 text-primary" />
          Meu Potencial
        </h1>
        <p className="text-muted-foreground">
          Visualize suas comissões e potencial de ganhos baseados nas propostas aprovadas
        </p>
      </div>

      {/* Policy Summary */}
      <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Comissões — Política OPEN 2026
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <Badge variant="outline" className="text-sm py-1">
              Comissão: 1/12m = 4% do TCV | 24/36/48m = 2,5% do TCV | Pagamento em 3x
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Comissão Total Projetada */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Comissão Total Projetada
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {formatCurrency(stats.totalCommission)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Soma das comissões aprovadas
            </p>
          </CardContent>
        </Card>

        {/* TCV Total */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              TCV Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(stats.totalTCV)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Total Contract Value
            </p>
          </CardContent>
        </Card>

        {/* Total de Contratos */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Total de Contratos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.contractCount}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Propostas aprovadas
            </p>
          </CardContent>
        </Card>

        {/* Taxa Média */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Percent className="h-4 w-4" />
              Taxa Média
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(stats.avgRate * 100).toFixed(2)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Ponderada por TCV
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Próximas 3 Parcelas */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                Próximas 3 Parcelas
              </CardTitle>
              <CardDescription>
                Pagamento dividido em 3x (soma de todas as propostas aprovadas)
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground mb-1">Mês inicial (1/3)</span>
                <Select value={String(selectedStartMonth)} onValueChange={handleStartMonthChange}>
                  <SelectTrigger className="w-[140px] h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-background border z-50">
                    {MONTH_NAMES.map((month, index) => (
                      <SelectItem key={index} value={String(index)}>
                        {month}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-[10px] text-muted-foreground mt-1">
                  Define o mês de referência
                </span>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-muted/50 border">
              <div className="text-sm font-medium mb-1">
                {MONTH_NAMES[globalInstallmentMonths[0]]} — 1/3
              </div>
              <div className="text-xs text-muted-foreground mb-2">Pagamento da comissão</div>
              <div className="text-xl font-bold text-primary">
                {formatCurrency(stats.totalP1)}
              </div>
            </div>
            <div className="p-4 rounded-lg bg-muted/50 border">
              <div className="text-sm font-medium mb-1">
                {MONTH_NAMES[globalInstallmentMonths[1]]} — 2/3
              </div>
              <div className="text-xs text-muted-foreground mb-2">Pagamento da comissão</div>
              <div className="text-xl font-bold text-primary">
                {formatCurrency(stats.totalP2)}
              </div>
            </div>
            <div className="p-4 rounded-lg bg-muted/50 border">
              <div className="text-sm font-medium mb-1">
                {MONTH_NAMES[globalInstallmentMonths[2]]} — 3/3
              </div>
              <div className="text-xs text-muted-foreground mb-2">Pagamento da comissão</div>
              <div className="text-xl font-bold text-primary">
                {formatCurrency(stats.totalP3)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Comissões por Proposta */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" />
            Comissões por Proposta
          </CardTitle>
          <CardDescription>
            Detalhamento por contrato (ordenado por maior comissão)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {propostas.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma proposta aprovada encontrada</p>
              <p className="text-sm mt-2">
                Suas propostas aprovadas aparecerão aqui com o cálculo de comissão
              </p>
            </div>
          ) : (
            <TooltipProvider>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente/Empresa</TableHead>
                      <TableHead className="text-right">Duração</TableHead>
                      <TableHead className="text-right">TCV</TableHead>
                      <TableHead className="text-right">%</TableHead>
                      <TableHead className="text-right">Comissão</TableHead>
                      <TableHead className="text-right">
                        {MONTH_NAMES_SHORT[globalInstallmentMonths[0]]} (1/3)
                      </TableHead>
                      <TableHead className="text-right">
                        {MONTH_NAMES_SHORT[globalInstallmentMonths[1]]} (2/3)
                      </TableHead>
                      <TableHead className="text-right">
                        {MONTH_NAMES_SHORT[globalInstallmentMonths[2]]} (3/3)
                      </TableHead>
                      <TableHead className="text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {propostas.map((p) => {
                      // Determine if proposal has its own date-based month
                      const proposalMonths = p.basePaymentMonth !== null
                        ? getInstallmentMonths(p.basePaymentMonth)
                        : null;
                      const hasCustomMonth = proposalMonths !== null && 
                        (proposalMonths[0] !== globalInstallmentMonths[0] ||
                         proposalMonths[1] !== globalInstallmentMonths[1] ||
                         proposalMonths[2] !== globalInstallmentMonths[2]);
                      
                      return (
                        <TableRow key={p.id}>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium">{p.cliente}</span>
                              <span className="text-xs text-muted-foreground">{p.empresa}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              {p.contract_term_months}m
                              {!p.is_standard_duration && (
                                <Badge variant="outline" className="text-xs ml-1">
                                  n/p
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(p.tcv)}
                          </TableCell>
                          <TableCell className="text-right">
                            {(p.commission_rate * 100).toFixed(1)}%
                          </TableCell>
                          <TableCell className="text-right font-bold text-primary">
                            {formatCurrency(p.commission_value)}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {hasCustomMonth && proposalMonths ? (
                              <Tooltip>
                                <TooltipTrigger className="cursor-help underline decoration-dotted">
                                  {formatCurrency(p.p1)}
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Real: {MONTH_NAMES[proposalMonths[0]]}</p>
                                </TooltipContent>
                              </Tooltip>
                            ) : (
                              formatCurrency(p.p1)
                            )}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {hasCustomMonth && proposalMonths ? (
                              <Tooltip>
                                <TooltipTrigger className="cursor-help underline decoration-dotted">
                                  {formatCurrency(p.p2)}
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Real: {MONTH_NAMES[proposalMonths[1]]}</p>
                                </TooltipContent>
                              </Tooltip>
                            ) : (
                              formatCurrency(p.p2)
                            )}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {hasCustomMonth && proposalMonths ? (
                              <Tooltip>
                                <TooltipTrigger className="cursor-help underline decoration-dotted">
                                  {formatCurrency(p.p3)}
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Real: {MONTH_NAMES[proposalMonths[2]]}</p>
                                </TooltipContent>
                              </Tooltip>
                            ) : (
                              formatCurrency(p.p3)
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {p.dadosIncompletos ? (
                              <Badge variant="secondary" className="text-xs">
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                Incompleto
                              </Badge>
                            ) : (
                              <Badge className="bg-green-500/20 text-green-500 border-green-500/30">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                OK
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </TooltipProvider>
          )}
        </CardContent>
      </Card>

      {/* Sugestões — MRR para aumentar comissão */}
      <Card className="bg-gradient-to-r from-amber-500/10 to-orange-500/5 border-amber-500/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-amber-500" />
            Sugestões — MRR para aumentar comissão
          </CardTitle>
          <CardDescription>
            Acompanhe seu MRR aprovado e veja quanto falta para atingir as metas
            {mrrStats.invalidDurationCount > 0 && (
              <span className="block text-xs text-amber-500 mt-1">
                ⚠️ {mrrStats.invalidDurationCount} proposta(s) sem duração válida (não contabilizadas no MRR)
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* MRR Atual */}
            <div className="p-4 rounded-lg bg-background/80 border">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                <BarChart3 className="h-4 w-4" />
                MRR Atual (Aprovado)
              </div>
              <div className="text-2xl font-bold text-primary">
                {formatCurrency(mrrStats.mrrAtual)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Receita mensal recorrente
              </p>
            </div>

            {/* Próxima Meta */}
            <div className="p-4 rounded-lg bg-background/80 border">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                <Target className="h-4 w-4" />
                Próxima Meta
              </div>
              <div className="text-2xl font-bold">
                {formatCurrency(mrrStats.proximaMeta)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Meta de MRR
              </p>
            </div>

            {/* Falta para a Meta */}
            <div className="p-4 rounded-lg bg-background/80 border">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                <ArrowUp className="h-4 w-4" />
                Falta para a Meta
              </div>
              <div className={`text-2xl font-bold ${mrrStats.metaAtingida ? 'text-green-500' : 'text-amber-500'}`}>
                {mrrStats.metaAtingida ? (
                  <span className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5" />
                    Meta atingida!
                  </span>
                ) : (
                  formatCurrency(mrrStats.gap)
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                GAP para próxima meta
              </p>
            </div>

            {/* Sugestão Prática */}
            <div className="p-4 rounded-lg bg-background/80 border">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                <Lightbulb className="h-4 w-4" />
                Sugestão Prática
              </div>
              <div className="text-sm font-medium">
                {mrrStats.metaAtingida ? (
                  <span className="text-green-500">
                    Você já bateu a meta. Próximo passo: aumentar ticket médio ou reduzir churn.
                  </span>
                ) : (
                  <span className="text-amber-600 dark:text-amber-400">
                    Faltam {formatCurrency(mrrStats.gap)} de MRR. Foque em fechar 1 contrato de ~{formatCurrency(mrrStats.gap)} MRR ou 2 de ~{formatCurrency(mrrStats.gap / 2)}.
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Metas disponíveis */}
          <div className="mt-4 pt-4 border-t">
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>Metas configuradas:</span>
              {METAS_MRR.map((meta) => (
                <Badge 
                  key={meta} 
                  variant={mrrStats.mrrAtual >= meta ? "default" : "outline"}
                  className={mrrStats.mrrAtual >= meta ? "bg-green-500/20 text-green-500 border-green-500/30" : ""}
                >
                  {mrrStats.mrrAtual >= meta && <CheckCircle className="h-3 w-3 mr-1" />}
                  {formatCurrency(meta)}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Simulator */}
      <Collapsible>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Calculator className="h-5 w-5 text-primary" />
                  Simulador Rápido
                </span>
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="font-medium">Exemplo: TCV R$ 100.000</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between p-2 bg-muted/50 rounded">
                      <span>12 meses (4%)</span>
                      <span className="font-medium">{formatCurrency(4000)}</span>
                    </div>
                    <div className="flex justify-between p-2 bg-muted/50 rounded">
                      <span>24 meses (2,5%)</span>
                      <span className="font-medium">{formatCurrency(2500)}</span>
                    </div>
                    <div className="flex justify-between p-2 bg-muted/50 rounded">
                      <span>36 meses (2,5%)</span>
                      <span className="font-medium">{formatCurrency(2500)}</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <h4 className="font-medium">Parcelas (3x)</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between p-2 bg-muted/50 rounded">
                      <span>Comissão R$ 4.000 →</span>
                      <span className="font-medium">3x {formatCurrency(1333.33)}</span>
                    </div>
                    <div className="flex justify-between p-2 bg-muted/50 rounded">
                      <span>Comissão R$ 2.500 →</span>
                      <span className="font-medium">3x {formatCurrency(833.33)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}
