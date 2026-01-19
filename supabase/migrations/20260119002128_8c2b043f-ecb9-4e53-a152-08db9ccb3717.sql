-- ============================================================================
-- OPEN Academy Enrollments Table
-- Controle de alunos, professores e instituições vinculados à OPEN Academy
-- ============================================================================

-- Create enum for academy status
CREATE TYPE public.academy_enrollment_status AS ENUM (
  'pending',
  'active',
  'suspended',
  'expired',
  'rejected'
);

-- Create enum for institution types
CREATE TYPE public.academy_institution_type AS ENUM (
  'Universidade',
  'Escola',
  'Instituto',
  'Empresa'
);

-- Create the academy_enrollments table
CREATE TABLE public.academy_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- User reference (external user from API or internal tracking)
  user_id TEXT NOT NULL,
  
  -- Academy level: 50=Aluno, 55=Professor, 60=Instituição/Coordenador
  academy_level INTEGER NOT NULL CHECK (academy_level IN (50, 55, 60)),
  
  -- Personal data
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  
  -- Institution data
  institution_name TEXT,
  institution_type TEXT,
  course_area TEXT,
  
  -- Proof of enrollment
  proof_url TEXT,
  proof_file_id TEXT,
  
  -- Benefit details
  discount_pct INTEGER NOT NULL DEFAULT 50 CHECK (discount_pct BETWEEN 50 AND 100),
  status academy_enrollment_status NOT NULL DEFAULT 'pending',
  valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until DATE NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '90 days'),
  
  -- Approval tracking
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  last_renewed_at TIMESTAMPTZ,
  
  -- Notes/audit trail
  notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create unique constraint on user_id
CREATE UNIQUE INDEX idx_academy_enrollments_user_id ON public.academy_enrollments(user_id);

-- Create indexes for common queries
CREATE INDEX idx_academy_enrollments_status ON public.academy_enrollments(status);
CREATE INDEX idx_academy_enrollments_valid_until ON public.academy_enrollments(valid_until);
CREATE INDEX idx_academy_enrollments_email ON public.academy_enrollments(email);
CREATE INDEX idx_academy_enrollments_academy_level ON public.academy_enrollments(academy_level);

-- Enable RLS
ALTER TABLE public.academy_enrollments ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Only tech team members can access
CREATE POLICY "academy_enrollments_select"
  ON public.academy_enrollments
  FOR SELECT
  USING (is_tech_team_member());

CREATE POLICY "academy_enrollments_insert"
  ON public.academy_enrollments
  FOR INSERT
  WITH CHECK (is_tech_team_member());

CREATE POLICY "academy_enrollments_update"
  ON public.academy_enrollments
  FOR UPDATE
  USING (is_tech_team_member());

CREATE POLICY "academy_enrollments_delete"
  ON public.academy_enrollments
  FOR DELETE
  USING (is_tech_admin());

-- Trigger for updated_at
CREATE TRIGGER update_academy_enrollments_updated_at
  BEFORE UPDATE ON public.academy_enrollments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add table to realtime for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.academy_enrollments;

-- Comment on table
COMMENT ON TABLE public.academy_enrollments IS 'OPEN Academy enrollment records for students, professors, and institutions with academic benefits';