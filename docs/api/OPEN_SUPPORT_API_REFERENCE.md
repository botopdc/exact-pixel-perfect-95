# OPEN — API Reference do Suporte Técnico

Versão: v2 (Supabase Auth + UUID)  
Sistema: core.opendata.center  
Última atualização: 2026-03-19

---

## 1. Visão Geral

Todas as operações do módulo de suporte técnico são processadas via **Edge Functions** no Supabase, utilizando `SERVICE_ROLE_KEY` para bypass de RLS.

### 1.1 Autenticação

| Método | Descrição | Status |
|--------|-----------|--------|
| **Supabase Auth JWT** | Token JWT do Supabase Auth (primário) | ✅ Ativo |
| Token legado API | Token da API Laravel (`open_access_token`) | ⚠️ Compatibilidade |

O frontend utiliza `getAuthTokenSync()` (`src/lib/authToken.ts`) que prioriza o JWT do Supabase e usa o token legado como fallback.

Base URL: `${VITE_SUPABASE_URL}/functions/v1/`

### 1.2 Identificação do Usuário

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `user_id` | UUID (string) | ID do Supabase Auth — **identidade primária** |
| `user_name` | string | Nome do usuário |
| `user_email` | string | Email |
| `user_level` | integer | Nível (fallback de compatibilidade) |
| `user_roles` | string[] | Roles efetivas (novo, preferencial) |

---

## 2. Endpoints — Edge Functions Ativas

### 2.1 support-ticket-create

**Descrição:** Criar novo ticket com SLA auto-calculado.

| Item | Valor |
|------|-------|
| Método | POST |
| URL | `/functions/v1/support-ticket-create` |
| Auth | Bearer Token (Supabase JWT ou legado) |
| Acesso | Qualquer usuário autenticado |

**Payload:**

```json
{
  "title": "Servidor indisponível",
  "description": "VM03 não responde desde 14:30",
  "ticket_type": "incidente",
  "category": "infraestrutura",
  "severity": "S1",
  "priority": "critical",
  "origin_channel": "portal",
  "company_id": "uuid",
  "requester_name": "João Silva",
  "requester_email": "joao@empresa.com",
  "requester_level": 1,
  "asset_label": "VM03-SP1",
  "user_id": "uuid-supabase-auth",
  "user_name": "João Silva",
  "user_level": 1
}
```

---

### 2.2 support-ticket-list

**Descrição:** Listar tickets com filtros, paginação e visibilidade baseada em roles.

| Item | Valor |
|------|-------|
| Método | POST |
| URL | `/functions/v1/support-ticket-list` |
| Auth | Bearer Token |

**Payload:**

```json
{
  "page": 1,
  "per_page": 25,
  "status": ["novo", "em_atendimento"],
  "severity": "S1",
  "current_queue_id": "uuid",
  "search": "VM03",
  "only_unassigned": false,
  "only_mine": false,
  "only_sla_breached": false,
  "sort_by": "created_at",
  "sort_dir": "desc",
  "user_id": "uuid-supabase-auth",
  "user_email": "analista@open.com",
  "user_level": 900
}
```

---

### 2.3 support-ticket-get

**Descrição:** Buscar ticket completo com mensagens, eventos, histórico.

| Item | Valor |
|------|-------|
| Método | POST |
| URL | `/functions/v1/support-ticket-get` |
| Auth | Bearer Token |

**Payload:**

```json
{
  "ticket_id": "uuid",
  "user_id": "uuid-supabase-auth",
  "user_level": 900
}
```

---

### 2.4 support-ticket-update

**Descrição:** Executar ações no ticket.

| Item | Valor |
|------|-------|
| Método | POST |
| URL | `/functions/v1/support-ticket-update` |
| Auth | Bearer Token |

**Ações disponíveis:**

| Ação | Role mínima | Descrição |
|------|-------------|-----------|
| `assign` | `suporte` | Atribuir a analista |
| `start` | `suporte` | Iniciar atendimento |
| `escalate` | `suporte` | Escalar para N2/N3 |
| `resolve` | `suporte` | Resolver tecnicamente |
| `close` | `cs` | Encerrar definitivamente |
| `reopen` | `cs` | Reabrir ticket |
| `cancel` | `gerente_suporte` | Cancelar ticket |
| `transfer` | `gerente_suporte` | Transferir entre filas |

**Payload (exemplo: assign):**

```json
{
  "ticket_id": "uuid",
  "action": "assign",
  "assigned_to_user_id": "uuid-supabase-auth",
  "assigned_to_name": "Maria Santos",
  "user_id": "uuid-supabase-auth",
  "user_name": "Admin João",
  "user_level": 950
}
```

---

### 2.5 support-ticket-messages

**Descrição:** Listar e enviar mensagens/notas internas.

