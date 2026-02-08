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

**Data**: 2026-02-07 (atualizado 2026-02-08)
**Status**: ✅ DONE

### Decisão de Arquitetura

O projeto usa **Vite + React**, não Next.js. Portanto, não existem API Routes server-side.
A solução correta para manter a `SERVICE_ROLE_KEY` segura é usar **Edge Functions** do Supabase.

### O que foi feito

1. **Módulo shared criado**: `supabase/functions/_shared/supabaseAdmin.ts`
   - `getSupabaseAdmin()` - Client singleton com SERVICE_ROLE_KEY
   - `validateExternalToken(token)` - Stub configurável via EXTERNAL_AUTH_URL
   - `validateAdminPin(pin)` - Validação via env ADMIN_PIN

2. **Edge Function atualizada**: `supabase/functions/pricing-admin/index.ts`
   - GET: Lista configs ou busca por ?id=X
   - POST: Upsert por (category, section)
   - PUT ?id=X: Update por ID
   - DELETE ?id=X: Soft delete (set deleted_at)
   - Segurança: 401 sem token, 403 se PIN inválido

3. **Config**: `supabase/config.toml`
   ```toml
   [functions.pricing-admin]
   verify_jwt = false
   ```

### Secrets necessários

| Secret | Descrição |
|--------|-----------|
| `SUPABASE_URL` | URL do projeto Supabase (automático) |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave privilegiada (automático) |
| `ADMIN_PIN` | PIN de segurança (default: 5678) |
| `EXTERNAL_AUTH_URL` | (opcional) URL para validação externa de token |

### Trecho do código principal

```typescript
// _shared/supabaseAdmin.ts
export function getSupabaseAdmin(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

export async function validateExternalToken(token: string) {
  const externalAuthUrl = Deno.env.get("EXTERNAL_AUTH_URL");
  if (externalAuthUrl) {
    // Real validation via external API
    const response = await fetch(`${externalAuthUrl}/validate`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return { valid: response.ok };
  }
  // MVP stub: accept if length >= 10
  return { valid: token.length >= 10 };
}
```

### Como testar via cURL

**1. GET - Listar todas as configs:**
```bash
curl -X GET \
  "https://macmkfoknhofnwhizsqc.supabase.co/functions/v1/pricing-admin" \
  -H "Authorization: Bearer SEU_TOKEN_AQUI" \
  -H "x-admin-pin: 5678" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**2. GET - Buscar por ID:**
```bash
curl -X GET \
  "https://macmkfoknhofnwhizsqc.supabase.co/functions/v1/pricing-admin?id=1" \
  -H "Authorization: Bearer SEU_TOKEN_AQUI" \
  -H "x-admin-pin: 5678" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**3. POST - Upsert config:**
```bash
curl -X POST \
  "https://macmkfoknhofnwhizsqc.supabase.co/functions/v1/pricing-admin" \
  -H "Authorization: Bearer SEU_TOKEN_AQUI" \
  -H "x-admin-pin: 5678" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "category": "cloud",
    "section": "vcpu",
    "config": [{"label": "vCPU", "value": 50, "by": "unit", "type": "BRL"}]
  }'
```

**4. PUT - Update por ID:**
```bash
curl -X PUT \
  "https://macmkfoknhofnwhizsqc.supabase.co/functions/v1/pricing-admin?id=1" \
  -H "Authorization: Bearer SEU_TOKEN_AQUI" \
  -H "x-admin-pin: 5678" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{"config": [{"label": "vCPU", "value": 55, "by": "unit", "type": "BRL"}]}'
```

