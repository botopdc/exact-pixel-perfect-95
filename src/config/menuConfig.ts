// ============================================================================
// MENU CONFIGURATION - RBAC por User Level
// Baseado na matriz fornecida pelo usuário
// ============================================================================

import {
  LayoutDashboard,
  Briefcase,
  Calculator,
  Clock,
  BookOpen,
  Wrench,
  Users,
  BarChart3,
  PieChart,
  TrendingUp,
  Heart,
  Activity,
  Crown,
  Shield,
  DollarSign,
  FileStack,
  LucideIcon,
  Lock,
  FileText,
  Receipt,
  UserCheck,
  Settings,
  Handshake,
  Target,
} from 'lucide-react';

// ============================================================================
// USER LEVELS - Conforme definido na API
// ============================================================================

export const USER_LEVELS = {
  CLIENTE: 1,
  PARCEIRO: 200,  // Novo nível para parceiros (ISV/VAR/FINDER)
  RH: 600,
  COMERCIAL: 700,
  GERENTE_COMERCIAL: 750,
  SUCESSO_CLIENTE: 775,
  SUPORTE: 900,
  GERENTE_SUPORTE: 950,
  ADMIN: 1000,
} as const;

export type UserLevel = typeof USER_LEVELS[keyof typeof USER_LEVELS];

// ============================================================================
// MENU ITEM TYPES
// ============================================================================

export interface MenuItem {
  id: string;
  title: string;
  url?: string;
  icon: LucideIcon;
  disabled?: boolean;
  /** Níveis de usuário que podem ver este item */
  allowedLevels: number[];
}

export interface MenuSection {
  id: string;
  title: string;
  items: MenuItem[];
}

// ============================================================================
// MENU CONFIGURATION - Matriz RBAC exata
// ============================================================================

