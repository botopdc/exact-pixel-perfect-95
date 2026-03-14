
-- Update the save_calculator_proposal function to handle display_id uniqueness
-- If creating a new proposal and a proposal with the same display_id already exists,
-- treat it as an update instead of insert (prevents duplicates from double-clicks)
CREATE OR REPLACE FUNCTION public.save_calculator_proposal(payload jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_proposal_id UUID;
  v_proposal JSONB;
  v_servers JSONB;
  v_addons JSONB;
  v_server JSONB;
  v_addon JSONB;
  v_idx INT;
  v_display_id TEXT;
  v_existing_id UUID;
BEGIN
  v_proposal := payload->'proposal';
  v_servers := COALESCE(payload->'servers', '[]'::jsonb);
  v_addons := COALESCE(payload->'addons', '[]'::jsonb);
  v_display_id := v_proposal->>'display_id';
  
  -- Check if updating by UUID
  IF v_proposal->>'id' IS NOT NULL AND v_proposal->>'id' != '' THEN
    v_proposal_id := (v_proposal->>'id')::UUID;
  ELSE
    -- Check if a proposal with same display_id already exists (prevent duplicates)
    IF v_display_id IS NOT NULL AND v_display_id != '' THEN
      SELECT id INTO v_existing_id FROM public.calculator_proposals WHERE display_id = v_display_id LIMIT 1;
      IF v_existing_id IS NOT NULL THEN
        v_proposal_id := v_existing_id;
        RAISE NOTICE 'Found existing proposal with display_id=%, treating as update (id=%)', v_display_id, v_proposal_id;
      END IF;
    END IF;
  END IF;

  IF v_proposal_id IS NOT NULL THEN
    -- UPDATE existing proposal
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
      v_display_id,
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
$function$;
