-- Add approval token columns to calculator_proposals
ALTER TABLE public.calculator_proposals
  ADD COLUMN IF NOT EXISTS approval_token TEXT,
  ADD COLUMN IF NOT EXISTS approval_token_expires_at TIMESTAMPTZ;

-- Create index for faster token lookups
CREATE INDEX IF NOT EXISTS idx_calculator_proposals_approval_token 
  ON public.calculator_proposals (approval_token) 
  WHERE approval_token IS NOT NULL;