**5. DELETE - Soft delete:**
```bash
curl -X DELETE \
  "https://macmkfoknhofnwhizsqc.supabase.co/functions/v1/pricing-admin?id=1" \
  -H "Authorization: Bearer SEU_TOKEN_AQUI" \
  -H "x-admin-pin: 5678" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Respostas esperadas

| Cenário | Status | Body |
|---------|--------|------|
| Sucesso GET lista | 200 | `{"data": [...]}` |
| Sucesso GET by id | 200 | `{"data": {...}}` |
| Sucesso POST create | 201 | `{"data": {...}, "action": "created"}` |
| Sucesso POST update | 200 | `{"data": {...}, "action": "updated"}` |
| Sucesso PUT | 200 | `{"data": {...}}` |
| Sucesso DELETE | 200 | `{"data": {...}, "message": "Config soft-deleted"}` |
| Sem Authorization | 401 | `{"error": "Missing or invalid authorization token"}` |
| PIN inválido | 403 | `{"error": "Invalid admin PIN"}` |
| ID não encontrado | 404 | `{"error": "..."}` |

### Arquivos criados/alterados

- `supabase/functions/_shared/supabaseAdmin.ts` (CRIADO)
- `supabase/functions/pricing-admin/index.ts` (ATUALIZADO)
- `supabase/config.toml` (já configurado)

### Resultado

- ✅ Edge Function com CRUD completo
- ✅ Módulo shared reutilizável
- ✅ SERVICE_ROLE_KEY protegida (server-side only)
- ✅ Validação de token configurável (stub MVP + suporte a EXTERNAL_AUTH_URL)
- ✅ PIN via env (ADMIN_PIN) com fallback
- ✅ Soft delete implementado
- ✅ CORS configurado

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

**Data**: 2026-02-08 (refatorado)
**Status**: ✅ DONE

### O que foi feito

1. **Refatoração completa** de `src/services/calculatorConfigService.ts`:
   - Removida dependência de `pricingAdminService.ts` (simplificação)
   - Agora usa **fetch direto** para a Edge Function `/pricing-admin`
   - Removida dependência de `axios` e API externa (`VITE_API_BASE_URL`)
   - Mantida compatibilidade total com interfaces existentes

2. **Funções CORE implementadas**:
   - `getCalculatorConfigsRaw(token?, pin?)` → GET /pricing-admin
   - `upsertCalculatorConfig(token, pin, payload)` → POST /pricing-admin
   - `updateCalculatorConfigById(token, pin, id, patch)` → PUT /pricing-admin?id=X
   - `softDeleteCalculatorConfig(token, pin, id)` → DELETE /pricing-admin?id=X

3. **Funções de compatibilidade mantidas**:
   - `getCalculatorConfigsFlat()` → retorna items FLAT
   - `getCalculatorConfigs()` → retorna entries agrupadas
   - `updateCalculatorConfigItem(id, payload)` → atualiza item individual
   - `createCalculatorConfigItem(payload)` → cria item individual
   - `deleteCalculatorConfigItem(id)` → remove item do array
   - `updateCalculatorConfig(entryId, payload)` → upsert legacy

4. **Helpers mantidos**:
   - `loadFlatConfigs()`, `clearConfigCache()`, `getCachedFlatItems()`
   - `findConfigId()`, `getVmConfigIds()`, `getAddonConfigId()`
   - `getGpuConfigId()`, `getSqlConfigId()`, `getBackupConfigId()`
   - `CONFIG_MAPPINGS` (constantes de categoria/seção)

5. **Autenticação**:
   - Token: `localStorage.getItem('open_access_token')` ou `open_api_token`
   - PIN: `localStorage.getItem('open_admin_pin')` ou fallback `'5678'`

### Trecho do código principal

```typescript
// Agora usa fetch direto (sem pricingAdminService)
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

function getEdgeFunctionUrl(): string {
  return `${SUPABASE_URL}/functions/v1/pricing-admin`;
}

function buildHeaders(token: string, pin: string): HeadersInit {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'X-Admin-PIN': pin,
  };
}

export async function getCalculatorConfigsRaw(
  token?: string,
  pin?: string
): Promise<CalculatorConfigRow[]> {
  const authToken = token || getAuthToken();
  const adminPin = pin || getAdminPin();
  
  const response = await fetch(getEdgeFunctionUrl(), {
    method: 'GET',
    headers: buildHeaders(authToken, adminPin),
  });
  
  return handleResponse<CalculatorConfigRow[]>(response);
}

export async function upsertCalculatorConfig(
  token: string,
  pin: string,
  payload: { category: string; section: string; config: ConfigItem[] }
): Promise<CalculatorConfigRow> {
  const response = await fetch(getEdgeFunctionUrl(), {
    method: 'POST',
    headers: buildHeaders(token, pin),
    body: JSON.stringify(payload),
  });
  
  return handleResponse<CalculatorConfigRow>(response);
}
```

### Como testar

1. **Console do navegador** (após login):
```javascript
// Importar e carregar configs
const { getCalculatorConfigs } = await import('@/services/calculatorConfigService');
const configs = await getCalculatorConfigs();
console.log('Configs:', configs);
```

2. **Network tab**:
   - Verificar chamadas para `/functions/v1/pricing-admin`
   - Headers devem conter `Authorization: Bearer ...` e `X-Admin-PIN: ...`

3. **Tela Preços** (`/precos`):
   - Deve carregar dados normalmente
   - Edições devem salvar via Edge Function

### Arquivos alterados

- `src/services/calculatorConfigService.ts` (REFATORADO - usa fetch direto)

### Resultado

- ✅ Dependência da API externa removida
- ✅ Agora usa Edge Function /pricing-admin via fetch direto
- ✅ Não depende mais de pricingAdminService.ts (simplificado)
- ✅ Compatibilidade com UI existente mantida
- ✅ PIN e token passados corretamente via headers
- ✅ Erros logados no console

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
