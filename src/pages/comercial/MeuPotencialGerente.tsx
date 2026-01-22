/**
 * Meu Potencial (Gerente) - Manager Earnings Dashboard
 * Aggregates team data (level 700) with 1% commission on TCV
 * 
 * ============================================
 * REGRAS IMPLEMENTADAS:
 * ============================================
 * 
 * 1️⃣ COMISSÃO DO GERENTE: 1% do TCV total do time
 * 
 * 2️⃣ CAMPO "total" = MRR (valor mensal)
 *    TCV = MRR × contract_duration
 * 
 * 3️⃣ PAGAMENTO: Sempre 3 parcelas iguais
 * 
 * 4️⃣ SOMENTE status = APPROVED
 * 
 * 5️⃣ AGREGAÇÃO: Propostas de todos os executivos (level 700)
 * 
 * 6️⃣ AUDITORIA: Tabela detalhada por proposta com executivo responsável
 */

import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { openApi } from '@/lib/openApi';
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
  ChevronRight,
  Calculator,
  Wallet,
  BarChart3,
  FileText,
  Percent,
  Calendar,
  History,
  Shield,
  ShieldAlert,
  ShieldX,
  Users,
  ClipboardCheck,
} from 'lucide-react';

// ============================================
// CONFIGURATION
// ============================================

const MANAGER_COMMISSION_RATE = 0.01; // 1% sobre TCV

const SYSTEM_START_YEAR = 2026;
const SYSTEM_START_MONTH = 0; // January = 0

const STATUS_THRESHOLDS = {
  ACTIVE_MAX_DAYS: 30,
  AT_RISK_MAX_DAYS: 45,
} as const;

// ============================================
// TYPES
// ============================================

type ProposalAgeStatus = 'ATIVO' | 'EM_RISCO' | 'EXPIRADO';

interface ApiUser {
  id: number;
  name: string;
  email: string;
  level: number;
}

interface ApiProposal {
  id: number;
  name: string;
  company: string;
  email: string;
  phone: string;
  total: number; // MRR - valor MENSAL
  contract_duration: number;
  status?: string;
  channel_type?: string;
  created_by?: number;
  created_at: string;
  updated_at: string;
  accepted_at?: string;
  approved_at?: string;
  sent_at?: string;
}

interface ProcessedProposal {
  id: number;
  cliente: string;
  empresa: string;
  tcv: number;
  mrr: number;
  contract_term_months: number;
  managerCommission: number;
  managerInstallment: number;
  executiveId: number | null;
  executiveName: string;
  executiveEmail: string;
  
  baseDate: Date | null;
  basePaymentMonth: number;
  basePaymentYear: number;
  ageInDays: number;
  ageStatus: ProposalAgeStatus;
}

interface MonthYear {
  month: number;
  year: number;
}

interface MonthlyInstallment {
  proposalId: number;
  cliente: string;
  executiveName: string;
  parcela: '1/3' | '2/3' | '3/3';
  valor: number;
}

interface MonthlyGroup {
  monthYear: MonthYear;
  label: string;
  installments: MonthlyInstallment[];
  total: number;
}

// ============================================
// MONTH NAMES
// ============================================

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

// ============================================
// UTILITY FUNCTIONS
// ============================================

