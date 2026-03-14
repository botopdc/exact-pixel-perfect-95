-- Allow anon role to read contracts (frontend uses anon key like calculator_proposals)
CREATE POLICY "contracts_select_anon"
  ON public.contracts
  FOR SELECT
  TO anon
  USING (deleted_at IS NULL);