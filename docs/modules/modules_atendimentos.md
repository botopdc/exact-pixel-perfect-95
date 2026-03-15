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

Este módulo funciona como o **NOC operacional da OPEN**.

---

## 2. Estrutura do módulo

### Menu principal

**ATENDIMENTOS** (`/modulos/atendimentos`)

### Submódulos

| Submódulo | Rota | Descrição |
|-----------|------|-----------|
| **Visão Geral** | `/modulos/atendimentos` | Dashboard operacional com KPIs em tempo real, SLA, distribuição de filas, plantão ativo e tempos médios |
| **Analistas** | `/modulos/atendimentos/analistas` | Gestão de analistas de suporte, membros das filas N1/N2/N3/CS |
| **Suporte Técnico** | `/modulos/atendimentos/suporte-tecnico` | Sistema de chamados principal — listagem, filtros, criação, detalhe e ações |
| **Customer Success** | `/modulos/atendimentos/cs` | Validação de resolução, encerramento definitivo, health score de clientes |
| **KPIs de Atendimento** | `/modulos/atendimentos/kpis` | Métricas operacionais: SLA, tempos médios, volume, distribuição |

---

## 3. Visão Geral do NOC

A tela principal funciona como dashboard operacional em tempo real.

### SLA Hoje

| Indicador | Descrição |
|-----------|-----------|
| Tickets abertos | Total de chamados em andamento |
| Dentro do SLA | Chamados dentro do prazo contratado |
| Fora do SLA | Chamados que violaram o SLA |
| Incidentes críticos | Chamados S1/S2 ativos |

### Distribuição de Filas

| Fila | Responsabilidade |
|------|-----------------|
| N1 | Triagem e primeiro atendimento |
| N2 | Análise técnica e infraestrutura |
| N3 | Engenharia e vendor escalation |
| CS | Validação e encerramento |

### Plantão Ativo

Fonte: tabela `support_oncall` — analistas ativos por time (Infra, Cloud, CS).

### Tempo Médio

- Primeira resposta
- Resolução

Atualização automática via React Query (60s). Edge Function: `support-dashboard-stats`.

---

## 4. Tipos de atendimento

### Níveis de suporte

| Nível | Fila | Responsabilidade |
|-------|------|-----------------|
| **N1** | N1 | Triagem, primeiro atendimento, resolução básica |
| **N2** | N2 | Análise técnica aprofundada, infraestrutura |
| **N3** | N3 | Engenharia, arquitetura, vendor escalation |
| **CS** | CS | Validação e fechamento |

### Tipos de chamado

| Tipo | Descrição |
|------|-----------|
| `incidente` | Falha ou degradação em serviço ativo |
| `solicitacao` | Pedido de ação |
| `duvida` | Pergunta técnica ou operacional |
| `alteracao` | Mudança em configuração existente |
| `financeiro` | Questão de faturamento, NF, cobrança |

---

## 5. Estrutura de tickets

### Campos principais

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | Identificador interno |
| `public_code` | string | Código público (TIC-YYYY-NNNNNN) |
| `title` | string | Título do chamado |
| `description` | text | Descrição detalhada |
| `severity` | enum | S1, S2, S3, S4 |
| `priority` | enum | critical, high, medium, low |
| `status` | enum | Status atual |
| `current_queue_id` | UUID | Fila atual |
| `assigned_to_user_id` | string | Responsável |
| `origin_channel` | enum | Canal de origem |

### Severidades e SLA

| Severidade | Contagem SLA | 1ª Resposta | Resolução |
|------------|-------------|-------------|-----------|
| **S1** Crítico | 24×7 | 15 min | 2h |
| **S2** Alto | 24×7 | 30 min | 4h |
| **S3** Médio | 24×7 | 60 min | 8h |
| **S4** Baixo | Comercial | 4h | 24h |

### Prioridades

| Prioridade | Descrição |
|------------|-----------|
| P1 — Crítico | Serviço indisponível, impacto total |
| P2 — Alto | Degradação severa, workaround limitado |
| P3 — Médio | Impacto parcial, workaround disponível |
| P4 — Baixo | Informacional, sem impacto direto |

### Status possíveis

| Status | Quem altera |
|--------|-------------|
| `novo` | Sistema |
| `triagem` | N1 assume |
| `em_atendimento` | Suporte |
| `aguardando_cliente` | Suporte |
| `aguardando_terceiro` | Suporte |
| `escalado_n2` | Suporte |
| `escalado_n3` | Suporte/Gerente |
| `resolvido_suporte` | Suporte |
| `encerrado_cs` | CS |
| `reaberto` | CS/Gerente |
| `cancelado` | Gerente/Admin |

