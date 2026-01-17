-- PARTE 1: Remover todas as policies permissivas existentes

-- tech_users
DROP POLICY IF EXISTS "Allow all users to read tech_users" ON public.tech_users;
DROP POLICY IF EXISTS "Allow admin to insert tech_users" ON public.tech_users;
DROP POLICY IF EXISTS "Allow admin to update tech_users" ON public.tech_users;
DROP POLICY IF EXISTS "Allow admin to delete tech_users" ON public.tech_users;

-- tech_clients
DROP POLICY IF EXISTS "Allow all users to read tech_clients" ON public.tech_clients;
DROP POLICY IF EXISTS "Allow admin to insert tech_clients" ON public.tech_clients;
DROP POLICY IF EXISTS "Allow admin to update tech_clients" ON public.tech_clients;
DROP POLICY IF EXISTS "Allow admin to delete tech_clients" ON public.tech_clients;

-- tech_assets
DROP POLICY IF EXISTS "Allow all users to read tech_assets" ON public.tech_assets;
DROP POLICY IF EXISTS "Allow admin to insert tech_assets" ON public.tech_assets;
DROP POLICY IF EXISTS "Allow admin to update tech_assets" ON public.tech_assets;
DROP POLICY IF EXISTS "Allow admin to delete tech_assets" ON public.tech_assets;

-- tech_credentials
DROP POLICY IF EXISTS "Allow all users to read tech_credentials" ON public.tech_credentials;
DROP POLICY IF EXISTS "Allow admin to insert tech_credentials" ON public.tech_credentials;
DROP POLICY IF EXISTS "Allow admin to update tech_credentials" ON public.tech_credentials;
DROP POLICY IF EXISTS "Allow admin to delete tech_credentials" ON public.tech_credentials;

-- tech_incidents
DROP POLICY IF EXISTS "Allow all users to read tech_incidents" ON public.tech_incidents;
DROP POLICY IF EXISTS "Allow admin and tech users to insert tech_incidents" ON public.tech_incidents;
DROP POLICY IF EXISTS "Allow admin and tech users to update tech_incidents" ON public.tech_incidents;
DROP POLICY IF EXISTS "Allow admin to delete tech_incidents" ON public.tech_incidents;

-- tech_incident_actions
DROP POLICY IF EXISTS "Allow all users to read tech_incident_actions" ON public.tech_incident_actions;
DROP POLICY IF EXISTS "Allow tech users to insert tech_incident_actions" ON public.tech_incident_actions;
DROP POLICY IF EXISTS "Allow admin to update tech_incident_actions" ON public.tech_incident_actions;
DROP POLICY IF EXISTS "Allow admin to delete tech_incident_actions" ON public.tech_incident_actions;

-- tech_incident_root_cause
DROP POLICY IF EXISTS "Allow all users to read tech_incident_root_cause" ON public.tech_incident_root_cause;
DROP POLICY IF EXISTS "Allow tech users to insert tech_incident_root_cause" ON public.tech_incident_root_cause;
DROP POLICY IF EXISTS "Allow tech users to update tech_incident_root_cause" ON public.tech_incident_root_cause;
DROP POLICY IF EXISTS "Allow admin to delete tech_incident_root_cause" ON public.tech_incident_root_cause;

-- tech_on_call_shifts
DROP POLICY IF EXISTS "Allow all users to read tech_on_call_shifts" ON public.tech_on_call_shifts;
DROP POLICY IF EXISTS "Allow admin to insert tech_on_call_shifts" ON public.tech_on_call_shifts;
DROP POLICY IF EXISTS "Allow admin to update tech_on_call_shifts" ON public.tech_on_call_shifts;
DROP POLICY IF EXISTS "Allow admin to delete tech_on_call_shifts" ON public.tech_on_call_shifts;

-- PARTE 2: Adicionar owner_id para bootstrap controlado
ALTER TABLE public.tech_users ADD COLUMN IF NOT EXISTS owner_id uuid;

-- Atualizar função is_tech_admin para ser mais robusta
CREATE OR REPLACE FUNCTION public.is_tech_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tech_users
    WHERE email = auth.jwt() ->> 'email'
      AND role = 'ADMIN'
      AND is_active = true
  )
$$;

-- Função auxiliar para verificar se é membro do time TechOps
CREATE OR REPLACE FUNCTION public.is_tech_team_member()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tech_users
    WHERE email = auth.jwt() ->> 'email'
      AND is_active = true
  )
$$;

-- PARTE 3: Criar policies corretas para tech_users (com bootstrap)

-- SELECT: Membros do time podem ver todos; usuário pode ver a si mesmo
CREATE POLICY "tech_users_select_authenticated"
ON public.tech_users
FOR SELECT
TO authenticated
USING (
  is_tech_team_member() 
  OR email = auth.jwt() ->> 'email'
);

-- INSERT: Bootstrap (tabela vazia) OU ADMIN existente
CREATE POLICY "tech_users_insert_bootstrap"
ON public.tech_users
FOR INSERT
TO authenticated
WITH CHECK (
  -- Bootstrap: permite primeiro insert se tabela vazia
  (NOT EXISTS (SELECT 1 FROM public.tech_users LIMIT 1))
  OR
  -- ADMIN pode inserir novos usuários
  is_tech_admin()
);

