## Level de usuário

- 1 = Cliente (Cliente que contrata os serviços da Open Datacenter, não trabalha na empresa)
- 200 = Parceiro (Parceiro Open Datacenter, alguém com relacionamento de parceira com a Open Datacenter mas não trabalha na empresa. Sempre estão vinculados a um Partner)
- 600 = RH (Trabalha na Open Datacenter, Level interno da empresa)
- 680 = BDR (Trabalha na Open Datacenter, Level interno da empresa)
- 690 = Arquiteto de soluções (Trabalha na Open Datacenter, Level interno da empresa)
- 700 = Comercial (Trabalha na Open Datacenter, Level interno da empresa)
- 750 = Gerente Comercial (Trabalha na Open Datacenter, Level interno da empresa)
- 775 = Sucesso do Cliente (Trabalha na Open Datacenter, Level interno da empresa)
- 900 = Suporte (Trabalha na Open Datacenter, Level interno da empresa)
- 950 = Gerente de Suporte (Trabalha na Open Datacenter, Level interno da empresa)
- 1000 = Admin (Trabalha na Open Datacenter, Level interno da empresa. Usuário que pode tudo. Parecido com o super usuário no ambiente linux)

- Level interno = 1 e 200
- Level externo = 600, 680, 690, 700, 750, 775, 900, 950 e 1000

## Criação e edição de usuários

- Usuários SOMENTE PODEM ser criados ou atualizados para um `level interno` por usuários com `level 900 ou superior`.
- Usuários SOMENTE PODEM ser criados ou atualizados para o `level 1000` por usuários que também tenham o `level 1000`.

## Autenticação

- Usuários com `level 200` NÃO PODEM realizar login na aplicação se o partner vinculado estiver com status `Pendente` ou `Reprovado` ou `Inativo`.

## Calculator Proposals - Propostas Comerciais

### Visão Geral

O módulo de propostas comerciais (Calculator Proposals) é um sistema completo para criação, gerenciamento e compartilhamento de propostas de serviços de infraestrutura (VMs, servidores, add-ons) com clientes.

#### Componentes do Sistema

1. **Calculator Config** - Configurações de preços e opções de serviços
2. **Calculator Proposal** - Propostas comerciais com cotação de serviços
3. **Calculator Proposal Files** - Arquivos anexos adicionais às propostas

#### Estrutura de uma Proposta

Cada proposta contém:

- **Informações do Cliente**: nome, empresa, telefone, email
- **Canal de Venda**: PARCEIRO ou CLIENTE (se PARCEIRO, requer reseller_name)
- **Configuração Técnica**:
  - Datacenter (localização)
  - Exchange rate (fx) - taxa de câmbio
  - Duração do contrato (em meses)
  - Desconto percentual (0.0 a 1.0)
  - Valor total
- **Servidores**: Array de servidores com especificações (vCPU, RAM, Storage) e preços calculados automaticamente
- **Add-ons**: Array opcional de serviços adicionais com preços calculados automaticamente
- **Arquivo Principal**: PDF da proposta (armazenado no bucket S3/MinIO)
- **Arquivos Extras**: Múltiplos arquivos anexos opcionais
- **Tokens de Segurança**:
  - `approval_token`: Token para cliente aprovar/rejeitar proposta (uso único)
  - `file_access_token`: Token para download público do arquivo principal
- **Metadados**:
  - Status (Rascunho, Enviado, Aprovado, Recusado, Expirado, Cancelado)
  - Data de validade (due_at)
  - Usuário criador (created_by)
  - Comissão (valor e motivo, opcional)
  - Observações (opcional)

---

## Calculator Config - Configurações de Preços

### Visão Geral

O sistema Calculator Config armazena as configurações de preços e opções de serviços disponíveis para criação de propostas.

#### Nova Arquitetura (Flat Structure) - Janeiro 2026

**BREAKING CHANGE**: A estrutura de calculator_configs foi completamente refatorada de hierárquica para plana.

**Estrutura Atual**:
- Cada linha = um único item de preço/configuração
- Campos: `id`, `label`, `value` (DECIMAL), `meta` (JSON)
- Referência nas propostas: `config_id` diretamente (ID da tabela)
- Sem hierarquia: cada item é independente e referenciado por seu ID único

#### Estrutura da Tabela `calculator_configs`

Cada registro representa um único item de preço/configuração:

```json
{
  "id": 1,                          // ID único na tabela (PK, auto-increment)
  "label": "vCPU",                  // Nome/descrição do item
  "value": 45.00,                   // Valor/preço (DECIMAL 12,4)
  "meta": {                         // Metadados JSON (flexível)
    "category": "VM",               // Categoria (VM, BareMetal, GPU, Add-ons, etc.)
    "section": "Preços de VM",      // Seção descritiva
    "type": "BRL",                  // Tipo de moeda
    "by": "unit",                   // Unidade de medida (unit, GB, TB, etc.)
    "region": "us-east",            // Região (opcional)
    "retention": "7 dias",          // Retenção para backups (opcional)
    "min": 100,                     // Mínimo para ranges (opcional)
    "max": 500                      // Máximo para ranges (opcional)
  },
  "created_at": "2026-01-30T12:00:00Z",
  "updated_at": "2026-01-30T12:00:00Z"
}
```

**Vantagens da Estrutura Plana**:
- ✅ Queries diretas por ID (sem parsing de JSON)
- ✅ Indexação eficiente no campo `value`
- ✅ Queries por meta (categoria, seção, tipo) via JSON operators
- ✅ Simplifica validação e cálculos de preço
- ✅ Escalabilidade para adicionar novos itens sem migração

#### Endpoints Calculator Config

**Autenticação**: Todos os endpoints requerem `auth:sanctum`

##### 1. Listar Configurações

**GET** `/api/calculator/config`

**Query Parameters**:
- `page`, `per_page` - Paginação
- `category` - Filtrar por categoria
- `section` - Filtrar por seção
- `search`, `with`, `order`, `limit` - Filtros padrão

##### 2. Visualizar Configuração Específica

**GET** `/api/calculator/config/{id}`

##### 3. Criar Nova Configuração

**POST** `/api/calculator/config`

**Body**:
```json
{
  "label": "vCPU Premium",
  "value": 50.00,
  "meta": {
    "category": "VM",
    "section": "Preços de VM",
    "type": "BRL",
    "by": "unit"
  }
}
```

##### 4. Atualizar Configuração

**PUT** `/api/calculator/config/{id}`

**Body**:
```json
{
  "label": "vCPU Premium",
  "value": 55.00,
  "meta": {
    "category": "VM",
    "section": "Preços de VM",
    "type": "BRL",
    "by": "unit",
    "region": "us-east"
  }
}
```

