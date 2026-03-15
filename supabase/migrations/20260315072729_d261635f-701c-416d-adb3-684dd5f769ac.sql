
-- ============================================================================
-- MIGRATION: Consolidação do modelo de filas N1→N2→N3→CS
-- Corrige lacunas estruturais identificadas no modelo existente
-- ============================================================================

-- ============================================================================
-- 1. CORRIGIR queue_type DO CS (cs → customer_success)
-- ============================================================================
UPDATE public.support_queues 
SET queue_type = 'customer_success' 
WHERE code = 'CS' AND queue_type = 'cs';

-- ============================================================================
-- 2. ADICIONAR updated_at NAS TABELAS QUE NÃO TÊM
-- ============================================================================

-- support_ticket_types: adicionar updated_at
ALTER TABLE public.support_ticket_types 
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- support_ticket_categories: adicionar updated_at
ALTER TABLE public.support_ticket_categories 
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- ============================================================================
-- 3. ADICIONAR resolved_by_user_id E closed_by_user_id (INTEGER)
-- Os campos existentes support_resolved_by/cs_closed_by são UUID (Supabase auth).
-- O modelo operacional usa integer (legacy user_id da API).
-- Adicionamos os novos campos sem remover os antigos.
-- ============================================================================
ALTER TABLE public.support_tickets 
  ADD COLUMN IF NOT EXISTS resolved_by_user_id integer;

ALTER TABLE public.support_tickets 
  ADD COLUMN IF NOT EXISTS closed_by_user_id integer;

-- ============================================================================
-- 4. TRIGGERS DE updated_at NAS TABELAS QUE FALTAM
-- Reutiliza a função public.update_updated_at_column() já existente.
-- ============================================================================

-- support_ticket_types
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_support_ticket_types_updated_at'
  ) THEN
    CREATE TRIGGER update_support_ticket_types_updated_at
      BEFORE UPDATE ON public.support_ticket_types
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- support_ticket_categories
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_support_ticket_categories_updated_at'
  ) THEN
    CREATE TRIGGER update_support_ticket_categories_updated_at
      BEFORE UPDATE ON public.support_ticket_categories
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- ============================================================================
-- 5. ÍNDICES FALTANTES
-- Muitos já existem. Adicionamos apenas os que faltam.
-- ============================================================================

-- support_queues
CREATE INDEX IF NOT EXISTS idx_support_queues_active_sort 
  ON public.support_queues (is_active, sort_order);

