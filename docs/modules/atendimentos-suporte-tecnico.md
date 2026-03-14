# Módulo: Sistema de Chamados — Suporte Técnico

> Rota: `/modulos/atendimentos/suporte-tecnico`  
> Status: **MVP implementado (backend)**  
> Última atualização: 2026-03-14

---

## 1. Visão Geral

Sistema de chamados (tickets) do CORE da OPEN, Supabase-first.  
Substitui gradualmente o legado. Preparado para integração futura com Zabbix.

---

## 2. Papéis e Permissões

| Papel | Level | Capacidades |
|-------|-------|-------------|
| Cliente | 1 | Abre chamados, acompanha, solicita encerramento, vê apenas próprios tickets |
| Usuário interno | ≥ 600 | Abre chamados internos |
| CS | 775 | Valida resolução, encerra oficialmente, reabre, comentários, notas internas |
| Suporte | 900 | Assume, trata, escala, resolve, comentários, notas internas |
| Gerente Suporte | 950 | Atribuição, transferência, cancelamento, override de prioridade |
| Admin | 1000 | Acesso total, parametriza SLA |

### Matriz de Permissões

| Permissão | Cliente | CS (775) | Suporte (900) | Gerente (950) | Admin (1000) |
|-----------|---------|----------|---------------|---------------|--------------|
| view_own_tickets | ✅ | ✅ | ✅ | ✅ | ✅ |
| create_ticket | ✅ | ✅ | ✅ | ✅ | ✅ |
| add_ticket_message | ✅ | ✅ | ✅ | ✅ | ✅ |
| upload_ticket_attachment | ✅ | ✅ | ✅ | ✅ | ✅ |
| view_team_tickets | ❌ | ✅ | ✅ | ✅ | ✅ |
| assign_tickets | ❌ | ❌ | ✅ | ✅ | ✅ |
| escalate_tickets | ❌ | ❌ | ✅ | ✅ | ✅ |
| resolve_tickets | ❌ | ❌ | ✅ | ✅ | ✅ |
| close_tickets | ❌ | ✅ | ❌ | ✅ | ✅ |
| reopen_tickets | ❌ | ✅ | ❌ | ✅ | ✅ |
| transfer_tickets | ❌ | ❌ | ❌ | ✅ | ✅ |
| manage_sla_policies | ❌ | ❌ | ❌ | ✅ | ✅ |
| manage_ticket_catalogs | ❌ | ❌ | ❌ | ❌ | ✅ |
| view_ticket_audit | ❌ | ✅ | ✅ | ✅ | ✅ |
| cancel_tickets | ❌ | ❌ | ❌ | ✅ | ✅ |

---

## 3. Fluxo de Status

```
NOVO → TRIAGEM → EM_ATENDIMENTO → AGUARDANDO_CLIENTE → RESOLVIDO_SUPORTE → ENCERRADO_CS
           ↓                            ↑
        ESCALADO_N2/N3 ────────────────┘
           ↓
        REABERTO ──→ (volta para fila operacional)
```

| Status | Descrição | Quem altera |
|--------|-----------|-------------|
| `novo` | Recém-criado | Sistema |
| `triagem` | Sendo classificado | N1 assume |
| `em_atendimento` | Em tratamento ativo | Suporte |
| `aguardando_cliente` | Pendente resposta do cliente | Suporte |
| `aguardando_terceiro` | Pendente resposta de terceiro | Suporte |
| `escalado_n2` | Escalado para N2 | Suporte |
| `escalado_n3` | Escalado para N3 | Suporte/Gerente |
| `resolvido_suporte` | Resolvido, aguardando validação CS | Suporte |
| `encerrado_cs` | Fechamento oficial | CS |
| `reaberto` | Reaberto após fechamento | CS/Gerente |
| `cancelado` | Cancelado | Gerente/Admin |

---

## 4. Tipos de Chamado

| Tipo | Descrição |
|------|-----------|
| `incidente` | Falha ou degradação em serviço ativo |
| `solicitacao` | Pedido de ação |
| `duvida` | Pergunta técnica ou operacional |
| `alteracao` | Mudança em configuração existente |
| `financeiro` | Questão de faturamento, NF, cobrança |

---

## 5. Severidade e SLA

| Severidade | Descrição | Contagem SLA | Primeira Resposta | Resolução |
|------------|-----------|--------------|-------------------|-----------|
| **S1** | Crítico | 24×7 | 15 min | 2h |
| **S2** | Alto | 24×7 | 30 min | 4h |
| **S3** | Médio | 24×7 | 60 min | 8h |
| **S4** | Baixo | Horário comercial | 4h | 24h |

