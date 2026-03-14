
ALTER TABLE public.calculator_proposals
  ADD COLUMN IF NOT EXISTS approval_decision text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS rejected_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS approved_by_name text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS approved_by_email text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS approval_notes text DEFAULT NULL;