export const MENU_SECTIONS: MenuSection[] = [
  // ========== MENU PRINCIPAL ==========
  {
    id: 'main',
    title: 'MENU PRINCIPAL',
    items: [
      {
        id: 'dashboard',
        title: 'Dashboard',
        url: '/modulos/dashboard',
        icon: LayoutDashboard,
        allowedLevels: [600, 750, 775, 900, 950, 1000], // Gerente Comercial (750) usa DashboardLayout
      },
      {
        id: 'ceo-view',
        title: 'CEO View',
        url: '/modulos/dashboard/ceo',
        icon: Crown,
        allowedLevels: [1000], // Apenas Admin - CEO View é restrito
      },
      {
        id: 'calculadora-main',
        title: 'Calculadora de Preços',
        url: '/modulos/comercial/propostas/criar',
        icon: Calculator,
        allowedLevels: [750, 1000], // Gerente Comercial e Admin
      },
      {
        id: 'gestao-usuarios',
        title: 'Gestão de Usuários',
        url: '/modulos/admin/usuarios',
        icon: Users,
        allowedLevels: [750, 1000], // Gerente Comercial e Admin
      },
    ],
  },

  // ========== COMERCIAL (GESTÃO - ADMIN E GERENTE COMERCIAL) ==========
  {
    id: 'comercial',
    title: 'COMERCIAL',
    items: [
      {
        id: 'executivos',
        title: 'Executivos',
        url: '/modulos/comercial/executivos',
        icon: UserCheck,
        allowedLevels: [750, 1000], // Gerente Comercial e Admin
      },
      {
        id: 'gestao-executivos',
        title: 'Gestão de Executivos',
        url: '/modulos/comercial/gestao-executivos',
        icon: Settings,
        allowedLevels: [750, 1000], // Gerente Comercial e Admin
      },
      {
        id: 'contratos',
        title: 'Contratos',
        url: '/modulos/comercial/contratos',
        icon: FileText,
        allowedLevels: [750, 1000],
      },
      {
        id: 'propostas-executivos',
        title: 'Propostas Executivos',
        url: '/modulos/comercial/propostas',
        icon: FileStack,
        allowedLevels: [750, 1000], // Gerente Comercial e Admin
      },
      {
        id: 'metas-comerciais',
        title: 'Metas',
        url: '/modulos/comercial/metas',
        icon: Target,
        allowedLevels: [750, 1000], // Gerente Comercial e Admin
      },
      {
        id: 'comissoes-executivos',
        title: 'Gestão de Comissões',
        url: '/modulos/comercial/comissoes',
        icon: DollarSign,
        allowedLevels: [750, 1000], // Gerente Comercial e Admin
      },
      {
        id: 'potencial-gerente',
        title: 'Meu Potencial (Gerente)',
        url: '/modulos/comercial/potencial-gerente',
        icon: TrendingUp,
        allowedLevels: [750, 1000], // Gerente Comercial e Admin
      },
    ],
  },

  // ========== PARCEIROS (GESTÃO - ADMIN E GERENTE COMERCIAL) ==========
  {
    id: 'parceiros',
    title: 'PARCEIROS',
    items: [
      {
        id: 'executivo-parceiros',
        title: 'Executivo Parceiros',
        url: '/modulos/parceiros/executivo',
        icon: PieChart,
        allowedLevels: [750, 1000], // Gerente Comercial e Admin
      },
      {
        id: 'gestao-parceiros',
        title: 'Gestão de Parceiros',
        url: '/modulos/parceiros/gestao',
        icon: Handshake,
        allowedLevels: [750, 1000], // Gerente Comercial e Admin
      },
      {
        id: 'propostas-parceiros',
        title: 'Propostas Parceiros',
        url: '/modulos/parceiros/propostas',
        icon: FileStack,
        allowedLevels: [750, 1000], // Gerente Comercial e Admin
      },
      {
        id: 'gestao-comissoes-parceiros',
        title: 'Gestão de Comissões',
        url: '/modulos/parceiros/comissoes',
        icon: DollarSign,
        allowedLevels: [750, 1000], // Gerente Comercial e Admin
      },
    ],
  },

  // ========== ATENDIMENTOS ==========
  {
    id: 'atendimentos',
    title: 'ATENDIMENTOS',
    items: [
      {
        id: 'suporte-tecnico',
        title: 'Suporte Técnico',
        url: '/modulos/atendimentos/suporte-tecnico',
        icon: Wrench,
        allowedLevels: [775, 900, 950, 1000],
      },
      {
        id: 'chamados-fila',
        title: 'Chamados (Legado)',
        url: '/modulos/atendimentos/chamados',
        icon: Wrench,
        allowedLevels: [900, 950, 1000],
      },
      {
        id: 'meus-chamados',
        title: 'Meus Chamados',
        url: '/modulos/atendimentos/meus-chamados',
        icon: Wrench,
        allowedLevels: [900, 950, 1000],
      },
      {
        id: 'analistas-suporte',
        title: 'Analistas',
        url: '/modulos/atendimentos/analistas-suporte',
        icon: Users,
        allowedLevels: [900, 950, 1000],
      },
      {
        id: 'chamados-slas',
        title: 'SLAs',
        url: '/modulos/atendimentos/slas',
        icon: Shield,
        allowedLevels: [1000], // Admin only
      },
      {
        id: 'chamados-relatorios',
        title: 'Relatórios',
        url: '/modulos/atendimentos/relatorios',
        icon: BarChart3,
        allowedLevels: [1000], // Admin only
      },
      {
        id: 'atendimentos-cs',
        title: 'Customer Success',
        url: '/modulos/atendimentos/cs',
        icon: Users,
        allowedLevels: [775, 950, 1000],
      },
    ],
  },

  // ========== KPIs DE ATENDIMENTO ==========
  {
    id: 'kpis',
    title: 'KPIs DE ATENDIMENTO',
    items: [
      {
        id: 'kpi-suporte',
        title: 'Suporte',
        url: '/modulos/atendimentos/kpis/suporte',
        icon: BarChart3,
        allowedLevels: [950, 1000],
      },
      {
        id: 'kpi-cs',
        title: 'Customer Success',
        url: '/modulos/atendimentos/kpis/cs',
        icon: PieChart,
        allowedLevels: [775, 950, 1000],
      },
      {
        id: 'kpi-gestao',
        title: 'Gestão',
        url: '/modulos/atendimentos/kpis/gestao',
        icon: TrendingUp,
        allowedLevels: [950, 1000],
      },
    ],
  },

  // ========== HEALTH SCORE ==========
  {
    id: 'healthscore',
    title: 'HEALTH SCORE',
    items: [
      {
        id: 'hs-cs',
        title: 'Visão CS',
        url: '/modulos/atendimentos/health/cs',
        icon: Heart,
        allowedLevels: [775, 1000],
      },
      {
        id: 'hs-executivo',
        title: 'Visão Executiva',
        url: '/modulos/atendimentos/health/executivo',
        icon: Activity,
        allowedLevels: [950, 1000],
      },
    ],
  },

  // ========== DOCS (Wiki) ==========
  {
    id: 'docs',
    title: 'DOCS',
    items: [
      {
        id: 'docs-wiki',
        title: 'Wiki / Docs',
        url: '/modulos/docs',
        icon: BookOpen,
        allowedLevels: [700, 750, 900, 950, 1000],
      },
    ],
  },

  // ========== CONTEÚDO & DOCUMENTAÇÃO ==========
  {
    id: 'conteudo',
    title: 'CONTEÚDO & DOCUMENTAÇÃO',
    items: [
      {
        id: 'artigos',
        title: 'Artigos',
        url: '/modulos/conteudo/artigos',
        icon: BookOpen,
        allowedLevels: [900, 950, 1000],
      },
    ],
  },

  // ========== GENTE & GESTÃO ==========
  {
    id: 'rh',
    title: 'GENTE & GESTÃO',
    items: [
      {
        id: 'vagas',
        title: 'Vagas / RH',
        url: '/modulos/gente/vagas',
        icon: Briefcase,
        allowedLevels: [600, 1000],
      },
    ],
  },

  // ========== EM BREVE ==========
  {
    id: 'coming-soon',
    title: 'EM BREVE',
    items: [
      {
        id: 'relatorios',
        title: 'Relatórios',
        url: '/relatorios',
        icon: FileText,
        disabled: true,
        allowedLevels: [1000],
      },
      {
        id: 'faturamento',
        title: 'Faturamento',
        url: '/faturamento',
        icon: Receipt,
        disabled: true,
        allowedLevels: [1000],
      },
    ],
  },
];

