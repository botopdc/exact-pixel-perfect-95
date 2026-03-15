# OPEN — Runbook do Suporte Técnico

Versão: v1  
Sistema: core.opendata.center  
Última atualização: 2026-03-15

---

## 1. Objetivo

Procedimentos operacionais para a equipe de suporte técnico da OPEN Datacenter. Este runbook cobre operações N1, N2, N3 e procedimentos para incidentes críticos.

---

## 2. Operação N1 — Primeiro Atendimento

### 2.1 Responsabilidades

- Receber e classificar novos chamados
- Validar dados do cliente e ativo
- Realizar diagnóstico inicial
- Resolver chamados de complexidade baixa
- Escalar para N2 quando necessário

### 2.2 Procedimento de Classificação

1. **Verificar dados do solicitante** — nome, empresa, contato
2. **Identificar o ativo afetado** — servidor, serviço, rede
3. **Classificar severidade** — S1 (crítico) a S4 (baixo)
4. **Classificar tipo** — incidente, solicitação, dúvida, alteração, financeiro
5. **Aplicar categoria do catálogo** — infra, rede, cloud, backup, etc.
6. **Registrar descrição detalhada** — sintomas, impacto, horário de início

### 2.3 Checklist de Triagem

- [ ] Dados do cliente validados
- [ ] Ativo identificado
- [ ] Severidade definida
- [ ] Categoria aplicada
- [ ] SLA calculado automaticamente
- [ ] Ticket atribuído a analista ou fila

### 2.4 Critérios de Escalonamento para N2

| Condição | Ação |
|----------|------|
| Problema requer acesso à infraestrutura | Escalar N2 |
| Análise de logs complexa necessária | Escalar N2 |
| Sem resolução em 50% do SLA | Escalar N2 |
| Cliente solicita engenheiro sênior | Escalar N2 |

---

## 3. Operação N2 — Análise Técnica

### 3.1 Responsabilidades

- Análise técnica aprofundada
- Verificação de logs e métricas
- Interação com infraestrutura (VMs, storage, rede)
- Aplicação de correções e workarounds
- Escalar para N3 quando necessário

### 3.2 Procedimento de Análise

1. **Revisar histórico do ticket** — mensagens, eventos, timeline
2. **Verificar logs do sistema** — aplicação, SO, rede
3. **Analisar métricas** — CPU, RAM, disco, throughput
4. **Identificar causa raiz** — ou causa provável
5. **Aplicar correção** — reinício, reconfiguração, patch
6. **Documentar ações** — registrar em notas internas
7. **Comunicar cliente** — mensagem pública com status

### 3.3 Critérios de Escalonamento para N3

| Condição | Ação |
|----------|------|
| Problema em arquitetura ou vendor | Escalar N3 |
| Falha em componente de hardware | Escalar N3 |
| Bug confirmado em plataforma | Escalar N3 |
| Incidente afeta múltiplos clientes | Escalar N3 |

---

## 4. Operação N3 — Engenharia

### 4.1 Responsabilidades

- Correção estrutural de problemas
- Interação com fornecedores (vendor escalation)
- Mudanças de arquitetura
- Abertura de incidentes críticos
- Post-mortem de incidentes graves

### 4.2 Procedimento

1. **Revisar análise do N2** — diagnóstico e ações já tomadas
2. **Avaliar impacto** — clientes afetados, serviços degradados
3. **Contatar vendor** (se necessário) — abrir ticket com fabricante
4. **Implementar correção** — com validação em ambiente de staging
5. **Validar resolução** — com cliente e equipe
6. **Documentar causa raiz** — no campo `resolution_summary`

---

## 5. Procedimentos para Incidentes Críticos (S1/S2)

### 5.1 SLA

| Severidade | 1ª Resposta | Resolução | Regime |
|------------|-------------|-----------|--------|
| S1 | 15 min | 2h | 24×7 |
| S2 | 30 min | 4h | 24×7 |

### 5.2 Ações Imediatas

1. **Notificar plantonista** — verificar `support_oncall`
2. **Comunicar gerente de suporte** — nível 950+
3. **Atribuir analista imediatamente** — não deixar na fila
4. **Iniciar bridge call** (se necessário) — reunir equipe
5. **Atualizar status a cada 30min** — mensagem pública
6. **Registrar timeline detalhada** — todas as ações em notas internas

### 5.3 Post-Mortem

Para todo incidente S1 e S2 resolvido:

1. Criar documento de post-mortem
2. Registrar: timeline, causa raiz, impacto, ações corretivas
3. Compartilhar com equipe
4. Implementar ações preventivas

---

## 6. Gestão de SLA

### 6.1 Cálculo

O SLA é calculado automaticamente na criação do ticket pela Edge Function `support-ticket-create`:

1. Buscar política SLA por severidade + tipo + categoria
2. Calcular `first_response_due_at` = `created_at` + `first_response_minutes`
3. Calcular `resolution_due_at` = `created_at` + `resolution_minutes`
4. Se `business_hours_only`, considerar apenas horário comercial

### 6.2 Monitoramento

- Dashboard NOC exibe SLA em tempo real
- Badge `TicketSlaBadge` com contagem regressiva
- Filtro "SLA Vencido" na listagem
- Alertas visuais para tickets próximos do prazo

### 6.3 Pausas de SLA

| Status | SLA Pausado? |
|--------|-------------|
| `aguardando_cliente` | Sim (se configurado na política) |
| `aguardando_terceiro` | Sim (se configurado na política) |
| Demais | Não |

---

## 7. Gestão de Filas

### 7.1 Filas Operacionais

| Fila | Código | Função |
|------|--------|--------|
| Nível 1 | N1 | Primeiro atendimento |
| Nível 2 | N2 | Análise técnica |
| Nível 3 | N3 | Engenharia |
| Customer Success | CS | Validação e encerramento |

### 7.2 Transferência entre Filas

1. Selecionar fila destino
2. Informar motivo da transferência
3. Sistema registra em `support_ticket_queue_history`
4. Notificações enviadas para membros da fila destino
5. Ticket aparece na listagem da nova fila

---

## 8. Plantão

### 8.1 Configuração

Tabela `support_oncall` — gerenciada por Gerente de Suporte (950+).

| Campo | Descrição |
|-------|-----------|
| `team` | Infra, Cloud, CS |
| `user_name` | Plantonista |
| `start_at` / `end_at` | Período |
| `is_active` | Ativo |

### 8.2 Responsabilidades do Plantonista

- Monitorar notificações
- Responder a incidentes S1/S2 imediatamente
- Escalar se necessário
- Registrar ações no ticket

---

## 9. Troubleshooting Comum

### 9.1 Ticket não aparece na listagem

- Verificar se o usuário é membro da fila do ticket (`support_queue_members`)
- Verificar `user_email` na tabela de membros
- Gerentes (950+) e Admins (1000) veem todos

### 9.2 SLA não calculado

- Verificar se existe política SLA ativa para a combinação severidade/tipo
- Verificar logs da Edge Function `support-ticket-create`

### 9.3 Notificação não recebida

- Verificar se o usuário é membro ativo da fila
- Verificar polling do frontend (30-60s)
- Verificar tabela `support_notifications`

### 9.4 Erro ao atribuir ticket

- Verificar permissão do usuário (nível 900+)
- Verificar se o ticket não está em status terminal (`encerrado_cs`, `cancelado`)
