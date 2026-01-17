-- ============================================================================
-- MVP CENTRO DE OPERAÇÕES TÉCNICAS - DATABASE SCHEMA
-- ============================================================================

-- ============================================================================
-- 1. ENUM TYPES
-- ============================================================================

-- Roles for technical operations (separate from main app roles)
CREATE TYPE public.tech_role AS ENUM ('ADMIN', 'N1', 'N2', 'N3', 'CS');

-- Client status
CREATE TYPE public.client_status AS ENUM ('ATIVO', 'SUSPENSO', 'ENCERRADO');

-- SLA levels
CREATE TYPE public.sla_level AS ENUM ('PADRAO', 'PREMIUM', 'CRITICO');

-- Asset types
CREATE TYPE public.asset_type AS ENUM ('VM', 'BAREMETAL', 'GPU', 'KUBERNETES', 'STORAGE');

-- Asset environment
CREATE TYPE public.asset_environment AS ENUM ('PROD', 'HOMOLOG', 'DEV', 'NAO_INFORMADO');

-- Asset status
CREATE TYPE public.asset_status AS ENUM ('ATIVO', 'MANUTENCAO', 'DESLIGADO');

-- Credential types
CREATE TYPE public.credential_type AS ENUM ('ROOT', 'ADMIN', 'APP', 'OUTRO');

-- Credential visibility
CREATE TYPE public.credential_visibility AS ENUM ('N2_PLUS', 'N3_PLUS', 'ADMIN_ONLY');

-- On-call level
CREATE TYPE public.on_call_level AS ENUM ('N1', 'N2', 'N3');

-- Incident origin channel
CREATE TYPE public.incident_origin AS ENUM ('PORTAL_CLIENTE', 'PORTAL_INTERNO', 'EMAIL', 'WHATSAPP', 'INTERNO');

-- Incident type
CREATE TYPE public.incident_type AS ENUM ('QUEDA', 'PERFORMANCE', 'CONFIGURACAO', 'DUVIDA', 'MUDANCA', 'OUTRO');

-- Incident severity
CREATE TYPE public.incident_severity AS ENUM ('S1', 'S2', 'S3', 'S4');

-- Incident status
CREATE TYPE public.incident_status AS ENUM ('ABERTO', 'CLASSIFICADO', 'EM_ATENDIMENTO', 'ESCALADO', 'RESOLVIDO', 'ENCERRADO');

-- Root cause category
CREATE TYPE public.root_cause_category AS ENUM ('HARDWARE', 'CONFIG', 'HUMANO', 'EXTERNO', 'DESCONHECIDO');

-- ============================================================================
-- 2. TABLES
-- ============================================================================

-- A) tech_users - Technical operations users (separate from main users table)
CREATE TABLE public.tech_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role tech_role NOT NULL DEFAULT 'N1',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- B) tech_clients - Clients for technical operations
CREATE TABLE public.tech_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  razao_social TEXT NOT NULL,
  nome_fantasia TEXT,
  status client_status NOT NULL DEFAULT 'ATIVO',
  sla_level sla_level NOT NULL DEFAULT 'PADRAO',
  segmento TEXT,
  cs_manager_id UUID REFERENCES public.tech_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- C) tech_assets - Infrastructure assets
CREATE TABLE public.tech_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.tech_clients(id) ON DELETE CASCADE,
  tipo asset_type NOT NULL,
  ambiente asset_environment NOT NULL DEFAULT 'NAO_INFORMADO',
  identificador TEXT NOT NULL,
  ip_principal TEXT,
  cpu TEXT,
  memoria_gb INTEGER,
  disco_gb INTEGER,
  status asset_status NOT NULL DEFAULT 'ATIVO',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- D) tech_credentials - Asset credentials
CREATE TABLE public.tech_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES public.tech_assets(id) ON DELETE CASCADE,
  cred_type credential_type NOT NULL,
  username TEXT NOT NULL,
  secret_value TEXT, -- Only if using native encryption
  secret_ref TEXT, -- Reference to external vault
  visibility_level credential_visibility NOT NULL DEFAULT 'N3_PLUS',
  last_rotated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- E) tech_on_call_shifts - On-call schedule
CREATE TABLE public.tech_on_call_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.tech_users(id) ON DELETE CASCADE,
  level on_call_level NOT NULL,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- F) tech_incidents - Incidents
CREATE TABLE public.tech_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.tech_clients(id) ON DELETE RESTRICT,
  asset_id UUID REFERENCES public.tech_assets(id) ON DELETE SET NULL,
  origin_channel incident_origin NOT NULL DEFAULT 'PORTAL_INTERNO',
  tipo incident_type NOT NULL,
  severidade incident_severity NOT NULL DEFAULT 'S4',
  status incident_status NOT NULL DEFAULT 'ABERTO',
  sla_level_aplicado sla_level NOT NULL,
  owner_user_id UUID REFERENCES public.tech_users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- G) tech_incident_actions - Incident action log