-- UPDATE: Apenas ADMIN
CREATE POLICY "tech_users_update_admin"
ON public.tech_users
FOR UPDATE
TO authenticated
USING (is_tech_admin());

-- DELETE: Apenas ADMIN
CREATE POLICY "tech_users_delete_admin"
ON public.tech_users
FOR DELETE
TO authenticated
USING (is_tech_admin());

-- PARTE 4: Policies para tech_clients

CREATE POLICY "tech_clients_select_team"
ON public.tech_clients
FOR SELECT
TO authenticated
USING (is_tech_team_member());

CREATE POLICY "tech_clients_insert_admin"
ON public.tech_clients
FOR INSERT
TO authenticated
WITH CHECK (is_tech_admin());

CREATE POLICY "tech_clients_update_admin"
ON public.tech_clients
FOR UPDATE
TO authenticated
USING (is_tech_admin());

CREATE POLICY "tech_clients_delete_admin"
ON public.tech_clients
FOR DELETE
TO authenticated
USING (is_tech_admin());

-- PARTE 5: Policies para tech_assets

CREATE POLICY "tech_assets_select_team"
ON public.tech_assets
FOR SELECT
TO authenticated
USING (is_tech_team_member());

CREATE POLICY "tech_assets_insert_admin"
ON public.tech_assets
FOR INSERT
TO authenticated
WITH CHECK (is_tech_admin());

CREATE POLICY "tech_assets_update_admin"
ON public.tech_assets
FOR UPDATE
TO authenticated
USING (is_tech_admin());

CREATE POLICY "tech_assets_delete_admin"
ON public.tech_assets
FOR DELETE
TO authenticated
USING (is_tech_admin());

-- PARTE 6: Policies para tech_credentials

CREATE POLICY "tech_credentials_select_team"
ON public.tech_credentials
FOR SELECT
TO authenticated
USING (is_tech_team_member());

CREATE POLICY "tech_credentials_insert_admin"
ON public.tech_credentials
FOR INSERT
TO authenticated
WITH CHECK (is_tech_admin());

CREATE POLICY "tech_credentials_update_admin"
ON public.tech_credentials
FOR UPDATE
TO authenticated
USING (is_tech_admin());

CREATE POLICY "tech_credentials_delete_admin"
ON public.tech_credentials
FOR DELETE
TO authenticated
USING (is_tech_admin());

-- PARTE 7: Policies para tech_incidents (time pode criar/atualizar, admin pode deletar)

CREATE POLICY "tech_incidents_select_team"
ON public.tech_incidents
FOR SELECT
TO authenticated
USING (is_tech_team_member());

CREATE POLICY "tech_incidents_insert_team"
ON public.tech_incidents
FOR INSERT
TO authenticated
WITH CHECK (is_tech_team_member());

CREATE POLICY "tech_incidents_update_team"
ON public.tech_incidents
FOR UPDATE
TO authenticated
USING (is_tech_team_member());

CREATE POLICY "tech_incidents_delete_admin"
ON public.tech_incidents
FOR DELETE
TO authenticated
USING (is_tech_admin());

-- PARTE 8: Policies para tech_incident_actions

CREATE POLICY "tech_incident_actions_select_team"
ON public.tech_incident_actions
FOR SELECT
TO authenticated
USING (is_tech_team_member());

CREATE POLICY "tech_incident_actions_insert_team"
ON public.tech_incident_actions
FOR INSERT
TO authenticated
WITH CHECK (is_tech_team_member());

CREATE POLICY "tech_incident_actions_update_admin"
ON public.tech_incident_actions
FOR UPDATE
TO authenticated
USING (is_tech_admin());

CREATE POLICY "tech_incident_actions_delete_admin"
ON public.tech_incident_actions
FOR DELETE
TO authenticated
USING (is_tech_admin());

-- PARTE 9: Policies para tech_incident_root_cause

CREATE POLICY "tech_incident_root_cause_select_team"
ON public.tech_incident_root_cause
FOR SELECT
TO authenticated
USING (is_tech_team_member());

CREATE POLICY "tech_incident_root_cause_insert_team"
ON public.tech_incident_root_cause
FOR INSERT
TO authenticated
WITH CHECK (is_tech_team_member());

CREATE POLICY "tech_incident_root_cause_update_team"
ON public.tech_incident_root_cause
FOR UPDATE
TO authenticated
USING (is_tech_team_member());

CREATE POLICY "tech_incident_root_cause_delete_admin"
ON public.tech_incident_root_cause
FOR DELETE
TO authenticated
USING (is_tech_admin());

-- PARTE 10: Policies para tech_on_call_shifts

CREATE POLICY "tech_on_call_shifts_select_team"
ON public.tech_on_call_shifts
FOR SELECT
TO authenticated
USING (is_tech_team_member());

CREATE POLICY "tech_on_call_shifts_insert_admin"
ON public.tech_on_call_shifts
FOR INSERT
TO authenticated
WITH CHECK (is_tech_admin());

CREATE POLICY "tech_on_call_shifts_update_admin"
ON public.tech_on_call_shifts
FOR UPDATE
TO authenticated
USING (is_tech_admin());

CREATE POLICY "tech_on_call_shifts_delete_admin"
ON public.tech_on_call_shifts
FOR DELETE
TO authenticated
USING (is_tech_admin());