-- Public approval dedicated fields (token must not rely on proposal UUID)
ALTER TABLE public.calculator_proposals
  ADD COLUMN IF NOT EXISTS public_approval_token text,
  ADD COLUMN IF NOT EXISTS public_approval_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS public_approval_expires_at timestamptz;

-- Ensure token uniqueness when present
CREATE UNIQUE INDEX IF NOT EXISTS calculator_proposals_public_approval_token_uidx
  ON public.calculator_proposals (public_approval_token)
  WHERE public_approval_token IS NOT NULL;

-- One-time backfill from legacy approval columns so existing generated links can be migrated
UPDATE public.calculator_proposals
SET
  public_approval_token = COALESCE(public_approval_token, approval_token),
  public_approval_expires_at = COALESCE(public_approval_expires_at, approval_token_expires_at),
  public_approval_enabled = CASE
    WHEN COALESCE(public_approval_token, approval_token) IS NOT NULL THEN true
    ELSE public_approval_enabled
  END
WHERE public_approval_token IS NULL
   OR public_approval_expires_at IS NULL
   OR public_approval_enabled = false;