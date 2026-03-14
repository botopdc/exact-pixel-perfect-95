export const OPEN_RBAC_MODEL_CONTENT = `# OPEN RBAC Model

Versão: v1

---

# 1. Objetivo do RBAC

O modelo RBAC (Role-Based Access Control) da OPEN controla:

- **Acesso ao sistema** — quem pode autenticar e acessar a plataforma
- **Visibilidade de módulos** — quais módulos aparecem na navegação
- **Permissões de leitura** — quais dados o usuário pode consultar
- **Permissões de criação** — quais entidades o usuário pode criar
- **Permissões de edição** — quais registros o usuário pode modificar
- **Permissões administrativas** — operações de gestão do sistema
- **Operações sensíveis** — ações que requerem auditoria obrigatória

O RBAC protege:

| Domínio | Exemplos |
|---|---|
| Dados comerciais | Propostas, metas, comissões, contratos |
| Dados de clientes | Empresas, contatos, histórico |
| Documentos contratuais | Contratos, PDFs, termos |
| Infraestrutura operacional | Ativos, incidentes, credenciais |
| Dados internos | Usuários, parceiros, audit logs |
| Documentação técnica | Wiki, runbooks, playbooks |

---

# 2. Conceito de RBAC na OPEN

## 2.1 Usuário

Representa uma pessoa autenticada no sistema.

Tabela principal: \`users\`

Cada usuário possui:

- **Identidade** — nome, email, documento
- **Papel** — função organizacional (executivo, gerente, admin)
- **Nível de acesso** — campo numérico \`level\` que define permissões implícitas
- **Entidade vinculada** — \`entity_id\` para vínculo com empresa ou parceiro
- **Status** — \`is_active\` controla se o usuário pode acessar o sistema

O usuário é autenticado via \`POST /api/auth/login\` e seu perfil carregado via \`GET /api/auth/me\`.

---

## 2.2 Papel (Role)

Representa uma função organizacional dentro da empresa.

Papéis existentes na OPEN:

| Papel | Descrição |
|---|---|
| Super Admin | Controle total do sistema |
| Admin Técnico | Gestão de infraestrutura e operação |
| Gerente de Suporte | Gestão da equipe de suporte |
| Suporte | Atendimento técnico e tickets |
| Sucesso do Cliente | Relacionamento e retenção |
| Gerente Comercial | Gestão da equipe comercial |
| Executivo Comercial | Vendas e propostas |
| RH | Gestão de pessoas |
| Parceiro | Usuário externo vinculado a canal |
| Cliente | Usuário externo contratante |

Papéis definem **o que o usuário pode fazer no sistema**.

---

## 2.3 Permissão

Permissões são ações específicas que um papel pode executar.

Permissões principais do sistema:

| Permissão | Descrição |
|---|---|
| \`read_proposals\` | Visualizar propostas |
| \`create_proposals\` | Criar novas propostas |
| \`edit_proposals\` | Editar propostas existentes |
| \`approve_proposals\` | Aprovar ou recusar propostas |
| \`send_proposals\` | Enviar propostas por email |
| \`view_contracts\` | Visualizar contratos |
| \`create_contracts\` | Criar novos contratos |
| \`view_tickets\` | Visualizar tickets de suporte |
| \`create_tickets\` | Abrir novos tickets |
| \`assign_tickets\` | Atribuir tickets a analistas |
| \`resolve_tickets\` | Resolver e encerrar tickets |
| \`manage_users\` | Criar, editar e desativar usuários |
| \`manage_system\` | Alterar configurações do sistema |
| \`access_admin_panel\` | Acessar painel administrativo |
| \`view_audit_logs\` | Consultar logs de auditoria |
| \`manage_roles\` | Gerenciar papéis e permissões |
| \`view_docs\` | Acessar documentação interna |
| \`edit_docs\` | Editar documentação |
| \`publish_docs\` | Publicar documentação |
| \`view_partners\` | Visualizar parceiros |
| \`create_partners\` | Cadastrar novos parceiros |
| \`edit_partners\` | Editar dados de parceiros |
| \`view_commissions\` | Visualizar comissões |
| \`manage_commissions\` | Alterar regras de comissão |

Permissões são agrupadas por papel. A associação atual é implícita via \`level\`.

---

# 3. Modelo atual baseado em nível

O sistema atual utiliza o campo:

\`\`\`
users.level
\`\`\`

Esse campo numérico representa permissões de forma hierárquica.

## 3.1 Tabela de níveis

| Level | Papel | Tipo | Descrição |
|---|---|---|---|
| 1 | Cliente | Externo | Cliente que contrata serviços da Open Datacenter |
| 200 | Parceiro | Externo | Parceiro com relacionamento comercial, vinculado a um Partner |
| 600 | RH | Interno | Gestão de pessoas |
| 700 | Comercial | Interno | Executivo comercial |
| 750 | Gerente Comercial | Interno | Gestão da equipe comercial |
| 775 | Sucesso do Cliente | Interno | CS — relacionamento e retenção |
| 900 | Suporte | Interno | Atendimento técnico |
| 950 | Gerente de Suporte | Interno | Gestão da equipe de suporte |
| 1000 | Admin | Interno | Super administrador do sistema |

## 3.2 Classificação por tipo

**Usuários externos:**
- Level 1 — Cliente
- Level 200 — Parceiro

**Usuários internos:**
- Level 600 — RH
- Level 700 — Comercial
- Level 750 — Gerente Comercial
- Level 775 — Sucesso do Cliente
- Level 900 — Suporte
- Level 950 — Gerente de Suporte
- Level 1000 — Admin

## 3.3 Regras de hierarquia

- Level mais alto implica **mais permissões**
- Verificações no código usam operadores \`>=\` ou \`===\`
- Exemplo: \`level >= 750\` concede visão global de propostas
- Exemplo: \`level >= 900\` concede acesso ao módulo de suporte técnico
- Exemplo: \`level === 1000\` concede acesso administrativo total

## 3.4 Limitações do modelo atual

Este modelo é **herança do sistema legado Laravel** e funciona como RBAC simplificado.

Limitações conhecidas:

1. **Um nível por usuário** — não permite múltiplos papéis
2. **Hierarquia linear** — não suporta permissões cruzadas (ex: suporte + comercial)
3. **Sem granularidade** — nível define tudo, sem permissões individuais
4. **Hardcoded** — regras estão espalhadas no código, não em tabela
5. **Sem delegação** — não é possível conceder permissões temporárias

---

# 4. Papéis funcionais da OPEN

## 4.1 Super Admin (Level 1000)

Acesso completo ao sistema.

**Pode:**
- Acessar todos os módulos sem restrição
- Gerenciar todos os usuários (criar, editar, desativar)
- Alterar configurações críticas do sistema
- Executar operações administrativas
- Visualizar todos os logs de auditoria
- Gerenciar papéis e permissões
- Acessar todas as propostas, contratos e tickets
- Gerenciar parceiros e comissões
- Acessar painel Admin completo
- Executar sync de documentação

**Responsabilidade:** Governança total do sistema.

---

## 4.2 Gerente de Suporte (Level 950)

Responsável pela equipe de suporte técnico.

**Pode:**
- Acessar módulo de Atendimentos completo
- Visualizar todos os tickets e incidentes
- Atribuir tickets a analistas
- Gerenciar fila de suporte
- Acessar relatórios de SLA
- Visualizar métricas de atendimento

**Não pode:**
- Gerenciar usuários do sistema
- Alterar configurações administrativas
- Acessar dados financeiros sensíveis de comissões

---

## 4.3 Suporte (Level 900)

Analista de suporte técnico.

**Pode:**
- Visualizar tickets atribuídos
- Responder e resolver tickets
- Abrir incidentes técnicos
- Registrar atendimento
- Acessar base de conhecimento

**Não pode:**
- Alterar dados comerciais
- Acessar propostas ou contratos
- Gerenciar outros usuários

---

## 4.4 Sucesso do Cliente (Level 775)

Responsável por relacionamento e retenção.

**Pode:**
- Visualizar dados de clientes
- Acompanhar health score
- Acessar histórico de atendimento
- Visualizar contratos ativos
- Acompanhar indicadores de CS

**Não pode:**
- Criar ou editar propostas comerciais
- Gerenciar configurações do sistema

---

## 4.5 Gerente Comercial (Level 750)

Responsável pela equipe de vendas.

**Pode:**
- Visualizar propostas de toda a equipe (visão global)
- Visualizar todos os contratos
- Acompanhar metas comerciais
- Acompanhar comissões da equipe
- Aprovar ou recusar propostas
- Acessar dashboards de gestão comercial

**Não pode:**
- Gerenciar usuários do sistema
- Alterar configurações administrativas
- Acessar módulo Admin

---

## 4.6 Executivo Comercial (Level 700)

Responsável por vendas diretas.

**Pode:**
- Criar novas propostas
- Editar propostas próprias
- Enviar propostas por email
- Acompanhar seus contratos
- Visualizar suas metas e comissões
- Acessar calculadora de propostas

**Não pode:**
- Visualizar propostas de outros executivos
- Aprovar propostas
- Gerenciar comissões
- Acessar dados da empresa inteira

**Regra crítica:** Executivos com \`level < 750\` veem apenas registros onde são \`owner_id\` ou \`created_by\`.

---

## 4.7 RH (Level 600)

Responsável por gestão de pessoas.

**Pode:**
- Acessar módulo Gente & Gestão
- Gerenciar vagas
- Visualizar estrutura organizacional
- Gerenciar avaliações
- Acessar Academy

**Não pode:**
- Acessar dados comerciais
- Acessar tickets de suporte
- Acessar configurações administrativas

---

## 4.8 Parceiro (Level 200)

Usuário externo vinculado a canal de parceria.

**Pode:**
- Acessar dashboard do parceiro
- Visualizar propostas vinculadas ao seu canal
- Criar oportunidades / indicações
- Acompanhar comissões próprias
- Acessar calculadora de parceiro

**Não pode:**
- Acessar módulos internos
- Visualizar dados de outros parceiros
- Gerenciar qualquer configuração

**Restrição:** Parceiro sempre está vinculado a um \`Partner\` via \`entity_id\`.

---

## 4.9 Cliente (Level 1)

Usuário externo que contrata serviços.

**Pode:**
- Acessar portal do cliente (quando disponível)
- Visualizar seus contratos
- Abrir tickets de suporte

**Não pode:**
- Acessar qualquer módulo interno
- Visualizar dados de outros clientes

---

# 5. Permissões por módulo

## 5.1 Dashboard

| Permissão | Descrição |
|---|---|
| \`view_dashboard\` | Visualizar dashboard principal |

**Acesso:** Todos os usuários internos autenticados (\`level >= 600\`).

Conteúdo do dashboard varia conforme o nível:
- Level 1000: KPIs globais, todas as áreas
- Level 750–950: KPIs da sua área + visão global
- Level 600–700: KPIs pessoais + resumo

---

## 5.2 Comercial

| Permissão | Papéis permitidos |
|---|---|
| \`view_proposals\` | Executivo (próprias), Gerente, Admin |
| \`create_proposals\` | Executivo, Gerente, Admin |
| \`edit_proposals\` | Executivo (próprias), Gerente, Admin |
| \`send_proposals\` | Executivo, Gerente, Admin |
| \`approve_proposals\` | Gerente (\`level >= 750\`), Admin |
| \`view_contracts\` | Executivo (próprios), Gerente, Admin |
| \`create_contracts\` | Gerente, Admin |
| \`view_commissions\` | Executivo (próprias), Gerente (equipe), Admin |
| \`manage_commissions\` | Admin |
| \`view_goals\` | Executivo (próprias), Gerente (equipe), Admin |

**Regra de escopo:**
- \`level < 750\`: vê apenas registros próprios (\`owner_id = user.id\`)
- \`level >= 750\`: visão global de todos os registros

---

## 5.3 Parceiros

| Permissão | Papéis permitidos |
|---|---|
| \`view_partners\` | Gerente (\`>= 750\`), Admin |
| \`create_partners\` | Admin |
| \`edit_partners\` | Admin |
| \`view_partner_commissions\` | Gerente, Admin |
| \`manage_partner_tiers\` | Admin |

---

## 5.4 Atendimentos

| Permissão | Papéis permitidos |
|---|---|
| \`view_tickets\` | Suporte, Gerente de Suporte, Admin |
| \`create_tickets\` | Suporte, Gerente de Suporte, Admin |
| \`assign_tickets\` | Gerente de Suporte, Admin |
| \`resolve_tickets\` | Suporte, Gerente de Suporte, Admin |
| \`view_sla_reports\` | Gerente de Suporte, Admin |
| \`manage_sla_policies\` | Admin |

---

## 5.5 Docs

| Permissão | Papéis permitidos |
|---|---|
| \`view_docs\` | Todos os internos (\`level >= 600\`) |
| \`edit_docs\` | Admin, Gerente técnico (\`level >= 750\`) |
| \`publish_docs\` | Admin |
| \`access_docs_admin\` | Admin, Gerente (\`level >= 750\`) |
| \`run_docs_sync\` | Admin |

---

## 5.6 Gente & Gestão

| Permissão | Papéis permitidos |
|---|---|
| \`view_jobs\` | RH (\`level >= 600\`), Admin |
| \`manage_jobs\` | RH, Admin |
| \`view_evaluations\` | RH, Gerente, Admin |
| \`manage_academy\` | RH, Admin |

---

## 5.7 Admin

| Permissão | Papéis permitidos |
|---|---|
| \`manage_users\` | Admin (\`level === 1000\`) |
| \`manage_system\` | Admin |
| \`view_audit_logs\` | Admin |
| \`manage_roles\` | Admin |
| \`manage_parameters\` | Admin |

---

# 6. Controle de acesso no frontend

O frontend implementa controle de acesso em múltiplas camadas:

## 6.1 Menu lateral

Itens do menu são condicionados ao \`level\` do usuário.

Exemplo de implementação:
\`\`\`typescript
// menuConfig.ts
{
  label: 'Admin',
  minLevel: 1000,
  items: [...]
}
\`\`\`

Itens com \`minLevel\` superior ao nível do usuário são ocultados.

## 6.2 Rotas protegidas

Rotas são protegidas no roteador:

\`\`\`typescript
// Exemplo conceitual
<Route element={<ProtectedRoute minLevel={750} />}>
  <Route path="/admin/*" element={<AdminLayout />} />
</Route>
\`\`\`

Acesso direto via URL é validado. Se o nível for insuficiente, o usuário é redirecionado ou recebe mensagem de acesso negado.

## 6.3 Componentes condicionais

Dentro de páginas, ações são condicionadas:

\`\`\`typescript
{user.level >= 750 && (
  <Button onClick={handleApprove}>Aprovar Proposta</Button>
)}
\`\`\`

## 6.4 Regra crítica

> **Frontend NÃO é fonte de segurança.**
>
> O controle no frontend é apenas para UX. O controle real de acesso
> DEVE existir também no backend (API legada ou Supabase RLS).

---

# 7. Controle de acesso no Supabase

O Supabase utiliza **Row Level Security (RLS)** para controle de acesso no banco de dados.

## 7.1 Princípio

Toda tabela com dados sensíveis deve ter RLS habilitado. Políticas definem quem pode SELECT, INSERT, UPDATE e DELETE.

## 7.2 Políticas recomendadas

### Propostas

\`\`\`sql
-- Executivo vê apenas propostas que criou
CREATE POLICY "exec_view_own_proposals"
ON calculator_proposals FOR SELECT
TO authenticated
USING (created_by = auth.uid());

-- Gerente vê todas as propostas
CREATE POLICY "manager_view_all_proposals"
ON calculator_proposals FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'manager'));
\`\`\`

### Contratos

\`\`\`sql
-- Apenas admin pode criar contratos
CREATE POLICY "admin_create_contracts"
ON contracts FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));
\`\`\`

### Eventos

\`\`\`sql
-- Eventos são append-only, qualquer autenticado pode inserir
CREATE POLICY "authenticated_insert_events"
ON proposal_events FOR INSERT
TO authenticated
WITH CHECK (true);

-- Apenas gestão pode ler eventos
CREATE POLICY "management_read_events"
ON proposal_events FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'manager')
    OR public.has_role(auth.uid(), 'admin'));
\`\`\`

## 7.3 Função auxiliar

Utilizar função \`SECURITY DEFINER\` para evitar recursão em RLS:

\`\`\`sql
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;
\`\`\`

## 7.4 Contexto atual

O sistema OPEN atualmente opera com um modelo híbrido:
- **API legada** — controle via middleware Laravel (verifica \`level\` do token)
- **Supabase** — controle via RLS ou Edge Functions com \`SERVICE_ROLE_KEY\`

As Edge Functions (\`proposal-list\`, \`proposal-get\`, \`proposal-save\`) usam \`SERVICE_ROLE_KEY\` para acessar dados, pois o sistema legado não possui sessões nativas de Supabase Auth.

---

# 8. Políticas de segurança críticas

## 8.1 Regras obrigatórias

1. **Acesso explícito** — Usuário nunca deve acessar dados sem permissão explícita definida por \`level\` ou RLS.

2. **Operações administrativas** — Exigem \`level >= 950\` ou \`level === 1000\`.

3. **Auditoria obrigatória** — Toda operação sensível deve gerar registro em \`audit_logs\`:
   - Usuário que executou
   - Ação realizada
   - Entidade afetada
   - Timestamp da operação
   - Dados anteriores e posteriores (quando aplicável)

4. **Operações sensíveis que exigem audit log:**
   - Exclusão de qualquer registro
   - Alteração de contrato
   - Alteração de dados de usuário
   - Alteração de comissões
   - Alteração de permissões
   - Cancelamento de proposta

5. **Sessão** — Token de autenticação deve ser validado em toda requisição. Erros 401/403 devem redirecionar para login.

---

## 8.2 Regras de escopo de dados

| Nível | Escopo de dados |
|---|---|
| \`level < 750\` | Apenas registros próprios (\`owner_id\` ou \`created_by\`) |
| \`level >= 750\` | Visão global — todos os registros do domínio |
| \`level === 1000\` | Acesso irrestrito a todos os dados e configurações |

## 8.3 Acesso via URL direta

O sistema valida acesso mesmo quando o usuário tenta acessar uma URL diretamente (deep link). Se o nível for insuficiente ou o registro não pertencer ao usuário, o sistema retorna erro de acesso negado.

---

# 9. Integração com audit_logs

Ações importantes geram registros na tabela \`audit_logs\` (ou \`cert_audit_logs\` para o módulo TechOps).

## 9.1 Eventos de auditoria obrigatórios

| Evento | Descrição |
|---|---|
| \`user.created\` | Novo usuário criado |
| \`user.updated\` | Dados de usuário alterados |
| \`user.deleted\` | Usuário desativado ou removido |
| \`user.login\` | Login realizado |
| \`user.login_failed\` | Tentativa de login falhou |
| \`proposal.created\` | Nova proposta criada |
| \`proposal.updated\` | Proposta editada |
| \`proposal.deleted\` | Proposta removida |
| \`proposal.approved\` | Proposta aprovada |
| \`proposal.rejected\` | Proposta recusada |
| \`proposal.sent\` | Proposta enviada por email |
| \`contract.created\` | Novo contrato criado |
| \`contract.signed\` | Contrato assinado |
| \`contract.cancelled\` | Contrato cancelado |
| \`permission.changed\` | Permissão de usuário alterada |
| \`commission.overridden\` | Comissão alterada manualmente |
| \`config.updated\` | Configuração do sistema alterada |

## 9.2 Estrutura do audit log

\`\`\`
audit_logs
├── id uuid
├── user_id — quem executou
├── resource_id — entidade afetada
├── module — módulo de origem
├── action — ação realizada (entity.action)
├── description — descrição legível
├── old jsonb — estado anterior
├── new jsonb — estado posterior
├── meta jsonb — metadados adicionais
└── created_at timestamptz
\`\`\`

## 9.3 Regras

- Audit logs são **append-only** — nunca editados ou removidos
- Audit logs devem ser gerados **após sucesso da operação**, não antes
- Audit logs devem conter informação suficiente para reconstruir a ação

---

# 10. Evolução futura do RBAC

O modelo atual baseado em \`level\` numérico pode evoluir para um sistema mais granular.

## 10.1 Modelo futuro sugerido

Tabelas:

\`\`\`
roles
├── id uuid
├── name text (unique)
├── description text
├── created_at timestamptz
└── updated_at timestamptz

permissions
├── id uuid
├── key text (unique)
├── description text
├── module text
├── created_at timestamptz
└── updated_at timestamptz

role_permissions
├── id uuid
├── role_id uuid FK → roles
├── permission_id uuid FK → permissions
└── created_at timestamptz

user_roles
├── id uuid
├── user_id uuid FK → auth.users
├── role_id uuid FK → roles
└── created_at timestamptz
\`\`\`

## 10.2 Benefícios do modelo futuro

| Benefício | Descrição |
|---|---|
| Múltiplos papéis | Um usuário pode ser Comercial + CS simultaneamente |
| Granularidade | Permissões individuais por ação |
| Delegação | Conceder permissões temporárias |
| Customização | Papéis personalizados por contexto |
| Auditabilidade | Rastreamento completo de mudanças em permissões |
| Escalabilidade | Novos módulos adicionam permissões sem alterar código |

## 10.3 Estratégia de migração

1. **Fase 1** — Criar tabelas \`roles\`, \`permissions\`, \`role_permissions\`, \`user_roles\`
2. **Fase 2** — Popular com papéis equivalentes aos níveis atuais
3. **Fase 3** — Implementar \`has_role()\` e \`has_permission()\` como funções SQL
4. **Fase 4** — Migrar verificações de \`level\` para \`has_permission()\` progressivamente
5. **Fase 5** — Depreciar campo \`level\` quando migração estiver completa

---

# 11. Estrutura futura recomendada

## 11.1 Tabela \`roles\`

\`\`\`sql
CREATE TABLE public.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
\`\`\`

Papéis iniciais:

| name | description |
|---|---|
| super_admin | Controle total do sistema |
| admin | Administração do sistema |
| gerente_suporte | Gestão de suporte |
| suporte | Analista de suporte |
| cs | Sucesso do cliente |
| gerente_comercial | Gestão comercial |
| executivo | Executivo comercial |
| rh | Recursos humanos |
| parceiro | Parceiro externo |
| cliente | Cliente externo |

## 11.2 Tabela \`permissions\`

\`\`\`sql
CREATE TABLE public.permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  description text,
  module text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
\`\`\`

## 11.3 Tabela \`role_permissions\`

\`\`\`sql
CREATE TABLE public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id uuid REFERENCES public.roles(id) ON DELETE CASCADE NOT NULL,
  permission_id uuid REFERENCES public.permissions(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (role_id, permission_id)
);
\`\`\`

## 11.4 Tabela \`user_roles\`

\`\`\`sql
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role_id uuid REFERENCES public.roles(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, role_id)
);
\`\`\`

## 11.5 Funções auxiliares

\`\`\`sql
-- Verificar se usuário tem papel específico
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = _user_id AND r.name = _role
  )
$$;

-- Verificar se usuário tem permissão específica
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN role_permissions rp ON rp.role_id = ur.role_id
    JOIN permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = _user_id AND p.key = _permission
  )
$$;
\`\`\`

---

# 12. Regras críticas do RBAC

## 12.1 Anti-patterns proibidos

| Anti-pattern | Risco |
|---|---|
| Verificar permissões **apenas no frontend** | Bypass completo via DevTools ou API direta |
| Confiar apenas no nível numérico sem validação backend | Escalação de privilégio |
| Criar exceções hardcoded para usuários específicos | Manutenção impossível, risco de segurança |
| Permitir acesso direto via API sem validação de token | Acesso não autorizado |
| Conceder acesso admin sem auditoria | Violação de governança |
| Armazenar papel em \`localStorage\` como fonte de verdade | Manipulação trivial pelo cliente |
| Criar rotas sem verificação de nível | Acesso indevido via URL direta |
| Hardcode de IDs de usuários para permissões especiais | Fragilidade e risco |

## 12.2 Práticas obrigatórias

1. Toda rota protegida deve validar \`level\` ou papel no backend
2. Toda operação de escrita deve verificar permissão antes de executar
3. Toda operação sensível deve gerar audit log
4. Frontend deve ocultar ações não permitidas (UX), mas nunca como única barreira
5. Tokens expirados devem redirecionar para login imediatamente
6. Erros 401 e 403 devem ser tratados globalmente pelo interceptor HTTP

---

# 13. Diretrizes para novos módulos

Todo novo módulo adicionado à plataforma OPEN deve definir obrigatoriamente:

| Item | Descrição |
|---|---|
| **Papéis com acesso** | Quais papéis podem acessar o módulo |
| **Permissões** | Lista de permissões específicas do módulo |
| **Operações restritas** | Quais ações exigem nível elevado |
| **Eventos de auditoria** | Quais ações geram audit log |
| **Escopo de dados** | Regras de visibilidade (próprio vs global) |
| **RLS policies** | Políticas de segurança no banco de dados |
| **Documentação** | Entrada no /docs com regras de acesso |

### Template de definição de acesso para novo módulo

\`\`\`markdown
## Módulo: [nome]

### Acesso
- Level mínimo: [número]
- Papéis: [lista]

### Permissões
- [permission_key]: [descrição]

### Escopo
- Level < X: dados próprios
- Level >= X: dados globais

### Audit events
- [entity.action]: [descrição]

### RLS
- [descrição da política]
\`\`\`

---

# 14. Integração com documentação

Este documento deve ser mantido sincronizado com:

| Documento | Relação |
|---|---|
| \`OPEN_DATA_MODEL.md\` | Estrutura de tabelas de usuários e roles |
| \`OPEN_SYSTEM_BLUEPRINT.md\` | Visão geral da arquitetura e camadas de segurança |
| \`OPEN_EVENT_MODEL.md\` | Eventos de auditoria e tracking |
| \`OPEN_MODULE_MAP.md\` | Mapa de módulos e níveis de acesso |

Qualquer alteração no modelo de acesso deve:

1. Atualizar este documento (\`OPEN_RBAC_MODEL.md\`)
2. Atualizar o Event Model se novos eventos de auditoria forem criados
3. Atualizar o Module Map se novas regras de acesso por módulo forem definidas
4. Atualizar o Data Model se novas tabelas de RBAC forem criadas

---

# 15. Conclusão

O RBAC é fundamental para:

- **Segurança do sistema** — impedir acesso não autorizado a dados e operações
- **Organização interna** — cada papel tem responsabilidades claras
- **Governança de dados** — controle sobre quem pode ver e alterar informações
- **Conformidade** — rastreabilidade completa de ações via audit logs
- **Escalabilidade** — novos módulos seguem padrão definido

**Regra absoluta:** nenhum módulo novo deve ser criado sem definir claramente suas regras de acesso, permissões por papel e eventos de auditoria.

O modelo atual baseado em \`level\` numérico atende às necessidades operacionais, mas a evolução para tabelas granulares (\`roles\`, \`permissions\`, \`role_permissions\`, \`user_roles\`) é recomendada para suportar crescimento e complexidade futura.
`;
