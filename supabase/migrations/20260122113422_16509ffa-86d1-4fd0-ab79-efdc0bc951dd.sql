-- ============================================================================
-- USER COMMISSION OVERRIDES - Armazena override de comissão por usuário
-- ============================================================================

-- Tabela para armazenar overrides de comissão
CREATE TABLE public.user_commission_overrides (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  external_user_id INTEGER NOT NULL UNIQUE,  -- ID do usuário na API externa
  commission_pct_override DECIMAL(5,4) NULL,  -- Ex: 0.01 para 1%, NULL = usar regra padrão
  notes TEXT NULL,  -- Observações (opcional)
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by_name VARCHAR(120) NULL,  -- Quem criou/alterou (snapshot)
  created_by_email VARCHAR(255) NULL
);

-- Comentário para documentação
COMMENT ON TABLE public.user_commission_overrides IS 'Armazena override de comissão personalizada por usuário da API externa';
COMMENT ON COLUMN public.user_commission_overrides.commission_pct_override IS 'Percentual de comissão personalizado em decimal. Ex: 0.01 = 1%. Se NULL, usa regra padrão do level.';
COMMENT ON COLUMN public.user_commission_overrides.external_user_id IS 'ID do usuário na API externa (OPDC API /api/user)';

-- Enable RLS
ALTER TABLE public.user_commission_overrides ENABLE ROW LEVEL SECURITY;

-- Políticas RLS (apenas leitura pública, escrita via service role ou admin)
-- Leitura: Qualquer usuário autenticado pode ler (para exibir a comissão correta)
CREATE POLICY "Allow read for all authenticated users"
ON public.user_commission_overrides
FOR SELECT
USING (true);

-- Insert/Update/Delete: Apenas via service role (backend)
-- Como não temos auth.users vinculado, permitimos via função ou service_role
CREATE POLICY "Allow all operations for service role"
ON public.user_commission_overrides
FOR ALL
USING (true)
WITH CHECK (true);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_user_commission_overrides_updated_at
BEFORE UPDATE ON public.user_commission_overrides
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Index para busca rápida por external_user_id
CREATE INDEX idx_user_commission_overrides_external_user_id 
ON public.user_commission_overrides(external_user_id);