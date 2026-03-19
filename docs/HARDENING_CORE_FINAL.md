# HARDENING CORE FINAL — Pós-Cutover Supabase-First

Data: 2026-03-19  
Status: ✅ Concluído  
Build: ✅ Limpo (0 erros TypeScript)

---

## 1. Auditoria de authService.ts e localStorage

### Ações Executadas

| Arquivo | Antes | Depois | Status |
|---------|-------|--------|--------|
| `src/hooks/useNotifications.ts` | `authService.getSession()` | `useSession()` | ✅ Migrado |
| `src/pages/modules/atendimentos/SupportTicketDetailPage.tsx` | `authService.getSession()` | `useSession()` | ✅ Migrado |
| `src/pages/ArtigoForm.tsx` | `authService.getSession()` + `getCurrentUser()` | `useSession()` | ✅ Migrado |
| `src/pages/ArtigoView.tsx` | `authService.getSession()` | `useSession()` | ✅ Migrado |
| `src/components/OpenCalculator.tsx` | `authService.getSession()` (3 usos) | `useSession()` via `internalSessionData` | ✅ Migrado |
| `src/pages/modules/atendimentos/AnalistasSuportePage.tsx` | `authService.getSession()` + localStorage direto | `useSession()` + `getAuthTokenSync()` | ✅ Migrado |
| `src/hooks/useSupportDashboard.ts` | localStorage direto (`open_access_token`) | `getAuthTokenSync()` | ✅ Migrado |
| `src/services/annualGoalService.ts` | localStorage direto | `getAuthTokenSync()` | ✅ Migrado |
| `src/services/pricingAdminService.ts` | localStorage direto | `getAuthTokenSync()` | ✅ Migrado |
| `src/services/jobsService.ts` | localStorage direto (`open_access_token`) | `getAuthTokenSync()` | ✅ Migrado |

### authService.ts — Marcação Explícita

O arquivo `src/services/authService.ts` foi marcado como **LEGACY COMPATIBILITY BRIDGE (TRANSITIONAL)** com aviso:
> ⚠️ THIS FILE IS DEPRECATED — Use useSession() or useAuth() instead.

### Usos Residuais Justificados de authService

| Consumidor | Motivo de Permanência |
|------------|----------------------|
| `src/services/partnersService.ts` (partnerAuthService) | Autenticação de parceiros via API Laravel — domínio independente |
| `src/services/academyAuthService.ts` | Autenticação academy via API Laravel — domínio independente |
| `src/pages/ApiTest.tsx` | Página de diagnóstico — referencia chaves de localStorage intencionalmente |
| `src/components/OpenCalculator.tsx` (partnerAuthService) | Rotas de parceiro ainda dependem de sessão parceiro separada |

---

## 2. Auditoria de openApi.ts

### Classificação dos Usos Restantes

| Classificação | Arquivos | Contagem |
|---------------|----------|----------|
| **a) Pode migrar para Supabase** | Nenhum identificado para migração imediata | 0 |
| **b) Precisa permanecer (API Laravel ativa)** | openApi.ts (client), academyAuthService, partnersService, approvalLinkService, useCalculatorState, useProposalSearch, useMRRGoals, useExecutiveCommissions, useMetasComerciais, proposalParticipantService, companyService, useAnalistas, useUsers, useCompanies, MeuPotencialArquiteto, ApiTest, Executivos, GestaoExecutivos, etc. | ~30 arquivos |
| **c) Legado morto removível** | Nenhum identificado — todos os usos são ativos via API Laravel | 0 |

### Resumo

O `openApi.ts` é o client HTTP para a API REST Laravel (`VITE_API_BASE_URL`). Ele permanece necessário para:
- **Gestão de Usuários** (CRUD via `/api/user`)
- **Empresas** (`/api/company`)
- **Parceiros** (`/api/partner`)
- **Metas Comerciais** (`/api/annual-goal`)
- **Propostas** (fallback de leitura quando não está no Supabase)
- **Academy** (criação de usuário + login)

> **Decisão**: openApi.ts NÃO é candidato a remoção. É o bridge ativo para funcionalidades que ainda dependem da API Laravel. Novas funcionalidades NÃO devem criar novos endpoints nele.

---

## 3. Endurecimento de Edge Functions

### Antes (MVP stub)

```typescript
// supabaseAdmin.ts — REMOVIDO
const MIN_TOKEN_LENGTH = 10;
if (token.length >= MIN_TOKEN_LENGTH) {
  return { valid: true }; // ← Qualquer string com 10+ chars passava
}

// pricing-admin — REMOVIDO  
return token.length >= 20;
```

