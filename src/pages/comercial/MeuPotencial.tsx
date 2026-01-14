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
import { authService } from '@/services/authService';
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
        
        // Process with v3 rules (NO CAP)
        const processed: ProcessedProposal[] = filteredProposals.map((p) => {
          // TCV = campo "total" da proposta
          const tcv = p.total || 0;
          const contract_term_months = p.dados_proposta?.config?.vigencia || p.contract_duration || 12;
          const cliente = p.dados_proposta?.cliente?.nome || p.name || 'Cliente não informado';
          const empresa = p.dados_proposta?.cliente?.empresa || p.company || '';
          const dataAprovacao = p.updated_at || p.created_at;
          
          const dadosIncompletos = !tcv || !contract_term_months || !dataAprovacao;
          
          // Calculate commission (NO CAP)
          const commission_rate = computeCommissionPct(contract_term_months);
          const commission_value = computeCommissionValue(tcv, contract_term_months);
          const installments = computeInstallments(commission_value);
          const is_standard = isStandardDuration(contract_term_months);
          
          return {
            id: p.id,
            cliente,
            empresa,
            tcv,
            contract_term_months,
            commission_rate,
            commission_value,
            p1: installments.p1,
            p2: installments.p2,
            p3: installments.p3,
            is_standard_duration: is_standard,
            dataAprovacao,
            dadosIncompletos,
          };
        });
        
        // Ordenar por maior comissão
        processed.sort((a, b) => b.commission_value - a.commission_value);
        
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
    const totalTcv = propostasValidas.reduce((sum, p) => sum + p.tcv, 0);
    const comissaoTotal = propostasValidas.reduce((sum, p) => sum + p.commission_value, 0);
    
    // Taxa média ponderada por TCV
    const taxaMediaPonderada = totalTcv > 0
      ? propostasValidas.reduce((sum, p) => sum + (p.commission_rate * p.tcv), 0) / totalTcv
      : 0;
    
    // Próximas 3 parcelas (soma de todas as parcelas por posição)
    const parcela1 = propostasValidas.reduce((sum, p) => sum + p.p1, 0);
    const parcela2 = propostasValidas.reduce((sum, p) => sum + p.p2, 0);
    const parcela3 = propostasValidas.reduce((sum, p) => sum + p.p3, 0);
    
    return {
      totalContratos,
      totalTcv,
      comissaoTotal,
      taxaMediaPonderada,
      parcela1,
      parcela2,
      parcela3,
      propostasIncompletas: propostas.filter((p) => p.dadosIncompletos).length,
    };
  }, [propostas]);

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
            Acompanhe suas comissões em tempo real
          </p>
        </div>
      </div>

      {/* Policy Summary */}
      <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
        <div className="flex items-center gap-2 mb-2">
          <FileText className="h-4 w-4 text-primary" />
          <span className="font-medium text-primary">Comissões — Política OPEN 2026</span>
        </div>
        <p className="text-sm text-muted-foreground">
          Comissão: 1/12m = 4% do TCV | 24/36/48m = 2,5% do TCV | Pagamento em 3x
        </p>
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

      {/* A) TOP CARDS - NO CAP */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Comissão Total Projetada */}
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Comissão Total Projetada</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{formatCurrency(stats.comissaoTotal)}</div>
            <p className="text-xs text-muted-foreground">
              Soma das comissões de todas as propostas
            </p>
          </CardContent>
        </Card>

        {/* Card 2: TCV Total */}
        <Card className="border-blue-500/30 bg-blue-500/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">TCV Total</CardTitle>
            <DollarSign className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{formatCurrency(stats.totalTcv)}</div>
            <p className="text-xs text-muted-foreground">Valor total dos contratos</p>
          </CardContent>
        </Card>

        {/* Card 3: Total de Contratos */}
        <Card className="border-green-500/30 bg-green-500/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Contratos</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.totalContratos}</div>
            <p className="text-xs text-muted-foreground">Propostas aprovadas</p>
          </CardContent>
        </Card>

        {/* Card 4: Taxa Média */}
        <Card className="border-purple-500/30 bg-purple-500/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa Média</CardTitle>
            <Percent className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {(stats.taxaMediaPonderada * 100).toFixed(2)}%
            </div>
            <p className="text-xs text-muted-foreground">Média ponderada por TCV</p>
          </CardContent>
        </Card>
      </div>

      {/* B) Próximas 3 Parcelas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Próximas 3 Parcelas
          </CardTitle>
          <CardDescription>Pagamento da comissão em 3x</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="p-4 rounded-lg bg-muted/50 border">
              <p className="text-sm text-muted-foreground">Parcela 1</p>
              <p className="text-xl font-bold text-foreground">{formatCurrency(stats.parcela1)}</p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50 border">
              <p className="text-sm text-muted-foreground">Parcela 2</p>
              <p className="text-xl font-bold text-foreground">{formatCurrency(stats.parcela2)}</p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50 border">
              <p className="text-sm text-muted-foreground">Parcela 3</p>
              <p className="text-xl font-bold text-foreground">{formatCurrency(stats.parcela3)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* C) Resumo Financeiro - NO CAP */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Resumo Financeiro
          </CardTitle>
          <CardDescription>TCV total e comissão projetada</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="font-medium">TCV Total</span>
                <span className="text-muted-foreground">{formatCurrency(stats.totalTcv)}</span>
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
                <span className="font-medium">Comissão Total</span>
                <span className="text-muted-foreground">{formatCurrency(stats.comissaoTotal)}</span>
              </div>
              <div className="h-8 rounded-full bg-green-500/20 relative overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full flex items-center justify-center text-xs font-medium text-white"
                  style={{ 
                    width: stats.totalTcv > 0 
                      ? `${Math.min((stats.comissaoTotal / (stats.totalTcv * 0.05)) * 100, 100)}%` 
                      : '0%' 
                  }}
                >
                  {formatCurrency(stats.comissaoTotal)}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* D) Comissões por Proposta - NEW TABLE */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Comissões por Proposta
          </CardTitle>
          <CardDescription>
            Detalhamento por proposta — ordenado por maior comissão
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente/Empresa</TableHead>
                  <TableHead className="text-center">Duração</TableHead>
                  <TableHead className="text-right">TCV</TableHead>
                  <TableHead className="text-center">% Comissão</TableHead>
                  <TableHead className="text-right">Comissão (R$)</TableHead>
                  <TableHead className="text-right">Parcela 1</TableHead>
                  <TableHead className="text-right">Parcela 2</TableHead>
                  <TableHead className="text-right">Parcela 3</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-center">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {propostas.map((p) => (
                  <TableRow key={p.id} className={p.dadosIncompletos ? 'opacity-50' : ''}>
                    <TableCell>
                      <div>
                        <div className="font-medium flex items-center gap-2">
                          {p.cliente}
                          {!p.is_standard_duration && (
                            <Badge variant="outline" className="text-xs text-yellow-600 border-yellow-500/30">
                              Duração não padrão
                            </Badge>
                          )}
                        </div>
                        {p.empresa && (
                          <div className="text-xs text-muted-foreground">{p.empresa}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">{p.contract_term_months}m</TableCell>
                    <TableCell className="text-right">
                      {p.dadosIncompletos ? '-' : formatCurrency(p.tcv)}
                    </TableCell>
                    <TableCell className="text-center">
                      {(p.commission_rate * 100).toFixed(1)}%
                    </TableCell>
                    <TableCell className="text-right font-medium text-green-600">
                      {p.dadosIncompletos ? 'Dados incompletos' : formatCurrency(p.commission_value)}
                    </TableCell>
                    <TableCell className="text-right">
                      {p.dadosIncompletos ? '-' : formatCurrency(p.p1)}
                    </TableCell>
                    <TableCell className="text-right">
                      {p.dadosIncompletos ? '-' : formatCurrency(p.p2)}
                    </TableCell>
                    <TableCell className="text-right">
                      {p.dadosIncompletos ? '-' : formatCurrency(p.p3)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className="bg-green-500/20 text-green-600 border-green-500/30">
                        Aprovada
                      </Badge>
                    </TableCell>
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
          </div>
        </CardContent>
      </Card>

      {/* E) QUICK SIMULATOR - V3 RULES (NO CAP) */}
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
            {/* TCV R$ 100k - 12m */}
            <div className="p-4 rounded-lg bg-background border">
              <p className="text-sm text-muted-foreground mb-2">Se você fechar</p>
              <p className="text-2xl font-bold text-foreground">TCV R$ 100.000</p>
              <p className="text-xs text-muted-foreground mb-2">12 meses</p>
              <p className="text-sm text-muted-foreground mt-2">Você ganha</p>
              <p className="text-xl font-bold text-primary">
                {formatCurrency(100000 * 0.04)}
              </p>
              <p className="text-xs text-muted-foreground">4% do TCV | 3x de {formatCurrency(100000 * 0.04 / 3)}</p>
            </div>

            {/* TCV R$ 100k - 24m */}
            <div className="p-4 rounded-lg bg-background border">
              <p className="text-sm text-muted-foreground mb-2">Se você fechar</p>
              <p className="text-2xl font-bold text-foreground">TCV R$ 100.000</p>
              <p className="text-xs text-muted-foreground mb-2">24 meses</p>
              <p className="text-sm text-muted-foreground mt-2">Você ganha</p>
              <p className="text-xl font-bold text-primary">
                {formatCurrency(100000 * 0.025)}
              </p>
              <p className="text-xs text-muted-foreground">2,5% do TCV | 3x de {formatCurrency(100000 * 0.025 / 3)}</p>
            </div>

            {/* TCV R$ 500k - 36m */}
            <div className="p-4 rounded-lg bg-background border">
              <p className="text-sm text-muted-foreground mb-2">Se você fechar</p>
              <p className="text-2xl font-bold text-foreground">TCV R$ 500.000</p>
              <p className="text-xs text-muted-foreground mb-2">36 meses</p>
              <p className="text-sm text-muted-foreground mt-2">Você ganha</p>
              <p className="text-xl font-bold text-primary">
                {formatCurrency(500000 * 0.025)}
              </p>
              <p className="text-xs text-muted-foreground">2,5% do TCV | 3x de {formatCurrency(500000 * 0.025 / 3)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
