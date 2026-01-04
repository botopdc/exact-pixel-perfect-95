-- Drop the overly permissive public policies
DROP POLICY IF EXISTS "Allow public reads" ON public.proposal_views;
DROP POLICY IF EXISTS "Allow public inserts" ON public.proposal_views;

-- Create more restrictive policies
-- For now, we'll deny all public access since the table is not actively used
-- If needed later, these can be updated to allow authenticated users only

-- Policy: No public SELECT access (only service role can read)
CREATE POLICY "Deny public reads"
ON public.proposal_views
FOR SELECT
USING (false);

-- Policy: No public INSERT access (only service role can insert)
CREATE POLICY "Deny public inserts"
ON public.proposal_views
FOR INSERT
WITH CHECK (false);