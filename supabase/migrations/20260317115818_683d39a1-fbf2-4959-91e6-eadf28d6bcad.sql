
-- Performance indexes for support_tickets
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON public.support_tickets (status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_support_tickets_current_queue_id ON public.support_tickets (current_queue_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_support_tickets_assigned_to_user_id ON public.support_tickets (assigned_to_user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_support_tickets_severity ON public.support_tickets (severity) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_support_tickets_created_at ON public.support_tickets (created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_support_tickets_resolved_at ON public.support_tickets (resolved_at) WHERE deleted_at IS NULL AND resolved_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_support_tickets_resolution_due_at ON public.support_tickets (resolution_due_at) WHERE deleted_at IS NULL AND resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_support_tickets_requester_email ON public.support_tickets (requester_email) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_support_tickets_composite_open ON public.support_tickets (status, current_queue_id) WHERE deleted_at IS NULL;

-- Performance indexes for support_queue_members
CREATE INDEX IF NOT EXISTS idx_sqm_user_email_active ON public.support_queue_members (user_email) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_sqm_user_id_active ON public.support_queue_members (user_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_sqm_queue_id_active ON public.support_queue_members (queue_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_sqm_user_id_uuid ON public.support_queue_members (user_id_uuid) WHERE is_active = true;

-- Performance indexes for support_oncall_shifts
CREATE INDEX IF NOT EXISTS idx_oncall_shifts_active ON public.support_oncall_shifts (is_active, starts_at, ends_at) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_oncall_shifts_user_email ON public.support_oncall_shifts (user_email) WHERE is_active = true;

-- Performance indexes for support_ticket_events
CREATE INDEX IF NOT EXISTS idx_ste_entity_id ON public.support_ticket_events (entity_id);
CREATE INDEX IF NOT EXISTS idx_ste_created_at ON public.support_ticket_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ste_event_name ON public.support_ticket_events (event_name);
