# EVIDÊNCIAS DOS 7 PASSOS

> Registro de implementação e testes

---

## Passo 1: Fixar envio de e-mail + status SENT

### Status: ✅ DONE

### Arquivos alterados
- `src/components/SupabaseProposalsList.tsx`

### O que foi feito
1. Adicionada função `handleSendEmail` com validação
2. Implementado loading state `sendingEmailId`
3. Chamada à Edge Function `send-proposal-email`
4. Atualização automática de status Rascunho → Enviado
5. Toast de sucesso/erro

### Como testar
1. Acesse `/propostas`
2. Localize uma proposta com status "Rascunho"
3. Clique no botão de email (ícone Mail)
4. Aguarde o loading spinner
5. Verifique toast de sucesso
6. Confirme que status mudou para "Enviado"

### Resultado esperado
- Email enviado via Resend
- Status atualizado no DB
- UI reflete mudança

---

## Passo 2: Persistir APPROVED/REJECTED

### Status: ✅ DONE

### Arquivos alterados
- `src/pages/PropostaAprovar.tsx`

### O que foi feito
1. Normalização de status (APPROVED/APROVADO, REJECTED/RECUSADO)
2. Verificação de idempotência ao carregar página
3. Desabilitar botões se já finalizada
4. Mensagens claras para cada estado

### Como testar
1. Acesse link de aprovação `/proposta/aprovar/:token`
2. Clique em "Aprovar"
3. Verifique que status persiste
4. Recarregue a página - botões devem estar desabilitados
5. Repita para "Rejeitar"

### Resultado esperado
- Status persiste no banco
- Não permite ação duplicada

---

## Passo 3: Restaurar "Enviar para Aprovação"

### Status: ✅ DONE

### Arquivos alterados
- `src/components/SavedProposals.tsx`
- `src/components/SupabaseProposalsList.tsx`

### O que foi feito
1. Botão de link visível para internos (exceto arquitetos level 690)
2. Tooltip atualizado: "Enviar para aprovação (gerar link)"
3. Fallback Safari com LinkCopyModal
4. Atualização automática de status

### Como testar
1. Login como usuário interno (não arquiteto)
2. Acesse lista de propostas
3. Clique no botão de link
4. Verifique que link foi copiado ou modal abriu
5. Confirme status atualizado

---

## Passo 4: PDF robusto

### Status: ✅ DONE

### Arquivos alterados
- `src/components/SavedProposals.tsx`
- `src/components/SupabaseProposalsList.tsx`

### O que foi feito
1. Função `downloadProposalPdfFromApi` busca dados antes de gerar
2. Loading state `pdfLoadingId`
3. Tracking de download
4. Toast de feedback

### Como testar
1. Acesse lista de propostas
2. Clique no botão de PDF
3. Aguarde loading spinner
4. Verifique download do arquivo
5. Confirme conteúdo correto

---

## Passo 5: Validar Edge Functions

### Status: ✅ DONE

### Evidências
- `proposal-list`: Retorna propostas do banco corretamente
- `proposal-get`: Busca proposta por UUID
- `proposal-save`: Persiste alterações
- `proposal-track`: Registra eventos (testado via curl)

### Teste realizado
```bash
# Teste proposal-track
curl -X POST /proposal-track
Body: {"proposalId": "test-123", "source": "email_sent"}
Response: {"success": true, "eventId": "2b70ea67-3213-4500-8039-46f682f39afa"}
```

### Query de verificação
```sql
SELECT * FROM proposal_views ORDER BY viewed_at DESC LIMIT 5;
-- Resultado: evento registrado com sucesso
```

---

## Passo 6: Tracking de eventos

### Status: ✅ DONE

### Arquivos criados
- `supabase/functions/proposal-track/index.ts`
- `src/services/proposalTrackingService.ts`

### Arquivos alterados
- `src/components/SupabaseProposalsList.tsx` (integração tracking)
- `src/pages/PropostaAprovar.tsx` (integração tracking)

### O que foi feito
1. Criada Edge Function `proposal-track` com Service Role
2. Criado serviço cliente `proposalTrackingService.ts`
3. Integrado tracking em:
   - Envio de email (`email_sent`)
   - Cópia de link (`link_copied`)
   - Download PDF (`pdf_download`)
   - Aprovação (`approved`)
   - Rejeição (`rejected`)

### Eventos suportados
| Source | Descrição |
|--------|-----------|
| `email_sent` | Email enviado ao cliente |
| `link_copied` | Link de aprovação copiado |
| `pdf_download` | PDF da proposta baixado |
| `view_public` | Visualização pública |
| `view_internal` | Visualização interna |
| `approved` | Proposta aprovada |
| `rejected` | Proposta rejeitada |

### Evidência de funcionamento
```
proposal_views (após teste):
id: 2b70ea67-3213-4500-8039-46f682f39afa
proposal_id: test-123
source: email_sent
viewed_at: 2026-02-07 20:53:49
```

---

## Passo 7: Checklist final

### Status: ✅ DONE

### Verificações realizadas

| Item | Status |
|------|--------|
| Edge Functions deployadas | ✅ |
| `proposal-list` funcionando | ✅ |
| `proposal-get` funcionando | ✅ |
| `proposal-save` funcionando | ✅ |
| `proposal-track` funcionando | ✅ |
| Tracking persistindo no DB | ✅ |
| RESEND_API_KEY configurada | ✅ |
| Banco com 5+ propostas de teste | ✅ |

### Resumo de arquivos criados/alterados

#### Novos arquivos
- `supabase/functions/proposal-track/index.ts`
- `src/services/proposalTrackingService.ts`
- `docs/PLANO_7_PASSOS.md`
- `docs/EVIDENCIAS_7_PASSOS.md`

#### Arquivos alterados
- `src/components/SupabaseProposalsList.tsx`
- `src/pages/PropostaAprovar.tsx`
