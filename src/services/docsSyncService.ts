import { supabase } from '@/integrations/supabase/client';
import { DOCS_REGISTRY } from '@/data/docs/registry';
import { getDocContent } from '@/data/docs/content';

// ============================================================================
// TYPES
// ============================================================================

export interface DocsSyncRun {
  id: string;
  command_name: string;
  status: string;
  started_at: string | null;
  finished_at: string | null;
  triggered_by: string | null;
  files_affected: string[] | null;
  summary: string | null;
  details_md: string | null;
  created_at: string;
}

export interface DocsSyncCoverage {
  id: string;
  doc_slug: string;
  source_type: string;
  source_name: string;
  is_covered: boolean;
  notes: string | null;
  updated_at: string;
}

export interface DocsHealthIssue {
  type: 'missing_content' | 'duplicate_slug' | 'empty_category' | 'not_downloadable' | 'registry_inconsistent';
  severity: 'error' | 'warning' | 'info';
  message: string;
  slug?: string;
}

// ============================================================================
// SYNC COMMANDS
// ============================================================================

export const SYNC_COMMANDS = [
  {
    name: 'OPEN_DOCS_AUTOSYNC',
    label: 'Sync All Docs',
    description: 'Executa todos os comandos de sincronização em sequência.',
    files: ['content.ts', 'dataModel.ts', 'registry.ts'],
  },
  {
    name: 'OPEN_DOCS_SYNC_DATA_MODEL',
    label: 'Sync Data Model',
    description: 'Atualiza documentação do modelo de dados com base no schema atual.',
    files: ['dataModel.ts'],
  },
  {
    name: 'OPEN_DOCS_SYNC_EVENTS',
    label: 'Sync Event Model',
    description: 'Atualiza documentação do modelo de eventos.',
    files: ['content.ts (event model)'],
  },
  {
    name: 'OPEN_DOCS_SYNC_API',
    label: 'Sync API Reference',
    description: 'Atualiza referência de API com endpoints e Edge Functions atuais.',
    files: ['content.ts (api_reference)'],
  },
  {
    name: 'OPEN_DOCS_SYNC_ARCHITECTURE',
    label: 'Sync Architecture',
    description: 'Atualiza documentação de arquitetura, módulos e rotas.',
    files: ['content.ts (architecture, module_map, blueprint)'],
  },
  {
    name: 'OPEN_DOCS_SYNC_RUNBOOK',
    label: 'Sync Runbook',
    description: 'Atualiza runbook operacional do Supabase.',
    files: ['content.ts (runbook)'],
  },
] as const;

// ============================================================================
// SYNC RUNS
// ============================================================================