CREATE TABLE public.tech_incident_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES public.tech_incidents(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.tech_users(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL DEFAULT 'comment', -- comment, status_change, assignment, escalation
  action_text TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- H) tech_incident_root_cause - Root cause analysis
CREATE TABLE public.tech_incident_root_cause (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL UNIQUE REFERENCES public.tech_incidents(id) ON DELETE CASCADE,
  category root_cause_category NOT NULL,
  details TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 3. INDEXES
-- ============================================================================

CREATE INDEX idx_tech_clients_status ON public.tech_clients(status);
CREATE INDEX idx_tech_clients_sla ON public.tech_clients(sla_level);
CREATE INDEX idx_tech_assets_client ON public.tech_assets(client_id);
CREATE INDEX idx_tech_assets_tipo ON public.tech_assets(tipo);
CREATE INDEX idx_tech_assets_status ON public.tech_assets(status);
CREATE INDEX idx_tech_credentials_asset ON public.tech_credentials(asset_id);
CREATE INDEX idx_tech_on_call_active ON public.tech_on_call_shifts(is_active, start_at, end_at);
CREATE INDEX idx_tech_incidents_client ON public.tech_incidents(client_id);
CREATE INDEX idx_tech_incidents_status ON public.tech_incidents(status);
CREATE INDEX idx_tech_incidents_severidade ON public.tech_incidents(severidade);
CREATE INDEX idx_tech_incidents_owner ON public.tech_incidents(owner_user_id);
CREATE INDEX idx_tech_incidents_opened ON public.tech_incidents(opened_at DESC);
CREATE INDEX idx_tech_incident_actions_incident ON public.tech_incident_actions(incident_id);

-- ============================================================================
-- 4. TRIGGERS FOR updated_at
-- ============================================================================

CREATE TRIGGER update_tech_users_updated_at
  BEFORE UPDATE ON public.tech_users
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tech_clients_updated_at
  BEFORE UPDATE ON public.tech_clients
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tech_assets_updated_at
  BEFORE UPDATE ON public.tech_assets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tech_credentials_updated_at
  BEFORE UPDATE ON public.tech_credentials
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tech_on_call_shifts_updated_at
  BEFORE UPDATE ON public.tech_on_call_shifts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tech_incidents_updated_at
  BEFORE UPDATE ON public.tech_incidents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tech_incident_root_cause_updated_at
  BEFORE UPDATE ON public.tech_incident_root_cause
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- 5. ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.tech_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tech_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tech_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tech_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tech_on_call_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tech_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tech_incident_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tech_incident_root_cause ENABLE ROW LEVEL SECURITY;

-- For MVP: Allow authenticated users full access (will be refined later)
-- tech_users
CREATE POLICY "Allow read tech_users" ON public.tech_users FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow insert tech_users" ON public.tech_users FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow update tech_users" ON public.tech_users FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow delete tech_users" ON public.tech_users FOR DELETE TO authenticated USING (true);

-- tech_clients
CREATE POLICY "Allow read tech_clients" ON public.tech_clients FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow insert tech_clients" ON public.tech_clients FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow update tech_clients" ON public.tech_clients FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow delete tech_clients" ON public.tech_clients FOR DELETE TO authenticated USING (true);

-- tech_assets
CREATE POLICY "Allow read tech_assets" ON public.tech_assets FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow insert tech_assets" ON public.tech_assets FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow update tech_assets" ON public.tech_assets FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow delete tech_assets" ON public.tech_assets FOR DELETE TO authenticated USING (true);

-- tech_credentials (Read restricted based on visibility - MVP allows all authenticated)
CREATE POLICY "Allow read tech_credentials" ON public.tech_credentials FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow insert tech_credentials" ON public.tech_credentials FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow update tech_credentials" ON public.tech_credentials FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow delete tech_credentials" ON public.tech_credentials FOR DELETE TO authenticated USING (true);

-- tech_on_call_shifts
CREATE POLICY "Allow read tech_on_call_shifts" ON public.tech_on_call_shifts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow insert tech_on_call_shifts" ON public.tech_on_call_shifts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow update tech_on_call_shifts" ON public.tech_on_call_shifts FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow delete tech_on_call_shifts" ON public.tech_on_call_shifts FOR DELETE TO authenticated USING (true);

-- tech_incidents
CREATE POLICY "Allow read tech_incidents" ON public.tech_incidents FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow insert tech_incidents" ON public.tech_incidents FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow update tech_incidents" ON public.tech_incidents FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow delete tech_incidents" ON public.tech_incidents FOR DELETE TO authenticated USING (true);

-- tech_incident_actions
CREATE POLICY "Allow read tech_incident_actions" ON public.tech_incident_actions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow insert tech_incident_actions" ON public.tech_incident_actions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow update tech_incident_actions" ON public.tech_incident_actions FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow delete tech_incident_actions" ON public.tech_incident_actions FOR DELETE TO authenticated USING (true);

-- tech_incident_root_cause
CREATE POLICY "Allow read tech_incident_root_cause" ON public.tech_incident_root_cause FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow insert tech_incident_root_cause" ON public.tech_incident_root_cause FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow update tech_incident_root_cause" ON public.tech_incident_root_cause FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow delete tech_incident_root_cause" ON public.tech_incident_root_cause FOR DELETE TO authenticated USING (true);