-- support_queue_members: compostos para queries de visibilidade
CREATE INDEX IF NOT EXISTS idx_sqm_queue_active 
  ON public.support_queue_members (queue_id, is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_sqm_user_active 
  ON public.support_queue_members (user_id, is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_sqm_user_email 
  ON public.support_queue_members (user_email);

-- support_ticket_types
CREATE INDEX IF NOT EXISTS idx_stt_active 
  ON public.support_ticket_types (is_active) WHERE is_active = true;

-- support_ticket_categories
CREATE INDEX IF NOT EXISTS idx_stc_type_active 
  ON public.support_ticket_categories (type_id, is_active) WHERE is_active = true;

-- support_ticket_queue_history: to_queue + created_at desc
CREATE INDEX IF NOT EXISTS idx_stqh_to_queue_created 
  ON public.support_ticket_queue_history (to_queue_id, created_at DESC);

-- support_tickets: current_queue_id + status (composto para fila operacional)
CREATE INDEX IF NOT EXISTS idx_tickets_queue_id_status 
  ON public.support_tickets (current_queue_id, status) WHERE deleted_at IS NULL;

-- support_ticket_assignments: to_user_id + created_at desc
CREATE INDEX IF NOT EXISTS idx_sta_to_user_created 
  ON public.support_ticket_assignments (to_user_id, created_at DESC);

-- ============================================================================
-- 6. COMENTÁRIOS DOCUMENTAIS
-- ============================================================================

-- Documentar que escalado_n2 e escalado_n3 no enum support_ticket_status
-- são DEPRECIADOS. Escalonamento agora é representado por:
--   current_queue_id → fila destino
--   current_support_level → N2/N3
--   evento ticket.escalated
-- O status durante escalonamento permanece 'em_atendimento'.
-- Não removemos os valores do enum para evitar quebra de migração.
COMMENT ON TYPE public.support_ticket_status IS 
  'Status do ticket. DEPRECIADO: escalado_n2 e escalado_n3 não devem ser usados. '
  'Escalonamento é representado por current_queue_id + current_support_level + evento ticket.escalated. '
  'Status durante escalonamento = em_atendimento.';

COMMENT ON COLUMN public.support_tickets.current_queue_id IS 
  'FK para support_queues. Indica a fila operacional atual (N1, N2, N3, CS). '
  'Deve ser preenchido em todo ticket ativo. Candidato a NOT NULL após backfill completo.';

COMMENT ON COLUMN public.support_tickets.current_support_level IS 
  'Nível técnico atual: N1, N2, N3 ou CS. Acompanha current_queue_id.';

COMMENT ON COLUMN public.support_tickets.support_level IS 
  'LEGADO: enum support_level_enum original. Substituído por current_support_level (text).';

COMMENT ON COLUMN public.support_tickets.current_queue IS 
  'LEGADO: enum support_queue_enum original. Substituído por current_queue_id (FK para support_queues).';

COMMENT ON COLUMN public.support_tickets.resolved_by_user_id IS 
  'ID do usuário (integer, legado /api/auth) que resolveu o ticket.';

COMMENT ON COLUMN public.support_tickets.closed_by_user_id IS 
  'ID do usuário (integer, legado /api/auth) que fechou/encerrou o ticket via CS.';

COMMENT ON TABLE public.support_queues IS 
  'Filas de suporte: N1 (primeiro nível), N2 (análise avançada), N3 (engenharia), CS (encerramento).';

COMMENT ON TABLE public.support_queue_members IS 
  'Membros de cada fila. Define visibilidade: usuário vê tickets da fila onde é membro ativo.';

COMMENT ON TABLE public.support_ticket_queue_history IS 
  'Histórico de movimentação entre filas. Append-only.';

-- ============================================================================
-- 7. BACKFILL SEGURO
-- Não há tickets (0 rows), mas deixamos o SQL preparado para ambientes
-- que possam ter dados. Regra: tickets sem current_queue_id → fila N1.
-- ============================================================================

UPDATE public.support_tickets t
SET current_queue_id = (SELECT id FROM public.support_queues WHERE code = 'N1' LIMIT 1),
    current_support_level = 'N1'
WHERE t.current_queue_id IS NULL
  AND t.deleted_at IS NULL
  AND t.status NOT IN ('encerrado_cs', 'cancelado');

-- Tickets com status escalado_n2 → queue N2, status → em_atendimento
UPDATE public.support_tickets t
SET current_queue_id = (SELECT id FROM public.support_queues WHERE code = 'N2' LIMIT 1),
    current_support_level = 'N2',
    status = 'em_atendimento'
WHERE t.status = 'escalado_n2'
  AND t.deleted_at IS NULL;

-- Tickets com status escalado_n3 → queue N3, status → em_atendimento
UPDATE public.support_tickets t
SET current_queue_id = (SELECT id FROM public.support_queues WHERE code = 'N3' LIMIT 1),
    current_support_level = 'N3',
    status = 'em_atendimento'
WHERE t.status = 'escalado_n3'
  AND t.deleted_at IS NULL;

-- Tickets resolvidos aguardando CS → queue CS
UPDATE public.support_tickets t
SET current_queue_id = (SELECT id FROM public.support_queues WHERE code = 'CS' LIMIT 1),
    current_support_level = 'CS'
WHERE t.status = 'resolvido_suporte'
  AND (t.current_queue_id IS NULL OR t.current_support_level != 'CS')
  AND t.deleted_at IS NULL;

-- Tickets encerrados → queue CS
UPDATE public.support_tickets t
SET current_queue_id = COALESCE(t.current_queue_id, (SELECT id FROM public.support_queues WHERE code = 'CS' LIMIT 1)),
    current_support_level = COALESCE(NULLIF(t.current_support_level, 'N1'), 'CS')
WHERE t.status = 'encerrado_cs'
  AND t.current_queue_id IS NULL
  AND t.deleted_at IS NULL;
