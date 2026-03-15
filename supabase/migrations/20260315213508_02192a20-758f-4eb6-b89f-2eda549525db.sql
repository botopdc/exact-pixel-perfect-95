
-- ops_service_status: Status operacional de serviços críticos do ambiente
CREATE TABLE public.ops_service_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_code text NOT NULL UNIQUE,
  service_name text NOT NULL,
  status text NOT NULL DEFAULT 'operational',
  status_message text,
  source text NOT NULL DEFAULT 'manual',
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Trigger de updated_at
CREATE TRIGGER ops_service_status_updated_at
  BEFORE UPDATE ON public.ops_service_status
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.ops_service_status ENABLE ROW LEVEL SECURITY;

-- Leitura: todos os internos
CREATE POLICY "ops_service_status_select_internal"
  ON public.ops_service_status FOR SELECT
  TO authenticated
  USING (is_support_internal());

-- Escrita: apenas admin/gerente
CREATE POLICY "ops_service_status_manage_admin"
  ON public.ops_service_status FOR ALL
  TO authenticated
  USING (is_support_admin_or_manager())
  WITH CHECK (is_support_admin_or_manager());

-- Seed com serviços iniciais
INSERT INTO public.ops_service_status (service_code, service_name, status, source) VALUES
  ('cloud', 'Cloud', 'operational', 'manual'),
  ('storage', 'Storage', 'operational', 'manual'),
  ('backup', 'Backup', 'operational', 'manual'),
  ('api', 'API', 'operational', 'manual');
