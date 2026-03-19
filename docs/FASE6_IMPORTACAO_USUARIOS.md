# FASE 6 — Importação de Usuários do Legado para Supabase Auth

**Data:** 2026-03-19  
**Status:** ✅ Implementado

---

## 1. Estratégia de Importação

### Fonte de Dados
- **API Legada**: `GET /api/user?__perPage=500` via `openApi.getUsers()`
- **Fallback**: Payload piloto hardcoded com 6 usuários internos

### Fluxo Completo
```
[API Legada] → fetchLegacyUsers() → [Dry Run] → [Reconcile Check] → [Reconcile Fix] → [Real Backfill] → [Send Invite]
```

### Campos Importados
| Campo Legado     | Campo Supabase Profile  | Observação                  |
|------------------|-------------------------|-----------------------------|
| `id`             | `legacy_user_id`        | Ponte de compatibilidade    |
| `name`           | `name`, `full_name`     | Populado em ambos           |
| `email`          | `email`                 | Chave principal de match    |
| `level`          | `level`, `level_legacy` | Ambos populados             |
| `entity_id`      | `entity_id`             | Vinculação organizacional   |
| `deleted_at`     | `is_active`             | `null` = ativo              |

---

## 2. Regras de Reconciliação

### Chave de Match
- **Email** é a chave principal (case-insensitive, trimmed)

### Cenários
| Cenário | Ação |
|---------|------|
| Profile + Auth existem com mesmo email | `skipped_exists` — atualiza campos ausentes |
| Auth existe mas profile não | Cria profile vinculado ao auth user |
| Nenhum existe | Cria auth.user + profile |
| Email inválido/vazio | `invalid_email` — fila de exceção |
| Email duplicado no payload | `duplicate_email` — fila de exceção |
| `legacy_user_id` conflito com DB | `error` — bloqueante, requer ação manual |

### Proteções
- **Dry Run**: 100% read-only, nenhuma escrita no banco
- **Pilot Batch**: só executa se zero inconsistências
- **Não sobrescreve** profiles/auth users criados manualmente

---

## 3. Campos Populados no Profile

```sql
profiles.email         ← legacyUser.email
profiles.name          ← legacyUser.name
profiles.full_name     ← legacyUser.name
profiles.legacy_user_id ← legacyUser.id
profiles.level         ← legacyUser.level
profiles.level_legacy  ← legacyUser.level
profiles.entity_id     ← legacyUser.entity_id
profiles.is_active     ← (deleted_at == null)
```

---

## 4. Roles Atribuídas por Level

| Level | Roles atribuídas |
|-------|------------------|
| 1000  | `admin`, `internal_user` |
| 950   | `gerente_suporte`, `internal_user` |
| 900   | `suporte`, `internal_user` |
| 775   | `cs`, `internal_user` |
| 750   | `gerente_comercial`, `internal_user` |
| 700   | `comercial`, `internal_user` |
| 690   | `arquiteto`, `internal_user` |
| 680   | `bdr`, `internal_user` |
| 600   | `rh`, `internal_user` |

---

## 5. Onboarding — Fluxo de Ativação

### Opções
1. **Convite automático no backfill**: Toggle "Enviar convites" na UI
2. **Convite individual**: Botão "Enviar Convite" por usuário

### Processo
1. `auth.admin.generateLink({ type: "recovery" })` gera token
2. Email enviado via **Resend** com template de ativação
3. Usuário clica → redireccionado para `/reset-password`
4. Define senha → conta ativada nativamente no Supabase Auth

### Validade do link: 60 minutos

---

## 6. Tratamento de Exceções

| Tipo | Tratamento |
|------|------------|
| Email inválido | Flagged como `invalid_email`, bloqueante |
| Email duplicado no payload | Flagged como `duplicate_email`, bloqueante |
| `legacy_user_id` duplicado | Flagged como `duplicate_legacy_id`, bloqueante |
| Conflito de `legacy_user_id` no DB | Flagged como `error`, requer correção manual |
| Auth user existe sem profile | Auto-link via insert |
| Profile existe sem `level_legacy` | Fix via `reconcile_fix:fix_level_legacy` |
| Profile existe sem `full_name` | Fix via `reconcile_fix:fix_full_name` |

---

## 7. Possíveis Conflitos

1. **Emails duplicados na API legada**: Detectados pelo dry run, bloqueiam batch
2. **`legacy_user_id` atribuído a email diferente**: Requer resolução manual
3. **Usuários com `deleted_at` preenchido**: Importados como `is_active=false`, sem convite
4. **Senha temporária**: Gerada com UUID + sufixo seguro, nunca exposta

---

## 8. Arquivos Alterados

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/user-backfill/index.ts` | +`send_invite`, +`level_legacy`/`full_name`, +`fix_full_name`/`fix_level_legacy` |
| `src/services/backfillService.ts` | Reescrito: `fetchLegacyUsers()`, serviço tipado |
| `src/pages/modules/admin/BackfillReconciliationPage.tsx` | UI completa: import dinâmico, toggle convites, botão invite individual |

---

## 9. Riscos para SALES OPEN

| Risco | Mitigação |
|-------|-----------|
| Importação acidental de usuários de produção | Dry run obrigatório + piloto bloqueante |
| Emails de ativação para contas de teste | Toggle de convites desativado por default |
| Conflito com contas existentes | Match por email, nunca sobrescreve auth users |
