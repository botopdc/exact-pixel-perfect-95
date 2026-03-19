# Fase 5 — Validação Funcional dos Módulos Críticos

**Data:** 2026-03-18  
**Objetivo:** Garantir base confiável para continuidade do projeto SALES OPEN

---

## Relatório por Módulo

| # | Módulo | Status | Detalhes |
|---|--------|--------|----------|
| 1 | **Login e Sessão** | ✅ OK | Supabase Auth nativo. Login, logout, refresh, redirect por role funcionais. |
| 2 | **Admin** | ✅ OK | Leitura de profiles e roles via Supabase. Permissões page reescrita para slugs. user_roles populado para 5 profiles. |
| 3 | **Propostas** | ✅ OK (corrigido) | `proposalApi.ts` usava tokens legados — corrigido para `getAuthTokenSync()` (Supabase JWT first). |
| 4 | **Pricing** | ✅ OK (corrigido) | `calculatorConfigService.ts` e `useConfig.ts` usavam tokens legados — corrigidos. |
| 5 | **Docs** | ✅ OK | Módulo /docs é 100% frontend (registry estático). Sem dependência de auth para leitura. Admin/sync usa roles. |
| 6 | **Atendimentos** | ✅ OK (corrigido) | `supportTicketCoreService.ts` usava tokens legados — corrigido. UUID é identidade primária. |
| 7 | **Contratos** | ✅ OK | Usa `supabase` client direto com RLS permissiva (select para anon/auth). `create_contract_from_proposal` usa `auth.uid()`. |

---

## Correções Aplicadas

| Arquivo | Problema | Correção |
|---------|----------|----------|
| **`src/lib/authToken.ts`** | (novo) | Helper centralizado: Supabase JWT → legacy localStorage fallback |
| **`src/services/proposalApi.ts`** | `getCoreToken()` lia apenas keys legadas | Usa `getAuthTokenSync()` |
| **`src/services/calculatorConfigService.ts`** | `getAuthToken()` lia apenas keys legadas | Usa `getAuthTokenSync()` |
| **`src/services/supportTicketCoreService.ts`** | `getToken()`/`authHeaders()` lia keys legadas | Usa `getAuthTokenSync()`/`buildAuthHeaders()` |
| **`src/services/publicApprovalService.ts`** | `getCoreToken()` lia apenas keys legadas | Usa `getAuthTokenSync()` |
| **`src/hooks/useConfig.ts`** | Token guard lia localStorage direto | Usa `getAuthTokenSync()` via dynamic import |
| **`src/components/SupabaseProposalsList.tsx`** | `hasCoreToken` lia 5 keys legadas | Usa `getAuthTokenSync()` |
| **`user_roles` (banco)** | Tabela vazia | Semeadas 5 roles para profiles existentes |

---

## Pendências Restantes

| Item | Risco | Plano |
|------|-------|-------|
| 43 arquivos ainda importam `authService` | Baixo | Maioria em páginas de parceiros/legado. `useSession` bridge cobre. |
| `proposal_participants.external_user_id` (integer) | Baixo | Domínio comercial legado. Migrar quando Laravel for desligado. |
| `user_commission_overrides.external_user_id` (integer) | Baixo | Idem. |
| Auto-atribuição de roles no signup | Médio | Novos users ficam sem roles (fallback por level funciona). Implementar trigger ou admin workflow. |
| Edge Functions usam `validateExternalToken` (aceita tokens >= 10 chars) | Médio | Funciona com JWT do Supabase. Considerar validação real via `supabase.auth.getUser(token)` no futuro. |

---

## Riscos para Integração com SALES OPEN

1. **Token resolution centralizado** — `src/lib/authToken.ts` resolve corretamente para ambos cenários (Supabase JWT e legacy). Baixo risco.
2. **coreSupabase (core-open project)** — Edge Functions de propostas estão no projeto externo. O JWT do projeto managed é aceito pelo stub `validateExternalToken`. Se a validação for endurecida no core-open, será necessário implementar cross-project auth.
3. **RLS de contratos** — Policies são permissivas (select para anon). Adequado para MVP mas precisa refinamento para produção.
4. **Roles vazias** — Se novos usuários forem criados sem atribuição de roles, o sistema funciona via `level_legacy` fallback, mas isso é transitório.

---

## Como Testar

1. **Login:** `/login` → email/senha → redirect automático por role
2. **Propostas:** `/modulos/comercial/propostas` → listar, abrir, salvar
3. **Pricing:** `/precos` → carregar preços, editar (requer PIN admin)
4. **Tickets:** `/modulos/atendimentos/suporte-tecnico` → listar, filtrar "Meus Tickets"
5. **Contratos:** `/modulos/comercial/contratos` → listar, criar a partir de proposta aprovada
6. **Admin:** `/modulos/admin/permissoes` → ver profiles, atribuir roles
7. **Logout:** Sidebar → sair → redirecionado para `/login`
