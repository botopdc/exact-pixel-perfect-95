// ============================================================================
// PRICING RULES BY USER LEVEL
// Regras de desconto e permissões baseadas no nível do usuário
// ============================================================================

import { USER_LEVELS } from './menuConfig';

// Regras de pricing por nível de usuário
export interface PricingRules {
  maxDiscountPercent: number;        // Desconto máximo permitido (%)
  canApplyPartnerDiscounts: boolean; // Pode aplicar descontos de parceiro (ISV/VAR)
  canOverridePrice: boolean;         // Pode usar override de preço (comissão)
  maxOverridePercent?: number;       // Limite máximo de override (%)
  requiresApprovalAbove?: number;    // Requer aprovação acima de X%
  canAccessSettings: boolean;        // Pode acessar configurações de preços
  canSendProposalEmail: boolean;     // Pode enviar proposta por email
  partnerType?: 'ISV' | 'VAR' | 'FINDER'; // Tipo de parceiro (se aplicável)
}

// Regras padrão (seguras) para níveis não mapeados
const DEFAULT_RULES: PricingRules = {
  maxDiscountPercent: 0,
  canApplyPartnerDiscounts: false,
  canOverridePrice: false,
  canAccessSettings: false,
  canSendProposalEmail: false,
};

// Configuração de regras por user_level
export const PRICING_RULES_BY_LEVEL: Record<number, PricingRules> = {
  // Parceiro (200) - ISV/VAR/FINDER
  200: {
    maxDiscountPercent: 25,
    canApplyPartnerDiscounts: true,
    canOverridePrice: false,
    canAccessSettings: false,
    canSendProposalEmail: true,
  },
  
  // Comercial / Executivos Internos (700)
  700: {
    maxDiscountPercent: 10,
    canApplyPartnerDiscounts: false,
    canOverridePrice: true,
    maxOverridePercent: 20,
    requiresApprovalAbove: 20,
    canAccessSettings: false,
    canSendProposalEmail: true,
  },
  
  // Gerente Comercial (750)
  750: {
    maxDiscountPercent: 15,
    canApplyPartnerDiscounts: false,
    canOverridePrice: true,
    maxOverridePercent: 30,
    canAccessSettings: true,
    canSendProposalEmail: true,
  },
  
  // Admin (1000)
  1000: {
    maxDiscountPercent: 20,
    canApplyPartnerDiscounts: true,
    canOverridePrice: true,
    maxOverridePercent: 30,
    canAccessSettings: true,
    canSendProposalEmail: true,
  },
};

// Descontos por tipo de parceiro (para user_level 200)
export const PARTNER_TYPE_DISCOUNTS: Record<string, number> = {
  ISV: 0.15,    // 15% de desconto
  VAR: 0.05,    // 5% de desconto
  FINDER: 0,    // Sem desconto (trabalha com comissão)
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Obtém as regras de pricing para um user_level
 */
export function getPricingRules(userLevel: number | null): PricingRules {
  if (userLevel === null) {
    return DEFAULT_RULES;
  }
  
  // Admin tem acesso total
  if (userLevel >= USER_LEVELS.ADMIN) {
    return PRICING_RULES_BY_LEVEL[USER_LEVELS.ADMIN];
  }
  
  return PRICING_RULES_BY_LEVEL[userLevel] || DEFAULT_RULES;
}

/**
 * Valida se um desconto é permitido para o user_level
 */
export function isDiscountAllowed(
  discountPercent: number, 
  userLevel: number | null
): { allowed: boolean; message?: string } {
  const rules = getPricingRules(userLevel);
  
  if (discountPercent <= 0) {
    return { allowed: true };
  }
  
  if (discountPercent > rules.maxDiscountPercent) {
    return {
      allowed: false,
      message: `Desconto acima do permitido para seu perfil. Máximo: ${rules.maxDiscountPercent}%`,
    };
  }
  
  return { allowed: true };
}

/**
 * Valida se um override é permitido para o user_level
 */
export function isOverrideAllowed(
  overridePercent: number, 
  userLevel: number | null
): { allowed: boolean; requiresApproval: boolean; message?: string } {
  const rules = getPricingRules(userLevel);
  
  if (!rules.canOverridePrice) {
    return {
      allowed: false,
      requiresApproval: false,
      message: 'Seu perfil não permite aplicar comissão de parceiro.',
    };
  }
  
  const maxOverride = rules.maxOverridePercent || 30;
  
  if (overridePercent > maxOverride) {
    return {
      allowed: false,
      requiresApproval: false,
      message: `Comissão acima do permitido. Máximo: ${maxOverride}%`,
    };
  }
  
  const requiresApproval = rules.requiresApprovalAbove !== undefined && 
                           overridePercent > rules.requiresApprovalAbove;
  
  return { allowed: true, requiresApproval };
}

/**
 * Obtém o desconto automático de parceiro baseado no tipo
 */
export function getPartnerTypeDiscount(partnerType: string | null): number {
  if (!partnerType) return 0;
  return PARTNER_TYPE_DISCOUNTS[partnerType] || 0;
}

/**
 * Verifica se o usuário pode acessar a calculadora
 */
export function canAccessCalculator(userLevel: number | null): boolean {
  if (userLevel === null) return false;
  
  // Níveis permitidos: 200 (Parceiro), 700 (Comercial), 750 (Gerente Comercial), 1000 (Admin)
  const allowedLevels = [200, 700, 750, 1000];
  
  // Admin sempre tem acesso
  if (userLevel >= USER_LEVELS.ADMIN) return true;
  
  return allowedLevels.includes(userLevel);
}

/**
 * Obtém label do perfil de preços
 */
export function getPricingProfileLabel(userLevel: number | null, partnerType?: string): string {
  if (userLevel === null) return 'Visitante';
  
  if (userLevel >= USER_LEVELS.ADMIN) return 'Administrador';
  if (userLevel >= 750) return 'Gerente Comercial';
  if (userLevel >= 700) return 'Executivo Comercial';
  if (userLevel >= 200) {
    if (partnerType) return `Parceiro ${partnerType}`;
    return 'Parceiro';
  }
  
  return 'Usuário';
}
