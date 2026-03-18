// ============================================================================
// MODULES CONFIGURATION - Arquitetura de Navegação da OPEN
// Sidebar Level 1: Apenas módulos estruturais
// ============================================================================

import {
  LayoutDashboard,
  Briefcase,
  Handshake,
  HeadphonesIcon,
  BookOpen,
  Users,
  Settings,
  Clock,
  Book,
  LucideIcon,
} from 'lucide-react';

// ============================================================================
// USER LEVELS - Conforme definido na API
// ============================================================================

export const USER_LEVELS = {
  // Academy levels (external)
  ACADEMY_ALUNO: 50,
  ACADEMY_PROFESSOR: 55,
  ACADEMY_INSTITUICAO: 60,
  // Standard levels
  CLIENTE: 1,
  PARCEIRO: 200,
  RH: 600,
  BDR: 680,
  ARQUITETO: 690,
  COMERCIAL: 700,
  GERENTE_COMERCIAL: 750,
  SUCESSO_CLIENTE: 775,
  SUPORTE: 900,
  GERENTE_SUPORTE: 950,
  ADMIN: 1000,
} as const;

// Levels that can manage Academy
export const ACADEMY_MANAGER_LEVELS = [775, 900, 950, 1000];

export type UserLevel = typeof USER_LEVELS[keyof typeof USER_LEVELS];

// ============================================================================
// MODULE DEFINITION
// ============================================================================

export interface Module {
  id: string;
  title: string;
  icon: LucideIcon;
  url: string;
  disabled?: boolean;
  /** Níveis de usuário que podem ver este módulo */
  allowedLevels: number[];
}

// ============================================================================
// SUB-NAVIGATION ITEM
// ============================================================================

export interface SubNavItem {
  id: string;
  title: string;
  url: string;
  allowedLevels: number[];
  /** For third-level tabs */
  tabs?: SubNavTab[];
}

export interface SubNavTab {
  id: string;
  title: string;
  url: string;
  allowedLevels: number[];
}

// ============================================================================
// MODULE CONFIGURATION
// ============================================================================

export interface ModuleConfig {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  homeUrl: string;
  allowedLevels: number[];
  subNavigation: SubNavItem[];
}

// ============================================================================
// SIDEBAR MODULES (LEVEL 1) - FIXED, LIMITED
// Apenas estes 8 módulos podem existir no sidebar
// ============================================================================

export const SIDEBAR_MODULES: Module[] = [
  {
    id: 'dashboard',
    title: 'Dashboard',
    icon: LayoutDashboard,
    url: '/modulos/dashboard',
    allowedLevels: [600, 680, 690, 700, 750, 775, 900, 950, 1000],
  },
  {
    id: 'comercial',
    title: 'Comercial',
    icon: Briefcase,
    url: '/modulos/comercial',
    allowedLevels: [690, 700, 750, 1000],
  },
  {
    id: 'parceiros',
    title: 'Parceiros',
    icon: Handshake,
    url: '/modulos/parceiros',
    allowedLevels: [750, 1000],
  },
  {
    id: 'atendimentos',
    title: 'Atendimentos',
    icon: HeadphonesIcon,
    url: '/modulos/atendimentos',
    // Todos os internos (exceto level 1 - cliente)
    allowedLevels: [600, 680, 690, 700, 750, 775, 900, 950, 1000],
  },
  {
    id: 'docs',
    title: 'Docs',
    icon: Book,
    url: '/modulos/docs',
    allowedLevels: [700, 750, 900, 950, 1000],
  },
  {
    id: 'conteudo',
    title: 'Conteúdo & Documentação',
    icon: BookOpen,
    url: '/modulos/conteudo',
    allowedLevels: [775, 900, 950, 1000],
  },
  {
    id: 'gente',
    title: 'Gente & Gestão',
    icon: Users,
    url: '/modulos/gente',
    allowedLevels: [600, 1000],
  },
  {
    id: 'admin',
    title: 'Admin',
    icon: Settings,
    url: '/modulos/admin',
    allowedLevels: [1000], // Apenas Admin
  },
  {
    id: 'em-breve',
    title: 'Em breve',
    icon: Clock,
    url: '#',
    disabled: true,
    allowedLevels: [600, 680, 690, 700, 750, 775, 900, 950, 1000],
  },
];

