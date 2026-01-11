/**
 * Executive Commission Service
 * Centralizes all commission calculation logic with CAP rules
 * 
 * Rules (Pacto 2026):
 * - 12 months: 4%
 * - 24/36/48 months: 2.5%
 * - Commission split into 3 monthly installments
 * - Delinquency > 30 days suspends commission
 * - Cancellation ≤ 90 days removes last installment
 * 
 * CAP Rules:
 * - CAP 1: Maximum 12 months for commission calculation regardless of contract duration
 * - CAP 2: Maximum R$ 20,000 per proposal
 */

import { openApi, ApiUser } from '@/lib/openApi';

// ============================================
// CONSTANTS (Fixed - No dynamic configuration)
// ============================================
export const COMMISSION_CAPS = {
  MAX_COMMISSIONABLE_MONTHS: 12,
  MAX_COMMISSION_PER_PROPOSAL: 20000,
} as const;

export const COMMISSION_RATES = {
  SHORT_TERM: 0.04, // 12 months = 4%
  LONG_TERM: 0.025, // 24/36/48 months = 2.5%
} as const;

export const INSTALLMENT_COUNT = 3;
export const DELINQUENCY_SUSPENSION_DAYS = 30;
export const CANCELLATION_GRACE_DAYS = 90;

// ============================================
// TYPES
// ============================================
export type ProposalStatus = 'aprovada' | 'validada' | 'pendente' | 'rejeitada' | 'cancelada';
export type PaymentStatus = 'pendente' | 'pago' | 'suspenso' | 'cancelado';

export interface ExecutiveProposal {
  proposal_id: string;
  executivo_id: string;
  executivo_nome: string;
  cliente_nome: string;
  mrr_total: number;
  prazo_meses: 12 | 24 | 36 | 48;
  status: ProposalStatus;
  status_pagamento: PaymentStatus;
  dias_inadimplencia: number;
  data_aprovacao: string;
  data_inicio_faturamento: string | null;
  data_cancelamento?: string | null;
}

export interface CommissionInstallment {
  numero: 1 | 2 | 3;
  valor: number;
  data_prevista: string;
  data_pagamento: string | null;
  status: PaymentStatus;
  motivo_suspensao?: string;
}

export interface CommissionCalculation {
  proposal_id: string;
  executivo_id: string;
  executivo_nome: string;
  cliente_nome: string;
  mrr_total: number;
  prazo_meses: number;
  
  // CAP calculations
  meses_comissionaveis: number;
  cap_meses_aplicado: boolean;
  
  taxa_comissao: number;
  base_calculo: number; // mrr_total × meses_comissionaveis
  
  comissao_bruta: number; // taxa × base_calculo
  bonus_atingimento: number;
  comissao_antes_cap: number;
  comissao_apos_cap: number;
  cap_valor_aplicado: boolean;
  
  valor_economizado_cap_meses: number;
  valor_economizado_cap_valor: number;
  
  parcelas: CommissionInstallment[];
  
  status: ProposalStatus;
  status_pagamento: PaymentStatus;
  dias_inadimplencia: number;
  
  data_aprovacao: string;
  data_inicio_faturamento: string | null;
}

export interface ExecutiveCommissionSummary {
  executivo_id: string;
  executivo_nome: string;
  total_propostas: number;
  total_previsto: number;
  total_a_pagar: number;
  total_pago: number;
  propostas_com_cap: number;
  economia_total_caps: number;
}

export interface CommissionStats {
  total_previsto: number;
  total_a_pagar: number;
  total_pago: number;
  total_executivos_ativos: number;
  propostas_com_cap_meses: number;
  propostas_com_cap_valor: number;
  economia_cap_meses: number;
  economia_cap_valor: number;
}

