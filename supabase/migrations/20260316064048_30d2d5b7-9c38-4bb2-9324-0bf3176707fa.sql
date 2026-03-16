
-- ============================================================================
-- PART 2: Create roles and user_roles tables
-- PART 3: Seed initial roles
-- ============================================================================

-- 1. Create roles table
CREATE TABLE public.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  module text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Create user_roles table
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  assigned_by uuid REFERENCES public.profiles(id),
  assigned_at timestamptz NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true,
  UNIQUE(user_id, role_id)
);

-- 3. Indexes
CREATE INDEX idx_roles_code ON public.roles(code);
CREATE INDEX idx_roles_is_active ON public.roles(is_active);
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_user_roles_role_id ON public.user_roles(role_id);
CREATE INDEX idx_user_roles_is_active ON public.user_roles(is_active);

-- 4. Updated_at triggers
CREATE TRIGGER set_roles_updated_at
  BEFORE UPDATE ON public.roles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_user_roles_updated_at
  BEFORE UPDATE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5. Enable RLS
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 6. RLS policies for roles (read by internal, manage by admin)
CREATE POLICY roles_select_internal ON public.roles
  FOR SELECT TO authenticated
  USING (is_internal_user());

CREATE POLICY roles_manage_admin ON public.roles
  FOR ALL TO authenticated
  USING (is_profile_admin())
  WITH CHECK (is_profile_admin());

-- 7. RLS policies for user_roles (read by internal, manage by admin)
CREATE POLICY user_roles_select_own ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY user_roles_select_internal ON public.user_roles
  FOR SELECT TO authenticated
  USING (is_internal_user());

CREATE POLICY user_roles_manage_admin ON public.user_roles
  FOR ALL TO authenticated
  USING (is_profile_admin())
  WITH CHECK (is_profile_admin());

-- 8. Seed initial roles
INSERT INTO public.roles (code, name, description, module) VALUES
  ('internal_user', 'Usuário Interno', 'Role base para todos os colaboradores internos', NULL),
  ('admin', 'Administrador', 'Acesso total ao sistema', NULL),
  ('gerente_suporte', 'Gerente de Suporte', 'Gestão das equipes e filas de suporte', 'atendimentos'),
  ('suporte_n1', 'Suporte N1', 'Atendimento de primeiro nível', 'atendimentos'),
  ('suporte_n2', 'Suporte N2', 'Atendimento de segundo nível', 'atendimentos'),
  ('suporte_n3', 'Suporte N3', 'Atendimento de terceiro nível', 'atendimentos'),
  ('cs', 'Customer Success', 'Sucesso do cliente e acompanhamento', 'cs'),
  ('comercial', 'Executivo Comercial', 'Vendas e propostas comerciais', 'comercial'),
  ('gerente_comercial', 'Gerente Comercial', 'Gestão da equipe comercial', 'comercial'),
  ('rh', 'Recursos Humanos', 'Gestão de pessoas e vagas', 'gente'),
  ('parceiro', 'Parceiro', 'Parceiro externo da Open Datacenter', 'parceiros'),
  ('cliente', 'Cliente', 'Cliente que contrata serviços', 'portal'),
  ('plantonista', 'Plantonista', 'Escala de plantão técnico', 'atendimentos'),
  ('noc_manager', 'NOC Manager', 'Gestão do NOC', 'techops'),
  ('noc_viewer', 'NOC Viewer', 'Visualização do NOC', 'techops');

-- 9. Create role_audit_logs table for PART 8
CREATE TABLE public.role_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  actor_id uuid REFERENCES public.profiles(id),
  action text NOT NULL,
  role_code text,
  previous_value jsonb,
  new_value jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.role_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY role_audit_select_admin ON public.role_audit_logs
  FOR SELECT TO authenticated
  USING (is_profile_admin());

CREATE POLICY role_audit_insert_admin ON public.role_audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (is_profile_admin());

CREATE INDEX idx_role_audit_user_id ON public.role_audit_logs(user_id);
CREATE INDEX idx_role_audit_created_at ON public.role_audit_logs(created_at);
