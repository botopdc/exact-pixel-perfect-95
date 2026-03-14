# Módulo: Sistema de Chamados — Suporte Técnico

> Rota: `/modulos/atendimentos/suporte-tecnico`  
> Status: **Em definição**  
> Última atualização: 2026-03-14

---

## 1. Visão Geral

Sistema de chamados (tickets) do CORE da OPEN, substituindo gradualmente o legado.  
Utilizado por clientes, suporte técnico e sucesso do cliente.

---

## 2. Papéis e Permissões

| Papel | Level | Capacidades |
|-------|-------|-------------|
| Cliente | 1 | Abre chamados, acompanha, solicita encerramento |
| Usuário interno | ≥ 600 | Abre chamados internos |
| Sucesso do Cliente (CS) | 775 | Valida resolução, encerra oficialmente |
| Suporte | 900 | Assume, trata, escala, resolve |
| Gerente de Suporte | 950 | Gestão de filas, relatórios |
| Admin | 1000 | Acesso total, override |

---

## 3. Fluxo de Status

```
ABERTO → EM_TRIAGEM → EM_ANDAMENTO → AGUARDANDO_CLIENTE → RESOLVIDO → ENCERRADO
                ↓                          ↑
             ESCALADO (N2/N3) ─────────────┘
```

| Status | Quem altera |
|--------|-------------|
| `aberto` | Sistema (ao criar) |
| `em_triagem` | N1 assume |
| `em_andamento` | Suporte trabalhando |
| `aguardando_cliente` | Suporte aguarda resposta |
| `escalado` | Suporte escala para N2/N3 |
| `resolvido` | Suporte marca solução |
| `encerrado` | CS valida e fecha |
| `cancelado` | Admin ou CS cancela |

---

## 4. Tipos de Chamado

| Tipo | Descrição |
|------|-----------|
| `incidente` | Falha ou degradação em serviço ativo |
| `solicitacao` | Pedido de ação (criar VM, liberar acesso, etc.) |
| `duvida` | Pergunta técnica ou operacional |
| `alteracao` | Mudança em configuração existente |
| `financeiro` | Questão de faturamento, NF, cobrança |

---

## 5. Severidade

| Severidade | Descrição | Contagem SLA |
|------------|-----------|--------------|
| **S1** | Crítico — serviço totalmente indisponível | 24×7 |
| **S2** | Alto — degradação significativa | 24×7 |
| **S3** | Médio — impacto parcial | Horário comercial |
| **S4** | Baixo — sem impacto imediato | Horário comercial |

---

## 6. Escalonamento

Cada nível possui **fila própria**:

| Nível | Responsabilidade |
|-------|-----------------|
| **N1** | Triagem, primeiro atendimento, resolução básica |
| **N2** | Análise técnica aprofundada, infraestrutura |
| **N3** | Engenharia, arquitetura, vendor escalation |

Histórico de escalonamento registrado no timeline do ticket.

---

## 7. SLA

Baseado na **combinação** de:

- **Severidade** → define tempo-base
- **Tipo** → ajusta (incidente mais agressivo que dúvida)
- **Plano do cliente** → multiplicador (Premium=0.5x, Standard=1x, Basic=1.5x)

---

## 8. Regras de Negócio

- **Abertura**: Clientes (level=1) + Usuários internos (level ≥ 600)
- **Encerramento**: Exclusivamente CS (level=775) após resolução pelo Suporte
- **Vínculo com ativos**: 1 ativo por ticket (opcional)
- **Notas internas**: `is_internal_note=true` visíveis apenas para level ≥ 775
- **Cliente pode solicitar encerramento**, mas não fechar diretamente

---

## 9. Integrações Futuras (não implementar agora)

- Zabbix (criação automática)
- Webhooks
- API pública

---

## 10. Próximos Passos

1. Modelagem de dados (tabelas, enums, relações)
2. RLS policies
3. Service layer + hooks
4. UI/UX das telas
