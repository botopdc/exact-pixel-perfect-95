# OPEN — Módulo de Atendimentos / Suporte Técnico

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

Este módulo funciona como o **NOC operacional da OPEN**, centralizando todas as operações de suporte técnico e relacionamento com clientes.

---

## 2. Estrutura do módulo

### Menu principal

**ATENDIMENTOS** (`/modulos/atendimentos`)

### Submódulos

| Submódulo | Rota | Descrição |
|-----------|------|-----------|
| **Visão Geral** | `/modulos/atendimentos` | Dashboard operacional com KPIs em tempo real, distribuição de filas, plantão ativo e tempos médios |
| **Analistas** | `/modulos/atendimentos/analistas` | Gestão de analistas e membros das filas de suporte |
| **Suporte Técnico** | `/modulos/atendimentos/suporte-tecnico` | Sistema de chamados principal — listagem, criação, detalhe e operação |
| **Customer Success** | `/modulos/atendimentos/cs` | Atendimentos de CS — validação, encerramento e health score |
| **KPIs de Atendimento** | `/modulos/atendimentos/kpis` | Métricas e indicadores de desempenho operacional |

---

## 3. Visão Geral do NOC

A tela principal (`/modulos/atendimentos`) funciona como dashboard operacional de gestão em tempo real.

### Componentes do Dashboard

#### SLA Hoje
| Indicador | Descrição |
|-----------|-----------|
| Tickets abertos | Total de chamados em andamento |
| Dentro do SLA | Chamados dentro do prazo contratado |
| Fora do SLA | Chamados que violaram o SLA |
| Incidentes críticos | Chamados S1/S2 ativos |

#### Distribuição de Filas
| Fila | Responsabilidade |
|------|-----------------|
| N1 | Triagem e primeiro atendimento |
| N2 | Análise técnica e infraestrutura |
| N3 | Engenharia e vendor escalation |
| CS | Validação e encerramento |

#### Plantão Ativo
| Time | Descrição |
|------|-----------|
| Infra | Analista de plantão para infraestrutura |
| Cloud | Analista de plantão para cloud |
| CS | Analista de plantão para customer success |

Fonte: tabela `support_oncall` — analistas ativos no momento atual.

#### Tempo Médio
| Métrica | Descrição |
|---------|-----------|
| Primeira resposta | Tempo médio até a primeira resposta interna |
| Resolução | Tempo médio até a resolução do chamado |

**Atualização**: automática via React Query com intervalo de 60 segundos.  
**Edge Function**: `support-dashboard-stats`

---

## 4. Tipos de atendimento

### Níveis de suporte

| Nível | Fila | Responsabilidade |
|-------|------|-----------------|
| **N1** | N1 | Triagem, primeiro atendimento, resolução de problemas básicos, coleta de informações |
| **N2** | N2 | Análise técnica aprofundada, problemas de infraestrutura, configuração avançada |
| **N3** | N3 | Engenharia, arquitetura, problemas complexos, escalação para fabricantes (vendor escalation) |
| **CS** | CS | Validação de resolução, encerramento oficial, reabertura se necessário, acompanhamento do cliente |

### Tipos de chamado

| Tipo | Código | Descrição |
|------|--------|-----------|
| Incidente | `incidente` | Falha ou degradação em serviço ativo |
| Solicitação | `solicitacao` | Pedido de ação técnica ou operacional |
| Dúvida | `duvida` | Pergunta técnica ou operacional |
| Alteração | `alteracao` | Mudança em configuração existente |
| Financeiro | `financeiro` | Questão de faturamento, NF, cobrança |

---

## 5. Estrutura de tickets

