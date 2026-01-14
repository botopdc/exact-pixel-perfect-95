/**
 * Centralized routes configuration
 * All navigation destinations should use these constants to prevent incorrect redirects
 */

export const ROUTES = {
  // Public routes
  public: {
    login: '/login',
    proposalView: (id: string) => `/proposta/${id}`,
    proposalAccept: (id: string) => `/proposta/${id}/aceite`,
    // New token-based approval route
    proposalApprove: (proposalId: string, token: string) => 
      `/proposta/aprovar?proposalId=${encodeURIComponent(proposalId)}&token=${encodeURIComponent(token)}`,
  },
  
  // Admin/Internal routes (level 1000, 900+, etc.)
  admin: {
    dashboard: '/dashboard',
    calculator: '/calculadora',
    ceo: '/ceo',
  },
  
  // Executive routes (level 700/750)
  executivo: {
    dashboard: '/executivo/dashboard',
    calculator: '/executivo/calculadora',
    proposals: '/executivo/propostas',
  },
  
  // Partner routes (level 200)
  parceiro: {
    login: '/parceiro/login',
    register: '/parceiro/cadastro',
    contract: '/parceiro/contrato',
    dashboard: '/parceiro/dashboard',
    calculator: '/parceiro/calculadora',
    proposals: '/parceiro/propostas',
    referrals: '/parceiro/indicacoes',
  },
} as const;

/**
 * Get the correct dashboard route based on user level and context
 * This function ensures users are always directed to the appropriate dashboard
 * 
 * @param userLevel - The numeric level of the user (e.g., 200, 700, 750, 1000)
 * @param isPartner - Whether the user has an active partner session
 * @returns The appropriate dashboard route
 */
export function getDashboardRoute(userLevel: number | undefined, isPartner: boolean): string {
  // Partner context takes precedence if active
  if (isPartner) {
    return ROUTES.parceiro.dashboard;
  }
  
  // Executive levels (700 = Comercial, 750 = Gerente Comercial)
  if (userLevel === 700 || userLevel === 750) {
    return ROUTES.executivo.dashboard;
  }
  
  // All other internal users (admin, support, CS, etc.)
  return ROUTES.admin.dashboard;
}

/**
 * Get the correct calculator route based on user level and context
 */
export function getCalculatorRoute(userLevel: number | undefined, isPartner: boolean): string {
  if (isPartner) {
    return ROUTES.parceiro.calculator;
  }
  
  if (userLevel === 700 || userLevel === 750) {
    return ROUTES.executivo.calculator;
  }
  
  return ROUTES.admin.calculator;
}

/**
 * Get the correct proposals route based on user level and context
 */
export function getProposalsRoute(userLevel: number | undefined, isPartner: boolean): string {
  if (isPartner) {
    return ROUTES.parceiro.proposals;
  }
  
  if (userLevel === 700 || userLevel === 750) {
    return ROUTES.executivo.proposals;
  }
  
  return '/comercial/propostas';
}