##### 5. Deletar Configuração

**DELETE** `/api/calculator/config/{id}`

**IMPORTANTE**: Cada configuração é um item independente. Para criar novos itens, use POST. Para atualizar, use PUT no ID específico.

---

## Calculator Proposals - Endpoints e Fluxos

### Endpoints Disponíveis

#### 1. Listar Propostas (Autenticado)

**GET** `/api/calculator/proposal`

**Autenticação**: Requerida (`sanctum`)

**Query Parameters**:
- `page` - Número da página (padrão: 1)
- `per_page` - Itens por página (padrão: 15)
- `search` - Busca por nome, email, empresa, telefone, reseller_name, datacenter, ou nome do criador
- `status` - Filtrar por status (exact match: "Rascunho", "Enviado", "Aprovado", "Recusado", "Expirado", "Cancelado")
- `channel_type` - Filtrar por tipo (exact match: PARCEIRO ou CLIENTE)
- `email` - Filtrar por email específico (exact match)
- `with` - Carregar relacionamentos (ex: `with=creator,files`)
- `order` - Ordenação (ex: `order=created_at:desc`)
- `limit` - Limitar número de resultados

**Resposta**: Paginação com lista de propostas

**Campos Ocultos**: `approval_token` nunca é retornado na resposta (campo hidden no model)

---

#### 2. Criar Proposta (Autenticado)

**POST** `/api/calculator/proposal`

**Autenticação**: Requerida (`sanctum`)

**Content-Type**: `multipart/form-data` (para upload de arquivo)

**Campos Obrigatórios**:

```json
{
    "name": "João Silva",
    "company": "Tech Corp",
    "phone": "+5511999999999",
    "email": "joao@techcorp.com",
    "channel_type": "CLIENTE",
    "fx": 5.5,
    "datacenter": "São Paulo",
    "contract_duration": 12,
    "discount_pct": 0.15,
    "total": 25000.0,
    "servers": [
        {
            "name": "VM Produção",
            "specs": [
                {"config_id": 1, "value": 4},    // 4 vCPUs
                {"config_id": 2, "value": 16},   // 16 GB RAM
                {"config_id": 3, "value": 500}   // 500 GB NVMe
            ],
            "quantity": 2
        },
        {
            "name": "GPU ML Server",
            "specs": [
                {"config_id": 12, "value": 2},   // 2 GPUs
                {"config_id": 2, "value": 64},   // 64 GB RAM
                {"config_id": 3, "value": 2000}  // 2 TB Storage
            ],
            "quantity": 1
        }
    ],
    "due_at": "2026-02-05T23:59:59Z"
}
```

**Campos Obrigatórios Adicionais**:
- `file` - Arquivo da proposta (PDF, DOC, DOCX, XLS, XLSX, até 10MB) - **OBRIGATÓRIO**

**Campos Opcionais**:
- `status` - Status inicial (padrão: "Rascunho" se omitido, aceita: "Rascunho", "Enviado", "Aprovado", "Recusado", "Expirado", "Cancelado")
- `reseller_name` - Nome do revendedor (**obrigatório** se `channel_type=PARCEIRO`)
- `commission_value` - Valor da comissão (número >= 0)
- `commission_reason` - Motivo da comissão (texto)
- `observations` - Observações adicionais (texto)
- `addons` - Array de serviços adicionais (formato detalhado abaixo)

**Formato do Campo `servers`** (obrigatório, mínimo 1 servidor):

**Campos Obrigatórios**:
- `name` (string): Nome do servidor
- `specs` (array): Array de especificações, cada uma com:
  - `config_id` (integer): ID do calculator_config
  - `value` (number): Quantidade/valor para essa especificação
- `quantity` (integer, opcional): Quantidade de servidores (padrão: 1)

**Como Funciona**:
1. Frontend lista configs disponíveis via `GET /api/calculator/config`
2. Usuário seleciona configs desejados (ex: vCPU ID=1, RAM ID=2, Storage ID=3)
3. Para cada config, define o `value` (quantidade)
4. Backend busca cada config pelo ID, calcula `value × config.value`, e soma tudo

**Exemplos Completos**:

```json
// 1. VM Simples (vCPU=1, RAM=2, NVMe=3, IP=4)
{
  "name": "VM #1",
  "specs": [
    {"config_id": 1, "value": 16},   // 16 vCPUs
    {"config_id": 2, "value": 128},  // 128 GB RAM
    {"config_id": 3, "value": 100},  // 100 GB NVMe
    {"config_id": 4, "value": 1}     // 1 IP Público
  ],
  "quantity": 1
}

// 2. BareMetal (CPU=5, RAM=6, NVMe=7)
{
  "name": "BareMetal #2",
  "specs": [
    {"config_id": 5, "value": 2},    // 2x Intel Xeon
    {"config_id": 6, "value": 128},  // 128 GB RAM
    {"config_id": 7, "value": 1000}  // 1 TB NVMe total
  ],
  "quantity": 1
}

// 3. GPU Server (GPU=12, RAM=2, Storage=3)
{
  "name": "GPU ML Server",
  "specs": [
    {"config_id": 12, "value": 2},    // 2 GPUs
    {"config_id": 2, "value": 64},    // 64 GB RAM
    {"config_id": 13, "value": 80},   // 80 GB GPU Memory
    {"config_id": 3, "value": 2000}   // 2 TB Storage
  ],
  "quantity": 1
}

// 4. Kubernetes (Plano=50)
{
  "name": "K8s Production",
  "specs": [
    {"config_id": 50, "value": 1}  // 1x Plano SMALL
  ],
  "quantity": 1
}

// 5. Storage SAS (Storage=60)
{
  "name": "Storage SAS BR",
  "specs": [
    {"config_id": 60, "value": 1}  // 1 TB Storage SAS BR
  ],
  "quantity": 1
}

// 6. SaaS (Usuários=70)
{
  "name": "OPEN SaaS",
  "specs": [
    {"config_id": 70, "value": 5}  // 5 usuários
  ],
  "quantity": 1
}
```

**Cálculo Automático de Preço dos Servidores**:
```
Para cada spec no array:
  preço_spec = spec.value × calculator_config.value

Preço unitário = soma de todos os specs
Preço total = preço_unitário × quantity
```