### Campos principais

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | Identificador interno |
| `public_code` | string | Código público (`TIC-YYYY-NNNNNN`) |
| `title` | string | Título do chamado |
| `description` | text | Descrição detalhada |
| `requester_company_name` | string | Empresa do solicitante |
| `requester_user_id` | string | ID do solicitante |
| `severity` | enum | Severidade (S1, S2, S3, S4) |
| `priority` | enum | Prioridade (critical, high, medium, low) |
| `status` | enum | Status atual do ticket |
| `current_queue_id` | UUID | Fila atual (N1, N2, N3, CS) |
| `assigned_to_user_id` | string | Responsável atribuído |
| `type_id` | UUID | Tipo do chamado |
| `category_id` | UUID | Categoria |
| `origin_channel` | enum | Canal de origem (portal, internal_portal, zabbix, api, email) |
| `sla_first_response_deadline` | timestamp | Prazo SLA primeira resposta |
| `sla_resolution_deadline` | timestamp | Prazo SLA resolução |
| `first_response_at` | timestamp | Data/hora da primeira resposta |
| `resolved_at` | timestamp | Data/hora da resolução |
| `closed_at` | timestamp | Data/hora do encerramento |
| `created_at` | timestamp | Data/hora de criação |

### Severidades e SLA

| Severidade | Descrição | Contagem SLA | Primeira Resposta | Resolução |
|------------|-----------|--------------|-------------------|-----------|
| **S1** | Crítico — serviço indisponível | 24×7 | 15 min | 2h |
| **S2** | Alto — degradação significativa | 24×7 | 30 min | 4h |
| **S3** | Médio — impacto parcial | 24×7 | 60 min | 8h |
| **S4** | Baixo — sem impacto imediato | Horário comercial | 4h | 24h |

SLA calculado automaticamente na criação via match de políticas (`support_sla_policies`).

### Status possíveis

| Status | Código | Descrição | Quem altera |
|--------|--------|-----------|-------------|
| Novo | `novo` | Recém-criado | Sistema |
| Triagem | `triagem` | Sendo classificado | N1 assume |
| Em Atendimento | `em_atendimento` | Em tratamento ativo | Suporte |
| Aguardando Cliente | `aguardando_cliente` | Pendente resposta do cliente | Suporte |
| Aguardando Terceiro | `aguardando_terceiro` | Pendente resposta de terceiro | Suporte |
| Escalado N2 | `escalado_n2` | Escalado para N2 | Suporte |
| Escalado N3 | `escalado_n3` | Escalado para N3 | Suporte/Gerente |
| Resolvido Suporte | `resolvido_suporte` | Resolvido, aguardando validação CS | Suporte |
| Encerrado CS | `encerrado_cs` | Fechamento oficial | CS |
| Reaberto | `reaberto` | Reaberto após fechamento | CS/Gerente |
| Cancelado | `cancelado` | Cancelado | Gerente/Admin |

---

## 6. Fluxo de atendimento

### Ciclo de vida do ticket

```
NOVO → TRIAGEM → EM_ATENDIMENTO → AGUARDANDO_CLIENTE → RESOLVIDO_SUPORTE → ENCERRADO_CS
           ↓                            ↑
        ESCALADO_N2/N3 ────────────────┘
           ↓
        REABERTO ──→ (volta para fila operacional)
```

### Fluxo detalhado

1. **Cliente abre ticket** (portal ou API)
2. **Sistema cria ticket** com status `novo`, calcula SLA automaticamente
3. **N1 assume** — status muda para `triagem`
4. **N1 inicia atendimento** — status muda para `em_atendimento`
5. **Escalonamento** (se necessário) — N1 escala para N2/N3
6. **Aguardando cliente** — suporte aguarda informação do cliente
7. **Cliente responde** — status retorna para `em_atendimento`
8. **Suporte resolve** — status muda para `resolvido_suporte`
9. **CS valida e encerra** — status muda para `encerrado_cs`
10. **Reabertura** (se necessário) — CS ou Gerente reabre

### Eventos registrados

