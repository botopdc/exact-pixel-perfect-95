
-- ============================================================================
-- SUPPORT TICKETS MODULE — MVP
-- Tables, enums, functions, indexes, RLS, triggers, seeds, storage
-- ============================================================================

-- 1. ENUMS
-- ============================================================================

CREATE TYPE public.support_ticket_status AS ENUM (
  'novo', 'triagem', 'em_atendimento', 'aguardando_cliente',
  'aguardando_terceiro', 'escalado_n2', 'escalado_n3',
  'resolvido_suporte', 'encerrado_cs', 'reaberto', 'cancelado'
);

CREATE TYPE public.support_level_enum AS ENUM ('N1', 'N2', 'N3');
CREATE TYPE public.support_queue_enum AS ENUM ('N1', 'N2', 'N3', 'CS');
CREATE TYPE public.support_author_type AS ENUM (
  'client', 'support', 'cs', 'manager', 'system', 'integration'
);
CREATE TYPE public.support_origin_channel AS ENUM (
  'portal', 'internal_portal', 'zabbix', 'api', 'email'
);
CREATE TYPE public.support_severity AS ENUM ('S1', 'S2', 'S3', 'S4');
CREATE TYPE public.support_priority AS ENUM ('critical', 'high', 'medium', 'low');

-- 2. SEQUENCES
-- ============================================================================

CREATE SEQUENCE public.support_ticket_number_seq START 1;

-- 3. HELPER FUNCTIONS
-- ============================================================================

-- Generate public ticket code TIC-YYYY-NNNNNN
CREATE OR REPLACE FUNCTION public.generate_support_ticket_code()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.ticket_number := nextval('support_ticket_number_seq');
  NEW.public_code := 'TIC-' || to_char(now(), 'YYYY') || '-' || lpad(NEW.ticket_number::text, 6, '0');
  RETURN NEW;
END;
$$;

-- Check if current user is internal support team member
CREATE OR REPLACE FUNCTION public.is_support_internal()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tech_users
    WHERE email = auth.jwt() ->> 'email'
      AND is_active = true
  )
$$;

-- Check if current user is support admin/manager
CREATE OR REPLACE FUNCTION public.is_support_admin_or_manager()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tech_users
    WHERE email = auth.jwt() ->> 'email'
      AND role IN ('ADMIN')
      AND is_active = true
  )
$$;

-- 4. TABLES
-- ============================================================================

-- 4.1 support_tickets
CREATE TABLE public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number bigint UNIQUE,
  public_code text UNIQUE,
  company_id uuid,
  requester_user_id uuid,
  requester_level integer,
  requester_name text NOT NULL,
  requester_email text,
  requester_phone text,
  origin_channel public.support_origin_channel NOT NULL DEFAULT 'portal',
  ticket_type text NOT NULL,
  category text NOT NULL,
  subcategory text,
  severity public.support_severity NOT NULL DEFAULT 'S4',
  priority public.support_priority NOT NULL DEFAULT 'medium',
  status public.support_ticket_status NOT NULL DEFAULT 'novo',
  support_level public.support_level_enum NOT NULL DEFAULT 'N1',
  current_queue public.support_queue_enum NOT NULL DEFAULT 'N1',
  service_name text,
  asset_id uuid,
  asset_label text,
  title text NOT NULL,
  description text NOT NULL,
  customer_visible boolean NOT NULL DEFAULT true,
  assigned_to_user_id uuid,
  assigned_to_name text,
  assigned_team text,
  support_resolved_by uuid,
  cs_closed_by uuid,
  sla_policy_id uuid,
  first_response_due_at timestamptz,
  resolution_due_at timestamptz,
  first_response_at timestamptz,
  resolved_at timestamptz,
  closed_at timestamptz,
  last_customer_message_at timestamptz,
  last_internal_update_at timestamptz,
  source_system text,
  external_reference text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

-- Trigger: auto-generate public_code
CREATE TRIGGER trg_support_ticket_code
  BEFORE INSERT ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.generate_support_ticket_code();

-- Trigger: auto-update updated_at
CREATE TRIGGER trg_support_tickets_updated
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4.2 support_ticket_messages
CREATE TABLE public.support_ticket_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  author_user_id uuid,
  author_level integer,
  author_name text NOT NULL,
  author_email text,
  author_type public.support_author_type NOT NULL DEFAULT 'client',
  is_internal_note boolean NOT NULL DEFAULT false,
  body text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 4.3 support_ticket_attachments
CREATE TABLE public.support_ticket_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  message_id uuid REFERENCES public.support_ticket_messages(id) ON DELETE SET NULL,
  uploaded_by_user_id uuid,
  uploaded_by_name text,
  bucket_name text NOT NULL DEFAULT 'support-ticket-files',
  storage_path text NOT NULL UNIQUE,
  original_filename text NOT NULL,
  mime_type text,
  file_size bigint,
  is_internal boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 4.4 support_ticket_assignments
