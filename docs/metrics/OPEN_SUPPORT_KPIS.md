# OPEN — KPIs do Suporte Técnico

Versão: v1  
Sistema: core.opendata.center  
Última atualização: 2026-03-15

---

## 1. Visão Geral

Os KPIs do suporte técnico são calculados pela Edge Function `support-dashboard-stats` e exibidos no dashboard NOC (`/modulos/atendimentos`). Atualização automática a cada 60 segundos via React Query.

---

## 2. Indicadores Principais

### 2.1 Volume

| Indicador | Fórmula | Meta |
|-----------|---------|------|
| Tickets abertos | COUNT WHERE status NOT IN (encerrado_cs, cancelado) | — |
| Tickets criados hoje | COUNT WHERE created_at >= hoje | — |
| Tickets resolvidos hoje | COUNT WHERE resolved_at >= hoje | — |
| Tickets encerrados hoje | COUNT WHERE closed_at >= hoje | — |
| Backlog | Tickets abertos há mais de 7 dias | < 10% |

### 2.2 SLA

| Indicador | Fórmula | Meta |
|-----------|---------|------|
| SLA cumprido (1ª resposta) | % WHERE first_response_at <= first_response_due_at | > 95% |
| SLA cumprido (resolução) | % WHERE resolved_at <= resolution_due_at | > 90% |
| SLA violado (1ª resposta) | % WHERE first_response_at > first_response_due_at OR (first_response_at IS NULL AND now() > first_response_due_at) | < 5% |
| SLA violado (resolução) | % WHERE now() > resolution_due_at AND resolved_at IS NULL | < 10% |

### 2.3 Tempos Médios

| Indicador | Fórmula | Meta |
|-----------|---------|------|
| Tempo médio 1ª resposta | AVG(first_response_at - created_at) | < 30 min |
| Tempo médio resolução | AVG(resolved_at - created_at) | < 4h |
| Tempo médio encerramento | AVG(closed_at - resolved_at) | < 2h |

### 2.4 Distribuição

| Indicador | Descrição |
|-----------|-----------|
| Por fila | Volume por N1, N2, N3, CS |
| Por severidade | Volume por S1, S2, S3, S4 |
| Por tipo | Volume por incidente, solicitação, dúvida, etc. |
| Por analista | Tickets atribuídos por analista |
| Por empresa | Tickets por cliente |

---

## 3. Indicadores por Severidade

### 3.1 S1 — Crítico

| Indicador | Meta |
|-----------|------|
| 1ª resposta | < 15 min |
| Resolução | < 2h |
| Regime | 24×7 |
| Incidentes ativos | Destaque no dashboard |

### 3.2 S2 — Alto

| Indicador | Meta |
|-----------|------|
| 1ª resposta | < 30 min |
| Resolução | < 4h |
| Regime | 24×7 |

### 3.3 S3 — Médio

| Indicador | Meta |
|-----------|------|
| 1ª resposta | < 60 min |
| Resolução | < 8h |
| Regime | 24×7 |

### 3.4 S4 — Baixo

| Indicador | Meta |
|-----------|------|
| 1ª resposta | < 4h |
| Resolução | < 24h |
| Regime | Horário comercial |

---

## 4. Indicadores de Equipe

| Indicador | Descrição |
|-----------|-----------|
| Capacidade N1 | Analistas ativos na fila N1 |
| Capacidade N2 | Analistas ativos na fila N2 |
| Capacidade N3 | Analistas ativos na fila N3 |
| Capacidade CS | Membros CS ativos |
| Taxa de escalonamento | % de tickets escalados de N1 para N2/N3 |
| Taxa de reabertura | % de tickets reabertos após resolução |

---

## 5. Indicadores de Cliente

| Indicador | Descrição |
|-----------|-----------|
| Tickets por empresa | Volume de tickets por cliente |
| Reincidência | Tickets sobre o mesmo ativo/problema |
| Satisfação | Futuro: pesquisa pós-encerramento |
| Health Score | Score calculado com base em volume, SLA e reincidência |

---

## 6. Dashboard NOC

### 6.1 Componentes

| Componente | Indicadores |
|------------|------------|
| `SLAKPICards` | Tickets abertos, dentro do SLA, fora do SLA, incidentes críticos |
| `QueueDistributionCard` | Volume por fila N1/N2/N3/CS |
| `ResponseTimeCard` | Tempo médio 1ª resposta e resolução |
| `OnCallWidget` | Plantonistas ativos por time |

### 6.2 Fonte de Dados

Edge Function: `support-dashboard-stats`

Polling: React Query (intervalo 60s)

---

## 7. Relatórios (Futuro)

| Relatório | Frequência | Destinatário |
|-----------|-----------|-------------|
| SLA Semanal | Semanal | Gerente Suporte |
| Volume Mensal | Mensal | Diretoria |
| Análise de Incidentes | Por incidente S1/S2 | Equipe técnica |
| Performance por Analista | Mensal | Gerente Suporte |
| Health Score por Cliente | Mensal | CS |

---

## 8. Alertas (Futuro)

| Alerta | Condição | Destinatário |
|--------|----------|-------------|
| SLA próximo de vencer | 80% do prazo | Analista + Gerente |
| SLA violado | Prazo excedido | Gerente + Admin |
| Incidente S1 aberto | Novo S1 criado | Plantonista + Gerente |
| Backlog alto | > 20 tickets abertos há 7+ dias | Gerente |
| Taxa de escalonamento alta | > 40% dos tickets escalados | Gerente |