export async function fetchSyncRuns(): Promise<DocsSyncRun[]> {
  const { data, error } = await supabase
    .from('docs_sync_runs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) throw error;
  return (data ?? []) as unknown as DocsSyncRun[];
}

export async function createSyncRun(commandName: string): Promise<DocsSyncRun> {
  const run = {
    command_name: commandName,
    status: 'running',
    started_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('docs_sync_runs')
    .insert(run)
    .select()
    .single();

  if (error) throw error;
  return data as unknown as DocsSyncRun;
}

export async function completeSyncRun(
  id: string,
  status: 'success' | 'failed',
  summary: string,
  filesAffected: string[]
): Promise<void> {
  const { error } = await supabase
    .from('docs_sync_runs')
    .update({
      status,
      finished_at: new Date().toISOString(),
      summary,
      files_affected: filesAffected,
    })
    .eq('id', id);

  if (error) throw error;
}

// ============================================================================
// COVERAGE
// ============================================================================

export async function fetchCoverage(): Promise<DocsSyncCoverage[]> {
  const { data, error } = await supabase
    .from('docs_sync_coverage')
    .select('*')
    .order('source_type', { ascending: true });

  if (error) throw error;
  return (data ?? []) as unknown as DocsSyncCoverage[];
}

export async function upsertCoverage(items: Omit<DocsSyncCoverage, 'id' | 'updated_at'>[]): Promise<void> {
  for (const item of items) {
    const { error } = await supabase
      .from('docs_sync_coverage')
      .upsert(
        { ...item, updated_at: new Date().toISOString() },
        { onConflict: 'doc_slug,source_type,source_name' }
      );
    if (error) console.error('Coverage upsert error:', error);
  }
}

// ============================================================================
// HEALTH CHECK
// ============================================================================

export function runHealthCheck(): DocsHealthIssue[] {
  const issues: DocsHealthIssue[] = [];

  // Check for missing content
  for (const doc of DOCS_REGISTRY) {
    const content = getDocContent(doc.file);
    if (!content) {
      issues.push({
        type: 'missing_content',
        severity: 'error',
        message: `Documento "${doc.title}" (${doc.slug}) não possui conteúdo renderizável. File key: ${doc.file}`,
        slug: doc.slug,
      });
    }
  }

  // Check for duplicate slugs
  const slugCounts = new Map<string, number>();
  for (const doc of DOCS_REGISTRY) {
    slugCounts.set(doc.slug, (slugCounts.get(doc.slug) ?? 0) + 1);
  }
  for (const [slug, count] of slugCounts) {
    if (count > 1) {
      issues.push({
        type: 'duplicate_slug',
        severity: 'error',
        message: `Slug duplicado: "${slug}" aparece ${count} vezes no registry.`,
        slug,
      });
    }
  }

  // Check categories with no docs
  const categories = ['core', 'modules', 'api', 'playbooks', 'runbooks', 'changelog'];
  for (const cat of categories) {
    const docs = DOCS_REGISTRY.filter(d => d.category === cat && d.visibleInMenu);
    if (docs.length === 0) {
      issues.push({
        type: 'empty_category',
        severity: 'warning',
        message: `Categoria "${cat}" não possui documentos visíveis.`,
      });
    }
  }

  // Check for non-downloadable docs
  const nonDownloadable = DOCS_REGISTRY.filter(d => !d.downloadable);
  if (nonDownloadable.length > 0) {
    for (const doc of nonDownloadable) {
      issues.push({
        type: 'not_downloadable',
        severity: 'info',
        message: `Documento "${doc.title}" não está marcado como downloadable.`,
        slug: doc.slug,
      });
    }
  }

  return issues;
}

// ============================================================================
// STATIC COVERAGE DATA (for initial population)
// ============================================================================

export function generateStaticCoverage(): { source_type: string; source_name: string; doc_slug: string; is_covered: boolean }[] {
  const items: { source_type: string; source_name: string; doc_slug: string; is_covered: boolean }[] = [];

  // Modules coverage
  const modules = ['Dashboard', 'Comercial', 'Parceiros', 'Atendimentos', 'Docs', 'Conteúdo', 'Gente & Gestão', 'Admin'];
  const moduleSlugs: Record<string, string> = {
    'Comercial': 'modules/comercial',
    'Parceiros': 'modules/parceiros',
    'Atendimentos': 'modules/atendimentos',
    'Admin': 'modules/admin',
  };
  for (const mod of modules) {
    items.push({
      source_type: 'module',
      source_name: mod,
      doc_slug: moduleSlugs[mod] ?? '',
      is_covered: !!moduleSlugs[mod],
    });
  }

  // Tables coverage
  const tables = [
    'calculator_proposals', 'calculator_proposal_servers', 'calculator_proposal_addons',
    'calculator_proposal_files', 'proposal_views', 'proposal_participants',
    'calculator_configs', 'articles', 'tech_clients', 'tech_assets',
    'tech_incidents', 'tech_users', 'cert_customers', 'cert_assets',
    'academy_enrollments', 'user_commission_overrides', 'docs_sync_runs', 'docs_sync_coverage',
  ];
  for (const table of tables) {
    items.push({
      source_type: 'table',
      source_name: table,
      doc_slug: 'data-model',
      is_covered: true,
    });
  }

  // Edge Functions coverage
  const edgeFunctions = [
    'proposal-save', 'proposal-get', 'proposal-list', 'proposal-track',
    'proposal-gateway', 'public-approval', 'pricing-admin',
    'send-proposal-email', 'send-password-reset',
    'support-ticket-create', 'support-ticket-list', 'support-ticket-get',
    'support-ticket-update', 'support-ticket-messages', 'support-ticket-upload',
    'support-ticket-ingest', 'support-sla-admin', 'support-queue-admin',
    'support-dashboard-stats',
  ];
  for (const fn of edgeFunctions) {
    items.push({
      source_type: 'edge_function',
      source_name: fn,
      doc_slug: fn.startsWith('support-') ? 'support/api-reference' : 'api',
      is_covered: true,
    });
  }

  // Events coverage
  const events = [
    'proposal.view_public', 'proposal.view_internal', 'proposal.link_copied',
    'proposal.email_sent', 'proposal.pdf_download', 'proposal.approved', 'proposal.rejected',
  ];
  for (const evt of events) {
    items.push({
      source_type: 'event',
      source_name: evt,
      doc_slug: 'event-model',
      is_covered: true,
    });
  }

  return items;
}
