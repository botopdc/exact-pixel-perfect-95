
-- ============================================================================
-- FASE 1 CUTOVER: Identity Schema for Supabase-first Auth
-- ============================================================================

-- 1. ADD new columns to profiles (keep existing for compat)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS level_legacy integer;

-- Populate full_name from name, level_legacy from level (for existing rows)
UPDATE public.profiles SET full_name = name WHERE full_name IS NULL AND name IS NOT NULL;
UPDATE public.profiles SET level_legacy = level WHERE level_legacy IS NULL AND level IS NOT NULL;

-- 2. DROP old roles/user_roles tables (clean slate, banco zerado aceito)
DROP TABLE IF EXISTS public.user_roles CASCADE;
DROP TABLE IF EXISTS public.roles CASCADE;

-- 3. CREATE new roles table (slug-based)
CREATE TABLE public.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 4. CREATE new user_roles table (slug FK)
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role_slug text NOT NULL REFERENCES public.roles(slug) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role_slug)
);

-- 5. Enable RLS
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies
CREATE POLICY "roles_select_authenticated" ON public.roles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "user_roles_select_authenticated" ON public.user_roles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "user_roles_insert_admin" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (public.is_profile_admin());

CREATE POLICY "user_roles_delete_admin" ON public.user_roles
  FOR DELETE TO authenticated
  USING (public.is_profile_admin());

-- 7. has_role function (security definer, slug-based)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role_slug = _role
  )
$$;

-- 8. Trigger for profiles.updated_at
DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- 9. Update handle_new_user to populate new columns
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
  v_level integer;
BEGIN
  v_name := COALESCE(
    NEW.raw_user_meta_data->>'name',
    NEW.raw_user_meta_data->>'full_name',
    split_part(COALESCE(NEW.email, ''), '@', 1)
  );
  v_level := COALESCE((NEW.raw_user_meta_data->>'level')::integer, 1);

  INSERT INTO public.profiles (id, email, name, full_name, level, level_legacy)
  VALUES (NEW.id, COALESCE(NEW.email, ''), v_name, v_name, v_level, v_level)
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = COALESCE(EXCLUDED.name, public.profiles.name),
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
    updated_at = now();

  RETURN NEW;
END;
$$;

-- 10. SEED roles
INSERT INTO public.roles (slug, name) VALUES
  ('admin', 'Administrador'),
  ('suporte', 'Suporte'),
  ('gerente_suporte', 'Gerente de Suporte'),
  ('comercial', 'Comercial'),
  ('gerente_comercial', 'Gerente Comercial'),
  ('cs', 'Customer Success'),
  ('rh', 'Recursos Humanos'),
  ('parceiro', 'Parceiro'),
  ('cliente', 'Cliente'),
  ('internal_user', 'Usuário Interno')
ON CONFLICT (slug) DO NOTHING;
