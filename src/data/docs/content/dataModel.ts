// OPEN Data Model — Core documentation content
// Extracted to keep content.ts manageable

export const OPEN_DATA_MODEL_CONTENT = `# OPEN Data Model

> Versão: **v1** — Última atualização: 2026-03-14

---

## 1. Objetivo

Este documento define:

- **Entidades principais** da plataforma OPEN
- **Relações** entre módulos e domínios de dados
- **Fonte de verdade** por domínio (Supabase vs. legado Laravel)
- **Regras de consistência** e constraints obrigatórias
- **Base para evolução futura** do modelo de dados

A plataforma OPEN está em transição de um modelo híbrido:

| Camada | Estado |
|--------|--------|
| **Laravel (legado)** | APIs REST existentes para users, partners, tickets, companies, datacenters |
| **Supabase (novo)** | Fonte de verdade para proposals, events, docs, academy, certidão, TechOps |

> **Regra**: Novos módulos devem usar Supabase. APIs Laravel são mantidas apenas para funcionalidades existentes.

---

## 2. Princípios do modelo de dados

| # | Princípio |
|---|-----------|
| 1 | **UUID preferencial** para chaves primárias em novas tabelas |
| 2 | \`created_at\` e \`updated_at\` **obrigatórios** em toda tabela |
| 3 | \`deleted_at\` apenas quando soft delete fizer sentido operacional |
| 4 | **Foreign keys explícitas** onde houver estabilidade de domínio |
| 5 | **Constraints de unicidade** para identificadores de negócio (proposal_code, slug, email) |
| 6 | **Evitar duplicidade lógica** — uma entidade, uma tabela |
| 7 | Nomes de tabelas em **snake_case plural** (\`proposals\`, \`contracts\`) |
| 8 | Colunas em **snake_case** (\`created_at\`, \`channel_type\`) |
| 9 | Eventos são **append-only** — nunca editar ou excluir |
| 10 | Este documento é a **fonte oficial de referência** do modelo |

---

## 3. Fonte de verdade por domínio

| Domínio | Fonte de verdade | Observação |
|---------|-----------------|------------|
| proposals | **Supabase** | \`calculator_proposals\` + tabelas filhas |
| proposal_events | **Supabase** | \`proposal_views\` (atual), \`system_events\` (futuro) |
| proposal_views | **Supabase** | Tracking de acessos via Edge Function |
| contracts | **Supabase** | Modelo a ser criado formalmente |
| docs_pages | **Supabase / Markdown local** | Hoje em \`registry.ts\`, futuro em tabela |
| partners | **Legado (Laravel)** | \`/api/partner\` — aguardando migração |
| tickets | **Legado (Laravel)** | \`/api/ticket\` — aguardando migração |
| companies | **Legado (Laravel)** | \`/api/company\` — aguardando migração |
| datacenters | **Legado (Laravel)** | \`/api/dc\` — aguardando migração |
| users | **Híbrido** | Auth legado + Supabase Auth (Academy/parceiros) |
| academy | **Supabase** | \`academy_enrollments\` |
| certidão (assets/clientes) | **Supabase** | Tabelas \`cert_*\` |
| TechOps (incidentes/NOC) | **Supabase** | Tabelas \`tech_*\` |

---

## 4. Entidades principais do sistema

### 4.1 users

**Finalidade:** Representar usuários da plataforma (internos e externos).

**Tabela:** \`users\` (legado Laravel) / futuramente \`profiles\` (Supabase)

| Campo | Tipo | Constraint | Observação |
|-------|------|-----------|------------|
| id | integer | PK | Legado auto-increment |
| uuid | uuid | unique | Identificador universal |
| name | text | not null | Nome completo |
| email | text | unique, not null | Login e identificação |
| avatar | text | nullable | URL do avatar |
| level | integer | not null | RBAC legado (1, 200, 600..1000) |
| docnum | text | nullable | CPF/CNPJ |
| birthday | date | nullable | Data de nascimento |
| entity_id | integer | nullable | FK para empresa/parceiro |
| created_by | integer | nullable | Quem criou |
| created_at | timestamptz | not null | — |
| updated_at | timestamptz | not null | — |
| deleted_at | timestamptz | nullable | Soft delete |

**Constraints:**
- \`email\` UNIQUE
- \`level\` define RBAC legado

**Observação:**
- ⚠️ Risco de conflito entre auth legado (Laravel) e Supabase Auth
- Estratégia de identidade deve ser revisada na migração

**Níveis de acesso (RBAC):**

| Level | Perfil | Tipo |
|-------|--------|------|
| 1 | Cliente | Externo |
| 200 | Parceiro | Externo |
| 600 | RH | Interno |
| 700 | Comercial | Interno |
| 750 | Gerente Comercial | Interno |
| 775 | Sucesso do Cliente | Interno |
| 900 | Suporte | Interno |
| 950 | Gerente de Suporte | Interno |
| 1000 | Admin | Interno |

---

### 4.2 companies

**Finalidade:** Empresas clientes ou parceiras.

**Tabela:** \`companies\` (legado) — equivalente Supabase: \`cert_customers\`

| Campo | Tipo | Constraint | Observação |
|-------|------|-----------|------------|
| id | integer | PK | — |
| uuid | uuid | unique | — |
| name | text | not null | Nome fantasia |
| legal_name | text | not null | Razão social |
| docnum | text | unique (quando preenchido) | CNPJ |
| work_area | text | nullable | Segmento |
| city | text | nullable | — |
| uf | text | nullable | — |
| has_support | boolean | default true | Tem contrato de suporte |
| obs | text | nullable | Observações |
| created_by | integer | nullable | — |
| created_at | timestamptz | not null | — |
| updated_at | timestamptz | not null | — |
| deleted_at | timestamptz | nullable | — |

**Constraints:**
- \`docnum\` UNIQUE quando preenchido (conditional unique)

**Observação:** Tabela Supabase \`cert_customers\` já existe com campos equivalentes (\`razao_social\`, \`nome_fantasia\`, \`cnpj\`). Considerar unificação futura.

---

### 4.3 datacenters

**Finalidade:** Localidades físicas dos datacenters.

**Tabela:** \`datacenters\` (recomendada — legado usa \`/api/dc\`)

| Campo | Tipo | Constraint | Observação |
|-------|------|-----------|------------|
| id | uuid | PK | — |
| code | text | unique, not null | Ex: SP1, RJ1 |
| name | text | not null | Nome descritivo |
| city | text | nullable | — |
| uf | text | nullable | — |
| country | text | default 'BR' | — |
| created_by | uuid | nullable | — |
| created_at | timestamptz | not null | — |
| updated_at | timestamptz | not null | — |
| deleted_at | timestamptz | nullable | — |

**Constraints:**
- \`code\` UNIQUE

**Observação:** Legado expõe \`/api/dc\`. Enum Supabase \`cert_datacenter\` já define valores (DC1_SP, DC2_SP, DC3_RJ, CLOUD_AWS, etc.). Unificar em tabela dedicada quando migrar.

---

### 4.4 partners

**Finalidade:** Parceiros de canal (revendas, integradores, ISVs).

**Tabela:** \`partners\` (legado Laravel)

| Campo | Tipo | Constraint | Observação |
|-------|------|-----------|------------|
| id | integer | PK | — |
| uuid | uuid | unique | — |
| name | text | not null | — |
| docnum | text | nullable | CNPJ |
| type | enum | not null | ISV, VAR, FINDER |
| status | enum | not null | — |
| responsible_id | integer | nullable | FK → users |
| created_at | timestamptz | not null | — |
| updated_at | timestamptz | not null | — |
| deleted_at | timestamptz | nullable | — |

**Enums:**

| Campo | Valores |
|-------|---------|
| type | \`ISV\`, \`VAR\`, \`FINDER\` |
| status | \`ATIVO\`, \`INATIVO\`, \`SUSPENSO\` |

---

### 4.5 tickets

**Finalidade:** Chamados de suporte abertos por clientes.

**Tabela:** \`tickets\` (legado Laravel)

| Campo | Tipo | Constraint | Observação |
|-------|------|-----------|------------|
| id | integer | PK | — |
| uuid | uuid | unique | — |
| company_id | integer | FK → companies | — |
| title | text | not null | — |
| description | text | nullable | — |
| requested_to | text | nullable | Área destino |
| status | enum | not null | — |
| priority | enum | not null | — |
| created_by | integer | FK → users | — |
| assigned_to | integer | nullable, FK → users | — |
| created_at | timestamptz | not null | — |
| updated_at | timestamptz | not null | — |
| deleted_at | timestamptz | nullable | — |

---

### 4.6 incidents (tech_incidents)

**Finalidade:** Incidentes técnicos de infraestrutura.

**Tabela:** \`tech_incidents\` (Supabase — já implementada)

| Campo | Tipo | Constraint | Observação |
|-------|------|-----------|------------|
| id | uuid | PK | — |
| client_id | uuid | FK → tech_clients | — |
| asset_id | uuid | nullable, FK → tech_assets | — |
| title | text | not null | — |
| description | text | nullable | — |
| origin_channel | enum | not null | PORTAL_CLIENTE, PORTAL_INTERNO, EMAIL, WHATSAPP, INTERNO |
| tipo | enum | not null | QUEDA, PERFORMANCE, CONFIGURACAO, DUVIDA, MUDANCA, OUTRO |
| severidade | enum | not null | S1, S2, S3, S4 |
| status | enum | not null | ABERTO, CLASSIFICADO, EM_ATENDIMENTO, ESCALADO, RESOLVIDO, ENCERRADO |
| sla_level_aplicado | enum | not null | PADRAO, PREMIUM, CRITICO |
| owner_user_id | uuid | nullable, FK → tech_users | — |
| opened_at | timestamptz | not null | — |
| resolved_at | timestamptz | nullable | — |
| closed_at | timestamptz | nullable | — |
| created_at | timestamptz | not null | — |
| updated_at | timestamptz | not null | — |

**RLS:** \`is_tech_team_member()\` para SELECT/INSERT/UPDATE, \`is_tech_admin()\` para DELETE.

---

### 4.7 annual_goals

**Finalidade:** Metas anuais de vendas por gerente.

**Tabela:** \`annual_goals\` (recomendada — hoje consumida via API legada)

| Campo | Tipo | Constraint | Observação |
|-------|------|-----------|------------|
| id | uuid | PK | — |
| manager_id | integer | FK → users | — |
| year | integer | not null | — |
| goal | numeric | not null | Meta total |
| mrr_goal | numeric | nullable | Meta MRR |
| q1..q4 | numeric | nullable | Metas trimestrais |
| jan..dec | numeric | nullable | Metas mensais |
| created_by | integer | nullable | — |
| created_at | timestamptz | not null | — |
| updated_at | timestamptz | not null | — |

**Constraints:**
- UNIQUE(\`manager_id\`, \`year\`)

---

### 4.8 annual_goal_executives

**Finalidade:** Distribuição de metas por executivo dentro de uma meta anual.

**Tabela:** \`annual_goal_executives\` (recomendada)

| Campo | Tipo | Constraint | Observação |
|-------|------|-----------|------------|
| id | uuid | PK | — |
| goal_id | uuid | FK → annual_goals | — |
| executive_id | integer | FK → users | — |
| role | text | nullable | Papel do executivo |
| goal | numeric | not null | Meta individual |
| mrr_goal | numeric | nullable | — |
| q1..q4 | numeric | nullable | — |
| jan..dec | numeric | nullable | — |
| created_by | integer | nullable | — |
| created_at | timestamptz | not null | — |
| updated_at | timestamptz | not null | — |

**Constraints:**
- UNIQUE(\`goal_id\`, \`executive_id\`)

---

### 4.9 proposals (calculator_proposals)

**Finalidade:** Propostas comerciais — **entidade crítica** do sistema.

**Tabela:** \`calculator_proposals\` (Supabase — implementada)

| Campo | Tipo | Constraint | Observação |
|-------|------|-----------|------------|
| id | uuid | PK | — |
| display_id | text | unique | Código de negócio (proposal_code) |
| external_id | bigint | nullable | ID do sistema legado |
| name | text | not null | Nome do contato |
| company | text | not null | Nome da empresa |
| email | text | not null | Email do contato |
| phone | text | not null | Telefone |
| status | text | not null, default 'Rascunho' | Enum controlado |
| channel_type | text | not null, default 'CLIENTE' | CLIENTE ou PARCEIRO |
| reseller_name | text | nullable | Obrigatório se channel_type = PARCEIRO |
| commission_value | numeric | nullable | — |
| commission_reason | text | nullable | — |
| observations | text | nullable | — |
| fx | numeric | not null, default 5.0 | Taxa de câmbio |
| datacenter | text | not null, default 'SP1' | Datacenter alvo |
| contract_duration | integer | not null, default 12 | Meses |
| discount_pct | numeric | not null, default 0 | Desconto % |
| total | numeric | not null, default 0 | Valor total |
| currency | text | not null, default 'BRL' | — |
| due_at | timestamptz | not null | Validade |
| approval_token | text | nullable | Token de aprovação interna |
| public_approval_token | text | nullable | Token de aprovação pública |
| public_approval_enabled | boolean | default false | — |
| pdf_path | text | nullable | Caminho do PDF gerado |
| pdf_generated_at | timestamptz | nullable | — |
| approved_at | timestamptz | nullable | — |
| rejected_at | timestamptz | nullable | — |
| approved_by_name | text | nullable | — |
| approved_by_email | text | nullable | — |
| approval_decision | text | nullable | — |
| approval_notes | text | nullable | — |
| created_by | uuid | nullable | FK → auth.users |
| created_at | timestamptz | not null | — |
| updated_at | timestamptz | not null | — |

**Enums de status:**

| Status | Descrição |
|--------|-----------|
| Rascunho | Proposta em edição |
| Enviado | Enviada ao cliente |
| Aprovado | Aprovada pelo cliente |
| Recusado | Rejeitada pelo cliente |
| Expirado | Validade ultrapassada |
| Cancelado | Cancelada manualmente |

**Enums de channel_type:**

| Tipo | Descrição |
|------|-----------|
| CLIENTE | Venda direta |
| PARCEIRO | Venda via parceiro (reseller_name obrigatório) |

**Regras críticas:**
1. \`display_id\` UNIQUE — não permitir duplicação lógica
2. Enviar email **NÃO** pode criar nova linha — apenas registra evento
3. Status precisa ser enum controlado
4. Decisão pendente: \`datacenter\` como FK ou texto livre

---

### 4.10 proposal_servers (calculator_proposal_servers)

**Finalidade:** Servidores configurados em uma proposta.

**Tabela:** \`calculator_proposal_servers\` (Supabase — implementada)

| Campo | Tipo | Constraint | Observação |
|-------|------|-----------|------------|
| id | uuid | PK | — |
| proposal_id | uuid | FK → calculator_proposals | — |
| server_type | text | not null, default 'vm' | vm, baremetal, gpu, storage |
| name | text | not null | — |
| vcpu | integer | default 0 | — |
| ram_gb | integer | default 0 | — |
| nvme_tb | numeric | default 0 | — |
| gpu | text | nullable | Modelo GPU |
| gpu_qty | integer | default 0 | — |
| traffic_tb | numeric | default 0 | — |
| ips | integer | default 1 | — |
| qty_servers | integer | default 1 | — |
| bm_cpu | text | nullable | CPU bare metal |
| bm_ram | text | nullable | RAM bare metal |
| disks | jsonb | nullable | Config de discos |
| storage_type | text | nullable | — |
| storage_region | text | nullable | — |
| volume_tb | numeric | nullable | — |
| unit_price | numeric | default 0 | — |
| total_price | numeric | default 0 | — |
| sort_order | integer | default 0 | — |
| specs | jsonb | nullable | Specs adicionais |
| created_by | uuid | nullable | — |
| created_at | timestamptz | not null | — |

**Observação:** Modelo já normalizado. Campos como \`disks\` e \`specs\` ainda em JSON para flexibilidade. Médio prazo: considerar normalização adicional.

---

### 4.11 proposal_addons (calculator_proposal_addons)

**Finalidade:** Add-ons (serviços adicionais) de uma proposta.

**Tabela:** \`calculator_proposal_addons\` (Supabase — implementada)

| Campo | Tipo | Constraint | Observação |
|-------|------|-----------|------------|
| id | uuid | PK | — |
| proposal_id | uuid | FK → calculator_proposals | — |
| addon_key | text | not null | Chave do add-on |
| label | text | not null | Label exibido |
| enabled | boolean | default false | — |
| quantity | integer | default 0 | — |
| unit_price | numeric | default 0 | — |
| total_price | numeric | default 0 | — |
| sort_order | integer | default 0 | — |
| metadata | jsonb | nullable | — |
| created_by | uuid | nullable | — |
| created_at | timestamptz | not null | — |

---

### 4.12 proposal_files (calculator_proposal_files)

**Finalidade:** Arquivos anexados a propostas.

**Tabela:** \`calculator_proposal_files\` (Supabase — implementada)

| Campo | Tipo | Constraint | Observação |
|-------|------|-----------|------------|
| id | uuid | PK | — |
| proposal_id | uuid | FK → calculator_proposals | — |
| file_path | text | not null | Caminho no storage |
| file_type | text | default 'application/pdf' | MIME type |
| file_name | text | nullable | Nome original |
| created_at | timestamptz | not null | — |

**Observação:** Aceita PDF, JPG, PNG via endpoint \`POST /api/calculator/proposal/{id}/file\`.

---

### 4.13 proposal_events

**Finalidade:** Registro de eventos/ações sobre propostas.

**Tabela:** \`proposal_events\` (recomendada — complementa \`proposal_views\`)

| Campo | Tipo | Constraint | Observação |
|-------|------|-----------|------------|
| id | uuid | PK | — |
| proposal_id | text | not null | — |
| event_name | text | not null | Formato: entity.action |
| action | text | not null | Ação específica |
| actor_type | text | nullable | 'user', 'client', 'system' |
| actor_id | text | nullable | — |
| user_id | uuid | nullable | — |
| client_email | text | nullable | — |
| ip_address | text | nullable | — |
| user_agent | text | nullable | — |
| metadata | jsonb | nullable | Dados adicionais |
| occurred_at | timestamptz | not null | Quando ocorreu |
| created_at | timestamptz | not null | — |

**Índices recomendados:**
- \`proposal_id\`
- \`event_name\`
- \`occurred_at\`

**Regras:**
- **Append-only** — nunca editar ou excluir eventos
- Registrar evento **após sucesso** da ação

---

### 4.14 proposal_views

**Finalidade:** Tracking de visualizações de propostas.

**Tabela:** \`proposal_views\` (Supabase — implementada)

| Campo | Tipo | Constraint | Observação |
|-------|------|-----------|------------|
| id | uuid | PK | — |
| proposal_id | text | not null | — |
| source | text | not null, default 'link' | Tipo de acesso |
| client_email | text | nullable | — |
| ip_address | text | nullable | — |
| user_agent | text | nullable | — |
| viewed_at | timestamptz | not null | — |

**RLS:** Deny public reads/inserts — acesso apenas via Edge Function (\`proposal-track\`) com \`SERVICE_ROLE_KEY\`.

**Observação:** Pode coexistir com \`proposal_events\` no curto prazo. Modelo futuro ideal unifica tudo em \`system_events\`.

---

### 4.15 contracts

**Finalidade:** Contratos gerados a partir de propostas aprovadas.

**Tabela:** \`contracts\` (recomendada — a ser criada formalmente)

| Campo | Tipo | Constraint | Observação |
|-------|------|-----------|------------|
| id | uuid | PK | — |
| contract_code | text | unique | Código do contrato |
| proposal_id | uuid | FK → calculator_proposals | Proposta de origem |
| client_name | text | not null | — |
| company_name | text | not null | — |
| cnpj | text | nullable | — |
| contractor_name | text | nullable | Responsável pela assinatura |
| contractor_email | text | nullable | — |
| contractor_phone | text | nullable | — |
| contract_duration | integer | not null | Meses |
| monthly_value | numeric | not null | — |
| setup_value | numeric | default 0 | — |
| datacenter_id | text | nullable | Referência ao datacenter |
| status | enum | not null | Pendente, Assinado, Cancelado, Expirado |
| signed_at | timestamptz | nullable | — |
| starts_at | date | nullable | — |
| ends_at | date | nullable | — |
| file_path | text | nullable | PDF do contrato |
| created_by | uuid | nullable | — |
| created_at | timestamptz | not null | — |
| updated_at | timestamptz | not null | — |
| deleted_at | timestamptz | nullable | — |

**Enums de status:**

| Status | Descrição |
|--------|-----------|
| Pendente | Aguardando assinatura |
| Assinado | Contrato ativo |
| Cancelado | Cancelado antes ou depois da assinatura |
| Expirado | Término do prazo |

**Regras:**
- Contrato nasce de proposta aprovada
- Manter vínculo obrigatório com \`proposal_id\`
- Evitar contratos duplicados para mesma proposta sem regra explícita

---

### 4.16 contract_events

**Finalidade:** Registro de eventos sobre contratos.

**Tabela:** \`contract_events\` (recomendada)

| Campo | Tipo | Constraint | Observação |
|-------|------|-----------|------------|
| id | uuid | PK | — |
| contract_id | uuid | FK → contracts | — |
| event_name | text | not null | contract.created, contract.signed, etc. |
| actor_type | text | nullable | — |
| actor_id | text | nullable | — |
| metadata | jsonb | nullable | — |
| occurred_at | timestamptz | not null | — |
| created_at | timestamptz | not null | — |

---

### 4.17 calculator_configs

**Finalidade:** Configuração de preços e opções da calculadora.

**Tabela:** \`calculator_configs\` (Supabase — implementada)

| Campo | Tipo | Constraint | Observação |
|-------|------|-----------|------------|
| id | bigint | PK, auto-increment | — |
| category | text | not null | Categoria do config |
| section | text | not null | Seção dentro da categoria |
| config | jsonb | not null, default '[]' | Array de itens |
| created_at | timestamptz | not null | — |
| updated_at | timestamptz | not null | — |
| deleted_at | timestamptz | nullable | Soft delete |

**Observação:** Cada item do array \`config\` possui: \`label\`, \`by\`, \`type\`, \`value\`. Legado expõe via \`/api/calculator/config\`. Pode seguir em tabela própria enquanto pricing engine não for remodelado.

---

### 4.18 audit_logs

**Finalidade:** Registro de auditoria de ações do sistema.

**Tabela:** \`audit_logs\` (recomendada) / \`cert_audit_logs\` (existente para Certidão)

| Campo | Tipo | Constraint | Observação |
|-------|------|-----------|------------|
| id | uuid | PK | — |
| company_id | uuid | nullable | — |
| user_id | text | nullable | — |
| user_name | text | nullable | — |
| user_level | integer | nullable | Level RBAC |
| entity_type | text | not null | Tipo da entidade |
| entity_id | uuid | not null | ID da entidade |
| action | text | not null | Ação realizada |
| changes | jsonb | nullable | Diff old/new |
| module | text | nullable | Módulo de origem |
| description | text | nullable | Descrição legível |
| created_at | timestamptz | not null | — |

**Regras:**
- **Append-only** — nunca editar ou excluir
- \`cert_audit_logs\` já implementada com RLS (insert/select para team members, sem update/delete)

---

### 4.19 docs_pages

**Finalidade:** Páginas da wiki interna.

**Tabela:** \`docs_pages\` (recomendada — hoje em \`registry.ts\` / markdown local)

| Campo | Tipo | Constraint | Observação |
|-------|------|-----------|------------|
| id | uuid | PK | — |
| slug | text | unique, not null | URL-friendly |
| title | text | not null | — |
| category | text | not null | core, modules, api, playbooks, etc. |
| module | text | nullable | Módulo associado |
| summary | text | nullable | Resumo curto |
| content_md | text | not null | Conteúdo Markdown |
| source_file | text | nullable | Arquivo original |
| tags | text[] | default '{}' | — |
| is_published | boolean | default true | — |
| is_downloadable | boolean | default true | — |
| sort_order | integer | default 0 | — |
| created_by | uuid | nullable | — |
| updated_by | uuid | nullable | — |
| created_at | timestamptz | not null | — |
| updated_at | timestamptz | not null | — |

**Constraints:**
- \`slug\` UNIQUE

---

### 4.20 docs_versions

**Finalidade:** Versionamento de páginas da wiki.

**Tabela:** \`docs_versions\` (recomendada)

| Campo | Tipo | Constraint | Observação |
|-------|------|-----------|------------|
| id | uuid | PK | — |
| page_id | uuid | FK → docs_pages | — |
| version_number | integer | not null | — |
| content_md | text | not null | Snapshot do conteúdo |
| change_summary | text | nullable | — |
| created_by | uuid | nullable | — |
| created_at | timestamptz | not null | — |

**Constraints:**
- UNIQUE(\`page_id\`, \`version_number\`)

---

### 4.21 docs_favorites

**Finalidade:** Favoritos de documentação por usuário.

**Tabela:** \`docs_favorites\` (recomendada)

| Campo | Tipo | Constraint | Observação |
|-------|------|-----------|------------|
| id | uuid | PK | — |
| user_id | uuid | FK → auth.users | — |
| page_id | uuid | FK → docs_pages | — |
| created_at | timestamptz | not null | — |

**Constraints:**
- UNIQUE(\`user_id\`, \`page_id\`)

---

### 4.22 docs_feedback

**Finalidade:** Feedback e avaliação de documentação.

**Tabela:** \`docs_feedback\` (recomendada)

| Campo | Tipo | Constraint | Observação |
|-------|------|-----------|------------|
| id | uuid | PK | — |
| page_id | uuid | FK → docs_pages | — |
| user_id | uuid | nullable | — |
| rating | integer | check (1..5) | — |
| comment | text | nullable | — |
| created_at | timestamptz | not null | — |

---

### 4.23 system_events

**Finalidade:** Tabela unificada de eventos — **modelo futuro recomendado**.

**Tabela:** \`system_events\` (a ser criada)

| Campo | Tipo | Constraint | Observação |
|-------|------|-----------|------------|
| id | uuid | PK | — |
| entity | text | not null | Ex: proposal, contract |
| action | text | not null | Ex: view_public, approved |
| event_name | text | not null | Composto: entity.action |
| entity_id | text | not null | ID da entidade relacionada |
| occurred_at | timestamptz | not null | — |
| actor_type | text | nullable | user, client, system |
| actor_id | text | nullable | — |
| user_id | uuid | nullable | — |
| client_email | text | nullable | — |
| ip_address | text | nullable | — |
| user_agent | text | nullable | — |
| metadata | jsonb | nullable | — |
| created_at | timestamptz | not null | — |

**Índices recomendados:**
- \`entity\`, \`entity_id\`
- \`event_name\`
- \`occurred_at\`

**Observação:** Esta tabela pode substituir \`proposal_events\` + \`proposal_views\` + \`contract_events\` no futuro, consolidando todos os eventos do sistema em um único ponto de consulta.

---

## 5. Relacionamentos principais

\`\`\`
companies ──1:N──→ tickets
companies ──1:N──→ incidents (via tech_clients)
users ──1:N──→ annual_goals (via manager_id)
annual_goals ──1:N──→ annual_goal_executives
proposals ──1:N──→ proposal_files
proposals ──1:N──→ proposal_events
proposals ──1:N──→ proposal_views
proposals ──1:N──→ proposal_servers
proposals ──1:N──→ proposal_addons
proposals ──1:N──→ proposal_participants
proposals ──0..N──→ contracts
contracts ──1:N──→ contract_events
docs_pages ──1:N──→ docs_versions
docs_pages ──1:N──→ docs_favorites
docs_pages ──1:N──→ docs_feedback
users ──1:N──→ docs_pages (via created_by)
users ──1:N──→ audit_logs (via user_id)
tech_clients ──1:N──→ tech_assets
tech_clients ──1:N──→ tech_incidents
tech_assets ──1:N──→ tech_credentials
tech_incidents ──1:N──→ tech_incident_actions
tech_incidents ──1:1──→ tech_incident_root_cause
cert_customers ──1:N──→ cert_assets
cert_customers ──1:N──→ cert_customer_contacts
cert_customers ──1:N──→ cert_proposal_links
cert_assets ──1:N──→ cert_asset_disks
cert_assets ──1:N──→ cert_asset_network
cert_assets ──1:N──→ cert_asset_licenses
cert_assets ──1:1──→ cert_asset_resources
cert_assets ──1:N──→ cert_asset_access
\`\`\`

**Relações lógicas sem FK (legado):**
- \`proposals.created_by\` → \`users.id\` (auth legado, sem FK formal no Supabase)
- \`proposal_participants.external_user_id\` → \`users.id\` (referência ao ID legado)
- \`annual_goals.manager_id\` → \`users.id\` (legado)

---

## 6. Entidades derivadas e agregações

| Derivação | Origem | Uso |
|-----------|--------|-----|
| **Contrato** | Proposta aprovada (\`status = 'Aprovado'\`) | Geração de contrato |
| **Histórico de acessos** | \`proposal_views\` + \`proposal_events\` | Modal "Histórico / Ver acessos" |
| **Metas por executivo** | \`annual_goals\` + \`annual_goal_executives\` | Dashboard comercial |
| **Dashboard** | Agregações de proposals, contracts, tickets | Visão executiva |
| **Health Score** | Métricas de engajamento do cliente | CS Module |
| **KPIs de suporte** | Agregações de tickets e incidentes | Dashboard de atendimento |

---

## 7. Constraints obrigatórias

| Tabela | Constraint | Tipo |
|--------|-----------|------|
| \`users\` | email | UNIQUE |
| \`calculator_proposals\` | display_id | UNIQUE |
| \`docs_pages\` | slug | UNIQUE |
| \`annual_goals\` | (manager_id, year) | UNIQUE |
| \`annual_goal_executives\` | (goal_id, executive_id) | UNIQUE |
| \`docs_favorites\` | (user_id, page_id) | UNIQUE |
| \`docs_versions\` | (page_id, version_number) | UNIQUE |
| \`contracts\` | contract_code | UNIQUE |
| \`datacenters\` | code | UNIQUE |
| \`system_events\` | — | Nenhuma (append-only) |

**Tabelas que exigem FK explícita:**
- \`proposal_servers.proposal_id\` → \`calculator_proposals.id\` ✅ (implementada)
- \`proposal_addons.proposal_id\` → \`calculator_proposals.id\` ✅ (implementada)
- \`proposal_files.proposal_id\` → \`calculator_proposals.id\` ✅ (implementada)
- \`contracts.proposal_id\` → \`calculator_proposals.id\` (a implementar)
- \`docs_versions.page_id\` → \`docs_pages.id\` (a implementar)
- \`tech_incidents.client_id\` → \`tech_clients.id\` ✅ (implementada)
- \`cert_assets.customer_id\` → \`cert_customers.id\` ✅ (implementada)

---

## 8. Índices recomendados

| Tabela | Coluna(s) | Justificativa |
|--------|----------|---------------|
| \`calculator_proposals\` | status | Filtro frequente |
| \`calculator_proposals\` | created_at | Ordenação cronológica |
| \`calculator_proposals\` | company | Busca por empresa |
| \`calculator_proposals\` | email | Busca por contato |
| \`proposal_views\` | proposal_id | Lookup de histórico |
| \`proposal_views\` | viewed_at | Ordenação temporal |
| \`contracts\` | proposal_id | Lookup por proposta |
| \`contracts\` | status | Filtro |
| \`annual_goals\` | (manager_id, year) | Lookup composto |
| \`audit_logs\` / \`cert_audit_logs\` | entity_id | Lookup por entidade |
| \`audit_logs\` / \`cert_audit_logs\` | user_id | Lookup por usuário |
| \`docs_pages\` | category | Filtro por categoria |
| \`docs_pages\` | module | Filtro por módulo |
| \`tech_incidents\` | client_id | Lookup por cliente |
| \`tech_incidents\` | status | Filtro |
| \`system_events\` | (entity, entity_id) | Lookup combinado |
| \`system_events\` | event_name | Filtro por tipo |
| \`system_events\` | occurred_at | Range queries |

---

## 9. Convenções de nomenclatura

| Elemento | Convenção | Exemplo |
|----------|-----------|---------|
| Tabela | plural, snake_case | \`calculator_proposals\`, \`tech_incidents\` |
| Coluna | snake_case | \`created_at\`, \`channel_type\`, \`display_id\` |
| Timestamp | \`timestamptz\` | — |
| IDs técnicos | \`id\` (uuid) | PK auto-gerada |
| Códigos de negócio | campo separado | \`display_id\`, \`contract_code\`, \`asset_code\` |
| Enums | UPPER_CASE ou PascalCase documentado | \`PARCEIRO\`, \`Rascunho\` |
| Eventos | \`entity.action\` | \`proposal.approved\`, \`contract.signed\` |
| FKs | \`{entidade}_id\` | \`proposal_id\`, \`client_id\` |
| Booleans | prefixo \`is_\`, \`has_\`, \`tem_\` | \`is_active\`, \`has_support\` |

---

## 10. Estratégia de normalização

| Área | Estado atual | Meta |
|------|-------------|------|
| \`calculator_proposal_servers\` | ✅ Normalizado | Campos \`disks\` e \`specs\` ainda em JSON |
| \`calculator_proposal_addons\` | ✅ Normalizado | Campo \`metadata\` em JSON |
| \`calculator_configs.config\` | ⚠️ JSON array | Manter enquanto pricing engine não for remodelado |
| \`proposal_participants\` | ✅ Normalizado | — |

**Plano:**
- **Curto prazo:** Manter compatibilidade com JSON existente
- **Médio prazo:** Normalizar campos JSON restantes (\`disks\`, \`specs\`)
- **Longo prazo:** Pricing engine mais estruturado com relações explícitas entre configs e itens

---

## 11. Estratégia de migração do legado

| Domínio | Ação | Prioridade |
|---------|------|-----------|
| **proposals** | ✅ Migrado para Supabase | Concluído |
| **proposal tracking** | ✅ Supabase obrigatório (\`proposal-track\` Edge Function) | Concluído |
| **contracts** | Criar modelo formal no Supabase | Alta |
| **docs** | Migrar de \`registry.ts\` para tabela \`docs_pages\` | Média |
| **partners** | Manter legado até plano de migração | Baixa |
| **tickets** | Manter legado até plano de migração | Baixa |
| **companies** | Manter legado; unificar com \`cert_customers\` | Média |
| **datacenters** | Unificar enum \`cert_datacenter\` com tabela dedicada | Baixa |
| **users** | Resolver estratégia de identidade (legado vs. Supabase Auth) | Alta |
| **incidents** | ✅ Migrado para Supabase (\`tech_incidents\`) | Concluído |

---

## 12. Regras críticas de consistência

1. **Proposta não pode ser duplicada** — \`display_id\` UNIQUE com upsert na função \`save_calculator_proposal\`
2. **Enviar email não pode recriar proposta** — Apenas registra evento \`proposal.email_sent\`
3. **Eventos não devem depender de localStorage** — Persistir sempre no banco
4. **Contrato deve referenciar proposta de origem** — FK obrigatória para \`proposal_id\`
5. **Slug de docs não pode colidir** — UNIQUE constraint
6. **Métricas devem usar dados persistidos** — Não usar estado transitório de frontend
7. **Audit logs são imutáveis** — Sem UPDATE/DELETE

---

## 13. Anti-patterns proibidos

| Anti-pattern | Problema | Solução |
|-------------|----------|---------|
| Salvar proposta duas vezes por clique duplo | Duplicação | Debounce + constraint UNIQUE |
| Usar \`localStorage\` como fonte de verdade | Perda de dados | Persistir no banco |
| Criar tabela sem \`created_at\` / \`updated_at\` | Falta de auditabilidade | Princípio #2 |
| Usar texto solto como enum sem documentação | Inconsistência | Documentar enums neste documento |
| Depender de JSON para tudo indefinidamente | Não-normalizável | Plano de normalização (seção 10) |
| Criar frontend antes de definir entidade | Desalinhamento modelo-UI | Definir modelo primeiro |
| Duplicar lógica de negócio no frontend e backend | Inconsistência | Centralizar no backend |
| Criar novas APIs Laravel | Contra a estratégia | Usar Edge Functions |

---

## 14. Roadmap do modelo de dados

### Fase 1 — Consolidação (atual)
- ✅ Consolidar proposals no Supabase
- ✅ Implementar proposal events/views
- ✅ Implementar docs wiki (registry + content)
- ✅ Implementar TechOps (incidents, assets, clients)
- ✅ Implementar Certidão (customers, assets)

### Fase 2 — Expansão
- Criar tabela \`contracts\` formal
- Normalizar \`disks\` e \`specs\` dos servidores
- Implementar \`docs_pages\` no Supabase
- Agregar histórico de acessos em views/materialized views

### Fase 3 — Migração
- Migrar \`partners\` para Supabase
- Migrar \`tickets\` / \`incidents\` legados
- Criar tabela \`system_events\` unificada
- Resolver identidade de usuários (auth unificado)

### Fase 4 — Analytics & IA
- Analytics layer (views materializadas, aggregations)
- Data warehouse / BI integration
- Querying estruturado para agentes de IA internos
- Dashboards baseados em dados normalizados

---

## 15. Diagrama textual de entidades

\`\`\`
users
 ├── annual_goals
 │    └── annual_goal_executives
 ├── audit_logs
 ├── docs_pages
 │    ├── docs_versions
 │    ├── docs_favorites
 │    └── docs_feedback
 └── proposals (calculator_proposals)
      ├── proposal_servers
      ├── proposal_addons
      ├── proposal_files
      ├── proposal_participants
      ├── proposal_events
      ├── proposal_views
      └── contracts
           └── contract_events

tech_clients
 ├── tech_assets
 │    └── tech_credentials
 ├── tech_incidents
 │    ├── tech_incident_actions
 │    └── tech_incident_root_cause
 └── (cs_manager → tech_users)

cert_customers
 ├── cert_assets
 │    ├── cert_asset_disks
 │    ├── cert_asset_network
 │    ├── cert_asset_licenses
 │    ├── cert_asset_resources
 │    └── cert_asset_access
 ├── cert_customer_contacts
 └── cert_proposal_links

academy_enrollments (standalone)
calculator_configs (standalone)
tech_users (standalone, auth reference)
tech_on_call_shifts → tech_users
system_events (futuro — unificação)
\`\`\`

---

## 16. Conclusão

Este **Data Model** é a base oficial para:

- **Novas migrations** — toda nova tabela deve seguir os princípios da seção 2
- **Revisão de arquitetura** — decisões de normalização e migração referenciadas aqui
- **Debugging** — mapa de entidades e relacionamentos para investigação
- **Documentação contínua** — este documento deve ser atualizado a cada mudança estrutural
- **Onboarding técnico** — referência para novos desenvolvedores e agentes de IA

> **Regra**: Nenhuma nova feature relevante deve ser criada sem estar alinhada a este modelo de dados. Toda nova entidade deve ser documentada aqui antes da implementação.
`;
