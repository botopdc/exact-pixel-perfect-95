# PLANO DOS 7 PASSOS - Fluxo de Propostas OPEN

> Consolidado a partir do contexto do chat. Última atualização: 2026-02-07

## Status Geral

| Passo | Título | Status |
|-------|--------|--------|
| 1 | Fixar envio de e-mail + status SENT | ✅ DONE |
| 2 | Persistir APPROVED/REJECTED na aprovação | ✅ DONE |
| 3 | Restaurar ação "Enviar para Aprovação" | ✅ DONE |
| 4 | Restaurar ação PDF robusto | ✅ DONE |
| 5 | Validar fluxo completo via Edge Functions | ✅ DONE |
| 6 | Garantir tracking de eventos | ✅ DONE |
| 7 | Checklist final de qualidade | ✅ DONE |

---

## Passo 1: Fixar envio de e-mail + status SENT
**Status:** ✅ DONE

### Descrição
- Função `handleSendEmail` deve validar `proposalId` e `email`
- Chamar `supabase.functions.invoke('send-proposal-email')`
- Em sucesso: registrar tracking `email_sent` e atualizar status para `Enviado` se era `Rascunho`
- Loading state por proposalId

### Onde mudar
- `src/components/SupabaseProposalsList.tsx`

### Critério de aceite
- [x] Botão de email aparece na lista
- [x] Loading spinner durante envio
- [x] Toast de sucesso/erro
- [x] Status muda de Rascunho → Enviado

---

## Passo 2: Persistir APPROVED/REJECTED na aprovação
**Status:** ✅ DONE

### Descrição
- Botão "Aprovar" deve gravar `status = 'Aprovado'`
- Botão "Rejeitar" deve gravar `status = 'Reprovado'`
- Registrar eventos de tracking
- Idempotência: se já aprovado/rejeitado, desabilitar botões

### Onde mudar
- `src/pages/PropostaAprovar.tsx`

### Critério de aceite
- [x] Proposta aprovada persiste status no DB
- [x] Proposta rejeitada persiste status no DB
- [x] Não permite aprovar/rejeitar novamente

---

## Passo 3: Restaurar ação "Enviar para Aprovação"
**Status:** ✅ DONE

### Descrição
- Botão de link deve aparecer para todos internos exceto arquitetos (level 690)
- Tooltip: "Enviar para aprovação (gerar link)"
- Gerar link tokenizado via `getApprovalLink()`
- Fallback Safari com modal
- Atualizar status para `Enviado` se era `Rascunho`

### Onde mudar
- `src/components/SavedProposals.tsx`
- `src/components/SupabaseProposalsList.tsx`

### Critério de aceite
- [x] Botão de link visível para usuários internos (não arquitetos)
- [x] Link copiado para clipboard ou modal aberto
- [x] Status atualizado automaticamente

---

## Passo 4: Restaurar ação PDF robusto
**Status:** ✅ DONE

### Descrição
- Se `proposal.result.rows` vazio, buscar proposta completa antes de gerar PDF
- Loading state por proposalId
- Tracking `pdf_download`

### Onde mudar
- `src/components/SavedProposals.tsx`
- `src/components/SupabaseProposalsList.tsx`

### Critério de aceite
- [x] PDF gerado mesmo para propostas sem dados em memória
- [x] Loading spinner durante geração
- [x] Toast de sucesso

---

## Passo 5: Validar fluxo via Edge Functions
**Status:** ✅ DONE

### Descrição
- Verificar que `proposal-list`, `proposal-get`, `proposal-save` funcionam
- Verificar que `send-proposal-email` envia corretamente
- Verificar autenticação CORE token

### Onde mudar
- `supabase/functions/proposal-list/index.ts`
- `supabase/functions/proposal-get/index.ts`
- `supabase/functions/proposal-save/index.ts`
- `supabase/functions/send-proposal-email/index.ts`

### Critério de aceite
- [x] Listar propostas retorna dados corretos
- [x] Buscar proposta por ID funciona
- [x] Salvar proposta persiste no DB
- [x] Email é enviado com sucesso

---

## Passo 6: Garantir tracking de eventos
**Status:** ✅ DONE

### Descrição
- Implementar tracking persistente no Supabase (não localStorage)
- Criar Edge Function `proposal-track` para bypass RLS
- Criar serviço `proposalTrackingService.ts`
- Integrar nos componentes: email, link, PDF, aprovação, rejeição

### Onde mudar
- `supabase/functions/proposal-track/index.ts` (NOVO)
- `src/services/proposalTrackingService.ts` (NOVO)
- `src/components/SupabaseProposalsList.tsx`
- `src/pages/PropostaAprovar.tsx`

### Critério de aceite
- [x] Edge Function `proposal-track` funcionando
- [x] Eventos aparecem na tabela `proposal_views`
- [x] Campos `source`, `proposal_id` preenchidos

---

## Passo 7: Checklist final de qualidade
**Status:** ✅ DONE

### Descrição
- Verificar console sem erros
- Verificar todas as rotas carregam
- Verificar persistência de dados
- Verificar chamadas de API

### Critério de aceite
- [x] Edge Functions deployadas e funcionais
- [x] Tracking persistindo no banco
- [x] Propostas listando corretamente
- [x] UI responsiva e funcional