function normalizeNumber(value: unknown): number {
  if (typeof value === 'number' && !isNaN(value)) return value;
  if (typeof value === 'string') {
    const cleaned = value.replace(/[R$\s.]/g, '').replace(',', '.');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

function formatCurrency(value: number): string {
  if (isNaN(value) || value === null || value === undefined) {
    return 'R$ 0,00';
  }
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

function getCurrentMonthYear(): MonthYear {
  const now = new Date();
  return {
    month: now.getMonth(),
    year: now.getFullYear(),
  };
}

function addMonths(base: MonthYear, months: number): MonthYear {
  let totalMonths = base.year * 12 + base.month + months;
  return {
    year: Math.floor(totalMonths / 12),
    month: totalMonths % 12,
  };
}

function getMonthYearLabel(my: MonthYear): string {
  return `${MONTH_NAMES[my.month]}/${my.year}`;
}

function getMonthYearKey(my: MonthYear): string {
  return `${my.year}-${String(my.month).padStart(2, '0')}`;
}

function parseDate(dateStr: string | undefined | null): Date | null {
  if (!dateStr) return null;
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return null;
    return date;
  } catch {
    return null;
  }
}

function daysBetween(date1: Date, date2: Date): number {
  const diffTime = Math.abs(date2.getTime() - date1.getTime());
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

function getAgeStatus(ageInDays: number): ProposalAgeStatus {
  if (ageInDays <= STATUS_THRESHOLDS.ACTIVE_MAX_DAYS) return 'ATIVO';
  if (ageInDays <= STATUS_THRESHOLDS.AT_RISK_MAX_DAYS) return 'EM_RISCO';
  return 'EXPIRADO';
}

function getStatusBadge(status: ProposalAgeStatus) {
  switch (status) {
    case 'ATIVO':
      return (
        <Badge className="bg-green-500/20 text-green-500 border-green-500/30">
          <Shield className="h-3 w-3 mr-1" />
          Ativo
        </Badge>
      );
    case 'EM_RISCO':
      return (
        <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30">
          <ShieldAlert className="h-3 w-3 mr-1" />
          Em Risco
        </Badge>
      );
    case 'EXPIRADO':
      return (
        <Badge className="bg-gray-500/20 text-gray-500 border-gray-500/30">
          <ShieldX className="h-3 w-3 mr-1" />
          Expirado
        </Badge>
      );
  }
}

// ============================================
// COMPONENT
// ============================================

export default function MeuPotencialGerente() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [propostas, setPropostas] = useState<ProcessedProposal[]>([]);
  const [executivesMap, setExecutivesMap] = useState<Map<number, ApiUser>>(new Map());
  const [expandedMonths, setExpandedMonths] = useState<Record<string, boolean>>({});

  const currentMonthYear = useMemo(() => getCurrentMonthYear(), []);

  useEffect(() => {
    let mounted = true;

    async function loadData() {
      try {
        // Validate user access (750 or 1000)
        const user = await openApi.getCurrentUser();
        
        if (!mounted) return;
        
        if (!user || (user.level !== 750 && user.level !== 1000)) {
          toast.error('Acesso restrito a Gerentes Comerciais');
          navigate('/modulos/dashboard', { replace: true });
          return;
        }

        // 1. Fetch all executives (level 700)
        const executivesResponse = await openApi.getUsers({
          level: 700,
          __perPage: 500,
        });
        
        const executives = (executivesResponse.data || []) as ApiUser[];
        const execMap = new Map<number, ApiUser>();
        const execIds = new Set<number>();
        
        executives.forEach((exec) => {
          execMap.set(exec.id, exec);
          execIds.add(exec.id);
        });
        
        setExecutivesMap(execMap);

        // 2. Fetch all proposals (filter by status done client-side for accuracy)
        const proposalsResponse = await openApi.getProposals({
          __perPage: 5000,
        });
        
        if (!mounted) return;
        
        const allProposals = (proposalsResponse.data || []) as ApiProposal[];
        const now = new Date();
        
        // 3. Filter proposals by team (created_by in executives list)
        const teamProposals = allProposals.filter((p) => {
          const normalizedStatus = normalizeStatus(p.status);
          const isApproved = normalizedStatus === 'APPROVED';
          const belongsToTeam = p.created_by && execIds.has(p.created_by);
          return isApproved && belongsToTeam;
        });

        // 4. Process proposals - CRITICAL: total = MRR, TCV = MRR × meses
        const processed: ProcessedProposal[] = teamProposals.map((p) => {
          // MRR = campo "total" (valor MENSAL)
          const mrr = normalizeNumber(p.total);
          const duration = Math.max(Number(p.contract_duration) || 1, 1);
          
          // TCV = MRR × meses
          const tcv = mrr * duration;
          
          // Manager commission = 1% of TCV
          const managerCommission = tcv * MANAGER_COMMISSION_RATE;
          const managerInstallment = managerCommission / 3;
          
          // Executive info
          const executive = p.created_by ? execMap.get(p.created_by) : null;
          
          // Base date
          const baseDate = 
            parseDate(p.accepted_at) ||
            parseDate(p.approved_at) ||
            parseDate(p.sent_at) ||
            parseDate(p.updated_at) ||
            parseDate(p.created_at);
          
          const ageInDays = baseDate ? daysBetween(baseDate, now) : 0;
          const ageStatus = baseDate ? getAgeStatus(ageInDays) : 'ATIVO';
          const basePaymentMonth = baseDate ? baseDate.getMonth() : currentMonthYear.month;
          const basePaymentYear = baseDate ? baseDate.getFullYear() : currentMonthYear.year;
          
          return {
            id: p.id,
            cliente: p.name || 'N/A',
            empresa: p.company || 'N/A',
            tcv,
            mrr,
            contract_term_months: duration,
            managerCommission,
            managerInstallment,
            executiveId: p.created_by || null,
            executiveName: executive?.name || `Executivo #${p.created_by || 'N/A'}`,
            executiveEmail: executive?.email || '',
            baseDate,
            basePaymentMonth,
            basePaymentYear,
            ageInDays,
            ageStatus,
          };
        });

        // Sort by TCV descending
        processed.sort((a, b) => b.tcv - a.tcv);
        
        setPropostas(processed);
        setError(null);
      } catch (err: any) {
        console.error('[MeuPotencialGerente] Error:', err);
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
  }, [navigate, currentMonthYear]);

  // ============================================
  // COMPUTED VALUES
  // ============================================

  const stats = useMemo(() => {
    const teamTCV = propostas.reduce((sum, p) => sum + p.tcv, 0);
    const teamMRR = propostas.reduce((sum, p) => sum + p.mrr, 0);
    const contractCount = propostas.length;
    
    // Manager commission = 1% of total team TCV
    const managerCommissionTotal = teamTCV * MANAGER_COMMISSION_RATE;
    
    // By status
    const activeProposals = propostas.filter(p => p.ageStatus === 'ATIVO');
    const atRiskProposals = propostas.filter(p => p.ageStatus === 'EM_RISCO');
    const expiredProposals = propostas.filter(p => p.ageStatus === 'EXPIRADO');
    
    const activeCommission = activeProposals.reduce((sum, p) => sum + p.managerCommission, 0);
    const atRiskCommission = atRiskProposals.reduce((sum, p) => sum + p.managerCommission, 0);
    const expiredCommission = expiredProposals.reduce((sum, p) => sum + p.managerCommission, 0);

    return {
      teamTCV,
      teamMRR,
      managerCommissionTotal,
      contractCount,
      activeCommission,
      atRiskCommission,
      expiredCommission,
      activeCount: activeProposals.length,
      atRiskCount: atRiskProposals.length,
      expiredCount: expiredProposals.length,
    };
  }, [propostas]);

  // ============================================
  // ROLLING WINDOW - 3 MONTHS PROJECTION
  // ============================================

  const rollingMonths = useMemo((): MonthYear[] => {
    return [
      currentMonthYear,
      addMonths(currentMonthYear, 1),
      addMonths(currentMonthYear, 2),
    ];
  }, [currentMonthYear]);

  const monthlyProjection = useMemo((): MonthlyGroup[] => {
    const groups: Record<string, MonthlyGroup> = {};
    
    rollingMonths.forEach((my) => {
      const key = getMonthYearKey(my);
      groups[key] = {
        monthYear: my,
        label: `${MONTH_NAMES[my.month]} ${my.year}`,
        installments: [],
        total: 0,
      };
    });
    
    propostas.forEach((p) => {
      const baseMonthYear: MonthYear = {
        month: p.basePaymentMonth,
        year: p.basePaymentYear,
      };
      
      const parcelas: Array<{ month: MonthYear; parcela: '1/3' | '2/3' | '3/3'; valor: number }> = [
        { month: baseMonthYear, parcela: '1/3', valor: p.managerInstallment },
        { month: addMonths(baseMonthYear, 1), parcela: '2/3', valor: p.managerInstallment },
        { month: addMonths(baseMonthYear, 2), parcela: '3/3', valor: p.managerInstallment },
      ];
      
      parcelas.forEach(({ month, parcela, valor }) => {
        const key = getMonthYearKey(month);
        if (groups[key]) {
          groups[key].installments.push({
            proposalId: p.id,
            cliente: p.cliente,
            executiveName: p.executiveName,
            parcela,
            valor,
          });
          groups[key].total += valor;
        }
      });
    });
    
    return rollingMonths.map(my => groups[getMonthYearKey(my)]);
  }, [propostas, rollingMonths]);

  // ============================================
  // HISTORY - Since Jan/2026
  // ============================================

  const commissionHistory = useMemo(() => {
    const history: MonthlyGroup[] = [];
    const startMonthYear: MonthYear = { month: SYSTEM_START_MONTH, year: SYSTEM_START_YEAR };
    
    for (let i = 0; i < 12; i++) {
      const my = addMonths(startMonthYear, i);
      const group: MonthlyGroup = {
        monthYear: my,
        label: `${MONTH_NAMES[my.month]} ${my.year}`,
        installments: [],
        total: 0,
      };
      
      propostas.forEach((p) => {
        const baseMonthYear: MonthYear = {
          month: p.basePaymentMonth,
          year: p.basePaymentYear,
        };
        
        const parcelas: Array<{ month: MonthYear; parcela: '1/3' | '2/3' | '3/3'; valor: number }> = [
          { month: baseMonthYear, parcela: '1/3', valor: p.managerInstallment },
          { month: addMonths(baseMonthYear, 1), parcela: '2/3', valor: p.managerInstallment },
          { month: addMonths(baseMonthYear, 2), parcela: '3/3', valor: p.managerInstallment },
        ];
        
        parcelas.forEach(({ month, parcela, valor }) => {
          if (month.month === my.month && month.year === my.year) {
            group.installments.push({
              proposalId: p.id,
              cliente: p.cliente,
              executiveName: p.executiveName,
              parcela,
              valor,
            });
            group.total += valor;
          }
        });
      });
      
      history.push(group);
    }
    
    return history;
  }, [propostas]);

  const toggleMonth = (key: string) => {
    setExpandedMonths(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

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
          Meu Potencial (Gerente)
        </h1>
        <p className="text-muted-foreground">
          Visão consolidada do time — comissão 1% sobre TCV (pagamento em 3x)
        </p>
      </div>

      {/* Policy Summary */}
      <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
        <CardContent className="py-4">
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <Badge variant="outline" className="text-sm py-1">
              <FileText className="h-3 w-3 mr-1" />
              Gerente = 1% do TCV Total do Time | Pagamento em 3x
            </Badge>
            <Badge variant="outline" className="text-sm py-1">
              <Users className="h-3 w-3 mr-1" />
              {executivesMap.size} executivos no time
            </Badge>
            <Badge variant="outline" className="text-sm py-1">
              <Calendar className="h-3 w-3 mr-1" />
              Período atual: {MONTH_NAMES[currentMonthYear.month]}/{currentMonthYear.year}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Comissão Total Projetada */}
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Comissão Total Projetada
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {formatCurrency(stats.managerCommissionTotal)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              1% sobre TCV do time
            </p>
          </CardContent>
        </Card>

        {/* Em Risco */}
        <Card className={`${stats.atRiskCount > 0 ? 'bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-500/20' : ''}`}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-amber-500" />
              Em Risco
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${stats.atRiskCount > 0 ? 'text-amber-500' : ''}`}>
              {formatCurrency(stats.atRiskCommission)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.atRiskCount} proposta(s) entre 31-45 dias
            </p>
          </CardContent>
        </Card>

        {/* Ativo */}
        <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Shield className="h-4 w-4 text-green-500" />
              Ativo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">
              {formatCurrency(stats.activeCommission)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.activeCount} proposta(s) até 30 dias
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
              Propostas aprovadas do time
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Resumo Financeiro do Time */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              TCV Total do Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">
              {formatCurrency(stats.teamTCV)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              MRR Total do Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-blue-500">
              {formatCurrency(stats.teamMRR)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Métrica de acompanhamento
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Percent className="h-4 w-4" />
              Comissão Gerente (1%)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-primary">
              {formatCurrency(stats.managerCommissionTotal)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Previsão de Pagamento - Rolling Window */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Previsão de Pagamento
          </CardTitle>
          <CardDescription>
            Próximos 3 meses a partir de {MONTH_NAMES[currentMonthYear.month]}/{currentMonthYear.year} — Atualiza automaticamente ao virar o mês
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {monthlyProjection.map((group, idx) => {
            const key = getMonthYearKey(group.monthYear);
            const isExpanded = expandedMonths[key] ?? false;
            const parcelaLabel = ['1/3', '2/3', '3/3'][idx];
            
            return (
              <Collapsible key={key} open={isExpanded} onOpenChange={() => toggleMonth(key)}>
                <CollapsibleTrigger asChild>
                  <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50 border cursor-pointer hover:bg-muted/70 transition-colors">
                    <div className="flex items-center gap-3">
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                      <div>
                        <div className="font-medium">
                          {group.label} — {parcelaLabel}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {group.installments.length} parcela(s) de {stats.contractCount} contrato(s)
                        </div>
                      </div>
                    </div>
                    <div className="text-xl font-bold text-primary">
                      {formatCurrency(group.total)}
                    </div>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-2 pl-8 space-y-2">
                    {group.installments.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-2">
                        Nenhuma parcela prevista para este mês
                      </p>
                    ) : (
                      group.installments.map((inst, i) => (
                        <div key={`${inst.proposalId}-${inst.parcela}-${i}`} className="flex items-center justify-between p-2 rounded bg-background border text-sm">
                          <span>
                            #{inst.proposalId} — {inst.cliente} ({inst.executiveName}) ({inst.parcela})
                          </span>
                          <span className="font-medium">{formatCurrency(inst.valor)}</span>
                        </div>
                      ))
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </CardContent>
      </Card>

      {/* Auditoria do Time */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-primary" />
            Auditoria do Time (propostas aprovadas)
          </CardTitle>
          <CardDescription>
            Detalhamento por proposta com comissão do gerente (1% do TCV)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {propostas.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma proposta aprovada encontrada</p>
              <p className="text-sm mt-2">
                As propostas aprovadas do time aparecerão aqui
              </p>
            </div>
          ) : (
            <TooltipProvider>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Executivo</TableHead>
                      <TableHead className="text-right">Prazo</TableHead>
                      <TableHead className="text-right">TCV</TableHead>
                      <TableHead className="text-right">MRR</TableHead>
                      <TableHead className="text-right">Comissão (1%)</TableHead>
                      <TableHead className="text-right">Parcela (1/3)</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {propostas.map((p) => (
                      <TableRow key={p.id} className={p.ageStatus === 'EXPIRADO' ? 'opacity-50' : ''}>
                        <TableCell className="font-mono text-xs">
                          #{p.id}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">{p.cliente}</span>
                            <span className="text-xs text-muted-foreground">{p.empresa}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">{p.executiveName}</span>
                            <span className="text-xs text-muted-foreground">{p.executiveEmail}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {p.contract_term_months}m
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(p.tcv)}
                        </TableCell>
                        <TableCell className="text-right text-blue-500">
                          {formatCurrency(p.mrr)}
                        </TableCell>
                        <TableCell className="text-right font-bold text-primary">
                          {formatCurrency(p.managerCommission)}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          <Tooltip>
                            <TooltipTrigger className="cursor-help">
                              {formatCurrency(p.managerInstallment)}
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{MONTH_NAMES[p.basePaymentMonth]}/{p.basePaymentYear}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                        <TableCell className="text-center">
                          <Tooltip>
                            <TooltipTrigger>
                              {getStatusBadge(p.ageStatus)}
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{p.ageInDays} dias desde aprovação</p>
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TooltipProvider>
          )}
        </CardContent>
      </Card>

      {/* Histórico de Comissões */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            Histórico de Comissões (desde Jan/2026)
          </CardTitle>
          <CardDescription>
            Timeline mensal de parcelas previstas — 12 meses a partir de Janeiro/2026
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {commissionHistory.map((group) => {
            const key = getMonthYearKey(group.monthYear);
            const isExpanded = expandedMonths[key] ?? false;
            const isPast = group.monthYear.year < currentMonthYear.year || 
              (group.monthYear.year === currentMonthYear.year && group.monthYear.month < currentMonthYear.month);
            const isCurrent = group.monthYear.year === currentMonthYear.year && 
              group.monthYear.month === currentMonthYear.month;
            
            return (
              <Collapsible key={key} open={isExpanded} onOpenChange={() => toggleMonth(key)}>
                <CollapsibleTrigger asChild>
                  <div className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors ${
                    isCurrent ? 'bg-primary/10 border-primary/30' : 
                    isPast ? 'bg-muted/30 opacity-70' : 'bg-muted/50'
                  }`}>
                    <div className="flex items-center gap-3">
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                      <div className="flex items-center gap-2">
                        <span className={`font-medium ${isCurrent ? 'text-primary' : ''}`}>
                          {group.label}
                        </span>
                        {isCurrent && (
                          <Badge variant="outline" className="text-xs">Atual</Badge>
                        )}
                        {isPast && (
                          <Badge variant="secondary" className="text-xs">Passado</Badge>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        ({group.installments.length} parcelas)
                      </span>
                    </div>
                    <div className={`text-lg font-bold ${isCurrent ? 'text-primary' : ''}`}>
                      {formatCurrency(group.total)}
                    </div>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-2 pl-8 space-y-1">
                    {group.installments.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-2">
                        Nenhuma parcela neste mês
                      </p>
                    ) : (
                      group.installments.map((inst, i) => (
                        <div key={`${inst.proposalId}-${inst.parcela}-${i}`} className="flex items-center justify-between p-2 rounded bg-background border text-sm">
                          <span>
                            #{inst.proposalId} — {inst.cliente} ({inst.executiveName}) ({inst.parcela})
                          </span>
                          <span className="font-medium">{formatCurrency(inst.valor)}</span>
                        </div>
                      ))
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })}
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
                  Simulador Rápido (Gerente)
                </span>
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="font-medium">Exemplo: TCV Total do Time R$ 1.000.000</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between p-2 bg-muted/50 rounded">
                      <span>Comissão Gerente (1%)</span>
                      <span className="font-medium">{formatCurrency(10000)}</span>
                    </div>
                    <div className="flex justify-between p-2 bg-muted/50 rounded">
                      <span>Parcela 1/3</span>
                      <span className="font-medium">{formatCurrency(3333.33)}</span>
                    </div>
                    <div className="flex justify-between p-2 bg-muted/50 rounded">
                      <span>Parcela 2/3</span>
                      <span className="font-medium">{formatCurrency(3333.33)}</span>
                    </div>
                    <div className="flex justify-between p-2 bg-muted/50 rounded">
                      <span>Parcela 3/3</span>
                      <span className="font-medium">{formatCurrency(3333.34)}</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <h4 className="font-medium">Resumo</h4>
                  <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
                    <p className="text-sm text-muted-foreground">
                      O gerente recebe <strong>1% do TCV total</strong> de todas as propostas aprovadas do time (executivos level 700).
                    </p>
                    <p className="text-sm text-muted-foreground mt-2">
                      O pagamento é feito em <strong>3 parcelas iguais</strong>, nos meses subsequentes à aprovação de cada proposta.
                    </p>
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
