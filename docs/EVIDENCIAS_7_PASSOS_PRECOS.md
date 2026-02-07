# EVIDÊNCIAS 7 PASSOS — Migração de Preços para Supabase

> Log de execução e evidências de cada passo implementado.

---

## Passo 1 — Criar tabela Supabase `calculator_configs`

**Data**: 2026-02-07
**Status**: ✅ DONE

### O que foi feito

1. **Verificação inicial**: A tabela `calculator_configs` já existia no Supabase com a estrutura correta:
   - `id` BIGSERIAL PRIMARY KEY
   - `category` TEXT NOT NULL
   - `section` TEXT NOT NULL
   - `config` JSONB NOT NULL DEFAULT '[]'
   - `created_at` TIMESTAMPTZ DEFAULT now()
   - `updated_at` TIMESTAMPTZ DEFAULT now()
   - `deleted_at` TIMESTAMPTZ (nullable)

2. **Constraints verificadas**:
   - `calculator_configs_pkey` (PRIMARY KEY)
   - `calculator_configs_category_section_key` (UNIQUE on category, section)

3. **Trigger adicionado**: O trigger de `updated_at` não existia. Foi criado via migration:
   ```sql
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

### Arquivos alterados

- Nenhum arquivo de código alterado
- Migration SQL executada no Supabase

### Como testar

1. Conectar ao Supabase e verificar a tabela:
   ```sql
   SELECT column_name, data_type, is_nullable 
   FROM information_schema.columns 
   WHERE table_name = 'calculator_configs';
   ```

2. Verificar constraints:
   ```sql
   SELECT conname, contype 
   FROM pg_constraint 
   WHERE conrelid = 'public.calculator_configs'::regclass;
   ```

3. Verificar trigger:
   ```sql
   SELECT trigger_name 
   FROM information_schema.triggers 
   WHERE event_object_table = 'calculator_configs';
   ```

4. Testar trigger (UPDATE deve atualizar `updated_at`):
   ```sql
   UPDATE calculator_configs 
   SET config = config 
   WHERE id = 1;
   
   SELECT id, updated_at FROM calculator_configs WHERE id = 1;
   ```

### Resultado

- ✅ Tabela existe com estrutura correta
- ✅ Constraint UNIQUE(category, section) presente
- ✅ Trigger `calculator_configs_updated_at_trigger` criado e funcional
- ✅ RLS desabilitado (acesso será controlado via Edge Function com PIN)

---

## Passo 2 — Criar Supabase server client

**Data**: (pendente)
**Status**: TODO

### O que foi feito
(pendente)

### Arquivos alterados
(pendente)

### Como testar
(pendente)

### Resultado
(pendente)

---

## Passo 3 — Criar Edge Function `/pricing-admin`

**Data**: (pendente)
**Status**: TODO

### O que foi feito
(pendente)

### Arquivos alterados
(pendente)

### Como testar
(pendente)

### Resultado
(pendente)

---

## Passo 4 — Trocar `calculatorConfigService.ts`

**Data**: (pendente)
**Status**: TODO

### O que foi feito
(pendente)

### Arquivos alterados
(pendente)

### Como testar
(pendente)

### Resultado
(pendente)

---

## Passo 5 — Seed inicial

**Data**: (pendente)
**Status**: TODO

### O que foi feito
(pendente)

### Arquivos alterados
(pendente)

### Como testar
(pendente)

### Resultado
(pendente)

---

## Passo 6 — Ajustar tela `Precos.tsx`

**Data**: (pendente)
**Status**: TODO

### O que foi feito
(pendente)

### Arquivos alterados
(pendente)

### Como testar
(pendente)

### Resultado
(pendente)

---

## Passo 7 — Teste E2E

**Data**: (pendente)
**Status**: TODO

### O que foi feito
(pendente)

### Arquivos alterados
(pendente)

### Como testar
(pendente)

### Resultado
(pendente)
