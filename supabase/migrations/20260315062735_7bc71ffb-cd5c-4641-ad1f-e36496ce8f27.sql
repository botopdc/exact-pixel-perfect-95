
-- ============================================================================
-- SUPPORT NOTIFICATIONS TABLE
-- Minimal notification system for ticket events
-- ============================================================================

CREATE TABLE public.support_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  user_level integer,
  ticket_id uuid REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  ticket_public_code text,
  event_name text NOT NULL,
  title text NOT NULL,
  body text,
  is_read boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_support_notifications_user_unread ON public.support_notifications(user_id, is_read) WHERE is_read = false;
CREATE INDEX idx_support_notifications_created ON public.support_notifications(created_at DESC);
CREATE INDEX idx_support_notifications_ticket ON public.support_notifications(ticket_id);

-- RLS
ALTER TABLE public.support_notifications ENABLE ROW LEVEL SECURITY;

-- Internal users can read/update their own notifications
CREATE POLICY support_notifications_select_internal ON public.support_notifications
  FOR SELECT TO authenticated USING (is_support_internal());

CREATE POLICY support_notifications_insert_internal ON public.support_notifications
  FOR INSERT TO authenticated WITH CHECK (is_support_internal());

CREATE POLICY support_notifications_update_internal ON public.support_notifications
  FOR UPDATE TO authenticated USING (is_support_internal());