SLA baseado na combinação de: Severidade × Tipo × Plano do Cliente.

---

## 6. Escalonamento

| Nível | Fila | Responsabilidade |
|-------|------|-----------------|
| **N1** | N1 | Triagem, primeiro atendimento, resolução básica |
| **N2** | N2 | Análise técnica aprofundada, infraestrutura |
| **N3** | N3 | Engenharia, arquitetura, vendor escalation |
| **CS** | CS | Validação e fechamento |

---

## 7. Modelo de Dados

### Tabelas Principais

| Tabela | Descrição |
|--------|-----------|
| `support_tickets` | Tickets principais |
| `support_ticket_messages` | Mensagens e notas internas |
| `support_ticket_attachments` | Anexos de arquivos |
| `support_ticket_assignments` | Histórico de atribuições/transferências |
| `support_ticket_status_history` | Histórico de mudanças de status |
| `support_ticket_watchers` | Observadores do ticket |
| `support_ticket_events` | Eventos canônicos (append-only) |
| `support_sla_policies` | Políticas de SLA parametrizáveis |
| `support_catalog_categories` | Catálogo de categorias |
| `support_catalog_services` | Catálogo de serviços |

### Enums

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

- Bucket: `support-ticket-files` (privado)
- Path: `{ticket_id}/{filename}`

---

## 8. Edge Functions

| Função | Método | Descrição |
|--------|--------|-----------|
| `support-ticket-create` | POST | Criar ticket com SLA auto-calculado |
| `support-ticket-list` | POST | Listar com filtros, paginação, visibilidade por papel |
| `support-ticket-get` | POST | Buscar ticket completo (mensagens, anexos, histórico) |
| `support-ticket-update` | POST | Ações: assign, start, escalate, resolve, close, reopen, cancel, waiting, transfer |
| `support-ticket-messages` | POST | Adicionar mensagem ou nota interna |
| `support-sla-admin` | POST | CRUD de políticas SLA (admin/gerência) |

### Padrão de Resposta

```json
{
  "success": true,
  "data": { ... },
  "message": "Operação realizada",
  "meta": { "current_page": 1, "per_page": 25, "total": 100 }
}
```

---

## 9. Eventos do Módulo

| Evento | Gatilho |
|--------|---------|
| `ticket.created` | Ticket criado |
| `ticket.status_changed` | Mudança de status |
| `ticket.assigned` | Ticket atribuído |
| `ticket.transferred` | Ticket transferido entre filas |
| `ticket.escalated` | Escalado para N2/N3 |
| `ticket.resolved` | Resolvido pelo suporte |
| `ticket.closed` | Encerrado pelo CS |
| `ticket.reopened` | Ticket reaberto |
| `ticket.cancelled` | Ticket cancelado |
| `ticket.message_added` | Mensagem adicionada |
| `ticket.attachment_uploaded` | Anexo enviado |
| `ticket.sla_breached` | SLA violado (futuro: cron) |

---

## 10. Regras de Negócio

- Suporte resolve, mas **não** encerra definitivamente
- CS faz o fechamento final
- Reabertura retorna o ticket para a fila operacional
- Notas internas (`is_internal_note=true`) **nunca** visíveis para clientes
- Cliente respondendo em `aguardando_cliente` move ticket para `em_atendimento`
- Primeira resposta interna (não interna note) registra `first_response_at`
- SLA calculado automaticamente na criação via match de políticas

---

## 11. Preparação para Fase 2

- `origin_channel = 'zabbix'` pronto
- `source_system` e `external_reference` para deduplicação
- `metadata` jsonb para dados arbitrários de integração
- Estrutura de eventos compatível com futuro `system_events`

---

## 12. RLS Strategy

- Todas as operações passam por Edge Functions com `SERVICE_ROLE_KEY` (bypass RLS)
- RLS fornece defense-in-depth: `is_support_internal()` permite SELECT para `tech_users`
- Mutações protegidas por lógica nas Edge Functions (validação de `user_level`)
- Clientes acessam apenas via Edge Functions (auth híbrida Laravel + Supabase)

---

## 13. Próximos Passos (Prompt 3)

1. **UI**: Tela de listagem de tickets com filtros
2. **UI**: Formulário de abertura de ticket
3. **UI**: Detalhe do ticket com timeline de mensagens
4. **UI**: Painel de filas (N1, N2, N3, CS)
5. **Service Layer**: `supportTicketService.ts` para frontend
6. **Hook**: `useSupportTickets.ts` com React Query
7. **Upload**: Edge Function `support-ticket-upload` para anexos
8. **SLA Dashboard**: Indicadores de SLA em tempo real
