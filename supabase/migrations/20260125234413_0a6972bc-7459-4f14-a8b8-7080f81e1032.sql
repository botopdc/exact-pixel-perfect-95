-- Drop existing policies
DROP POLICY IF EXISTS "proposal_participants_select" ON public.proposal_participants;
DROP POLICY IF EXISTS "proposal_participants_insert" ON public.proposal_participants;
DROP POLICY IF EXISTS "proposal_participants_update" ON public.proposal_participants;
DROP POLICY IF EXISTS "proposal_participants_delete" ON public.proposal_participants;

-- Create open policies (auth is handled by Laravel, not Supabase)
CREATE POLICY "proposal_participants_select" ON public.proposal_participants
FOR SELECT USING (true);

CREATE POLICY "proposal_participants_insert" ON public.proposal_participants
FOR INSERT WITH CHECK (true);

CREATE POLICY "proposal_participants_update" ON public.proposal_participants
FOR UPDATE USING (true);

CREATE POLICY "proposal_participants_delete" ON public.proposal_participants
FOR DELETE USING (true);