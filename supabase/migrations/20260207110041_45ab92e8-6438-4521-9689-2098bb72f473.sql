-- =============================================
-- CALCULATOR PROPOSALS - TABELA PRINCIPAL
-- =============================================
CREATE TABLE public.calculator_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id BIGINT NULL,
  display_id TEXT NULL,
  name TEXT NOT NULL,
  company TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Rascunho',
  channel_type TEXT NOT NULL DEFAULT 'CLIENTE' CHECK (channel_type IN ('PARCEIRO', 'CLIENTE')),
  reseller_name TEXT NULL,
  commission_value NUMERIC NULL,
  commission_reason TEXT NULL,
  observations TEXT NULL,
  fx NUMERIC NOT NULL DEFAULT 5.0,
  datacenter TEXT NOT NULL DEFAULT 'SP1',
  contract_duration INT NOT NULL DEFAULT 12,
  discount_pct NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  due_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days'),
  currency TEXT NOT NULL DEFAULT 'BRL',
  pdf_path TEXT NULL,
  created_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger para updated_at
CREATE TRIGGER update_calculator_proposals_updated_at
  BEFORE UPDATE ON public.calculator_proposals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.calculator_proposals ENABLE ROW LEVEL SECURITY;

-- RLS Policies (authenticated users can CRUD)
CREATE POLICY "calculator_proposals_select" ON public.calculator_proposals
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "calculator_proposals_insert" ON public.calculator_proposals
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "calculator_proposals_update" ON public.calculator_proposals
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "calculator_proposals_delete" ON public.calculator_proposals
  FOR DELETE TO authenticated USING (true);

-- =============================================
-- CALCULATOR PROPOSAL SERVERS
-- =============================================
CREATE TABLE public.calculator_proposal_servers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES public.calculator_proposals(id) ON DELETE CASCADE,
  server_type TEXT NOT NULL DEFAULT 'vm' CHECK (server_type IN ('vm', 'bm', 'storage')),
  name TEXT NOT NULL DEFAULT '',
  gpu TEXT NULL,
  gpu_qty INT NOT NULL DEFAULT 0,
  vcpu INT NOT NULL DEFAULT 0,
  ram_gb INT NOT NULL DEFAULT 0,
  nvme_tb NUMERIC NOT NULL DEFAULT 0,
  traffic_tb NUMERIC NOT NULL DEFAULT 0,
  ips INT NOT NULL DEFAULT 1,
  qty_servers INT NOT NULL DEFAULT 1,
  bm_cpu TEXT NULL,
  bm_ram TEXT NULL,
  disks JSONB NULL,
  storage_type TEXT NULL,
  storage_region TEXT NULL,
  volume_tb NUMERIC NULL,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  total_price NUMERIC NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  specs JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.calculator_proposal_servers ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "calculator_proposal_servers_select" ON public.calculator_proposal_servers
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "calculator_proposal_servers_insert" ON public.calculator_proposal_servers
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "calculator_proposal_servers_update" ON public.calculator_proposal_servers
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "calculator_proposal_servers_delete" ON public.calculator_proposal_servers
  FOR DELETE TO authenticated USING (true);

-- =============================================
-- CALCULATOR PROPOSAL ADDONS
-- =============================================
CREATE TABLE public.calculator_proposal_addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES public.calculator_proposals(id) ON DELETE CASCADE,
  addon_key TEXT NOT NULL,
  label TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT false,
  quantity INT NOT NULL DEFAULT 0,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  total_price NUMERIC NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  metadata JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.calculator_proposal_addons ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "calculator_proposal_addons_select" ON public.calculator_proposal_addons
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "calculator_proposal_addons_insert" ON public.calculator_proposal_addons
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "calculator_proposal_addons_update" ON public.calculator_proposal_addons
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "calculator_proposal_addons_delete" ON public.calculator_proposal_addons
  FOR DELETE TO authenticated USING (true);

