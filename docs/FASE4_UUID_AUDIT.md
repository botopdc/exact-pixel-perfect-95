# Fase 4 — Auditoria de Referências de Usuário (UUID vs Integer)

**Data:** 2026-03-18  
**Objetivo:** Padronizar identidade para UUID do Supabase Auth

---

## 1. Matriz de Colunas Auditadas

### ✅ Já usam UUID (sem ação necessária)

| Tabela | Coluna | Tipo | Notas |
|--------|--------|------|-------|
| `profiles` | `id` | uuid | PK, references auth.users(id) |
| `user_roles` | `user_id` | uuid | FK profiles.id |
| `calculator_proposals` | `created_by` | uuid | auth.uid() via trigger |
| `contracts` | `generated_by` | uuid | auth.uid() |
| `contracts` | `updated_by` | uuid | auth.uid() |
| `cert_audit_logs` | `user_id` | text (uuid) | Já grava UUID |
| `articles` | `author` | text | Nome, não ID |

### 🔶 Híbrido — Migrado para UUID-first nesta fase

| Componente | Campo | Antes | Depois |
|-----------|-------|-------|--------|
| `getQueueUserContext()` | `actor_user_id` | Integer legado | UUID Supabase (fallback legado) |
| `useSupportTicketCore.performAction` | `actor_user_id` | `legacyUserId \|\| userId` | `userId` (UUID) |
| `useSupportTicketCore.sendMessage` | `author_user_id` | `legacyUserId \|\| userId` | `userId` (UUID) |
| `useSupportTicketCore.getTicket` | `user_id` param | `legacyUserId \|\| userId` | `userId` (UUID) |
| `useSession` | `userId` | ambíguo | UUID sempre |
| `useSession` | `legacyUserId` | não existia | `number \| null` (bridge) |

### 🟡 Integer legado — Mantido intencionalmente (ponte de compatibilidade)

| Tabela/Service | Coluna | Tipo | Justificativa |
|---------------|--------|------|--------------|
| `proposal_participants` | `external_user_id` | integer | Vinculado à API Laravel (created_by da proposta legada). Será migrado quando o domínio comercial mudar para Supabase-only. |
| `user_commission_overrides` | `external_user_id` | integer | Idem — comissões calculadas com base em IDs da API legada. |
| `support_queue_members` | `user_id` | integer | Já possui `user_id_uuid` como coluna paralela. Edge Function usa ambos. |
| `support_oncall_shifts` | `user_id` | integer | Já possui `user_id_uuid`. |
| `support_ticket_queue_history` | `changed_by_user_id` | integer | Histórico imutável, não será alterado retroativamente. |
| `profiles` | `legacy_user_id` | bigint | Ponte deliberada para lookup reverso. |

---

## 2. Arquivos Alterados

| Arquivo | Alteração |
|---------|-----------|
| `src/services/supportTicketCoreService.ts` | `getQueueUserContext()` agora lê UUID do Supabase Auth como fonte primária |
| `src/hooks/useSupportTicketCore.ts` | `performAction`, `sendMessage`, `getTicket` usam UUID |
| `src/hooks/useSession.ts` | `userId` = UUID, `legacyUserId` separado, `effectiveRoles` adicionado |

---

## 3. Strategy de Identidade

```
┌────────────────────────────────┐
│   Supabase Auth (auth.users)   │  ← Fonte de verdade
│   UUID: profile.id             │
└──────────┬─────────────────────┘
           │
    ┌──────▼──────────────────────┐
    │   public.profiles            │
    │   id (UUID) = auth.users.id  │
    │   legacy_user_id (bigint)    │  ← Ponte para API legada
    │   level_legacy (integer)     │  ← Ponte para lógica legada
    └──────┬───────────────────────┘
           │
    ┌──────▼──────────────────────┐
    │   public.user_roles          │
    │   user_id → profiles.id     │  ← RBAC baseado em slugs
    └──────────────────────────────┘
```

**Regra:** Toda nova funcionalidade DEVE usar `profile.id` (UUID) como identidade.  
**Legacy:** `legacy_user_id` só é usado para lookup reverso em APIs Laravel e tabelas já existentes com `external_user_id`.

---

## 4. O que ainda depende de IDs inteiros legados

| Domínio | Arquivo(s) | Dependência | Plano |
|---------|-----------|-------------|-------|
| Comissões comerciais | `executiveCommissionService.ts`, `commissionOverrideService.ts` | `external_user_id` (integer) da API Laravel | Migrar quando domínio comercial for 100% Supabase |
| Proposal participants | `proposalParticipantService.ts` | `external_user_id` (integer) | Idem |
| Support queue members | Edge Function `support-queue-admin` | `user_id` (integer) + `user_id_uuid` | Já híbrido, funcional |
| Oncall shifts | Edge Function `support-queue-admin` | `user_id` (integer) + `user_id_uuid` | Já híbrido, funcional |
| `authService.ts` | 43 arquivos importam | Token/session localStorage | Fase 5: remover completamente |

---

## 5. Como Testar

1. **Login Supabase:** Fazer login via `/login` → verificar que `useSession().userId` é um UUID
2. **Meus Tickets:** Filtrar "Meus Tickets" em `/modulos/atendimentos/suporte-tecnico` → deve filtrar por UUID
3. **Ações de ticket:** Assumir, escalar, resolver → `actor_user_id` deve ser UUID nos logs
4. **Mensagens:** Enviar mensagem em ticket → `author_user_id` deve ser UUID
5. **Console:** Verificar `[AuthContext] Profile loaded:` mostra `id: "uuid-..."` e `legacy_user_id: 123`