### Depois (Supabase JWT + External fallback)

```typescript
// supabaseAdmin.ts — ATUALIZADO
// 1. Tenta verificar como Supabase JWT via getUser(token)
// 2. Se EXTERNAL_AUTH_URL configurada, valida externamente
// 3. Senão, REJEITA (não há mais stub de comprimento)

// pricing-admin — DELEGADO
// Agora importa sharedValidate de supabaseAdmin.ts
```

### Edge Functions Afetadas

| Função | Validação Anterior | Validação Atual |
|--------|--------------------|-----------------|
| `_shared/supabaseAdmin.ts` | `token.length >= 10` | Supabase JWT → External → Reject |
| `pricing-admin/index.ts` | `token.length >= 20` | Delegada ao shared validator |
| `support-ticket-*` | Via shared (stub) | Via shared (JWT real) |
| `support-dashboard-stats` | Via shared (stub) | Via shared (JWT real) |
| `support-queue-admin` | Via shared (stub) | Via shared (JWT real) |
| `support-sla-admin` | Via shared (stub) | Via shared (JWT real) |
| `proposal-public-link` | Via shared (stub) | Via shared (JWT real) |

### Funções Públicas (sem auth)

| Função | Status | Justificativa |
|--------|--------|---------------|
| `proposal-public` | ✅ Público via `pat_` token | Design intencional |
| `public-approval` | ✅ Público via `pat_` token | Design intencional |
| `proposal-gateway` | ✅ Público | Gateway de leitura |
| `send-proposal-email` | ✅ Público | Envio de email |
| `send-password-reset` | ✅ Público | Reset de senha |

---

## 4. Catálogo de Roles — Consolidação

### Verificação de Consistência

| Role Slug | Seed (user_roles) | rbac.ts ROLE_SLUGS | LEVEL_TO_ROLES | Documentação | Status |
|-----------|--------------------|--------------------|----------------|--------------|--------|
| `admin` | ✅ | ✅ | ✅ (1000) | ✅ | ✅ OK |
| `gerente_suporte` | ✅ | ✅ | ✅ (950) | ✅ | ✅ OK |
| `suporte` | ✅ | ✅ | ✅ (900) | ✅ | ✅ OK |
| `cs` | ✅ | ✅ | ✅ (775) | ✅ | ✅ OK |
| `gerente_comercial` | ✅ | ✅ | ✅ (750) | ✅ | ✅ OK |
| `comercial` | ✅ | ✅ | ✅ (700) | ✅ | ✅ OK |
| `arquiteto` | ✅ | ✅ | ✅ (690) | ✅ | ✅ OK |
| `bdr` | ✅ | ✅ | ✅ (680) | ✅ | ✅ OK |
| `rh` | ✅ | ✅ | ✅ (600) | ✅ | ✅ OK |
| `parceiro` | ✅ | ✅ | ✅ (200) | ✅ | ✅ OK |
| `cliente` | ✅ | ✅ | ✅ (1) | ✅ | ✅ OK |
| `internal_user` | — (composto) | ✅ | ✅ (derivado) | ✅ | ✅ OK |

### Helpers Disponíveis

| Helper | Localização | Status |
|--------|-------------|--------|
| `getEffectiveRoles()` | `src/lib/rbac.ts` | ✅ Ativo |
| `hasRole()` | `src/lib/rbac.ts` | ✅ Ativo |
| `hasAnyRole()` | `src/lib/rbac.ts` | ✅ Ativo |
| `isAdmin()`, `isSupport()`, `isCS()`, `isComercial()` | `src/lib/rbac.ts` | ✅ Ativo |
| `canAccessByAllowedLevels()` | `src/lib/rbac.ts` | ✅ Ativo (compat) |
| `has_role(_user_id, _role)` SQL | `public.has_role` | ✅ Ativo |
| `getRoleName()` | `src/lib/rbac.ts` | ✅ Ativo |

---

## 5. Validação dos Domínios Críticos

| Domínio | Status | Observação |
|---------|--------|------------|
| Login e Sessão | ✅ OK | Supabase Auth nativo, AuthContext como fonte de verdade |
| Permissões por Módulo | ✅ OK | Roles-first via `canAccessByAllowedLevels` + `getEffectiveRoles` |
| Propostas | ✅ OK | Edge Functions com JWT real, `getAuthTokenSync()` no frontend |
| Pricing | ✅ OK | Edge Function com JWT real, PIN admin mantido |
| Docs | ✅ OK | Módulo /docs funcional, admin restrito por roles |
| Atendimentos | ✅ OK | Tickets, filas, SLA com JWT real, UUID como identidade |
| Contratos | ✅ OK | RPC `create_contract_from_proposal` com `auth.uid()` |
| Backfill/Importação | ✅ OK | `user-backfill` com invite flow e reconciliação |

