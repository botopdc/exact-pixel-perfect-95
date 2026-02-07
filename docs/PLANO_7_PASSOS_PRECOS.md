# PLANO 7 PASSOS — Migração de Preços para Supabase

> **Objetivo**: Usar Supabase como fonte da verdade para configurações de preços (`calculator_configs`), removendo dependência do backend externo para CRUD de preços.

---

## Resumo do Plano

| Passo | Título | Status |
|-------|--------|--------|
| 1 | Criar tabela Supabase `calculator_configs` | TODO |
| 2 | Criar Supabase server client (service role) | TODO |
| 3 | Criar Edge Function GET/POST `/pricing-admin` | TODO |
| 4 | Trocar `calculatorConfigService.ts` para usar Edge Function | TODO |
| 5 | Seed inicial: importar configs atuais | TODO |
| 6 | Ajustar tela `Precos.tsx` e validar CRUD | TODO |
| 7 | Teste E2E: editar, salvar, recarregar, validar PIN | TODO |

---

## Passo 1 — Criar tabela Supabase `calculator_configs`

**Status**: TODO

**Descrição**:
Criar tabela `calculator_configs` no Supabase com estrutura compatível com o formato atual da API externa.

**Estrutura esperada**:
```sql
CREATE TABLE IF NOT EXISTS public.calculator_configs (
  id BIGSERIAL PRIMARY KEY,
  category TEXT NOT NULL,
  section TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ DEFAULT NULL,
  UNIQUE(category, section)
);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_calculator_configs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER calculator_configs_updated_at
  BEFORE UPDATE ON public.calculator_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_calculator_configs_updated_at();
```

**Onde mudar**:
- Supabase migration (criar via ferramenta de migração)

**Critério de aceite**:
- Tabela existe no Supabase
- Constraint UNIQUE(category, section) funciona
- Trigger de updated_at dispara ao fazer UPDATE

---

## Passo 2 — Criar Supabase server client (service role)

**Status**: TODO

**Descrição**:
Criar cliente Supabase com `SUPABASE_SERVICE_ROLE_KEY` para uso EXCLUSIVO em Edge Functions (nunca no client).

**Onde mudar**:
- `supabase/functions/_shared/supabaseAdmin.ts` (novo arquivo)

**Critério de aceite**:
- Arquivo criado com createClient usando service_role
- Secret `SUPABASE_SERVICE_ROLE_KEY` configurado
- Não exposto no código client-side

---

## Passo 3 — Criar Edge Function `/pricing-admin`

**Status**: TODO

**Descrição**:
Criar Edge Function para CRUD de preços com validação de:
1. Token atual (Bearer) — autenticação existente
2. Header `X-Admin-PIN` — gate de admin

**Onde mudar**:
- `supabase/functions/pricing-admin/index.ts` (novo)

**Endpoints**:
- `GET /pricing-admin` — Lista todas as configs
- `GET /pricing-admin?id=X` — Busca config por ID
- `POST /pricing-admin` — Cria nova config
- `PUT /pricing-admin?id=X` — Atualiza config
- `DELETE /pricing-admin?id=X` — Remove config (soft delete)

**Critério de aceite**:
- Retorna 401 se token inválido
- Retorna 403 se PIN incorreto
- CRUD funciona corretamente
- Resposta no formato esperado pelo frontend

---

## Passo 4 — Trocar `calculatorConfigService.ts`

**Status**: TODO

**Descrição**:
Modificar o service para usar a Edge Function `/pricing-admin` em vez da API externa `/api/calculator/config`.

**Onde mudar**:
- `src/services/calculatorConfigService.ts`

**Critério de aceite**:
- Todas as funções do service apontam para Edge Function
- Formato de request/response compatível
- Sem breaking changes para consumidores

---

## Passo 5 — Seed inicial

**Status**: TODO

**Descrição**:
Importar as configurações atuais da API externa para a tabela `calculator_configs` do Supabase.

**Onde mudar**:
- Script de seed ou rota batch na Edge Function

**Critério de aceite**:
- Todas as configs existentes migradas
- Dados consistentes com API externa
- Sem duplicatas

---

## Passo 6 — Ajustar tela `Precos.tsx`

**Status**: TODO

**Descrição**:
Garantir que a tela de Configuração de Preços funciona com o novo service.

**Onde mudar**:
- `src/pages/Precos.tsx`
- `src/hooks/useConfigPersistence.ts` (se existir)

**Critério de aceite**:
- Listagem carrega do Supabase
- Edição salva no Supabase
- Criação de novos itens funciona
- Deleção funciona (soft delete)

---

## Passo 7 — Teste E2E

**Status**: TODO

**Descrição**:
Validar fluxo completo de ponta a ponta.

**Testes**:
1. Editar um preço existente → Salvar → Recarregar página → Confirmar persistência
2. Criar novo item → Verificar na lista
3. Deletar item → Verificar remoção
4. Tentar acessar sem PIN → Deve bloquear
5. Tentar acessar sem token → Deve retornar 401

**Critério de aceite**:
- Todos os testes passam
- Console sem erros
- Dados persistem entre sessões

---

## Restrições do MVP

- ❌ NÃO usar Supabase Auth agora (manter token atual)
- ❌ NÃO expor Service Role no client
- ✅ Token atual continua sendo a autenticação
- ✅ PIN continua sendo o gate do admin