**Exemplo de Cálculo**:
```
Servidor:
{
  "name": "VM Produção",
  "specs": [
    {"config_id": 1, "value": 4},   // Config ID 1: vCPU = R$ 45,00
    {"config_id": 2, "value": 16},  // Config ID 2: RAM = R$ 9,00/GB
    {"config_id": 3, "value": 500}  // Config ID 3: NVMe = R$ 0,90/GB
  ],
  "quantity": 2
}

Cálculo:
- vCPU: 4 × R$ 45,00 = R$ 180,00
- RAM: 16 × R$ 9,00 = R$ 144,00
- NVMe: 500 × R$ 0,90 = R$ 450,00
- Preço unitário = R$ 774,00
- Preço total = R$ 774,00 × 2 = R$ 1.548,00
```

**Formato do Campo `addons`** (opcional):

```json
{
  "config_id": 28,     // ID da configuração (calculator_configs) - obrigatório
  "quantity": 2        // Quantidade - opcional (padrão: 1, min: 1)
  // NOTA: Os campos "label" e "price" são calculados/extraídos automaticamente
}
```

**Cálculo Automático de Preço dos Add-ons**:
```
preço = valor_config * quantity
```

O backend busca a configuração diretamente pelo `config_id` na tabela `calculator_configs`, extrai o `label` e `value`, e calcula o preço automaticamente. Valida também que `meta.category` é "Add-ons".

**Validações Importantes**:
- `file` é **obrigatório** - arquivo da proposta deve ser enviado
- `channel_type` deve ser "PARCEIRO" ou "CLIENTE"
- Se `channel_type=PARCEIRO`, `reseller_name` é obrigatório
- `discount_pct` deve estar entre 0 e 1 (percentual)
- `contract_duration` deve ser >= 1 mês
- `fx` deve ser > 0
- `total` deve ser >= 0
- `servers` deve ter pelo menos 1 item
- Cada servidor deve ter `name` e `specs` (array com mínimo 1 item)
- Cada spec deve ter `config_id` (existe em calculator_configs) e `value` (numérico >= 0)
- `due_at` deve ser uma data futura
- `commission_value` deve ser >= 0 (se fornecido)
- Cada `config_id` em addons e servers.specs deve existir na tabela `calculator_configs`
- Para addons: cada config deve ter `meta.category` igual a "Add-ons"

**Fluxo Interno**:

1. **Validação**: Request valida todos os campos conforme regras acima
2. **Geração de Tokens**: Service gera automaticamente:
   - `approval_token` (64 caracteres aleatórios) - Para cliente aprovar/rejeitar
   - `file_access_token` (64 caracteres aleatórios) - Para download público
3. **Normalização de Add-ons**: Se `addons` fornecido:
   - Busca cada configuração pelo `config_id` na tabela `calculator_configs`
   - Valida que a config existe e `meta.category` é "Add-ons"
   - Extrai `label` e `value` da config
   - Calcula preço: `config.value * quantity`
   - Adiciona `label` e `price` ao array
4. **Normalização de Servidores**:
   - Para cada servidor, valida que tem `name` e `specs` (array)
   - Para cada spec no array:
     - Busca config pelo `config_id` na tabela `calculator_configs`
     - Valida que config existe e tem `value` válido
     - Calcula: `spec.value × config.value`
     - Armazena metadados: config_id, label, value, unit_price, total, category
   - Soma todos os specs para obter preço unitário
   - Calcula preço total: `preço_unitário × quantity`
   - Sobrescreve array `specs` com specs processados (inclui metadados)
5. **Criação da Proposta**: Salva no banco de dados
6. **Upload de Arquivo** (obrigatório):
   - Nome gerado: `{id}_{timestamp}_{uniqid}.{extension}`
   - Salvo no bucket S3/MinIO chamado `proposals`
   - Campo `file_path` atualizado
7. **Audit Log**: Registra ação de criação automaticamente
8. **Campo `created_by`**: Preenchido automaticamente com ID do usuário autenticado

**Resposta**: Objeto da proposta criada (sem expor `approval_token` - campo hidden)

**Erros Possíveis**:
- 422: Validação falhou (dados inválidos, config_id não existe, categoria incorreta, valores negativos)
- 401: Não autenticado

---

#### 3. Visualizar Proposta (Público)

**GET** `/api/calculator/proposal/{id}`

**Autenticação**: **Não requerida** (endpoint público)

**Resposta**: Detalhes completos da proposta incluindo:
- Todos os campos exceto `approval_token` (hidden)
- `file_access_token` é incluído na resposta
- Relacionamentos podem ser carregados com `?with=creator,files`

**Uso**: Cliente pode visualizar proposta sem autenticação

---

#### 4. Atualizar Proposta (Autenticado)

**PUT** `/api/calculator/proposal/{id}`

**Autenticação**: Requerida (`sanctum`)

**Content-Type**: `multipart/form-data`

**Campos**: Mesmos da criação, **todos opcionais exceto o arquivo**

**Campo Obrigatório**:
- `file` - Arquivo da proposta (PDF, DOC, DOCX, XLS, XLSX, até 10MB) - **OBRIGATÓRIO**

**Comportamento**:
- Validações são as mesmas da criação
- Arquivo é **obrigatório** em toda atualização:
  - Arquivo antigo é **deletado automaticamente** do bucket
  - Novo arquivo é salvo com nome único
  - Campo `file_path` atualizado
- Se `servers` ou `addons` fornecidos, os preços são **recalculados** automaticamente
- Tokens (`approval_token` e `file_access_token`) **NÃO são alterados**
- Campo `created_by` **não pode ser alterado**
- Audit log registra alterações automaticamente

**IMPORTANTE**:
- Para atualizar servers ou addons, é necessário enviar o array completo (não é merge parcial)
- Arquivo deve SEMPRE ser enviado, mesmo que seja o mesmo arquivo anterior

---

#### 5. Deletar Proposta (Autenticado)

**DELETE** `/api/calculator/proposal/{id}`

**Autenticação**: Requerida (`sanctum`)

**Comportamento**:
- **Soft delete** (dados não são removidos permanentemente)
- Campo `deleted_at` é preenchido com timestamp
- Arquivo físico no bucket é mantido (não é deletado)
- Registros relacionados em `calculator_proposal_files` são mantidos (cascade soft delete)
- Audit log registra deleção automaticamente

---

#### 6. Download do Arquivo Principal da Proposta (Público)

**GET** `/api/calculator/proposal/{id}/file/download?token={file_access_token}`

**Autenticação**: **Não requerida** (validação via token)

**Query Parameters**:
- `token` - Token de acesso ao arquivo (`file_access_token`) - obrigatório

**Validação**:
- Verifica se o `file_access_token` fornecido corresponde ao da proposta
- Verifica se a proposta possui `file_path` (arquivo foi enviado)
- Retorna erro 403 se token for inválido
- Retorna erro 404 se proposta ou arquivo não encontrado

