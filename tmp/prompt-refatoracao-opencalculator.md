# Prompt de Refatoração: OpenCalculator

## Contexto

O componente `OpenCalculator.tsx` (3383 linhas) possui problemas ao cadastrar propostas via API. Os dados dos **servers** e **addons** não estão sendo enviados no formato correto para a API Laravel.

Uma tentativa de refatoração foi iniciada em `OpenCalculatorNovo.tsx` e **a estrutura do formulário está correta**, mas foi descontinuada. A solução é aplicar os conceitos do OpenCalculatorNovo no OpenCalculator original.

---

## Problema Atual

### Como OpenCalculator funciona HOJE (❌ INCORRETO):

1. **Estados separados e desorganizados:**
   ```typescript
   const [items, setItems] = useState<ServerItem[]>([]);
   const [addons, setAddons] = useState<AddonsState>({
     backupPlan: 'none',
     backupGb: 0,
     antivirus: 0,
     firewall: 0,
     tsplus: 0,
     cal: 0,
     sql: 'none',
     sqlQty: 0,
     // ... mais 10+ campos
   });
   const [kubernetes, setKubernetes] = useState<KubernetesState>(...);
   const [storageItems, setStorageItems] = useState<StorageItem[]>([]);
   const [openSaas, setOpenSaas] = useState<OpenSaaSState>(...);
   ```

2. **Formato incompatível com API:**
   - `items` (ServerItem[]) tem estrutura UI-friendly mas **não é o que a API espera**
   - `addons` é um objeto flat com propriedades específicas (antivirus, firewall, etc.) mas **a API espera um array**
   - Cada produto (K8s, Storage, OpenSaaS) tem estado separado mas **precisa ser enviado como servers virtuais**

3. **API espera:**
   ```typescript
   {
     servers: [
       {
         name: "VM #1",
         type: "vm",
         quantity: 1,
         specs: [
           { config_id: 123, quantity: 16 },  // vCPU
           { config_id: 124, quantity: 128 }, // RAM
           { config_id: 125, quantity: 100 }, // NVMe
           { config_id: 126, quantity: 1 },   // IP
         ]
       }
     ],
     addons: [
       { config_id: 201, quantity: 5 },  // antivirus
       { config_id: 202, quantity: 1 },  // firewall
       { config_id: 203, quantity: 0 },  // tsplus
       // ...
     ],
     contract_duration: 12,
     datacenter: "SP1",
     total: 1500.00,
     // ... mais campos
   }
   ```

---

## Solução: Como OpenCalculatorNovo Resolve (✅ CORRETO)

### 1. Hook `useForm` centralizado

```typescript
import { useForm } from "@/hooks/use-form";

const form = useForm<FormData>({
  initialData: {
    contract_duration: 12,
    datacenter: "SP1",
    validityDays: 7,
    channel_type: "PARCEIRO",
    servers: [
      {
        type: "vm",
        name: "VM #1",
        quantity: 1,
        specs: [
          { config_id: cConfig.vcpu?.id, quantity: 16 },
          { config_id: cConfig.ram?.id, quantity: 128 },
          { config_id: cConfig.nvme?.id, quantity: 100 },
          { config_id: cConfig.ipPublico?.id, quantity: 1 },
        ],
      },
    ],
    addons: [
      { config_id: cConfig.antivirus?.id, quantity: 0 },
      { config_id: cConfig.firewall?.id, quantity: 0 },
      { config_id: cConfig.tsplus?.id, quantity: 0 },
      { config_id: cConfig.cal?.id, quantity: 0 },
      // ... todos os addons possíveis com quantity: 0
    ],
  },
  onSubmit: async (data) => {
    calculatorProposalGateway.save(data);
  },
});
```

**Vantagens:**
- ✅ `form.data` já está no formato exato da API
- ✅ Não precisa transformação/conversão antes de enviar
- ✅ Fácil debugar: `console.log(form.data)` mostra exatamente o que será enviado

### 2. Hook `useCalculatorConfig` para IDs

```typescript
const cConfig = useCalculatorConfig();
// Retorna: { vcpu: {id, key, value, label}, ram: {...}, ... }
```

**Uso:**
```typescript
{ config_id: cConfig.vcpu?.id, quantity: 16 }
```

### 3. Hook `useProposalCalculator` para cálculos

```typescript
const calc = useProposalCalculator({
  proposal: form.data,
  config: cConfig
});

// Retorna:
// calc.result = [ { label, quantity, unitPrice, total, _subs: ['resources'] }, ... ]
// calc.sub = { resources: 1500, ips: 50, services: 300, backup: 100, ... }
```

**Vantagens:**
- ✅ Cálculos isolados do componente principal
- ✅ Reutilizável em outros lugares
- ✅ Categorização automática (resources, ips, services, backup, etc.)

