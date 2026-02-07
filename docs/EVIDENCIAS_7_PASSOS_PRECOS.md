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

## Passo 2 — Criar Edge Function `/pricing-admin`

**Data**: 2026-02-07
**Status**: ✅ DONE

### Decisão de Arquitetura

O projeto usa **Vite + React**, não Next.js. Portanto, não existem API Routes server-side.
A solução correta para manter a `SERVICE_ROLE_KEY` segura é usar **Edge Functions** do Supabase.

### O que foi feito

1. **Edge Function criada**: `supabase/functions/pricing-admin/index.ts`
   - Usa `SUPABASE_SERVICE_ROLE_KEY` (acesso privilegiado)
   - Valida `X-Admin-PIN` header (MVP security gate)
   - Valida `Authorization` header (token externo)
   - Suporta GET, POST, PUT, DELETE
   - CORS configurado corretamente

2. **Config atualizada**: `supabase/config.toml`
   ```toml
   [functions.pricing-admin]
   verify_jwt = false
   ```

3. **Deploy realizado**: Edge Function deployada com sucesso

### Trecho do código principal

```typescript
// Create Supabase client with SERVICE_ROLE_KEY (privileged access)
const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);
```

### Testes realizados

1. **GET com PIN correto**:
   ```
   Headers: Authorization: Bearer test-token, x-admin-pin: 5678
   Response: 200 OK
   Body: {"data": []}
   ```

2. **GET com PIN incorreto**:
   ```
   Headers: Authorization: Bearer test-token, x-admin-pin: wrong-pin
   Response: 401 Unauthorized
   Body: {"error": "Invalid admin PIN"}
   ```

3. **GET sem Authorization**:
   ```
   Headers: x-admin-pin: 5678
   Response: 401 Unauthorized
   Body: {"error": "Missing or invalid authorization token"}
   ```

### Arquivos alterados

- `supabase/functions/pricing-admin/index.ts` (CRIADO)
- `supabase/config.toml` (ATUALIZADO)

### Resultado

- ✅ Edge Function deployada e funcional
- ✅ SERVICE_ROLE_KEY protegida (apenas server-side)
- ✅ PIN bloqueia acesso não autorizado
- ✅ CORS configurado para chamadas do frontend

---

## Passo 3 — Criar serviço client `pricingAdminService.ts`

**Data**: 2026-02-07
**Status**: ✅ DONE

### O que foi feito

1. **Serviço criado**: `src/services/pricingAdminService.ts`
   - Consome Edge Function `/pricing-admin`
   - Valida token de autenticação do localStorage
   - Passa `X-Admin-PIN` em todas as requisições
   - Suporta GET, POST, PUT, DELETE

2. **Funções implementadas**:
   - `getAllConfigs(pin, filters?)` - Lista configs
   - `createConfig(pin, payload)` - Cria novo
   - `updateConfig(pin, id, payload)` - Atualiza existente
   - `deleteConfig(pin, id)` - Soft delete
   - `getConfigByPath(pin, category, section)` - Busca específica
   - `upsertConfig(pin, category, section, config)` - Create/Update
   - `isValidPin(pin)` - Validação de PIN

### Trecho do código principal

```typescript
function buildHeaders(adminPin: string): HeadersInit {
  const token = getAuthToken();
  
  if (!token) {
    throw new Error('Usuário não autenticado. Faça login novamente.');
  }
  
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'apikey': SUPABASE_ANON_KEY,
    'x-admin-pin': adminPin,
  };
}
```

### Como usar

```typescript
import pricingAdminService from '@/services/pricingAdminService';

// Listar todas as configs
const configs = await pricingAdminService.getAllConfigs('5678');

// Atualizar uma config específica
await pricingAdminService.updateConfig('5678', 1, {
  config: [{ label: 'vCPU', value: 50, by: 'unit', type: 'BRL' }]
});
```

### Arquivos criados

- `src/services/pricingAdminService.ts`

### Resultado

- ✅ Serviço client criado e tipado
- ✅ Integração com Edge Function pricing-admin
- ✅ Validação de auth token
- ✅ Header X-Admin-PIN em todas as requisições

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
