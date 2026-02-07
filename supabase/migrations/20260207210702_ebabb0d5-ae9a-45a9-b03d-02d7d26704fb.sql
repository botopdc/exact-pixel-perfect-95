
-- Trigger para atualizar updated_at automaticamente em calculator_configs
CREATE OR REPLACE FUNCTION public.update_calculator_configs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER calculator_configs_updated_at_trigger
  BEFORE UPDATE ON public.calculator_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_calculator_configs_updated_at();