CREATE TABLE public.support_ticket_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  from_user_id uuid,
  from_user_name text,
  to_user_id uuid,
  to_user_name text,
  from_queue text,
  to_queue text,
  from_support_level text,
  to_support_level text,
  reason text,
  assigned_by_user_id uuid,
  assigned_by_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 4.5 support_sla_policies
CREATE TABLE public.support_sla_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  ticket_type text,
  category text,
  severity text,
  customer_plan text,
  business_hours_only boolean NOT NULL DEFAULT false,
  first_response_minutes integer NOT NULL,
  resolution_minutes integer NOT NULL,
  pause_on_waiting_customer boolean NOT NULL DEFAULT true,
  pause_on_waiting_third_party boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 4.6 support_ticket_status_history
CREATE TABLE public.support_ticket_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  old_status text,
  new_status text NOT NULL,
  changed_by_user_id uuid,
  changed_by_name text,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 4.7 support_ticket_watchers
CREATE TABLE public.support_ticket_watchers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  user_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(ticket_id, user_id)
);

-- 4.8 support_catalog_categories
CREATE TABLE public.support_catalog_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- 4.9 support_catalog_services
CREATE TABLE public.support_catalog_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  category_code text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- 4.10 support_ticket_events (canonical event log)
CREATE TABLE public.support_ticket_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name text NOT NULL,
  entity_type text NOT NULL DEFAULT 'support_ticket',
  entity_id uuid NOT NULL,
  actor_type text,
  actor_id text,
  user_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_address text,
  user_agent text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 5. INDEXES
-- ============================================================================

CREATE INDEX idx_support_tickets_status ON public.support_tickets(status);
CREATE INDEX idx_support_tickets_current_queue ON public.support_tickets(current_queue);
CREATE INDEX idx_support_tickets_assigned_to ON public.support_tickets(assigned_to_user_id);
CREATE INDEX idx_support_tickets_requester ON public.support_tickets(requester_user_id);
CREATE INDEX idx_support_tickets_company ON public.support_tickets(company_id);
CREATE INDEX idx_support_tickets_created_at ON public.support_tickets(created_at DESC);
CREATE INDEX idx_support_tickets_resolution_due ON public.support_tickets(resolution_due_at);
CREATE INDEX idx_support_tickets_status_queue ON public.support_tickets(status, current_queue);
CREATE INDEX idx_support_tickets_assigned_status ON public.support_tickets(assigned_to_user_id, status);
CREATE INDEX idx_support_tickets_company_created ON public.support_tickets(company_id, created_at DESC);
CREATE INDEX idx_support_tickets_deleted ON public.support_tickets(deleted_at) WHERE deleted_at IS NOT NULL;

CREATE INDEX idx_support_messages_ticket ON public.support_ticket_messages(ticket_id, created_at);
CREATE INDEX idx_support_assignments_ticket ON public.support_ticket_assignments(ticket_id, created_at);
CREATE INDEX idx_support_status_history_ticket ON public.support_ticket_status_history(ticket_id, created_at);
CREATE INDEX idx_support_attachments_ticket ON public.support_ticket_attachments(ticket_id);
CREATE INDEX idx_support_events_entity ON public.support_ticket_events(entity_id, occurred_at);
CREATE INDEX idx_support_events_name ON public.support_ticket_events(event_name);

-- 6. RLS
-- ============================================================================
-- Strategy: All operations go through Edge Functions using SERVICE_ROLE_KEY.
-- RLS provides defense-in-depth. Internal users (tech_users) get SELECT access.
-- Mutations are restricted and handled by Edge Functions.

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_ticket_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_ticket_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_ticket_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_sla_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_ticket_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_ticket_watchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_catalog_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_catalog_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_ticket_events ENABLE ROW LEVEL SECURITY;

-- support_tickets: internal team can SELECT
CREATE POLICY "support_tickets_select_internal"
  ON public.support_tickets FOR SELECT TO authenticated
  USING (is_support_internal());

CREATE POLICY "support_tickets_insert_internal"
  ON public.support_tickets FOR INSERT TO authenticated
  WITH CHECK (is_support_internal());

CREATE POLICY "support_tickets_update_internal"
  ON public.support_tickets FOR UPDATE TO authenticated
  USING (is_support_internal());

-- support_ticket_messages: internal team can SELECT all; insert allowed
CREATE POLICY "support_messages_select_internal"
  ON public.support_ticket_messages FOR SELECT TO authenticated
  USING (is_support_internal());

CREATE POLICY "support_messages_insert_internal"
  ON public.support_ticket_messages FOR INSERT TO authenticated
  WITH CHECK (is_support_internal());

-- support_ticket_attachments
CREATE POLICY "support_attachments_select_internal"
  ON public.support_ticket_attachments FOR SELECT TO authenticated
  USING (is_support_internal());

CREATE POLICY "support_attachments_insert_internal"
  ON public.support_ticket_attachments FOR INSERT TO authenticated
  WITH CHECK (is_support_internal());

-- support_ticket_assignments
CREATE POLICY "support_assignments_select_internal"
  ON public.support_ticket_assignments FOR SELECT TO authenticated
  USING (is_support_internal());

