
-- Contracts table linked to calculator_proposals
CREATE TABLE public.contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid NOT NULL REFERENCES public.calculator_proposals(id) ON DELETE RESTRICT,
  client_name text NOT NULL,
  company text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'rascunho',
  contract_number text,
  total numeric(14,2) DEFAULT 0,
  datacenter text,
  contract_duration integer,
  due_at timestamptz,
  proposal_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  contract_payload jsonb DEFAULT '{}'::jsonb,
  generated_from_proposal_at timestamptz NOT NULL DEFAULT now(),
  generated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

-- Prevent duplicate contracts for same proposal (only active ones)
CREATE UNIQUE INDEX contracts_proposal_id_active_unique ON public.contracts (proposal_id) WHERE deleted_at IS NULL;

-- Auto-update updated_at
CREATE TRIGGER contracts_set_updated_at
  BEFORE UPDATE ON public.contracts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Enable RLS
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

-- RLS policies - internal users only (authenticated)
CREATE POLICY "contracts_select" ON public.contracts FOR SELECT TO authenticated USING (true);
CREATE POLICY "contracts_insert" ON public.contracts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "contracts_update" ON public.contracts FOR UPDATE TO authenticated USING (true);
CREATE POLICY "contracts_delete" ON public.contracts FOR DELETE TO authenticated USING (true);