---

## 6. Arquivos Alterados nesta Fase

| Arquivo | Tipo de Alteração |
|---------|-------------------|
| `supabase/functions/_shared/supabaseAdmin.ts` | Substituição do stub `token.length >= 10` por validação JWT real |
| `supabase/functions/pricing-admin/index.ts` | Delegação ao shared validator |
| `src/hooks/useNotifications.ts` | `authService` → `useSession()` |
| `src/hooks/useSupportDashboard.ts` | localStorage → `getAuthTokenSync()` |
| `src/pages/modules/atendimentos/SupportTicketDetailPage.tsx` | `authService` → `useSession()` |
| `src/pages/modules/atendimentos/AnalistasSuportePage.tsx` | `authService` + localStorage → `useSession()` + `getAuthTokenSync()` |
| `src/pages/ArtigoForm.tsx` | `authService` → `useSession()` |
| `src/pages/ArtigoView.tsx` | `authService` → `useSession()` |
| `src/components/OpenCalculator.tsx` | `authService` → `useSession()` (3 pontos) |
| `src/services/annualGoalService.ts` | localStorage → `getAuthTokenSync()` |
| `src/services/pricingAdminService.ts` | localStorage → `getAuthTokenSync()` |
| `src/services/jobsService.ts` | localStorage → `getAuthTokenSync()` |
| `src/services/authService.ts` | Marcado como DEPRECATED/TRANSITIONAL |

---

## 7. Dependências Legadas Restantes

| Dependência | Tipo | Risco | Plano |
|-------------|------|-------|-------|
| `openApi.ts` (Laravel client) | Bridge ativa | Baixo | Manter enquanto API Laravel atender CRUD de usuários/empresas/parceiros |
| `authService.ts` | Bridge transitória | Baixo | Marcado como deprecated; será removido quando todos os consumers migrarem |
| `partnerAuthService` | Domínio separado | Baixo | Parceiros têm fluxo de auth independente via Laravel |
| `academyAuthService` | Domínio separado | Baixo | Academy usa Laravel para criação de conta |
| `support_queue_members.user_id` (integer) | Schema legado | Médio | Migrar para UUID em fase futura |
| `proposal_participants.external_user_id` (integer) | Schema legado | Baixo | Dependência da API Laravel |

---

## 8. Riscos Remanescentes

| Risco | Severidade | Mitigação |
|-------|------------|-----------|
| Edge Functions do `core-open` externo precisam de deploy manual | Média | Documentado; as funções neste projeto (Lovable Cloud) já foram atualizadas |
| `EXTERNAL_AUTH_URL` não configurado = tokens Laravel rejeitados | Alta | Configurar EXTERNAL_AUTH_URL ou migrar todos os consumidores para Supabase JWT |
| Parceiros (level 200) usam autenticação Laravel separada | Baixa | Design intencional; fluxo isolado |
| `getEffectiveRoles` fallback por level | Baixa | Funcional; eliminar quando 100% dos users tiverem roles semeadas |

---

## 9. CORE Pronto para SALES OPEN?

### ✅ SIM — com ressalvas documentadas

**Justificativa técnica:**

1. **Identidade**: UUID é a identidade operacional em todos os fluxos críticos. `auth.uid()` é usado consistentemente.

2. **Autenticação**: Supabase Auth é a fonte de verdade. Nenhum fluxo principal depende de `open_auth_session_v1`.

3. **RBAC**: Modelo roles-first totalmente funcional com seed de 12 roles, helpers consistentes e fallback automático por level.

4. **Edge Functions**: Validação JWT real em todas as funções protegidas. Stubs de comprimento removidos.

5. **Token Resolution**: `getAuthTokenSync()` centralizado garante que qualquer sessão (Supabase ou legado) funcione transparentemente.

6. **Build**: 0 erros TypeScript.

**Ressalvas para SALES OPEN:**

- Configurar `EXTERNAL_AUTH_URL` antes de permitir tokens Laravel nas Edge Functions deste projeto
- Não criar novas dependências em openApi.ts / API Laravel
- Usar `useSession()` ou `useAuth()` para qualquer nova funcionalidade
- Verificar que roles estejam semeadas para todos os usuários antes de remover o fallback por level
