-- Reset pdf_path for proposals that have auto-generated PDFs (not visual template)
-- This forces regeneration with the visual template on next access
UPDATE calculator_proposals 
SET pdf_path = NULL, pdf_generated_at = NULL
WHERE pdf_path IS NOT NULL 
  AND (
    pdf_path LIKE '%/proposal-full-%' 
    OR pdf_path LIKE '%/auto-summary-%'
    OR pdf_path LIKE '%/proposal-official-%'
    OR pdf_path LIKE '%.html'
  );