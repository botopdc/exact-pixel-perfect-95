CREATE TABLE IF NOT EXISTS public.connection_test (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  message text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.connection_test ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon insert on connection_test" ON public.connection_test FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon select on connection_test" ON public.connection_test FOR SELECT TO anon USING (true);