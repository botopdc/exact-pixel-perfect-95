-- Performance indexes for calculator_proposals
CREATE INDEX IF NOT EXISTS idx_proposals_created_at ON public.calculator_proposals (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_proposals_status ON public.calculator_proposals (status);
CREATE INDEX IF NOT EXISTS idx_proposals_company ON public.calculator_proposals (company);
CREATE INDEX IF NOT EXISTS idx_proposals_display_id ON public.calculator_proposals (display_id);
CREATE INDEX IF NOT EXISTS idx_proposals_channel_type ON public.calculator_proposals (channel_type);
CREATE INDEX IF NOT EXISTS idx_proposals_composite_status_created ON public.calculator_proposals (status, created_at DESC);

-- Performance indexes for contracts
CREATE INDEX IF NOT EXISTS idx_contracts_status ON public.contracts (status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_contracts_created_at ON public.contracts (created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_contracts_company ON public.contracts (company) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_contracts_proposal_id ON public.contracts (proposal_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_contracts_updated_at ON public.contracts (updated_at DESC) WHERE deleted_at IS NULL;

-- Performance indexes for proposal participants
CREATE INDEX IF NOT EXISTS idx_proposal_participants_proposal_id ON public.proposal_participants (proposal_id);
CREATE INDEX IF NOT EXISTS idx_proposal_participants_external_user_id ON public.proposal_participants (external_user_id);

-- Performance indexes for calculator_proposal_servers
CREATE INDEX IF NOT EXISTS idx_proposal_servers_proposal_id ON public.calculator_proposal_servers (proposal_id);

-- Performance indexes for calculator_proposal_addons
CREATE INDEX IF NOT EXISTS idx_proposal_addons_proposal_id ON public.calculator_proposal_addons (proposal_id);