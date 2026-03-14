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
  'api/api_reference': `# API Reference

## Autenticação

### Login
\`\`\`
POST /api/auth/login
Body: { email, password }
Response: { token, user }
\`\`\`

### Usuário Autenticado
\`\`\`
GET /api/auth/me
Headers: Authorization: Bearer {token}
Response: { user }
\`\`\`

## Edge Functions (Supabase)

### proposal-save
Salva ou atualiza uma proposta com servidores e addons.

### proposal-list
Lista propostas com paginação, filtros e ordenação.

### proposal-track
Registra e lista eventos de tracking (views, emails, downloads).

### proposal-gateway
Proxy para a API externa de propostas.

### send-proposal-email
Envia email de proposta via Resend.

### public-approval
Processa aprovação/rejeição via token público.

### pricing-admin
CRUD de configurações de preços (SERVICE_ROLE_KEY).

### send-password-reset
Envia email de reset de senha.

## Endpoints REST (API Externa)

### Usuários
- \`GET /api/user\` — Lista usuários
- \`POST /api/user\` — Cria usuário
- \`PUT /api/user/{id}\` — Atualiza usuário
- \`DELETE /api/user/{id}\` — Remove usuário

### Parceiros
- \`GET /api/partner\` — Lista parceiros
- \`POST /api/partner\` — Cria parceiro
- \`PUT /api/partner/{id}\` — Atualiza parceiro

### Propostas (legacy)
- \`GET /api/calculator/proposal\` — Lista propostas
- \`POST /api/calculator/proposal\` — Cria proposta
`,

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