// API Proposal type (from external API)
export interface ApiProposalData {
  id: number;
  name: string;
  company: string;
  email: string;
  phone: string;
  total: number;
  contract_duration: number;
  discount_pct: number;
  status?: string;
  channel_type?: string;
  created_by_email?: string;
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

// ============================================
// CORE CALCULATION FUNCTIONS
// ============================================

/**
 * Get commissionable months (CAP at 12 months)
 */
export function getCommissionableMonths(prazoMeses: number): number {
  return Math.min(prazoMeses, COMMISSION_CAPS.MAX_COMMISSIONABLE_MONTHS);
}

/**
 * Get commission rate based on contract duration
 */
export function getCommissionRate(prazoMeses: number): number {
  return prazoMeses <= 12 ? COMMISSION_RATES.SHORT_TERM : COMMISSION_RATES.LONG_TERM;
}

/**
 * Calculate base commission (before bonus and caps)
 */
export function calculateBaseCommission(
  mrrTotal: number,
  mesesComissionaveis: number,
  taxa: number
): number {
  return taxa * (mrrTotal * mesesComissionaveis);
}

/**
 * Apply bonus based on monthly achievement (placeholder - configurable)
 */
export function applyBonus(comissaoBase: number, percentualAtingimento: number): number {
  // Bonus tiers based on achievement percentage
  let bonusMultiplier = 0;
  
  if (percentualAtingimento >= 150) {
    bonusMultiplier = 0.20; // 20% bonus
  } else if (percentualAtingimento >= 120) {
    bonusMultiplier = 0.10; // 10% bonus
  } else if (percentualAtingimento >= 100) {
    bonusMultiplier = 0.05; // 5% bonus
  }
  
  return comissaoBase * bonusMultiplier;
}

/**
 * Apply proposal cap (R$ 20,000 maximum)
 */
export function applyProposalCap(valor: number): number {
  return Math.min(valor, COMMISSION_CAPS.MAX_COMMISSION_PER_PROPOSAL);
}

/**
 * Split commission into installments
 */
export function splitIntoInstallments(
  valorTotal: number,
  dataInicio: string
): CommissionInstallment[] {
  const valorParcela = valorTotal / INSTALLMENT_COUNT;
  const startDate = new Date(dataInicio);
  
  return [1, 2, 3].map((numero) => {
    const dataPrevista = new Date(startDate);
    dataPrevista.setMonth(dataPrevista.getMonth() + numero);
    
    return {
      numero: numero as 1 | 2 | 3,
      valor: valorParcela,
      data_prevista: dataPrevista.toISOString().split('T')[0],
      data_pagamento: null,
      status: 'pendente' as PaymentStatus,
    };
  });
}

/**
 * Check if commission should be suspended due to delinquency
 */
export function shouldSuspendCommission(diasInadimplencia: number): boolean {
  return diasInadimplencia > DELINQUENCY_SUSPENSION_DAYS;
}

/**
 * Check if last installment should be removed due to early cancellation
 */
export function shouldRemoveLastInstallment(
  dataCancelamento: string | null,
  dataInicioFaturamento: string | null
): boolean {
  if (!dataCancelamento || !dataInicioFaturamento) return false;
  
  const cancelDate = new Date(dataCancelamento);
  const startDate = new Date(dataInicioFaturamento);
  const diffDays = Math.floor(
    (cancelDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
  );
  
  return diffDays <= CANCELLATION_GRACE_DAYS;
}

// ============================================
// MAIN CALCULATION FUNCTION
// ============================================

/**
 * Calculate complete commission for a proposal
 */
export function calculateProposalCommission(
  proposal: ExecutiveProposal,
  percentualAtingimento: number = 0
): CommissionCalculation {
  // Step 1: Get rate based on contract duration
  const taxa = getCommissionRate(proposal.prazo_meses);
  
  // Step 2: Get commissionable months (CAP at 12)
  const mesesComissionaveis = getCommissionableMonths(proposal.prazo_meses);
  const capMesesAplicado = proposal.prazo_meses > COMMISSION_CAPS.MAX_COMMISSIONABLE_MONTHS;
  
  // Step 3: Calculate base commission
  const baseCalculo = proposal.mrr_total * mesesComissionaveis;
  const comissaoBruta = calculateBaseCommission(proposal.mrr_total, mesesComissionaveis, taxa);
  
  // Calculate what it would be without month cap
  const comissaoSemCapMeses = calculateBaseCommission(proposal.mrr_total, proposal.prazo_meses, taxa);
  const valorEconomizadoCapMeses = comissaoSemCapMeses - comissaoBruta;
  
  // Step 4: Apply bonus
  const bonus = applyBonus(comissaoBruta, percentualAtingimento);
  const comissaoAntesCapValor = comissaoBruta + bonus;
  
  // Step 5: Apply proposal cap (R$ 20,000)
  const comissaoAposCap = applyProposalCap(comissaoAntesCapValor);
  const capValorAplicado = comissaoAntesCapValor > COMMISSION_CAPS.MAX_COMMISSION_PER_PROPOSAL;
  const valorEconomizadoCapValor = capValorAplicado 
    ? comissaoAntesCapValor - COMMISSION_CAPS.MAX_COMMISSION_PER_PROPOSAL 
    : 0;
  
  // Step 6: Split into installments
  const dataBase = proposal.data_inicio_faturamento || proposal.data_aprovacao;
  let parcelas = splitIntoInstallments(comissaoAposCap, dataBase);
  
  // Step 7: Apply suspension/cancellation rules
  if (shouldSuspendCommission(proposal.dias_inadimplencia)) {
    parcelas = parcelas.map((p) => ({
      ...p,
      status: p.status === 'pago' ? 'pago' : 'suspenso',
      motivo_suspensao: `Inadimplência > ${DELINQUENCY_SUSPENSION_DAYS} dias`,
    }));
  }
  
  if (shouldRemoveLastInstallment(proposal.data_cancelamento || null, proposal.data_inicio_faturamento)) {
    parcelas[2] = {
      ...parcelas[2],
      valor: 0,
      status: 'cancelado',
      motivo_suspensao: `Cancelamento em ≤ ${CANCELLATION_GRACE_DAYS} dias`,
    };
  }
  
  return {
    proposal_id: proposal.proposal_id,
    executivo_id: proposal.executivo_id,
    executivo_nome: proposal.executivo_nome,
    cliente_nome: proposal.cliente_nome,
    mrr_total: proposal.mrr_total,
    prazo_meses: proposal.prazo_meses,
    
    meses_comissionaveis: mesesComissionaveis,
    cap_meses_aplicado: capMesesAplicado,
    
    taxa_comissao: taxa,
    base_calculo: baseCalculo,
    
    comissao_bruta: comissaoBruta,
    bonus_atingimento: bonus,
    comissao_antes_cap: comissaoAntesCapValor,
    comissao_apos_cap: comissaoAposCap,
    cap_valor_aplicado: capValorAplicado,
    
    valor_economizado_cap_meses: valorEconomizadoCapMeses,
    valor_economizado_cap_valor: valorEconomizadoCapValor,
    
    parcelas,
    
    status: proposal.status,
    status_pagamento: proposal.status_pagamento,
    dias_inadimplencia: proposal.dias_inadimplencia,
    
    data_aprovacao: proposal.data_aprovacao,
    data_inicio_faturamento: proposal.data_inicio_faturamento,
  };
}

// ============================================
// AGGREGATION FUNCTIONS
// ============================================

/**
 * Calculate stats for all commissions
 */
export function calculateCommissionStats(
  calculations: CommissionCalculation[]
): CommissionStats {
  const executivosUnicos = new Set(calculations.map((c) => c.executivo_id));
  
  return {
    total_previsto: calculations.reduce((sum, c) => sum + c.comissao_apos_cap, 0),
    total_a_pagar: calculations.reduce(
      (sum, c) => sum + c.parcelas.filter((p) => p.status === 'pendente').reduce((s, p) => s + p.valor, 0),
      0
    ),
    total_pago: calculations.reduce(
      (sum, c) => sum + c.parcelas.filter((p) => p.status === 'pago').reduce((s, p) => s + p.valor, 0),
      0
    ),
    total_executivos_ativos: executivosUnicos.size,
    propostas_com_cap_meses: calculations.filter((c) => c.cap_meses_aplicado).length,
    propostas_com_cap_valor: calculations.filter((c) => c.cap_valor_aplicado).length,
    economia_cap_meses: calculations.reduce((sum, c) => sum + c.valor_economizado_cap_meses, 0),
    economia_cap_valor: calculations.reduce((sum, c) => sum + c.valor_economizado_cap_valor, 0),
  };
}

/**
 * Group commissions by executive
 */
export function groupByExecutive(
  calculations: CommissionCalculation[]
): ExecutiveCommissionSummary[] {
  const grouped = calculations.reduce((acc, calc) => {
    if (!acc[calc.executivo_id]) {
      acc[calc.executivo_id] = {
        executivo_id: calc.executivo_id,
        executivo_nome: calc.executivo_nome,
        total_propostas: 0,
        total_previsto: 0,
        total_a_pagar: 0,
        total_pago: 0,
        propostas_com_cap: 0,
        economia_total_caps: 0,
      };
    }
    
    const summary = acc[calc.executivo_id];
    summary.total_propostas += 1;
    summary.total_previsto += calc.comissao_apos_cap;
    summary.total_a_pagar += calc.parcelas
      .filter((p) => p.status === 'pendente')
      .reduce((s, p) => s + p.valor, 0);
    summary.total_pago += calc.parcelas
      .filter((p) => p.status === 'pago')
      .reduce((s, p) => s + p.valor, 0);
    
    if (calc.cap_meses_aplicado || calc.cap_valor_aplicado) {
      summary.propostas_com_cap += 1;
    }
    summary.economia_total_caps += calc.valor_economizado_cap_meses + calc.valor_economizado_cap_valor;
    
    return acc;
  }, {} as Record<string, ExecutiveCommissionSummary>);
  
  return Object.values(grouped);
}

// ============================================
// API INTEGRATION FUNCTIONS
// ============================================

/**
 * Transform API proposal data to internal ExecutiveProposal format
 */
export function transformApiProposal(
  apiProposal: ApiProposalData,
  executivesMap: Map<string, ApiUser>
): ExecutiveProposal | null {
  // Get the creator email to find the executive
  const creatorEmail = apiProposal.created_by_email || '';
  const executive = executivesMap.get(creatorEmail.toLowerCase());
  
  // If no executive found, skip this proposal
  if (!executive) {
    console.warn(`[CommissionService] No executive found for email: ${creatorEmail}`);
    return null;
  }
  
  // Calculate MRR from total (total is the monthly value)
  const mrrTotal = apiProposal.total || 0;
  
  // Get contract duration
  const prazoMeses = (apiProposal.contract_duration || 
    apiProposal.dados_proposta?.config?.vigencia || 12) as 12 | 24 | 36 | 48;
  
  // Determine status based on API data
  const apiStatus = (apiProposal.status || '').toLowerCase();
  let status: ProposalStatus = 'pendente';
  if (apiStatus === 'aprovada' || apiStatus === 'approved') {
    status = 'aprovada';
  } else if (apiStatus === 'validada' || apiStatus === 'validated') {
    status = 'validada';
  } else if (apiStatus === 'rejeitada' || apiStatus === 'rejected') {
    status = 'rejeitada';
  } else if (apiStatus === 'cancelada' || apiStatus === 'cancelled') {
    status = 'cancelada';
  }
  
  // Get client name
  const clienteNome = apiProposal.company || 
    apiProposal.dados_proposta?.cliente?.empresa || 
    apiProposal.name || 
    'Cliente não identificado';
  
  return {
    proposal_id: String(apiProposal.id),
    executivo_id: String(executive.id),
    executivo_nome: executive.name,
    cliente_nome: clienteNome,
    mrr_total: mrrTotal,
    prazo_meses: prazoMeses,
    status,
    status_pagamento: 'pendente', // Default, would come from financial system
    dias_inadimplencia: 0, // Default, would come from financial system
    data_aprovacao: apiProposal.created_at,
    data_inicio_faturamento: null, // Would come from financial system
    data_cancelamento: null,
  };
}

/**
 * Fetch executives (level 700) from API
 */
export async function fetchExecutives(): Promise<Map<string, ApiUser>> {
  try {
    const response = await openApi.getUsers({ 
      level: 700, 
      __perPage: 100 
    });
    
    const executives = response.data || [];
    const map = new Map<string, ApiUser>();
    
    for (const exec of executives) {
      if (exec.email) {
        map.set(exec.email.toLowerCase(), exec);
      }
    }
    
    return map;
  } catch (error) {
    console.error('[CommissionService] Error fetching executives:', error);
    return new Map();
  }
}

/**
 * Fetch approved/validated proposals from API
 */
export async function fetchApprovedProposals(): Promise<ApiProposalData[]> {
  try {
    // Fetch proposals with channel_type = CLIENTE (executive proposals)
    const response = await openApi.getProposals({
      channel_type: 'CLIENTE',
      __perPage: 200,
    });
    
    const proposals = (response.data || []) as ApiProposalData[];
    
    // Filter for approved/validated proposals only
    return proposals.filter((p) => {
      const status = (p.status || '').toLowerCase();
      return status === 'aprovada' || status === 'validada' || 
             status === 'approved' || status === 'validated';
    });
  } catch (error) {
    console.error('[CommissionService] Error fetching proposals:', error);
    return [];
  }
}

/**
 * Fetch and calculate all executive commissions from real API data
 */
export async function fetchAndCalculateCommissions(): Promise<{
  commissions: CommissionCalculation[];
  stats: CommissionStats;
  executiveSummaries: ExecutiveCommissionSummary[];
  loading: boolean;
  error: string | null;
}> {
  try {
    // Fetch executives and proposals in parallel
    const [executivesMap, proposals] = await Promise.all([
      fetchExecutives(),
      fetchApprovedProposals(),
    ]);
    
    console.log(`[CommissionService] Loaded ${executivesMap.size} executives and ${proposals.length} approved proposals`);
    
    // Transform API proposals to internal format
    const executiveProposals: ExecutiveProposal[] = proposals
      .map((p) => transformApiProposal(p, executivesMap))
      .filter((p): p is ExecutiveProposal => p !== null);
    
    console.log(`[CommissionService] Transformed ${executiveProposals.length} proposals for commission calculation`);
    
    // Calculate commissions for each proposal
    const commissions = executiveProposals.map((p) => calculateProposalCommission(p));
    
    // Calculate aggregated stats
    const stats = calculateCommissionStats(commissions);
    const executiveSummaries = groupByExecutive(commissions);
    
    return {
      commissions,
      stats,
      executiveSummaries,
      loading: false,
      error: null,
    };
  } catch (error) {
    console.error('[CommissionService] Error calculating commissions:', error);
    return {
      commissions: [],
      stats: {
        total_previsto: 0,
        total_a_pagar: 0,
        total_pago: 0,
        total_executivos_ativos: 0,
        propostas_com_cap_meses: 0,
        propostas_com_cap_valor: 0,
        economia_cap_meses: 0,
        economia_cap_valor: 0,
      },
      executiveSummaries: [],
      loading: false,
      error: error instanceof Error ? error.message : 'Erro ao carregar comissões',
    };
  }
}
