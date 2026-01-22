/**
 * Meu Potencial - Executive Earnings Dashboard
 * OPEN 2026 Commission Policy - SEM CAP
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
 * 2️⃣ CAMPO "total" = MRR (valor mensal)
 *    TCV = MRR × contract_duration
 * 
 * 3️⃣ SEM CAP - Sem teto de comissão
 * 
 * 4️⃣ PAGAMENTO: Sempre 3 parcelas iguais
 * 
 * 5️⃣ SOMENTE status = APPROVED
 * 
 * 6️⃣ ROLLING WINDOW: Previsão sempre começa no mês atual
 * 
 * 7️⃣ STATUS: Ativo (<= 30 dias), Em Risco (31-45 dias), Expirado (> 45 dias)
 * 
 * 8️⃣ HISTÓRICO: A partir de Jan/2026
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
  computeTCV,
} from '@/services/executiveCommissionService';
import { 
  calculateProposalCommission as calcUnified, 
  CommissionUser, 
  CommissionProposal,
  CS_COMMISSION_RATE,
  formatCommissionPct,
} from '@/services/commissionCalculator';
import { getCommissionOverride } from '@/services/commissionOverrideService';

// User commission profile type
interface UserCommissionProfile {
  level: number;
  overridePct: number | null;
  displayText: string;
  isOverride: boolean;
  isCS: boolean;
}
import { useMRRGoals } from '@/hooks/useMRRGoals';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
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
  AlertCircle,
  History,
  Shield,
  ShieldAlert,
  ShieldX,
  Target,
} from 'lucide-react';

// ============================================
// CONFIGURATION
// ============================================

// System start month (fixed)
const SYSTEM_START_YEAR = 2026;
const SYSTEM_START_MONTH = 0; // January = 0

// Status thresholds (in days)
const STATUS_THRESHOLDS = {
  ACTIVE_MAX_DAYS: 30,
  AT_RISK_MAX_DAYS: 45,
} as const;

// ============================================
// TYPES
// ============================================

type ProposalAgeStatus = 'ATIVO' | 'EM_RISCO' | 'EXPIRADO';

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
  mrr: number; // MRR - valor mensal original
  tcv: number; // TCV = MRR × meses
  contract_term_months: number;
  commission_rate: number;
  commission_value: number;
  p1: number;
  p2: number;
  p3: number;
  is_standard_duration: boolean;
  is_override: boolean; // Se a comissão veio de um override
  dadosIncompletos: boolean;
  
  // Date and status
  baseDate: Date | null;
  basePaymentMonth: number; // 0-11
  basePaymentYear: number;
  ageInDays: number;
  ageStatus: ProposalAgeStatus;
}

interface MonthYear {
  month: number; // 0-11
  year: number;
}

interface MonthlyInstallment {
  proposalId: number;
  cliente: string;
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

const MONTH_NAMES_SHORT = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
];

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
  if (ageInDays <= STATUS_THRESHOLDS.ACTIVE_MAX_DAYS) {
    return 'ATIVO';
  } else if (ageInDays <= STATUS_THRESHOLDS.AT_RISK_MAX_DAYS) {
    return 'EM_RISCO';
  }
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

export default function MeuPotencial() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [propostas, setPropostas] = useState<ProcessedProposal[]>([]);
  const [userId, setUserId] = useState<number | null>(null);
  const [expandedMonths, setExpandedMonths] = useState<Record<string, boolean>>({});
  const [commissionProfile, setCommissionProfile] = useState<UserCommissionProfile | null>(null);

  // MRR Goals hook
  const { getGoalForExecutive, isLoading: isLoadingGoals } = useMRRGoals();
  // Current month/year (rolling window base)
  const currentMonthYear = useMemo(() => getCurrentMonthYear(), []);

  useEffect(() => {
    let mounted = true;

    async function loadData() {
      try {
        const user = await openApi.getCurrentUser();
        
        if (!mounted) return;
        
        // Permitir Comercial (700) e CS (775)
        const allowedLevels = [700, 775];
        if (!user || !allowedLevels.includes(user.level)) {
          toast.error('Acesso restrito a Executivos e CS');
          navigate('/login', { replace: true });
          return;
        }
        
        setUserId(user.id);
        
        // Buscar override de comissão do usuário
        const commissionOverride = await getCommissionOverride(user.id);
        const overridePct = commissionOverride?.commission_pct_override ?? null;
        
        // Construir perfil de comissão do usuário
        const isOverrideActive = overridePct !== null && overridePct !== undefined;
        const isCS = user.level === 775;
        
        let displayText: string;
        if (isOverrideActive) {
          displayText = `Comissão: ${formatCommissionPct(overridePct)} do TCV | Pagamento em 3x`;
        } else if (isCS) {
          displayText = `Comissão CS: ${formatCommissionPct(CS_COMMISSION_RATE)} do TCV | Pagamento em 3x`;
        } else {
          displayText = '1/12m = 4% do TCV | 24/36/48m = 2,5% do TCV | Pagamento em 3x';
        }
        
        setCommissionProfile({
          level: user.level,
          overridePct,
          displayText,
          isOverride: isOverrideActive,
          isCS,
        });
        
        const response = await openApi.getProposals({
          __perPage: 500,
        });
        
        if (!mounted) return;
        
        const allProposals = (response.data || []) as ApiProposal[];
        const now = new Date();
        
        // RULE: ONLY APPROVED proposals created by this user
        const filteredProposals = allProposals.filter((p) => {
          const normalizedStatus = normalizeStatus(p.status);
          const isApproved = normalizedStatus === 'APPROVED';
          const isOwner = p.created_by === user.id;
          return isApproved && isOwner;
        });

        // Construir objeto de usuário para cálculo unificado
        const commissionUser: CommissionUser = {
          id: user.id,
          level: user.level,
          commission_pct_override: overridePct,
        };

        // Process proposals - USANDO CÁLCULO UNIFICADO COM OVERRIDE
        const processed: ProcessedProposal[] = filteredProposals.map((p) => {
          // MRR = campo "total" (valor MENSAL)
          const mrr = p.total || 0;
          const duration = p.contract_duration || 0;
          
          // Usar calculadora unificada
          const commissionResult = calcUnified(
            { total: mrr, contract_duration: duration },
            commissionUser
          );
          
          const installments = computeInstallments(commissionResult.totalCommission);
          
          // Determine base date (priority: accepted_at > approved_at > sent_at > updated_at)
          const baseDate = 
            parseDate(p.accepted_at) ||
            parseDate(p.approved_at) ||
            parseDate(p.sent_at) ||
            parseDate(p.updated_at) ||
            parseDate(p.created_at);
          
          // Calculate age and status
          const ageInDays = baseDate ? daysBetween(baseDate, now) : 0;
          const ageStatus = baseDate ? getAgeStatus(ageInDays) : 'ATIVO';
          
          // Payment month/year (from real date or current month)
          const basePaymentMonth = baseDate ? baseDate.getMonth() : currentMonthYear.month;
          const basePaymentYear = baseDate ? baseDate.getFullYear() : currentMonthYear.year;
          
          return {
            id: p.id,
            cliente: p.name || 'N/A',
            empresa: p.company || 'N/A',
            mrr: commissionResult.mrr,
            tcv: commissionResult.tcv,
            contract_term_months: duration,
            commission_rate: commissionResult.commissionPct,
            commission_value: commissionResult.totalCommission,
            p1: installments.p1,
            p2: installments.p2,
            p3: installments.p3,
            is_standard_duration: isStandardDuration(duration),
            is_override: commissionResult.isOverride,
            dadosIncompletos: !mrr || !duration,
            baseDate,
            basePaymentMonth,
            basePaymentYear,
            ageInDays,
            ageStatus,
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
  }, [navigate, currentMonthYear]);

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
    
    // By status
    const activeProposals = propostas.filter(p => p.ageStatus === 'ATIVO');
    const atRiskProposals = propostas.filter(p => p.ageStatus === 'EM_RISCO');
    const expiredProposals = propostas.filter(p => p.ageStatus === 'EXPIRADO');
    
    const activeCommission = activeProposals.reduce((sum, p) => sum + p.commission_value, 0);
    const atRiskCommission = atRiskProposals.reduce((sum, p) => sum + p.commission_value, 0);
    const expiredCommission = expiredProposals.reduce((sum, p) => sum + p.commission_value, 0);

    // MRR já está na proposta (campo mrr = total original)
    const mrrTotal = propostas.reduce((sum, p) => sum + p.mrr, 0);

    return {
      totalCommission,
      totalTCV,
      contractCount,
      avgRate,
      activeCommission,
      atRiskCommission,
      expiredCommission,
      activeCount: activeProposals.length,
      atRiskCount: atRiskProposals.length,
      expiredCount: expiredProposals.length,
      mrrTotal,
    };
  }, [propostas]);

  // MRR Goal for this executive
  const mrrMeta = userId ? getGoalForExecutive(userId) : 0;
  const mrrProgress = mrrMeta > 0 ? Math.min((stats.mrrTotal / mrrMeta) * 100, 100) : 0;
  const mrrGap = Math.max(mrrMeta - stats.mrrTotal, 0);

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

  // Group installments by month for preview
  const monthlyProjection = useMemo((): MonthlyGroup[] => {
    const groups: Record<string, MonthlyGroup> = {};
    
    // Initialize 3 months
    rollingMonths.forEach((my, idx) => {
      const key = getMonthYearKey(my);
      groups[key] = {
        monthYear: my,
        label: `${MONTH_NAMES[my.month]} ${my.year}`,
        installments: [],
        total: 0,
      };
    });
    
    // Map each proposal's installments
    propostas.forEach((p) => {
      // Use proposal's real date or current month
      const baseMonthYear: MonthYear = {
        month: p.basePaymentMonth,
        year: p.basePaymentYear,
      };
      
      // P1 -> base month, P2 -> base+1, P3 -> base+2
      const p1Month = baseMonthYear;
      const p2Month = addMonths(baseMonthYear, 1);
      const p3Month = addMonths(baseMonthYear, 2);
      
      const parcelas: Array<{ month: MonthYear; parcela: '1/3' | '2/3' | '3/3'; valor: number }> = [
        { month: p1Month, parcela: '1/3', valor: p.p1 },
        { month: p2Month, parcela: '2/3', valor: p.p2 },
        { month: p3Month, parcela: '3/3', valor: p.p3 },
      ];
      
      parcelas.forEach(({ month, parcela, valor }) => {
        const key = getMonthYearKey(month);
        if (groups[key]) {
          groups[key].installments.push({
            proposalId: p.id,
            cliente: p.cliente,
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
    
    // Generate 12 months from system start
    for (let i = 0; i < 12; i++) {
      const my = addMonths(startMonthYear, i);
      const key = getMonthYearKey(my);
      
      const group: MonthlyGroup = {
        monthYear: my,
        label: `${MONTH_NAMES[my.month]} ${my.year}`,
        installments: [],
        total: 0,
      };
      
      // Find installments for this month
      propostas.forEach((p) => {
        const baseMonthYear: MonthYear = {
          month: p.basePaymentMonth,
          year: p.basePaymentYear,
        };
        
        const parcelas: Array<{ month: MonthYear; parcela: '1/3' | '2/3' | '3/3'; valor: number }> = [
          { month: baseMonthYear, parcela: '1/3', valor: p.p1 },
          { month: addMonths(baseMonthYear, 1), parcela: '2/3', valor: p.p2 },
          { month: addMonths(baseMonthYear, 2), parcela: '3/3', valor: p.p3 },
        ];
        
        parcelas.forEach(({ month, parcela, valor }) => {
          if (month.month === my.month && month.year === my.year) {
            group.installments.push({
              proposalId: p.id,
              cliente: p.cliente,
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

  // Toggle month expansion
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
          Meu Potencial
        </h1>
        <p className="text-muted-foreground">
          Visualize suas comissões baseadas nas propostas aprovadas — Política OPEN 2026
        </p>
      </div>

      {/* Policy Summary */}
      <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
        <CardContent className="py-4">
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <Badge 
              variant="outline" 
              className={`text-sm py-1 ${commissionProfile?.isOverride ? 'bg-primary/10 text-primary border-primary/30' : ''}`}
            >
              <FileText className="h-3 w-3 mr-1" />
              {commissionProfile?.displayText || '1/12m = 4% do TCV | 24/36/48m = 2,5% do TCV | Pagamento em 3x'}
              {commissionProfile?.isOverride && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="ml-1 cursor-help">
                      <Percent className="h-3 w-3 inline" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Comissão personalizada</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </Badge>
            <Badge variant="outline" className="text-sm py-1">
              <Calendar className="h-3 w-3 mr-1" />
              Período atual: {MONTH_NAMES[currentMonthYear.month]}/{currentMonthYear.year}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards - Restored Layout */}
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
              {formatCurrency(stats.totalCommission)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Soma de todas as comissões
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
              Propostas aprovadas
            </p>
          </CardContent>
        </Card>
      </div>

      {/* MRR Goal Progress Card */}
      {mrrMeta > 0 && (
        <Card className="border-primary/30 bg-gradient-to-r from-primary/5 to-transparent">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              Meta MRR
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-3 bg-background rounded-lg border">
                <p className="text-xs text-muted-foreground">Meta MRR</p>
                <p className="text-xl font-bold text-primary">{formatCurrency(mrrMeta)}</p>
              </div>
              <div className="p-3 bg-background rounded-lg border">
                <p className="text-xs text-muted-foreground">MRR Atual</p>
                <p className="text-xl font-bold text-blue-500">{formatCurrency(stats.mrrTotal)}</p>
              </div>
              <div className="p-3 bg-background rounded-lg border">
                <p className="text-xs text-muted-foreground">Falta para Meta</p>
                <p className={`text-xl font-bold ${mrrGap > 0 ? 'text-amber-500' : 'text-green-500'}`}>
                  {mrrGap > 0 ? formatCurrency(mrrGap) : 'Meta atingida! 🎉'}
                </p>
              </div>
              <div className="p-3 bg-background rounded-lg border">
                <p className="text-xs text-muted-foreground mb-2">Progresso</p>
                <Progress value={mrrProgress} className="h-3" />
                <p className="text-sm font-semibold mt-1">{mrrProgress.toFixed(0)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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
                          {group.installments.length} parcela(s)
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
                            #{inst.proposalId} — {inst.cliente} ({inst.parcela})
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

      {/* Resumo Financeiro */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              TCV Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">
              {formatCurrency(stats.totalTCV)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Comissão Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-primary">
              {formatCurrency(stats.totalCommission)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Percent className="h-4 w-4" />
              Taxa Média Ponderada
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">
              {(stats.avgRate * 100).toFixed(2)}%
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Propostas Aprovadas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" />
            Propostas Aprovadas
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
                Suas propostas aprovadas aparecerão aqui
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
                      <TableHead className="text-right">TCV</TableHead>
                      <TableHead className="text-right">Prazo</TableHead>
                      <TableHead className="text-right">%</TableHead>
                      <TableHead className="text-right">Comissão Total</TableHead>
                      <TableHead className="text-right">Parcela (1/3)</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead className="text-center">Ações</TableHead>
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
                        <TableCell className="text-right font-medium">
                          {formatCurrency(p.tcv)}
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
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <span className={p.is_override ? 'font-semibold text-primary' : ''}>
                              {(p.commission_rate * 100).toFixed(1)}%
                            </span>
                            {p.is_override && (
                              <Tooltip>
                                <TooltipTrigger>
                                  <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30">
                                    <Percent className="h-2.5 w-2.5 mr-0.5" />
                                    custom
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Comissão personalizada</p>
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-bold text-primary">
                          {formatCurrency(p.commission_value)}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          <Tooltip>
                            <TooltipTrigger className="cursor-help">
                              {formatCurrency(p.p1)}
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{MONTH_NAMES[p.basePaymentMonth]}/{p.basePaymentYear}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                        <TableCell className="text-center">
                          {p.dadosIncompletos ? (
                            <Badge variant="secondary" className="text-xs">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Incompleto
                            </Badge>
                          ) : (
                            <Tooltip>
                              <TooltipTrigger>
                                {getStatusBadge(p.ageStatus)}
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{p.ageInDays} dias desde aprovação</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate(`/propostas/${p.id}`)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
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
                            #{inst.proposalId} — {inst.cliente} ({inst.parcela})
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
                    {/* Mostrar simulador adequado ao perfil */}
                    {commissionProfile?.isOverride || commissionProfile?.isCS ? (
                      // Usuário com override ou CS: mostrar apenas o percentual único
                      <>
                        <div className="flex justify-between p-2 bg-primary/10 rounded border border-primary/20">
                          <span>
                            {commissionProfile.isOverride 
                              ? `Comissão personalizada (${formatCommissionPct(commissionProfile.overridePct!)})`
                              : `Comissão CS (${formatCommissionPct(CS_COMMISSION_RATE)})`
                            }
                          </span>
                          <span className="font-medium text-primary">
                            {formatCurrency(100000 * (commissionProfile.overridePct ?? CS_COMMISSION_RATE))}
                          </span>
                        </div>
                        <div className="flex justify-between p-2 bg-muted/50 rounded">
                          <span>Parcela (1/3)</span>
                          <span className="font-medium">
                            {formatCurrency((100000 * (commissionProfile.overridePct ?? CS_COMMISSION_RATE)) / 3)}
                          </span>
                        </div>
                      </>
                    ) : (
                      // Comercial padrão: régua 4%/2,5%
                      <>
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
                      </>
                    )}
                  </div>
                </div>
                <div className="space-y-4">
                  <h4 className="font-medium">Parcelas (3x)</h4>
                  <div className="space-y-2 text-sm">
                    {commissionProfile?.isOverride || commissionProfile?.isCS ? (
                      // Override/CS: mostrar parcelas do percentual único
                      <div className="flex justify-between p-2 bg-muted/50 rounded">
                        <span>
                          Comissão {formatCurrency(100000 * (commissionProfile.overridePct ?? CS_COMMISSION_RATE))} →
                        </span>
                        <span className="font-medium">
                          3x {formatCurrency((100000 * (commissionProfile.overridePct ?? CS_COMMISSION_RATE)) / 3)}
                        </span>
                      </div>
                    ) : (
                      // Comercial padrão: parcelas para 4% e 2,5%
                      <>
                        <div className="flex justify-between p-2 bg-muted/50 rounded">
                          <span>Comissão R$ 4.000 →</span>
                          <span className="font-medium">3x {formatCurrency(1333.33)}</span>
                        </div>
                        <div className="flex justify-between p-2 bg-muted/50 rounded">
                          <span>Comissão R$ 2.500 →</span>
                          <span className="font-medium">3x {formatCurrency(833.33)}</span>
                        </div>
                      </>
                    )}
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