// ============================================================================
// MENU FILTERING FUNCTIONS
// ============================================================================

/**
 * Verifica se um item está disponível para o userLevel
 */
export function isItemAllowed(item: MenuItem, userLevel: number | null): boolean {
  // Se não tem userLevel (modo seguro), só Dashboard
  if (userLevel === null) {
    return item.id === 'dashboard';
  }

  // Admin (1000) tem acesso a tudo
  if (userLevel >= USER_LEVELS.ADMIN) {
    return true;
  }

  // Verifica se o nível está na lista de permitidos
  return item.allowedLevels.includes(userLevel);
}

/**
 * Verifica se uma seção tem itens visíveis para o userLevel
 */
export function isSectionVisible(section: MenuSection, userLevel: number | null): boolean {
  return section.items.some(item => isItemAllowed(item, userLevel));
}

/**
 * Filtra o menu completo baseado no userLevel
 */
export function getFilteredMenu(userLevel: number | null): MenuSection[] {
  return MENU_SECTIONS
    .map(section => ({
      ...section,
      items: section.items.filter(item => isItemAllowed(item, userLevel)),
    }))
    .filter(section => section.items.length > 0);
}

/**
 * Verifica se uma rota é permitida para o userLevel
 * REGRA: Mesmo que alguém force a URL, bloquear se não estiver em allowedLevels
 */
