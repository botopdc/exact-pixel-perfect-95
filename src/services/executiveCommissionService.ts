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
// MOCK DATA FOR DEVELOPMENT
// ============================================

export function getMockProposals(): ExecutiveProposal[] {
  return [
    {
      proposal_id: 'prop-001',
      executivo_id: 'exec-001',
      executivo_nome: 'Carlos Silva',
      cliente_nome: 'Tech Solutions Ltda',
      mrr_total: 15000,
      prazo_meses: 36,
      status: 'validada',
      status_pagamento: 'pendente',
      dias_inadimplencia: 0,
      data_aprovacao: '2025-01-15',
      data_inicio_faturamento: '2025-02-01',
    },
    {
      proposal_id: 'prop-002',
      executivo_id: 'exec-001',
      executivo_nome: 'Carlos Silva',
      cliente_nome: 'Inovação Digital SA',
      mrr_total: 50000,
      prazo_meses: 48,
      status: 'validada',
      status_pagamento: 'pendente',
      dias_inadimplencia: 0,
      data_aprovacao: '2025-01-10',
      data_inicio_faturamento: '2025-02-01',
    },
    {
      proposal_id: 'prop-003',
      executivo_id: 'exec-002',
      executivo_nome: 'Maria Oliveira',
      cliente_nome: 'Startup ABC',
      mrr_total: 8000,
      prazo_meses: 12,
      status: 'validada',
      status_pagamento: 'pago',
      dias_inadimplencia: 0,
      data_aprovacao: '2024-12-01',
      data_inicio_faturamento: '2024-12-15',
    },
    {
      proposal_id: 'prop-004',
      executivo_id: 'exec-002',
      executivo_nome: 'Maria Oliveira',
      cliente_nome: 'Grande Empresa Corp',
      mrr_total: 100000,
      prazo_meses: 36,
      status: 'validada',
      status_pagamento: 'pendente',
      dias_inadimplencia: 0,
      data_aprovacao: '2025-01-20',
      data_inicio_faturamento: '2025-02-01',
    },
    {
      proposal_id: 'prop-005',
      executivo_id: 'exec-003',
      executivo_nome: 'João Santos',
      cliente_nome: 'Médio Porte Ltda',
      mrr_total: 25000,
      prazo_meses: 24,
      status: 'validada',
      status_pagamento: 'suspenso',
      dias_inadimplencia: 45,
      data_aprovacao: '2024-11-01',
      data_inicio_faturamento: '2024-11-15',
    },
  ];
}

export function getCalculatedCommissions(): CommissionCalculation[] {
  const proposals = getMockProposals();
  return proposals.map((p) => calculateProposalCommission(p));
}