**Resposta**:
- Arquivo binário com headers apropriados
- Content-Type automático baseado na extensão
- Content-Disposition: inline

**Uso**: Este endpoint deve ser usado para compartilhar o arquivo principal da proposta com o cliente sem necessidade de autenticação

---

#### 7. Obter Token de Aprovação (Autenticado)

**GET** `/api/calculator/proposal/{id}/get-approval-token`

**Autenticação**: Requerida (`sanctum`)

**Resposta**:

```json
{
    "token": "abc123def456..."
}
```

**Uso**:
- Obter o `approval_token` para enviar ao cliente
- Usado para gerar link de aprovação: `https://app.example.com/proposta/{id}/aprovar?token={approval_token}`
- Token é sensível e não deve ser exposto publicamente

---

#### 8. Definir Aceitação da Proposta (Público)

**POST** `/api/calculator/proposal/define-acceptance`

**Autenticação**: **Não requerida** (validação via token)

**Body**:

```json
{
    "proposal_id": 1,
    "status": "Aprovado",
    "approval_token": "abc123def456..."
}
```

**Campos**:
- `proposal_id` - ID da proposta (obrigatório, deve existir)
- `status` - Novo status (obrigatório, aceita apenas: "Aprovado" ou "Recusado")
- `approval_token` - Token de aprovação (obrigatório)

**Validação**:
- Verifica se o `approval_token` fornecido corresponde **exatamente** ao da proposta
- Retorna erro 403 se token for inválido (mensagem: "Token de assinatura inválido.")
- Retorna erro 404 se proposta não encontrada
- Retorna erro 422 se status não for "Aprovado" ou "Recusado"

**Comportamento**:
- Atualiza o campo `status` da proposta
- Registra audit log customizado: "Proposta {id} teve seu status definido para {status}"

**Resposta**: Proposta atualizada com novo status

**Uso**: Este endpoint deve ser acessado pelo cliente para aceitar ou rejeitar a proposta através de link público

---

### Arquivos Anexos Adicionais

Além do arquivo principal da proposta, é possível adicionar múltiplos arquivos extras usando o modelo `CalculatorProposalFile`:

#### 9. Upload de Arquivo Extra (Autenticado)

**POST** `/api/calculator/proposal/{idOrUuid}/file`

**Autenticação**: Requerida (`sanctum`)

**Content-Type**: `multipart/form-data`

**Body**:
- `file` - Arquivo (PDF, JPG, PNG, até 20MB) - obrigatório

**Validação**:
- Arquivo é obrigatório
- Extensões permitidas: pdf, jpg, png
- Tamanho máximo: 20MB (20480 KB)

**Comportamento**:
- Arquivo salvo no bucket `proposal` (disco S3/MinIO)
- Nome gerado: `{proposal_id}_{timestamp}_{uniqid}.{extension}`
- Registro criado em tabela `calculator_proposal_files`:
  - `original_name`: Nome original do arquivo
  - `path`: Nome gerado no bucket
  - `proposal_id`: ID da proposta
  - `created_by`: ID do usuário autenticado
- Relacionamento `hasMany` com proposta
- Audit log registrado automaticamente

**Resposta**: Objeto `CalculatorProposalFile` criado

---

#### 10. Download de Arquivo Extra (Autenticado)

**GET** `/api/calculator/proposal/file/{path}`

**Autenticação**: Requerida (`sanctum`)

**Parâmetros**:
- `path` - Nome do arquivo no bucket (ex: `1_1234567890_abc123.pdf`)

**Validação de Segurança**:
- Path não pode conter `..` (directory traversal)
- Path não pode começar com `/`
- Retorna erro 400 se validação falhar

**Resposta**:
- Arquivo binário com mime type detectado automaticamente
- Content-Disposition: inline

**Uso**: Download de arquivos anexos extras (requer autenticação, diferente do arquivo principal)

---

### Fluxo Completo de Uso

#### Fluxo 1: Criação de Proposta com Arquivo

```
1. Admin/Comercial autenticado cria proposta via POST /api/calculator/proposal
   - Envia dados da proposta (cliente, servidores, add-ons, etc.)
   - Envia arquivo PDF da proposta (OBRIGATÓRIO)
   - Servidores e add-ons com preços calculados automaticamente pelo backend

2. Backend processa:
   - Valida todos os campos
   - Busca preços na tabela calculator_configs
   - Calcula preços de servidores: (vcpu * vcpu_price) + (ram * ram_price) + (storage * storage_price)
   - Calcula preços de add-ons: item_value * quantity
   - Gera approval_token (64 chars aleatórios)
   - Gera file_access_token (64 chars aleatórios)
   - Salva proposta no banco
   - Se arquivo enviado: faz upload para bucket S3/MinIO e atualiza file_path
   - Registra audit log

3. Resposta contém dados da proposta (approval_token está hidden, não retornado)

4. Admin obtém tokens via GET /api/calculator/proposal/{id}/get-approval-token
   - Resposta: { "token": "approval_token_value" }

5. Sistema gera links para enviar ao cliente:
   - Download arquivo: https://api.example.com/api/calculator/proposal/{id}/file/download?token={file_access_token}
   - Visualizar proposta: https://app.example.com/proposta/{id}
   - Aprovar/Rejeitar: https://app.example.com/proposta/{id}/aprovar?token={approval_token}
```

#### Fluxo 2: Cliente Visualiza e Aprova

```
1. Cliente recebe email com links públicos

2. Cliente acessa link de download (público, sem autenticação)
   - GET /api/calculator/proposal/{id}/file/download?token={file_access_token}
   - Valida file_access_token
   - Retorna arquivo PDF

3. Cliente visualiza detalhes da proposta (público, sem autenticação)
   - GET /api/calculator/proposal/{id}
   - Pode usar ?with=creator para ver quem criou

4. Cliente decide aprovar ou rejeitar
   - POST /api/calculator/proposal/define-acceptance
   - Envia: { "proposal_id": 1, "status": "Aprovado", "approval_token": "..." }
   - Valida approval_token
   - Atualiza status para "Aprovado" ou "Recusado"
   - Registra audit log: "Proposta {id} teve seu status definido para {status}"

5. Sistema notifica admin sobre decisão
```

#### Fluxo 3: Atualização de Proposta

```
1. Admin autenticado atualiza proposta
   - PUT /api/calculator/proposal/{id}
   - Pode atualizar qualquer campo (todos opcionais)
   - DEVE incluir arquivo (obrigatório)

2. Arquivo (obrigatório):
   - Arquivo antigo é deletado do bucket
   - Novo arquivo é salvo com nome único: {id}_{timestamp}_{uniqid}.ext
   - file_path é atualizado

3. Se servers/addons atualizados:
   - Preços são recalculados automaticamente pelo backend
   - Frontend envia array completo (não é merge parcial)

4. Tokens permanecem os mesmos (links continuam válidos)

5. Audit log registra alterações
```