---

## 6. Fluxo de atendimento

```
NOVO → TRIAGEM → EM_ATENDIMENTO → AGUARDANDO_CLIENTE → RESOLVIDO_SUPORTE → ENCERRADO_CS
           ↓                            ↑
        ESCALADO_N2/N3 ────────────────┘
           ↓
        REABERTO ──→ (volta para fila operacional)
```

### Eventos registrados

| Evento | Gatilho |
|--------|---------|
| `ticket.created` | Ticket criado |
| `ticket.status_changed` | Mudança de status |
| `ticket.assigned` | Ticket atribuído |
| `ticket.transferred` | Transferido entre filas |
| `ticket.escalated` | Escalado para N2/N3 |
| `ticket.resolved` | Resolvido pelo suporte |
| `ticket.closed` | Encerrado pelo CS |
| `ticket.reopened` | Reaberto |
| `ticket.cancelled` | Cancelado |
| `ticket.message_added` | Mensagem adicionada |
| `ticket.attachment_uploaded` | Anexo enviado |
| `ticket.sla_breached` | SLA violado (futuro: cron) |

Padrão: `entity.action` — registrados em `support_ticket_events` (append-only).

---

## 7. Integrações do módulo

| Canal | Status | Descrição |
|-------|--------|-----------|
| Portal do Cliente | ✅ | `/portal/tickets` |
| Portal Interno | ✅ | `/modulos/atendimentos/suporte-tecnico` |
| API | ✅ | Edge Functions |
| Email | 🔜 | Futuro |
| Zabbix | 🔜 | `origin_channel = 'zabbix'` preparado |
| WhatsApp | 🔜 | Planejado |

---

## 8. RBAC do módulo

| Papel | Level | Capacidades |
|-------|-------|-------------|
| Cliente | 1 | Abre chamados, acompanha, vê apenas próprios tickets (`/portal/tickets`) |
| Parceiro | 200 | Sem acesso ao módulo |
| RH | 600 | Pode abrir chamados internos |
| CS | 775 | Valida resolução, encerra, reabre, notas internas |
| Suporte | 900 | Assume, trata, escala, resolve, notas internas |
| Gerente Suporte | 950 | Atribuição, transferência, cancelamento, visão global |
| Admin | 1000 | Acesso total, parametriza SLA, gerencia catálogos |

### Matriz de permissões

| Permissão | Cliente | CS (775) | Suporte (900) | Gerente (950) | Admin (1000) |
|-----------|---------|----------|---------------|---------------|--------------|
| Abrir chamado | ✅ | ✅ | ✅ | ✅ | ✅ |
| Ver próprios tickets | ✅ | ✅ | ✅ | ✅ | ✅ |
| Ver tickets da equipe | ❌ | ✅ | ✅ | ✅ | ✅ |
| Atribuir tickets | ❌ | ❌ | ✅ | ✅ | ✅ |
| Escalar tickets | ❌ | ❌ | ✅ | ✅ | ✅ |
| Resolver tickets | ❌ | ❌ | ✅ | ✅ | ✅ |
| Encerrar tickets | ❌ | ✅ | ❌ | ✅ | ✅ |
| Reabrir tickets | ❌ | ✅ | ❌ | ✅ | ✅ |
| Transferir filas | ❌ | ❌ | ❌ | ✅ | ✅ |
| Gerenciar SLA | ❌ | ❌ | ❌ | ✅ | ✅ |
| Cancelar tickets | ❌ | ❌ | ❌ | ✅ | ✅ |

---

## 9. Roadmap do módulo

| Funcionalidade | Status |
|----------------|--------|
| Automação de SLA (cron) | Planejado |
| Auto classificação de tickets | Planejado |
| IA para triagem | Planejado |
| Integração Zabbix | Preparado |
| Correlação de incidentes | Planejado |
| Sugestão de solução | Planejado |
| Integração Email | Planejado |
| Relatórios avançados | Planejado |

---

## 10. Documentos complementares

| Documento | Arquivo |
|-----------|---------|
| Arquitetura do Suporte | `docs/architecture/OPEN_SUPPORT_ARCHITECTURE.md` |
| Modelo de Dados | `docs/data/OPEN_SUPPORT_DATA_MODEL.md` |
| RBAC do Suporte | `docs/security/OPEN_SUPPORT_RBAC.md` |
| API Reference | `docs/api/OPEN_SUPPORT_API_REFERENCE.md` |
| Runbook Operacional | `docs/runbooks/OPEN_SUPPORT_RUNBOOK.md` |
| KPIs do Suporte | `docs/metrics/OPEN_SUPPORT_KPIS.md` |
