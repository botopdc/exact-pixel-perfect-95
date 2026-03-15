
-- Create support_oncall table for on-call shift management
CREATE TABLE public.support_oncall (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team TEXT NOT NULL,
  user_id INTEGER NOT NULL,
  user_name TEXT NOT NULL,
  user_email TEXT NOT NULL,
  start_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  end_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.support_oncall ENABLE ROW LEVEL SECURITY;

-- Everyone internal can read
CREATE POLICY "oncall_select_internal" ON public.support_oncall
  FOR SELECT TO authenticated USING (is_support_internal());

-- Only admin/manager can modify
CREATE POLICY "oncall_insert_admin" ON public.support_oncall
  FOR INSERT TO authenticated WITH CHECK (is_support_admin_or_manager());

CREATE POLICY "oncall_update_admin" ON public.support_oncall
  FOR UPDATE TO authenticated USING (is_support_admin_or_manager());

CREATE POLICY "oncall_delete_admin" ON public.support_oncall
  FOR DELETE TO authenticated USING (is_support_admin_or_manager());