#### Fluxo 4: Arquivos Anexos Extras

```
1. Após criar proposta, admin pode adicionar arquivos extras
   - POST /api/calculator/proposal/{id}/file
   - Arquivo salvo no bucket 'proposal'
   - Registro criado em calculator_proposal_files

2. Para listar arquivos de uma proposta:
   - GET /api/calculator/proposal/{id}?with=files

3. Para baixar arquivo específico (requer autenticação):
   - GET /api/calculator/proposal/file/{path}
   - path = nome do arquivo (ex: "1_1234567890_abc.pdf")
```

---

### Status das Propostas

As propostas utilizam os seguintes valores de status **em português**:

| Status | Descrição | Quando Usar |
|--------|-----------|-------------|
| `Rascunho` | Proposta em elaboração | Status padrão ao criar proposta se não especificado. Indica que ainda não foi enviada ao cliente |
| `Enviado` | Proposta enviada ao cliente | Quando a proposta é enviada ao cliente e aguarda resposta |
| `Aprovado` | Cliente aceitou a proposta | Após cliente aprovar via endpoint `define-acceptance` |
| `Recusado` | Cliente recusou a proposta | Após cliente rejeitar via endpoint `define-acceptance` |
| `Expirado` | Proposta passou da data de validade | Quando a data `due_at` é ultrapassada |
| `Cancelado` | Proposta cancelada pelo admin | Quando o negócio não se concretiza ou é cancelado internamente |

**Observações Importantes sobre Status**:

- O campo `status` é **opcional** na criação - se não informado, assume valor **"Rascunho"**
- Na atualização via `PUT /api/calculator/proposal/{id}`, o status pode ser alterado manualmente por usuários autenticados
- No endpoint público `POST /api/calculator/proposal/define-acceptance`, o cliente **só pode** definir status **"Aprovado"** ou **"Recusado"**
- Outros status ("Enviado", "Expirado", "Cancelado") devem ser definidos pelo admin via update
- A migration `2026_01_26_152011_normalize_calculator_proposals_statuses.php` normalizou os status antigos:
  - `SENT` → `Enviado`
  - `DRAFT` → `Rascunho`

---

### Observações Importantes

#### 1. Segurança

- **Dois tokens separados** aumentam segurança:
  - `approval_token`: Para aprovar/rejeitar (sensível, não exposto)
  - `file_access_token`: Para download público (exposto na resposta)
- Tokens são gerados automaticamente via `\App\Helpers\Str::generateToken()` (64 chars)
- Tokens são únicos por proposta
- Download público e aprovação não requerem autenticação, apenas token válido
- CRUD completo (criar, editar, deletar) requer autenticação `sanctum`
- Validação de tokens é **case-sensitive** e **exact match**

#### 2. Storage e Arquivos

- **Bucket**: `proposal` (configurado no disco S3/MinIO)
- **Arquivo Principal**:
  - Formatos aceitos: PDF, DOC, DOCX, XLS, XLSX
  - Tamanho máximo: 10MB
  - Nome gerado: `{id}_{timestamp}_{uniqid}.{extension}`
  - Armazenado em campo `file_path` na proposta
  - Download público via `file_access_token`
- **Arquivos Extras** (Calculator Proposal Files):
  - Formatos aceitos: PDF, JPG, PNG
  - Tamanho máximo: 20MB
  - Relacionamento `hasMany` com proposta
  - Download requer autenticação
- **Deleção de Arquivos**:
  - Ao atualizar proposta com novo arquivo, o antigo é deletado automaticamente
  - Ao deletar proposta (soft delete), arquivos físicos são mantidos

#### 3. Cálculo Automático de Preços

**Importante**: O frontend **NÃO deve calcular preços** - isso é responsabilidade do backend.

- **Servidores** (estrutura com specs):
  - Frontend lista configs disponíveis: `GET /api/calculator/config`
  - Usuário seleciona configs desejados (ex: vCPU ID=1, RAM ID=2, Storage ID=3)
  - Para cada config selecionado, define o `value` (quantidade/valor)
  - Frontend envia: `name`, array `specs` com `[{config_id, value}, ...]`, `quantity`
  - Backend para cada spec:
    1. Busca config pelo `config_id`
    2. Calcula: `spec.value × config.value`
    3. Soma ao preço unitário
  - Backend calcula: `preço_unitário × quantity`
  - Campo `price` é ignorado se enviado pelo frontend
  - **Vantagem**: Precisão total, sem ambiguidade, configs explícitos

- **Add-ons**:
  - Frontend envia: `config_id`, `quantity`
  - Backend busca config na tabela `calculator_configs` pelo ID
  - Backend valida que `meta.category` é "Add-ons"
  - Backend extrai `label` do campo `label` da config
  - Backend calcula: `config.value × quantity`
  - Campos `label` e `price` são adicionados automaticamente

**Validações do Backend**:
- Cada servidor deve ter `name` e `specs` (array com mínimo 1 item)
- Cada spec deve ter `config_id` (integer) e `value` (numeric >= 0)
- Todos os `config_id` devem existir em `calculator_configs`
- Configs de addons devem ter `meta.category` igual a "Add-ons"
- Valores de preço (campo `value` das configs) devem ser >= 0
- Throw exception 422 se config não encontrado ou dados inválidos

#### 4. Validações de Campos

- **channel_type**: Deve ser "PARCEIRO" ou "CLIENTE" (enum)
- **reseller_name**: Obrigatório se `channel_type=PARCEIRO` (required_if)
- **discount_pct**: Entre 0 e 1 (percentual: 0.15 = 15%)
- **contract_duration**: >= 1 mês
- **fx**: > 0 (exchange rate)
- **total**: >= 0
- **commission_value**: >= 0 (se fornecido)
- **servers**: Array obrigatório, mínimo 1 item
- **due_at**: Data futura (after:now)
- **file**: PDF/DOC/DOCX/XLS/XLSX, máximo 10MB - **OBRIGATÓRIO** em criação e atualização

#### 5. Relacionamentos

- **creator**: `belongsTo` User (quem criou a proposta)
  - Campo: `created_by`
  - Preenchido automaticamente com usuário autenticado
  - Não pode ser alterado após criação

- **files**: `hasMany` CalculatorProposalFile (arquivos anexos extras)
  - Relacionamento: `proposal_id` → `calculator_proposals.id`
  - Cascade delete on proposal deletion
  - Carregar com: `?with=files`

