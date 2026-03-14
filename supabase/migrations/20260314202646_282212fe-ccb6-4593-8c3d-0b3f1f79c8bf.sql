
-- =============================================
-- 1) Add document-generation columns to contracts
-- =============================================
ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS setup_value numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS contract_city text,
  ADD COLUMN IF NOT EXISTS open_signer_name text,
  ADD COLUMN IF NOT EXISTS open_signer_cpf text,
  ADD COLUMN IF NOT EXISTS witness_1_name text,
  ADD COLUMN IF NOT EXISTS witness_1_cpf text,
  ADD COLUMN IF NOT EXISTS witness_2_name text,
  ADD COLUMN IF NOT EXISTS witness_2_cpf text,
  ADD COLUMN IF NOT EXISTS template_code text,
  ADD COLUMN IF NOT EXISTS template_path text,
  ADD COLUMN IF NOT EXISTS docx_path text,
  ADD COLUMN IF NOT EXISTS contract_pdf_path text,
  ADD COLUMN IF NOT EXISTS annex_pdf_path text,
  ADD COLUMN IF NOT EXISTS final_pdf_path text,
  ADD COLUMN IF NOT EXISTS proposal_pdf_source_path text,
  ADD COLUMN IF NOT EXISTS generation_strategy text,
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_contracts_status ON public.contracts (status);
CREATE INDEX IF NOT EXISTS idx_contracts_proposal_id ON public.contracts (proposal_id);

-- =============================================
-- 2) Create contract_templates table
-- =============================================
CREATE TABLE IF NOT EXISTS public.contract_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  bucket text NOT NULL,
  path text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.contract_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contract_templates_select_anon" ON public.contract_templates FOR SELECT TO anon USING (is_active = true);
CREATE POLICY "contract_templates_select_auth" ON public.contract_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "contract_templates_insert_auth" ON public.contract_templates FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "contract_templates_update_auth" ON public.contract_templates FOR UPDATE TO authenticated USING (true);
CREATE POLICY "contract_templates_delete_auth" ON public.contract_templates FOR DELETE TO authenticated USING (true);

-- Default template record
INSERT INTO public.contract_templates (code, name, description, bucket, path)
VALUES ('opdc-cloud-default', 'Contrato OPDC Cloud', 'Template padrão de contrato de serviços de cloud', 'contract-templates', 'opdc-cloud/default.docx')
ON CONFLICT (code) DO NOTHING;

-- Updated_at trigger
CREATE TRIGGER update_contract_templates_updated_at
  BEFORE UPDATE ON public.contract_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- =============================================
-- 3) Create storage buckets
-- =============================================
INSERT INTO storage.buckets (id, name, public) VALUES ('contract-templates', 'contract-templates', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('contracts-generated', 'contracts-generated', false) ON CONFLICT (id) DO NOTHING;

-- Storage policies for contract-templates bucket
CREATE POLICY "ct_storage_select_anon" ON storage.objects FOR SELECT TO anon USING (bucket_id = 'contract-templates');
CREATE POLICY "ct_storage_select_auth" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'contract-templates');
CREATE POLICY "ct_storage_insert_auth" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'contract-templates');
CREATE POLICY "ct_storage_update_auth" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'contract-templates');
CREATE POLICY "ct_storage_delete_auth" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'contract-templates');

-- Storage policies for contracts-generated bucket
CREATE POLICY "cg_storage_select_auth" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'contracts-generated');
CREATE POLICY "cg_storage_select_anon" ON storage.objects FOR SELECT TO anon USING (bucket_id = 'contracts-generated');
CREATE POLICY "cg_storage_insert_auth" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'contracts-generated');
CREATE POLICY "cg_storage_insert_anon" ON storage.objects FOR INSERT TO anon WITH CHECK (bucket_id = 'contracts-generated');
CREATE POLICY "cg_storage_update_auth" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'contracts-generated');
CREATE POLICY "cg_storage_delete_auth" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'contracts-generated');
