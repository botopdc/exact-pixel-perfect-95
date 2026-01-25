/**
 * Meu Potencial Arquiteto - Architect Earnings Dashboard
 * 
 * ============================================
 * REGRAS IMPLEMENTADAS:
 * ============================================
 * 
 * 1️⃣ COMISSÃO POR DURAÇÃO (ARQUITETO):
 * - 12 meses = 1% do TCV
 * - 24, 36, 48 meses = 0.5% do TCV
 * - Outros prazos = 0%
 * 
 * 2️⃣ TCV = MRR × contract_duration
 * 
 * 3️⃣ PAGAMENTO: Sempre 3 parcelas iguais
 * 
 * 4️⃣ SOMENTE status = APPROVED
 * 
 * 5️⃣ SOMENTE propostas onde o arquiteto é participante
 */

import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { openApi } from '@/lib/openApi';
import { normalizeStatus } from '@/hooks/useProposals';
import { getProposalsByParticipant } from '@/services/proposalParticipantService';
import { getArchitectCommissionPct, getArchitectCommissionRuleText } from '@/services/proposalParticipantService';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  TrendingUp,
  DollarSign,
  Eye,
  ChevronDown,
  ChevronRight,
  Calculator,
  Wallet,
  FileText,
  Calendar,
  Shield,
  ShieldAlert,
  ShieldX,
  Lightbulb,
} from 'lucide-react';

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
  total: number;
  contract_duration: number;
  status?: string;
  created_at: string;
  updated_at: string;
  accepted_at?: string;
  approved_at?: string;
}

interface ProcessedProposal {
  id: number;
  cliente: string;
  empresa: string;
  mrr: number;
  tcv: number;
  contract_term_months: number;
  commission_rate: number;
  commission_value: number;
  p1: number;
  p2: number;
  p3: number;
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
// CONSTANTS
// ============================================

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const STATUS_THRESHOLDS = {
  ACTIVE_MAX_DAYS: 30,
  AT_RISK_MAX_DAYS: 45,
} as const;

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
  return { month: now.getMonth(), year: now.getFullYear() };
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

export default function MeuPotencialArquiteto() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [propostas, setPropostas] = useState<ProcessedProposal[]>([]);
  const [userId, setUserId] = useState<number | null>(null);
  const [expandedMonths, setExpandedMonths] = useState<Record<string, boolean>>({});
  
  const currentMonthYear = useMemo(() => getCurrentMonthYear(), []);

