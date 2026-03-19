# OPEN — Arquitetura do Módulo de Suporte Técnico

Versão: v2 (Supabase Auth + UUID-first)  
Sistema: core.opendata.center  
Última atualização: 2026-03-19

---

## 1. Visão Geral

O módulo de Suporte Técnico opera em uma arquitetura **Supabase-first**, independente do legado Laravel. Toda a operação de chamados, SLA, filas e notificações é processada via Edge Functions com `SERVICE_ROLE_KEY` para bypass de RLS.

### 1.1 Identidade (pós-cutover)

A identidade de usuários é gerenciada pelo **Supabase Auth**. O `AuthContext` carrega perfil e roles do banco, e o `useSession` hook fornece a interface de sessão para todos os módulos.

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
│  ┌─────────────────────────▼──────────────────────────────┐  │
│  │                  Identity Layer                         │  │
│  │  AuthContext → useSession → getEffectiveRoles           │  │
│  │  Source: Supabase Auth + profiles + user_roles           │  │
│  └─────────────────────────┬──────────────────────────────┘  │
│                            │                                  │
│  ┌─────────────────────────▼──────────────────────────────┐  │
│  │   Service Layer                                         │  │
│  │   supportTicketCoreService (getAuthTokenSync)           │  │
│  │   notificationService                                    │  │
│  └─────────────────────────┬──────────────────────────────┘  │
└────────────────────────────┼──────────────────────────────────┘
                             │ HTTPS
                             ▼
┌──────────────────────────────────────────────────────────────┐
│                    SUPABASE (Lovable Cloud)                    │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  Auth Layer                                             │ │
│  │  auth.users → trigger handle_new_user → profiles         │ │
│  │  user_roles (role_slug) → has_role() helper              │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                    Edge Functions                        │ │
│  │                                                         │ │
│  │  support-ticket-create   support-ticket-list             │ │
│  │  support-ticket-get      support-ticket-update           │ │
│  │  support-ticket-messages support-ticket-upload            │ │
│  │  support-ticket-ingest   support-sla-admin               │ │
│  │  support-queue-admin     support-dashboard-stats          │ │
│  │  user-backfill           send-password-reset              │ │
│  └─────────────────────┬───────────────────────────────────┘ │
│                        │                                      │
│  ┌─────────────────────▼───────────────────────────────────┐ │
│  │                   PostgreSQL                             │ │
│  │                                                         │ │
│  │  profiles                   user_roles                    │ │
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
  → user_id = auth.uid() (UUID do Supabase)
```

### 3.2 Abertura de Ticket (Interno)

```
Usuário interno → /modulos/atendimentos/suporte-tecnico → TicketCreateModal
  → support-ticket-create (Edge Function)
  → user_id extraído da sessão Supabase (useSession().userId)
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
  → Todos os campos *_user_id usam UUID do Supabase Auth
```

### 3.4 Mensagens

```
Usuário → TicketMessages → support-ticket-messages (Edge Function)
  → INSERT support_ticket_messages (author_user_id = UUID)
  → INSERT support_ticket_events (ticket.message_added)
  → UPDATE support_tickets (last_customer_message_at ou last_internal_update_at)
```

---

## 4. Segurança

| Camada | Mecanismo |
|--------|-----------|
| Autenticação | **Supabase Auth JWT** (primário) / Token legado (fallback via `getAuthTokenSync`) |
| Autorização | Roles (`effectiveRoles`) verificados no frontend e Edge Functions |
| RLS | Tabelas protegidas — Edge Functions usam `SERVICE_ROLE_KEY` |
| Visibilidade | Baseada em roles + fila (`support_queue_members`) e atribuição |
| Notas internas | `is_internal_note=true` nunca retornado para role `cliente` |

---

## 5. Comunicação entre Sistemas

### Supabase (fonte de verdade)

- Autenticação de todos os usuários (Supabase Auth)
- Identidade e roles (profiles + user_roles)
- Todo o ciclo de vida do ticket
- SLA, filas, membros, plantão
- Mensagens, anexos, eventos
- Notificações

### API Legada (Laravel) — ⚠️ compatibilidade temporária

- Consulta de dados de empresas (`/api/company`)
- Consulta de usuários para importação (`/api/user`)
- **Não mais usada para autenticação**

### Frontend

- React SPA com React Query
- Polling a cada 30-60s para notificações
- Atualização automática do dashboard (60s)
- Sessão gerenciada pelo `AuthContext` (Supabase Auth)

---

## 6. Mapeamento de IDs (pós-cutover Fase 4)

| Campo | Tipo | Status |
|-------|------|--------|
| `requester_user_id` | UUID | ✅ Supabase Auth |
| `assigned_to_user_id` | UUID | ✅ Supabase Auth |
| `author_user_id` | UUID | ✅ Supabase Auth |
| `resolved_by_user_id` | UUID | ✅ Migrado |
| `closed_by_user_id` | UUID | ✅ Migrado |
| `actor_id` | text (UUID) | ✅ Supabase Auth |
| `support_queue_members.user_id` | integer | ⚠️ Legado (migração pendente) |
| `support_oncall.user_id` | integer | ⚠️ Legado (migração pendente) |
| `profiles.legacy_user_id` | integer | ✅ Ponte permanente |

---

## 7. Escalabilidade

| Aspecto | Estratégia |
|---------|-----------|
| Volume de tickets | Paginação server-side (25/página) |
| Consultas frequentes | Índices compostos (status, queue, assigned) |
| Notificações | Polling (30-60s), futuro: Realtime |
| Storage | Bucket `support-ticket-files` com signed URLs |
| SLA | Cálculo na criação, verificação no dashboard |

---

## 8. Base para SALES OPEN

O CORE (este sistema) serve como base de identidade e infraestrutura para o projeto SALES OPEN:

| Componente | Compartilhado |
|------------|---------------|
| `auth.users` | ✅ Mesma base de usuários |
| `profiles` | ✅ Perfis compartilhados |
| `user_roles` | ✅ Roles compartilhadas |
| `calculator_proposals` | ✅ Propostas no mesmo banco |
| `contracts` | ✅ Contratos no mesmo banco |
| Edge Functions | ✅ Deploy compartilhado |
| RLS policies | ✅ Proteção unificada |
