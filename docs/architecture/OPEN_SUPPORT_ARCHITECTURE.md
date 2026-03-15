# OPEN — Arquitetura do Módulo de Suporte Técnico

Versão: v1  
Sistema: core.opendata.center  
Última atualização: 2026-03-15

---

## 1. Visão Geral

O módulo de Suporte Técnico opera em uma arquitetura **Supabase-first**, independente do legado Laravel. Toda a operação de chamados, SLA, filas e notificações é processada via Edge Functions com `SERVICE_ROLE_KEY` para bypass de RLS.

---

## 2. Diagrama de Componentes

```
┌──────────────────────────────────────────────────────────────┐
│                      FRONTEND (React SPA)                     │
│                                                               │
│  ┌─────────────┐  ┌──────────────────┐  ┌──────────────────┐ │
│  │ Portal      │  │ Portal Interno   │  │ Dashboard NOC    │ │
│  │ Cliente     │  │ /modulos/        │  │ Visão Geral      │ │
│  │ /portal/    │  │ atendimentos/    │  │                  │ │
│  │ tickets     │  │ suporte-tecnico  │  │                  │ │
│  └──────┬──────┘  └────────┬─────────┘  └────────┬─────────┘ │
│         │                  │                      │           │
│         └──────────────────┼──────────────────────┘           │
│                            │                                  │
│              ┌─────────────▼──────────────┐                   │
│              │   Service Layer            │                   │
│              │   supportTicketCoreService │                   │
│              │   notificationService      │                   │
│              └─────────────┬──────────────┘                   │
└────────────────────────────┼──────────────────────────────────┘
                             │ HTTPS
                             ▼
┌──────────────────────────────────────────────────────────────┐
│                    SUPABASE (Lovable Cloud)                    │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                    Edge Functions                        │ │
│  │                                                         │ │
│  │  support-ticket-create   support-ticket-list             │ │
│  │  support-ticket-get      support-ticket-update           │ │
│  │  support-ticket-messages support-ticket-upload            │ │
│  │  support-ticket-ingest   support-sla-admin               │ │
│  │  support-queue-admin     support-dashboard-stats          │ │
│  └─────────────────────┬───────────────────────────────────┘ │
│                        │                                      │
│  ┌─────────────────────▼───────────────────────────────────┐ │
│  │                   PostgreSQL                             │ │
│  │                                                         │ │
│  │  support_tickets          support_ticket_messages         │ │
│  │  support_ticket_events    support_ticket_attachments      │ │
│  │  support_ticket_assignments  support_ticket_queue_history │ │
│  │  support_ticket_status_history  support_ticket_watchers   │ │
│  │  support_queues           support_queue_members           │ │
│  │  support_sla_policies     support_oncall                  │ │
│  │  support_catalog_*        support_notifications           │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  Storage: support-ticket-files                          │ │
│  └─────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

---

## 3. Fluxo Arquitetural

### 3.1 Abertura de Ticket (Cliente)

```
Cliente → Portal (/portal/tickets) → support-ticket-create (Edge Function)
  → INSERT support_tickets (com SLA auto-calculado)
  → INSERT support_ticket_events (ticket.created)
  → INSERT support_notifications (para membros da fila N1)
```

### 3.2 Abertura de Ticket (Interno)

```
Usuário interno → /modulos/atendimentos/suporte-tecnico → TicketCreateModal
  → support-ticket-create (Edge Function)
  → Mesma lógica de persistência
```

### 3.3 Atendimento

```
Analista → Lista de tickets → Detalhe do ticket
  → support-ticket-update (ação: assign | start | escalate | resolve | close)
  → UPDATE support_tickets
  → INSERT support_ticket_status_history
  → INSERT support_ticket_queue_history (se transferência)
  → INSERT support_ticket_assignments (se atribuição)
  → INSERT support_ticket_events
  → INSERT support_notifications
```

### 3.4 Mensagens

```
Usuário → TicketMessages → support-ticket-messages (Edge Function)
  → INSERT support_ticket_messages
  → INSERT support_ticket_events (ticket.message_added)
  → UPDATE support_tickets (last_customer_message_at ou last_internal_update_at)
```

---

## 4. Segurança

| Camada | Mecanismo |
|--------|-----------|
| Autenticação | Token JWT (API legada) validado em Edge Functions |
| Autorização | `user_level` verificado em cada Edge Function |
| RLS | Tabelas protegidas — Edge Functions usam `SERVICE_ROLE_KEY` |
| Visibilidade | Baseada em fila (`support_queue_members`) e atribuição |
| Notas internas | `is_internal_note=true` nunca retornado para `user_level < 600` |

---

## 5. Comunicação entre Sistemas

### API Legada (Laravel)

- Autenticação de usuários internos e clientes
- Consulta de dados de empresas (`/api/company`)
- Consulta de usuários (`/api/user`)

### Supabase (fonte de verdade)

- Todo o ciclo de vida do ticket
- SLA, filas, membros, plantão
- Mensagens, anexos, eventos
- Notificações

### Frontend

- React SPA com React Query
- Polling a cada 30-60s para notificações
- Atualização automática do dashboard (60s)

---

## 6. Mapeamento de IDs

Devido à arquitetura híbrida (CORE = Integer, Supabase = UUID):

| Campo | Tipo | Observação |
|-------|------|-----------|
| `requester_user_id` | UUID | Recebe `null` se ID do CORE for inteiro |
| `assigned_to_user_id` | UUID | Idem |
| `resolved_by_user_id` | Integer | Compatível com CORE |
| `closed_by_user_id` | Integer | Compatível com CORE |
| `metadata.legacy_user_id` | Integer | ID original do CORE preservado |

---

## 7. Escalabilidade

| Aspecto | Estratégia |
|---------|-----------|
| Volume de tickets | Paginação server-side (25/página) |
| Consultas frequentes | Índices compostos (status, queue, assigned) |
| Notificações | Polling (30-60s), futuro: Realtime |
| Storage | Bucket `support-ticket-files` com signed URLs |
| SLA | Cálculo na criação, verificação no dashboard |
