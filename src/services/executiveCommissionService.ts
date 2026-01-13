/**
 * Executive Commission Service - OPEN v2 Policy
 * 
 * ============================================
 * POLÍTICA DE COMISSÃO OPEN v2 (SUBSTITUI TODAS AS ANTERIORES)
 * ============================================
 * 
 * 1️⃣ PERCENTUAL POR PRAZO:
 * - <= 12 meses: 4%
 * - > 12 meses (24/36/48): 2.5%
 * 
 * 2️⃣ MESES COMISSIONÁVEIS:
 * - <= 12 meses: prazo real
 * - > 12 meses: 18 meses (CAP)
 * 
 * 3️⃣ CAP FINANCEIRO (NOVA REGRA - TCV BASED):
 * CAP = min(2% × TCV, R$ 100.000)
 * Onde TCV = valor_mensal × meses_contrato
 * 
 * 4️⃣ FÓRMULA:
 * tcv = monthly_value × contract_term_months
 * gross_commission = monthly_value × months_commissioned × commission_rate
 * cap = min(0.02 × tcv, 100000)
 * final_commission = min(gross_commission, cap)
 * monthly_installment = final_commission / 3
 * 
 * 5️⃣ FONTE DE DADOS:
 * - SOMENTE propostas com status = "APPROVED"
 * - Ignorar DRAFT, SENT, REJECTED, EXPIRED
 */

import { openApi, ApiUser } from '@/lib/openApi';
import { normalizeStatus } from '@/hooks/useProposals';

// ============================================
// CONSTANTS - OPEN v2 POLICY
// ============================================

export const COMMISSION_RATES = {
  SHORT_TERM: 0.04, // <= 12 months = 4%
  LONG_TERM: 0.025, // > 12 months = 2.5%
} as const;

export const INSTALLMENT_COUNT = 3;

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
  prazo_meses: number;
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
  
  // Base values
  monthly_value: number;
  contract_term_months: number;
  
  // TCV (Total Contract Value)
  tcv: number;
  
  // v2 calculations
  months_commissioned: number;
  commission_rate: number;
  gross_commission: number;
  cap: number;
  final_commission: number;
  monthly_installment: number;
  cap_applied: boolean;
  
  // Breakdown for audit
  cap_meses_aplicado: boolean;
  valor_economizado: number;
  
  parcelas: CommissionInstallment[];
  
  status: ProposalStatus;
  data_aprovacao: string;
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
  propostas_com_cap: number;
  economia_cap: number;
}

// API Proposal type
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
    totals?: {
      totalMensal?: number;
    };
  };
}

// ============================================
// CORE CALCULATION FUNCTIONS - OPEN v2
// ============================================

/**
 * Get commission rate based on contract duration
 * RULE: <= 12 months = 4%, > 12 months = 2.5%
 */
export function getCommissionRate(term: number): number {
  return term <= 12 ? COMMISSION_RATES.SHORT_TERM : COMMISSION_RATES.LONG_TERM;
}

/**
 * Get commissionable months based on contract duration
 * RULE: <= 12 = term, > 12 = 18 (CAP)
 */
export function getMonthsCommissioned(term: number): number {
  return term <= 12 ? term : 18;
}

/**
 * Get CAP based on TCV (Total Contract Value)
 * NEW RULE: CAP = min(2% × TCV, R$ 100.000)
 * Where TCV = monthly_value × contract_term_months
 */
export function getCapByTCV(monthlyValue: number, contractTermMonths: number): number {
  const tcv = monthlyValue * contractTermMonths;
  const capPercentual = tcv * 0.02; // 2% do TCV
  return Math.min(capPercentual, 100000); // Teto de R$ 100.000
}

/**
 * @deprecated Use getCapByTCV instead
 * Mantido para compatibilidade - agora calcula baseado em TCV com prazo padrão de 12 meses
 */
export function getCapByTicket(monthlyValue: number): number {
  return getCapByTCV(monthlyValue, 12);
}

/**
 * Calculate complete commission for a proposal - OPEN v2
 */