| Item | Valor |
|------|-------|
| Método | POST |
| URL | `/functions/v1/support-ticket-messages` |
| Auth | Bearer Token |

**Payload (enviar):**

```json
{
  "action": "send",
  "ticket_id": "uuid",
  "body": "Texto da mensagem",
  "is_internal_note": false,
  "author_user_id": "uuid-supabase-auth",
  "author_name": "Analista",
  "author_type": "support",
  "user_level": 900
}
```

---

### 2.6 support-ticket-upload

| Item | Valor |
|------|-------|
| Método | POST |
| URL | `/functions/v1/support-ticket-upload` |
| Auth | Bearer Token |
| Content-Type | multipart/form-data |

| Campo | Tipo | Obrigatório |
|-------|------|-------------|
| `file` | File | Sim |
| `ticket_id` | string | Sim |
| `is_internal` | boolean | Não |
| `user_id` | string (UUID) | Sim |
| `user_name` | string | Sim |

---

### 2.7 support-sla-admin

| Item | Valor |
|------|-------|
| Método | POST |
| URL | `/functions/v1/support-sla-admin` |
| Auth | Bearer Token |
| Acesso | `gerente_suporte` ou `admin` |

**Ações:** `list`, `create`, `update`, `delete`

---

### 2.8 support-queue-admin

| Item | Valor |
|------|-------|
| Método | POST |
| URL | `/functions/v1/support-queue-admin` |
| Auth | Bearer Token |
| Acesso | `suporte` (leitura), `gerente_suporte` (escrita) |

**Ações:** `list_queues`, `list_members`, `add_member`, `remove_member`, `update_member`

---

### 2.9 support-dashboard-stats

| Item | Valor |
|------|-------|
| Método | POST |
| URL | `/functions/v1/support-dashboard-stats` |
| Auth | Bearer Token |
| Acesso | `cs`, `gerente_suporte` ou `admin` |

---

### 2.10 support-ticket-ingest

**Descrição:** Ingestão de tickets de sistemas externos (Zabbix, API).

| Item | Valor |
|------|-------|
| Método | POST |
| URL | `/functions/v1/support-ticket-ingest` |
| Auth | Bearer Token |

---

## 3. Endpoints — Propostas e Contratos (Edge Functions)

| Edge Function | Descrição | Auth |
|---------------|-----------|------|
| `proposal-list` | Listar propostas | Bearer Token |
| `proposal-get` | Buscar proposta por ID | Bearer Token |
| `proposal-save` | Criar/atualizar proposta | Bearer Token |
| `proposal-track` | Registrar evento de proposta | Bearer Token |
| `proposal-download` | Gerar PDF da proposta | Bearer Token |
| `proposal-public` | Acesso público à proposta (token) | Público |
| `proposal-public-link` | Gerar link público | Bearer Token |
| `public-approval` | Aprovação pública de proposta | Público |
| `proposal-gateway` | Gateway de dados da proposta | Bearer Token |
| `pricing-admin` | CRUD de configurações de preço | Bearer Token |
| `contract-generate-document` | Gerar documento de contrato | Bearer Token |

---

## 4. Endpoints Legados (Laravel) — ⚠️ Compatibilidade

| Endpoint | Descrição | Status |
|----------|-----------|--------|
| `POST /api/auth/login` | Login legado | ⚠️ Descontinuar |
| `GET /api/auth/me` | Dados do usuário logado | ⚠️ Descontinuar |
| `GET /api/user` | Lista de usuários | ⚠️ Ponte para importação |
| `GET /api/company` | Lista de empresas | ✅ Ativo (sem equivalente Supabase) |
| `GET /api/partner` | CRUD de parceiros | ✅ Ativo (sem equivalente Supabase) |

> **Nota:** Os endpoints de autenticação legados (`/api/auth/*`) estão em processo de descontinuação. A autenticação principal é via Supabase Auth.

---

## 5. Outros — Edge Functions de Infraestrutura

| Edge Function | Descrição |
|---------------|-----------|
| `user-backfill` | Reconciliação e importação de usuários legados |
| `send-password-reset` | Envio de email de reset de senha |
| `send-proposal-email` | Envio de email com proposta |

---

## 6. Códigos de Erro

| Código | Descrição |
|--------|-----------|
| 401 | Token inválido ou expirado |
| 403 | Role/nível insuficiente para a ação |
| 404 | Recurso não encontrado |
| 422 | Dados inválidos |
| 500 | Erro interno |

---

## 7. Padrão de Resposta

```json
{
  "success": true | false,
  "data": { ... },
  "message": "Descrição do erro",
  "errors": ["detalhe1", "detalhe2"],
  "meta": { "current_page": 1, "per_page": 25, "total": 100 }
}
```
