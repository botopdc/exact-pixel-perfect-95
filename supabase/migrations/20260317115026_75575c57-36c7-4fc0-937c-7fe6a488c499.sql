
-- Add user_id_uuid column to support_queue_members
ALTER TABLE public.support_queue_members
  ADD COLUMN IF NOT EXISTS user_id_uuid uuid REFERENCES public.profiles(id);

-- Add user_id_uuid column to support_oncall_shifts
ALTER TABLE public.support_oncall_shifts
  ADD COLUMN IF NOT EXISTS user_id_uuid uuid REFERENCES public.profiles(id);

-- Backfill support_queue_members from profiles.legacy_user_id
UPDATE public.support_queue_members sqm
SET user_id_uuid = p.id
FROM public.profiles p
WHERE p.legacy_user_id = sqm.user_id
  AND sqm.user_id_uuid IS NULL;

-- Backfill support_queue_members by email fallback
UPDATE public.support_queue_members sqm
SET user_id_uuid = p.id
FROM public.profiles p
WHERE p.email = sqm.user_email
  AND sqm.user_id_uuid IS NULL;

-- Backfill support_oncall_shifts from profiles.legacy_user_id
UPDATE public.support_oncall_shifts sos
SET user_id_uuid = p.id
FROM public.profiles p
WHERE p.legacy_user_id = sos.user_id
  AND sos.user_id_uuid IS NULL;

-- Backfill support_oncall_shifts by email fallback
UPDATE public.support_oncall_shifts sos
SET user_id_uuid = p.id
FROM public.profiles p
WHERE p.email = sos.user_email
  AND sos.user_id_uuid IS NULL;
