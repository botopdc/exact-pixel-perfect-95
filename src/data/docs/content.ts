// ============================================================================
// DOCS CONTENT LOADER
// Maps file keys from registry to actual markdown content.
// Existing docs from /docs folder are loaded here as well.
// ============================================================================

// Import existing docs
import PLANO_7_PASSOS from '../../../docs/PLANO_7_PASSOS.md?raw';
import EVIDENCIAS_7_PASSOS from '../../../docs/EVIDENCIAS_7_PASSOS.md?raw';
import PLANO_7_PASSOS_PRECOS from '../../../docs/PLANO_7_PASSOS_PRECOS.md?raw';
import EVIDENCIAS_7_PASSOS_PRECOS from '../../../docs/EVIDENCIAS_7_PASSOS_PRECOS.md?raw';

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

  'modules/atendimentos': `# Módulo Atendimentos

## Visão Geral
Central de atendimento e operações técnicas.

## Sub-módulos

### Atendimento Interno
- Chamados entre equipes internas
- Qualquer nível interno pode abrir chamados

### Suporte Técnico (NOC)
- Incidentes de clientes
- Gestão de assets e infraestrutura
- Plantão (on-call)
- SLAs por cliente

### Certidão de Nascimento
- Documentação de ativos por cliente
- Rede, discos, licenças, acessos, recursos

### Customer Success
- Acompanhamento de clientes
- Health Score

### KPIs
- KPIs de Suporte
- KPIs de CS
- KPIs de Gestão

## Rotas
- \`/modulos/atendimentos/interno\` — Chamados internos
- \`/modulos/atendimentos/suporte-tecnico\` — NOC
- \`/modulos/atendimentos/certidoes\` — Certidão
- \`/modulos/atendimentos/cs\` — Customer Success
- \`/modulos/atendimentos/kpis/*\` — KPIs
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
};

export function getDocContent(fileKey: string): string | null {
  return CONTENT[fileKey] ?? null;
}