| Evento | Gatilho |
|--------|---------|
| `ticket.created` | Ticket criado |
| `ticket.status_changed` | Mudança de status |
| `ticket.assigned` | Ticket atribuído a analista |
| `ticket.transferred` | Ticket transferido entre filas |
| `ticket.escalated` | Escalado para N2/N3 |
| `ticket.resolved` | Resolvido pelo suporte |
| `ticket.closed` | Encerrado pelo CS |
| `ticket.reopened` | Ticket reaberto |
| `ticket.cancelled` | Ticket cancelado |
| `ticket.message_added` | Mensagem adicionada |
| `ticket.attachment_uploaded` | Anexo enviado |
| `ticket.sla_breached` | SLA violado (futuro: cron) |

Eventos seguem o padrão `entity.action` e são registrados na tabela `support_ticket_events` (append-only).

---

## 7. Integrações do módulo

| Canal | Status | Descrição |
|-------|--------|-----------|
| **Portal do Cliente** | ✅ Ativo | `/portal/tickets` — abertura e acompanhamento pelo cliente |
| **Portal Interno** | ✅ Ativo | `/modulos/atendimentos/suporte-tecnico` — operação interna |
| **API** | ✅ Ativo | Edge Functions (`support-ticket-create`, etc.) |
| **Email** | 🔜 Futuro | Abertura de tickets via email |
| **Zabbix** | 🔜 Futuro | `origin_channel = 'zabbix'` preparado |
| **WhatsApp** | 🔜 Futuro | Integração planejada |

### Campos de integração preparados

- `origin_channel` — canal de origem do ticket
- `source_system` — sistema de origem para deduplicação
- `external_reference` — referência externa
- `metadata` — JSONB para dados arbitrários de integração

---

## 8. RBAC do módulo

### Níveis de acesso

| Papel | Level | Descrição |
|-------|-------|-----------|
| Cliente | 1 | Acessa portal externo (`/portal/tickets`), abre chamados, vê apenas próprios tickets |
| Parceiro | 200 | Sem acesso ao módulo de atendimentos |
| RH | 600 | Pode abrir chamados internos |
| Sucesso do Cliente (CS) | 775 | Valida resolução, encerra oficialmente, reabre, comentários, notas internas |
| Suporte | 900 | Assume, trata, escala, resolve, comentários, notas internas |
| Gerente de Suporte | 950 | Atribuição, transferência, cancelamento, override de prioridade, visão global |
| Admin | 1000 | Acesso total, parametriza SLA, gerencia catálogos |

### Matriz de permissões

| Permissão | Cliente (1) | CS (775) | Suporte (900) | Gerente (950) | Admin (1000) |
|-----------|-------------|----------|---------------|---------------|--------------|
| Abrir chamado | ✅ | ✅ | ✅ | ✅ | ✅ |
| Ver próprios tickets | ✅ | ✅ | ✅ | ✅ | ✅ |
| Adicionar mensagem | ✅ | ✅ | ✅ | ✅ | ✅ |
| Upload de anexo | ✅ | ✅ | ✅ | ✅ | ✅ |
| Ver tickets da equipe | ❌ | ✅ | ✅ | ✅ | ✅ |
| Atribuir tickets | ❌ | ❌ | ✅ | ✅ | ✅ |
| Escalar tickets | ❌ | ❌ | ✅ | ✅ | ✅ |
| Resolver tickets | ❌ | ❌ | ✅ | ✅ | ✅ |
| Encerrar tickets | ❌ | ✅ | ❌ | ✅ | ✅ |
| Reabrir tickets | ❌ | ✅ | ❌ | ✅ | ✅ |
| Transferir entre filas | ❌ | ❌ | ❌ | ✅ | ✅ |
| Gerenciar SLA | ❌ | ❌ | ❌ | ✅ | ✅ |
| Gerenciar catálogos | ❌ | ❌ | ❌ | ❌ | ✅ |
| Cancelar tickets | ❌ | ❌ | ❌ | ✅ | ✅ |
| Ver auditoria | ❌ | ✅ | ✅ | ✅ | ✅ |

### Regras de visibilidade

