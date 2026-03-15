
-- ============================================================================
-- PHASE: Queue model restructure for support tickets
-- ============================================================================

-- 1. support_queues
CREATE TABLE public.support_queues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  queue_type text NOT NULL DEFAULT 'support',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.support_queues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "support_queues_select_all" ON public.support_queues
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "support_queues_insert_admin" ON public.support_queues
  FOR INSERT TO authenticated WITH CHECK (is_support_admin_or_manager());
CREATE POLICY "support_queues_update_admin" ON public.support_queues
  FOR UPDATE TO authenticated USING (is_support_admin_or_manager());
CREATE POLICY "support_queues_delete_admin" ON public.support_queues
  FOR DELETE TO authenticated USING (is_support_admin_or_manager());

CREATE TRIGGER update_support_queues_updated_at
  BEFORE UPDATE ON public.support_queues
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Seed queues
INSERT INTO public.support_queues (code, name, description, queue_type, sort_order) VALUES
  ('N1', 'Suporte N1', 'Primeiro nível de atendimento', 'support', 1),
  ('N2', 'Suporte N2', 'Análise técnica avançada', 'support', 2),
  ('N3', 'Engenharia N3', 'Engenharia e infraestrutura', 'support', 3),
  ('CS', 'Customer Success', 'Validação e encerramento', 'cs', 4);

-- 2. support_queue_members
CREATE TABLE public.support_queue_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_id uuid NOT NULL REFERENCES public.support_queues(id) ON DELETE CASCADE,
  user_id integer NOT NULL,
  user_name text NOT NULL,
  user_email text NOT NULL,
  user_level integer NOT NULL,
  is_primary boolean NOT NULL DEFAULT false,
  can_receive_auto_assign boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(queue_id, user_id)
);

ALTER TABLE public.support_queue_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "queue_members_select_internal" ON public.support_queue_members
  FOR SELECT TO authenticated USING (is_support_internal());
CREATE POLICY "queue_members_insert_admin" ON public.support_queue_members
  FOR INSERT TO authenticated WITH CHECK (is_support_admin_or_manager());
CREATE POLICY "queue_members_update_admin" ON public.support_queue_members
  FOR UPDATE TO authenticated USING (is_support_admin_or_manager());
CREATE POLICY "queue_members_delete_admin" ON public.support_queue_members
  FOR DELETE TO authenticated USING (is_support_admin_or_manager());

CREATE TRIGGER update_support_queue_members_updated_at
  BEFORE UPDATE ON public.support_queue_members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 3. support_ticket_types
CREATE TABLE public.support_ticket_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  default_queue_id uuid REFERENCES public.support_queues(id),
  default_severity text,
  default_priority text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.support_ticket_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ticket_types_select_all" ON public.support_ticket_types
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "ticket_types_insert_admin" ON public.support_ticket_types
  FOR INSERT TO authenticated WITH CHECK (is_support_admin_or_manager());
CREATE POLICY "ticket_types_update_admin" ON public.support_ticket_types
  FOR UPDATE TO authenticated USING (is_support_admin_or_manager());

-- Seed types (default_queue_id will be N1)
INSERT INTO public.support_ticket_types (code, name, default_queue_id, default_severity, default_priority) VALUES
  ('INCIDENTE', 'Incidente', (SELECT id FROM public.support_queues WHERE code = 'N1'), 'S3', 'medium'),
  ('SOLICITACAO', 'Solicitação', (SELECT id FROM public.support_queues WHERE code = 'N1'), 'S4', 'low'),
  ('DUVIDA', 'Dúvida', (SELECT id FROM public.support_queues WHERE code = 'N1'), 'S4', 'low'),
  ('ALTERACAO', 'Alteração', (SELECT id FROM public.support_queues WHERE code = 'N1'), 'S3', 'medium');

-- 4. support_ticket_categories
CREATE TABLE public.support_ticket_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type_id uuid REFERENCES public.support_ticket_types(id),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  default_queue_id uuid REFERENCES public.support_queues(id),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.support_ticket_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ticket_categories_select_all" ON public.support_ticket_categories
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "ticket_categories_insert_admin" ON public.support_ticket_categories
  FOR INSERT TO authenticated WITH CHECK (is_support_admin_or_manager());
CREATE POLICY "ticket_categories_update_admin" ON public.support_ticket_categories
  FOR UPDATE TO authenticated USING (is_support_admin_or_manager());

-- Seed categories
INSERT INTO public.support_ticket_categories (code, name) VALUES
  ('VM', 'VM / Virtualização'),
  ('BARE_METAL', 'Bare Metal'),
  ('BACKUP', 'Backup'),
  ('STORAGE', 'Storage'),
  ('REDE', 'Rede'),
  ('FIREWALL', 'Firewall'),
  ('BANCO', 'Banco de Dados'),
  ('CLOUD', 'Cloud'),
  ('OUTROS', 'Outros');

-- 5. support_ticket_queue_history
CREATE TABLE public.support_ticket_queue_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  from_queue_id uuid REFERENCES public.support_queues(id),
  to_queue_id uuid NOT NULL REFERENCES public.support_queues(id),
  from_support_level text,
  to_support_level text NOT NULL,
  changed_by_user_id integer,
  changed_by_name text,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.support_ticket_queue_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "queue_history_select_internal" ON public.support_ticket_queue_history
  FOR SELECT TO authenticated USING (is_support_internal());
CREATE POLICY "queue_history_insert_internal" ON public.support_ticket_queue_history
  FOR INSERT TO authenticated WITH CHECK (is_support_internal());

CREATE INDEX idx_queue_history_ticket ON public.support_ticket_queue_history(ticket_id);

-- 6. Alter support_tickets: add new columns
ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS current_queue_id uuid REFERENCES public.support_queues(id),
  ADD COLUMN IF NOT EXISTS type_id uuid REFERENCES public.support_ticket_types(id),
  ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.support_ticket_categories(id),
  ADD COLUMN IF NOT EXISTS assigned_at timestamptz,
  ADD COLUMN IF NOT EXISTS resolution_summary text,
  ADD COLUMN IF NOT EXISTS close_reason text,
  ADD COLUMN IF NOT EXISTS current_support_level text NOT NULL DEFAULT 'N1';

-- Backfill current_queue_id from current_queue text
UPDATE public.support_tickets
SET current_queue_id = sq.id
FROM public.support_queues sq
WHERE public.support_tickets.current_queue::text = sq.code
  AND public.support_tickets.current_queue_id IS NULL;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_tickets_current_queue_id ON public.support_tickets(current_queue_id);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned_to_user_id ON public.support_tickets(assigned_to_user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON public.support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_requester_user_id ON public.support_tickets(requester_user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON public.support_tickets(created_at);
CREATE INDEX IF NOT EXISTS idx_tickets_resolution_due_at ON public.support_tickets(resolution_due_at);
