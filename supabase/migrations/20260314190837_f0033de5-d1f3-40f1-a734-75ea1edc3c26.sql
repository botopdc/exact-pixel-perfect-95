
CREATE OR REPLACE FUNCTION public.create_contract_from_proposal(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_proposal_id uuid;
  v_existing_id uuid;
  v_contract_id uuid;
  v_result jsonb;
BEGIN
  v_proposal_id := (payload->>'proposal_id')::uuid;

  IF v_proposal_id IS NULL THEN
    RAISE EXCEPTION 'proposal_id é obrigatório';
  END IF;

  -- Check for existing active contract
  SELECT id INTO v_existing_id
  FROM public.contracts
  WHERE proposal_id = v_proposal_id AND deleted_at IS NULL
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RAISE EXCEPTION 'Esta proposta já foi convertida em contrato';
  END IF;

  INSERT INTO public.contracts (
    proposal_id, proposal_uuid, client_name, company, email, phone,
    tax_id, currency, subtotal, discount_amount, total,
    datacenter, contract_duration, billing_cycle,
    start_date, end_date, due_at, notes,
    proposal_payload, contract_payload, status,
    legal_name, company_name, has_no_cnpj, cnpj,
    responsible_name, responsible_cpf,
    zip_code, street, neighborhood, city, state,
    payment_day, contract_date,
    generated_by, updated_by
  ) VALUES (
    v_proposal_id,
    payload->>'proposal_uuid',
    payload->>'client_name',
    payload->>'company',
    payload->>'email',
    COALESCE(payload->>'phone', ''),
    payload->>'tax_id',
    COALESCE(payload->>'currency', 'BRL'),
    COALESCE((payload->>'subtotal')::numeric, 0),
    COALESCE((payload->>'discount_amount')::numeric, 0),
    COALESCE((payload->>'total')::numeric, 0),
    payload->>'datacenter',
    (payload->>'contract_duration')::integer,
    COALESCE(payload->>'billing_cycle', 'mensal'),
    CASE WHEN payload->>'start_date' IS NOT NULL AND payload->>'start_date' != '' THEN (payload->>'start_date')::date ELSE NULL END,
    CASE WHEN payload->>'end_date' IS NOT NULL AND payload->>'end_date' != '' THEN (payload->>'end_date')::date ELSE NULL END,
    CASE WHEN payload->>'due_at' IS NOT NULL AND payload->>'due_at' != '' THEN (payload->>'due_at')::timestamptz ELSE NULL END,
    payload->>'notes',
    COALESCE(payload->'proposal_payload', '{}'::jsonb),
    COALESCE(payload->'contract_payload', '{}'::jsonb),
    'rascunho',
    payload->>'legal_name',
    payload->>'company_name',
    COALESCE((payload->>'has_no_cnpj')::boolean, false),
    payload->>'cnpj',
    payload->>'responsible_name',
    payload->>'responsible_cpf',
    payload->>'zip_code',
    payload->>'street',
    payload->>'neighborhood',
    payload->>'city',
    payload->>'state',
    CASE WHEN payload->>'payment_day' IS NOT NULL AND payload->>'payment_day' != '' THEN (payload->>'payment_day')::integer ELSE NULL END,
    CASE WHEN payload->>'contract_date' IS NOT NULL AND payload->>'contract_date' != '' THEN (payload->>'contract_date')::date ELSE NULL END,
    auth.uid(),
    auth.uid()
  )
  RETURNING id INTO v_contract_id;

  SELECT to_jsonb(c.*) INTO v_result
  FROM public.contracts c
  WHERE c.id = v_contract_id;

  RETURN v_result;
END;
$$;
