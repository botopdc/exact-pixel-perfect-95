// ============================================================================
// DOCS CONTENT LOADER
// Maps file keys from registry to actual markdown content.
// Existing docs from /docs folder are loaded here as well.
// ============================================================================

// Import content modules
import { OPEN_DATA_MODEL_CONTENT } from './content/dataModel';
import { OPEN_DOCS_SYNC_COMMANDS_CONTENT } from './content/syncCommands';
import { OPEN_CHANGELOG_CONTENT } from './content/changelog';
import { OPEN_RBAC_MODEL_CONTENT } from './content/rbacModel';
import { OPEN_EVENT_ARCHITECTURE_CONTENT } from './content/eventArchitecture';

// Import existing docs
import PLANO_7_PASSOS from '../../../docs/PLANO_7_PASSOS.md?raw';
import EVIDENCIAS_7_PASSOS from '../../../docs/EVIDENCIAS_7_PASSOS.md?raw';
import PLANO_7_PASSOS_PRECOS from '../../../docs/PLANO_7_PASSOS_PRECOS.md?raw';
import EVIDENCIAS_7_PASSOS_PRECOS from '../../../docs/EVIDENCIAS_7_PASSOS_PRECOS.md?raw';
import OPEN_SUPPORT_ARCHITECTURE from '../../../docs/architecture/OPEN_SUPPORT_ARCHITECTURE.md?raw';
import OPEN_SUPPORT_DATA_MODEL from '../../../docs/data/OPEN_SUPPORT_DATA_MODEL.md?raw';
import OPEN_SUPPORT_RBAC from '../../../docs/security/OPEN_SUPPORT_RBAC.md?raw';
import OPEN_SUPPORT_API_REFERENCE from '../../../docs/api/OPEN_SUPPORT_API_REFERENCE.md?raw';
import OPEN_SUPPORT_RUNBOOK from '../../../docs/runbooks/OPEN_SUPPORT_RUNBOOK.md?raw';
import OPEN_SUPPORT_KPIS from '../../../docs/metrics/OPEN_SUPPORT_KPIS.md?raw';

// ============================================================================
// NEW CONTENT (inline for now, migrates to Supabase later)
// ============================================================================

