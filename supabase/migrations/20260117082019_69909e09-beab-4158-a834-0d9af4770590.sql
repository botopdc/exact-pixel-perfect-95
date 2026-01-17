-- =============================================================================
-- FIX RLS POLICIES FOR TECHOPS TABLES - ALLOW ADMIN ACCESS
-- =============================================================================

-- Step 1: Create a security definer function to check admin role
-- This avoids infinite recursion when checking roles from within RLS policies
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

-- Step 2: Drop existing RESTRICTIVE policies and replace with PERMISSIVE ones

-- ============ tech_users ============
DROP POLICY IF EXISTS "Allow read tech_users" ON public.tech_users;
DROP POLICY IF EXISTS "Allow insert tech_users" ON public.tech_users;
DROP POLICY IF EXISTS "Allow update tech_users" ON public.tech_users;
DROP POLICY IF EXISTS "Allow delete tech_users" ON public.tech_users;

CREATE POLICY "Allow all users to read tech_users"
ON public.tech_users FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow admin to insert tech_users"
ON public.tech_users FOR INSERT
TO authenticated
WITH CHECK (
  public.is_tech_admin() OR 
  NOT EXISTS (SELECT 1 FROM public.tech_users LIMIT 1) -- Allow first user creation for bootstrapping
);

CREATE POLICY "Allow admin to update tech_users"
ON public.tech_users FOR UPDATE
TO authenticated
USING (public.is_tech_admin());

CREATE POLICY "Allow admin to delete tech_users"
ON public.tech_users FOR DELETE
TO authenticated
USING (public.is_tech_admin());

-- ============ tech_clients ============
DROP POLICY IF EXISTS "Allow read tech_clients" ON public.tech_clients;
DROP POLICY IF EXISTS "Allow insert tech_clients" ON public.tech_clients;
DROP POLICY IF EXISTS "Allow update tech_clients" ON public.tech_clients;
DROP POLICY IF EXISTS "Allow delete tech_clients" ON public.tech_clients;

CREATE POLICY "Allow all users to read tech_clients"
ON public.tech_clients FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow admin to insert tech_clients"
ON public.tech_clients FOR INSERT
TO authenticated
WITH CHECK (public.is_tech_admin());

CREATE POLICY "Allow admin to update tech_clients"
ON public.tech_clients FOR UPDATE
TO authenticated
USING (public.is_tech_admin());

CREATE POLICY "Allow admin to delete tech_clients"
ON public.tech_clients FOR DELETE
TO authenticated
USING (public.is_tech_admin());

-- ============ tech_assets ============
DROP POLICY IF EXISTS "Allow read tech_assets" ON public.tech_assets;
DROP POLICY IF EXISTS "Allow insert tech_assets" ON public.tech_assets;
DROP POLICY IF EXISTS "Allow update tech_assets" ON public.tech_assets;
DROP POLICY IF EXISTS "Allow delete tech_assets" ON public.tech_assets;

CREATE POLICY "Allow all users to read tech_assets"
ON public.tech_assets FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow admin to insert tech_assets"
ON public.tech_assets FOR INSERT
TO authenticated
WITH CHECK (public.is_tech_admin());

CREATE POLICY "Allow admin to update tech_assets"
ON public.tech_assets FOR UPDATE
TO authenticated
USING (public.is_tech_admin());

CREATE POLICY "Allow admin to delete tech_assets"
ON public.tech_assets FOR DELETE
TO authenticated
USING (public.is_tech_admin());

-- ============ tech_credentials ============
DROP POLICY IF EXISTS "Allow read tech_credentials" ON public.tech_credentials;
DROP POLICY IF EXISTS "Allow insert tech_credentials" ON public.tech_credentials;
DROP POLICY IF EXISTS "Allow update tech_credentials" ON public.tech_credentials;
DROP POLICY IF EXISTS "Allow delete tech_credentials" ON public.tech_credentials;

CREATE POLICY "Allow all users to read tech_credentials"
ON public.tech_credentials FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow admin to insert tech_credentials"
ON public.tech_credentials FOR INSERT
TO authenticated
WITH CHECK (public.is_tech_admin());

CREATE POLICY "Allow admin to update tech_credentials"
ON public.tech_credentials FOR UPDATE
TO authenticated
USING (public.is_tech_admin());

CREATE POLICY "Allow admin to delete tech_credentials"
ON public.tech_credentials FOR DELETE
TO authenticated
USING (public.is_tech_admin());

