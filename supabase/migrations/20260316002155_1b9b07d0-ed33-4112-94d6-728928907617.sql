
-- ============================================================================
-- FASE 1: Create public.profiles table for Supabase-first identity
-- ============================================================================

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  legacy_user_id integer NULL UNIQUE,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  level integer NOT NULL DEFAULT 1,
  role_code text NULL,
  entity_id integer NULL,
  company_id integer NULL,
  department text NULL,
  is_active boolean NOT NULL DEFAULT true,
  avatar_url text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_profiles_email ON public.profiles(email);
CREATE INDEX idx_profiles_legacy_user_id ON public.profiles(legacy_user_id);
CREATE INDEX idx_profiles_level ON public.profiles(level);
CREATE INDEX idx_profiles_is_active ON public.profiles(is_active);

-- Updated_at trigger
CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Admin/internal users can read all profiles (using a security definer function)
CREATE OR REPLACE FUNCTION public.is_internal_user()
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND level >= 600
      AND is_active = true
  )
$$;

CREATE POLICY "profiles_select_internal"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.is_internal_user());

-- Users can update their own profile (limited fields)
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid());

-- Only admins can insert profiles (or service role via edge functions)
CREATE OR REPLACE FUNCTION public.is_profile_admin()
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND level >= 1000
      AND is_active = true
  )
$$;

CREATE POLICY "profiles_insert_admin"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (public.is_profile_admin() OR id = auth.uid());

CREATE POLICY "profiles_delete_admin"
  ON public.profiles FOR DELETE
  TO authenticated
  USING (public.is_profile_admin());

-- Auto-create profile on signup (trigger on auth.users)
CREATE OR REPLACE FUNCTION public.handle_new_user()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, level)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', split_part(COALESCE(NEW.email, ''), '@', 1)),
    COALESCE((NEW.raw_user_meta_data->>'level')::integer, 1)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