### 4. Funções helpers para manipular form.data

```typescript
// Pegar valor de addon
function getAddonValue(config: { id: number }) {
  return form.data.addons?.find(a => a.config_id === config?.id)?.quantity || 0;
}

// Atualizar addon
function onAddonChange(e: React.ChangeEvent<HTMLInputElement>, config: { id: number }) {
  form.setData({
    ...form.data,
    addons: form.data.addons.map(addon =>
      addon.config_id === config.id
        ? { ...addon, quantity: parseInt(e.target.value) || 0 }
        : addon
    ),
  });
}

// Pegar valor de spec do servidor
function getServerSpecValue(index: number, config: { id: number }) {
  return form.data.servers[index]?.specs.find(a => a.config_id === config?.id)?.quantity || 0;
}

// Atualizar spec do servidor
function onServerSpecChange(e: React.ChangeEvent<HTMLInputElement>, index: number, config: { id: number }) {
  form.setData({
    ...form.data,
    servers: form.data.servers.map((server, i) =>
      i === index
        ? {
            ...server,
            specs: server.specs.map(spec =>
              spec.config_id === config.id
                ? { ...spec, quantity: parseInt(e.target.value) || 0 }
                : spec
            ),
          }
        : server
    ),
  });
}
```

---

## Instruções de Refatoração

### ⚠️ IMPORTANTE: Não reescrever o arquivo do zero!

O OpenCalculator tem 3383 linhas e MUITA lógica importante que funciona:
- ✅ UI/UX completa e testada
- ✅ Validações de permissões (arquitetos, parceiros, etc.)
- ✅ Integração com PDF, email, aprovações
- ✅ Modo de edição (load proposal from API)
- ✅ Suporte a Kubernetes, Storage, OpenSaaS
- ✅ Price overrides (markup manual)
- ✅ Reseller margin

### 📋 Checklist de Refatoração (em ordem):

#### **Etapa 1: Imports e Tipos**

1. ✅ Adicionar imports:
   ```typescript
   import { useForm } from "@/hooks/use-form";
   import { useCalculatorConfig } from "@/hooks/useCalculatorConfig";
   import { useProposalCalculator } from "@/hooks/use-proposal-calculator";
   import { calculatorProposalGateway, CalculatorProposal } from "@/data/calculator/calculator-proposal";
   ```

2. ✅ Criar type FormData:
   ```typescript
   type FormData = CalculatorProposal & {
     validityDays: number;
     addonSqlServer: string;
     addonSqlServerQty: number;
     planK8s?: number;
   };
   ```

#### **Etapa 2: Substituir Estados por useForm**

3. ✅ **REMOVER** estes estados:
   ```typescript
   // ❌ DELETAR
   const [items, setItems] = useState<ServerItem[]>([]);
   const [addons, setAddons] = useState<AddonsState>(...);
   const [kubernetes, setKubernetes] = useState<KubernetesState>(...);
   const [storageItems, setStorageItems] = useState<StorageItem[]>([]);
   const [openSaas, setOpenSaas] = useState<OpenSaaSState>(...);
   const [selectedTerm, setSelectedTerm] = useState("1");
   const [datacenter, setDatacenter] = useState<'SP1' | 'SP2' | 'FL1' | 'CE1'>('SP1');
   ```

4. ✅ **ADICIONAR** useForm:
   ```typescript
   const cConfig = useCalculatorConfig();

   const INITIAL_DATA: Partial<FormData> = {
     contract_duration: 12,
     datacenter: "SP1",
     validityDays: 7,
     channel_type: "PARCEIRO",
     addonSqlServer: cConfig.sqlNone?.key,
     addonSqlServerQty: 0,
     planK8s: null,
     servers: [
       {
         type: "vm",
         name: "VM #1",
         quantity: 1,
         specs: [
           { config_id: cConfig.ipPublico?.id || 0, quantity: 1 },
           { config_id: cConfig.vcpu?.id || 0, quantity: 16 },
           { config_id: cConfig.ram?.id || 0, quantity: 128 },
           { config_id: cConfig.nvme?.id || 0, quantity: 100 },
         ],
       },
     ],
     addons: [
       { config_id: cConfig.antivirus?.id || 0, quantity: 0 },
       { config_id: cConfig.tsplus?.id || 0, quantity: 0 },
       { config_id: cConfig.cal?.id || 0, quantity: 0 },
       { config_id: cConfig.firewall?.id || 0, quantity: 0 },
       { config_id: cConfig.sqlNone?.id || 0, quantity: 0 },
       { config_id: cConfig.veeamVm?.id || 0, quantity: 0 },
       { config_id: cConfig.veeamAgent?.id || 0, quantity: 0 },
       { config_id: cConfig.winserver2vcpuunid?.id || 0, quantity: 0 },
       { config_id: cConfig.consultoriaTecnica?.id || 0, quantity: 0 },
       { config_id: cConfig.dba?.id || 0, quantity: 0 },
     ],
   };

   const form = useForm<FormData>({
     initialData: INITIAL_DATA,
     onSubmit: async (data) => {
       calculatorProposalGateway.save(data);
     },
   });
   ```

