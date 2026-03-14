
-- Remove duplicate proposals keeping only the latest one per display_id
DELETE FROM calculator_proposals
WHERE id IN (
  SELECT id FROM (
    SELECT id, display_id,
      ROW_NUMBER() OVER (PARTITION BY display_id ORDER BY updated_at DESC, created_at DESC) as rn
    FROM calculator_proposals
    WHERE display_id IS NOT NULL
  ) ranked
  WHERE rn > 1
);

-- Now create the unique index
CREATE UNIQUE INDEX calculator_proposals_display_id_unique 
ON public.calculator_proposals (display_id) 
WHERE display_id IS NOT NULL;
