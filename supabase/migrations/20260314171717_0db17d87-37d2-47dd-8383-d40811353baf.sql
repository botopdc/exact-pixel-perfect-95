
-- Table: docs_sync_runs
CREATE TABLE public.docs_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  command_name text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  started_at timestamptz,
  finished_at timestamptz,
  triggered_by uuid NULL,
  files_affected text[] NULL,
  summary text NULL,
  details_md text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.docs_sync_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "docs_sync_runs_select" ON public.docs_sync_runs FOR SELECT TO authenticated USING (true);
CREATE POLICY "docs_sync_runs_insert" ON public.docs_sync_runs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "docs_sync_runs_update" ON public.docs_sync_runs FOR UPDATE TO authenticated USING (true);
CREATE POLICY "docs_sync_runs_delete" ON public.docs_sync_runs FOR DELETE TO authenticated USING (true);

-- Table: docs_sync_coverage
CREATE TABLE public.docs_sync_coverage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_slug text NOT NULL,
  source_type text NOT NULL,
  source_name text NOT NULL,
  is_covered boolean DEFAULT false,
  notes text NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.docs_sync_coverage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "docs_sync_coverage_select" ON public.docs_sync_coverage FOR SELECT TO authenticated USING (true);
CREATE POLICY "docs_sync_coverage_insert" ON public.docs_sync_coverage FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "docs_sync_coverage_update" ON public.docs_sync_coverage FOR UPDATE TO authenticated USING (true);
CREATE POLICY "docs_sync_coverage_delete" ON public.docs_sync_coverage FOR DELETE TO authenticated USING (true);
