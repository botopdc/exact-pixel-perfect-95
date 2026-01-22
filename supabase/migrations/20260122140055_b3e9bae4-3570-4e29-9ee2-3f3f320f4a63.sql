-- ============================================================================
-- PROPOSAL PARTICIPANTS TABLE
-- Allows linking multiple users (Executive, Manager, CS, Architect) to proposals
-- Each participant can have their own commission percentage
-- ============================================================================

-- 1. Create participant role enum
CREATE TYPE participant_role AS ENUM ('EXECUTIVE', 'MANAGER', 'CS', 'ARCHITECT');

-- 2. Create proposal participants table
CREATE TABLE public.proposal_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proposal_id TEXT NOT NULL,  -- Links to external API proposal ID (can be numeric or PROP-xxx)
    external_user_id INTEGER NOT NULL,  -- User ID from external API (not Supabase auth)
    role participant_role NOT NULL,
    commission_pct DECIMAL(7,6) DEFAULT NULL,  -- Calculated on approval (e.g., 0.01 for 1%)
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(proposal_id, external_user_id, role)
);

-- 3. Create index for efficient lookups
CREATE INDEX idx_proposal_participants_proposal ON public.proposal_participants(proposal_id);
CREATE INDEX idx_proposal_participants_user_role ON public.proposal_participants(external_user_id, role);
CREATE INDEX idx_proposal_participants_role ON public.proposal_participants(role);

-- 4. Add updated_at trigger
CREATE TRIGGER update_proposal_participants_updated_at
    BEFORE UPDATE ON public.proposal_participants
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Enable Row Level Security
ALTER TABLE public.proposal_participants ENABLE ROW LEVEL SECURITY;

-- 6. Create RLS Policies
-- Allow all authenticated users to read (needed for visibility checks)
CREATE POLICY "proposal_participants_select"
ON public.proposal_participants FOR SELECT
TO authenticated
USING (true);

-- Allow insert for authenticated users (creating participant links)
CREATE POLICY "proposal_participants_insert"
ON public.proposal_participants FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow update for authenticated users (setting commission_pct on approval)
CREATE POLICY "proposal_participants_update"
ON public.proposal_participants FOR UPDATE
TO authenticated
USING (true);

-- Allow delete for authenticated users (removing participant links)
CREATE POLICY "proposal_participants_delete"
ON public.proposal_participants FOR DELETE
TO authenticated
USING (true);

-- 7. Add comments for documentation
COMMENT ON TABLE public.proposal_participants IS 'Links multiple users (architects, executives, etc.) to proposals with individual commission tracking';
COMMENT ON COLUMN public.proposal_participants.proposal_id IS 'Reference to external API proposal (numeric ID or PROP-xxx format)';
COMMENT ON COLUMN public.proposal_participants.external_user_id IS 'User ID from external authentication API';
COMMENT ON COLUMN public.proposal_participants.role IS 'Role in the proposal: EXECUTIVE, MANAGER, CS, ARCHITECT';
COMMENT ON COLUMN public.proposal_participants.commission_pct IS 'Commission percentage calculated when proposal is approved (e.g., 0.01 for 1%)';