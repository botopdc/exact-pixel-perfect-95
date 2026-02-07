-- Enable public SELECT access on calculator_proposals for anonymous users
CREATE POLICY "Allow public read access on proposals"
ON public.calculator_proposals
FOR SELECT
TO anon
USING (true);

-- Also enable read access on servers and addons for viewing proposals
CREATE POLICY "Allow public read access on proposal servers"
ON public.calculator_proposal_servers
FOR SELECT
TO anon
USING (true);

CREATE POLICY "Allow public read access on proposal addons"
ON public.calculator_proposal_addons
FOR SELECT
TO anon
USING (true);