5. ✅ **ADICIONAR** useProposalCalculator:
   ```typescript
   const calc = useProposalCalculator({
     proposal: form.data,
     config: cConfig
   });
   ```

#### **Etapa 3: Criar Funções Helpers**

6. ✅ Adicionar as 4 funções helpers (copiar do OpenCalculatorNovo):
   - `getAddonValue(config)`
   - `onAddonChange(e, config)`
   - `getServerSpecValue(index, config)`
   - `onServerSpecChange(e, index, config)`

#### **Etapa 4: Refatorar Função `calculate()`**

7. ✅ **DELETAR** a função `calculate()` inteira (ela tem ~400 linhas)

8. ✅ **MOTIVO:** A lógica de cálculo agora está no `useProposalCalculator`
   - Os subtotais vêm de `calc.sub.resources`, `calc.sub.ips`, etc.
   - Os rows vêm de `calc.result`

#### **Etapa 5: Refatorar `handleSave()`**

9. ✅ **ANTES** (OpenCalculator - INCORRETO):
   ```typescript
   const handleSave = async () => {
     // ... 200 linhas de transformação manual
     // Converte items[] → servers[]
     // Converte addons{} → addons[]
     // Converte kubernetes, storage, opensaas → servers virtuais
     // ...
     const payload = { /* estrutura complexa */ };
     await saveInternalProposalMutation.mutateAsync(payload);
   }
   ```

10. ✅ **DEPOIS** (OpenCalculatorNovo - CORRETO):
    ```typescript
    const handleSave = async () => {
      // Validações básicas
      if (!form.data.name || !form.data.email) {
        toast({ title: "Preencha nome e email" });
        return;
      }

      // Chama o form.submit que usa calculatorProposalGateway.save
      await form.submit();

      toast({ title: "Proposta salva com sucesso!" });
    }
    ```

**CRÍTICO:** Agora `form.data` JÁ está no formato correto! Não precisa transformação.

#### **Etapa 6: Atualizar Referências no JSX**

11. ✅ Substituir referências antigas:
    - `items` → `form.data.servers`
    - `addons.antivirus` → `getAddonValue(cConfig.antivirus)`
    - `selectedTerm` → `form.data.contract_duration`
    - `datacenter` → `form.data.datacenter`
    - `setAddons(...)` → `onAddonChange(..., cConfig.antivirus)`

12. ✅ Atualizar inputs:
    ```typescript
    // ANTES:
    <Input
      value={addons.antivirus}
      onChange={e => setAddons({...addons, antivirus: parseInt(e.target.value)})}
    />

    // DEPOIS:
    <Input
      value={getAddonValue(cConfig.antivirus)}
      onChange={e => onAddonChange(e, cConfig.antivirus)}
    />
    ```

13. ✅ Atualizar tabela de resumo:
    ```typescript
    // ANTES:
    {result?.rows.map(row => ...)}

    // DEPOIS:
    {calc.result.map(row => ...)}
    ```

14. ✅ Atualizar subtotais:
    ```typescript
    // ANTES:
    <div>Recursos: {formatCurrency(result.subRec)}</div>
    <div>IPs: {formatCurrency(result.subIps)}</div>

    // DEPOIS:
    <div>Recursos: {formatCurrency(calc.sub.resources)}</div>
    <div>IPs: {formatCurrency(calc.sub.ips)}</div>
    ```

#### **Etapa 7: Remover Código Desnecessário**

15. ✅ **DELETAR** funções que não são mais necessárias:
    - `addVM()` - agora usa `form.setData` direto
    - `addBM()` - agora usa `form.setData` direto
    - `removeItem()` - agora usa `form.setData` direto
    - `updateItem()` - agora usa `onServerSpecChange`
    - Todo código de normalização manual de dados

16. ✅ **MANTER** estas funções (ainda são necessárias):
    - `handleGeneratePDF()`
    - `handleSendEmail()`
    - `handleApprove()`
    - `handleReset()`
    - Todas as validações de permissão
    - Código de modo de edição (load from API)

#### **Etapa 8: Modo de Edição**

17. ✅ Quando carregar proposta da API para editar:
    ```typescript
    // ANTES (transformação complexa):
    const normalized = normalizeProposalForEdit(apiData);
    setItems(normalized.items);
    setAddons(normalized.addons);
    // ... 50+ linhas

    // DEPOIS (direto):
    form.setData({
      ...apiData,
      // Apenas ajustes de campos UI extras
      validityDays: calcularDiasEntreDatas(apiData.due_at),
      addonSqlServer: encontrarSqlKey(apiData.addons),
    });
    ```

