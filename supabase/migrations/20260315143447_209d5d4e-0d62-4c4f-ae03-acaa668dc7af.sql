UPDATE calculator_proposals 
SET pdf_path = NULL, pdf_generated_at = NULL
WHERE pdf_path IS NOT NULL 
  AND pdf_path LIKE '%/proposal-official-%';