/**
 * Executive Commission Service - OPEN 2026 Policy (v3)
 * 
 * ============================================
 * POLÍTICA DE COMISSÃO OPEN 2026 - SEM CAP
 * ============================================
 * 
 * 1️⃣ REGRA DE COMISSÃO POR DURAÇÃO:
 * - 1 mês = 4% do TCV
 * - 12 meses = 4% do TCV
 * - 24 meses = 2.5% do TCV
 * - 36 meses = 2.5% do TCV
 * - 48 meses = 2.5% do TCV
 * - Fallback: < 24 meses = 4%, >= 24 meses = 2.5%
 * 
 * 2️⃣ TCV = campo "total" da proposta (Total do Contrato)
 * 
 * 3️⃣ NÃO HÁ CAP - Comissão é calculada sem teto
 * 
 * 4️⃣ PAGAMENTO: Sempre 3 parcelas iguais (3x)
 * 
 * 5️⃣ FÓRMULA:
 * comissao = TCV × taxa
 * parcela = comissao / 3
 * 
 * 6️⃣ FONTE DE DADOS:
 * - SOMENTE propostas com status = "APPROVED"
 */

import { openApi, ApiUser } from '@/lib/openApi';
import { normalizeStatus } from '@/hooks/useProposals';

// ============================================
// CONSTANTS - OPEN 2026 Policy v3 (NO CAP)
// ============================================

export const COMMISSION_RATES = {
  SHORT_TERM: 0.04, // 1, 12 months or < 24 months = 4%
  LONG_TERM: 0.025, // 24, 36, 48 months or >= 24 months = 2.5%
} as const;

export const STANDARD_DURATIONS = [1, 12, 24, 36, 48] as const;
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
  tcv: number; // Total Contract Value (campo "total" da API)
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
  data_prevista: string | null;
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
  tcv: number; // Total Contract Value
  contract_term_months: number;
  
  // Commission calculation (NO CAP)
  commission_rate: number;
  commission_value: number;
  
  // Installments
  installment_value: number;
  parcelas: CommissionInstallment[];
  
  // UI helpers
  is_standard_duration: boolean;
  
  status: ProposalStatus;
  data_aprovacao: string;
}

export interface ExecutiveCommissionSummary {
  executivo_id: string;
  executivo_nome: string;
  total_propostas: number;
  total_tcv: number;
  total_comissao: number;
  taxa_media_ponderada: number;
}

export interface CommissionStats {
  total_tcv: number;
  total_comissao: number;
  total_contratos: number;
  total_executivos_ativos: number;
  taxa_media_ponderada: number;
}

