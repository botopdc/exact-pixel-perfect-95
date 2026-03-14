export const OPEN_DOCS_SYNC_COMMANDS_CONTENT = `# OPEN Docs Sync Commands

Versão: v1

---

## 1. Objetivo

Documentar os comandos internos de sincronização documental da plataforma OPEN. Esses comandos são responsáveis por manter a documentação técnica atualizada e consistente com o código, schema, rotas e arquitetura do sistema.

---

## 2. Visão Geral

| Comando | Escopo | Frequência sugerida |
|---------|--------|---------------------|
| \`OPEN_DOCS_AUTOSYNC\` | Executa todos os syncs | Após releases |
| \`OPEN_DOCS_SYNC_DATA_MODEL\` | Modelo de dados | Após migrations |
| \`OPEN_DOCS_SYNC_EVENTS\` | Modelo de eventos | Após novos eventos |
| \`OPEN_DOCS_SYNC_API\` | Referência de API | Após alteração de endpoints |
| \`OPEN_DOCS_SYNC_ARCHITECTURE\` | Arquitetura do sistema | Após mudança estrutural |
| \`OPEN_DOCS_SYNC_RUNBOOK\` | Runbook Supabase | Após mudança operacional |

---

## 3. Comandos

### 3.1 OPEN_DOCS_AUTOSYNC

**Objetivo:** Executar todos os comandos de sincronização em sequência.

**Quando usar:**
- Após um release significativo
- Quando múltiplos módulos foram alterados
- Em revisões periódicas de documentação

**Arquivos impactados:**
- \`src/data/docs/content/dataModel.ts\`
- \`src/data/docs/content.ts\` (event model, API, architecture, runbook)
- \`src/data/docs/registry.ts\`

**Critério de aceite:**
- Todos os sub-comandos executaram com sucesso
- Nenhum documento ficou desatualizado
- Registry está consistente

---

### 3.2 OPEN_DOCS_SYNC_DATA_MODEL

**Objetivo:** Atualizar a documentação do modelo de dados com base no schema atual do banco.

**Quando usar:**
- Após criação de novas tabelas
- Após alteração de colunas
- Após adição de constraints ou índices
- Após novas migrations

**Arquivos impactados:**
- \`src/data/docs/content/dataModel.ts\`

**Critério de aceite:**
- Todas as tabelas do schema estão documentadas
- Relacionamentos refletem foreign keys reais
- Constraints estão listadas
- Tipos de dados estão corretos

---

### 3.3 OPEN_DOCS_SYNC_EVENTS

**Objetivo:** Atualizar a documentação do modelo de eventos.

**Quando usar:**
- Após criação de novos tipos de evento
- Após mudança no schema de eventos
- Após nova Edge Function que emite eventos

**Arquivos impactados:**
- Seção \`core/open_event_model\` em \`src/data/docs/content.ts\`

**Critério de aceite:**
- Todos os eventos existentes estão documentados
- Schema canônico está atualizado
- Edge Functions que emitem eventos estão listadas

---

### 3.4 OPEN_DOCS_SYNC_API

**Objetivo:** Atualizar a referência de API com endpoints atuais.

**Quando usar:**
- Após criação de nova Edge Function
- Após alteração de endpoints legados
- Após mudança em payloads

**Arquivos impactados:**
- Seção \`api/api_reference\` em \`src/data/docs/content.ts\`

**Critério de aceite:**
- Todas as Edge Functions estão documentadas
- Endpoints legados relevantes estão listados
- Payloads de request/response estão corretos

---

### 3.5 OPEN_DOCS_SYNC_ARCHITECTURE

**Objetivo:** Atualizar a documentação de arquitetura do sistema.

**Quando usar:**
- Após criação de novo módulo
- Após mudança significativa em rotas
- Após mudança no menu lateral
- Após mudança na estrutura de layouts

**Arquivos impactados:**
- Seção \`core/open_system_architecture\` em \`src/data/docs/content.ts\`
- Seção \`core/open_module_map\` em \`src/data/docs/content.ts\`
- Seção \`core/open_system_blueprint\` em \`src/data/docs/content.ts\`

**Critério de aceite:**
- Módulos refletem \`modulesConfig.ts\`
- Rotas refletem \`routes.ts\` e \`App.tsx\`
- Stack tecnológico está atualizado

---

### 3.6 OPEN_DOCS_SYNC_RUNBOOK

**Objetivo:** Atualizar o runbook operacional do Supabase.

**Quando usar:**
- Após criação de novas tabelas críticas
- Após mudança em Edge Functions
- Após novo procedimento de recovery
- Após incidente operacional relevante

**Arquivos impactados:**
- Seção \`runbooks/supabase\` em \`src/data/docs/content.ts\`

**Critério de aceite:**
- Tabelas críticas estão listadas
- Edge Functions estão documentadas
- Procedimentos de troubleshooting estão atualizados

---

## 4. Execução

### 4.1 Execução Manual (atual)

Os comandos são executados manualmente via a interface administrativa em \`/modulos/docs/admin/sync\`. Cada execução é registrada na tabela \`docs_sync_runs\` com:

- Comando executado
- Status (pending, running, success, failed)
- Timestamp de início e fim
- Arquivos afetados
- Resumo da execução

### 4.2 Automação Futura

A arquitetura está preparada para automação futura disparada por:

| Trigger | Comando |
|---------|---------|
| Nova migration | \`OPEN_DOCS_SYNC_DATA_MODEL\` |
| Nova Edge Function | \`OPEN_DOCS_SYNC_API\` |
| Mudança em \`modulesConfig.ts\` | \`OPEN_DOCS_SYNC_ARCHITECTURE\` |
| Mudança em \`routes.ts\` | \`OPEN_DOCS_SYNC_ARCHITECTURE\` |
| Mudança em schema | \`OPEN_DOCS_SYNC_DATA_MODEL\` |
| Release tag | \`OPEN_DOCS_AUTOSYNC\` |

---

## 5. Cobertura Documental

A tabela \`docs_sync_coverage\` rastreia quais artefatos do sistema possuem documentação correspondente:

| source_type | Exemplos |
|-------------|----------|
| module | Comercial, Parceiros, Admin |
| table | calculator_proposals, tech_incidents |
| edge_function | proposal-save, pricing-admin |
| event | proposal.approved, contract.created |
| route | /modulos/comercial, /modulos/docs |
| menu_item | Dashboard, Atendimentos |

---

## 6. Regras

1. Nenhuma mudança estrutural deve ser feita sem atualizar a documentação
2. O changelog deve registrar toda atualização significativa
3. A cobertura documental deve ser verificada periodicamente
4. Documentos faltantes devem ser priorizados no backlog
`;
