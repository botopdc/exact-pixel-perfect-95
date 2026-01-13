/**
 * Meu Potencial - Executive Earnings Dashboard
 * OPEN 2026 Commission Policy
 * 
 * ============================================
 * REGRAS IMPLEMENTADAS:
 * ============================================
 * 
 * 1️⃣ PERCENTUAL:
 * - <= 12 meses: 4%
 * - > 12 meses: 2.5%
 * 
 * 2️⃣ MESES COMISSIONÁVEIS:
 * - <= 12: prazo real
 * - > 12: 18 (CAP)
 * 
 * 3️⃣ CAP FINANCEIRO (POR FAIXA DE TICKET MENSAL):
 * - Até R$ 50.000/mês → CAP R$ 20.000
 * - De R$ 50.001 até R$ 100.000/mês → CAP R$ 80.000
 * - Acima de R$ 100.000/mês → CAP R$ 100.000
 * 
 * 4️⃣ FÓRMULA:
 * gross = monthly × months × rate
 * final = min(gross, cap)
 * installment = final / 3
 * 
 * 5️⃣ SOMENTE status = APPROVED
 */

import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { openApi } from '@/lib/openApi';
import { authService } from '@/services/authService';
import { normalizeStatus } from '@/hooks/useProposals';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
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
  total: number;
  contract_duration: number;
  status?: string;
  channel_type?: string;
  created_by?: number;
  created_at: string;
  updated_at: string;
  dados_proposta?: {
    cliente?: {
      nome?: string;
      empresa?: string;
    };
    config?: {
      vigencia?: number;
    };
    totals?: {
      totalMensal?: number;
    };
  };
}

interface ProcessedProposal {
  id: number;
  cliente: string;
  empresa: string;
  // v2 fields
  monthly_value: number;
  contract_term_months: number;
  tcv: number; // Total Contract Value
  months_commissioned: number;
  commission_rate: number;
  gross_commission: number;
  cap: number;
  final_commission: number;
  monthly_installment: number;
  cap_applied: boolean;
  // UI fields
  dataAprovacao: string;
  risco: 'BAIXO' | 'MEDIO' | 'ALTO';
  dadosIncompletos: boolean;
}

interface PaymentMonth {
  mes: string;
  total: number;
  parcelas: number;
  detalhes: Array<{
    propostaId: number;
    cliente: string;
    parcela: number;
    valor: number;
  }>;
}

// ============================================
// CONSTANTS - OPEN v2
// ============================================

const COMMISSION_RATES = {
  SHORT_TERM: 0.04, // <= 12 months = 4%
  LONG_TERM: 0.025, // > 12 months = 2.5%
};

const INSTALLMENT_COUNT = 3;
const HIGH_RISK_DAYS = 7;

// ============================================
// CAP CONSTANTS - OPEN 2026 (BY MONTHLY TICKET)
// ============================================

// Faixas de CAP por ticket mensal
const CAP_FAIXA_1 = 50000;   // Até R$ 50.000/mês
const CAP_FAIXA_2 = 100000;  // Até R$ 100.000/mês
const CAP_VALOR_1 = 20000;   // CAP R$ 20.000
const CAP_VALOR_2 = 80000;   // CAP R$ 80.000
const CAP_VALOR_3 = 100000;  // CAP R$ 100.000

// ============================================
// OPEN v2 CALCULATION FUNCTIONS
// ============================================

/**
 * Get commission rate
 * RULE: <= 12 months = 4%, > 12 months = 2.5%
 */
function getCommissionRate(term: number): number {
  return term <= 12 ? COMMISSION_RATES.SHORT_TERM : COMMISSION_RATES.LONG_TERM;
}

/**
 * Get months commissioned
 * RULE: <= 12 = term, > 12 = 18
 */
function getMonthsCommissioned(term: number): number {
  return term <= 12 ? term : 18;
}