- **Clientes (level 1)**: acessam exclusivamente `/portal/tickets`, veem apenas próprios tickets
- **Parceiros (level 200)**: sem acesso ao módulo de atendimentos
- **Internos (level 600+)**: acessam `/modulos/atendimentos/suporte-tecnico`
- **Visibilidade interna**: baseada em associação às filas (`support_queue_members`) ou atribuição direta
- **Gerentes (950) e Admin (1000)**: visão global de todos os chamados
- **Notas internas** (`is_internal_note=true`): nunca visíveis para clientes

---

## 9. Modelo de dados

### Tabelas principais

| Tabela | Descrição |
|--------|-----------|
| `support_tickets` | Tickets principais com código público `TIC-YYYY-NNNNNN` |
| `support_ticket_messages` | Mensagens públicas e notas internas |
| `support_ticket_attachments` | Anexos de arquivos |
| `support_ticket_assignments` | Histórico de atribuições/transferências |
| `support_ticket_status_history` | Histórico de mudanças de status |
| `support_ticket_queue_history` | Histórico de transições entre filas |
| `support_ticket_watchers` | Observadores do ticket |
| `support_ticket_events` | Eventos canônicos (append-only) |
| `support_sla_policies` | Políticas de SLA parametrizáveis |
| `support_catalog_categories` | Catálogo de categorias |
| `support_catalog_services` | Catálogo de serviços |
| `support_queues` | Definição das filas (N1, N2, N3, CS) |
| `support_queue_members` | Membros de cada fila |
| `support_oncall` | Plantões ativos |
| `support_notifications` | Notificações do módulo |

### Enums do banco

| Enum | Valores |
|------|---------|
| `support_ticket_status` | novo, triagem, em_atendimento, aguardando_cliente, aguardando_terceiro, escalado_n2, escalado_n3, resolvido_suporte, encerrado_cs, reaberto, cancelado |
| `support_level_enum` | N1, N2, N3 |
| `support_queue_enum` | N1, N2, N3, CS |
| `support_author_type` | client, support, cs, manager, system, integration |
| `support_origin_channel` | portal, internal_portal, zabbix, api, email |
| `support_severity` | S1, S2, S3, S4 |
| `support_priority` | critical, high, medium, low |

### Storage

- **Bucket**: `support-ticket-files` (privado)
- **Path**: `{ticket_id}/{filename}`

---

## 10. Edge Functions

| Função | Método | Descrição |
|--------|--------|-----------|
| `support-ticket-create` | POST | Criar ticket com SLA auto-calculado |
| `support-ticket-list` | POST | Listar com filtros, paginação, visibilidade por papel |
| `support-ticket-get` | POST | Buscar ticket completo (mensagens, anexos, histórico) |
| `support-ticket-update` | POST | Ações: assign, start, escalate, resolve, close, reopen, cancel, waiting, transfer |
| `support-ticket-messages` | POST | Adicionar mensagem ou nota interna |
| `support-ticket-upload` | POST | Upload de anexos |
| `support-sla-admin` | POST | CRUD de políticas SLA (admin/gerência) |
| `support-queue-admin` | POST | Gestão de membros das filas |
| `support-dashboard-stats` | POST | KPIs operacionais para o dashboard |

### Padrão de resposta

```json
{
  "success": true,
  "data": { ... },
  "message": "Operação realizada",
  "meta": { "current_page": 1, "per_page": 25, "total": 100 }
}
```

### Segurança

- Todas as Edge Functions usam `SERVICE_ROLE_KEY` (bypass RLS)
- Validação de `user_level` dentro das Edge Functions
- RLS como defense-in-depth adicional
- Clientes acessam apenas via Edge Functions (auth híbrida Laravel + Supabase)

---

## 11. KPIs do suporte

| Indicador | Descrição | Fonte |
|-----------|-----------|-------|
| Tickets abertos | Total de chamados em andamento | `support-dashboard-stats` |
| Tempo médio primeira resposta | Média de `first_response_at - created_at` | `support-dashboard-stats` |
| Tempo médio resolução | Média de `resolved_at - created_at` | `support-dashboard-stats` |
| SLA cumprido | % de tickets dentro do prazo | `support-dashboard-stats` |
| SLA violado | % de tickets fora do prazo | `support-dashboard-stats` |
| Distribuição por fila | Volume de tickets por N1/N2/N3/CS | `support-dashboard-stats` |
| Incidentes críticos | Tickets S1/S2 ativos | `support-dashboard-stats` |
| Tickets por analista | Volume individual por responsável | Futuro |
| Tickets por cliente | Volume por empresa solicitante | Futuro |

