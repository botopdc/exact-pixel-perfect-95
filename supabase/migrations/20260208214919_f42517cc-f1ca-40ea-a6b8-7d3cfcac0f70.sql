ALTER TABLE public.calculator_proposals
  ADD COLUMN IF NOT EXISTS pdf_path TEXT,
  ADD COLUMN IF NOT EXISTS pdf_generated_at TIMESTAMPTZ;