# OPEN — Modelo de Dados do Suporte Técnico

Versão: v1  
Sistema: core.opendata.center  
Última atualização: 2026-03-15

---

## 1. Visão Geral

O modelo de dados do suporte técnico reside integralmente no Supabase (PostgreSQL) e é independente do schema legado Laravel. Todas as tabelas usam UUID como chave primária, convenção `snake_case` e campos de auditoria `created_at`/`updated_at`.

---

## 2. Entidade Principal: support_tickets

| Campo | Tipo | Nullable | Default | Descrição |
|-------|------|----------|---------|-----------|
| `id` | UUID | Não | `gen_random_uuid()` | Identificador interno |
| `ticket_number` | bigint | Sim | Trigger | Número sequencial |
| `public_code` | text | Sim | Trigger | Código público TIC-YYYY-NNNNNN |
| `title` | text | Não | — | Título do chamado |
| `description` | text | Não | — | Descrição detalhada |
| `ticket_type` | text | Não | — | Tipo: incidente, solicitacao, duvida, alteracao, financeiro |
| `category` | text | Não | — | Categoria do catálogo |
| `subcategory` | text | Sim | — | Subcategoria |
| `service_name` | text | Sim | — | Serviço do catálogo |
| `severity` | enum | Não | `S4` | S1, S2, S3, S4 |
| `priority` | enum | Não | `medium` | critical, high, medium, low |
| `status` | enum | Não | `novo` | Status atual |
| `current_support_level` | text | Não | `N1` | Nível atual |
| `current_queue_id` | UUID | Sim | — | FK para support_queues |
| `type_id` | UUID | Sim | — | FK para catalog_categories |
| `category_id` | UUID | Sim | — | FK para catalog_services |
| `origin_channel` | enum | Não | `portal` | Canal de origem |
| `company_id` | UUID | Sim | — | Empresa do cliente |
| `requester_user_id` | UUID | Sim | — | ID do solicitante (UUID) |
| `requester_name` | text | Não | — | Nome do solicitante |
| `requester_email` | text | Sim | — | Email do solicitante |
| `requester_phone` | text | Sim | — | Telefone |
| `requester_level` | integer | Sim | — | Nível do solicitante |
| `assigned_to_user_id` | UUID | Sim | — | Responsável atual |
| `assigned_to_name` | text | Sim | — | Nome do responsável |
| `assigned_at` | timestamptz | Sim | — | Data da atribuição |
| `asset_id` | UUID | Sim | — | Ativo vinculado |
| `asset_label` | text | Sim | — | Label do ativo |
| `sla_policy_id` | UUID | Sim | — | Política SLA aplicada |
| `first_response_due_at` | timestamptz | Sim | — | Prazo 1ª resposta |
| `resolution_due_at` | timestamptz | Sim | — | Prazo resolução |
| `first_response_at` | timestamptz | Sim | — | Data 1ª resposta real |
| `resolved_at` | timestamptz | Sim | — | Data resolução |
| `closed_at` | timestamptz | Sim | — | Data encerramento |
| `resolved_by_user_id` | integer | Sim | — | Quem resolveu (CORE ID) |
| `closed_by_user_id` | integer | Sim | — | Quem encerrou (CORE ID) |
| `resolution_summary` | text | Sim | — | Resumo da resolução |
| `close_reason` | text | Sim | — | Motivo do encerramento |
| `customer_visible` | boolean | Não | `true` | Visível para cliente |
| `metadata` | jsonb | Não | `{}` | Dados adicionais |
| `created_at` | timestamptz | Não | `now()` | Criação |
| `updated_at` | timestamptz | Não | `now()` | Última atualização |
| `deleted_at` | timestamptz | Sim | — | Soft delete |

---

## 3. Tabelas Auxiliares

### 3.1 support_ticket_messages

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | PK |
| `ticket_id` | UUID | FK → support_tickets |
| `author_user_id` | UUID | Autor |
| `author_name` | text | Nome do autor |
| `author_type` | enum | client, support, cs, manager, system, integration |
| `body` | text | Conteúdo da mensagem |
| `is_internal_note` | boolean | Nota interna (oculta para clientes) |
| `created_at` | timestamptz | Data |

### 3.2 support_ticket_attachments

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | PK |
| `ticket_id` | UUID | FK → support_tickets |
| `message_id` | UUID | FK → messages (opcional) |
| `storage_path` | text | Caminho no bucket |
| `original_filename` | text | Nome original |
| `mime_type` | text | Tipo MIME |
| `file_size` | bigint | Tamanho em bytes |
| `is_internal` | boolean | Anexo interno |
| `uploaded_by_user_id` | UUID | Quem enviou |
| `uploaded_by_name` | text | Nome |

### 3.3 support_ticket_events

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | PK |
| `entity_id` | UUID | ID do ticket |
| `entity_type` | text | `support_ticket` |
| `event_name` | text | Ex: `ticket.assigned` |
| `actor_id` | text | ID do ator |
| `actor_type` | text | Tipo do ator |
| `metadata` | jsonb | Dados do evento |
| `occurred_at` | timestamptz | Data do evento |

### 3.4 support_ticket_assignments

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | PK |
| `ticket_id` | UUID | FK → support_tickets |
| `from_user_id` | text | Anterior |
| `to_user_id` | text | Novo responsável |
| `from_queue` | text | Fila anterior |
| `to_queue` | text | Fila destino |
| `reason` | text | Motivo |
| `assigned_by_user_id` | text | Quem atribuiu |