/**
 * Get CAP based on monthly ticket - OPEN 2026
 * - Até R$ 50.000/mês → CAP R$ 20.000
 * - De R$ 50.001 até R$ 100.000/mês → CAP R$ 80.000
 * - Acima de R$ 100.000/mês → CAP R$ 100.000
 */
function getCapByTicket(monthlyValue: number): number {
  if (monthlyValue <= CAP_FAIXA_1) {
    return CAP_VALOR_1;
  } else if (monthlyValue <= CAP_FAIXA_2) {
    return CAP_VALOR_2;
  } else {
    return CAP_VALOR_3;
  }
}

/**
 * Calculate commission with ticket-based CAP - OPEN 2026
 */
function calculateCommissionV2(monthlyValue: number, term: number): {
  tcv: number;
  months_commissioned: number;
  commission_rate: number;
  gross_commission: number;
  cap: number;
  final_commission: number;
  monthly_installment: number;
  cap_applied: boolean;
} {
  const tcv = monthlyValue * term;
  const commission_rate = getCommissionRate(term);
  const months_commissioned = getMonthsCommissioned(term);
  const gross_commission = monthlyValue * months_commissioned * commission_rate;
  const cap = getCapByTicket(monthlyValue); // OPEN 2026 - CAP por faixa de ticket
  const final_commission = Math.min(gross_commission, cap);
  const cap_applied = gross_commission > cap;
  const monthly_installment = final_commission / INSTALLMENT_COUNT;
  
  // Validation: log CAP_VIOLATION if commission exceeds cap
  if (final_commission > cap) {
    console.error('[MeuPotencial] CAP_VIOLATION: final_commission exceeds cap!', {
      final_commission,
      cap,
      monthlyValue,
      term,
    });
  }
  
  return {
    tcv,
    months_commissioned,
    commission_rate,
    gross_commission,
    cap,
    final_commission,
    monthly_installment,
    cap_applied,
  };
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

function getRisk(dataAprovacao: string): 'BAIXO' | 'MEDIO' | 'ALTO' {
  const diasDesdeAprovacao = Math.floor(
    (Date.now() - new Date(dataAprovacao).getTime()) / (1000 * 60 * 60 * 24)
  );
  
  if (diasDesdeAprovacao > HIGH_RISK_DAYS) return 'ALTO';
  if (diasDesdeAprovacao <= HIGH_RISK_DAYS) return 'MEDIO';
  return 'BAIXO';
}

function getRiskBadge(risco: 'BAIXO' | 'MEDIO' | 'ALTO') {
  switch (risco) {
    case 'BAIXO':
      return <Badge className="bg-green-500/20 text-green-600 border-green-500/30">🟢 Baixo</Badge>;
    case 'MEDIO':
      return <Badge className="bg-yellow-500/20 text-yellow-600 border-yellow-500/30">🟡 Médio</Badge>;
    case 'ALTO':
      return <Badge className="bg-red-500/20 text-red-600 border-red-500/30">🔴 Alto</Badge>;
  }
}

function generatePaymentSchedule(propostas: ProcessedProposal[]): PaymentMonth[] {
  const schedule: Map<string, PaymentMonth> = new Map();
  
  propostas.forEach((proposta) => {
    if (proposta.dadosIncompletos) return;
    
    const valorParcela = proposta.monthly_installment;
    const baseDate = new Date(proposta.dataAprovacao);
    
    for (let i = 0; i < INSTALLMENT_COUNT; i++) {
      const paymentDate = new Date(baseDate);
      paymentDate.setMonth(paymentDate.getMonth() + i + 1);
      
      const mesKey = `${paymentDate.getFullYear()}-${String(paymentDate.getMonth() + 1).padStart(2, '0')}`;
      const mesLabel = paymentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
      
      if (!schedule.has(mesKey)) {
        schedule.set(mesKey, {
          mes: mesLabel.charAt(0).toUpperCase() + mesLabel.slice(1),
          total: 0,
          parcelas: 0,
          detalhes: [],
        });
      }
      
      const month = schedule.get(mesKey)!;
      month.total += valorParcela;
      month.parcelas += 1;
      month.detalhes.push({
        propostaId: proposta.id,
        cliente: proposta.cliente,
        parcela: i + 1,
        valor: valorParcela,
      });
    }
  });
  
  return Array.from(schedule.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(0, 12)
    .map(([, value]) => value);
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
          const isOwnProposal = p.created_by === user.id;
          
          return isApproved && isOwnProposal;
        });
        
        // Process with v2 rules
        const processed: ProcessedProposal[] = filteredProposals.map((p) => {
          const monthly_value = p.dados_proposta?.totals?.totalMensal || p.total || 0;
          const contract_term_months = p.dados_proposta?.config?.vigencia || p.contract_duration || 12;
          const cliente = p.dados_proposta?.cliente?.nome || p.name || 'Cliente não informado';
          const empresa = p.dados_proposta?.cliente?.empresa || p.company || '';
          const dataAprovacao = p.updated_at || p.created_at;
          
          const dadosIncompletos = !monthly_value || !contract_term_months || !dataAprovacao;
          
          // Calculate using v2 rules
          const commission = calculateCommissionV2(monthly_value, contract_term_months);
          
          return {
            id: p.id,
            cliente,
            empresa,
            monthly_value,
            contract_term_months,
            ...commission,
            dataAprovacao,
            risco: dadosIncompletos ? 'ALTO' : getRisk(dataAprovacao),
            dadosIncompletos,
          };
        });
        
        setPropostas(processed);
        setError(null);
      } catch (err: any) {
        const status = err?.response?.status;
        if (status === 401 || status === 403) {
          authService.logout();
          toast.error('Sessão expirada. Faça login novamente.');
          navigate('/login', { replace: true });
          return;
        }
        setError('Erro ao carregar dados. Tente novamente.');
        console.error('[MeuPotencial] Error:', err);
      } finally {
        if (mounted) setLoading(false);
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
    const propostasValidas = propostas.filter((p) => !p.dadosIncompletos);
    
    const totalContratos = propostasValidas.length;
    const totalMensalContratado = propostasValidas.reduce((sum, p) => sum + p.monthly_value, 0);
    const comissaoProjetada = propostasValidas.reduce((sum, p) => sum + p.final_commission, 0);
    
    const emRisco = propostasValidas
      .filter((p) => p.risco === 'ALTO' || p.risco === 'MEDIO')
      .reduce((sum, p) => sum + p.final_commission, 0);
    
    const ativo = propostasValidas
      .filter((p) => p.risco === 'BAIXO')
      .reduce((sum, p) => sum + p.final_commission, 0);
    
    const capAplicadoTotal = propostasValidas
      .filter((p) => p.cap_applied)
      .reduce((sum, p) => sum + (p.gross_commission - p.final_commission), 0);
    
    const propostasComCap = propostasValidas.filter((p) => p.cap_applied).length;
    
    // Próximas 3 parcelas
    const now = new Date();
    const next3Months: number[] = [];
    for (let i = 1; i <= 3; i++) {
      const monthDate = new Date(now);
      monthDate.setMonth(monthDate.getMonth() + i);
      next3Months.push(0);
    }
    
    propostasValidas.forEach(p => {
      const baseDate = new Date(p.dataAprovacao);
      for (let i = 0; i < 3; i++) {
        const payDate = new Date(baseDate);
        payDate.setMonth(payDate.getMonth() + i + 1);
        
        const monthsFromNow = (payDate.getFullYear() - now.getFullYear()) * 12 + 
          (payDate.getMonth() - now.getMonth());
        
        if (monthsFromNow >= 1 && monthsFromNow <= 3) {
          next3Months[monthsFromNow - 1] += p.monthly_installment;
        }
      }
    });
    
    return {
      totalContratos,
      totalMensalContratado,
      comissaoProjetada,
      emRisco,
      ativo,
      capAplicadoTotal,
      propostasComCap,
      propostasIncompletas: propostas.filter((p) => p.dadosIncompletos).length,
      proximas3Parcelas: next3Months,
    };
  }, [propostas]);

  const paymentSchedule = useMemo(() => generatePaymentSchedule(propostas), [propostas]);

  // ============================================
  // RENDER
  // ============================================

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-4">
        <AlertTriangle className="h-12 w-12 text-destructive" />
        <p className="text-lg text-muted-foreground">{error}</p>
        <Button onClick={() => window.location.reload()}>Tentar novamente</Button>
      </div>
    );
  }

  if (propostas.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-4">
        <Target className="h-16 w-16 text-muted-foreground/50" />
        <h2 className="text-xl font-semibold text-muted-foreground">
          Nenhuma proposta aprovada ainda
        </h2>
        <p className="text-sm text-muted-foreground text-center max-w-md">
          Suas propostas aprovadas aparecerão aqui com projeções de comissão em tempo real.
        </p>
        <Button onClick={() => navigate('/executivo/calculadora')}>
          <Calculator className="mr-2 h-4 w-4" />
          Criar Proposta
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Meu Potencial</h1>
          <p className="text-sm text-muted-foreground">
            Política de Comissão OPEN 2026 - Acompanhe suas comissões em tempo real
          </p>
        </div>
      </div>

      {/* Stats Warning */}
      {stats.propostasIncompletas > 0 && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <span className="text-sm text-yellow-600">
            {stats.propostasIncompletas} proposta(s) com dados incompletos não foram incluídas nos cálculos.
          </span>
        </div>
      )}

      {/* A) TOP CARDS */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Comissão Total Projetada</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{formatCurrency(stats.comissaoProjetada)}</div>
            <p className="text-xs text-muted-foreground">
              {stats.totalContratos} contrato(s) aprovado(s)
            </p>
          </CardContent>
        </Card>

        <Card className="border-yellow-500/30 bg-yellow-500/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Em Risco</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{formatCurrency(stats.emRisco)}</div>
            <p className="text-xs text-muted-foreground">Risco médio ou alto</p>
          </CardContent>
        </Card>

        <Card className="border-green-500/30 bg-green-500/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ativo</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(stats.ativo)}</div>
            <p className="text-xs text-muted-foreground">Baixo risco</p>
          </CardContent>
        </Card>

        <Card className="border-orange-500/30 bg-orange-500/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CAP Aplicado</CardTitle>
            <DollarSign className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{formatCurrency(stats.capAplicadoTotal)}</div>
            <p className="text-xs text-muted-foreground">
              {stats.propostasComCap} proposta(s) com limite
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Próximas 3 Parcelas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Próximas 3 Parcelas
          </CardTitle>
          <CardDescription>Previsão de recebimento dos próximos 3 meses</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {stats.proximas3Parcelas.map((valor, i) => {
              const date = new Date();
              date.setMonth(date.getMonth() + i + 1);
              const mesLabel = date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
              
              return (
                <div key={i} className="p-4 rounded-lg bg-muted/50 border">
                  <p className="text-sm text-muted-foreground capitalize">{mesLabel}</p>
                  <p className="text-xl font-bold text-foreground">{formatCurrency(valor)}</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* B) MONEY FUNNEL */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Resumo Financeiro
          </CardTitle>
          <CardDescription>Total mensal contratado e comissão projetada</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="font-medium">Total Mensal Contratado</span>
                <span className="text-muted-foreground">{formatCurrency(stats.totalMensalContratado)}</span>
              </div>
              <div className="h-8 rounded-full bg-primary/20 relative overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full flex items-center justify-center text-xs font-medium text-primary-foreground"
                  style={{ width: '100%' }}
                >
                  {stats.totalContratos} contratos
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="font-medium">Comissão Final (após CAP)</span>
                <span className="text-muted-foreground">{formatCurrency(stats.comissaoProjetada)}</span>
              </div>
              <div className="h-8 rounded-full bg-green-500/20 relative overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full flex items-center justify-center text-xs font-medium text-white"
                  style={{ 
                    width: stats.totalMensalContratado > 0 
                      ? `${Math.min((stats.comissaoProjetada / (stats.totalMensalContratado * 0.1)) * 100, 100)}%` 
                      : '0%' 
                  }}
                >
                  {formatCurrency(stats.comissaoProjetada)}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* C) PROPOSALS TABLE - V2 COLUMNS */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Propostas Aprovadas
          </CardTitle>
          <CardDescription>
            Detalhamento completo com regras OPEN 2026 — CAP por faixa de ticket mensal
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <TooltipProvider>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-right">Valor Mensal</TableHead>
                    <TableHead className="text-right">TCV</TableHead>
                    <TableHead className="text-center">Prazo</TableHead>
                    <TableHead className="text-center">Meses Com.</TableHead>
                    <TableHead className="text-center">Taxa</TableHead>
                    <TableHead className="text-right">Comissão Bruta</TableHead>
                    <TableHead className="text-right">
                      <Tooltip>
                        <TooltipTrigger className="cursor-help underline decoration-dotted">
                          CAP
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <div className="text-xs space-y-1">
                            <p className="font-medium">CAP por Faixa de Ticket Mensal:</p>
                            <p>• Até R$ 50.000/mês → CAP R$ 20.000</p>
                            <p>• R$ 50.001 a R$ 100.000/mês → CAP R$ 80.000</p>
                            <p>• Acima de R$ 100.000/mês → CAP R$ 100.000</p>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TableHead>
                    <TableHead className="text-right">Comissão Final</TableHead>
                    <TableHead className="text-right">Parcela</TableHead>
                    <TableHead className="text-center">Risco</TableHead>
                    <TableHead className="text-center">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {propostas.map((p) => (
                    <TableRow key={p.id} className={p.dadosIncompletos ? 'opacity-50' : ''}>
                      <TableCell className="font-medium">
                        #{p.id}
                        {p.cap_applied && (
                          <Tooltip>
                            <TooltipTrigger>
                              <Badge variant="outline" className="ml-2 text-xs text-orange-600 border-orange-500/30">
                                CAP
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <div className="text-xs space-y-1">
                                <p className="font-medium">CAP aplicado por faixa de ticket:</p>
                                <p>Valor mensal: {formatCurrency(p.monthly_value)}</p>
                                <p>CAP: {formatCurrency(p.cap)}</p>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{p.cliente}</div>
                          {p.empresa && (
                            <div className="text-xs text-muted-foreground">{p.empresa}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {p.dadosIncompletos ? '-' : formatCurrency(p.monthly_value)}
                      </TableCell>
                      <TableCell className="text-right">
                        {p.dadosIncompletos ? '-' : formatCurrency(p.tcv)}
                      </TableCell>
                      <TableCell className="text-center">{p.contract_term_months}m</TableCell>
                      <TableCell className="text-center">{p.months_commissioned}m</TableCell>
                      <TableCell className="text-center">{(p.commission_rate * 100).toFixed(1)}%</TableCell>
                      <TableCell className="text-right">
                        {p.dadosIncompletos ? '-' : formatCurrency(p.gross_commission)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        <Tooltip>
                          <TooltipTrigger className="cursor-help">
                            {formatCurrency(p.cap)}
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <div className="text-xs space-y-1">
                              <p className="font-medium">Regra CAP por faixa:</p>
                              <p>Valor mensal: {formatCurrency(p.monthly_value)}</p>
                              {p.monthly_value <= 50000 && <p>Faixa: Até R$ 50.000/mês → CAP R$ 20.000</p>}
                              {p.monthly_value > 50000 && p.monthly_value <= 100000 && <p>Faixa: R$ 50.001 a R$ 100.000/mês → CAP R$ 80.000</p>}
                              {p.monthly_value > 100000 && <p>Faixa: Acima de R$ 100.000/mês → CAP R$ 100.000</p>}
                              <p className="font-medium pt-1">CAP: {formatCurrency(p.cap)}</p>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TableCell>
                      <TableCell className="text-right font-medium text-green-600">
                        {p.dadosIncompletos ? 'Dados incompletos' : formatCurrency(p.final_commission)}
                      </TableCell>
                      <TableCell className="text-right">
                        {p.dadosIncompletos ? '-' : formatCurrency(p.monthly_installment)}
                      </TableCell>
                      <TableCell className="text-center">{getRiskBadge(p.risco)}</TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => window.open(`/proposta/${p.id}`, '_blank')}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TooltipProvider>
          </div>
        </CardContent>
      </Card>

      {/* D) PAYMENT FORECAST */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Previsão de Pagamento
          </CardTitle>
          <CardDescription>Projeção de recebimentos nos próximos 12 meses</CardDescription>
        </CardHeader>
        <CardContent>
          {paymentSchedule.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhum pagamento previsto ainda.
            </p>
          ) : (
            <div className="space-y-2">
              {paymentSchedule.map((month, index) => (
                <Collapsible key={index}>
                  <CollapsibleTrigger asChild>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted cursor-pointer transition-colors">
                      <div className="flex items-center gap-3">
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{month.mes}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <Badge variant="outline" className="text-xs">
                          {month.parcelas} parcela(s)
                        </Badge>
                        <span className="font-bold text-primary">{formatCurrency(month.total)}</span>
                      </div>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="ml-8 mt-2 space-y-1">
                      {month.detalhes.map((detalhe, i) => (
                        <div key={i} className="flex justify-between text-sm py-1 px-3 rounded bg-background">
                          <span className="text-muted-foreground">
                            #{detalhe.propostaId} - {detalhe.cliente} (Parcela {detalhe.parcela}/3)
                          </span>
                          <span>{formatCurrency(detalhe.valor)}</span>
                        </div>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* E) QUICK SIMULATOR - V2 RULES */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Simulador Rápido (OPEN v2)
          </CardTitle>
          <CardDescription>Veja quanto você pode ganhar fechando mais negócios</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {/* R$ 5k - CAP R$ 20k */}
            <div className="p-4 rounded-lg bg-background border">
              <p className="text-sm text-muted-foreground mb-2">Se você fechar mais</p>
              <p className="text-2xl font-bold text-foreground">R$ 5.000/mês</p>
              <p className="text-sm text-muted-foreground mt-2">Você ganha</p>
              <p className="text-xl font-bold text-primary">
                {formatCurrency(Math.min(5000 * 12 * 0.04, 20000))}
              </p>
              <p className="text-xs text-muted-foreground">12m × 4% | CAP R$ 20k</p>
            </div>

            {/* R$ 30k - CAP R$ 20k */}
            <div className="p-4 rounded-lg bg-background border">
              <p className="text-sm text-muted-foreground mb-2">Se você fechar mais</p>
              <p className="text-2xl font-bold text-foreground">R$ 30.000/mês</p>
              <p className="text-sm text-muted-foreground mt-2">Você ganha</p>
              <p className="text-xl font-bold text-primary">
                {formatCurrency(Math.min(30000 * 12 * 0.04, 20000))}
              </p>
              <p className="text-xs text-muted-foreground">12m × 4% | CAP R$ 20k aplicado</p>
            </div>

            {/* R$ 80k - CAP R$ 35k */}
            <div className="p-4 rounded-lg bg-background border">
              <p className="text-sm text-muted-foreground mb-2">Se você fechar mais</p>
              <p className="text-2xl font-bold text-foreground">R$ 80.000/mês</p>
              <p className="text-sm text-muted-foreground mt-2">Você ganha</p>
              <p className="text-xl font-bold text-primary">
                {formatCurrency(Math.min(80000 * 12 * 0.04, 35000))}
              </p>
              <p className="text-xs text-muted-foreground">12m × 4% | CAP R$ 35k aplicado</p>
            </div>
          </div>

          <div className="mt-4 text-center">
            <Button onClick={() => navigate('/executivo/calculadora')}>
              <Calculator className="mr-2 h-4 w-4" />
              Criar Nova Proposta
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