---

## Arquivos de Referência

### ✅ Copiar lógica DESTES arquivos:

1. **`OpenCalculatorNovo.tsx`** (linhas 1-300):
   - Estrutura do `useForm`
   - Definição de `INITIAL_DATA`
   - Funções helpers (getAddonValue, onAddonChange, etc.)
   - Como usar `calc` do useProposalCalculator

2. **`useProposalCalculator.tsx`**:
   - Hook que faz todos os cálculos
   - Retorna `result` (array de rows) e `sub` (subtotais)

3. **`useCalculatorConfig.tsx`**:
   - Hook que retorna config parseada com IDs
   - Usar `cConfig.vcpu.id`, `cConfig.antivirus.id`, etc.

4. **`calculator-proposal.ts`**:
   - Types corretos da API
   - `calculatorProposalGateway.save(form.data)`

### ⚠️ NÃO tocar nestes arquivos:

- Manter toda a lógica de UI/UX do OpenCalculator
- Manter validações de permissão
- Manter integração PDF/Email
- Manter arquivos de serviços (authService, proposalPdfService, etc.)

---

## Resultado Final Esperado

### ✅ Após refatoração:

1. **Estado centralizado:**
   ```typescript
   form.data = {
     servers: [...],    // formato exato da API
     addons: [...],     // formato exato da API
     contract_duration: 12,
     datacenter: "SP1",
     total: 1500,
     // ...
   }
   ```

2. **Save simplificado:**
   ```typescript
   await form.submit();
   // Internamente chama: calculatorProposalGateway.save(form.data)
   ```

3. **Cálculos isolados:**
   ```typescript
   const calc = useProposalCalculator({ proposal: form.data, config: cConfig });
   // calc.result = rows da tabela
   // calc.sub = { resources, ips, services, backup, kubernetes, storage }
   ```

4. **UI atualizada:**
   - Inputs conectados via helpers: `getAddonValue()`, `onAddonChange()`
   - Tabela renderiza: `calc.result.map(...)`
   - Subtotais vêm de: `calc.sub.resources`, `calc.sub.ips`, etc.

---

## Validação Final

### ✅ Testes para garantir que está funcionando:

1. **Criar proposta nova:**
   - Adicionar VMs com vCPU, RAM, NVMe, IPs
   - Adicionar addons (antivirus, firewall, etc.)
   - Salvar → Verificar no backend se `servers` e `addons` estão corretos

2. **Editar proposta existente:**
   - Carregar proposta da API
   - Verificar se `form.data` está populado corretamente
   - Fazer alterações e salvar
   - Verificar se atualizou no backend

3. **Cálculos:**
   - Verificar se subtotais (Recursos, IPs, Serviços) estão corretos
   - Verificar se desconto está sendo aplicado
   - Verificar se total final está correto

4. **Console:**
   ```typescript
   console.log('FORM DATA:', form.data);
   console.log('CALC RESULT:', calc.result);
   console.log('CALC SUBS:', calc.sub);
   ```
   - `form.data.servers` deve ter a estrutura da API
   - `form.data.addons` deve ter a estrutura da API
   - `calc.result` deve ter os rows com categorias corretas
   - `calc.sub` deve ter os valores dos subtotais

---

## ⚠️ Armadilhas Comuns

### 1. **Não misturar formatos:**
   - ❌ Manter `items[]` E `form.data.servers[]`
   - ✅ Usar APENAS `form.data.servers[]`

### 2. **Não fazer transformações manuais:**
   - ❌ `const servers = items.map(item => transformarParaAPI(item))`
   - ✅ `form.data.servers` JÁ está no formato da API

### 3. **Usar helpers para updates:**
   - ❌ `form.data.addons[0].quantity = 5`
   - ✅ `onAddonChange(e, cConfig.antivirus)`

### 4. **IDs corretos:**
   - ❌ `config_id: 123` (hardcoded)
   - ✅ `config_id: cConfig.vcpu?.id || 0`

### 5. **Calcular depende de form.data:**
   - ❌ Calcular baseado em `items`, `addons` separados
   - ✅ `useProposalCalculator({ proposal: form.data, ... })`

---

## Resumo Executivo

**O que fazer:** Refatorar OpenCalculator para usar `useForm` + `useProposalCalculator` + `useCalculatorConfig`

**Por quê:** Formato de dados incompatível com API - servers e addons não estão sendo salvos corretamente

**Como:** Copiar estrutura do OpenCalculatorNovo (form.data no formato da API) mas manter toda a UI/lógica existente do OpenCalculator

**Resultado:** Save funciona porque `form.data` já está no formato que a API espera - sem transformações manuais
