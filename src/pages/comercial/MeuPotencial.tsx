/**
 * Meu Potencial - Executive Earnings Dashboard
 * Shows real-time commission projections for level 700 executives
 */

import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { openApi } from '@/lib/openApi';
import { authService } from '@/services/authService';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  TrendingUp,
  TrendingDown,
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
  totalMensal: number;
  vigenciaMeses: number;
  dataAprovacao: string;
  taxaComissao: number;
  comissaoBruta: number;
  comissaoFinal: number;
  capAplicado: boolean;
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
// CONSTANTS
// ============================================

const COMMISSION_RATES = {
  SHORT_TERM: 0.04, // 12 months = 4%
  LONG_TERM: 0.025, // 24/36/48 months = 2.5%
};

const MAX_COMMISSION_CAP = 20000;
const MAX_COMMISSIONABLE_MONTHS = 12;
const INSTALLMENT_COUNT = 3;
const HIGH_RISK_DAYS = 7;

// ============================================
// UTILITY FUNCTIONS
// ============================================

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('pt-BR');
}

function getCommissionRate(vigenciaMeses: number): number {
  return vigenciaMeses === 12 ? COMMISSION_RATES.SHORT_TERM : COMMISSION_RATES.LONG_TERM;
}

function calculateCommission(totalMensal: number, vigenciaMeses: number): {
  comissaoBruta: number;
  comissaoFinal: number;
  capAplicado: boolean;
} {
  const taxa = getCommissionRate(vigenciaMeses);
  const mesesComissionaveis = Math.min(vigenciaMeses, MAX_COMMISSIONABLE_MONTHS);
  const comissaoBruta = totalMensal * mesesComissionaveis * taxa;
  const comissaoFinal = Math.min(comissaoBruta, MAX_COMMISSION_CAP);
  
  return {
    comissaoBruta,
    comissaoFinal,
    capAplicado: comissaoBruta > MAX_COMMISSION_CAP,
  };
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
  const now = new Date();
  
  propostas.forEach((proposta) => {
    if (proposta.dadosIncompletos) return;
    
    const valorParcela = proposta.comissaoFinal / INSTALLMENT_COUNT;
    const baseDate = new Date(proposta.dataAprovacao);
    
    for (let i = 0; i < INSTALLMENT_COUNT; i++) {
      const paymentDate = new Date(baseDate);
      paymentDate.setMonth(paymentDate.getMonth() + i + 1); // First payment next month
      
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
  
  // Sort by date and limit to next 12 months
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
        // Get current user
        const user = await openApi.getCurrentUser();
        
        if (!mounted) return;
        
        if (!user || user.level !== 700) {
          toast.error('Acesso restrito a Executivos');
          navigate('/login', { replace: true });
          return;
        }
        
        setUserId(user.id);
        
        // Fetch proposals
        const response = await openApi.getProposals({
          __perPage: 500,
        });
        
        if (!mounted) return;
        
        const allProposals = (response.data || []) as ApiProposal[];
        
        // Filter: only approved proposals created by this user
        const filteredProposals = allProposals.filter((p) => {
          const isApproved = p.status?.toLowerCase() === 'aprovado' || 
                            p.status?.toLowerCase() === 'a' ||
                            p.status === 'A';
          const isOwnProposal = p.created_by === user.id;
          
          return isApproved && isOwnProposal;
        });
        
        // Process proposals
        const processed: ProcessedProposal[] = filteredProposals.map((p) => {
          const totalMensal = p.dados_proposta?.totals?.totalMensal || p.total || 0;
          const vigenciaMeses = p.dados_proposta?.config?.vigencia || p.contract_duration || 12;
          const cliente = p.dados_proposta?.cliente?.nome || p.name || 'Cliente não informado';
          const empresa = p.dados_proposta?.cliente?.empresa || p.company || '';
          const dataAprovacao = p.updated_at || p.created_at;
          
          // Check for incomplete data
          const dadosIncompletos = !totalMensal || !vigenciaMeses || !dataAprovacao;
          
          const { comissaoBruta, comissaoFinal, capAplicado } = calculateCommission(
            totalMensal,
            vigenciaMeses
          );
          
          return {
            id: p.id,
            cliente,
            empresa,
            totalMensal,
            vigenciaMeses,
            dataAprovacao,
            taxaComissao: getCommissionRate(vigenciaMeses) * 100,
            comissaoBruta,
            comissaoFinal,
            capAplicado,
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
    
    const previsaoGanho = propostasValidas.reduce((sum, p) => sum + p.comissaoFinal, 0);
    
    const emRisco = propostasValidas
      .filter((p) => p.risco === 'ALTO' || p.risco === 'MEDIO')
      .reduce((sum, p) => sum + p.comissaoFinal, 0);
    
    const ativo = propostasValidas
      .filter((p) => p.risco === 'BAIXO')
      .reduce((sum, p) => sum + p.comissaoFinal, 0);
    
    const capAplicadoTotal = propostasValidas
      .filter((p) => p.capAplicado)
      .reduce((sum, p) => sum + (p.comissaoBruta - p.comissaoFinal), 0);
    
    const propostasComCap = propostasValidas.filter((p) => p.capAplicado).length;
    
    return {
      previsaoGanho,
      emRisco,
      ativo,
      capAplicadoTotal,
      propostasComCap,
      totalPropostas: propostasValidas.length,
      propostasIncompletas: propostas.filter((p) => p.dadosIncompletos).length,
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
            Acompanhe suas comissões e projeções de ganho em tempo real
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
            <CardTitle className="text-sm font-medium">Previsão de Ganho (12 meses)</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{formatCurrency(stats.previsaoGanho)}</div>
            <p className="text-xs text-muted-foreground">
              {stats.totalPropostas} proposta(s) aprovada(s)
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

      {/* B) MONEY FUNNEL */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Funil de Dinheiro
          </CardTitle>
          <CardDescription>Visualização do fluxo de comissões</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Bar: Approved */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="font-medium">Aprovadas</span>
                <span className="text-muted-foreground">
                  {formatCurrency(stats.previsaoGanho)} em comissões
                </span>
              </div>
              <div className="h-8 rounded-full bg-primary/20 relative overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full flex items-center justify-center text-xs font-medium text-primary-foreground"
                  style={{ width: '100%' }}
                >
                  {stats.totalPropostas} propostas
                </div>
              </div>
            </div>

            {/* Bar: Active (Low Risk) */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="font-medium">Ativas (Baixo Risco)</span>
                <span className="text-muted-foreground">{formatCurrency(stats.ativo)}</span>
              </div>
              <div className="h-8 rounded-full bg-green-500/20 relative overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full flex items-center justify-center text-xs font-medium text-white"
                  style={{
                    width: stats.previsaoGanho > 0 ? `${(stats.ativo / stats.previsaoGanho) * 100}%` : '0%',
                  }}
                >
                  {propostas.filter((p) => p.risco === 'BAIXO' && !p.dadosIncompletos).length} propostas
                </div>
              </div>
            </div>

            {/* Bar: At Risk */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="font-medium">Em Risco</span>
                <span className="text-muted-foreground">{formatCurrency(stats.emRisco)}</span>
              </div>
              <div className="h-8 rounded-full bg-yellow-500/20 relative overflow-hidden">
                <div
                  className="h-full bg-yellow-500 rounded-full flex items-center justify-center text-xs font-medium text-white"
                  style={{
                    width: stats.previsaoGanho > 0 ? `${(stats.emRisco / stats.previsaoGanho) * 100}%` : '0%',
                  }}
                >
                  {propostas.filter((p) => (p.risco === 'ALTO' || p.risco === 'MEDIO') && !p.dadosIncompletos).length} propostas
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* C) PROPOSALS TABLE */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Propostas Aprovadas
          </CardTitle>
          <CardDescription>Detalhamento das comissões por proposta</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Proposta</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="text-right">Total Mensal</TableHead>
                  <TableHead className="text-center">Vigência</TableHead>
                  <TableHead className="text-center">% Comissão</TableHead>
                  <TableHead className="text-right">Comissão Final</TableHead>
                  <TableHead className="text-center">Risco</TableHead>
                  <TableHead className="text-center">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {propostas.map((proposta) => (
                  <TableRow key={proposta.id} className={proposta.dadosIncompletos ? 'opacity-50' : ''}>
                    <TableCell className="font-medium">
                      #{proposta.id}
                      {proposta.capAplicado && (
                        <Badge variant="outline" className="ml-2 text-xs text-orange-600 border-orange-500/30">
                          CAP
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{proposta.cliente}</div>
                        {proposta.empresa && (
                          <div className="text-xs text-muted-foreground">{proposta.empresa}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {proposta.dadosIncompletos ? (
                        <span className="text-muted-foreground">-</span>
                      ) : (
                        formatCurrency(proposta.totalMensal)
                      )}
                    </TableCell>
                    <TableCell className="text-center">{proposta.vigenciaMeses} meses</TableCell>
                    <TableCell className="text-center">{proposta.taxaComissao.toFixed(1)}%</TableCell>
                    <TableCell className="text-right font-medium">
                      {proposta.dadosIncompletos ? (
                        <span className="text-muted-foreground">Dados incompletos</span>
                      ) : (
                        formatCurrency(proposta.comissaoFinal)
                      )}
                    </TableCell>
                    <TableCell className="text-center">{getRiskBadge(proposta.risco)}</TableCell>
                    <TableCell className="text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => window.open(`/proposta/${proposta.id}`, '_blank')}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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

      {/* E) QUICK SIMULATOR */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Simulador Rápido
          </CardTitle>
          <CardDescription>Veja quanto você pode ganhar fechando mais negócios</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="p-4 rounded-lg bg-background border">
              <p className="text-sm text-muted-foreground mb-2">Se você fechar mais</p>
              <p className="text-2xl font-bold text-foreground">R$ 5.000/mês</p>
              <p className="text-sm text-muted-foreground mt-2">Você ganha</p>
              <p className="text-xl font-bold text-primary">
                {formatCurrency(5000 * 12 * COMMISSION_RATES.SHORT_TERM)}
              </p>
              <p className="text-xs text-muted-foreground">em comissões (12 meses, 4%)</p>
            </div>

            <div className="p-4 rounded-lg bg-background border">
              <p className="text-sm text-muted-foreground mb-2">Se você fechar mais</p>
              <p className="text-2xl font-bold text-foreground">R$ 10.000/mês</p>
              <p className="text-sm text-muted-foreground mt-2">Você ganha</p>
              <p className="text-xl font-bold text-primary">
                {formatCurrency(10000 * 12 * COMMISSION_RATES.SHORT_TERM)}
              </p>
              <p className="text-xs text-muted-foreground">em comissões (12 meses, 4%)</p>
            </div>

            <div className="p-4 rounded-lg bg-background border">
              <p className="text-sm text-muted-foreground mb-2">Se você fechar mais</p>
              <p className="text-2xl font-bold text-foreground">R$ 20.000/mês</p>
              <p className="text-sm text-muted-foreground mt-2">Você ganha</p>
              <p className="text-xl font-bold text-primary">
                {formatCurrency(Math.min(20000 * 12 * COMMISSION_RATES.SHORT_TERM, MAX_COMMISSION_CAP))}
              </p>
              <p className="text-xs text-muted-foreground">em comissões (CAP aplicado)</p>
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
