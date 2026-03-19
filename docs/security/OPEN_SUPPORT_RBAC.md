# OPEN — RBAC do Suporte Técnico

Versão: v2 (Roles-First + Supabase Auth)  
Sistema: core.opendata.center  
Última atualização: 2026-03-19

---

## 1. Visão Geral

O controle de acesso do módulo de suporte técnico segue o modelo **Roles-First** da plataforma OPEN. A identidade é gerenciada pelo **Supabase Auth** e as permissões são resolvidas primariamente pelos papéis (`user_roles`) com fallback para `profile.level` durante a transição.

### 1.1 Modelo de Identidade

| Componente | Fonte de Verdade |
|------------|------------------|
| Autenticação | Supabase Auth (`auth.users`) |
| Perfil | `public.profiles` (vinculado a `auth.users.id`) |
| Papéis | `public.user_roles` (slugs: `admin`, `suporte`, `cs`, etc.) |
| Fallback | `profiles.level` → mapeamento para roles via `getEffectiveRoles()` |

### 1.2 Resolução de Permissões

```
1. Carregar user_roles do banco → se existirem, usar como fonte de verdade
2. Se user_roles estiver vazio → derivar roles de profiles.level via LEVEL_TO_ROLES
3. Resultado: array de role slugs (effectiveRoles)
4. Verificações: hasRole(), hasAnyRole(), isAdmin(), isSupport(), etc.
```

---

## 2. Papéis e Níveis de Acesso

| Role Slug | Level (legado) | Papel | Tipo |
|-----------|----------------|-------|------|
| `cliente` | 1 | Cliente | Externo |
| `parceiro` | 200 | Parceiro | Externo |
| `rh` | 600 | RH | Interno |
| `bdr` | 680 | BDR | Interno |
| `arquiteto` | 690 | Arquiteto de Soluções | Interno |
| `comercial` | 700 | Comercial | Interno |
| `gerente_comercial` | 750 | Gerente Comercial | Interno |
| `cs` | 775 | Customer Success | Interno |
| `suporte` | 900 | Suporte | Interno |
| `gerente_suporte` | 950 | Gerente de Suporte | Interno |
| `admin` | 1000 | Admin | Interno |
| `internal_user` | — | Usuário Interno (composto) | — |

---

## 3. Matriz de Permissões

| Permissão | cliente | rh | cs | suporte | gerente_suporte | admin |
|-----------|---------|----|----|---------|-----------------|-------|
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
| Gerenciar filas | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Gerenciar SLA | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |

---

## 4. Visibilidade de Tickets

### 4.1 Cliente (`cliente`)

- Acesso: `/portal/tickets`
- Vê apenas seus próprios tickets (`requester_user_id = auth.uid()`)
- Não vê notas internas
- Não vê campos internos (fila, analista, SLA)

### 4.2 Usuários Internos (`rh`, `bdr`, `comercial`, etc.)

- Pode abrir chamados internos
- Visibilidade limitada a tickets onde é solicitante

### 4.3 Suporte (`suporte`)

- Vê tickets nas filas em que é membro (`support_queue_members`)
- Vê tickets atribuídos a si (`assigned_to_user_id = auth.uid()`)
- Vê tickets que abriu

### 4.4 Gerente de Suporte (`gerente_suporte`)

- Visão global de todos os tickets
- Gestão de filas e membros

### 4.5 Admin (`admin`)

- Visão global total
- Acesso a todas as configurações

---

## 5. Implementação no Backend

### 5.1 Edge Functions — Roles-First

As Edge Functions agora priorizam `effectiveRoles` derivadas do perfil Supabase:

```typescript
// Exemplo em support-ticket-update
const userId = body.user_id;           // UUID do Supabase Auth
const userRoles = body.user_roles;     // ['suporte', 'internal_user']

// Verificação por role (primário)
if (action === 'close' && !hasAnyRole(userRoles, ['cs', 'gerente_suporte', 'admin'])) {
  return error(403, 'Apenas CS ou superior pode encerrar tickets');
}

// Fallback por level (compatibilidade)
if (!userRoles?.length) {
  const userLevel = body.user_level || 1;
  if (action === 'close' && userLevel < 775) {
    return error(403, 'Nível insuficiente');
  }
}
```

### 5.2 Visibilidade (support-ticket-list)

```typescript
if (hasRole(userRoles, 'cliente')) {
  // Cliente: apenas próprios tickets
  query = query.eq('requester_user_id', userId);
} else if (hasAnyRole(userRoles, ['gerente_suporte', 'admin'])) {
  // Gerente/Admin: todos os tickets
} else if (hasRole(userRoles, 'suporte')) {
  // Suporte: tickets nas filas + atribuídos + próprios
  query = query.or([...]);
} else {
  // Interno: apenas próprios
  query = query.eq('requester_user_id', userId);
}
```

### 5.3 RLS (Row Level Security)

| Função | Descrição |
|--------|-----------|
| `is_support_internal()` | Verifica `tech_users` por email do JWT |
| `is_support_admin_or_manager()` | Verifica role ADMIN em `tech_users` |
| `has_role(_user_id, _role)` | Verifica `user_roles` (SECURITY DEFINER) |
| `is_internal_user()` | `profiles.level >= 600` |
| `is_profile_admin()` | `profiles.level >= 1000` |

### 5.4 Helpers Frontend (src/lib/rbac.ts)

| Função | Descrição |
|--------|-----------|
| `getEffectiveRoles(dbRoles, profile)` | Retorna roles efetivas (DB ou fallback level) |
| `hasRole(roles, slug)` | Verifica role específica |
| `isAdmin(roles)` | Verifica se é admin |
| `isSupport(roles)` | Verifica suporte/gerente_suporte/admin |
| `isCS(roles)` | Verifica cs/admin |
| `canAccessByAllowedLevels(roles, levels)` | Compat com allowedLevels dos módulos |

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
  "actor_user_id": "uuid-do-supabase-auth",
  "actor_user_name": "Admin João",
  "actor_user_level": 1000,
  "user_id": 42,
  "user_name": "Analista Maria",
  "user_email": "maria@open.com",
  "user_level": 900
}
```

> **Nota:** `actor_user_id` é UUID do Supabase Auth. `user_id` do membro ainda usa integer legado temporariamente.

---

## 7. Regras Críticas

1. **Suporte resolve, CS encerra** — separação obrigatória
2. **Notas internas NUNCA visíveis para clientes** — filtradas em todas as consultas
3. **Parceiro (200) não tem acesso** — ao módulo de suporte
4. **Cliente acessa apenas o portal** — `/portal/tickets`, não `/modulos/atendimentos`
5. **Visibilidade baseada em filas** — lookup por `user_email` na `support_queue_members`
6. **UUID é a identidade primária** — `auth.uid()` é usado em todas as operações autenticadas
7. **Roles-First** — verificar papel antes de level; level é fallback temporário