// API Proposal type
export interface ApiProposalData {
  id: number;
  name: string;
  company: string;
  email: string;
  phone: string;
  total: number; // TCV - Total Contract Value
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
// CORE CALCULATION FUNCTIONS - NO CAP
// ============================================

/**
 * Round to 2 decimal places for BRL currency
 */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Compute commission percentage based on contract duration
 * RULES:
 * - 1, 12 months = 4%
 * - 24, 36, 48 months = 2.5%
 * - Fallback: < 24 months = 4%, >= 24 months = 2.5%
 */
export function computeCommissionPct(durationMonths: number): number {
  // Standard durations
  if (durationMonths === 1 || durationMonths === 12) {
    return COMMISSION_RATES.SHORT_TERM; // 4%
  }
  if (durationMonths === 24 || durationMonths === 36 || durationMonths === 48) {
    return COMMISSION_RATES.LONG_TERM; // 2.5%
  }
  
  // Fallback for non-standard durations
  return durationMonths < 24 ? COMMISSION_RATES.SHORT_TERM : COMMISSION_RATES.LONG_TERM;
}

/**
 * Compute commission value from TCV and duration
 * NO CAP - Simple multiplication
 */
export function computeCommissionValue(tcv: number, durationMonths: number): number {
  const rate = computeCommissionPct(durationMonths);
  return round2(tcv * rate);
}

/**
 * Compute 3 installments from commission value
 * Ensures exact sum by adjusting the 3rd installment
 */
export function computeInstallments(commissionValue: number): { p1: number; p2: number; p3: number; total: number } {
  const baseInstallment = round2(commissionValue / 3);
  const p1 = baseInstallment;
  const p2 = baseInstallment;
  const p3 = round2(commissionValue - p1 - p2); // Ensures exact sum
  
  return {
    p1,
    p2,
    p3,
    total: round2(p1 + p2 + p3),
  };
}

/**
 * Check if duration is standard (shows badge if not)
 */
export function isStandardDuration(durationMonths: number): boolean {
  return STANDARD_DURATIONS.includes(durationMonths as typeof STANDARD_DURATIONS[number]);
}

/**
 * Calculate complete commission for a proposal - NO CAP
 */
export function calculateProposalCommission(
  proposal: ExecutiveProposal
): CommissionCalculation {
  const tcv = proposal.tcv;
  const contractTermMonths = proposal.prazo_meses;
  
  // Step 1: Get commission rate
  const commissionRate = computeCommissionPct(contractTermMonths);
  
  // Step 2: Calculate commission value (NO CAP)
  const commissionValue = computeCommissionValue(tcv, contractTermMonths);
  
  // Step 3: Calculate installments (3x)
  const installments = computeInstallments(commissionValue);
  const installmentValue = installments.p1; // Use first installment for display
  
  // Step 4: Generate installment schedule
  const dataBase = proposal.data_inicio_faturamento || proposal.data_aprovacao;
  const parcelas = createInstallmentSchedule(installments, dataBase);
  
  // Step 5: Check if standard duration
  const isStandard = isStandardDuration(contractTermMonths);
  
  return {
    proposal_id: proposal.proposal_id,
    executivo_id: proposal.executivo_id,
    executivo_nome: proposal.executivo_nome,
    cliente_nome: proposal.cliente_nome,
    
    tcv,
    contract_term_months: contractTermMonths,
    
    commission_rate: commissionRate,
    commission_value: commissionValue,
    
    installment_value: installmentValue,
    parcelas,
    
    is_standard_duration: isStandard,
    
    status: proposal.status,
    data_aprovacao: proposal.data_aprovacao,
  };
}

/**
 * Create installment schedule from computed installments
 */
function createInstallmentSchedule(
  installments: { p1: number; p2: number; p3: number },
  dataInicio: string | null
): CommissionInstallment[] {
  const valores = [installments.p1, installments.p2, installments.p3];
  
  return valores.map((valor, index) => {
    const numero = (index + 1) as 1 | 2 | 3;
    let dataPrevista: string | null = null;
    
    if (dataInicio) {
      try {
        const startDate = new Date(dataInicio);
        const paymentDate = new Date(startDate);
        paymentDate.setMonth(paymentDate.getMonth() + numero);
        dataPrevista = paymentDate.toISOString().split('T')[0];
      } catch {
        dataPrevista = null;
      }
    }
    
    return {
      numero,
      valor: round2(valor),
      data_prevista: dataPrevista,
      data_pagamento: null,
      status: 'pendente' as PaymentStatus,
    };
  });
}

// ============================================
// AGGREGATION FUNCTIONS
// ============================================

/**
 * Calculate stats for all commissions - NO CAP
 */
export function calculateCommissionStats(
  calculations: CommissionCalculation[]
): CommissionStats {
  const executivosUnicos = new Set(calculations.map((c) => c.executivo_id));
  
  const totalTcv = calculations.reduce((sum, c) => sum + c.tcv, 0);
  const totalComissao = calculations.reduce((sum, c) => sum + c.commission_value, 0);
  
  // Taxa média ponderada por TCV
  const taxaMediaPonderada = totalTcv > 0
    ? calculations.reduce((sum, c) => sum + (c.commission_rate * c.tcv), 0) / totalTcv
    : 0;
  
  return {
    total_tcv: round2(totalTcv),
    total_comissao: round2(totalComissao),
    total_contratos: calculations.length,
    total_executivos_ativos: executivosUnicos.size,
    taxa_media_ponderada: round2(taxaMediaPonderada * 100) / 100,
  };
}

/**
 * Group commissions by executive - NO CAP
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
        total_tcv: 0,
        total_comissao: 0,
        taxa_media_ponderada: 0,
      };
    }
    
    const summary = acc[calc.executivo_id];
    summary.total_propostas += 1;
    summary.total_tcv += calc.tcv;
    summary.total_comissao += calc.commission_value;
    
    return acc;
  }, {} as Record<string, ExecutiveCommissionSummary>);
  
  // Calculate weighted average rate for each executive
  return Object.values(grouped).map((summary) => {
    const executiveCalcs = calculations.filter((c) => c.executivo_id === summary.executivo_id);
    const weightedSum = executiveCalcs.reduce((sum, c) => sum + (c.commission_rate * c.tcv), 0);
    summary.taxa_media_ponderada = summary.total_tcv > 0 ? round2(weightedSum / summary.total_tcv) : 0;
    summary.total_tcv = round2(summary.total_tcv);
    summary.total_comissao = round2(summary.total_comissao);
    return summary;
  });
}

// ============================================
// API INTEGRATION FUNCTIONS
// ============================================

// Extended API proposal type with created_by
export interface ApiProposalDataExtended extends ApiProposalData {
  created_by?: number;
  accepted_at?: string;
  approved_at?: string;
}

/**
 * Transform API proposal data to internal ExecutiveProposal format
 * Uses created_by ID to match executives
 */
export function transformApiProposalById(
  apiProposal: ApiProposalDataExtended,
  executivesById: Map<number, ApiUser>
): ExecutiveProposal | null {
  const createdById = apiProposal.created_by;
  
  if (!createdById) {
    console.warn(`[CommissionService] No created_by for proposal ${apiProposal.id}`);
    return null;
  }
  
  const executive = executivesById.get(createdById);
  
  if (!executive) {
    // Not an executive (could be admin, partner, etc.)
    return null;
  }
  
  // TCV = campo "total" da proposta
  const tcv = apiProposal.total || 0;
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
  
  // Use accepted_at > approved_at > updated_at > created_at for approval date
  const dataAprovacao = apiProposal.accepted_at || 
    (apiProposal as any).approved_at || 
    apiProposal.updated_at || 
    apiProposal.created_at;
  
  return {
    proposal_id: String(apiProposal.id),
    executivo_id: String(executive.id),
    executivo_nome: executive.name,
    cliente_nome: clienteNome,
    tcv,
    prazo_meses: prazoMeses,
    status,
    status_pagamento: 'pendente',
    dias_inadimplencia: 0,
    data_aprovacao: dataAprovacao,
    data_inicio_faturamento: null,
    data_cancelamento: null,
  };
}

/**
 * Fetch executives (level 700) from API with pagination
 * Returns map by ID for faster lookup
 */
export async function fetchExecutivesById(): Promise<Map<number, ApiUser>> {
  try {
    const allExecutives: ApiUser[] = [];
    let page = 1;
    const perPage = 100;
    let hasMore = true;
    
    while (hasMore) {
      const response = await openApi.getUsers({ 
        level: 700, 
        __page: page,
        __perPage: perPage,
      });
      
      const executives = response.data || [];
      allExecutives.push(...executives);
      
      // Check if there are more pages
      hasMore = executives.length === perPage;
      page++;
      
      // Safety limit
      if (page > 50) break;
    }
    
    const map = new Map<number, ApiUser>();
    for (const exec of allExecutives) {
      map.set(exec.id, exec);
    }
    
    console.log(`[CommissionService] Fetched ${map.size} executives`);
    return map;
  } catch (error) {
    console.error('[CommissionService] Error fetching executives:', error);
    return new Map();
  }
}

/**
 * Fetch ALL APPROVED proposals from API with pagination
 * RULE: Only status = "APPROVED" generates commission
 */
export async function fetchAllApprovedProposals(): Promise<ApiProposalDataExtended[]> {
  try {
    const allProposals: ApiProposalDataExtended[] = [];
    let page = 1;
    const perPage = 200;
    let hasMore = true;
    
    while (hasMore) {
      const response = await openApi.getProposals({
        __page: page,
        __perPage: perPage,
      });
      
      const proposals = (response.data || []) as ApiProposalDataExtended[];
      
      // Filter APPROVED only
      const approved = proposals.filter((p) => {
        const normalized = normalizeStatus(p.status);
        return normalized === 'APPROVED';
      });
      
      allProposals.push(...approved);
      
      // Check if there are more pages
      hasMore = proposals.length === perPage;
      page++;
      
      // Safety limit
      if (page > 100) break;
    }
    
    console.log(`[CommissionService] Fetched ${allProposals.length} APPROVED proposals`);
    return allProposals;
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
    const [executivesById, proposals] = await Promise.all([
      fetchExecutivesById(),
      fetchAllApprovedProposals(),
    ]);
    
    console.log(`[CommissionService] Loaded ${executivesById.size} executives and ${proposals.length} APPROVED proposals`);
    
    // Filter proposals by executives (channel_type = CLIENTE or empty, created_by in executives)
    const executiveProposals: ExecutiveProposal[] = proposals
      .filter((p) => {
        // Only CLIENTE or empty channel_type (not PARCEIRO)
        const channelType = (p.channel_type || '').toUpperCase();
        return channelType === 'CLIENTE' || channelType === '';
      })
      .map((p) => transformApiProposalById(p, executivesById))
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
        total_tcv: 0,
        total_comissao: 0,
        total_contratos: 0,
        total_executivos_ativos: 0,
        taxa_media_ponderada: 0,
      },
      executiveSummaries: [],
      loading: false,
      error: error instanceof Error ? error.message : 'Erro ao carregar comissões',
    };
  }
}