#### 6. Soft Deletes

- Model usa trait `SoftDeletes`
- Campo `deleted_at` registra timestamp da deleção
- Dados não são removidos permanentemente
- Arquivos físicos são mantidos no bucket
- Permite recuperação de propostas deletadas

#### 7. Auditoria

- Todas as operações CRUD são auditadas automaticamente via `CrudService`
- Logs customizados para ações especiais:
  - `upload-file`: Quando arquivo é enviado/atualizado
  - `define-acceptance`: Quando cliente aprova/rejeita
- Metadados incluem: IP, user agent
- Consultar logs: `GET /api/audit-log?module=CalculatorProposal&resource_id={id}`

#### 8. Campos Ocultos e Sensíveis

- **`approval_token`**: Hidden no model, nunca retornado em responses
  - Obter via endpoint específico: `GET /api/calculator/proposal/{id}/get-approval-token`
  - Não usar em listagens ou visualizações públicas

- **`file_access_token`**: Retornado nas responses
  - Necessário para download público do arquivo
  - Pode ser exposto ao cliente

#### 9. Multipart Form Data

Quando enviar arquivo, usar `Content-Type: multipart/form-data`:

```javascript
const formData = new FormData();
formData.append('name', 'João Silva');
formData.append('company', 'Tech Corp');
// ... outros campos
formData.append('servers', JSON.stringify([...])); // Arrays devem ser JSON string
formData.append('addons', JSON.stringify([...]));  // Arrays devem ser JSON string
formData.append('file', fileInput.files[0]);

fetch('/api/calculator/proposal', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + token
  },
  body: formData
});
```

**Request Class** faz `prepareForValidation()` que converte strings JSON em arrays automaticamente.

#### 10. Busca e Filtros

**Search** (campo `search`):
- Busca em: `id`, `name`, `company`, `email`, `phone`, `reseller_name`, `datacenter`, `creator.name`
- Case-insensitive, busca parcial

**Filtros Exact Match**:
- `status`: Valor exato (ex: `?status=Aprovado`)
- `channel_type`: Valor exato (ex: `?channel_type=PARCEIRO`)
- `email`: Valor exato (ex: `?email=joao@techcorp.com`)

**Eager Loading**:
- `with=creator`: Carrega relacionamento com User
- `with=files`: Carrega arquivos anexos extras
- `with=creator,files`: Múltiplos relacionamentos

---

### Exemplos de Payloads

#### Exemplo 1: Criar Proposta Simples (Cliente Direto, Sem Arquivo)

```json
{
  "name": "Maria Santos",
  "company": "Empresa XYZ",
  "phone": "+5511988887777",
  "email": "maria@empresaxyz.com",
  "channel_type": "CLIENTE",
  "fx": 5.25,
  "datacenter": "São Paulo",
  "contract_duration": 24,
  "discount_pct": 0.10,
  "total": 48000.00,
  "servers": [
    {
      "name": "Servidor Web",
      "specs": [
        {"config_id": 1, "value": 8},     // 8 vCPUs
        {"config_id": 2, "value": 32},    // 32 GB RAM
        {"config_id": 3, "value": 1000}   // 1 TB Storage
      ],
      "quantity": 1
    }
  ],
  "due_at": "2026-03-15T23:59:59Z"
}
```

#### Exemplo 2: Criar Proposta Completa (Via Parceiro, Com Add-ons e Arquivo)

```json
{
  "name": "Pedro Oliveira",
  "company": "TechSolutions Ltda",
  "phone": "+5521999998888",
  "email": "pedro@techsolutions.com",
  "status": "Enviado",
  "channel_type": "PARCEIRO",
  "reseller_name": "Parceiro ABC",
  "commission_value": 3000.00,
  "commission_reason": "Acordo de parceria 2026",
  "observations": "Cliente prefere suporte em horário comercial estendido",
  "fx": 5.50,
  "datacenter": "Rio de Janeiro",
  "contract_duration": 36,
  "discount_pct": 0.20,
  "total": 120000.00,
  "servers": [
    {
      "name": "App Server",
      "specs": [
        {"config_id": 1, "value": 16},    // 16 vCPUs
        {"config_id": 2, "value": 64},    // 64 GB RAM
        {"config_id": 3, "value": 2000}   // 2 TB Storage
      ],
      "quantity": 2
    },
    {
      "name": "Database Server",
      "specs": [
        {"config_id": 1, "value": 32},    // 32 vCPUs
        {"config_id": 2, "value": 128},   // 128 GB RAM
        {"config_id": 3, "value": 4000}   // 4 TB Storage
      ],
      "quantity": 1
    }
  ],
  "addons": [
    {
      "config_id": 28,
      "quantity": 3
    },
    {
      "config_id": 35,
      "quantity": 1
    }
  ],
  "due_at": "2026-04-30T23:59:59Z"
}
```
+ Anexar arquivo PDF via `multipart/form-data` com campo `file`

#### Exemplo 3: Atualizar Status para Enviado

```json
{
  "status": "Enviado"
}
```

#### Exemplo 4: Cliente Aprova Proposta (Público)

```json
{
  "proposal_id": 15,
  "status": "Aprovado",
  "approval_token": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6A7B8C9D0E1F2"
}
```

---

### Casos de Uso no Frontend

#### UC1: Admin Cria Nova Proposta

1. **Tela**: Formulário de criação de proposta
2. **Campos**:
   - Dados do cliente (nome, empresa, telefone, email)
   - Tipo de canal (CLIENTE/PARCEIRO) - se PARCEIRO, mostrar campo reseller_name
   - Configuração técnica (datacenter, fx, contract_duration, discount_pct, total)
   - **Servidores** (array, mínimo 1):
     - Nome do servidor
     - **Specs** (array de especificações):
       - Listar configs disponíveis via `GET /api/calculator/config`
       - Para cada spec: selecionar config_id e definir value (quantidade)
       - Exemplo: vCPU (config_id: 1, value: 16), RAM (config_id: 2, value: 64)
     - Quantidade de servidores
     - **Não calcular preço no frontend** - backend calcula automaticamente
   - **Add-ons** (array, opcional):
     - Listar configs com category "Add-ons" via `GET /api/calculator/config?category=Add-ons`
     - Selecionar config_id
     - Definir quantidade
     - **Não calcular preço no frontend** - backend calcula automaticamente
   - Upload de arquivo PDF (**obrigatório**)
   - Data de validade
   - Observações (opcional)
   - Comissão (opcional)