const CONTENT: Record<string, string> = {
  // Existing docs
  '_existing/PLANO_7_PASSOS': PLANO_7_PASSOS,
  '_existing/EVIDENCIAS_7_PASSOS': EVIDENCIAS_7_PASSOS,
  '_existing/PLANO_7_PASSOS_PRECOS': PLANO_7_PASSOS_PRECOS,
  '_existing/EVIDENCIAS_7_PASSOS_PRECOS': EVIDENCIAS_7_PASSOS_PRECOS,

  // Core
  'core/open_system_architecture': `# Arquitetura do Sistema OPEN

## Stack Tecnológico

| Camada | Tecnologia |
|--------|-----------|
| **Frontend** | React + Vite + TypeScript + Tailwind CSS |
| **UI Components** | shadcn/ui (Radix) |
| **Backend** | Supabase (Lovable Cloud) |
| **Edge Functions** | Deno (Supabase Edge Functions) |
| **Banco de Dados** | PostgreSQL (via Supabase) |
| **Autenticação** | API REST externa + Supabase Auth (Academy) |
| **Deploy** | Lovable (Preview + Publish) |

## Decisões Arquiteturais

### Frontend-First
O sistema OPEN é frontend-first: toda a lógica de apresentação, validação de formulários e controle de acesso visual está no React. O backend (Supabase) serve como:
- Fonte de verdade para dados persistentes
- Executor de lógica que precisa de \`SERVICE_ROLE_KEY\`
- Gateway para APIs externas (via Edge Functions)

### Módulos
A aplicação é organizada em módulos acessíveis via \`/modulos/*\`:
- **Dashboard** — Visão geral e KPIs
- **Comercial** — Propostas, executivos, metas
- **Parceiros** — ISV, VAR, Finder
- **Atendimentos** — Chamados, NOC, SLAs
- **Conteúdo** — Artigos e base de conhecimento
- **Gente & Gestão** — RH, vagas, Academy
- **Docs** — Documentação técnica (este módulo)
- **Admin** — Configurações do sistema

### RBAC (Role-Based Access Control)
O controle de acesso é baseado no campo \`user.level\`:
- Cada módulo e sub-rota define \`allowedLevels\`
- Admin (1000) tem acesso total
- A verificação acontece tanto no sidebar quanto no route guard

## Estrutura de Pastas

\`\`\`
src/
├── components/     # Componentes reutilizáveis
├── config/         # Configurações (rotas, módulos, menu)
├── data/           # Dados estáticos (docs registry)
├── hooks/          # Custom hooks
├── layouts/        # Layouts (Module, Partner, Executive)
├── lib/            # Utilitários
├── pages/          # Páginas por módulo
├── services/       # Camada de serviços (API, Supabase)
└── types/          # Tipos TypeScript
\`\`\`
`,

  'core/open_database_schema': `# Schema do Banco de Dados

## Visão Geral

O banco de dados PostgreSQL é gerenciado pelo Supabase e contém as seguintes áreas:

## Tabelas Principais

### Propostas
- \`calculator_proposals\` — Propostas comerciais
- \`calculator_proposal_servers\` — Servidores de cada proposta
- \`calculator_proposal_addons\` — Addons de cada proposta
- \`calculator_proposal_files\` — Arquivos anexados
- \`proposal_participants\` — Participantes (executivos, gerentes)
- \`proposal_views\` — Tracking de visualizações

### Configurações
- \`calculator_configs\` — Configurações de preços por categoria/seção

### Artigos
- \`articles\` — Base de conhecimento

### Clientes (Certidão)
- \`cert_customers\` — Clientes
- \`cert_assets\` — Ativos dos clientes
- \`cert_asset_*\` — Detalhes dos ativos (discos, rede, recursos, licenças, acessos)
- \`cert_proposal_links\` — Vínculos proposta↔cliente
- \`cert_audit_logs\` — Logs de auditoria

### TechOps
- \`tech_clients\` — Clientes técnicos
- \`tech_assets\` — Infraestrutura
- \`tech_incidents\` — Incidentes
- \`tech_credentials\` — Credenciais
- \`tech_users\` — Usuários técnicos
- \`tech_on_call_shifts\` — Plantão

### Academy
- \`academy_enrollments\` — Matrículas do OPEN Academy

### Comissões
- \`user_commission_overrides\` — Overrides de comissão por executivo

## Políticas RLS

Todas as tabelas utilizam Row Level Security (RLS). Os padrões principais:
- **Tabelas públicas** (propostas): \`anon\` pode ler, \`authenticated\` pode CRUD
- **Tabelas internas** (tech_*, cert_*): Exigem \`is_tech_team_member()\` ou \`is_tech_admin()\`
- **Tracking** (proposal_views): Deny em client-side, insert apenas via Edge Function com SERVICE_ROLE_KEY
`,

  'core/open_business_rules': `# Regras de Negócio

## Níveis de Acesso (User Levels)

| Level | Cargo | Tipo |
|-------|-------|------|
| 1 | Cliente | Externo |
| 200 | Parceiro | Externo |
| 600 | RH | Interno |
| 680 | BDR | Interno |
| 690 | Arquiteto de Soluções | Interno |
| 700 | Comercial (Executivo) | Interno |
| 750 | Gerente Comercial | Interno |
| 775 | Sucesso do Cliente | Interno |
| 900 | Suporte | Interno |
| 950 | Gerente de Suporte | Interno |
| 1000 | Admin | Interno |

## Regras de Propostas

1. **Criação**: Apenas levels 700, 750 e 1000 podem criar propostas
2. **Visualização**: Executivos veem apenas suas próprias; Gerentes e Admin veem todas
3. **Aprovação**: Via link público com token único
4. **Canal**: Se \`channel_type = PARCEIRO\`, \`reseller_name\` é obrigatório
5. **Display ID**: Único por proposta, gerado automaticamente

## Regras de Comissões

- Comissão padrão por cargo pode ser sobrescrita via \`user_commission_overrides\`
- Gerentes recebem comissão sobre as propostas de seus executivos

## Regras de Atendimento

- SLAs: PADRAO, PREMIUM, CRITICO
- Severidades: S1 (crítica) a S4 (informativa)
- Incidentes podem ser escalados de N1 → N2 → N3
`,

  'core/open_module_map': [
    '# OPEN Module Map',
    '',
    '## 1. Objetivo',
    '',
    'Mapear a organização funcional da plataforma OPEN, seus módulos, sub-rotas e dependências.',
    '',
    '---',
    '',
    '## 2. Navegação Principal',
    '',
    '| Módulo | Rota | Ícone | Acesso mínimo |',
    '|--------|------|-------|---------------|',
    '| Dashboard | `/modulos/dashboard` | LayoutDashboard | 700 |',
    '| Comercial | `/modulos/comercial` | TrendingUp | 700 |',
    '| Parceiros | `/modulos/parceiros` | Handshake | 750 |',
    '| Atendimentos | `/modulos/atendimentos` | HeadphonesIcon | 775 |',
    '| Docs | `/modulos/docs` | BookOpen | 700 |',
    '| Conteúdo & Documentação | `/modulos/conteudo` | FileText | 700 |',
    '| Gente & Gestão | `/modulos/gente` | Users | 600 |',
    '| Admin | `/modulos/admin` | Settings | 1000 |',
    '',
    '---',
    '',
    '## 3. Comercial',
    '',
    'Responsável pela gestão comercial completa: propostas, contratos, executivos, metas e comissões.',
    '',
    '| Seção | Rota | Descrição |',
    '|-------|------|-----------|',
    '| Visão Geral | `/modulos/comercial` | Home do módulo |',
    '| Executivos | `/modulos/comercial/executivos` | Lista de executivos |',
    '| Gestão Executivos | `/modulos/comercial/gestao-executivos` | Admin de executivos |',
    '| Propostas | `/modulos/comercial/propostas` | Lista de propostas |',
    '| Criar Proposta | `/modulos/comercial/propostas/criar` | Calculadora de preços |',
    '| Contratos | `/modulos/comercial/contratos` | Lista de contratos |',
    '| Metas | `/modulos/comercial/metas` | Metas comerciais |',
    '| Comissões | `/modulos/comercial/comissoes` | Comissões por executivo |',
    '| Meu Potencial | `/modulos/comercial/meu-potencial` | Potencial individual |',
    '| Potencial Gerente | `/modulos/comercial/potencial-gerente` | Potencial agregado |',
    '',
    '---',
    '',
    '## 4. Parceiros',
    '',
    'Gestão de canais de venda: ISV, VAR e Finder.',
    '',
    '| Seção | Rota | Descrição |',
    '|-------|------|-----------|',
    '| Dashboard Executivo | `/modulos/parceiros/dashboard` | Visão gerencial |',
    '| Gestão | `/modulos/parceiros/gestao` | Admin de parceiros |',
    '| Propostas | `/modulos/parceiros/propostas` | Propostas de parceiros |',
    '| Comissões | `/modulos/parceiros/comissoes` | Comissões de parceiros |',
    '',
    'Portal do parceiro (layout separado):',
    '',
    '| Seção | Rota |',
    '|-------|------|',
    '| Login | `/parceiro/login` |',
    '| Dashboard | `/parceiro/dashboard` |',
    '| Calculadora | `/parceiro/calculadora` |',
    '| Indicações | `/parceiro/indicacoes` |',
    '',
    '---',
    '',
    '## 5. Atendimentos',
    '',
    'Sistema de suporte, incidentes e SLAs.',
    '',
    '| Sub-módulo | Rota | Descrição |',
    '|------------|------|-----------|',
    '| Atendimento Interno | `/modulos/atendimentos/interno` | Chamados entre equipes |',
    '| Suporte Técnico (NOC) | `/modulos/atendimentos/suporte-tecnico` | Incidentes de clientes |',
    '| Certidão de Nascimento | `/modulos/atendimentos/certidoes` | Documentação de ativos |',
    '| Customer Success | `/modulos/atendimentos/cs` | Acompanhamento de clientes |',
    '| KPIs Suporte | `/modulos/atendimentos/kpis/suporte` | Indicadores de suporte |',
    '| KPIs CS | `/modulos/atendimentos/kpis/cs` | Indicadores de CS |',
    '| KPIs Gestão | `/modulos/atendimentos/kpis/gestao` | Indicadores gerenciais |',
    '',
    '---',
    '',
    '## 6. Docs',
    '',
    'Wiki técnico interno da OPEN.',
    '',
    '| Seção | Rota | Descrição |',
    '|-------|------|-----------|',
    '| Home | `/modulos/docs` | Portal de documentação |',
    '| Documento | `/modulos/docs/{slug}` | Visualização de doc |',
    '| Downloads | `/modulos/docs/downloads` | Arquivos para download |',
    '',
    '---',
    '',
    '## 7. Conteúdo & Documentação',
    '',
    'Área institucional, artigos e base de conhecimento.',
    '',
    '| Seção | Rota |',
    '|-------|------|',
    '| Base de Conhecimento | `/modulos/conteudo/base-conhecimento` |',
    '| Materiais | `/modulos/conteudo/materiais` |',
    '| Procedimentos | `/modulos/conteudo/procedimentos` |',
    '',
    '---',
    '',
    '## 8. Gente & Gestão',
    '',
    'Gestão de pessoas, vagas e academy.',
    '',
    '| Seção | Rota |',
    '|-------|------|',
    '| Vagas | `/modulos/gente/vagas` |',
    '| Academy | `/modulos/gente/academy` |',
    '| Avaliações | `/modulos/gente/avaliacoes` |',
    '| Estrutura | `/modulos/gente/estrutura` |',
    '| Metas Internas | `/modulos/gente/metas-internas` |',
    '',
    '---',
    '',
    '## 9. Admin',
    '',
    'Configurações globais do sistema. Acesso restrito ao nível 1000.',
    '',
    '| Seção | Rota |',
    '|-------|------|',
    '| Usuários | `/modulos/admin/usuarios` |',
    '| Permissões | `/modulos/admin/permissoes` |',
    '| Preços | `/modulos/admin/precos` |',
    '| Parâmetros | `/modulos/admin/parametros` |',
    '| Logs | `/modulos/admin/logs` |',
    '',
    '---',
    '',
    '## 10. Dashboard',
    '',
    'Visão executiva com KPIs, alertas e indicadores.',
    '',
    '| Seção | Rota |',
    '|-------|------|',
    '| Home | `/modulos/dashboard` |',
    '| Indicadores | `/modulos/dashboard/indicadores` |',
    '| Alertas | `/modulos/dashboard/alertas` |',
    '',
    '---',
    '',
    '## 11. Dependências entre Módulos',
    '',
    '| Módulo | Depende de |',
    '|--------|-----------|',
    '| Comercial | Partners, Contracts, Proposals, Calculator Configs |',
    '| Parceiros | Partners API, Proposals |',
    '| Atendimentos | Tech Clients, Tech Assets, Incidents |',
    '| Docs | Registry local (futuro: Supabase) |',
    '| Admin | Users API, Calculator Configs |',
    '| Dashboard | Propostas, Contratos, KPIs (cross-module) |',
    '',
    '---',
    '',
    '## 12. Regra de Documentação',
    '',
    'Todo módulo da OPEN deve possuir uma página correspondente dentro de `/docs/modules/`.',
    '',
    'Checklist por módulo:',
    '',
    '- [ ] Página em `/modulos/docs/modules/{nome}`',
    '- [ ] Entrada no registry (`src/data/docs/registry.ts`)',
    '- [ ] Conteúdo no content (`src/data/docs/content.ts`)',
    '- [ ] Tags e summary preenchidos',
    '- [ ] Marcado como `downloadable: true`',
  ].join('\n'),

  'core/open_event_model': [
    '# OPEN Event Model',
    '',
    '## 1. Objetivo',
    '',
    'Definir o padrão de eventos do sistema OPEN, utilizado para:',
    '',
    '- **Auditoria** — registro imutável de ações',
    '- **Analytics** — métricas de uso e engajamento',
    '- **Tracking** — rastreamento de visualizações e interações',
    '- **Histórico de ações** — timeline de atividades por entidade',
    '',
    '---',
    '',
    '## 2. Regra de Nomenclatura',
    '',
    'Formato padrão: `entity.action`',
    '',
    '| Exemplo | Descrição |',
    '|---------|-----------|',
    '| `proposal.view_public` | Visualização externa de proposta |',
    '| `proposal.view_internal` | Visualização interna de proposta |',
    '| `proposal.link_copied` | Link de proposta copiado |',
    '| `proposal.email_sent` | Email de proposta enviado |',
    '| `proposal.pdf_download` | PDF de proposta baixado |',
    '| `proposal.approved` | Proposta aprovada |',
    '| `proposal.rejected` | Proposta recusada |',
    '| `contract.created` | Contrato criado |',
    '| `contract.signed` | Contrato assinado |',
    '',
    '---',
    '',
    '## 3. Eventos de Proposta',
    '',
    '| Evento | Descrição | Ator típico |',
    '|--------|-----------|-------------|',
    '| `proposal.view_public` | Usuário externo abriu proposta via link público | Cliente |',
    '| `proposal.view_internal` | Usuário interno abriu proposta no painel | Executivo / Gerente |',
    '| `proposal.link_copied` | Link da proposta foi copiado | Executivo |',
    '| `proposal.email_sent` | Email com proposta foi enviado | Executivo |',
    '| `proposal.pdf_download` | PDF da proposta foi baixado | Cliente / Executivo |',
    '| `proposal.approved` | Proposta aprovada via link público | Cliente |',
    '| `proposal.rejected` | Proposta recusada via link público | Cliente |',
    '',
    '---',
    '',
    '## 4. Eventos de Contrato',
    '',
    '| Evento | Descrição |',
    '|--------|-----------|',
    '| `contract.created` | Contrato criado a partir de proposta aprovada |',
    '| `contract.updated` | Contrato atualizado (termos, valores) |',
    '| `contract.signed` | Contrato assinado digitalmente |',
    '| `contract.cancelled` | Contrato cancelado |',
    '| `contract.expired` | Contrato expirou por prazo |',
    '',
    '---',
    '',
    '## 5. Schema Canônico de Evento',
    '',
    'Estrutura JSON padrão para todos os eventos:',
    '',
    '| Campo | Tipo | Descrição |',
    '|-------|------|-----------|',
    '| `id` | UUID | Identificador único do evento |',
    '| `entity` | string | Entidade (ex.: `proposal`, `contract`) |',
    '| `action` | string | Ação (ex.: `view_public`, `approved`) |',
    '| `event_name` | string | Nome completo (`entity.action`) |',
    '| `entity_id` | UUID | ID da entidade relacionada |',
    '| `occurred_at` | timestamp | Data/hora do evento |',
    '| `actor_type` | string | Tipo do ator (`internal`, `external`, `system`) |',
    '| `actor_id` | string | ID do ator (user_id ou email) |',
    '| `user_id` | string | ID do usuário interno (se aplicável) |',
    '| `client_email` | string | Email do cliente (se aplicável) |',
    '| `ip_address` | string | IP de origem |',
    '| `user_agent` | string | User-Agent do navegador |',
    '| `metadata` | JSON | Dados adicionais específicos do evento |',
    '',
    '---',
    '',
    '## 6. Storage Atual',
    '',
    '| Tabela | Uso | Persistência |',
    '|--------|-----|-------------|',
    '| `proposal_views` | Eventos de proposta (view, download, email, etc.) | Supabase |',
    '',
    'A tabela `proposal_views` armazena todos os tipos de evento de proposta com o campo `source` indicando o tipo.',
    '',
    'O insert é feito exclusivamente via Edge Function `proposal-track` usando `SERVICE_ROLE_KEY` (RLS bloqueia insert client-side).',
    '',
    '---',
    '',
    '## 7. Modelo Futuro',
    '',
    'Evolução planejada para tabela única centralizada:',
    '',
    '```',
    'system_events',
    '├── id (UUID)',
    '├── event_name (text) — ex.: proposal.approved',
    '├── entity_type (text)',
    '├── entity_id (UUID)',
    '├── actor_type (text)',
    '├── actor_id (text)',
    '├── metadata (JSONB)',
    '├── ip_address (text)',
    '├── user_agent (text)',
    '├── occurred_at (timestamptz)',
    '└── created_at (timestamptz)',
    '```',
    '',
    'Isso permitirá queries unificadas de auditoria e analytics cross-entity.',
    '',
    '---',
    '',
    '## 8. Uso no Histórico de Propostas',
    '',
    'A tela **"Histórico / Ver acessos"** (`ProposalAccessModal`) consome o hook `useProposalEvents`, que:',
    '',
    '1. Chama a Edge Function `proposal-track` com ação `list`',
    '2. Filtra por `proposal_id`',
    '3. Exibe timeline de eventos com ícones e timestamps',
    '4. Calcula estatísticas (total de views, cópias de link, etc.)',
    '',
    'Eventos exibidos nessa tela:',
    '',
    '- `proposal.view_public`',
    '- `proposal.pdf_download`',
    '- `proposal.email_sent`',
    '- `proposal.link_copied`',
    '',
    '---',
    '',
    '## 9. Regras',
    '',
    '1. **Append-only** — Eventos nunca são editados ou deletados',
    '2. **Imutabilidade** — Uma vez registrado, o evento é permanente',
    '3. **Pós-sucesso** — Registrar evento somente após sucesso da ação principal',
    '4. **Sem duplicação** — Evitar registrar o mesmo evento múltiplas vezes para a mesma ação',
    '5. **Timezone** — Sempre usar `timestamptz` (UTC)',
    '',
    '---',
    '',
    '## 10. Casos Futuros',
    '',
    '| Caso | Descrição |',
    '|------|-----------|',
    '| **Analytics** | Dashboard de métricas baseado em eventos |',
    '| **Conversão** | Taxa de conversão proposta → contrato |',
    '| **Engajamento** | Frequência de visualizações por cliente |',
    '| **Alertas** | Notificações baseadas em eventos (ex.: proposta vista mas não aprovada) |',
    '| **Relatórios** | Export de eventos por período e entidade |',
  ].join('\n'),

  // Modules
  'modules/comercial': `# Módulo Comercial

## Visão Geral
O módulo comercial é o coração do sistema OPEN, responsável por toda a gestão de vendas.

## Funcionalidades

### Propostas
- Calculadora de preços com VMs, Bare Metal, GPU, Storage e Addons
- Geração de PDF
- Envio por email
- Aprovação via link público
- Tracking de visualizações e eventos

### Executivos
- Lista de executivos comerciais
- Gestão de executivos (Admin/Gerente)
- Potencial de vendas individual e agregado

### Metas
- Metas comerciais por executivo
- Acompanhamento mensal

### Comissões
- Cálculo automático baseado em regras
- Override por executivo
- Visualização por período

## Rotas
- \`/modulos/comercial\` — Home do módulo
- \`/modulos/comercial/propostas\` — Lista de propostas
- \`/modulos/comercial/propostas/criar\` — Calculadora
- \`/modulos/comercial/executivos\` — Lista de executivos
- \`/modulos/comercial/metas\` — Metas
- \`/modulos/comercial/comissoes\` — Comissões
`,

  'modules/parceiros': `# Módulo Parceiros

## Visão Geral
Gestão de parceiros ISV, VAR e Finder da OPEN Datacenter.

## Tipos de Parceiro
- **ISV** — Independent Software Vendor
- **VAR** — Value Added Reseller
- **FINDER** — Indicador de negócios

## Funcionalidades
- Cadastro de parceiros (portal público)
- Dashboard do parceiro (nível 200)
- Calculadora de preços para parceiros
- Indicações e tracking
- Gestão de comissões
- Aceite de contrato digital

## Gestão (Admin/Gerente)
- Dashboard executivo de parceiros
- Gestão de parceiros (aprovação, edição)
- Visualização de propostas de parceiros
- Gestão de comissões de parceiros

## Rotas
- \`/parceiro/*\` — Portal do parceiro (PartnerLayout)
- \`/modulos/parceiros/*\` — Gestão interna (ModuleLayout)
`,

  'modules/atendimentos': `# OPEN — Módulo de Atendimentos / Suporte Técnico

Versão: v1  
Sistema: core.opendata.center  
Última atualização: 2026-03-15

---

## 1. Objetivo do módulo

O módulo **ATENDIMENTOS** é o centro de operações (NOC) da plataforma OPEN, responsável por:

- **Gestão de chamados técnicos** — abertura, triagem, atendimento, resolução e encerramento
- **Operação de suporte escalonado** — N1 (primeiro atendimento), N2 (análise técnica), N3 (engenharia)
- **Integração com clientes** — portal externo para abertura e acompanhamento de chamados
- **Gestão de SLA** — políticas parametrizáveis por severidade, tipo e plano do cliente
- **Registro de incidentes** — incidentes críticos de infraestrutura vinculados a ativos
- **Rastreamento de atividades** — timeline completa de eventos, mensagens e transições
- **Customer Success** — validação de resolução e encerramento definitivo pelo CS

Este módulo funciona como o **NOC operacional da OPEN**.

---

## 2. Estrutura do módulo

### Menu principal

**ATENDIMENTOS** (\`/modulos/atendimentos\`)

### Submódulos

| Submódulo | Rota | Descrição |
|-----------|------|-----------|
| **Visão Geral** | \`/modulos/atendimentos\` | Dashboard operacional com KPIs em tempo real |
| **Analistas** | \`/modulos/atendimentos/analistas\` | Gestão de analistas e membros das filas |
| **Suporte Técnico** | \`/modulos/atendimentos/suporte-tecnico\` | Sistema de chamados principal |
| **Customer Success** | \`/modulos/atendimentos/cs\` | Validação, encerramento e health score |
| **KPIs de Atendimento** | \`/modulos/atendimentos/kpis\` | Métricas e indicadores |

---

## 3. Visão Geral do NOC

A tela principal funciona como dashboard operacional de gestão em tempo real.

### SLA Hoje

| Indicador | Descrição |
|-----------|-----------|
| Tickets abertos | Total de chamados em andamento |
| Dentro do SLA | Chamados dentro do prazo contratado |
| Fora do SLA | Chamados que violaram o SLA |
| Incidentes críticos | Chamados S1/S2 ativos |

### Distribuição de Filas

| Fila | Responsabilidade |
|------|-----------------|
| N1 | Triagem e primeiro atendimento |
| N2 | Análise técnica e infraestrutura |
| N3 | Engenharia e vendor escalation |
| CS | Validação e encerramento |

### Plantão Ativo

Fonte: tabela \`support_oncall\` — analistas ativos por time (Infra, Cloud, CS).

### Tempo Médio

- Primeira resposta
- Resolução

Atualização automática via React Query (60s). Edge Function: \`support-dashboard-stats\`.

---

## 4. Tipos de atendimento

### Níveis de suporte

| Nível | Fila | Responsabilidade |
|-------|------|-----------------|
| **N1** | N1 | Triagem, primeiro atendimento, resolução básica |
| **N2** | N2 | Análise técnica aprofundada, infraestrutura |
| **N3** | N3 | Engenharia, arquitetura, vendor escalation |
| **CS** | CS | Validação e fechamento |

### Tipos de chamado

| Tipo | Descrição |
|------|-----------|
| \`incidente\` | Falha ou degradação em serviço ativo |
| \`solicitacao\` | Pedido de ação |
| \`duvida\` | Pergunta técnica ou operacional |
| \`alteracao\` | Mudança em configuração existente |
| \`financeiro\` | Questão de faturamento, NF, cobrança |

---

## 5. Estrutura de tickets

### Campos principais

| Campo | Tipo | Descrição |
|-------|------|-----------|
| \`id\` | UUID | Identificador interno |
| \`public_code\` | string | Código público (TIC-YYYY-NNNNNN) |
| \`title\` | string | Título do chamado |
| \`description\` | text | Descrição detalhada |
| \`severity\` | enum | S1, S2, S3, S4 |
| \`priority\` | enum | critical, high, medium, low |
| \`status\` | enum | Status atual |
| \`current_queue_id\` | UUID | Fila atual |
| \`assigned_to_user_id\` | string | Responsável |
| \`origin_channel\` | enum | Canal de origem |

### Severidades e SLA

| Severidade | Contagem SLA | 1ª Resposta | Resolução |
|------------|-------------|-------------|-----------|
| **S1** Crítico | 24×7 | 15 min | 2h |
| **S2** Alto | 24×7 | 30 min | 4h |
| **S3** Médio | 24×7 | 60 min | 8h |
| **S4** Baixo | Comercial | 4h | 24h |

### Status possíveis

| Status | Quem altera |
|--------|-------------|
| \`novo\` | Sistema |
| \`triagem\` | N1 assume |
| \`em_atendimento\` | Suporte |
| \`aguardando_cliente\` | Suporte |
| \`aguardando_terceiro\` | Suporte |
| \`escalado_n2\` | Suporte |
| \`escalado_n3\` | Suporte/Gerente |
| \`resolvido_suporte\` | Suporte |
| \`encerrado_cs\` | CS |
| \`reaberto\` | CS/Gerente |
| \`cancelado\` | Gerente/Admin |

---

## 6. Fluxo de atendimento

\`\`\`
NOVO → TRIAGEM → EM_ATENDIMENTO → AGUARDANDO_CLIENTE → RESOLVIDO_SUPORTE → ENCERRADO_CS
           ↓                            ↑
        ESCALADO_N2/N3 ────────────────┘
           ↓
        REABERTO ──→ (volta para fila operacional)
\`\`\`

### Eventos registrados

| Evento | Gatilho |
|--------|---------|
| \`ticket.created\` | Ticket criado |
| \`ticket.status_changed\` | Mudança de status |
| \`ticket.assigned\` | Ticket atribuído |
| \`ticket.transferred\` | Transferido entre filas |
| \`ticket.escalated\` | Escalado para N2/N3 |
| \`ticket.resolved\` | Resolvido pelo suporte |
| \`ticket.closed\` | Encerrado pelo CS |
| \`ticket.reopened\` | Reaberto |
| \`ticket.cancelled\` | Cancelado |
| \`ticket.message_added\` | Mensagem adicionada |
| \`ticket.attachment_uploaded\` | Anexo enviado |
| \`ticket.sla_breached\` | SLA violado (futuro: cron) |

Padrão: \`entity.action\` — registrados em \`support_ticket_events\` (append-only).

---

## 7. Integrações do módulo

| Canal | Status | Descrição |
|-------|--------|-----------|
| Portal do Cliente | ✅ | \`/portal/tickets\` |
| Portal Interno | ✅ | \`/modulos/atendimentos/suporte-tecnico\` |
| API | ✅ | Edge Functions |
| Email | 🔜 | Futuro |
| Zabbix | 🔜 | \`origin_channel = 'zabbix'\` preparado |
| WhatsApp | 🔜 | Planejado |

---

## 8. RBAC do módulo

| Papel | Level | Capacidades |
|-------|-------|-------------|
| Cliente | 1 | Abre chamados, acompanha, vê apenas próprios tickets (\`/portal/tickets\`) |
| Parceiro | 200 | Sem acesso ao módulo |
| RH | 600 | Pode abrir chamados internos |
| CS | 775 | Valida resolução, encerra, reabre, notas internas |
| Suporte | 900 | Assume, trata, escala, resolve, notas internas |
| Gerente Suporte | 950 | Atribuição, transferência, cancelamento, visão global |
| Admin | 1000 | Acesso total, parametriza SLA, gerencia catálogos |

### Matriz de permissões

| Permissão | Cliente | CS (775) | Suporte (900) | Gerente (950) | Admin (1000) |
|-----------|---------|----------|---------------|---------------|--------------|
| Abrir chamado | ✅ | ✅ | ✅ | ✅ | ✅ |
| Ver próprios tickets | ✅ | ✅ | ✅ | ✅ | ✅ |
| Ver tickets da equipe | ❌ | ✅ | ✅ | ✅ | ✅ |
| Atribuir tickets | ❌ | ❌ | ✅ | ✅ | ✅ |
| Escalar tickets | ❌ | ❌ | ✅ | ✅ | ✅ |
| Resolver tickets | ❌ | ❌ | ✅ | ✅ | ✅ |
| Encerrar tickets | ❌ | ✅ | ❌ | ✅ | ✅ |
| Reabrir tickets | ❌ | ✅ | ❌ | ✅ | ✅ |
| Transferir filas | ❌ | ❌ | ❌ | ✅ | ✅ |
| Gerenciar SLA | ❌ | ❌ | ❌ | ✅ | ✅ |
| Cancelar tickets | ❌ | ❌ | ❌ | ✅ | ✅ |

---

## 9. Modelo de dados

### Tabelas

| Tabela | Descrição |
|--------|-----------|
| \`support_tickets\` | Tickets principais (TIC-YYYY-NNNNNN) |
| \`support_ticket_messages\` | Mensagens e notas internas |
| \`support_ticket_attachments\` | Anexos |
| \`support_ticket_assignments\` | Histórico de atribuições |
| \`support_ticket_status_history\` | Histórico de status |
| \`support_ticket_queue_history\` | Histórico de filas |
| \`support_ticket_watchers\` | Observadores |
| \`support_ticket_events\` | Eventos (append-only) |
| \`support_sla_policies\` | Políticas de SLA |
| \`support_catalog_categories\` | Catálogo de categorias |
| \`support_catalog_services\` | Catálogo de serviços |
| \`support_queues\` | Definição das filas |
| \`support_queue_members\` | Membros das filas |
| \`support_oncall\` | Plantões ativos |
| \`support_notifications\` | Notificações |

### Enums

| Enum | Valores |
|------|---------|
| \`support_ticket_status\` | novo, triagem, em_atendimento, aguardando_cliente, aguardando_terceiro, escalado_n2, escalado_n3, resolvido_suporte, encerrado_cs, reaberto, cancelado |
| \`support_level_enum\` | N1, N2, N3 |
| \`support_queue_enum\` | N1, N2, N3, CS |
| \`support_author_type\` | client, support, cs, manager, system, integration |
| \`support_origin_channel\` | portal, internal_portal, zabbix, api, email |
| \`support_severity\` | S1, S2, S3, S4 |
| \`support_priority\` | critical, high, medium, low |

---

## 10. Edge Functions

| Função | Descrição |
|--------|-----------|
| \`support-ticket-create\` | Criar ticket com SLA auto-calculado |
| \`support-ticket-list\` | Listar com filtros, paginação, visibilidade |
| \`support-ticket-get\` | Buscar ticket completo |
| \`support-ticket-update\` | Ações: assign, start, escalate, resolve, close, reopen, cancel, transfer |
| \`support-ticket-messages\` | Mensagens e notas internas |
| \`support-ticket-upload\` | Upload de anexos |
| \`support-sla-admin\` | CRUD de políticas SLA |
| \`support-queue-admin\` | Gestão de membros das filas |
| \`support-dashboard-stats\` | KPIs operacionais |

Segurança: \`SERVICE_ROLE_KEY\` (bypass RLS) + validação de \`user_level\`.

---

## 11. KPIs do suporte

| Indicador | Descrição |
|-----------|-----------|
| Tickets abertos | Total em andamento |
| Tempo médio 1ª resposta | Média de first_response_at - created_at |
| Tempo médio resolução | Média de resolved_at - created_at |
| SLA cumprido | % dentro do prazo |
| SLA violado | % fora do prazo |
| Distribuição por fila | Volume por N1/N2/N3/CS |
| Incidentes críticos | S1/S2 ativos |

---

## 12. Regras de negócio

1. Suporte resolve, mas **não** encerra — CS faz o fechamento final
2. Reabertura retorna o ticket para a fila operacional
3. Notas internas (\`is_internal_note=true\`) **nunca** visíveis para clientes
4. Cliente respondendo em \`aguardando_cliente\` move ticket para \`em_atendimento\`
5. Primeira resposta interna registra \`first_response_at\`
6. SLA calculado automaticamente na criação
7. Código público único via trigger (\`TIC-YYYY-NNNNNN\`)

---

## 13. Roadmap do módulo

| Funcionalidade | Status |
|----------------|--------|
| Automação de SLA (cron) | Planejado |
| Auto classificação de tickets | Planejado |
| IA para triagem | Planejado |
| Integração Zabbix | Preparado |
| Correlação de incidentes | Planejado |
| Sugestão de solução | Planejado |
| Integração Email | Planejado |
| Relatórios avançados | Planejado |

---

## 14. Boas práticas operacionais

1. Separação clara entre N1, N2 e N3
2. Registro completo de atividades em timeline
3. Escalonamento rápido para incidentes críticos (S1/S2)
4. Uso de notas internas para comunicação entre equipe
5. Registro de causa raiz na resolução
6. Templates de resposta para comunicações frequentes
7. Plantão atualizado na tabela \`support_oncall\`
8. Monitoramento de SLA em tempo real via dashboard

---

## 15. Componentes UI

| Componente | Descrição |
|------------|-----------|
| \`TicketCreateModal\` | Modal de criação de tickets |
| \`TicketTable\` | Tabela de listagem com filtros |
| \`TicketStatusBadge\` | Badge visual de status |
| \`TicketSeverityBadge\` | Badge de severidade |
| \`TicketSlaBadge\` | Contagem regressiva de SLA |
| \`TicketActionsPanel\` | Painel de ações |
| \`TicketMessages\` | Timeline de mensagens |
| \`TicketTimeline\` | Timeline de eventos |
| \`SLAKPICards\` | KPIs de SLA |
| \`QueueDistributionCard\` | Distribuição por fila |
| \`ResponseTimeCard\` | Tempos médios |
| \`OnCallWidget\` | Widget de plantão ativo |
`,

  'modules/admin': `# Módulo Admin

## Visão Geral
Administração completa do sistema OPEN. Acesso restrito ao nível 1000 (Admin).

## Funcionalidades

### Gestão de Usuários
- CRUD de usuários
- Definição de níveis de acesso
- Filtros por nome, email, nível

### Permissões & Perfis
- Visualização da matriz de permissões
- Configuração de acesso por módulo

### Configuração de Preços
- CRUD de configurações de preços
- Organizado por categoria e seção
- Protegido por PIN + Token

### Parâmetros do Sistema
- Configurações gerais

### Logs & Auditoria
- Registro de ações do sistema
- Auditoria de alterações

## Rotas
- \`/modulos/admin\` — Home do módulo
- \`/modulos/admin/usuarios\` — Gestão de usuários
- \`/modulos/admin/permissoes\` — Permissões
- \`/modulos/admin/precos\` — Preços
- \`/modulos/admin/parametros\` — Parâmetros
- \`/modulos/admin/logs\` — Logs
`,

  // API
  'api/api_reference': [
    '# OPEN API Reference',
    '',
    '## 1. Visão Geral',
    '',
    'A plataforma OPEN utiliza duas camadas de API:',
    '',
    '| Camada | Tecnologia | Status |',
    '|--------|-----------|--------|',
    '| **APIs Legadas** | Laravel (PHP) | Em uso — apenas manutenção |',
    '| **Operações Novas** | Supabase (Edge Functions + SDK) | Em expansão — fonte de verdade |',
    '',
    '### Regras Arquiteturais',
    '',
    '1. **Novos módulos** devem usar Supabase exclusivamente',
    '2. **APIs Laravel** existem apenas para funcionalidades legadas',
    '3. **Não criar novos endpoints** no Laravel',
    '4. **Supabase** é a fonte de verdade para todos os dados novos',
    '5. O frontend deve consumir Supabase diretamente (SDK) ou via Edge Functions quando necessário `SERVICE_ROLE_KEY`',
    '',
    '---',
    '',
    '## 2. Endpoints Legados (Laravel)',
    '',
    'Base URL: configurada via variável de ambiente',
    '',
    'Autenticação: `Authorization: Bearer {token}`',
    '',
    '### Auth',
    '',
    '| Método | Endpoint | Descrição |',
    '|--------|----------|-----------|',
    '| `POST` | `/api/auth/login` | Autentica usuário e retorna token de sessão |',
    '| `GET` | `/api/auth/me` | Retorna usuário autenticado (requer token) |',
    '',
    '**Login — Request Body:**',
    '```json',
    '{ "email": "string", "password": "string" }',
    '```',
    '',
    '**Login — Response:**',
    '```json',
    '{ "token": "string", "user": { "id": 1, "name": "...", "email": "...", "level": 1000 } }',
    '```',
    '',
    '---',
    '',
    '### Calculator Proposals',
    '',
    '| Método | Endpoint | Descrição |',
    '|--------|----------|-----------|',
    '| `GET` | `/api/calculator/proposal` | Lista propostas |',
    '| `POST` | `/api/calculator/proposal` | Cria proposta |',
    '| `GET` | `/api/calculator/proposal/{id}` | Busca proposta por ID |',
    '| `PUT` | `/api/calculator/proposal/{id}` | Atualiza proposta |',
    '| `DELETE` | `/api/calculator/proposal/{id}` | Remove proposta |',
    '| `GET` | `/api/calculator/proposal/{id}/download?token=...` | Download do PDF |',
    '',
    '> **Nota:** O módulo de propostas está em transição para Supabase. Novas propostas são salvas via Edge Function `proposal-save`.',
    '',
    '---',
    '',
    '### Partner',
    '',
    '| Método | Endpoint | Descrição |',
    '|--------|----------|-----------|',
    '| `GET` | `/api/partner` | Lista parceiros |',
    '| `POST` | `/api/partner` | Cria parceiro |',
    '| `GET` | `/api/partner/{id}` | Busca parceiro por ID |',
    '| `PUT` | `/api/partner/{id}` | Atualiza parceiro |',
    '| `DELETE` | `/api/partner/{id}` | Remove parceiro |',
    '',
    '---',
    '',
    '### Ticket',
    '',
    '| Método | Endpoint | Descrição |',
    '|--------|----------|-----------|',
    '| `GET` | `/api/ticket` | Lista tickets |',
    '| `POST` | `/api/ticket` | Cria ticket |',
    '| `GET` | `/api/ticket/{id}` | Busca ticket por ID |',
    '',
    '---',
    '',
    '### Company',
    '',
    '| Método | Endpoint | Descrição |',
    '|--------|----------|-----------|',
    '| `GET` | `/api/company` | Lista empresas |',
    '',
    '---',
    '',
    '### Datacenter',
    '',
    '| Método | Endpoint | Descrição |',
    '|--------|----------|-----------|',
    '| `GET` | `/api/dc` | Lista datacenters disponíveis |',
    '',
    '---',
    '',
    '### Incidents',
    '',
    '| Método | Endpoint | Descrição |',
    '|--------|----------|-----------|',
    '| `GET` | `/api/incidents` | Lista incidentes |',
    '',
    '---',
    '',
    '### Audit Log',
    '',
    '| Método | Endpoint | Descrição |',
    '|--------|----------|-----------|',
    '| `GET` | `/api/audit-log` | Lista logs de auditoria |',
    '',
    '---',
    '',
    '### Annual Goals',
    '',
    '| Método | Endpoint | Descrição |',
    '|--------|----------|-----------|',
    '| `GET` | `/api/annual-goal` | Lista metas anuais |',
    '',
    '---',
    '',
    '### Users',
    '',
    '| Método | Endpoint | Descrição |',
    '|--------|----------|-----------|',
    '| `GET` | `/api/user` | Lista usuários |',
    '| `POST` | `/api/user` | Cria usuário |',
    '| `PUT` | `/api/user/{id}` | Atualiza usuário |',
    '| `DELETE` | `/api/user/{id}` | Remove usuário |',
    '',
    '---',
    '',
    '## 3. Padrão de Filtros do Legado',
    '',
    'A API Laravel utiliza parâmetros de query especiais com prefixo `__`:',
    '',
    '| Parâmetro | Descrição |',
    '|-----------|-----------|',
    '| `__page` | Número da página |',
    '| `__perPage` | Itens por página |',
    '| `__limit` | Limite de resultados |',
    '| `__order` | Ordenação (ex.: `-created_at` para desc) |',
    '| `__with` | Eager loading de relações |',
    '| `__q` | Busca textual geral |',
    '',
    '**Exemplo:**',
    '```',
    'GET /api/partner?__page=1&__perPage=20&__q=open&__order=-created_at',
    '```',
    '',
    '---',
    '',
    '## 4. Operações no Modelo Supabase',
    '',
    '### Propostas',
    '',
    '| Operação | Método | Descrição |',
    '|----------|--------|-----------|',
    '| `proposal.create` | Edge Function `proposal-save` | Cria proposta (upsert por `display_id`) |',
    '| `proposal.update` | Edge Function `proposal-save` | Atualiza proposta existente |',
    '| `proposal.list` | Edge Function `proposal-list` | Lista propostas com filtros e paginação |',
    '| `proposal.send_email` | Edge Function `send-proposal-email` | Envia proposta por email via Resend |',
    '| `proposal.download_pdf` | Frontend (jsPDF) | Geração de PDF client-side |',
    '| `proposal.copy_link` | Frontend | Copia link público de aprovação |',
    '| `proposal.track_event` | Edge Function `proposal-track` | Registra evento (view, download, email) |',
    '| `proposal.get_access_history` | Edge Function `proposal-track` | Retorna histórico de acessos |',
    '',
    '### Contratos',
    '',
    '| Operação | Método | Descrição |',
    '|----------|--------|-----------|',
    '| `contract.create_from_proposal` | Supabase SDK | Cria contrato a partir de proposta aprovada |',
    '| `contract.list` | Supabase SDK | Lista contratos |',
    '| `contract.update` | Supabase SDK | Atualiza contrato |',
    '',
    '### Aprovação Pública',
    '',
    '| Operação | Método | Descrição |',
    '|----------|--------|-----------|',
    '| `approval.process` | Edge Function `public-approval` | Processa aprovação/rejeição via token |',
    '',
    '### Preços',
    '',
    '| Operação | Método | Descrição |',
    '|----------|--------|-----------|',
    '| `pricing.crud` | Edge Function `pricing-admin` | CRUD de configurações de preços |',
    '',
    '---',
    '',
    '## 5. Edge Functions Implementadas',
    '',
    '| Função | Descrição | Auth |',
    '|--------|-----------|------|',
    '| `proposal-save` | Salva/atualiza proposta com servidores e addons | SERVICE_ROLE_KEY |',
    '| `proposal-list` | Lista propostas com filtros, ordenação e paginação | SERVICE_ROLE_KEY |',
    '| `proposal-track` | Registra e lista eventos de tracking | SERVICE_ROLE_KEY |',
    '| `proposal-get` | Busca proposta por UUID | SERVICE_ROLE_KEY |',
    '| `proposal-gateway` | Proxy para API legada de propostas | Bearer Token |',
    '| `send-proposal-email` | Envia email de proposta via Resend | SERVICE_ROLE_KEY + RESEND_API_KEY |',
    '| `public-approval` | Processa aprovação/rejeição pública | Anon (token de aprovação) |',
    '| `pricing-admin` | CRUD de configurações de preços | SERVICE_ROLE_KEY |',
    '| `send-password-reset` | Envia email de reset de senha | SERVICE_ROLE_KEY |',
    '',
    '---',
    '',
    '## 6. Padrão de Resposta Recomendado',
    '',
    '### Sucesso',
    '```json',
    '{',
    '  "success": true,',
    '  "data": {},',
    '  "message": "Operação realizada com sucesso"',
    '}',
    '```',
    '',
    '### Erro',
    '```json',
    '{',
    '  "success": false,',
    '  "data": null,',
    '  "message": "Descrição do erro",',
    '  "errors": ["detalhe 1", "detalhe 2"]',
    '}',
    '```',
    '',
    '### Paginação',
    '```json',
    '{',
    '  "success": true,',
    '  "data": [],',
    '  "total": 150,',
    '  "page": 1,',
    '  "limit": 20',
    '}',
    '```',
    '',
    '---',
    '',
    '## 7. Lacunas Identificadas',
    '',
    '| Área | Status | Observação |',
    '|------|--------|------------|',
    '| Contracts API | ❌ Não documentada no legado | Implementação direta via Supabase |',
    '| Docs/Wiki API | ❌ Inexistente | Conteúdo estático local, migração futura para Supabase |',
    '| Modelo de Eventos | ❌ Não documentado | `proposal_views` existe mas sem schema formal |',
    '| Upload de arquivos | ⚠️ Parcial | Legado usa multipart; Supabase usa Storage |',
    '| Webhook de aprovação | ❌ Não existe | Aprovação é síncrona via Edge Function |',
    '| Notificações | ❌ Não existe | Apenas email via Resend |',
    '',
    '---',
    '',
    '## 8. Diretriz Futura',
    '',
    '| Aspecto | Diretriz |',
    '|---------|----------|',
    '| **Backend principal** | Supabase-first |',
    '| **APIs Laravel** | Apenas legado — sem novos endpoints |',
    '| **Autenticação** | Supabase Auth (Academy) + API legada (sistema principal) |',
    '| **Banco de dados** | PostgreSQL via Supabase |',
    '| **Lógica protegida** | Edge Functions com SERVICE_ROLE_KEY |',
    '| **Armazenamento** | Supabase Storage |',
    '| **Realtime** | Supabase Realtime (quando necessário) |',
    '| **Frontend** | React + Vite + TypeScript — consumo direto do SDK |',
    '',
    '> **Regra de ouro:** Se não existe no Laravel, implemente no Supabase. Se existe no Laravel, migre quando possível.',
  ].join('\n'),

  // Playbooks
  'playbooks/proposal-flow': `# Fluxo de Propostas

## Visão Geral

O fluxo de propostas segue o padrão:

1. **Criação** → Calculadora de preços
2. **Salvamento** → Supabase (idempotente, sem duplicatas)
3. **Envio** → Email via Edge Function
4. **Tracking** → Eventos registrados em \`proposal_views\`
5. **Aprovação** → Link público com token
6. **PDF** → Geração e download

## Fluxo Detalhado

### 1. Criação
- Usuário acessa \`/modulos/comercial/propostas/criar\`
- Preenche dados do cliente
- Adiciona servidores (VM, BM, GPU, Storage)
- Adiciona addons
- Define desconto e prazo

### 2. Salvamento
- Botão "Salvar" cria/atualiza via Edge Function \`proposal-save\`
- \`display_id\` é único (constraint no banco)
- Sistema usa upsert para evitar duplicatas
- Guard de concorrência via \`savingRef\`

### 3. Envio por Email
- Botão "Enviar" NÃO salva novamente se proposta já existe
- Chama Edge Function \`send-proposal-email\`
- Status muda para "Enviado"

### 4. Aprovação
- Link público: \`/proposta/aprovacao/{token}\`
- Cliente pode aprovar ou rejeitar
- Decisão registrada no banco

## Proteções
- Duplo clique: botões desabilitados durante operação
- Duplicata: unique constraint em \`display_id\`
- Concorrência: \`useRef\` para flag de saving
`,

  'playbooks/contract-flow': `# Fluxo de Contratos

## Visão Geral

O módulo de contratos permite criar e gerenciar contratos comerciais.

## Status do Contrato
- **Rascunho** — Em edição
- **Ativo** — Vigente
- **Expirado** — Prazo encerrado
- **Cancelado** — Cancelado manualmente

## Fluxo
1. Criar contrato vinculado a uma proposta aprovada
2. Definir termos, valores e prazo
3. Enviar para assinatura
4. Registrar assinatura
5. Acompanhar vigência

## Rotas
- \`/modulos/comercial/contratos\` — Lista
- \`/modulos/comercial/contratos/novo\` — Criar
- \`/modulos/comercial/contratos/:id\` — Detalhes
`,

  // Changelog
  'changelog/changelog': `# Changelog

## 2026-03-14
- Módulo Docs criado como wiki interna
- Filtros avançados na listagem de propostas Supabase
- Correção de duplicidade no fluxo de criação de propostas
- Histórico de acessos migrado para Supabase

## 2026-03-07
- Migração completa de preços para Supabase
- Edge Function \`pricing-admin\` implementada
- CRUD de configurações via Supabase

## 2026-02-28
- Portal de parceiros lançado
- Calculadora de parceiros
- Dashboard executivo de parceiros

## 2026-02-14
- Módulo TechOps (NOC) lançado
- Certidão de Nascimento de ativos
- Gestão de incidentes

## 2026-02-07
- Plano dos 7 passos de propostas concluído
- Fluxo completo de email + aprovação + tracking
- PDF robusto implementado

## 2026-01-28
- Sistema modular (\`/modulos/*\`) implementado
- Sidebar com RBAC
- Sub-navegação por módulo
`,

  // Runbooks
  'runbooks/supabase': [
    '# OPEN Runbook — Supabase',
    '',
    '## 1. Objetivo',
    '',
    'Manual operacional da camada Supabase utilizada pela plataforma OPEN.',
    'Este runbook documenta tabelas críticas, problemas comuns e procedimentos de recuperação.',
    '',
    '---',
    '',
    '## 2. Responsabilidades do Supabase na OPEN',
    '',
    '| Domínio | Descrição |',
    '|---------|-----------|',
    '| **Proposals** | Persistência de propostas comerciais (`calculator_proposals`, servidores, addons) |',
    '| **Events** | Tracking de visualizações e ações (`proposal_views`) |',
    '| **Contracts** | Contratos gerados a partir de propostas aprovadas |',
    '| **Docs** | Wiki interna (futuro: `docs_pages`) |',
    '| **Auth** | Autenticação Academy (`auth.users` + Supabase Auth) |',
    '| **Storage** | PDFs de propostas (`proposal-files`, `bucketopen2026`) |',
    '',
    '---',
    '',
    '## 3. Tabelas Críticas',
    '',
    '| Tabela | Descrição | RLS |',
    '|--------|-----------|-----|',
    '| `calculator_proposals` | Propostas comerciais | ✅ anon SELECT + auth CRUD |',
    '| `calculator_proposal_servers` | Servidores das propostas | ✅ anon SELECT + auth CRUD |',
    '| `calculator_proposal_addons` | Addons das propostas | ✅ anon SELECT + auth CRUD |',
    '| `calculator_proposal_files` | PDFs e anexos | ✅ auth only |',
    '| `proposal_views` | Eventos de tracking | ✅ deny public (Edge Function only) |',
    '| `proposal_participants` | Participantes da proposta | ✅ public |',
    '| `calculator_configs` | Configurações de preço | ❌ sem RLS (Edge Function only) |',
    '| `user_commission_overrides` | Override de comissão | ✅ public read |',
    '',
    '---',
    '',
    '## 4. Edge Functions',
    '',
    '| Função | Descrição |',
    '|--------|-----------|',
    '| `proposal-save` | Salva/atualiza propostas (SERVICE_ROLE) |',
    '| `proposal-list` | Lista propostas (SERVICE_ROLE) |',
    '| `proposal-get` | Busca proposta por ID (SERVICE_ROLE) |',
    '| `proposal-track` | Registra e lista eventos de tracking |',
    '| `proposal-gateway` | Gateway genérico de propostas |',
    '| `public-approval` | Fluxo público de aprovação (load + decide) |',
    '| `send-proposal-email` | Envia proposta por email (Resend) |',
    '| `pricing-admin` | CRUD de configurações de preço |',
    '| `send-password-reset` | Reset de senha Academy |',
    '',
    '---',
    '',
    '## 5. Problemas Comuns',
    '',
    '### 5.1 Proposta duplicada',
    '',
    '**Causa:** Duplo submit no frontend (clique duplo no botão salvar).',
    '',
    '**Diagnóstico:**',
    '```sql',
    'SELECT display_id, count(*) FROM calculator_proposals',
    'GROUP BY display_id HAVING count(*) > 1;',
    '```',
    '',
    '**Correção:**',
    '- Índice UNIQUE em `display_id` já previne duplicatas no banco.',
    '- Frontend utiliza `savingRef` para bloquear cliques concorrentes.',
    '- Edge Function `proposal-save` faz upsert por `display_id`.',
    '',
    '---',
    '',
    '### 5.2 Histórico de acessos vazio',
    '',
    '**Causa:** Evento de tracking não foi registrado após a ação.',
    '',
    '**Diagnóstico:**',
    '```sql',
    'SELECT * FROM proposal_views WHERE proposal_id = \'<ID>\' ORDER BY viewed_at DESC;',
    '```',
    '',
    '**Correção:**',
    '- Verificar se a chamada à Edge Function `proposal-track` está sendo feita após o sucesso da ação.',
    '- Conferir logs da Edge Function para erros de insert.',
    '',
    '---',
    '',
    '### 5.3 Token de aprovação inválido',
    '',
    '**Causa:** Token `pat_*` expirado ou já utilizado.',
    '',
    '**Diagnóstico:**',
    '```sql',
    'SELECT public_approval_token, public_approval_enabled, approval_decision',
    'FROM calculator_proposals WHERE public_approval_token = \'pat_xxx\';',
    '```',
    '',
    '**Correção:**',
    '- Gerar novo token via interface comercial.',
    '- Verificar se `public_approval_enabled = true`.',
    '',
    '---',
    '',
    '### 5.4 PDF não encontrado',
    '',
    '**Causa:** Arquivo não foi persistido no Storage ou `pdf_path` está nulo.',
    '',
    '**Diagnóstico:**',
    '```sql',
    'SELECT id, pdf_path, pdf_generated_at FROM calculator_proposals WHERE id = \'<ID>\';',
    '```',
    '',
    '**Correção:**',
    '- Regerar PDF pela interface.',
    '- Verificar bucket `proposal-files` no Storage.',
    '',
    '---',
    '',
    '## 6. Checklist de Release',
    '',
    'Antes de cada release que envolva propostas, verificar:',
    '',
    '- [ ] Criar proposta (salvar no Supabase)',
    '- [ ] Atualizar proposta existente',
    '- [ ] Enviar email com proposta',
    '- [ ] Copiar link público',
    '- [ ] Abrir link público (anon)',
    '- [ ] Baixar PDF',
    '- [ ] Aprovar proposta via link público',
    '- [ ] Rejeitar proposta via link público',
    '- [ ] Verificar eventos no histórico de acessos',
    '- [ ] Verificar idempotência (salvar 2x não duplica)',
    '',
    '---',
    '',
    '## 7. Segurança',
    '',
    '| Regra | Detalhes |',
    '|-------|----------|',
    '| **RLS obrigatório** | Todas as tabelas com dados sensíveis devem ter RLS ativo |',
    '| **SERVICE_ROLE apenas em Edge Functions** | Nunca expor `SERVICE_ROLE_KEY` no frontend |',
    '| **proposal_views** | Deny public reads/inserts — apenas via Edge Function |',
    '| **calculator_configs** | Sem RLS, acessível apenas via `pricing-admin` Edge Function |',
    '| **Storage** | Buckets privados com signed URLs temporárias |',
    '',
    '---',
    '',
    '## 8. Observabilidade',
    '',
    '### O que monitorar',
    '',
    '- **Edge Function errors**: Logs de erro nas funções `proposal-save`, `proposal-track`, `public-approval`',
    '- **Duplicação**: Queries periódicas para detectar `display_id` duplicados',
    '- **Latência**: Tempo de resposta das Edge Functions (target < 2s)',
    '- **Storage**: Uso do bucket `proposal-files`',
    '',
    '### Onde verificar',
    '',
    '- Lovable Cloud → Logs de Edge Functions',
    '- Queries SQL diretas nas tabelas de auditoria',
    '',
    '---',
    '',
    '## 9. Recovery',
    '',
    '### Procedimento de investigação',
    '',
    '1. **Identificar camada do erro:**',
    '   - Frontend → Console do navegador',
    '   - Edge Function → Logs no Lovable Cloud',
    '   - Banco → Query direta na tabela',
    '   - RLS Policy → Testar com `anon` vs `authenticated`',
    '',
    '2. **Isolar o problema:**',
    '   - Reproduzir localmente',
    '   - Verificar payload enviado vs schema esperado',
    '   - Checar se RLS está bloqueando a operação',
    '',
    '3. **Corrigir na raiz:**',
    '   - Bug no frontend → fix no componente/hook',
    '   - Bug na Edge Function → fix e redeploy',
    '   - Schema incorreto → migration',
    '   - Policy incorreta → atualizar RLS',
    '',
    '4. **Validar:**',
    '   - Executar checklist de release (seção 6)',
    '   - Confirmar que eventos estão sendo registrados',
  ].join('\n'),

  // ======== CORE — System Blueprint ========
  'core/open_system_blueprint': [
    '# OPEN System Blueprint',
    '',
    '> Versão: **v1** — Última atualização: 2026-03-14',
    '',
    '---',
    '',
    '## 1. Visão geral da plataforma',
    '',
    'A plataforma OPEN é um sistema corporativo que centraliza:',
    '',
    '- Operações comerciais (propostas, contratos, metas)',
    '- Gestão de parceiros (revendas, integradores)',
    '- Atendimento e suporte (tickets, incidentes, SLA)',
    '- Documentação técnica (wiki interna)',
    '- Gestão de pessoas (RH, academy)',
    '- Administração do sistema (usuários, permissões, parâmetros)',
    '',
    'O sistema funciona como um **painel unificado de operação do datacenter OPEN**, integrando propostas comerciais, contratos, tickets, parceiros, metas, documentação e analytics.',
    '',
    'A arquitetura está em transição de um modelo **Laravel API monolítico** para um modelo **Supabase-first com frontend desacoplado**.',
    '',
    '---',
    '',
    '## 2. Arquitetura geral do sistema',
    '',
    'A arquitetura possui **quatro camadas** principais:',
    '',
    '```',
    '┌─────────────────────────────────────────────────────┐',
    '│                   FRONTEND (SPA)                    │',
    '│        React + Vite + TypeScript + Tailwind         │',
    '├──────────┬──────────────────┬───────────────────────┤',
    '│ Supabase │  Edge Functions  │   APIs Legadas        │',
    '│  Client  │  (Deno Runtime)  │   (Laravel REST)      │',
    '├──────────┴──────────────────┴───────────────────────┤',
    '│              PostgreSQL (Supabase)                  │',
    '├─────────────────────────────────────────────────────┤',
    '│              Storage (Supabase / Externo)           │',
    '└─────────────────────────────────────────────────────┘',
    '```',
    '',
    '### 2.1 Frontend',
    '',
    'Stack: **React + Vite + TypeScript + Tailwind CSS + shadcn/ui**',
    '',
    'Responsável por:',
    '- Interface do usuário e dashboards',
    '- Páginas administrativas',
    '- Módulo de propostas e contratos',
    '- Wiki interna (/docs)',
    '',
    'O frontend consome:',
    '- Supabase Client (SDK JS)',
    '- Edge Functions (via `supabase.functions.invoke`)',
    '- APIs legadas (via `fetch` com Bearer Token)',
    '',
    '### 2.2 Supabase',
    '',
    'Supabase atua como **backend principal** para novos módulos.',
    '',
    '| Recurso | Uso |',
    '|---------|-----|',
    '| **PostgreSQL** | Banco de dados principal |',
    '| **Auth** | Autenticação (Academy, parceiros) |',
    '| **Storage** | PDFs, documentos, assets |',
    '| **Realtime** | Notificações e atualizações live |',
    '| **Edge Functions** | Lógica server-side (Deno) |',
    '| **RLS** | Controle de acesso por linha |',
    '',
    'Supabase é considerado **fonte de verdade para novos dados do sistema**.',
    '',
    '### 2.3 APIs Legadas (Laravel)',
    '',
    'Parte do sistema ainda depende de APIs Laravel:',
    '',
    '| Endpoint | Domínio |',
    '|----------|---------|',
    '| `/api/auth/login` | Autenticação legada |',
    '| `/api/auth/me` | Usuário autenticado |',
    '| `/api/calculator/proposal` | Propostas (CRUD) |',
    '| `/api/partner` | Parceiros |',
    '| `/api/ticket` | Tickets |',
    '| `/api/user` | Usuários |',
    '| `/api/company` | Empresas |',
    '',
    '> ⚠️ Essas APIs são consideradas **legado** e devem ser gradualmente substituídas por operações Supabase.',
    '',
    '### 2.4 Storage',
    '',
    'Arquivos armazenados incluem PDFs de propostas, documentos e assets.',
    '',
    '- **Supabase Storage** — Novos uploads (proposal files, provas academy)',
    '- **Storage externo** — Arquivos legados mantidos em S3/similar',
    '',
    '---',
    '',
    '## 3. Módulos do sistema',
    '',
    '| Módulo | Rota Base | Ícone | Nível mínimo |',
    '|--------|-----------|-------|-------------|',
    '| Dashboard | `/modulos/dashboard` | LayoutDashboard | 700 |',
    '| Comercial | `/modulos/comercial` | TrendingUp | 700 |',
    '| Parceiros | `/modulos/parceiros` | Users | 750 |',
    '| Atendimentos | `/modulos/atendimentos` | Headphones | 775 |',
    '| Docs | `/modulos/docs` | BookOpen | 700 |',
    '| Conteúdo | `/modulos/conteudo` | FileText | 600 |',
    '| Gente & Gestão | `/modulos/gente` | Users | 600 |',
    '| Admin | `/modulos/admin` | Settings | 1000 |',
    '',
    '---',
    '',
    '## 4. Módulo Comercial',
    '',
    'Responsável pela operação comercial da empresa.',
    '',
    '**Recursos:** propostas, contratos, executivos, metas, comissões.',
    '',
    '| Subseção | Rota |',
    '|----------|------|',
    '| Visão Geral | `/modulos/comercial` |',
    '| Executivos | `/modulos/comercial/executivos` |',
    '| Propostas | `/modulos/comercial/propostas` |',
    '| Contratos | `/modulos/comercial/contratos` |',
    '| Metas | `/modulos/comercial/metas` |',
    '| Comissões | `/modulos/comercial/comissoes` |',
    '| Meu Potencial | `/modulos/comercial/meu-potencial` |',
    '| Potencial do Gerente | `/modulos/comercial/potencial-gerente` |',
    '',
    '**Domínios de dados:** `proposals`, `contracts`, `sales_goals`, `commissions`.',
    '',
    '---',
    '',
    '## 5. Módulo Parceiros',
    '',
    'Gerencia o ecossistema de canais.',
    '',
    '| Tipo | Descrição |',
    '|------|-----------|',
    '| Revendas | Parceiros de revenda direta |',
    '| Integradores | Parceiros de integração técnica |',
    '| Parceiros tecnológicos | ISVs e VARs |',
    '',
    '**Dados associados:** `partner_profiles`, `partner_tiers`, `partner_commissions`.',
    '',
    '---',
    '',
    '## 6. Módulo Atendimentos',
    '',
    'Sistema de suporte técnico e operacional.',
    '',
    'Gerencia: tickets, incidentes, histórico de atendimento e SLA.',
    '',
    '| Subseção | Responsabilidade |',
    '|----------|-----------------|',
    '| Fila de Suporte | Tickets abertos |',
    '| NOC | Incidentes técnicos |',
    '| CS (Customer Success) | Acompanhamento de clientes |',
    '| KPIs | Métricas de atendimento |',
    '',
    '---',
    '',
    '## 7. Módulo Docs',
    '',
    'Wiki interna da OPEN. Contém:',
    '',
    '- Arquitetura do sistema',
    '- Regras de negócio',
    '- Runbooks operacionais',
    '- Playbooks de processos',
    '- Referência técnica (API)',
    '- Changelog',
    '',
    'Arquivos em Markdown são renderizados dentro do sistema via `react-markdown`. O registro central está em `src/data/docs/registry.ts`.',
    '',
    '---',
    '',
    '## 8. Modelo de eventos',
    '',
    'A plataforma utiliza eventos padronizados para registrar ações.',
    '',
    '**Formato:** `entity.action`',
    '',
    '| Evento | Descrição |',
    '|--------|-----------|',
    '| `proposal.view_public` | Cliente abriu proposta |',
    '| `proposal.view_internal` | Usuário interno visualizou |',
    '| `proposal.link_copied` | Link copiado |',
    '| `proposal.email_sent` | Email enviado |',
    '| `proposal.pdf_download` | PDF baixado |',
    '| `proposal.approved` | Proposta aprovada |',
    '| `proposal.rejected` | Proposta rejeitada |',
    '| `contract.created` | Contrato criado |',
    '| `contract.signed` | Contrato assinado |',
    '',
    'Eventos são **append-only** e imutáveis. Devem ser registrados **após sucesso da ação**.',
    '',
    '---',
    '',
    '## 9. Histórico de propostas',
    '',
    'O histórico registra todas as interações com uma proposta:',
    '',
    '- Visualizações (públicas e internas)',
    '- Downloads de PDF',
    '- Emails enviados',
    '- Cópias de link',
    '',
    'Eventos associados alimentam o modal **"Histórico / Ver acessos"** na interface.',
    '',
    'Edge Function responsável: `proposal-track`.',
    '',
    '---',
    '',
    '## 10. Estrutura de dados principal',
    '',
    '| Tabela | Descrição | RLS |',
    '|--------|-----------|-----|',
    '| `calculator_proposals` | Propostas comerciais | ✅ |',
    '| `calculator_proposal_servers` | Servidores das propostas | ✅ |',
    '| `calculator_proposal_addons` | Add-ons das propostas | ✅ |',
    '| `proposal_views` | Eventos de visualização | ✅ |',
    '| `proposal_participants` | Participantes das propostas | ✅ |',
    '| `cert_customers` | Clientes (Certidão) | ✅ |',
    '| `cert_assets` | Ativos de clientes | ✅ |',
    '| `tech_incidents` | Incidentes técnicos | ✅ |',
    '| `tech_clients` | Clientes (TechOps) | ✅ |',
    '| `articles` | Artigos da base de conhecimento | ✅ |',
    '| `academy_enrollments` | Matrículas Academy | ✅ |',
    '',
    'Toda tabela possui: `id`, `created_at`, `updated_at`.',
    '',
    '---',
    '',
    '## 11. Fluxo de criação de proposta',
    '',
    '```',
    '1. Usuário cria proposta na calculadora',
    '       ↓',
    '2. Proposta salva no banco (calculator_proposals)',
    '       ↓',
    '3. Proposta pode ser enviada por email',
    '       ↓',
    '4. Cliente recebe link público',
    '       ↓',
    '5. Cliente visualiza proposta (proposal.view_public)',
    '       ↓',
    '6. Eventos são registrados (proposal_views)',
    '       ↓',
    '7. Cliente aprova ou rejeita',
    '       ↓',
    '8. Contrato pode ser gerado',
    '```',
    '',
    '---',
    '',
    '## 12. Fluxo de eventos',
    '',
    'Ações do usuário geram eventos armazenados na tabela `proposal_views`.',
    '',
    'Cada evento registra:',
    '- `viewed_at` — Timestamp',
    '- `source` — Tipo da ação (ex: `view_public`)',
    '- `client_email` — Email do ator (quando aplicável)',
    '- `ip_address` — IP de origem',
    '- `user_agent` — Navegador',
    '',
    '> Eventos são **append-only**. Nunca editar ou excluir eventos.',
    '',
    '---',
    '',
    '## 13. Controle de acesso',
    '',
    'Controle de acesso baseado em **RBAC** via `User.level`:',
    '',
    '| Level | Perfil | Tipo |',
    '|-------|--------|------|',
    '| 1 | Cliente | Externo |',
    '| 200 | Parceiro | Externo |',
    '| 600 | RH | Interno |',
    '| 700 | Comercial | Interno |',
    '| 750 | Gerente Comercial | Interno |',
    '| 775 | Sucesso do Cliente | Interno |',
    '| 900 | Suporte | Interno |',
    '| 950 | Gerente de Suporte | Interno |',
    '| 1000 | Admin | Interno |',
    '',
    'Cada perfil possui permissões diferentes. Acesso a telas e ações é controlado pelo `level`.',
    '',
    '---',
    '',
    '## 14. Regras críticas do sistema',
    '',
    '1. **Evitar duplicação de proposta** — Constraint unique em `display_id`.',
    '2. **Identificador único obrigatório** — Toda proposta recebe um `display_id` gerado.',
    '3. **Enviar email NÃO recria proposta** — Apenas registra evento `proposal.email_sent`.',
    '4. **Eventos após sucesso** — Registrar evento somente após confirmação da ação.',
    '5. **Append-only** — Eventos nunca são editados ou excluídos.',
    '',
    '---',
    '',
    '## 15. Evolução futura da arquitetura',
    '',
    'Direção: **Supabase-first**',
    '',
    '| Objetivo | Status |',
    '|----------|--------|',
    '| Eliminar dependência de APIs legadas | 🔄 Em progresso |',
    '| Centralizar eventos em tabela única (`system_events`) | 📋 Planejado |',
    '| Melhorar observabilidade (logs, métricas) | 📋 Planejado |',
    '| Simplificar manutenção | 🔄 Em progresso |',
    '',
    '---',
    '',
    '## 16. Diretrizes de desenvolvimento',
    '',
    'Novos módulos **devem**:',
    '',
    '- ✅ Usar Supabase como backend',
    '- ✅ Emitir eventos padronizados (`entity.action`)',
    '- ✅ Ser documentados no `/docs`',
    '- ✅ Possuir RLS nas tabelas',
    '',
    'Toda funcionalidade nova deve ter:',
    '',
    '- Documentação técnica',
    '- Runbook operacional',
    '- Referência de API (quando aplicável)',
    '',
    '> **Regra**: Não criar novos endpoints Laravel. Usar Edge Functions.',
    '',
    '---',
    '',
    '## 17. Papel do /docs',
    '',
    'O módulo `/docs` funciona como:',
    '',
    '- **Base de conhecimento interna** — Referência para toda a equipe',
    '- **Documentação técnica** — Arquitetura, schemas, APIs',
    '- **Manual operacional** — Runbooks e playbooks',
    '',
    'O `/docs` é considerado a **fonte oficial de conhecimento do sistema OPEN**.',
    '',
    'Todo módulo deve possuir sua documentação em `/docs/modules/`.',
  ].join('\n'),

  // ======== CORE — Data Model ========
  'core/open_data_model': OPEN_DATA_MODEL_CONTENT,

  // ======== CORE — Sync Commands ========
  'core/open_docs_sync_commands': OPEN_DOCS_SYNC_COMMANDS_CONTENT,

  // ======== CORE — RBAC Model ========
  'core/open_rbac_model': OPEN_RBAC_MODEL_CONTENT,

  // ======== CORE — Event Architecture ========
  'core/open_event_architecture': OPEN_EVENT_ARCHITECTURE_CONTENT,

  // ======== CHANGELOG ========
  'core/open_changelog': OPEN_CHANGELOG_CONTENT,

  // ======== SUPPORT MODULE DOCS ========
  '_existing/OPEN_SUPPORT_ARCHITECTURE': OPEN_SUPPORT_ARCHITECTURE,
  '_existing/OPEN_SUPPORT_DATA_MODEL': OPEN_SUPPORT_DATA_MODEL,
  '_existing/OPEN_SUPPORT_RBAC': OPEN_SUPPORT_RBAC,
  '_existing/OPEN_SUPPORT_API_REFERENCE': OPEN_SUPPORT_API_REFERENCE,
  '_existing/OPEN_SUPPORT_RUNBOOK': OPEN_SUPPORT_RUNBOOK,
  '_existing/OPEN_SUPPORT_KPIS': OPEN_SUPPORT_KPIS,
};

export function getDocContent(fileKey: string): string | null {
  return CONTENT[fileKey] ?? null;
}
