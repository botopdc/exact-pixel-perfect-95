# OPEN — API Reference do Suporte Técnico

Versão: v1  
Sistema: core.opendata.center  
Última atualização: 2026-03-15

---

## 1. Visão Geral

Todas as operações do módulo de suporte técnico são processadas via **Edge Functions** no Supabase, utilizando `SERVICE_ROLE_KEY` para bypass de RLS.

Autenticação: Token JWT da API legada, validado via `validateExternalToken()`.

Base URL: `${VITE_SUPABASE_URL}/functions/v1/`

---

## 2. Endpoints

### 2.1 support-ticket-create

**Descrição:** Criar novo ticket com SLA auto-calculado.

| Item | Valor |
|------|-------|
| Método | POST |
| URL | `/functions/v1/support-ticket-create` |
| Auth | Bearer Token |
| Nível mínimo | 1 (Cliente) |

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
  "user_id": "5",
  "user_name": "João Silva",
  "user_level": 1
}
```

**Resposta:**

```json
{
  "success": true,
  "data": { "id": "uuid", "public_code": "TIC-2026-000045" }
}
```

---

### 2.2 support-ticket-list

**Descrição:** Listar tickets com filtros, paginação e visibilidade baseada em nível.

| Item | Valor |
|------|-------|
| Método | POST |
| URL | `/functions/v1/support-ticket-list` |
| Auth | Bearer Token |
| Nível mínimo | 1 |

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
  "user_id": "5",
  "user_email": "analista@open.com",
  "user_level": 900
}
```

**Resposta:**

```json
{
  "success": true,
  "data": [{ "id": "uuid", "public_code": "TIC-2026-000045", "..." : "..." }],
  "meta": { "current_page": 1, "per_page": 25, "total": 142, "last_page": 6 }
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

| Ação | Nível mínimo | Descrição |
|------|-------------|-----------|
| `assign` | 900 | Atribuir a analista |
| `start` | 900 | Iniciar atendimento |
| `escalate` | 900 | Escalar para N2/N3 |
| `resolve` | 900 | Resolver tecnicamente |
| `close` | 775 | Encerrar definitivamente (CS) |
| `reopen` | 775 | Reabrir ticket |
| `cancel` | 950 | Cancelar ticket |
| `transfer` | 950 | Transferir entre filas |

**Payload (exemplo: assign):**

```json
{
  "ticket_id": "uuid",
  "action": "assign",
  "assigned_to_user_id": "uuid",
  "assigned_to_name": "Maria Santos",
  "user_id": "5",
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
  "author_user_id": "uuid",
  "author_name": "Analista",
  "author_type": "support",
  "user_level": 900
}
```

**Payload (listar):**

```json
{
  "action": "list",
  "ticket_id": "uuid",
  "user_level": 900
}
```

---

### 2.6 support-ticket-upload

**Descrição:** Upload de anexos ao ticket.

| Item | Valor |
|------|-------|
| Método | POST |
| URL | `/functions/v1/support-ticket-upload` |
| Auth | Bearer Token |
| Content-Type | multipart/form-data |

**Campos:**

| Campo | Tipo | Obrigatório |
|-------|------|-------------|
| `file` | File | Sim |
| `ticket_id` | string | Sim |
| `is_internal` | boolean | Não |
| `user_id` | string | Sim |
| `user_name` | string | Sim |

---

### 2.7 support-sla-admin

**Descrição:** CRUD de políticas de SLA.

| Item | Valor |
|------|-------|
| Método | POST |
| URL | `/functions/v1/support-sla-admin` |
| Auth | Bearer Token |
| Nível mínimo | 950 |

**Ações:** `list`, `create`, `update`, `delete`

---

### 2.8 support-queue-admin

**Descrição:** Gestão de membros das filas.

| Item | Valor |
|------|-------|
| Método | POST |
| URL | `/functions/v1/support-queue-admin` |
| Auth | Bearer Token |
| Nível mínimo | 900 (leitura), 950 (escrita) |

**Ações:** `list_queues`, `list_members`, `add_member`, `remove_member`, `update_member`

---

### 2.9 support-dashboard-stats

**Descrição:** KPIs operacionais do NOC.

| Item | Valor |
|------|-------|
| Método | POST |
| URL | `/functions/v1/support-dashboard-stats` |
| Auth | Bearer Token |
| Nível mínimo | 775 |

**Resposta:**

```json
{
  "success": true,
  "data": {
    "open_tickets": 42,
    "sla_compliant": 38,
    "sla_breached": 4,
    "critical_incidents": 2,
    "by_queue": { "N1": 15, "N2": 12, "N3": 8, "CS": 7 },
    "avg_first_response_minutes": 22,
    "avg_resolution_minutes": 180
  }
}
```

---

### 2.10 support-ticket-ingest

**Descrição:** Ingestão de tickets de sistemas externos (Zabbix, API).

| Item | Valor |
|------|-------|
| Método | POST |
| URL | `/functions/v1/support-ticket-ingest` |
| Auth | Bearer Token |

---

## 3. Códigos de Erro

| Código | Descrição |
|--------|-----------|
| 401 | Token inválido ou expirado |
| 403 | Nível insuficiente para a ação |
| 404 | Ticket não encontrado |
| 422 | Dados inválidos |
| 500 | Erro interno |

---

## 4. Padrão de Resposta

```json
{
  "success": true | false,
  "data": { ... },
  "message": "Descrição do erro",
  "errors": ["detalhe1", "detalhe2"],
  "meta": { "current_page": 1, "per_page": 25, "total": 100 }
}
```
