# PLANO 7 PASSOS — Migração de Preços para Supabase (Next.js API)

> **Objetivo**: Usar Supabase como fonte da verdade para configurações de preços (`calculator_configs`), removendo dependência do backend externo para CRUD de preços, mantendo autenticação atual via API/token e PIN (MVP).  
> **Stack**: Next.js API Routes (server) + Supabase (DB).  
> **Regra crítica**: `SUPABASE_SERVICE_ROLE_KEY` **nunca** pode ir para o client (somente server/API routes).

---

## Resumo do Plano

| Passo | Título                                                                                      | Status  |
| ----: | ------------------------------------------------------------------------------------------- | ------- |
|     1 | Criar/validar tabela Supabase `calculator_configs`                                          | ✅ DONE |
|     2 | Criar Supabase Server Client (service role) no Next.js (server-only)                        | TODO    |
|     3 | Criar Next.js API Routes GET/POST/PUT/DELETE `/api/admin/pricing` com validação Token + PIN | TODO    |
|     4 | Trocar `calculatorConfigService.ts` para usar `/api/admin/pricing` (não usar API externa)   | TODO    |
|     5 | Seed inicial: importar configs atuais para `calculator_configs`                             | TODO    |
|     6 | Ajustar tela `Precos.tsx` / `useConfigPersistence.ts` e validar CRUD                        | TODO    |
|     7 | Teste E2E: editar, salvar, recarregar, validar PIN + token                                  | TODO    |

---

## Passo 1 — Criar tabela Supabase `calculator_configs`

**Status**: ✅ DONE

**Descrição**:  
Garantir que existe a tabela `calculator_configs` no Supabase com estrutura compatível e com `updated_at` automático.

**Estrutura final**:

```sql
-- Tabela:
--   id BIGSERIAL PRIMARY KEY
--   category TEXT NOT NULL
--   section TEXT NOT NULL
--   config JSONB NOT NULL DEFAULT '[]'::jsonb
--   created_at TIMESTAMPTZ NOT NULL DEFAULT now()
--   updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
--   deleted_at TIMESTAMPTZ DEFAULT NULL
--   UNIQUE(category, section)

-- Trigger para updated_at:
CREATE OR REPLACE FUNCTION public.update_calculator_configs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER calculator_configs_updated_at_trigger
  BEFORE UPDATE ON public.calculator_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_calculator_configs_updated_at();

```
