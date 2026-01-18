-- ============================================================================
-- MIGRAÇÃO: Adicionar campos para vincular proposta a ativos
-- Permite salvar snapshot da proposta aprovada vinculada ao asset
-- ============================================================================

-- Adicionar novos campos à tabela cert_proposal_links
ALTER TABLE public.cert_proposal_links
ADD COLUMN IF NOT EXISTS asset_id uuid REFERENCES public.cert_assets(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS proposal_uuid text,
ADD COLUMN IF NOT EXISTS proposal_status text,
ADD COLUMN IF NOT EXISTS proposal_total numeric,
ADD COLUMN IF NOT EXISTS proposal_term_months integer,
ADD COLUMN IF NOT EXISTS proposal_company text,
ADD COLUMN IF NOT EXISTS snapshot_json jsonb,
ADD COLUMN IF NOT EXISTS imported_at timestamptz DEFAULT now(),
ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now(),
ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- Criar índice para busca por asset_id ativo
CREATE INDEX IF NOT EXISTS idx_cert_proposal_links_asset_active 
ON public.cert_proposal_links(asset_id, is_active) 
WHERE is_active = true;

-- Criar índice para busca por customer_id ativo
CREATE INDEX IF NOT EXISTS idx_cert_proposal_links_customer_active 
ON public.cert_proposal_links(customer_id, is_active) 
WHERE is_active = true;

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_cert_proposal_links_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS update_cert_proposal_links_updated_at ON public.cert_proposal_links;
CREATE TRIGGER update_cert_proposal_links_updated_at
  BEFORE UPDATE ON public.cert_proposal_links
  FOR EACH ROW
  EXECUTE FUNCTION public.update_cert_proposal_links_updated_at();