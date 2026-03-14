
-- Add missing columns to contracts table
ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS proposal_uuid text,
  ADD COLUMN IF NOT EXISTS tax_id text,
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'BRL',
  ADD COLUMN IF NOT EXISTS subtotal numeric(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount numeric(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS billing_cycle text NOT NULL DEFAULT 'mensal',
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS end_date date,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS updated_by uuid;
