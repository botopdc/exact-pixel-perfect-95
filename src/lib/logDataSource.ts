// ============================================================================
// DATA SOURCE LOGGER - Debug helper for auditing data sources
// ============================================================================

type DataSourceType = 'API' | 'LocalStorage' | 'SessionStorage' | 'Supabase' | 'Mock' | 'IndexedDB' | 'EdgeFunction';
type OperationType = 'READ' | 'WRITE' | 'DELETE';

interface LogDataSourceParams {
  module: string;
  source: DataSourceType;
  operation: OperationType;
  endpoint?: string;
  key?: string;
  details?: string;
}

// Enable/disable logging via localStorage
const DEBUG_KEY = 'open_debug_datasource';

function isDebugEnabled(): boolean {
  try {
    return localStorage.getItem(DEBUG_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * Enables or disables data source logging
 * Usage in console: window.enableDataSourceDebug(true)
 */
export function enableDataSourceDebug(enabled: boolean): void {
  try {
    if (enabled) {
      localStorage.setItem(DEBUG_KEY, 'true');
      console.log('[DATA-SOURCE] Debug mode ENABLED. All data operations will be logged.');
    } else {
      localStorage.removeItem(DEBUG_KEY);
      console.log('[DATA-SOURCE] Debug mode DISABLED.');
    }
  } catch {
    console.warn('[DATA-SOURCE] Could not set debug mode');
  }
}

// Expose to window for easy access
if (typeof window !== 'undefined') {
  (window as any).enableDataSourceDebug = enableDataSourceDebug;
  (window as any).showDataSourceReport = showDataSourceReport;
}

/**
 * Logs a data source operation
 * 
 * @example
 * logDataSource({
 *   module: 'ArticlesList',
 *   source: 'API',
 *   operation: 'READ',
 *   endpoint: 'GET /api/article',
 * });
 * 
 * @example
 * logDataSource({
 *   module: 'PricingForm',
 *   source: 'LocalStorage',
 *   operation: 'WRITE',
 *   key: 'open_precos_adminMode',
 * });
 */
export function logDataSource(params: LogDataSourceParams): void {
  if (!isDebugEnabled()) return;

  const { module, source, operation, endpoint, key, details } = params;
  
  const timestamp = new Date().toISOString().slice(11, 23);
  const operationEmoji = {
    READ: '📖',
    WRITE: '✏️',
    DELETE: '🗑️',
  }[operation];

  const sourceColor = {
    API: 'color: #3b82f6; font-weight: bold',
    LocalStorage: 'color: #f59e0b; font-weight: bold',
    SessionStorage: 'color: #f59e0b; font-weight: bold',
    Supabase: 'color: #22c55e; font-weight: bold',
    Mock: 'color: #a855f7; font-weight: bold',
    IndexedDB: 'color: #ec4899; font-weight: bold',
    EdgeFunction: 'color: #06b6d4; font-weight: bold',
  }[source];

  const location = endpoint || key || '';
  
  console.log(
    `%c[DATA-SOURCE] ${timestamp} ${operationEmoji} ${operation}`,
    sourceColor,
    `| ${module} → ${source}`,
    location ? `| ${location}` : '',
    details ? `| ${details}` : ''
  );
}

/**
 * Shows a summary report of all data sources used in the application
 */
export function showDataSourceReport(): void {
  console.log(`
╔══════════════════════════════════════════════════════════════════════════════════════════════════════════════╗
║                                    DATA SOURCE AUDIT REPORT - OPEN DATACENTER                                ║
╠══════════════════════════════════════════════════════════════════════════════════════════════════════════════╣
║ MÓDULO/TELA                 │ ARQUIVO(S)                              │ FONTE    │ ENDPOINT/CHAVE                    │ TRIGGER      │ PERSIST      │ PROBLEMAS                    ║
╠══════════════════════════════════════════════════════════════════════════════════════════════════════════════╣
║ Autenticação                │ authService.ts                          │ API+LS   │ POST /api/auth/login              │ submit       │ API+LS       │ ─                            ║
║                             │ openApi.ts                              │          │ open_access_token                 │              │              │                              ║
╠──────────────────────────────────────────────────────────────────────────────────────────────────────────────╣
║ Sessão Interna              │ authService.ts                          │ LS       │ open_auth_session_v1              │ login        │ LocalStorage │ ─                            ║
║ Sessão Parceiro             │ openApi.ts                              │ LS       │ open_partner_session_v1           │ login        │ LocalStorage │ ─                            ║
╠──────────────────────────────────────────────────────────────────────────────────────────────────────────────╣
║ Gestão de Usuários          │ useUsers.ts, openApi.ts                 │ API      │ GET/POST/PUT/DEL /api/user        │ mount/action │ API          │ ─                            ║
║ Busca Usuários (Autocomplete)│ useUserSearch.ts                       │ API      │ GET /api/user?__q=                │ debounce     │ ─            │ ─                            ║
╠──────────────────────────────────────────────────────────────────────────────────────────────────────────────╣
║ Gestão de Parceiros         │ partnersService.ts, openApi.ts          │ API      │ GET/POST/PUT/DEL /api/partner     │ mount/action │ API          │ ─                            ║
╠──────────────────────────────────────────────────────────────────────────────────────────────────────────────╣
║ Propostas (Interno)         │ useProposals.ts, openApi.ts             │ API      │ /api/calculator/proposal          │ mount/action │ API          │ ─                            ║
║ Propostas (Parceiro)        │ usePartnerProposals.ts, openApi.ts      │ API      │ /api/calculator/proposal          │ mount/action │ API          │ ─                            ║
║ Busca Propostas             │ useProposalSearch.ts                    │ API      │ GET /api/calculator/proposal      │ debounce     │ ─            │ ─                            ║
╠──────────────────────────────────────────────────────────────────────────────────────────────────────────────╣
║ Calculadora Config          │ calculatorConfigService.ts              │ API      │ GET /api/calculator/config        │ mount        │ API          │ ─                            ║
║ Preços (Admin Mode)         │ Precos.tsx                              │ LS       │ open_precos_adminMode             │ toggle       │ LocalStorage │ Preferência UI apenas        ║
╠──────────────────────────────────────────────────────────────────────────────────────────────────────────────╣
║ Anexos/Arquivos             │ attachmentsService.ts                   │ API      │ /api/calculator/proposal/{id}/file│ mount/upload │ API          │ ─                            ║
╠──────────────────────────────────────────────────────────────────────────────────────────────────────────────╣
║ Metas Comerciais            │ useMetasComerciais.ts                   │ API      │ GET/POST/PUT /api/annual-goal     │ mount/action │ API          │ ─                            ║
║ Comissões Executivos        │ executiveCommissionService.ts           │ API      │ /api/executive-commission         │ mount        │ API          │ ─                            ║
╠──────────────────────────────────────────────────────────────────────────────────────────────────────────────╣
║ Artigos Externos (API)      │ useExternalArticles.ts                  │ API      │ GET /api/article                  │ mount        │ API          │ ─                            ║
║ Artigos Internos (Supabase) │ useArticles.ts                          │ Supabase │ articles table                    │ mount        │ Supabase     │ ─                            ║
╠──────────────────────────────────────────────────────────────────────────────────────────────────────────────╣
║ Vagas (Jobs)                │ jobsService.ts                          │ API      │ /api/job                          │ mount/action │ API          │ ─                            ║
╠──────────────────────────────────────────────────────────────────────────────────────────────────────────────╣
║ ⚠️ Tickets (Atendimento)    │ ticketsService.ts                       │ LS       │ open_tickets_v1                   │ mount/action │ LocalStorage │ MOCK - Migrar para API       ║
║ ⚠️ Tickets Internos         │ internalTicketService.ts                │ LS       │ open_internal_tickets_v1          │ mount/action │ LocalStorage │ MOCK - Migrar para API       ║
╠──────────────────────────────────────────────────────────────────────────────────────────────────────────────╣
║ ⚠️ Health Score             │ healthScoreService.ts                   │ LS       │ open_health_scores_v1             │ calc/action  │ LocalStorage │ MOCK - Depende de Tickets    ║
║ ⚠️ KPIs                     │ kpiService.ts                           │ LS       │ (via ticketsService)              │ calc         │ LocalStorage │ MOCK - Depende de Tickets    ║
╠──────────────────────────────────────────────────────────────────────────────────────────────────────────────╣
║ Certidão de Nascimento      │ birthCertificateService.ts              │ Supabase │ cert_* tables                     │ mount/action │ Supabase     │ ─                            ║
║ NOC / TechOps               │ techOpsService.ts, seedService.ts       │ Supabase │ tech_* tables                     │ mount/action │ Supabase     │ ─                            ║
╠──────────────────────────────────────────────────────────────────────────────────────────────────────────────╣
║ Tema (Dark/Light)           │ useTheme.ts                             │ LS       │ open-datacenter-theme             │ toggle       │ LocalStorage │ ─ (esperado)                 ║
║ Config Persistence          │ useConfigPersistence.ts                 │ LS       │ open_config_*                     │ change       │ LocalStorage │ ─ (esperado)                 ║
╠──────────────────────────────────────────────────────────────────────────────────────────────────────────────╣
║ Envio de Email              │ api.ts                                  │ EdgeFunc │ send-proposal-email               │ action       │ ─            │ ─                            ║
║ Eventos Proposta            │ useProposalEvents.ts                    │ Supabase │ proposal_views                    │ view         │ Supabase     │ ─                            ║
║ Link Aprovação              │ approvalLinkService.ts                  │ API      │ /api/calculator/proposal          │ action       │ API          │ ─                            ║
╠══════════════════════════════════════════════════════════════════════════════════════════════════════════════╣
║ LEGENDA:                                                                                                     ║
║   API = OPEN API (https://apiv2.opendata.center/api)                                                         ║
║   LS = LocalStorage                                                                                          ║
║   Supabase = Lovable Cloud (Supabase)                                                                        ║
║   EdgeFunc = Supabase Edge Functions                                                                         ║
║   ⚠️ = Módulo usando MOCK/LocalStorage que deveria estar em API/Supabase                                     ║
╚══════════════════════════════════════════════════════════════════════════════════════════════════════════════╝

Para ativar logs em tempo real, execute no console:
  window.enableDataSourceDebug(true)

Para desativar:
  window.enableDataSourceDebug(false)
`);
}

// ============================================================================
// INSTRUMENTED STORAGE WRAPPERS
// These can be used to replace direct localStorage calls
// ============================================================================

export const instrumentedStorage = {
  getItem(key: string, module: string): string | null {
    const value = localStorage.getItem(key);
    logDataSource({
      module,
      source: 'LocalStorage',
      operation: 'READ',
      key,
      details: value ? `${value.length} chars` : 'null',
    });
    return value;
  },

  setItem(key: string, value: string, module: string): void {
    localStorage.setItem(key, value);
    logDataSource({
      module,
      source: 'LocalStorage',
      operation: 'WRITE',
      key,
      details: `${value.length} chars`,
    });
  },

  removeItem(key: string, module: string): void {
    localStorage.removeItem(key);
    logDataSource({
      module,
      source: 'LocalStorage',
      operation: 'DELETE',
      key,
    });
  },
};

export default logDataSource;