export function calculateProposalCommission(
  proposal: ExecutiveProposal
): CommissionCalculation {
  const monthlyValue = proposal.mrr_total;
  const contractTermMonths = proposal.prazo_meses;
  
  // Step 1: Get commission rate
  const commissionRate = getCommissionRate(contractTermMonths);
  
  // Step 2: Get months commissioned (CAP at 18 for long terms)
  const monthsCommissioned = getMonthsCommissioned(contractTermMonths);
  const capMesesAplicado = contractTermMonths > 12 && monthsCommissioned < contractTermMonths;
  
  // Step 3: Calculate TCV (Total Contract Value)
  const tcv = monthlyValue * contractTermMonths;
  
  // Step 4: Calculate gross commission
  const grossCommission = monthlyValue * monthsCommissioned * commissionRate;
  
  // Step 5: Get CAP based on TCV (NEW RULE: min(2% × TCV, R$ 100.000))
  const cap = getCapByTCV(monthlyValue, contractTermMonths);
  
  // Step 6: Apply CAP
  const finalCommission = Math.min(grossCommission, cap);
  const capApplied = grossCommission > cap;
  const valorEconomizado = capApplied ? (grossCommission - cap) : 0;
  
  // Step 6: Calculate monthly installment
  const monthlyInstallment = finalCommission / INSTALLMENT_COUNT;
  
  // Step 7: Generate installment schedule
  const dataBase = proposal.data_inicio_faturamento || proposal.data_aprovacao;
  const parcelas = splitIntoInstallments(finalCommission, dataBase);
  
  return {
    proposal_id: proposal.proposal_id,
    executivo_id: proposal.executivo_id,
    executivo_nome: proposal.executivo_nome,
    cliente_nome: proposal.cliente_nome,
    
    monthly_value: monthlyValue,
    contract_term_months: contractTermMonths,
    tcv,
    
    months_commissioned: monthsCommissioned,
    commission_rate: commissionRate,
    gross_commission: grossCommission,
    cap,
    final_commission: finalCommission,
    monthly_installment: monthlyInstallment,
    cap_applied: capApplied,
    
    cap_meses_aplicado: capMesesAplicado,
    valor_economizado: valorEconomizado,
    
    parcelas,
    
    status: proposal.status,
    data_aprovacao: proposal.data_aprovacao,
  };
}

/**
 * Split commission into 3 installments
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
    total_previsto: calculations.reduce((sum, c) => sum + c.final_commission, 0),
    total_a_pagar: calculations.reduce(
      (sum, c) => sum + c.parcelas.filter((p) => p.status === 'pendente').reduce((s, p) => s + p.valor, 0),
      0
    ),
    total_pago: calculations.reduce(
      (sum, c) => sum + c.parcelas.filter((p) => p.status === 'pago').reduce((s, p) => s + p.valor, 0),
      0
    ),
    total_executivos_ativos: executivosUnicos.size,
    propostas_com_cap: calculations.filter((c) => c.cap_applied).length,
    economia_cap: calculations.reduce((sum, c) => sum + c.valor_economizado, 0),
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
    summary.total_previsto += calc.final_commission;
    summary.total_a_pagar += calc.parcelas
      .filter((p) => p.status === 'pendente')
      .reduce((s, p) => s + p.valor, 0);
    summary.total_pago += calc.parcelas
      .filter((p) => p.status === 'pago')
      .reduce((s, p) => s + p.valor, 0);
    
    if (calc.cap_applied) {
      summary.propostas_com_cap += 1;
    }
    summary.economia_total_caps += calc.valor_economizado;
    
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
  const creatorEmail = apiProposal.created_by_email || '';
  const executive = executivesMap.get(creatorEmail.toLowerCase());
  
  if (!executive) {
    console.warn(`[CommissionService] No executive found for email: ${creatorEmail}`);
    return null;
  }
  
  const mrrTotal = apiProposal.dados_proposta?.totals?.totalMensal || apiProposal.total || 0;
  const prazoMeses = apiProposal.contract_duration || 
    apiProposal.dados_proposta?.config?.vigencia || 12;
  
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
    status_pagamento: 'pendente',
    dias_inadimplencia: 0,
    data_aprovacao: apiProposal.updated_at || apiProposal.created_at,
    data_inicio_faturamento: null,
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
 * Fetch APPROVED proposals from API
 * RULE: Only status = "APPROVED" generates commission
 */
export async function fetchApprovedProposals(): Promise<ApiProposalData[]> {
  try {
    const response = await openApi.getProposals({
      channel_type: 'CLIENTE',
      __perPage: 200,
    });
    
    const proposals = (response.data || []) as ApiProposalData[];
    
    // ONLY APPROVED proposals
    return proposals.filter((p) => {
      const normalized = normalizeStatus(p.status);
      return normalized === 'APPROVED';
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
    const [executivesMap, proposals] = await Promise.all([
      fetchExecutives(),
      fetchApprovedProposals(),
    ]);
    
    console.log(`[CommissionService] Loaded ${executivesMap.size} executives and ${proposals.length} APPROVED proposals`);
    
    const executiveProposals: ExecutiveProposal[] = proposals
      .map((p) => transformApiProposal(p, executivesMap))
      .filter((p): p is ExecutiveProposal => p !== null);
    
    console.log(`[CommissionService] Transformed ${executiveProposals.length} proposals for commission calculation`);
    
    const commissions = executiveProposals.map((p) => calculateProposalCommission(p));
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
        propostas_com_cap: 0,
        economia_cap: 0,
      },
      executiveSummaries: [],
      loading: false,
      error: error instanceof Error ? error.message : 'Erro ao carregar comissões',
    };
  }
}