// ============================================================================
// MODULE CONFIGURATIONS (LEVEL 2 + 3)
// ============================================================================

export const MODULE_CONFIGS: Record<string, ModuleConfig> = {
  // =========================================================================
  // DASHBOARD
  // =========================================================================
  dashboard: {
    id: 'dashboard',
    title: 'Dashboard',
    description: 'Visão geral do sistema',
    icon: LayoutDashboard,
    homeUrl: '/modulos/dashboard',
    allowedLevels: [600, 680, 690, 700, 750, 775, 900, 950, 1000],
    subNavigation: [
      {
        id: 'visao-geral',
        title: 'Visão Geral',
        url: '/modulos/dashboard',
        allowedLevels: [600, 680, 690, 700, 750, 775, 900, 950, 1000],
      },
      {
        id: 'alertas',
        title: 'Alertas',
        url: '/modulos/dashboard/alertas',
        allowedLevels: [750, 950, 1000],
      },
      {
        id: 'indicadores',
        title: 'Indicadores-chave',
        url: '/modulos/dashboard/indicadores',
        allowedLevels: [750, 950, 1000],
      },
    ],
  },

  // =========================================================================
  // COMERCIAL
  // =========================================================================
  comercial: {
    id: 'comercial',
    title: 'Comercial',
    description: 'Gestão de vendas, executivos e propostas',
    icon: Briefcase,
    homeUrl: '/modulos/comercial',
    allowedLevels: [690, 700, 750, 1000],
    subNavigation: [
      {
        id: 'visao-geral',
        title: 'Visão Geral',
        url: '/modulos/comercial',
        allowedLevels: [690, 700, 750, 1000],
      },
      {
        id: 'executivos',
        title: 'Executivos',
        url: '/modulos/comercial/executivos',
        allowedLevels: [750, 1000],
      },
      {
        id: 'propostas',
        title: 'Propostas',
        url: '/modulos/comercial/propostas',
        allowedLevels: [690, 700, 750, 1000],
        tabs: [
          { id: 'lista', title: 'Lista', url: '/modulos/comercial/propostas', allowedLevels: [690, 700, 750, 1000] },
          { id: 'criar', title: 'Criar', url: '/modulos/comercial/propostas/criar', allowedLevels: [700, 750, 1000] },
          { id: 'templates', title: 'Templates', url: '/modulos/comercial/propostas/templates', allowedLevels: [750, 1000] },
          { id: 'aprovacoes', title: 'Aprovações', url: '/modulos/comercial/propostas/aprovacoes', allowedLevels: [750, 1000] },
        ],
      },
      {
        id: 'contratos',
        title: 'Contratos',
        url: '/modulos/comercial/contratos',
        allowedLevels: [700, 750, 1000],
      },
      {
        id: 'metas',
        title: 'Metas',
        url: '/modulos/comercial/metas',
        allowedLevels: [750, 1000],
      },
      {
        id: 'comissoes',
        title: 'Comissões',
        url: '/modulos/comercial/comissoes',
        allowedLevels: [750, 1000],
      },
      {
        id: 'meu-potencial',
        title: 'Meu Potencial',
        url: '/modulos/comercial/meu-potencial',
        allowedLevels: [700], // Executivos
      },
      {
        id: 'meu-potencial-arquiteto',
        title: 'Meu Potencial',
        url: '/modulos/comercial/potencial-arquiteto',
        allowedLevels: [690], // Arquitetos
      },
      {
        id: 'potencial-gerente',
        title: 'Potencial do Gerente',
        url: '/modulos/comercial/potencial-gerente',
        allowedLevels: [750, 1000], // Gerente e Admin
      },
    ],
  },

  // =========================================================================
  // PARCEIROS
  // =========================================================================
  parceiros: {
    id: 'parceiros',
    title: 'Parceiros',
    description: 'Gestão de parceiros, propostas e comissões',
    icon: Handshake,
    homeUrl: '/modulos/parceiros',
    allowedLevels: [750, 1000],
    subNavigation: [
      {
        id: 'visao-executiva',
        title: 'Visão Executiva',
        url: '/modulos/parceiros',
        allowedLevels: [750, 1000],
      },
      {
        id: 'gestao',
        title: 'Gestão de Parceiros',
        url: '/modulos/parceiros/gestao',
        allowedLevels: [750, 1000],
      },
      {
        id: 'propostas',
        title: 'Propostas de Parceiros',
        url: '/modulos/parceiros/propostas',
        allowedLevels: [750, 1000],
      },
      {
        id: 'comissoes',
        title: 'Comissões',
        url: '/modulos/parceiros/comissoes',
        allowedLevels: [750, 1000],
      },
    ],
  },

  // =========================================================================
  // ATENDIMENTOS / OPERAÇÕES
  // =========================================================================
  atendimentos: {
    id: 'atendimentos',
    title: 'Atendimentos',
    description: 'Centro de operações — NOC, suporte e CS',
    icon: HeadphonesIcon,
    homeUrl: '/modulos/atendimentos',
    allowedLevels: [600, 680, 690, 700, 750, 775, 900, 950, 1000],
    subNavigation: [
      {
        id: 'visao-geral',
        title: 'Visão Geral',
        url: '/modulos/atendimentos',
        allowedLevels: [600, 680, 690, 700, 750, 775, 900, 950, 1000],
      },
      {
        id: 'analistas',
        title: 'Analistas',
        url: '/modulos/atendimentos/analistas',
        allowedLevels: [950, 1000],
      },
      {
        id: 'suporte-tecnico',
        title: 'Suporte Técnico',
        url: '/modulos/atendimentos/suporte-tecnico',
        allowedLevels: [600, 680, 690, 700, 750, 775, 900, 950, 1000],
      },
      {
        id: 'cs',
        title: 'Customer Success',
        url: '/modulos/atendimentos/cs',
        allowedLevels: [775, 950, 1000],
      },
      {
        id: 'kpis',
        title: 'KPIs de Atendimento',
        url: '/modulos/atendimentos/kpis',
        allowedLevels: [775, 950, 1000],
      },
    ],
  },

  // =========================================================================
  // DOCS (Wiki Interna)
  // =========================================================================
  docs: {
    id: 'docs',
    title: 'Docs',
    description: 'Wiki oficial e base de conhecimento técnico',
    icon: Book,
    homeUrl: '/modulos/docs',
    allowedLevels: [700, 750, 900, 950, 1000],
    subNavigation: [],
  },

  // =========================================================================
  // CONTEÚDO & DOCUMENTAÇÃO
  // =========================================================================
  conteudo: {
    id: 'conteudo',
    title: 'Conteúdo & Documentação',
    description: 'Artigos, procedimentos e base de conhecimento',
    icon: BookOpen,
    homeUrl: '/modulos/conteudo',
    allowedLevels: [775, 900, 950, 1000],
    subNavigation: [
      {
        id: 'artigos',
        title: 'Artigos',
        url: '/modulos/conteudo/artigos',
        allowedLevels: [900, 950, 1000],
      },
      {
        id: 'procedimentos',
        title: 'Procedimentos',
        url: '/modulos/conteudo/procedimentos',
        allowedLevels: [900, 950, 1000],
      },
      {
        id: 'materiais',
        title: 'Materiais Internos',
        url: '/modulos/conteudo/materiais',
        allowedLevels: [775, 900, 950, 1000],
      },
      {
        id: 'base',
        title: 'Base de Conhecimento',
        url: '/modulos/conteudo/base',
        allowedLevels: [775, 900, 950, 1000],
      },
    ],
  },

  // =========================================================================
  // GENTE & GESTÃO
  // =========================================================================
  gente: {
    id: 'gente',
    title: 'Gente & Gestão',
    description: 'RH, vagas e estrutura organizacional',
    icon: Users,
    homeUrl: '/modulos/gente',
    allowedLevels: [600, 1000],
    subNavigation: [
      {
        id: 'vagas',
        title: 'Vagas / RH',
        url: '/modulos/gente/vagas',
        allowedLevels: [600, 1000],
      },
      {
        id: 'estrutura',
        title: 'Estrutura Organizacional',
        url: '/modulos/gente/estrutura',
        allowedLevels: [1000],
      },
      {
        id: 'metas-internas',
        title: 'Metas Internas',
        url: '/modulos/gente/metas',
        allowedLevels: [1000],
      },
      {
        id: 'avaliacoes',
        title: 'Avaliações',
        url: '/modulos/gente/avaliacoes',
        allowedLevels: [1000],
      },
      {
        id: 'academy',
        title: 'OPEN Academy',
        url: '/modulos/gente/academy',
        allowedLevels: [600, 775, 900, 950, 1000],
      },
    ],
  },

  // =========================================================================
  // ADMIN
  // =========================================================================
  admin: {
    id: 'admin',
    title: 'Admin',
    description: 'Configurações do sistema e administração',
    icon: Settings,
    homeUrl: '/modulos/admin',
    allowedLevels: [1000],
    subNavigation: [
      {
        id: 'usuarios',
        title: 'Gestão de Usuários',
        url: '/modulos/admin/usuarios',
        allowedLevels: [1000],
      },
      {
        id: 'permissoes',
        title: 'Permissões & Perfis',
        url: '/modulos/admin/permissoes',
        allowedLevels: [1000],
      },
      {
        id: 'precos',
        title: 'Configuração de Preços',
        url: '/modulos/admin/precos',
        allowedLevels: [1000],
      },
      {
        id: 'parametros',
        title: 'Parâmetros do Sistema',
        url: '/modulos/admin/parametros',
        allowedLevels: [1000],
      },
      {
        id: 'logs',
        title: 'Logs & Auditoria',
        url: '/modulos/admin/logs',
        allowedLevels: [1000],
      },
    ],
  },
};

