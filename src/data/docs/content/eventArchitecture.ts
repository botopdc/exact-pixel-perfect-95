export const OPEN_EVENT_ARCHITECTURE_CONTENT = `# OPEN Event Architecture

Versão: v1

---

# 1. Objetivo da arquitetura de eventos

A plataforma OPEN utiliza eventos para registrar atividades importantes do sistema de forma persistente, imutável e rastreável.

Eventos são usados para:

| Finalidade | Descrição |
|---|---|
| **Auditoria** | Rastrear quem fez o quê e quando |
| **Rastreamento de ações** | Registrar interações de usuários e clientes |
| **Histórico de acesso** | Saber quem visualizou propostas, contratos e documentos |
| **Análise de comportamento** | Entender padrões de uso da plataforma |
| **Debugging** | Reconstruir sequência de ações que levou a um problema |
| **Automações futuras** | Disparar ações automáticas baseadas em eventos |

Eventos permitem responder perguntas como:

- Quem abriu a proposta \`PROP-2026-0042\`?
- Quantas vezes a proposta foi visualizada antes da aprovação?
- Quando o contrato foi assinado e por quem?
- Quem alterou a comissão de um executivo?
- Quais ações um determinado usuário executou nas últimas 24 horas?
- Qual o tempo médio entre envio e aprovação de propostas?

---

# 2. Conceito de evento

Um evento representa **algo que aconteceu no sistema** em um momento específico.

Exemplos:

- Proposta foi criada
- PDF foi baixado
- Email foi enviado
- Contrato foi assinado
- Usuário foi criado
- Permissão foi alterada

### Propriedades fundamentais

1. **Imutáveis** — uma vez registrados, eventos nunca devem ser alterados ou excluídos
2. **Append-only** — novos eventos são sempre adicionados, nunca substituem anteriores
3. **Timestamped** — todo evento possui timestamp real da ocorrência
4. **Contextualizados** — contêm informação suficiente para reconstruir a ação
5. **Independentes** — não dependem de estado transitório (localStorage, sessão)

---

# 3. Estrutura padrão de evento

Todos os eventos devem seguir uma estrutura padronizada para garantir consistência e permitir consultas uniformes.

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| \`id\` | uuid | Sim | Identificador único do evento |
| \`event_name\` | text | Sim | Nome padronizado no formato \`entity.action\` |
| \`entity\` | text | Sim | Tipo da entidade afetada (proposal, contract, user) |
| \`entity_id\` | uuid | Sim | ID da entidade afetada |
| \`actor_type\` | text | Sim | Tipo do ator: \`user\`, \`system\`, \`client\`, \`webhook\` |
| \`actor_id\` | uuid | Não | ID do ator quando é usuário interno |
| \`user_id\` | uuid | Não | ID do usuário autenticado que executou a ação |
| \`client_email\` | text | Não | Email do cliente externo (quando aplicável) |
| \`ip_address\` | text | Não | Endereço IP de origem da requisição |
| \`user_agent\` | text | Não | User-Agent do navegador/cliente |
| \`metadata\` | jsonb | Não | Dados adicionais específicos do evento |
| \`occurred_at\` | timestamptz | Sim | Momento real em que a ação aconteceu |
| \`created_at\` | timestamptz | Sim | Momento em que o registro foi persistido |

### Diferença entre \`occurred_at\` e \`created_at\`

- \`occurred_at\` — quando a ação realmente aconteceu (pode ser retroativo)
- \`created_at\` — quando o registro foi inserido no banco (gerado automaticamente)

Na maioria dos casos, os dois valores serão iguais ou muito próximos.

---

# 4. Padrão de nomenclatura de eventos

Todos os eventos seguem o padrão:

\`\`\`
entity.action
\`\`\`

Onde:

- \`entity\` — nome da entidade em snake_case singular
- \`action\` — verbo no passado ou gerúndio descrevendo o que aconteceu

### Catálogo de eventos

#### Propostas

| Event Name | Descrição |
|---|---|
| \`proposal.created\` | Proposta criada |
| \`proposal.updated\` | Proposta editada |
| \`proposal.sent\` | Proposta enviada por email |
| \`proposal.view_public\` | Proposta visualizada por link público (cliente) |
| \`proposal.view_internal\` | Proposta visualizada internamente (executivo/gestor) |
| \`proposal.link_copied\` | Link da proposta copiado |
| \`proposal.email_sent\` | Email de proposta enviado |
| \`proposal.pdf_download\` | PDF da proposta baixado |
| \`proposal.approved\` | Proposta aprovada |
| \`proposal.rejected\` | Proposta recusada |
| \`proposal.expired\` | Proposta expirou |
| \`proposal.cancelled\` | Proposta cancelada |
| \`proposal.deleted\` | Proposta removida |

#### Contratos

| Event Name | Descrição |
|---|---|
| \`contract.created\` | Contrato criado |
| \`contract.generated\` | Documento do contrato gerado |
| \`contract.sent\` | Contrato enviado para assinatura |
| \`contract.signed\` | Contrato assinado |
| \`contract.cancelled\` | Contrato cancelado |
| \`contract.expired\` | Contrato expirou |

#### Usuários

| Event Name | Descrição |
|---|---|
| \`user.created\` | Usuário criado |
| \`user.updated\` | Dados do usuário alterados |
| \`user.deleted\` | Usuário desativado ou removido |
| \`user.login\` | Login realizado |
| \`user.login_failed\` | Tentativa de login falhou |
| \`user.logout\` | Logout realizado |
| \`user.password_reset\` | Senha redefinida |

#### Tickets

| Event Name | Descrição |
|---|---|
| \`ticket.created\` | Ticket aberto |
| \`ticket.assigned\` | Ticket atribuído a analista |
| \`ticket.escalated\` | Ticket escalado |
| \`ticket.resolved\` | Ticket resolvido |
| \`ticket.closed\` | Ticket encerrado |
| \`ticket.reopened\` | Ticket reaberto |

#### Incidentes

| Event Name | Descrição |
|---|---|
| \`incident.created\` | Incidente registrado |
| \`incident.classified\` | Incidente classificado |
| \`incident.escalated\` | Incidente escalado |
| \`incident.resolved\` | Incidente resolvido |
| \`incident.closed\` | Incidente encerrado |

#### Parceiros

| Event Name | Descrição |
|---|---|
| \`partner.created\` | Parceiro cadastrado |
| \`partner.updated\` | Dados do parceiro alterados |
| \`partner.deactivated\` | Parceiro desativado |

#### Sistema

| Event Name | Descrição |
|---|---|
| \`permission.changed\` | Permissão alterada |
| \`config.updated\` | Configuração do sistema alterada |
| \`commission.overridden\` | Comissão alterada manualmente |
| \`edge_function.executed\` | Edge Function executada |
| \`email.sent\` | Email enviado pelo sistema |
| \`storage.uploaded\` | Arquivo enviado para storage |
| \`docs.sync_executed\` | Sincronização de docs executada |

---

# 5. Categorias de eventos

## 5.1 Eventos de negócio

Representam ações com impacto direto na operação comercial e contratual.

| Evento | Impacto |
|---|---|
| \`proposal.created\` | Nova oportunidade comercial |
| \`proposal.approved\` | Conversão de proposta |
| \`proposal.rejected\` | Perda de oportunidade |
| \`contract.signed\` | Faturamento confirmado |
| \`contract.cancelled\` | Churn ou cancelamento |

Esses eventos são os mais importantes para dashboards e KPIs.

## 5.2 Eventos de acesso

Rastreamento de visualização e interação com entidades.

| Evento | Contexto |
|---|---|
| \`proposal.view_public\` | Cliente abriu link público da proposta |
| \`proposal.view_internal\` | Executivo ou gestor visualizou proposta no painel |
| \`proposal.link_copied\` | Link de proposta copiado para compartilhamento |
| \`proposal.pdf_download\` | PDF baixado |

Esses eventos alimentam o modal **"Histórico / Ver acessos"** no painel comercial.

## 5.3 Eventos de auditoria

Mudanças administrativas que devem ser rastreadas.

| Evento | Risco |
|---|---|
| \`user.created\` | Criação de acesso |
| \`user.deleted\` | Remoção de acesso |
| \`permission.changed\` | Alteração de privilégios |
| \`config.updated\` | Mudança de configuração |
| \`commission.overridden\` | Alteração de valor financeiro |

Esses eventos devem ser registrados também em \`audit_logs\` quando envolvem dados sensíveis.

## 5.4 Eventos operacionais

Eventos técnicos do sistema.

| Evento | Contexto |
|---|---|
| \`edge_function.executed\` | Execução de função no Supabase |
| \`email.sent\` | Envio de email transacional |
| \`storage.uploaded\` | Upload de arquivo |
| \`docs.sync_executed\` | Sincronização da documentação |

Úteis para monitoramento e debugging.

---

# 6. Eventos do módulo de propostas

O módulo de propostas é o domínio com maior volume e diversidade de eventos na OPEN.

## 6.1 Ciclo de vida da proposta e eventos

\`\`\`
┌─────────────────────────────────────────────────────────┐
│                  CICLO DE VIDA                          │
│                                                         │
│  proposal.created                                       │
│       │                                                 │
│       ▼                                                 │
│  proposal.updated (N vezes)                             │
│       │                                                 │
│       ▼                                                 │
│  proposal.sent ──► proposal.email_sent                  │
│       │                                                 │
│       ▼                                                 │
│  proposal.view_public (N vezes)                         │
│  proposal.link_copied (N vezes)                         │
│  proposal.pdf_download (N vezes)                        │
│       │                                                 │
│       ├──► proposal.approved ──► contract.created       │
│       │                                                 │
│       ├──► proposal.rejected                            │
│       │                                                 │
│       └──► proposal.expired                             │
└─────────────────────────────────────────────────────────┘
\`\`\`

## 6.2 Detalhamento por evento

### \`proposal.created\`

**Quando:** Executivo salva nova proposta na calculadora.

**Metadata esperada:**
\`\`\`json
{
  "channel_type": "CLIENTE",
  "company": "Empresa XYZ",
  "total": 15000.00,
  "currency": "BRL",
  "servers_count": 3,
  "addons_count": 2
}
\`\`\`

### \`proposal.sent\` / \`proposal.email_sent\`

**Quando:** Executivo envia proposta por email ao cliente.

**Metadata esperada:**
\`\`\`json
{
  "recipient_email": "cliente@empresa.com",
  "template": "proposal_v2",
  "proposal_display_id": "PROP-2026-0042"
}
\`\`\`

**Regra crítica:** Enviar email NÃO pode criar nova proposta. O evento é registrado contra a proposta existente.

### \`proposal.view_public\`

**Quando:** Cliente abre o link público da proposta.

**Metadata esperada:**
\`\`\`json
{
  "source": "public_link",
  "referrer": "https://mail.google.com"
}
\`\`\`

**Capturado por:** Edge Function \`proposal-track\` com ação \`track\`.

### \`proposal.approved\`

**Quando:** Cliente ou gestor aprova a proposta.

**Metadata esperada:**
\`\`\`json
{
  "approved_by_name": "João Silva",
  "approved_by_email": "joao@empresa.com",
  "approval_method": "public_link"
}
\`\`\`

---

# 7. Histórico de acesso das propostas

O painel comercial exibe um botão **"Histórico / Ver acessos"** (ícone BarChart3) em cada linha da listagem de propostas.

## 7.1 Fluxo de funcionamento

1. Usuário clica no botão de histórico
2. Modal \`ProposalAccessModal\` é aberto
3. Hook \`useProposalEvents\` consulta a Edge Function \`proposal-track\` com ação \`list\`
4. Edge Function usa \`SERVICE_ROLE_KEY\` para consultar \`proposal_views\`
5. Resultados são exibidos como timeline + estatísticas

## 7.2 Informações exibidas

| Dado | Fonte |
|---|---|
| Data e hora do acesso | \`viewed_at\` |
| Tipo de evento | \`source\` (public_link, internal, email, pdf_download, link_copied) |
| Email do cliente | \`client_email\` |
| Endereço IP | \`ip_address\` |
| Navegador | \`user_agent\` |

## 7.3 Estatísticas agregadas

- Total de visualizações
- Total de cópias de link
- Total de downloads de PDF
- Primeira visualização
- Última visualização

## 7.4 Eventos capturados pelo tracking

| Evento | Tipo no \`source\` |
|---|---|
| \`proposal.view_public\` | \`view_public\` |
| \`proposal.view_internal\` | \`view_internal\` |
| \`proposal.link_copied\` | \`link_copied\` |
| \`proposal.email_sent\` | \`email_sent\` |
| \`proposal.pdf_download\` | \`pdf_download\` |
| \`proposal.approved\` | \`approved\` |
| \`proposal.rejected\` | \`rejected\` |

---

# 8. Eventos de contratos

Contratos possuem ciclo de vida próprio com eventos associados.

| Evento | Quando é gerado |
|---|---|
| \`contract.created\` | Contrato é criado a partir de proposta aprovada |
| \`contract.generated\` | Documento PDF do contrato é gerado |
| \`contract.sent\` | Contrato é enviado para assinatura |
| \`contract.signed\` | Contrato é assinado pelo cliente |
| \`contract.cancelled\` | Contrato é cancelado |
| \`contract.expired\` | Contrato atinge data de expiração |

**Regra:** Contrato deve referenciar a proposta de origem via \`proposal_id\`. Isso permite rastrear a cadeia completa: proposta → aprovação → contrato → assinatura.

---

# 9. Eventos de usuários

Eventos administrativos com impacto em segurança e auditoria.

| Evento | Quando | Audit Log |
|---|---|---|
| \`user.created\` | Novo usuário cadastrado | Obrigatório |
| \`user.updated\` | Dados do usuário alterados | Obrigatório |
| \`user.deleted\` | Usuário desativado/removido | Obrigatório |
| \`user.login\` | Login bem-sucedido | Recomendado |
| \`user.login_failed\` | Tentativa de login falhou | Recomendado |
| \`user.logout\` | Logout realizado | Opcional |
| \`user.password_reset\` | Senha redefinida | Obrigatório |

Eventos de usuário devem ser registrados tanto na tabela de eventos quanto em \`audit_logs\`, pois envolvem dados sensíveis e controle de acesso.

---

# 10. Tabelas de eventos atuais

O sistema atualmente utiliza três tabelas para registro de eventos:

## 10.1 \`proposal_views\`

**Função:** Registrar visualizações e interações com propostas.

| Campo | Tipo | Descrição |
|---|---|---|
| \`id\` | uuid | Identificador único |
| \`proposal_id\` | text | ID da proposta |
| \`source\` | text | Tipo do evento (view_public, link_copied, etc.) |
| \`client_email\` | text | Email do cliente |
| \`ip_address\` | text | IP de origem |
| \`user_agent\` | text | Navegador/cliente |
| \`viewed_at\` | timestamptz | Momento da visualização |

**Alimentada por:** Edge Function \`proposal-track\`.

## 10.2 \`cert_audit_logs\`

**Função:** Registrar ações do módulo TechOps / Certidão de Nascimento.

| Campo | Tipo | Descrição |
|---|---|---|
| \`id\` | uuid | Identificador único |
| \`entity_type\` | text | Tipo da entidade |
| \`entity_id\` | text | ID da entidade |
| \`action\` | text | Ação executada |
| \`changes\` | jsonb | Dados alterados |
| \`user_id\` | uuid | Quem executou |
| \`user_name\` | text | Nome do executor |
| \`user_level\` | integer | Nível do executor |
| \`created_at\` | timestamptz | Timestamp |

## 10.3 Observação sobre fragmentação

Atualmente os eventos estão distribuídos em tabelas separadas por domínio. Isso funciona no curto prazo, mas gera:

- Consultas fragmentadas
- Padrões inconsistentes entre domínios
- Dificuldade para criar dashboards unificados
- Complexidade para manutenção

A seção 11 documenta a proposta de unificação.

---

# 11. Proposta de unificação de eventos

## 11.1 Tabela \`system_events\`

Tabela única para todos os eventos do sistema:

\`\`\`sql
CREATE TABLE public.system_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity text NOT NULL,
  action text NOT NULL,
  event_name text GENERATED ALWAYS AS (entity || '.' || action) STORED,
  entity_id uuid NOT NULL,
  actor_type text NOT NULL DEFAULT 'user',
  actor_id uuid,
  user_id uuid,
  client_email text,
  ip_address text,
  user_agent text,
  metadata jsonb DEFAULT '{}',
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
\`\`\`

## 11.2 Índices recomendados

\`\`\`sql
CREATE INDEX idx_system_events_entity_id ON system_events(entity, entity_id);
CREATE INDEX idx_system_events_event_name ON system_events(event_name);
CREATE INDEX idx_system_events_occurred_at ON system_events(occurred_at);
CREATE INDEX idx_system_events_actor ON system_events(actor_type, actor_id);
CREATE INDEX idx_system_events_user ON system_events(user_id);
\`\`\`

## 11.3 Tabelas substituídas

| Tabela atual | Migração |
|---|---|
| \`proposal_views\` | Migrar para \`system_events\` com \`entity = 'proposal'\` |
| \`cert_audit_logs\` | Migrar para \`system_events\` com \`entity\` correspondente |
| \`contract_events\` (futura) | Já nasce em \`system_events\` |

## 11.4 Estratégia de migração

1. **Fase 1** — Criar \`system_events\` sem remover tabelas existentes
2. **Fase 2** — Novos eventos escrevem em \`system_events\` + tabela legada (dual write)
3. **Fase 3** — Migrar dados históricos das tabelas antigas
4. **Fase 4** — Redirecionar leituras para \`system_events\`
5. **Fase 5** — Depreciar tabelas antigas

## 11.5 Benefícios da unificação

- Consultas cross-domain (ex: "todas as ações de um usuário")
- Dashboard unificado de atividades
- Padrão único de evento para todos os módulos
- Simplificação de manutenção
- Base para analytics avançado e IA

---

# 12. Fluxo de geração de eventos

## 12.1 Fluxo padrão

\`\`\`
┌──────────────┐
│ Ação do      │
│ Usuário      │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Validação    │───► Erro? → retornar sem evento
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Persistência │───► Falhou? → retornar sem evento
│ da Entidade  │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Registro do  │───► Falha no evento NÃO deve
│ Evento       │     reverter a operação principal
└──────────────┘
\`\`\`

## 12.2 Regras do fluxo

1. Evento é registrado **somente após sucesso** da operação principal
2. Falha no registro do evento **não deve reverter** a operação principal
3. Evento deve ser registrado na mesma transação quando possível, ou logo após
4. Eventos devem ser registrados no backend (Edge Function ou API), nunca exclusivamente no frontend

## 12.3 Implementação atual

O tracking de propostas é feito via Edge Function \`proposal-track\`:

\`\`\`typescript
// Frontend chama o serviço
await proposalTrackingService.trackEvent({
  proposalId: 'uuid',
  source: 'view_public',
  clientEmail: 'cliente@email.com'
});

// Edge Function persiste em proposal_views
const { error } = await supabaseAdmin
  .from('proposal_views')
  .insert({ proposal_id, source, client_email, ip_address, user_agent });
\`\`\`

---

# 13. Regras de consistência

## 13.1 Regras obrigatórias

| # | Regra | Justificativa |
|---|---|---|
| 1 | Eventos são **append-only** | Imutabilidade garante integridade do histórico |
| 2 | Eventos **nunca devem ser alterados** | UPDATE em eventos corrompe auditoria |
| 3 | Eventos devem registrar **metadata relevante** | Permite reconstrução da ação sem consultar outras tabelas |
| 4 | Eventos **não devem depender de localStorage** | Dados transitórios são perdidos e manipuláveis |
| 5 | Eventos devem conter **timestamp real** | \`occurred_at\` deve refletir quando a ação aconteceu |
| 6 | Eventos devem ser **persistidos no backend** | Frontend pode falhar, ser manipulado ou desconectado |
| 7 | Evento deve ser registrado **após sucesso** | Não registrar eventos de operações que falharam |

## 13.2 Validação de consistência

Periodicamente, verificar:

- Propostas sem evento \`proposal.created\` (dados pré-evento)
- Propostas aprovadas sem evento \`proposal.approved\`
- Contratos sem proposta de origem rastreável
- Gaps temporais suspeitos no histórico de eventos

---

# 14. Uso de eventos para analytics

Eventos permitem gerar métricas operacionais e estratégicas.

## 14.1 Métricas de propostas

| Métrica | Cálculo |
|---|---|
| Taxa de abertura | \`proposal.view_public\` / \`proposal.sent\` |
| Taxa de conversão | \`proposal.approved\` / \`proposal.created\` |
| Downloads de PDF | Count de \`proposal.pdf_download\` |
| Tempo médio de aprovação | Média de \`proposal.approved.occurred_at - proposal.sent.occurred_at\` |
| Volume por executivo | Count de \`proposal.created\` por \`actor_id\` |

## 14.2 Métricas de suporte

| Métrica | Cálculo |
|---|---|
| Tempo de resolução | \`ticket.resolved.occurred_at - ticket.created.occurred_at\` |
| Taxa de escalação | \`ticket.escalated\` / \`ticket.created\` |
| Volume por analista | Count de \`ticket.assigned\` por \`actor_id\` |

## 14.3 Métricas de sistema

| Métrica | Cálculo |
|---|---|
| Logins por dia | Count de \`user.login\` por dia |
| Tentativas falhas | Count de \`user.login_failed\` |
| Uso de Edge Functions | Count de \`edge_function.executed\` |

---

# 15. Uso de eventos para automação

Eventos podem disparar ações automáticas no futuro.

## 15.1 Automações planejadas

| Trigger | Ação automática |
|---|---|
| \`proposal.approved\` | Gerar contrato automaticamente |
| \`contract.signed\` | Iniciar provisioning de infraestrutura |
| \`ticket.closed\` | Enviar pesquisa de satisfação (NPS) |
| \`proposal.expired\` | Notificar executivo responsável |
| \`user.login_failed\` (3x) | Bloquear conta temporariamente |
| \`proposal.view_public\` (1ª vez) | Notificar executivo que o cliente abriu |

## 15.2 Arquitetura de automação

\`\`\`
system_events
    │
    ▼
Event Listener (futuro)
    │
    ├──► Supabase Database Webhooks
    ├──► Edge Functions com trigger
    └──► Fila de processamento assíncrono
\`\`\`

A implementação atual é síncrona. A evolução para processamento assíncrono baseado em eventos está planejada.

---

# 16. Uso de eventos para auditoria

Eventos de auditoria permitem rastrear mudanças críticas no sistema.

## 16.1 Cenários de auditoria

| Pergunta | Eventos consultados |
|---|---|
| Quem alterou o contrato? | \`contract.*\` filtrado por \`entity_id\` |
| Quem excluiu o usuário? | \`user.deleted\` filtrado por \`entity_id\` |
| Quem alterou permissões? | \`permission.changed\` |
| Quem alterou comissão? | \`commission.overridden\` |
| Qual o histórico completo de uma proposta? | Todos os eventos com \`entity = proposal\` e \`entity_id\` |

## 16.2 Retenção

- Eventos de auditoria devem ser retidos por **mínimo 2 anos**
- Eventos de acesso podem ter retenção menor (6-12 meses) se necessário
- Eventos de negócio devem ser retidos indefinidamente

---

# 17. Diretrizes para novos eventos

Todo novo evento adicionado ao sistema deve:

| Requisito | Descrição |
|---|---|
| Seguir padrão \`entity.action\` | Nomenclatura padronizada |
| Registrar metadata relevante | Informação suficiente para reconstruir a ação |
| Incluir timestamp | \`occurred_at\` com horário real |
| Ser documentado neste arquivo | Adicionar na tabela de catálogo (seção 4) |
| Ser persistido no backend | Nunca apenas no frontend |
| Ser registrado após sucesso | Não criar evento de operação que falhou |
| Definir \`actor_type\` | user, system, client ou webhook |

### Checklist para novo evento

\`\`\`markdown
- [ ] Nome segue padrão entity.action
- [ ] Documentado no catálogo de eventos
- [ ] Metadata definida
- [ ] Persistência no backend implementada
- [ ] Registrado após sucesso da operação
- [ ] Testado em ambiente de desenvolvimento
\`\`\`

---

# 18. Anti-patterns proibidos

| Anti-pattern | Risco |
|---|---|
| Não registrar eventos importantes | Perda de rastreabilidade |
| Registrar eventos com nomes aleatórios | Impossibilidade de consulta padronizada |
| Misturar eventos técnicos e de negócio sem classificação | Poluição de dados |
| Registrar eventos apenas no frontend | Dados perdidos se navegador fechar |
| Usar localStorage como fonte de eventos | Dados manipuláveis e voláteis |
| Alterar ou excluir eventos registrados | Corrupção de auditoria |
| Registrar evento antes do sucesso da operação | Eventos fantasma |
| Criar tabela de eventos sem índices | Performance degradada |
| Usar nomes em português para event_name | Inconsistência com padrão técnico |
| Registrar metadata sem estrutura definida | Dados inutilizáveis |

---

# 19. Integração com outros documentos

Este documento deve ser mantido alinhado com:

| Documento | Relação |
|---|---|
| \`OPEN_DATA_MODEL.md\` | Estrutura das tabelas de eventos |
| \`OPEN_RBAC_MODEL.md\` | Quem pode ver e gerar eventos |
| \`OPEN_SYSTEM_BLUEPRINT.md\` | Camada de eventos na arquitetura geral |
| \`OPEN_RUNBOOK_SUPABASE.md\` | Edge Functions que persistem eventos |

Qualquer alteração na arquitetura de eventos deve:

1. Atualizar este documento
2. Atualizar o catálogo de eventos (seção 4)
3. Atualizar o Data Model se novas tabelas forem criadas
4. Atualizar o Runbook se novas Edge Functions forem necessárias

---

# 20. Conclusão

A arquitetura de eventos é fundamental para tornar a plataforma OPEN:

- **Observável** — saber o que acontece no sistema em tempo real
- **Auditável** — rastrear quem fez o quê e quando
- **Automatizável** — disparar ações baseadas em eventos
- **Analisável** — gerar métricas e insights operacionais

Eventos tornam o sistema OPEN rastreável, escalável e preparado para evolução.

**Regra absoluta:** toda ação importante do sistema deve gerar um evento padronizado, persistido no backend, com metadata suficiente para reconstrução completa da ação.
`;