CREATE POLICY "support_assignments_insert_internal"
  ON public.support_ticket_assignments FOR INSERT TO authenticated
  WITH CHECK (is_support_internal());

-- support_sla_policies: internal team can SELECT, admin can manage
CREATE POLICY "support_sla_select_internal"
  ON public.support_sla_policies FOR SELECT TO authenticated
  USING (is_support_internal());

CREATE POLICY "support_sla_insert_admin"
  ON public.support_sla_policies FOR INSERT TO authenticated
  WITH CHECK (is_support_admin_or_manager());

CREATE POLICY "support_sla_update_admin"
  ON public.support_sla_policies FOR UPDATE TO authenticated
  USING (is_support_admin_or_manager());

CREATE POLICY "support_sla_delete_admin"
  ON public.support_sla_policies FOR DELETE TO authenticated
  USING (is_support_admin_or_manager());

-- support_ticket_status_history
CREATE POLICY "support_status_history_select_internal"
  ON public.support_ticket_status_history FOR SELECT TO authenticated
  USING (is_support_internal());

CREATE POLICY "support_status_history_insert_internal"
  ON public.support_ticket_status_history FOR INSERT TO authenticated
  WITH CHECK (is_support_internal());

-- support_ticket_watchers
CREATE POLICY "support_watchers_select_internal"
  ON public.support_ticket_watchers FOR SELECT TO authenticated
  USING (is_support_internal());

CREATE POLICY "support_watchers_insert_internal"
  ON public.support_ticket_watchers FOR INSERT TO authenticated
  WITH CHECK (is_support_internal());

CREATE POLICY "support_watchers_delete_internal"
  ON public.support_ticket_watchers FOR DELETE TO authenticated
  USING (is_support_internal());

-- support_catalog_categories & services: read by internal, manage by admin
CREATE POLICY "support_categories_select_internal"
  ON public.support_catalog_categories FOR SELECT TO authenticated
  USING (is_support_internal());

CREATE POLICY "support_categories_manage_admin"
  ON public.support_catalog_categories FOR ALL TO authenticated
  USING (is_support_admin_or_manager())
  WITH CHECK (is_support_admin_or_manager());

CREATE POLICY "support_services_select_internal"
  ON public.support_catalog_services FOR SELECT TO authenticated
  USING (is_support_internal());

CREATE POLICY "support_services_manage_admin"
  ON public.support_catalog_services FOR ALL TO authenticated
  USING (is_support_admin_or_manager())
  WITH CHECK (is_support_admin_or_manager());

-- support_ticket_events: append-only, internal can read
CREATE POLICY "support_events_select_internal"
  ON public.support_ticket_events FOR SELECT TO authenticated
  USING (is_support_internal());

CREATE POLICY "support_events_insert_internal"
  ON public.support_ticket_events FOR INSERT TO authenticated
  WITH CHECK (is_support_internal());

-- 7. STORAGE BUCKET
-- ============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('support-ticket-files', 'support-ticket-files', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: authenticated users can upload/read
CREATE POLICY "support_files_select_auth"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'support-ticket-files');

CREATE POLICY "support_files_insert_auth"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'support-ticket-files');

CREATE POLICY "support_files_delete_auth"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'support-ticket-files');

-- 8. SEEDS
-- ============================================================================

-- Categories
INSERT INTO public.support_catalog_categories (code, name, sort_order) VALUES
  ('infraestrutura', 'Infraestrutura', 1),
  ('virtualizacao', 'Virtualização', 2),
  ('backup', 'Backup', 3),
  ('banco_de_dados', 'Banco de Dados', 4),
  ('rede', 'Rede', 5),
  ('firewall', 'Firewall', 6),
  ('storage', 'Storage', 7),
  ('billing', 'Faturamento', 8),
  ('acesso', 'Acesso', 9),
  ('outros', 'Outros', 10);

-- Services
INSERT INTO public.support_catalog_services (code, name, category_code, sort_order) VALUES
  ('bare_metal', 'Bare Metal', 'infraestrutura', 1),
  ('vm', 'Máquina Virtual', 'virtualizacao', 2),
  ('backup', 'Backup', 'backup', 3),
  ('storage', 'Storage', 'storage', 4),
  ('banco', 'Banco de Dados', 'banco_de_dados', 5),
  ('firewall', 'Firewall', 'firewall', 6),
  ('cloud', 'Cloud', 'infraestrutura', 7),
  ('colocation', 'Colocation', 'infraestrutura', 8),
  ('link', 'Link Dedicado', 'rede', 9);

-- Default SLA Policies
INSERT INTO public.support_sla_policies (code, name, severity, business_hours_only, first_response_minutes, resolution_minutes, sort_order) VALUES
  ('DEFAULT-S1', 'SLA Crítico S1', 'S1', false, 15, 120, 1),
  ('DEFAULT-S2', 'SLA Alto S2', 'S2', false, 30, 240, 2),
  ('DEFAULT-S3', 'SLA Padrão S3', 'S3', false, 60, 480, 3),
  ('DEFAULT-S4', 'SLA Baixo S4', 'S4', true, 240, 1440, 4);