// ============================================================================
// HELPER FUNCTIONS — Roles-first with level fallback
// ============================================================================

import { canAccessByAllowedLevels } from '@/lib/rbac';

/**
 * Verifica se um módulo está disponível para os effective roles.
 * Falls back to level if needed (via canAccessByAllowedLevels).
 */
export function isModuleAllowed(module: Module, effectiveRoles: string[]): boolean {
  if (effectiveRoles.length === 0) return false;
  return canAccessByAllowedLevels(effectiveRoles, module.allowedLevels);
}

/**
 * Verifica se um item de sub-navegação está disponível
 */
export function isSubNavAllowed(item: SubNavItem, effectiveRoles: string[]): boolean {
  if (effectiveRoles.length === 0) return false;
  return canAccessByAllowedLevels(effectiveRoles, item.allowedLevels);
}

/**
 * Filtra módulos do sidebar baseado nos effective roles
 */
export function getFilteredModules(effectiveRoles: string[]): Module[] {
  return SIDEBAR_MODULES.filter(module => isModuleAllowed(module, effectiveRoles));
}

/**
 * Filtra sub-navegação baseado nos effective roles
 */
export function getFilteredSubNav(moduleId: string, effectiveRoles: string[]): SubNavItem[] {
  const config = MODULE_CONFIGS[moduleId];
  if (!config) return [];
  return config.subNavigation.filter(item => isSubNavAllowed(item, effectiveRoles));
}