### 3.5 support_ticket_queue_history

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | PK |
| `ticket_id` | UUID | FK → support_tickets |
| `from_queue_id` | UUID | Fila origem |
| `to_queue_id` | UUID | Fila destino |
| `from_support_level` | text | Nível origem |
| `to_support_level` | text | Nível destino |
| `changed_by_user_id` | integer | Quem alterou (CORE ID) |
| `changed_by_name` | text | Nome |
| `reason` | text | Motivo |

### 3.6 support_ticket_status_history

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | PK |
| `ticket_id` | UUID | FK → support_tickets |
| `from_status` | text | Status anterior |
| `to_status` | text | Novo status |
| `changed_by_user_id` | integer | Quem alterou |
| `changed_by_name` | text | Nome |
| `reason` | text | Motivo |

### 3.7 support_ticket_watchers

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | PK |
| `ticket_id` | UUID | FK → support_tickets |
| `user_id` | UUID | Observador |
| `user_name` | text | Nome |

---

## 4. Tabelas de Configuração

### 4.1 support_queues

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | PK |
| `code` | text | Código: N1, N2, N3, CS |
| `name` | text | Nome legível |
| `queue_type` | text | Tipo da fila |
| `sort_order` | integer | Ordem |
| `is_active` | boolean | Ativa |

### 4.2 support_queue_members

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | PK |
| `queue_id` | UUID | FK → support_queues |
| `user_id` | integer | ID do analista (CORE) |
| `user_name` | text | Nome |
| `user_email` | text | Email (chave de lookup) |
| `user_level` | integer | Nível |
| `is_primary` | boolean | Membro primário |
| `can_receive_auto_assign` | boolean | Auto-atribuição |
| `is_active` | boolean | Ativo |

### 4.3 support_sla_policies

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | PK |
| `code` | text | Código único |
| `name` | text | Nome |
| `severity` | text | Severidade aplicável |
| `ticket_type` | text | Tipo aplicável |
| `category` | text | Categoria |
| `customer_plan` | text | Plano do cliente |
| `first_response_minutes` | integer | Prazo 1ª resposta (min) |
| `resolution_minutes` | integer | Prazo resolução (min) |
| `business_hours_only` | boolean | Apenas horário comercial |
| `pause_on_waiting_customer` | boolean | Pausar SLA em aguardando cliente |
| `pause_on_waiting_third_party` | boolean | Pausar em aguardando terceiro |

### 4.4 support_oncall

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | PK |
| `team` | text | Time: Infra, Cloud, CS |
| `user_id` | integer | ID do analista |
| `user_name` | text | Nome |
| `user_email` | text | Email |
| `start_at` | timestamptz | Início do plantão |
| `end_at` | timestamptz | Fim do plantão |
| `is_active` | boolean | Ativo |

### 4.5 support_notifications

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | PK |
| `user_id` | text | Destinatário |
| `event_name` | text | Evento |
| `title` | text | Título |
| `body` | text | Corpo |
| `ticket_id` | UUID | Ticket relacionado |
| `ticket_public_code` | text | Código público |
| `is_read` | boolean | Lida |
| `metadata` | jsonb | Dados extras |

---

## 5. Enums

| Enum | Valores |
|------|---------|
| `support_ticket_status` | novo, triagem, em_atendimento, aguardando_cliente, aguardando_terceiro, escalado_n2, escalado_n3, resolvido_suporte, encerrado_cs, reaberto, cancelado |
| `support_level_enum` | N1, N2, N3 |
| `support_queue_enum` | N1, N2, N3, CS |
| `support_author_type` | client, support, cs, manager, system, integration |
| `support_origin_channel` | portal, internal_portal, zabbix, api, email |
| `support_severity` | S1, S2, S3, S4 |
| `support_priority` | critical, high, medium, low |

---

## 6. Relacionamentos

```
support_tickets
  ├── 1:N → support_ticket_messages
  ├── 1:N → support_ticket_attachments
  ├── 1:N → support_ticket_events
  ├── 1:N → support_ticket_assignments
  ├── 1:N → support_ticket_queue_history
  ├── 1:N → support_ticket_status_history
  ├── 1:N → support_ticket_watchers
  ├── N:1 → support_queues (current_queue_id)
  ├── N:1 → support_sla_policies (sla_policy_id)
  └── 1:N → support_notifications

support_queues
  └── 1:N → support_queue_members
```

---

## 7. RLS (Row Level Security)

| Tabela | SELECT | INSERT | UPDATE | DELETE |
|--------|--------|--------|--------|--------|
| support_tickets | `is_support_internal()` | `is_support_internal()` | `is_support_internal()` | ❌ |
| support_ticket_messages | `is_support_internal()` | `is_support_internal()` | ❌ | ❌ |
| support_ticket_attachments | `is_support_internal()` | `is_support_internal()` | ❌ | ❌ |
| support_ticket_events | `is_support_internal()` | `is_support_internal()` | ❌ | ❌ |
| support_queues | `is_support_internal()` | Admin | Admin | Admin |
| support_queue_members | `is_support_internal()` | Manager+ | Manager+ | Manager+ |
| support_sla_policies | `is_support_internal()` | Admin | Admin | Admin |
| support_oncall | `is_support_internal()` | Manager+ | Manager+ | Manager+ |
| support_notifications | `is_support_internal()` | `is_support_internal()` | `is_support_internal()` | ❌ |

**Nota:** Edge Functions usam `SERVICE_ROLE_KEY` para bypass total de RLS.
