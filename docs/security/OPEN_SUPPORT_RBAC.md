# OPEN — RBAC do Suporte Técnico

Versão: v1  
Sistema: core.opendata.center  
Última atualização: 2026-03-15

---

## 1. Visão Geral

O controle de acesso do módulo de suporte técnico segue o modelo RBAC hierárquico da plataforma OPEN, baseado no campo `users.level`.

---

## 2. Níveis de Acesso

| Level | Papel | Tipo | Descrição |
|-------|-------|------|-----------|
| 1 | Cliente | Externo | Abre e acompanha chamados próprios |
| 200 | Parceiro | Externo | Sem acesso ao módulo de suporte |
| 600 | RH | Interno | Pode abrir chamados internos |
| 700 | Comercial | Interno | Pode abrir chamados internos |
| 750 | Gerente Comercial | Interno | Pode abrir chamados internos |
| 775 | Customer Success | Interno | Validação, encerramento, reabertura |
| 900 | Suporte | Interno | Operação completa N1/N2/N3 |
| 950 | Gerente de Suporte | Interno | Gestão global, filas, membros |
| 1000 | Admin | Interno | Acesso total |

---

## 3. Matriz de Permissões

| Permissão | Cliente (1) | RH (600) | CS (775) | Suporte (900) | Gerente (950) | Admin (1000) |
|-----------|-------------|----------|----------|---------------|---------------|--------------|
| Abrir chamado | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Ver próprios tickets | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Ver tickets da equipe | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| Ver todos os tickets | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Assumir ticket | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Atribuir a outro analista | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Escalar ticket | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Transferir entre filas | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Resolver ticket | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Encerrar ticket (CS) | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ |
| Reabrir ticket | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ |
| Cancelar ticket | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Notas internas | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| Ver notas internas | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| Gerenciar filas | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Gerenciar membros | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Gerenciar SLA | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Gerenciar plantão | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Gerenciar catálogos | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

---

## 4. Visibilidade de Tickets

### 4.1 Cliente (Level 1)

- Acesso: `/portal/tickets`
- Vê apenas seus próprios tickets (`requester_user_id`)
- Não vê notas internas
- Não vê campos internos (fila, analista, SLA)

### 4.2 Usuários Internos (Level 600-899)

- Pode abrir chamados
- Visibilidade limitada a tickets onde é solicitante

### 4.3 Suporte (Level 900)

- Vê tickets nas filas em que é membro (`support_queue_members`)
- Vê tickets atribuídos a si
- Vê tickets que abriu

### 4.4 Gerente de Suporte (Level 950)

- Visão global de todos os tickets
- Gestão de filas e membros

### 4.5 Admin (Level 1000)

- Visão global total
- Acesso a todas as configurações

---

## 5. Implementação no Backend

### 5.1 Edge Functions

Cada Edge Function valida `user_level` antes de processar:

```
// Pseudocódigo
const userLevel = body.user_level || 1;

if (action === 'close' && userLevel < 775) {
  return error(403, 'Apenas CS ou superior pode encerrar tickets');
}

if (action === 'cancel' && userLevel < 950) {
  return error(403, 'Apenas Gerente ou Admin pode cancelar tickets');
}
```

### 5.2 Visibilidade (support-ticket-list)

```
if (userLevel < 600) {
  // Cliente: apenas próprios tickets
  query = query.eq('requester_user_id', userId);
} else if (userLevel >= 600 && userLevel < 950) {
  // Interno: tickets nas suas filas OU atribuídos OU abertos por si
  query = query.or([
    `requester_user_id.eq.${userId}`,
    `assigned_to_user_id.eq.${userId}`,
    `current_queue_id.in.(${queueIds})`
  ]);
} else {
  // Gerente/Admin: todos os tickets
}
```

### 5.3 RLS (Row Level Security)

| Função | Nível mínimo |
|--------|-------------|
| `is_support_internal()` | 600+ |
| `is_support_admin_or_manager()` | 950+ |

---

## 6. Separação Ator vs Membro

Na gestão de filas (`support-queue-admin`), há distinção rigorosa:

| Conceito | Descrição |
|----------|-----------|
| **Ator** | Administrador logado que executa a ação |
| **Membro** | Usuário sendo adicionado/removido da fila |

O payload usa prefixo `actor_` para dados de auditoria:

```json
{
  "actor_user_id": "5",
  "actor_user_name": "Admin João",
  "actor_user_level": 1000,
  "user_id": 42,
  "user_name": "Analista Maria",
  "user_email": "maria@open.com",
  "user_level": 900
}
```

---

## 7. Regras Críticas

1. **Suporte resolve, CS encerra** — separação obrigatória
2. **Notas internas NUNCA visíveis para clientes** — filtradas em todas as consultas
3. **Parceiro (200) não tem acesso** — ao módulo de suporte
4. **Cliente acessa apenas o portal** — `/portal/tickets`, não `/modulos/atendimentos`
5. **Visibilidade baseada em filas** — lookup por `user_email` na `support_queue_members`