export function isRouteAllowed(pathname: string, userLevel: number | null): boolean {
  // Se não tem userLevel (modo seguro), só dashboard
  if (userLevel === null) {
    return pathname === '/dashboard';
  }

  // Admin tem acesso a tudo (exceto itens disabled que não têm URL funcional)
  if (userLevel >= USER_LEVELS.ADMIN) {
    return true;
  }

  // Busca o item correspondente à rota em todas as seções
  for (const section of MENU_SECTIONS) {
    for (const item of section.items) {
      if (item.url && (pathname === item.url || pathname.startsWith(item.url + '/'))) {
        // Item desabilitado não pode ser acessado
        if (item.disabled) {
          return false;
        }
        return item.allowedLevels.includes(userLevel);
      }
    }
  }

  // Rotas de sub-páginas herdam permissão da rota pai
  const parentMappings: Record<string, string> = {
    // Atendimentos
    '/atendimentos/novo': '/atendimentos/suporte',
    // Artigos
    '/artigos/novo': '/artigos',
    // RH
    '/rh/vagas/nova': '/rh/vagas',
    // Propostas internas (legado)
    '/propostas': '/comercial/propostas',
  };

  // Verifica rotas de edição dinâmicas
  if (pathname.match(/^\/artigos\/[^/]+$/)) {
    return isRouteAllowed('/artigos', userLevel);
  }
  if (pathname.match(/^\/artigos\/[^/]+\/editar$/)) {
    return isRouteAllowed('/artigos', userLevel);
  }
  if (pathname.match(/^\/atendimentos\/[^/]+$/)) {
    return isRouteAllowed('/atendimentos/suporte', userLevel);
  }
  if (pathname.match(/^\/rh\/vagas\/[^/]+$/)) {
    return isRouteAllowed('/rh/vagas', userLevel);
  }
  if (pathname.match(/^\/rh\/vagas\/[^/]+\/editar$/)) {
    return isRouteAllowed('/rh/vagas', userLevel);
  }
  // Rotas de comercial herdam permissão (Admin e Gerente Comercial)
  if (pathname.match(/^\/comercial\//)) {
    return userLevel === USER_LEVELS.GERENTE_COMERCIAL || userLevel >= USER_LEVELS.ADMIN;
  }
  
  // Rotas de parceiros (gestão) para Admin e Gerente Comercial
  if (pathname.match(/^\/parceiros\/(executivo|gestao|propostas|comissoes)/)) {
    return userLevel === USER_LEVELS.GERENTE_COMERCIAL || userLevel >= USER_LEVELS.ADMIN;
  }
  
  // LEGACY: Rotas do portal executivo - agora redirecionadas para /modulos/*
  // Mantido apenas para compatibilidade durante a transição
  if (pathname.match(/^\/executivo\//)) {
    // Allow access so the redirect can happen
    return userLevel >= 600;
  }

  // Verifica mapeamento estático
  for (const [route, parent] of Object.entries(parentMappings)) {
    if (pathname === route || pathname.startsWith(route + '/')) {
      return isRouteAllowed(parent, userLevel);
    }
  }

  // Rota não mapeada - bloquear por segurança
  // Redireciona para dashboard
  return false;
}

/**
 * Retorna o nome do nível do usuário para exibição
 */
export function getUserLevelName(level: number): string {
  const levelNames: Record<number, string> = {
    1: 'Cliente',
    200: 'Parceiro',
    600: 'RH',
    700: 'Comercial',
    750: 'Gerente Comercial',
    775: 'Sucesso do Cliente',
    900: 'Suporte',
    950: 'Gerente de Suporte',
    1000: 'Admin',
  };
  return levelNames[level] || 'Usuário';
}