// Legacy function for backwards compatibility
export function transformApiProposal(
  apiProposal: ApiProposalData,
  executivesMap: Map<string, ApiUser>
): ExecutiveProposal | null {
  const creatorEmail = apiProposal.created_by_email || '';
  const executive = executivesMap.get(creatorEmail.toLowerCase());
  
  if (!executive) {
    return null;
  }
  
  const tcv = apiProposal.total || 0;
  const prazoMeses = apiProposal.contract_duration || 
    apiProposal.dados_proposta?.config?.vigencia || 12;
  
  const apiStatus = (apiProposal.status || '').toLowerCase();
  let status: ProposalStatus = 'pendente';
  if (apiStatus === 'aprovada' || apiStatus === 'approved') {
    status = 'aprovada';
  }
  
  return {
    proposal_id: String(apiProposal.id),
    executivo_id: String(executive.id),
    executivo_nome: executive.name,
    cliente_nome: apiProposal.company || apiProposal.name || 'N/A',
    tcv,
    prazo_meses: prazoMeses,
    status,
    status_pagamento: 'pendente',
    dias_inadimplencia: 0,
    data_aprovacao: apiProposal.updated_at || apiProposal.created_at,
    data_inicio_faturamento: null,
    data_cancelamento: null,
  };
}

// Legacy - keep for backwards compatibility
export async function fetchExecutives(): Promise<Map<string, ApiUser>> {
  try {
    const response = await openApi.getUsers({ 
      level: 700, 
      __perPage: 500 
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

// Legacy - keep for backwards compatibility
export async function fetchApprovedProposals(): Promise<ApiProposalData[]> {
  const proposals = await fetchAllApprovedProposals();
  return proposals;
}
