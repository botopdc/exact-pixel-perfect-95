# FASE 7 — Atualização da Documentação Oficial

Data: 2026-03-19  
Status: ✅ Concluído

---

## 1. Documentos Atualizados

### 1.1 OPEN_SUPPORT_DATA_MODEL (docs/data/)
- **v1 → v2**: Adicionadas seções de identidade (profiles, roles, user_roles)
- UUID como identidade padrão em todos os campos `*_user_id`
- `legacy_user_id` documentado como ponte de compatibilidade
- Campos `resolved_by_user_id` e `closed_by_user_id` atualizados de integer para UUID
- Seção de campos legados com status de migração
- RLS atualizada incluindo profiles e user_roles

### 1.2 OPEN_SUPPORT_RBAC (docs/security/)
- **v1 → v2**: Modelo Roles-First documentado
- Supabase Auth como provedor de identidade
- Tabela de papéis com role_slug + level legado
- Matriz de permissões por role (não mais por level)
- Pseudocódigo atualizado para roles-first com fallback level
- Helpers frontend documentados (`getEffectiveRoles`, `hasRole`, etc.)
- `has_role()` SQL helper documentado

### 1.3 OPEN_SUPPORT_API_REFERENCE (docs/api/)
- **v1 → v2**: Supabase Auth JWT como autenticação primária
- Token legado marcado como compatibilidade
- `getAuthTokenSync()` documentado
- `user_id` atualizado para UUID em todos os payloads
- Ações agora documentadas por role (não level)
- Seção de Edge Functions de propostas/contratos adicionada
- Endpoints legados Laravel marcados com status (⚠️ Descontinuar / ✅ Ativo)
- Edge Functions de infraestrutura documentadas (user-backfill, send-password-reset)

### 1.4 OPEN_SUPPORT_RUNBOOK (docs/runbooks/)
- **v1 → v2**: Nova seção 9 — Autenticação e Identidade
- Fluxo de login Supabase Auth documentado
- Seed de admin inicial
- Onboarding de usuários legados (backfill)
- Troubleshooting de sessão/profile/roles (6 cenários)
- Referências a roles no lugar de levels em procedimentos operacionais

### 1.5 OPEN_SUPPORT_ARCHITECTURE (docs/architecture/)
- **v1 → v2**: Identity Layer adicionada ao diagrama
- AuthContext → useSession → getEffectiveRoles no diagrama
- Auth Layer (auth.users → profiles → user_roles) no Supabase
- profiles e user_roles no schema PostgreSQL
- Segurança atualizada: Supabase Auth JWT como primário
- Mapeamento de IDs com status pós-cutover
- Seção "Base para SALES OPEN" adicionada
- API legada marcada como compatibilidade temporária

### 1.6 Conteúdo inline (src/data/docs/content.ts)
- `core/open_system_architecture`: Stack atualizado (Supabase Auth nativo), seções de identidade unificada e Roles-First, estrutura de pastas com contexts/hooks
- `core/open_business_rules`: Modelo de identidade, tabela de roles com slugs, regras de atendimento atualizadas
- `core/open_module_map`: Acesso por role (não level), Admin com rota de backfill, seção de identidade unificada, dependências atualizadas, seção "Base para SALES OPEN"

---

## 2. Pontos Ainda Temporários

| Item | Status | Observação |
|------|--------|------------|
| `support_queue_members.user_id` (integer) | ⚠️ Legado | Migração para UUID pendente |
| `support_oncall.user_id` (integer) | ⚠️ Legado | Migração para UUID pendente |
| `profiles.level_legacy` | ⚠️ Temporário | Fallback para roles; remover quando todas as roles estiverem populadas |
| `getEffectiveRoles` fallback por level | ⚠️ Temporário | Eliminar quando user_roles cobrir 100% dos usuários |
| Endpoints Laravel (`/api/auth/*`) | ⚠️ Descontinuar | Manter apenas `/api/company` e `/api/partner` |
| `external_user_id` em `proposal_participants` | ⚠️ Integer | Dependência da API Laravel externa |
| `tech_users` para RLS de suporte | ⚠️ Transição | Migrar para `has_role()` + `user_roles` |

---

## 3. Riscos para SALES OPEN

| Risco | Mitigação |
|-------|-----------|
| Roles não populadas para todos os usuários | `getEffectiveRoles` usa fallback level automaticamente |
| Edge Functions ainda aceitam level como fallback | Documentado; priorizar roles no SALES OPEN |
| `support_queue_members` ainda usa integer | Não afeta SALES OPEN (módulo comercial) |
| Endpoints legados ainda ativos | Documentados como ⚠️; não criar novas dependências |
