// ============================================================================
// DOCS REGISTRY - Central registry for all documentation pages
// ============================================================================

export interface DocEntry {
  slug: string;
  title: string;
  category: string;
  module?: string;
  summary: string;
  file: string;
  tags: string[];
  downloadable: boolean;
  visibleInMenu: boolean;
  order: number;
}

export const DOC_CATEGORIES = [
  { id: 'overview', label: 'Visão Geral', icon: 'LayoutDashboard' },
  { id: 'core', label: 'Arquitetura & Regras', icon: 'Cpu' },
  { id: 'modules', label: 'Módulos', icon: 'Puzzle' },
  { id: 'api', label: 'API Reference', icon: 'Code' },
  { id: 'playbooks', label: 'Playbooks', icon: 'BookOpen' },
  { id: 'runbooks', label: 'Runbooks', icon: 'Terminal' },
  { id: 'changelog', label: 'Changelog', icon: 'History' },
  { id: 'downloads', label: 'Downloads', icon: 'Download' },
] as const;

export type DocCategory = typeof DOC_CATEGORIES[number]['id'];

export const DOCS_REGISTRY: DocEntry[] = [
  // ======== CORE ========
  {
    slug: 'system-blueprint',
    title: 'OPEN System Blueprint',
    category: 'core',
    summary: 'Blueprint oficial da arquitetura completa da plataforma OPEN: módulos, banco de dados, eventos, APIs e regras estruturais.',
    file: 'core/open_system_blueprint',
    tags: ['blueprint', 'arquitetura', 'visão geral', 'módulos', 'eventos', 'supabase', 'rbac'],
    downloadable: true,
    visibleInMenu: true,
    order: 0,
  },
  {
    slug: 'architecture',
    title: 'Arquitetura do Sistema',
    category: 'core',
    summary: 'Visão geral da arquitetura, stack e decisões técnicas do sistema OPEN.',
    file: 'core/open_system_architecture',
    tags: ['arquitetura', 'stack', 'frontend', 'supabase', 'edge functions'],
    downloadable: true,
    visibleInMenu: true,
    order: 1,
  },
  {
    slug: 'database',
    title: 'Schema do Banco de Dados',
    category: 'core',
    summary: 'Documentação das tabelas, relações e políticas RLS do banco de dados.',
    file: 'core/open_database_schema',
    tags: ['database', 'schema', 'tabelas', 'rls', 'supabase'],
    downloadable: true,
    visibleInMenu: true,
    order: 2,
  },
  {
    slug: 'business-rules',
    title: 'Regras de Negócio',
    category: 'core',
    summary: 'Regras de negócio, níveis de acesso e fluxos principais do sistema.',
    file: 'core/open_business_rules',
    tags: ['regras', 'negócio', 'permissões', 'levels', 'rbac'],
    downloadable: true,
    visibleInMenu: true,
    order: 3,
  },
  {
    slug: 'event-model',
    title: 'OPEN Event Model',
    category: 'core',
    summary: 'Modelo de eventos para rastreamento, analytics e auditoria do sistema OPEN.',
    file: 'core/open_event_model',
    tags: ['eventos', 'tracking', 'auditoria', 'analytics', 'proposal_views'],
    downloadable: true,
    visibleInMenu: true,
    order: 4,
  },
  {
    slug: 'module-map',
    title: 'OPEN Module Map',
    category: 'core',
    summary: 'Mapa de módulos, rotas, dependências e organização funcional da plataforma OPEN.',
    file: 'core/open_module_map',
    tags: ['módulos', 'rotas', 'navegação', 'mapa', 'organização'],
    downloadable: true,
    visibleInMenu: true,
    order: 5,
  },

  // ======== MODULES ========
  {
    slug: 'modules/comercial',
    title: 'Módulo Comercial',
    category: 'modules',
    module: 'comercial',
    summary: 'Propostas, executivos, metas e comissões do módulo comercial.',
    file: 'modules/comercial',
    tags: ['comercial', 'propostas', 'executivos', 'comissões'],
    downloadable: true,
    visibleInMenu: true,
    order: 10,
  },
  {
    slug: 'modules/parceiros',
    title: 'Módulo Parceiros',
    category: 'modules',
    module: 'parceiros',
    summary: 'Gestão de parceiros ISV/VAR/Finder e suas comissões.',
    file: 'modules/parceiros',
    tags: ['parceiros', 'isv', 'var', 'finder', 'comissões'],
    downloadable: true,
    visibleInMenu: true,
    order: 11,
  },
  {
    slug: 'modules/atendimentos',
    title: 'Módulo Atendimentos',
    category: 'modules',
    module: 'atendimentos',
    summary: 'Chamados internos, suporte técnico, NOC e SLAs.',
    file: 'modules/atendimentos',
    tags: ['atendimentos', 'suporte', 'chamados', 'sla', 'noc'],
    downloadable: true,
    visibleInMenu: true,
    order: 12,
  },
  {
    slug: 'modules/admin',
    title: 'Módulo Admin',
    category: 'modules',
    module: 'admin',
    summary: 'Administração do sistema, usuários, permissões e configurações.',
    file: 'modules/admin',
    tags: ['admin', 'usuários', 'permissões', 'configurações'],
    downloadable: true,
    visibleInMenu: true,
    order: 13,
  },

  // ======== API ========
  {
    slug: 'api',
    title: 'OPEN API Reference',
    category: 'api',
    summary: 'Referência completa das APIs legadas (Laravel) e operações Supabase, incluindo Edge Functions e padrões de resposta.',
    file: 'api/api_reference',
    tags: ['api', 'rest', 'endpoints', 'edge functions', 'laravel', 'supabase', 'propostas', 'parceiros'],
    downloadable: true,
    visibleInMenu: true,
    order: 20,
  },

  // ======== PLAYBOOKS ========
  {
    slug: 'playbooks/proposal-flow',
    title: 'Fluxo de Propostas',
    category: 'playbooks',
    summary: 'Plano dos 7 passos para o fluxo completo de propostas.',
    file: 'playbooks/proposal-flow',
    tags: ['propostas', 'fluxo', '7 passos', 'email', 'aprovação'],
    downloadable: true,
    visibleInMenu: true,
    order: 30,
  },
  {
    slug: 'playbooks/contract-flow',
    title: 'Fluxo de Contratos',
    category: 'playbooks',
    summary: 'Processo de criação e gestão de contratos.',
    file: 'playbooks/contract-flow',
    tags: ['contratos', 'fluxo', 'assinatura'],
    downloadable: true,
    visibleInMenu: true,
    order: 31,
  },
  // ======== RUNBOOKS ========
  {
    slug: 'runbooks/supabase',
    title: 'Runbook - Supabase',
    category: 'runbooks',
    summary: 'Manual operacional do Supabase: tabelas críticas, problemas comuns e procedimentos de recovery.',
    file: 'runbooks/supabase',
    tags: ['runbook', 'supabase', 'operação', 'recovery', 'edge functions', 'troubleshooting'],
    downloadable: true,
    visibleInMenu: true,
    order: 36,
  },

  // ======== CHANGELOG ========
  {
    slug: 'changelog',
    title: 'Changelog',
    category: 'changelog',
    summary: 'Histórico de alterações e versões do sistema.',
    file: 'changelog/changelog',
    tags: ['changelog', 'versões', 'atualizações'],
    downloadable: true,
    visibleInMenu: true,
    order: 40,
  },

  // ======== EXISTING DOCS (from /docs folder) ========
  {
    slug: 'playbooks/7-passos-propostas',
    title: 'Plano 7 Passos - Propostas',
    category: 'playbooks',
    summary: 'Plano detalhado dos 7 passos para migração do fluxo de propostas.',
    file: '_existing/PLANO_7_PASSOS',
    tags: ['propostas', '7 passos', 'migração', 'supabase'],
    downloadable: true,
    visibleInMenu: true,
    order: 32,
  },
  {
    slug: 'playbooks/evidencias-7-passos',
    title: 'Evidências 7 Passos - Propostas',
    category: 'playbooks',
    summary: 'Registro de evidências e testes dos 7 passos de propostas.',
    file: '_existing/EVIDENCIAS_7_PASSOS',
    tags: ['evidências', 'testes', 'propostas'],
    downloadable: true,
    visibleInMenu: true,
    order: 33,
  },
  {
    slug: 'playbooks/7-passos-precos',
    title: 'Plano 7 Passos - Preços',
    category: 'playbooks',
    summary: 'Plano de migração de preços para Supabase via Edge Functions.',
    file: '_existing/PLANO_7_PASSOS_PRECOS',
    tags: ['preços', 'migração', 'edge functions', 'supabase'],
    downloadable: true,
    visibleInMenu: true,
    order: 34,
  },
  {
    slug: 'playbooks/evidencias-7-passos-precos',
    title: 'Evidências 7 Passos - Preços',
    category: 'playbooks',
    summary: 'Registro de evidências da migração de preços.',
    file: '_existing/EVIDENCIAS_7_PASSOS_PRECOS',
    tags: ['evidências', 'preços', 'migração'],
    downloadable: true,
    visibleInMenu: true,
    order: 35,
  },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function getDocBySlug(slug: string): DocEntry | undefined {
  return DOCS_REGISTRY.find(d => d.slug === slug);
}

export function getDocsByCategory(category: string): DocEntry[] {
  return DOCS_REGISTRY
    .filter(d => d.category === category && d.visibleInMenu)
    .sort((a, b) => a.order - b.order);
}

export function getAllDownloadableDocs(): DocEntry[] {
  return DOCS_REGISTRY
    .filter(d => d.downloadable)
    .sort((a, b) => a.order - b.order);
}

export function searchDocs(query: string): DocEntry[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  return DOCS_REGISTRY.filter(d => {
    return (
      d.title.toLowerCase().includes(q) ||
      d.category.toLowerCase().includes(q) ||
      d.summary.toLowerCase().includes(q) ||
      d.tags.some(t => t.toLowerCase().includes(q))
    );
  });
}