  useEffect(() => {
    let mounted = true;

    async function loadData() {
      try {
        const user = await openApi.getCurrentUser();
        
        if (!mounted) return;
        
        // Only allow Architects (level 690)
        if (!user || user.level !== 690) {
          toast.error('Acesso restrito a Arquitetos de Soluções');
          navigate('/login', { replace: true });
          return;
        }
        
        setUserId(user.id);
        
        // Get proposals where this user is an ARCHITECT participant
        console.log('[MeuPotencialArquiteto] Fetching participations for user:', user.id);
        const participations = await getProposalsByParticipant(user.id, 'ARCHITECT');
        
        if (!mounted) return;
        
        console.log('[MeuPotencialArquiteto] Found participations:', participations.length, participations);
        
        if (participations.length === 0) {
          console.log('[MeuPotencialArquiteto] No participations found, showing empty state');
          setPropostas([]);
          setLoading(false);
          return;
        }
        
        // Fetch all proposals to filter by participation
        const response = await openApi.getProposals({ __perPage: 500 });
        
        if (!mounted) return;
        
        const allProposals = (response.data || []) as ApiProposal[];
        const now = new Date();
        
        // Get proposal IDs where architect participates (stored as string in Supabase)
        const participatingProposalIds = new Set(
          participations.map(p => p.proposal_id)
        );
        
        console.log('[MeuPotencialArquiteto] Participating proposal IDs:', Array.from(participatingProposalIds));
        console.log('[MeuPotencialArquiteto] All proposals from API:', allProposals.map(p => ({ id: p.id, status: p.status })));
        
        // Filter to APPROVED proposals where architect is participant
        // Note: proposal_id in Supabase is stored as string of the numeric API ID
        const filteredProposals = allProposals.filter((p) => {
          const normalizedStatus = normalizeStatus(p.status);
          const isApproved = normalizedStatus === 'APPROVED';
          const proposalIdStr = String(p.id);
          const isParticipant = participatingProposalIds.has(proposalIdStr);
          
          if (isParticipant) {
            console.log('[MeuPotencialArquiteto] Proposal', p.id, 'isApproved:', isApproved, 'status:', p.status, 'normalized:', normalizedStatus);
          }
          
          return isApproved && isParticipant;
        });
        
        // Process proposals
        const processed: ProcessedProposal[] = filteredProposals.map((p) => {
          const mrr = p.total || 0;
          const months = p.contract_duration || 12;
          const tcv = mrr * months;
          
          // Get commission from persisted value or calculate
          const participation = participations.find(part => part.proposal_id === String(p.id));
          const commissionRate = participation?.commission_pct ?? getArchitectCommissionPct(months);
          const commissionValue = tcv * commissionRate;
          const installment = commissionValue / 3;
          
          // Calculate age and payment dates
          const baseDate = parseDate(p.approved_at || p.accepted_at || p.updated_at);
          let basePaymentMonth = currentMonthYear.month;
          let basePaymentYear = currentMonthYear.year;
          let ageInDays = 0;
          
          if (baseDate) {
            ageInDays = daysBetween(baseDate, now);
            basePaymentMonth = baseDate.getMonth();
            basePaymentYear = baseDate.getFullYear();
          }
          
          return {
            id: p.id,
            cliente: p.name || 'N/A',
            empresa: p.company || '',
            mrr,
            tcv,
            contract_term_months: months,
            commission_rate: commissionRate,
            commission_value: commissionValue,
            p1: installment,
            p2: installment,
            p3: installment,
            baseDate,
            basePaymentMonth,
            basePaymentYear,
            ageInDays,
            ageStatus: getAgeStatus(ageInDays),
          };
        });
        
        setPropostas(processed);
      } catch (err: any) {
        console.error('[MeuPotencialArquiteto] Error:', err);
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
    return () => { mounted = false; };
  }, [navigate, currentMonthYear]);

  // Calculate totals
  const totals = useMemo(() => {
    return {
      count: propostas.length,
      totalMRR: propostas.reduce((sum, p) => sum + p.mrr, 0),
      totalTCV: propostas.reduce((sum, p) => sum + p.tcv, 0),
      totalCommission: propostas.reduce((sum, p) => sum + p.commission_value, 0),
    };
  }, [propostas]);

  // Group by payment month (3 installments rolling from current month)
  const monthlyGroups = useMemo((): MonthlyGroup[] => {
    const groupMap = new Map<string, MonthlyGroup>();
    
    // Create 6 months of groups starting from current month
    for (let i = 0; i < 6; i++) {
      const my = addMonths(currentMonthYear, i);
      const key = getMonthYearKey(my);
      groupMap.set(key, {
        monthYear: my,
        label: getMonthYearLabel(my),
        installments: [],
        total: 0,
      });
    }
    
    // Distribute installments
    propostas.forEach((p) => {
      const installments: MonthlyInstallment[] = [
        { proposalId: p.id, cliente: p.cliente, parcela: '1/3', valor: p.p1 },
        { proposalId: p.id, cliente: p.cliente, parcela: '2/3', valor: p.p2 },
        { proposalId: p.id, cliente: p.cliente, parcela: '3/3', valor: p.p3 },
      ];
      
      installments.forEach((inst, idx) => {
        const paymentMonth = addMonths(currentMonthYear, idx);
        const key = getMonthYearKey(paymentMonth);
        const group = groupMap.get(key);
        if (group) {
          group.installments.push(inst);
          group.total += inst.valor;
        }
      });
    });
    
    return Array.from(groupMap.values()).filter(g => g.installments.length > 0);
  }, [propostas, currentMonthYear]);

  const toggleMonth = (key: string) => {
    setExpandedMonths(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Simulator example with architect rates
  const simulatorExample = {
    tcv: 100000,
    rate12m: 0.01,
    rate24m: 0.005,
    commission12m: 100000 * 0.01,
    commission24m: 100000 * 0.005,
    installment12m: (100000 * 0.01) / 3,
    installment24m: (100000 * 0.005) / 3,
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Card className="border-destructive">
          <CardContent className="p-6">
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Lightbulb className="h-6 w-6 text-primary" />
            Meu Potencial — Arquiteto de Soluções
          </h1>
          <Badge variant="outline" className="w-fit text-sm">
            <Calculator className="h-4 w-4 mr-2" />
            {getArchitectCommissionRuleText()}
          </Badge>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Propostas Aprovadas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{totals.count}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                MRR Total
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatCurrency(totals.totalMRR)}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                TCV Total
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatCurrency(totals.totalTCV)}</p>
            </CardContent>
          </Card>

          <Card className="bg-primary/5 border-primary/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-primary flex items-center gap-2">
                <Wallet className="h-4 w-4" />
                Comissão Total
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-primary">{formatCurrency(totals.totalCommission)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {formatCurrency(totals.totalCommission / 3)}/mês (3 parcelas)
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Monthly Timeline */}
        {monthlyGroups.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Previsão de Recebimento
              </CardTitle>
              <CardDescription>Parcelas distribuídas nos próximos meses</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {monthlyGroups.map((group) => {
                const key = getMonthYearKey(group.monthYear);
                const isExpanded = expandedMonths[key];
                
                return (
                  <Collapsible key={key} open={isExpanded} onOpenChange={() => toggleMonth(key)}>
                    <CollapsibleTrigger className="w-full">
                      <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
                        <div className="flex items-center gap-3">
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                          <span className="font-medium">{group.label}</span>
                          <Badge variant="secondary">{group.installments.length} parcelas</Badge>
                        </div>
                        <span className="font-bold text-primary">{formatCurrency(group.total)}</span>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="mt-2 pl-8 space-y-1">
                        {group.installments.map((inst, idx) => (
                          <div
                            key={`${inst.proposalId}-${inst.parcela}-${idx}`}
                            className="flex items-center justify-between py-1.5 px-3 text-sm bg-background border rounded"
                          >
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">{inst.parcela}</Badge>
                              <span>{inst.cliente}</span>
                              <span className="text-muted-foreground">#{inst.proposalId}</span>
                            </div>
                            <span className="font-medium">{formatCurrency(inst.valor)}</span>
                          </div>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Proposals Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Propostas Aprovadas
            </CardTitle>
            <CardDescription>
              Propostas onde você participou como Arquiteto de Soluções
            </CardDescription>
          </CardHeader>
          <CardContent>
            {propostas.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Lightbulb className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhuma proposta aprovada encontrada</p>
                <p className="text-sm mt-1">
                  As propostas aparecerão aqui quando você for vinculado como Arquiteto
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead className="text-right">MRR</TableHead>
                      <TableHead className="text-center">Prazo</TableHead>
                      <TableHead className="text-right">TCV</TableHead>
                      <TableHead className="text-center">%</TableHead>
                      <TableHead className="text-right">Comissão</TableHead>
                      <TableHead className="text-right">Parcela 1/3</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {propostas.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-mono text-sm">#{p.id}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{p.cliente}</p>
                            {p.empresa && (
                              <p className="text-xs text-muted-foreground">{p.empresa}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(p.mrr)}</TableCell>
                        <TableCell className="text-center">{p.contract_term_months}m</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(p.tcv)}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline">{(p.commission_rate * 100).toFixed(1)}%</Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium text-primary">
                          {formatCurrency(p.commission_value)}
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(p.p1)}</TableCell>
                        <TableCell className="text-center">{getStatusBadge(p.ageStatus)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Simulator */}
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calculator className="h-5 w-5" />
              Simulador Rápido
            </CardTitle>
            <CardDescription>
              Exemplo: TCV de {formatCurrency(simulatorExample.tcv)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Contrato 12 meses (1%)</p>
                <p className="text-lg font-bold">{formatCurrency(simulatorExample.commission12m)}</p>
                <p className="text-sm text-muted-foreground">
                  3 parcelas de {formatCurrency(simulatorExample.installment12m)}
                </p>
              </div>
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Contrato 24/36/48 meses (0.5%)</p>
                <p className="text-lg font-bold">{formatCurrency(simulatorExample.commission24m)}</p>
                <p className="text-sm text-muted-foreground">
                  3 parcelas de {formatCurrency(simulatorExample.installment24m)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}