3. **Ação**: POST /api/calculator/proposal (arquivo é obrigatório)
4. **Resposta**: Proposta criada com tokens gerados
5. **Próximos passos**:
   - Obter approval_token via GET /api/calculator/proposal/{id}/get-approval-token
   - Gerar links de compartilhamento
   - Enviar email ao cliente

#### UC2: Cliente Visualiza Proposta

1. **Acesso**: Link público `https://app.example.com/proposta/{id}`
2. **Dados**: GET /api/calculator/proposal/{id} (público, sem auth)
3. **Exibir**:
   - Informações do cliente
   - Lista de servidores com especificações e preços
   - Lista de add-ons (se houver)
   - Valor total, desconto, duração do contrato
   - Data de validade
   - Botão de download do PDF (usar file_access_token)
   - Botões de Aprovar/Rejeitar

#### UC3: Cliente Baixa Arquivo da Proposta

1. **Botão**: "Baixar Proposta PDF"
2. **Ação**: Redirecionar ou fetch para:
   ```
   GET /api/calculator/proposal/{id}/file/download?token={file_access_token}
   ```
3. **Token**: Obtido da resposta do GET /api/calculator/proposal/{id}
4. **Resposta**: Arquivo binário (abrir em nova aba ou baixar)

#### UC4: Cliente Aprova ou Rejeita Proposta

1. **Botões**: "Aprovar" / "Rejeitar"
2. **Token**: Obtido da URL (query param `?token=...`) enviada por email
3. **Ação**: POST /api/calculator/proposal/define-acceptance
   ```json
   {
     "proposal_id": 15,
     "status": "Aprovado", // ou "Recusado"
     "approval_token": "token_da_url"
   }
   ```
4. **Feedback**: Mostrar mensage    m de sucesso ou erro
5. **Validação**: Se token inválido, mostrar erro 403

#### UC5: Admin Adiciona Arquivos Extras

1. **Tela**: Detalhes da proposta (após criação)
2. **Seção**: "Arquivos Anexos"
3. **Ação**: Upload de arquivo
4. **Endpoint**: POST /api/calculator/proposal/{id}/file (multipart)
5. **Listar**: GET /api/calculator/proposal/{id}?with=files
6. **Download**: GET /api/calculator/proposal/file/{path} (autenticado)

#### UC6: Admin Atualiza Proposta

1. **Tela**: Edição de proposta existente
2. **Carregar dados**: GET /api/calculator/proposal/{id}?with=creator,files
3. **Formulário**: Mesmos campos da criação, todos opcionais
4. **Ação**: PUT /api/calculator/proposal/{id}
5. **Notas**:
   - Arquivo é **obrigatório** - sempre enviar o arquivo (mesmo que seja o mesmo)
   - Se atualizar servers/addons, enviar array completo (não é merge)
   - Arquivo antigo é sempre substituído pelo novo
   - Tokens permanecem os mesmos

---

## Audit Logs - Sistema de Auditoria

### Visão Geral

O sistema de auditoria registra automaticamente todas as operações de criação, atualização e deleção realizadas em qualquer módulo da aplicação. Os logs são armazenados na tabela `audit_logs` e são **imutáveis** - não podem ser editados ou deletados após a criação.

### Características do Modelo AuditLog

O modelo [`AuditLog`](app/Models/AuditLog/AuditLog.php) possui as seguintes características especiais:

- **Imutável**: Não possui método `update()` nem `delete()` - apenas criação e leitura
- **Sem updated_at**: Define `const UPDATED_AT = null` pois logs nunca são atualizados
- **Campos JSON**: `old`, `new` e `meta` são armazenados como JSON para flexibilidade

### Estrutura de um Log

Cada registro de auditoria contém:

| Campo | Tipo | Descrição | Exemplo |
|-------|------|-----------|---------|
| `id` | integer | ID único do log | `1` |
| `company_id` | integer | ID da empresa relacionada | `1` |
| `user_id` | integer (nullable) | ID do usuário que executou a ação | `5` |
| `resource_id` | string (nullable) | ID do recurso afetado | `"123"` |
| `module` | string (nullable) | Nome do módulo | `"User"`, `"CalculatorProposal"` |
| `action` | string | Ação realizada | `"create"`, `"update"`, `"delete"` |
| `description` | text (nullable) | Descrição legível da ação | `"Usuário 5 criou User com ID 123"` |
| `old` | json (nullable) | Estado anterior do recurso | `{"status": "pending"}` |
| `new` | json (nullable) | Novo estado do recurso | `{"status": "approved"}` |
| `meta` | json (nullable) | Metadados adicionais | `{"ip": "192.168.1.1", "user_agent": "..."}` |
| `created_at` | datetime | Timestamp de criação do log | `2026-01-22T12:52:38Z` |

### Registro Automático de Logs

O registro de logs é **automático** e transparente. Qualquer Service que estende [`CrudService`](app/Services/CrudService.php) registra logs automaticamente nos métodos:

- `create()` - Registra criação de recursos
- `update()` - Registra atualização de recursos (inclui estado anterior em `old`)
- `delete()` - Registra deleção de recursos

**Exemplo interno do CrudService:**

```php
public function create(array $data): Model
{
    $resource = $this->repo->create($data);
    $this->registerLog('create', $resource, $data); // ← Log automático
    return $resource;
}
```

### Método registerLog()

O método `registerLog()` é protegido e chamado automaticamente. Ele:

1. **Evita recursão infinita**: Não registra logs de AuditLog em si mesmo
2. **Extrai informações contextuais**:
   - `user_id`: Do modelo, dos dados ou do usuário autenticado
   - `company_id`: Do modelo, dos dados ou padrão 1
   - `resource_id`: ID do recurso afetado
   - `module`: Nome da classe do modelo (ex: "User", "CalculatorProposal")
3. **Gera descrição legível**: `"Usuário {id} criou {Module} com ID {resource_id}"`
4. **Captura metadados**:
   - IP do request
   - User agent
5. **Armazena estados**:
   - `old`: Estado anterior (apenas em updates, via `getOriginal()`)
   - `new`: Novo estado (em creates e updates)

### Endpoints Disponíveis

#### 1. Listar Logs de Auditoria (Autenticado)

**GET** `/api/audit-log`

**Autenticação**: Requerida (`sanctum`)

**Query Parameters**:

- `page` - Número da página (padrão: 1)
- `per_page` - Itens por página (padrão: 15)
- `search` - Busca textual
- `company_id` - Filtrar por empresa (exact match)
- `user_id` - Filtrar por usuário (exact match)
- `module` - Filtrar por módulo (exact match, ex: `User`, `CalculatorProposal`)
- `action` - Filtrar por ação (exact match, ex: `create`, `update`, `delete`)
- `with` - Carregar relacionamentos (ex: `with=company,user`)
- `order` - Ordenação (ex: `order=created_at:desc`)
- `limit` - Limitar resultados (ex: `limit=100`)

