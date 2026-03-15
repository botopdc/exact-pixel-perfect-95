-- Remove duplicidades pré-existentes mantendo o registro mais recente (priorizando ativo)
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY queue_id, user_id
           ORDER BY is_active DESC, updated_at DESC, created_at DESC, id DESC
         ) AS rn
  FROM public.support_queue_members
)
DELETE FROM public.support_queue_members m
USING ranked r
WHERE m.id = r.id
  AND r.rn > 1;

-- Garante unicidade lógica por fila + usuário
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'support_queue_members_unique_queue_user'
      AND conrelid = 'public.support_queue_members'::regclass
  ) THEN
    ALTER TABLE public.support_queue_members
      ADD CONSTRAINT support_queue_members_unique_queue_user UNIQUE (queue_id, user_id);
  END IF;
END;
$$;