---

## 12. Regras de negócio

1. **Suporte resolve, CS encerra** — O suporte resolve tecnicamente (`resolvido_suporte`), mas o encerramento definitivo (`encerrado_cs`) é feito exclusivamente pelo CS
2. **Reabertura retorna à fila** — Ticket reaberto volta para a fila operacional
3. **Notas internas são privadas** — `is_internal_note=true` nunca visível para clientes
4. **Resposta do cliente reativa** — Cliente respondendo em `aguardando_cliente` move ticket para `em_atendimento`
5. **Primeira resposta registrada** — Primeira resposta interna (não nota interna) registra `first_response_at`
6. **SLA automático** — Calculado na criação via match de políticas (severidade × tipo × plano)
7. **Código público único** — Todo ticket recebe `TIC-YYYY-NNNNNN` via trigger no banco
8. **Separação portal/interno** — Clientes usam `/portal/tickets`, internos usam `/modulos/atendimentos/suporte-tecnico`

---

## 13. Roadmap do módulo

### Fase 2 — Em planejamento

| Funcionalidade | Descrição |
|----------------|-----------|
| Automação de SLA | Cron job para detectar violações e notificar |
| Auto classificação | Classificação automática de tipo/categoria |
| IA para triagem | Sugestão de fila e prioridade com base no texto |
| Integração Zabbix | Criação automática de tickets a partir de alertas |
| Correlação de incidentes | Agrupamento automático de tickets relacionados |
| Sugestão de solução | Base de conhecimento integrada com sugestões |
| Integração Email | Abertura e resposta de tickets via email |
| Relatórios avançados | Exportação de dados e dashboards customizáveis |

### Campos preparados para Fase 2

- `origin_channel = 'zabbix'` — pronto para integração
- `source_system` e `external_reference` — para deduplicação
- `metadata` JSONB — para dados arbitrários de integração
- Estrutura de eventos compatível com futuro `system_events`

---

## 14. Boas práticas operacionais

1. **Separação clara entre N1, N2 e N3** — cada nível tem responsabilidades definidas
2. **Registro completo de atividades** — toda ação gera evento na timeline
3. **Escalonamento rápido para incidentes críticos** — S1/S2 devem ser escalados imediatamente se necessário
4. **Uso de notas internas** — comunicação entre equipe sem visibilidade para o cliente
5. **Registro de causa raiz** — documentar causa na resolução
6. **Templates de resposta** — padronizar comunicações frequentes
7. **Plantão ativo** — manter escala de plantão atualizada na tabela `support_oncall`
8. **Monitoramento de SLA** — acompanhar dashboard em tempo real

---

## 15. Componentes UI

| Componente | Descrição |
|------------|-----------|
| `TicketCreateModal` | Modal unificado de criação de tickets |
| `TicketTable` | Tabela de listagem com filtros |
| `TicketFilters` | Filtros por status, fila, severidade |
| `TicketSummaryCards` | Cards de resumo (KPIs) |
| `TicketStatusBadge` | Badge visual de status |
| `TicketSeverityBadge` | Badge visual de severidade |
| `TicketSlaBadge` | Contagem regressiva de SLA em tempo real |
| `TicketActionsPanel` | Painel de ações (atribuir, escalar, resolver, etc.) |
| `TicketMessages` | Timeline de mensagens e notas internas |
| `TicketTimeline` | Timeline de eventos do ticket |
| `TicketAttachments` | Lista de anexos |
| `SLAKPICards` | Cards de KPI de SLA |
| `QueueDistributionCard` | Distribuição por fila |
| `ResponseTimeCard` | Tempos médios |
| `OnCallWidget` | Widget de plantão ativo |