/**
 * Verifica se uma rota é permitida para os effective roles
 */
export function isModuleRouteAllowed(pathname: string, effectiveRoles: string[]): boolean {
  if (effectiveRoles.length === 0) return false;

  // Check module access
  for (const module of SIDEBAR_MODULES) {
    if (pathname === module.url || pathname.startsWith(module.url + '/')) {
      if (!isModuleAllowed(module, effectiveRoles)) return false;
      
      // Check sub-navigation access
      const config = MODULE_CONFIGS[module.id];
      if (config) {
        for (const subNav of config.subNavigation) {
          if (pathname === subNav.url || pathname.startsWith(subNav.url + '/')) {
            if (!isSubNavAllowed(subNav, effectiveRoles)) return false;
            
            // Check tabs access
            if (subNav.tabs) {
              for (const tab of subNav.tabs) {
                if (pathname === tab.url) {
                  return canAccessByAllowedLevels(effectiveRoles, tab.allowedLevels);
                }
              }
            }
            return true;
          }
        }
      }
      return true;
    }
  }

  return false;
}

/**
 * Retorna o nome do nível do usuário para exibição (legacy compat)
 */
export function getUserLevelName(level: number): string {
  const levelNames: Record<number, string> = {
    1: 'Cliente',
    200: 'Parceiro',
    600: 'RH',
    680: 'BDR',
    690: 'Arquiteto de Soluções',
    700: 'Comercial',
    750: 'Gerente Comercial',
    775: 'Sucesso do Cliente',
    900: 'Suporte',
    950: 'Gerente de Suporte',
    1000: 'Admin',
  };
  return levelNames[level] || 'Usuário';
}