-- ============ tech_incidents ============
DROP POLICY IF EXISTS "Allow read tech_incidents" ON public.tech_incidents;
DROP POLICY IF EXISTS "Allow insert tech_incidents" ON public.tech_incidents;
DROP POLICY IF EXISTS "Allow update tech_incidents" ON public.tech_incidents;
DROP POLICY IF EXISTS "Allow delete tech_incidents" ON public.tech_incidents;

CREATE POLICY "Allow all users to read tech_incidents"
ON public.tech_incidents FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow admin and tech users to insert tech_incidents"
ON public.tech_incidents FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.tech_users
    WHERE email = auth.jwt() ->> 'email'
      AND is_active = true
  )
);

CREATE POLICY "Allow admin and tech users to update tech_incidents"
ON public.tech_incidents FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.tech_users
    WHERE email = auth.jwt() ->> 'email'
      AND is_active = true
  )
);

CREATE POLICY "Allow admin to delete tech_incidents"
ON public.tech_incidents FOR DELETE
TO authenticated
USING (public.is_tech_admin());

-- ============ tech_incident_actions ============
DROP POLICY IF EXISTS "Allow read tech_incident_actions" ON public.tech_incident_actions;
DROP POLICY IF EXISTS "Allow insert tech_incident_actions" ON public.tech_incident_actions;
DROP POLICY IF EXISTS "Allow update tech_incident_actions" ON public.tech_incident_actions;
DROP POLICY IF EXISTS "Allow delete tech_incident_actions" ON public.tech_incident_actions;

CREATE POLICY "Allow all users to read tech_incident_actions"
ON public.tech_incident_actions FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow tech users to insert tech_incident_actions"
ON public.tech_incident_actions FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.tech_users
    WHERE email = auth.jwt() ->> 'email'
      AND is_active = true
  )
);

CREATE POLICY "Allow admin to update tech_incident_actions"
ON public.tech_incident_actions FOR UPDATE
TO authenticated
USING (public.is_tech_admin());

CREATE POLICY "Allow admin to delete tech_incident_actions"
ON public.tech_incident_actions FOR DELETE
TO authenticated
USING (public.is_tech_admin());

-- ============ tech_incident_root_cause ============
DROP POLICY IF EXISTS "Allow read tech_incident_root_cause" ON public.tech_incident_root_cause;
DROP POLICY IF EXISTS "Allow insert tech_incident_root_cause" ON public.tech_incident_root_cause;
DROP POLICY IF EXISTS "Allow update tech_incident_root_cause" ON public.tech_incident_root_cause;
DROP POLICY IF EXISTS "Allow delete tech_incident_root_cause" ON public.tech_incident_root_cause;

CREATE POLICY "Allow all users to read tech_incident_root_cause"
ON public.tech_incident_root_cause FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow tech users to insert tech_incident_root_cause"
ON public.tech_incident_root_cause FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.tech_users
    WHERE email = auth.jwt() ->> 'email'
      AND is_active = true
  )
);

CREATE POLICY "Allow tech users to update tech_incident_root_cause"
ON public.tech_incident_root_cause FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.tech_users
    WHERE email = auth.jwt() ->> 'email'
      AND is_active = true
  )
);

CREATE POLICY "Allow admin to delete tech_incident_root_cause"
ON public.tech_incident_root_cause FOR DELETE
TO authenticated
USING (public.is_tech_admin());

-- ============ tech_on_call_shifts ============
DROP POLICY IF EXISTS "Allow read tech_on_call_shifts" ON public.tech_on_call_shifts;
DROP POLICY IF EXISTS "Allow insert tech_on_call_shifts" ON public.tech_on_call_shifts;
DROP POLICY IF EXISTS "Allow update tech_on_call_shifts" ON public.tech_on_call_shifts;
DROP POLICY IF EXISTS "Allow delete tech_on_call_shifts" ON public.tech_on_call_shifts;

CREATE POLICY "Allow all users to read tech_on_call_shifts"
ON public.tech_on_call_shifts FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow admin to insert tech_on_call_shifts"
ON public.tech_on_call_shifts FOR INSERT
TO authenticated
WITH CHECK (public.is_tech_admin());

CREATE POLICY "Allow admin to update tech_on_call_shifts"
ON public.tech_on_call_shifts FOR UPDATE
TO authenticated
USING (public.is_tech_admin());

CREATE POLICY "Allow admin to delete tech_on_call_shifts"
ON public.tech_on_call_shifts FOR DELETE
TO authenticated
USING (public.is_tech_admin());