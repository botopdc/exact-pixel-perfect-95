-- Create indexes on proposal_id columns for better query performance
-- These indexes speed up JOINs and WHERE clauses when loading proposal items

-- Index for calculator_proposal_servers
CREATE INDEX IF NOT EXISTS idx_calculator_proposal_servers_proposal_id 
ON public.calculator_proposal_servers (proposal_id);

-- Index for calculator_proposal_addons  
CREATE INDEX IF NOT EXISTS idx_calculator_proposal_addons_proposal_id 
ON public.calculator_proposal_addons (proposal_id);

-- Index for calculator_proposal_files (if frequently queried)
CREATE INDEX IF NOT EXISTS idx_calculator_proposal_files_proposal_id 
ON public.calculator_proposal_files (proposal_id);