**Resposta**: Paginação com lista de logs

**Exemplo de uso**:
```
GET /api/audit-log?module=User&action=create&with=user&order=created_at:desc
```

---

#### 2. Criar Log Manualmente (Autenticado)

**POST** `/api/audit-log`

**Autenticação**: Requerida (`sanctum`)

**Content-Type**: `application/json`

**Campos Obrigatórios**:

```json
{
    "company_id": 1,
    "action": "custom.action"
}
```

**Campos Opcionais**:

```json
{
    "user_id": 5,
    "resource_id": "123",
    "module": "CustomModule",
    "description": "Descrição personalizada da ação",
    "old": {"status": "pending"},
    "new": {"status": "approved"},
    "meta": {
        "custom_field": "custom_value",
        "additional_info": "..."
    }
}
```

**Uso**: Este endpoint permite registrar logs manualmente para ações customizadas que não são cobertas pelo registro automático.

---

#### 3. Visualizar Log Específico (Autenticado)

**GET** `/api/audit-log/{id}`

**Autenticação**: Requerida (`sanctum`)

**Resposta**: Detalhes completos do log

---

#### 4. Listar Todos os Logs (Sem Paginação)

**GET** `/api/audit-log/all`

**Autenticação**: Requerida (`sanctum`)

**Query Parameters**: Mesmos filtros do endpoint paginado

**Resposta**: Array com todos os logs (use com cuidado, pode retornar muitos registros)

---

### Fluxo Automático de Auditoria

#### Exemplo 1: Criação de Proposta

```
1. Usuário chama POST /api/calculator/proposal

2. CalculatorProposalController.store() é executado

3. CalculatorProposalService.create(data) é chamado

4. CrudService.create() executa:
   - Cria o recurso no banco
   - Chama registerLog('create', $proposal, $data)

5. Log é criado automaticamente:
   {
       "company_id": 1,
       "user_id": 5,
       "resource_id": "10",
       "module": "CalculatorProposal",
       "action": "create",
       "description": "Usuário 5 criou CalculatorProposal com ID 10",
       "old": null,
       "new": { /* dados da proposta */ },
       "meta": {
           "ip": "192.168.1.100",
           "user_agent": "Mozilla/5.0..."
       }
   }
```

#### Exemplo 2: Atualização de Usuário

```
1. Admin chama PUT /api/user/123

2. UserController.update() é executado

3. UserService.update(123, data) é chamado

4. CrudService.update() executa:
   - Busca usuário atual e salva estado original
   - Atualiza o recurso no banco
   - Chama registerLog('update', $user, $data)

5. Log é criado com estado anterior:
   {
       "company_id": 1,
       "user_id": 1,
       "resource_id": "123",
       "module": "User",
       "action": "update",
       "description": "Usuário 1 atualizou User com ID 123",
       "old": {
           "name": "João Silva",
           "level": 700
       },
       "new": {
           "name": "João Silva Santos",
           "level": 750
       },
       "meta": { ... }
   }
```

#### Exemplo 3: Deleção de Ticket

```
1. Usuário chama DELETE /api/ticket/456

2. TicketController.destroy() é executado

3. TicketService.delete(456) é chamado

4. CrudService.delete() executa:
   - Deleta o recurso
   - Chama registerLog('delete', null, ['id' => 456])

5. Log é criado registrando a deleção:
   {
       "company_id": 1,
       "user_id": 5,
       "resource_id": null,
       "module": "Ticket",
       "action": "delete",
       "description": "Usuário 5 deletou Ticket com ID 456",
       "old": null,
       "new": null,
       "meta": { ... }
   }
```

### Logs Manuais Customizados

Para ações que não são CRUD padrão, você pode registrar logs manualmente:

**Cenário**: Cliente aprova proposta via token público

```php
// Em CalculatorProposalService
use App\Models\AuditLog\AuditLog;

public function defineAcceptance($proposalId, $status, $approvalToken)
{
    // Validação e atualização da proposta...

    // Registro manual do log
    AuditLog::create([
        'company_id' => $proposal->company_id,
        'user_id' => null, // Cliente não autenticado
        'resource_id' => $proposalId,
        'module' => 'CalculatorProposal',
        'action' => 'proposal.acceptance',
        'description' => "Proposta {$proposalId} foi {$status} pelo cliente",
        'old' => ['status' => $proposal->status],
        'new' => ['status' => $status],
        'meta' => [
            'ip' => request()->ip(),
            'user_agent' => request()->userAgent(),
            'approval_token_used' => true
        ]
    ]);

    return $proposal;
}
```

### Observações Importantes sobre Auditoria

1. **Imutabilidade**:
   - Logs NUNCA podem ser editados ou deletados
   - Controller não expõe métodos `update()` ou `destroy()`
   - Service não implementa esses métodos
   - Garante integridade e compliance

2. **Performance**:
   - Cada operação CRUD gera um log adicional
   - Considerar índices em `company_id`, `user_id`, `module`, `action`, `created_at`
   - Em ambientes de alto volume, considerar arquivamento periódico

3. **Recursão Infinita**:
   - Sistema automaticamente ignora logging de AuditLog em si mesmo
   - Isso previne loop infinito ao criar logs

4. **Dados Sensíveis**:
   - Campos `old` e `new` armazenam TODOS os dados
   - **Cuidado**: Senhas e tokens podem ser expostos
   - Considerar filtrar campos sensíveis antes de logar

5. **Compliance**:
   - Ideal para auditoria de LGPD/GDPR
   - Rastreamento completo de quem fez o quê e quando
   - Histórico de alterações para análise forense

6. **Relacionamentos**:
   - `company` - Empresa relacionada
   - `user` - Usuário que executou a ação
   - Use `with=company,user` para eager loading

7. **Timezone**:
   - `created_at` respeita timezone configurado no Laravel
   - Metadados incluem IP e user agent para contexto adicional

### Consultas Úteis de Auditoria

**Ver todas ações de um usuário específico:**
```
GET /api/audit-log?user_id=5&with=user&order=created_at:desc
```

**Ver histórico de um recurso específico:**
```
GET /api/audit-log?module=User&resource_id=123&order=created_at:asc
```

**Ver todas criações de propostas hoje:**
```
GET /api/audit-log?module=CalculatorProposal&action=create&order=created_at:desc
```

**Ver logs de uma empresa:**
```
GET /api/audit-log?company_id=1&with=user&per_page=50
```