-- =============================================
-- CALCULATOR PROPOSAL FILES
-- =============================================
CREATE TABLE public.calculator_proposal_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES public.calculator_proposals(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL DEFAULT 'application/pdf',
  file_name TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.calculator_proposal_files ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "calculator_proposal_files_select" ON public.calculator_proposal_files
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "calculator_proposal_files_insert" ON public.calculator_proposal_files
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "calculator_proposal_files_update" ON public.calculator_proposal_files
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "calculator_proposal_files_delete" ON public.calculator_proposal_files
  FOR DELETE TO authenticated USING (true);

-- =============================================
-- STORAGE BUCKET FOR PROPOSAL PDFs
-- =============================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('proposal-files', 'proposal-files', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "proposal_files_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'proposal-files');

CREATE POLICY "proposal_files_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'proposal-files');

CREATE POLICY "proposal_files_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'proposal-files');

CREATE POLICY "proposal_files_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'proposal-files');

-- =============================================
-- RPC: SAVE CALCULATOR PROPOSAL (TRANSACTIONAL)
-- =============================================
CREATE OR REPLACE FUNCTION public.save_calculator_proposal(payload JSONB)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_proposal_id UUID;
  v_proposal JSONB;
  v_servers JSONB;
  v_addons JSONB;
  v_server JSONB;
  v_addon JSONB;
  v_idx INT;
BEGIN
  -- Extract sections from payload
  v_proposal := payload->'proposal';
  v_servers := COALESCE(payload->'servers', '[]'::jsonb);
  v_addons := COALESCE(payload->'addons', '[]'::jsonb);
  
  -- Check if updating or inserting
  IF v_proposal->>'id' IS NOT NULL AND v_proposal->>'id' != '' THEN
    -- UPDATE existing proposal
    v_proposal_id := (v_proposal->>'id')::UUID;
    
    UPDATE public.calculator_proposals SET
      name = COALESCE(v_proposal->>'name', name),
      company = COALESCE(v_proposal->>'company', company),
      phone = COALESCE(v_proposal->>'phone', phone),
      email = COALESCE(v_proposal->>'email', email),
      status = COALESCE(v_proposal->>'status', status),
      channel_type = COALESCE(v_proposal->>'channel_type', channel_type),
      reseller_name = v_proposal->>'reseller_name',
      commission_value = (v_proposal->>'commission_value')::NUMERIC,
      commission_reason = v_proposal->>'commission_reason',
      observations = v_proposal->>'observations',
      fx = COALESCE((v_proposal->>'fx')::NUMERIC, fx),
      datacenter = COALESCE(v_proposal->>'datacenter', datacenter),
      contract_duration = COALESCE((v_proposal->>'contract_duration')::INT, contract_duration),
      discount_pct = COALESCE((v_proposal->>'discount_pct')::NUMERIC, discount_pct),
      total = COALESCE((v_proposal->>'total')::NUMERIC, total),
      due_at = COALESCE((v_proposal->>'due_at')::TIMESTAMPTZ, due_at),
      currency = COALESCE(v_proposal->>'currency', currency),
      display_id = COALESCE(v_proposal->>'display_id', display_id),
      updated_at = now()
    WHERE id = v_proposal_id;
    
    -- Delete existing servers and addons (will be re-inserted)
    DELETE FROM public.calculator_proposal_servers WHERE proposal_id = v_proposal_id;
    DELETE FROM public.calculator_proposal_addons WHERE proposal_id = v_proposal_id;
    
  ELSE
    -- INSERT new proposal
    INSERT INTO public.calculator_proposals (
      display_id, name, company, phone, email, status, channel_type,
      reseller_name, commission_value, commission_reason, observations,
      fx, datacenter, contract_duration, discount_pct, total, due_at, currency,
      created_by
    ) VALUES (
      v_proposal->>'display_id',
      v_proposal->>'name',
      v_proposal->>'company',
      v_proposal->>'phone',
      v_proposal->>'email',
      COALESCE(v_proposal->>'status', 'Rascunho'),
      COALESCE(v_proposal->>'channel_type', 'CLIENTE'),
      v_proposal->>'reseller_name',
      (v_proposal->>'commission_value')::NUMERIC,
      v_proposal->>'commission_reason',
      v_proposal->>'observations',
      COALESCE((v_proposal->>'fx')::NUMERIC, 5.0),
      COALESCE(v_proposal->>'datacenter', 'SP1'),
      COALESCE((v_proposal->>'contract_duration')::INT, 12),
      COALESCE((v_proposal->>'discount_pct')::NUMERIC, 0),
      COALESCE((v_proposal->>'total')::NUMERIC, 0),
      COALESCE((v_proposal->>'due_at')::TIMESTAMPTZ, now() + interval '30 days'),
      COALESCE(v_proposal->>'currency', 'BRL'),
      auth.uid()
    )
    RETURNING id INTO v_proposal_id;
  END IF;
  
  -- Insert servers
  v_idx := 0;
  FOR v_server IN SELECT * FROM jsonb_array_elements(v_servers)
  LOOP
    INSERT INTO public.calculator_proposal_servers (
      proposal_id, server_type, name, gpu, gpu_qty, vcpu, ram_gb, nvme_tb,
      traffic_tb, ips, qty_servers, bm_cpu, bm_ram, disks,
      storage_type, storage_region, volume_tb,
      unit_price, total_price, sort_order, specs
    ) VALUES (
      v_proposal_id,
      COALESCE(v_server->>'server_type', v_server->>'type', 'vm'),
      COALESCE(v_server->>'name', ''),
      v_server->>'gpu',
      COALESCE((v_server->>'gpu_qty')::INT, (v_server->>'gpuQty')::INT, 0),
      COALESCE((v_server->>'vcpu')::INT, 0),
      COALESCE((v_server->>'ram_gb')::INT, (v_server->>'ramGb')::INT, 0),
      COALESCE((v_server->>'nvme_tb')::NUMERIC, (v_server->>'nvmeTb')::NUMERIC, 0),
      COALESCE((v_server->>'traffic_tb')::NUMERIC, (v_server->>'trafficTb')::NUMERIC, 0),
      COALESCE((v_server->>'ips')::INT, 1),
      COALESCE((v_server->>'qty_servers')::INT, (v_server->>'qtyServers')::INT, 1),
      v_server->>'bm_cpu',
      v_server->>'bm_ram',
      v_server->'disks',
      v_server->>'storage_type',
      v_server->>'storage_region',
      (v_server->>'volume_tb')::NUMERIC,
      COALESCE((v_server->>'unit_price')::NUMERIC, 0),
      COALESCE((v_server->>'total_price')::NUMERIC, 0),
      v_idx,
      v_server->'specs'
    );
    v_idx := v_idx + 1;
  END LOOP;
  
  -- Insert addons
  v_idx := 0;
  FOR v_addon IN SELECT * FROM jsonb_array_elements(v_addons)
  LOOP
    INSERT INTO public.calculator_proposal_addons (
      proposal_id, addon_key, label, enabled, quantity,
      unit_price, total_price, sort_order, metadata
    ) VALUES (
      v_proposal_id,
      COALESCE(v_addon->>'addon_key', v_addon->>'key', ''),
      COALESCE(v_addon->>'label', ''),
      COALESCE((v_addon->>'enabled')::BOOLEAN, false),
      COALESCE((v_addon->>'quantity')::INT, 0),
      COALESCE((v_addon->>'unit_price')::NUMERIC, 0),
      COALESCE((v_addon->>'total_price')::NUMERIC, 0),
      v_idx,
      v_addon->'metadata'
    );
    v_idx := v_idx + 1;
  END LOOP;
  
  RETURN v_proposal_id;
END;
$$;