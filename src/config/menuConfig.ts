// ============================================================================
// MENU CONFIGURATION - RBAC por User Level
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
} from 'lucide-react';

// ============================================================================
// USER LEVELS - Conforme definido na API
// ============================================================================

export const USER_LEVELS = {
  CLIENTE: 1,
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
  allowedLevels?: number[];
  /** Nível mínimo para ver este item (alternativa a allowedLevels) */
  minLevel?: number;
}

export interface MenuSection {
  id: string;
  title: string;
  items: MenuItem[];
  /** Níveis de usuário que podem ver esta seção */
  allowedLevels?: number[];
  /** Nível mínimo para ver esta seção */
  minLevel?: number;
  /** Se true, mostra apenas para liderança (750+) */
  leadershipOnly?: boolean;
}

// ============================================================================
// MENU CONFIGURATION
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
        url: '/dashboard',
        icon: LayoutDashboard,
        // Dashboard visível para todos os níveis autenticados
      },
      {
        id: 'ceo-view',
        title: 'CEO View',
        url: '/executivo',
        icon: Crown,
        // CEO View apenas para liderança (750+) e admin
        allowedLevels: [
          USER_LEVELS.GERENTE_COMERCIAL,
          USER_LEVELS.GERENTE_SUPORTE,
          USER_LEVELS.ADMIN,
        ],
      },
    ],
  },

  // ========== COMERCIAL & PARCEIROS ==========
  {
    id: 'comercial',
    title: 'COMERCIAL & PARCEIROS',
    allowedLevels: [
      USER_LEVELS.COMERCIAL,
      USER_LEVELS.GERENTE_COMERCIAL,
      USER_LEVELS.ADMIN,
    ],
    items: [
      {
        id: 'calculadora',
        title: 'Calculadora de Preços',
        url: '/calculadora',
        icon: Calculator,
        allowedLevels: [
          USER_LEVELS.COMERCIAL,
          USER_LEVELS.GERENTE_COMERCIAL,
          USER_LEVELS.ADMIN,
        ],
      },
      {
        id: 'executivo-parceiros',
        title: 'Executivo Parceiros',
        url: '/admin/parceiros/executivo',
        icon: PieChart,
        allowedLevels: [
          USER_LEVELS.GERENTE_COMERCIAL,
          USER_LEVELS.ADMIN,
        ],
      },
      {
        id: 'gestao-parceiros',
        title: 'Gestão de Parceiros',
        url: '/admin/parceiros',
        icon: Shield,
        allowedLevels: [
          USER_LEVELS.GERENTE_COMERCIAL,
          USER_LEVELS.ADMIN,
        ],
      },
      {
        id: 'propostas-parceiros',
        title: 'Propostas Parceiros',
        url: '/admin/parceiros/propostas',
        icon: FileStack,
        allowedLevels: [
          USER_LEVELS.COMERCIAL,
          USER_LEVELS.GERENTE_COMERCIAL,
          USER_LEVELS.ADMIN,
        ],
      },
      {
        id: 'gestao-comissoes',
        title: 'Gestão de Comissões',
        url: '/admin/comissoes',
        icon: DollarSign,
        allowedLevels: [
          USER_LEVELS.GERENTE_COMERCIAL,
          USER_LEVELS.ADMIN,
        ],
      },
    ],
  },

  // ========== ATENDIMENTOS ==========
  {
    id: 'atendimentos',
    title: 'ATENDIMENTOS',
    allowedLevels: [
      USER_LEVELS.SUCESSO_CLIENTE,
      USER_LEVELS.SUPORTE,
      USER_LEVELS.GERENTE_SUPORTE,
      USER_LEVELS.ADMIN,
    ],
    items: [
      {
        id: 'suporte',
        title: 'Suporte',
        url: '/atendimentos/suporte',
        icon: Wrench,
        allowedLevels: [
          USER_LEVELS.SUPORTE,
          USER_LEVELS.GERENTE_SUPORTE,
          USER_LEVELS.ADMIN,
        ],
      },
      {
        id: 'cs',
        title: 'Customer Success',
        url: '/atendimentos/cs',
        icon: Users,
        allowedLevels: [
          USER_LEVELS.SUCESSO_CLIENTE,
          USER_LEVELS.ADMIN,
        ],
      },
    ],
  },

  // ========== KPIs DE ATENDIMENTO ==========
  {
    id: 'kpis',
    title: 'KPIs DE ATENDIMENTO',
    allowedLevels: [
      USER_LEVELS.SUCESSO_CLIENTE,
      USER_LEVELS.SUPORTE,
      USER_LEVELS.GERENTE_SUPORTE,
      USER_LEVELS.ADMIN,
    ],
    items: [
      {
        id: 'kpi-suporte',
        title: 'Suporte',
        url: '/kpis/suporte',
        icon: BarChart3,
        allowedLevels: [
          USER_LEVELS.SUPORTE,
          USER_LEVELS.GERENTE_SUPORTE,
          USER_LEVELS.ADMIN,
        ],
      },
      {
        id: 'kpi-cs',
        title: 'Customer Success',
        url: '/kpis/cs',
        icon: PieChart,
        allowedLevels: [
          USER_LEVELS.SUCESSO_CLIENTE,
          USER_LEVELS.ADMIN,
        ],
      },
      {
        id: 'kpi-gestao',
        title: 'Gestão',
        url: '/kpis/gestao',
        icon: TrendingUp,
        allowedLevels: [
          USER_LEVELS.GERENTE_SUPORTE,
          USER_LEVELS.ADMIN,
        ],
      },
    ],
  },

  // ========== HEALTH SCORE ==========
  {
    id: 'healthscore',
    title: 'HEALTH SCORE',
    allowedLevels: [
      USER_LEVELS.SUCESSO_CLIENTE,
      USER_LEVELS.GERENTE_SUPORTE,
      USER_LEVELS.ADMIN,
    ],
    items: [
      {
        id: 'hs-cs',
        title: 'Visão CS',
        url: '/health-score/cs',
        icon: Heart,
        allowedLevels: [
          USER_LEVELS.SUCESSO_CLIENTE,
          USER_LEVELS.ADMIN,
        ],
      },
      {
        id: 'hs-executivo',
        title: 'Visão Executiva',
        url: '/health-score/executivo',
        icon: Activity,
        allowedLevels: [
          USER_LEVELS.SUCESSO_CLIENTE,
          USER_LEVELS.GERENTE_SUPORTE,
          USER_LEVELS.ADMIN,
        ],
      },
    ],
  },

  // ========== CONTEÚDO & DOCUMENTAÇÃO ==========
  {
    id: 'conteudo',
    title: 'CONTEÚDO & DOCUMENTAÇÃO',
    allowedLevels: [
      USER_LEVELS.SUPORTE,
      USER_LEVELS.GERENTE_SUPORTE,
      USER_LEVELS.ADMIN,
    ],
    items: [
      {
        id: 'artigos',
        title: 'Artigos',
        url: '/artigos',
        icon: BookOpen,
        allowedLevels: [
          USER_LEVELS.SUPORTE,
          USER_LEVELS.GERENTE_SUPORTE,
          USER_LEVELS.ADMIN,
        ],
      },
    ],
  },

  // ========== GENTE & GESTÃO ==========
  {
    id: 'rh',
    title: 'GENTE & GESTÃO',
    allowedLevels: [
      USER_LEVELS.RH,
      USER_LEVELS.ADMIN,
    ],
    items: [
      {
        id: 'vagas',
        title: 'Vagas / RH',
        url: '/rh/vagas',
        icon: Briefcase,
        allowedLevels: [
          USER_LEVELS.RH,
          USER_LEVELS.ADMIN,
        ],
      },
    ],
  },

  // ========== EM BREVE ==========
  {
    id: 'coming-soon',
    title: 'EM BREVE',
    // Visível apenas para liderança (750+)
    minLevel: USER_LEVELS.GERENTE_COMERCIAL,
    items: [
      {
        id: 'relatorios',
        title: 'Relatórios',
        icon: Clock,
        disabled: true,
      },
      {
        id: 'faturamento',
        title: 'Faturamento',
        icon: Lock,
        disabled: true,
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

  // Admin tem acesso a tudo
  if (userLevel >= USER_LEVELS.ADMIN) {
    return true;
  }

  // Se tem allowedLevels, verifica se o nível está na lista
  if (item.allowedLevels && item.allowedLevels.length > 0) {
    return item.allowedLevels.includes(userLevel);
  }

  // Se tem minLevel, verifica se o nível é maior ou igual
  if (item.minLevel !== undefined) {
    return userLevel >= item.minLevel;
  }

  // Se não tem restrição, permite
  return true;
}

/**
 * Verifica se uma seção está disponível para o userLevel
 */
export function isSectionAllowed(section: MenuSection, userLevel: number | null): boolean {
  // Se não tem userLevel (modo seguro), só seção principal (dashboard)
  if (userLevel === null) {
    return section.id === 'main';
  }

  // Admin tem acesso a tudo
  if (userLevel >= USER_LEVELS.ADMIN) {
    return true;
  }

  // Se é somente liderança
  if (section.leadershipOnly && userLevel < USER_LEVELS.GERENTE_COMERCIAL) {
    return false;
  }

  // Se tem allowedLevels, verifica se o nível está na lista
  if (section.allowedLevels && section.allowedLevels.length > 0) {
    return section.allowedLevels.includes(userLevel);
  }

  // Se tem minLevel, verifica se o nível é maior ou igual
  if (section.minLevel !== undefined) {
    return userLevel >= section.minLevel;
  }

  // Se não tem restrição, permite
  return true;
}

/**
 * Filtra o menu completo baseado no userLevel
 */
export function getFilteredMenu(userLevel: number | null): MenuSection[] {
  return MENU_SECTIONS
    .filter(section => isSectionAllowed(section, userLevel))
    .map(section => ({
      ...section,
      items: section.items.filter(item => isItemAllowed(item, userLevel)),
    }))
    .filter(section => section.items.length > 0);
}

/**
 * Verifica se uma rota é permitida para o userLevel
 */
export function isRouteAllowed(pathname: string, userLevel: number | null): boolean {
  // Dashboard sempre permitido
  if (pathname === '/dashboard') {
    return true;
  }

  // Se não tem userLevel, só dashboard
  if (userLevel === null) {
    return false;
  }

  // Admin tem acesso a tudo
  if (userLevel >= USER_LEVELS.ADMIN) {
    return true;
  }

  // Busca o item correspondente à rota
  for (const section of MENU_SECTIONS) {
    for (const item of section.items) {
      if (item.url && (pathname === item.url || pathname.startsWith(item.url + '/'))) {
        return isItemAllowed(item, userLevel);
      }
    }
  }

  // Rota não encontrada no menu - verificar rotas especiais
  // Rotas de criação/edição herdam permissão da rota pai
  const parentRoutes: Record<string, string> = {
    '/atendimentos/novo': '/atendimentos/suporte',
    '/artigos/novo': '/artigos',
    '/rh/vagas/nova': '/rh/vagas',
  };

  for (const [route, parent] of Object.entries(parentRoutes)) {
    if (pathname.startsWith(route.replace('/novo', '').replace('/nova', ''))) {
      return isRouteAllowed(parent, userLevel);
    }
  }

  // Se a rota não está mapeada, bloqueia por segurança
  return false;
}

/**
 * Retorna o nome do nível do usuário para exibição
 */
export function getUserLevelName(level: number): string {
  if (level >= USER_LEVELS.ADMIN) return 'Admin';
  if (level >= USER_LEVELS.GERENTE_SUPORTE) return 'Gerente de Suporte';
  if (level >= USER_LEVELS.SUPORTE) return 'Suporte';
  if (level >= USER_LEVELS.SUCESSO_CLIENTE) return 'Customer Success';
  if (level >= USER_LEVELS.GERENTE_COMERCIAL) return 'Gerente Comercial';
  if (level >= USER_LEVELS.COMERCIAL) return 'Comercial';
  if (level >= USER_LEVELS.RH) return 'RH';
  return 'Cliente';
}
