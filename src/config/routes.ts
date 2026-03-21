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
    // NEW: 100% Supabase approval route (token-only, no proposalId in URL)
    proposalApproval: (token: string) => `/proposta/aprovacao/${token}`,
    // LEGACY: Token-based approval route (kept for backwards compat redirect)
    proposalApprove: (proposalId: string, token: string) => 
      `/proposta/aprovar?proposalId=${encodeURIComponent(proposalId)}&token=${encodeURIComponent(token)}`,
    // Public PDF download route (for email links)
    proposalPdf: (proposalId: string, token: string) =>
      `/proposta/pdf?proposalId=${encodeURIComponent(proposalId)}&token=${encodeURIComponent(token)}`,
  },
  
  // NEW MODULAR ROUTES - Main navigation system
  modulos: {
    dashboard: '/modulos/dashboard',
    comercial: {
      home: '/modulos/comercial',
      proposals: '/modulos/comercial/propostas',
      proposalNew: '/modulos/comercial/propostas/criar',
      proposalView: (id: string | number) => `/modulos/comercial/propostas/${id}`,
      proposalEdit: (id: string | number) => `/modulos/comercial/propostas/criar?edit=1&id=${id}`,
      contracts: '/modulos/comercial/contratos',
      contractNew: '/modulos/comercial/contratos/novo',
      contractView: (id: string) => `/modulos/comercial/contratos/${id}`,
      executivos: '/modulos/comercial/executivos',
      metas: '/modulos/comercial/metas',
      comissoes: '/modulos/comercial/comissoes',
      meuPotencial: '/modulos/comercial/meu-potencial',
      potencialGerente: '/modulos/comercial/potencial-gerente',
    },
    parceiros: {
      home: '/modulos/parceiros',
      gestao: '/modulos/parceiros/gestao',
      proposals: '/modulos/parceiros/propostas',
      comissoes: '/modulos/parceiros/comissoes',
    },
    atendimentos: {
      home: '/modulos/atendimentos',
      chamados: '/modulos/atendimentos/suporte-tecnico',
      suporte: '/modulos/atendimentos/suporte',
      analistas: '/modulos/atendimentos/analistas',
    },
    // ✅ ADMIN MODULE — Supabase-native (sem dependência da API Laravel)
    admin: {
      home: '/modulos/admin',
      usuarios: '/modulos/admin/usuarios',
      permissoes: '/modulos/admin/permissoes',
      backfill: '/modulos/admin/backfill',
      logs: '/modulos/admin/logs',
      parametros: '/modulos/admin/parametros',
    },
  },
  
  // LEGACY ROUTES - Keep for redirects only, do not use for navigation
  // These are being phased out in favor of /modulos/* routes
  admin: {
    dashboard: '/modulos/dashboard',
    calculator: '/modulos/comercial/propostas/criar',
    ceo: '/ceo',
  },
  
  // LEGACY: Executive routes - REDIRECTS to modular routes
  // Level 700 now uses ModuleLayout like other internal users
  executivo: {
    dashboard: '/modulos/dashboard',
    calculator: '/modulos/comercial/propostas/criar',
    proposals: '/modulos/comercial/propostas',
    potential: '/modulos/comercial/potencial',
  },
  
  // LEGACY: Manager routes - REDIRECTS to modular routes
  gerente: {
    dashboard: '/modulos/dashboard',
    calculator: '/modulos/comercial/propostas/criar',
    proposals: '/modulos/comercial/propostas',
    potential: '/modulos/comercial/potencial',
    goals: '/modulos/comercial/metas',
    commissions: '/modulos/comercial/comissoes',
  },
  
  // Partner routes (level 200) - keep separate namespace
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
 * ALL internal users now use the modular dashboard
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
  
  // ALL internal users (700, 750, 900, 1000, etc.) use modular dashboard
  return ROUTES.modulos.dashboard;
}

/**
 * Get the correct calculator/proposal creation route based on user level and context
 * ALL internal users now use the modular proposal creation route
 */
export function getCalculatorRoute(userLevel: number | undefined, isPartner: boolean): string {
  if (isPartner) {
    return ROUTES.parceiro.calculator;
  }
  
  // ALL internal users use modular proposal creation route
  return ROUTES.modulos.comercial.proposalNew;
}

/**
 * Get the correct proposal edit route with ID
 */
export function getProposalEditRoute(proposalId: string | number, isPartner: boolean): string {
  if (isPartner) {
    // Partners edit in their own calculator
    return `${ROUTES.parceiro.calculator}?edit=1&id=${proposalId}`;
  }
  
  // ALL internal users use modular edit route
  return ROUTES.modulos.comercial.proposalEdit(proposalId);
}

/**
 * Get the correct proposal view route with ID
 */
export function getProposalViewRoute(proposalId: string | number, isPartner: boolean): string {
  if (isPartner) {
    // Partners view in their own proposals page
    return ROUTES.parceiro.proposals;
  }
  
  // ALL internal users use modular view route
  return ROUTES.modulos.comercial.proposalView(proposalId);
}

/**
 * Get the correct proposals list route based on user level and context
 * ALL internal users now use the modular proposals list
 */
export function getProposalsRoute(userLevel: number | undefined, isPartner: boolean): string {
  if (isPartner) {
    return ROUTES.parceiro.proposals;
  }
  
  // ALL internal users use modular proposals route
  return ROUTES.modulos.comercial.proposals;
}
