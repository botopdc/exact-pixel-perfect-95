/**
 * Commission Calculator - Unified Commission Logic
 * 
 * ============================================
 * REGRA UNIFICADA DE CÁLCULO DE COMISSÃO
 * ============================================
 * 
 * PRIORIDADE:
 * 1. user.commission_pct_override (se != null) → usa override
 * 2. Regra padrão por level:
 *    - CS (775): 1% fixo
 *    - Comercial (700/750): 2.5% ou 4% baseado em duração
 * 
 * FÓRMULAS:
 * - MRR = proposal.total (valor mensal)
 * - TCV = MRR × contract_duration
 * - comissão_total = TCV × commission_pct
 * - parcela = comissão_total / 3
 */

import { COMMISSION_RATES, computeCommissionPct } from './executiveCommissionService';

// ============================================
// TYPES
// ============================================

export interface CommissionUser {
  id: number;
  level: number;
  commission_pct_override?: number | null;
}

export interface CommissionProposal {
  total: number; // MRR (valor mensal)
  contract_duration: number; // meses
}

export interface CommissionResult {
  mrr: number;
  tcv: number;
  commissionPct: number;
  commissionPctDisplay: string; // Ex: "2.5%"
  totalCommission: number;
  installment: number;
  isOverride: boolean;
  source: 'override' | 'level_rule' | 'duration_rule';
}

// ============================================
// CONSTANTS
// ============================================

export const CS_COMMISSION_RATE = 0.01; // 1% fixo para CS (775)

// ============================================
// MAIN CALCULATOR FUNCTION
// ============================================

/**
 * Calcula comissão para uma proposta baseado no usuário
 * 
 * @param proposal - Dados da proposta (total = MRR, contract_duration = meses)
 * @param user - Dados do usuário (id, level, commission_pct_override)
 * @returns CommissionResult com todos os valores calculados
 */
export function calculateProposalCommission(
  proposal: CommissionProposal,
  user: CommissionUser
): CommissionResult {
  const mrr = proposal.total || 0;
  const months = proposal.contract_duration || 12;
  const tcv = round2(mrr * months);

  let commissionPct: number;
  let source: CommissionResult['source'];
  let isOverride = false;

  // 1. Verificar Override
  if (user.commission_pct_override !== null && user.commission_pct_override !== undefined) {
    commissionPct = user.commission_pct_override;
    source = 'override';
    isOverride = true;
  }
  // 2. Regra por Level
  else if (user.level === 775) {
    // CS: 1% fixo
    commissionPct = CS_COMMISSION_RATE;
    source = 'level_rule';
  }
  // 3. Regra por Duração (Comercial 700/750 e outros)
  else {
    commissionPct = computeCommissionPct(months);
    source = 'duration_rule';
  }

  const totalCommission = round2(tcv * commissionPct);
  const installment = round2(totalCommission / 3);
  const commissionPctDisplay = `${(commissionPct * 100).toFixed(1)}%`;

  return {
    mrr,
    tcv,
    commissionPct,
    commissionPctDisplay,
    totalCommission,
    installment,
    isOverride,
    source,
  };
}

/**
 * Calcula 3 parcelas a partir do valor total de comissão
 */
export function computeInstallments(commissionValue: number): { p1: number; p2: number; p3: number; total: number } {
  const baseInstallment = round2(commissionValue / 3);
  const p1 = baseInstallment;
  const p2 = baseInstallment;
  const p3 = round2(commissionValue - p1 - p2); // Ajusta para soma exata

  return {
    p1,
    p2,
    p3,
    total: round2(p1 + p2 + p3),
  };
}

/**
 * Retorna a taxa de comissão padrão para um usuário (sem override)
 */
export function getDefaultCommissionRate(userLevel: number, contractDurationMonths: number): number {
  if (userLevel === 775) {
    return CS_COMMISSION_RATE;
  }
  return computeCommissionPct(contractDurationMonths);
}

/**
 * Formata percentual para exibição
 */
export function formatCommissionPct(pct: number): string {
  return `${(pct * 100).toFixed(1)}%`;
}

// ============================================
// UTILITY
// ============================================

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
