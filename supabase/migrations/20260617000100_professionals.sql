-- =============================================================================
-- Migration: 20260617000100_professionals.sql
-- Phase: 11-profissionais-recursos / Plan 02
-- Purpose: Create professionals clinical registry (PRO-01):
--   - public.professionals: CRO+UF, especialidades, vínculo, commission_rules,
--     user_id NULLABLE FK (professionals without login allowed), soft delete.
--   - public.professional_availability: recurring weekly schedule (flat rows).
--   - public.professional_availability_exceptions: date-specific overrides
--     (folga = full day off; extra = additional hours on that date).
-- Security: partial unique index guards soft-deleted rows (T-11-07).
-- Backfill (PRO-01): existing role='dentist' users are inserted as professionals.
-- GIST: NOT TOUCHED — appointments EXCLUDE GIST stays on dentist_id (users FK).
-- NOTE: db push happens in Plan 11-05 (BLOCKING step) — NOT here.
-- =============================================================================

-- ============ professionals (PRO-01, D-01) ============
CREATE TABLE public.professionals (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id         UUID        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  unit_id           UUID        REFERENCES public.units(id),      -- nullable: clinic-wide professional
  user_id           UUID        REFERENCES public.users(id),      -- NULLABLE: professionals without login
  full_name         TEXT        NOT NULL,
  cro               TEXT        NOT NULL,                          -- CRO registration number (empty placeholder for backfill; admin fills via Plan 06 UI)
  cro_uf            CHAR(2)     NOT NULL,                         -- state of CRO (2-char UF)
  especialidades    TEXT[]      NOT NULL DEFAULT '{}',             -- PRO-01: multi-select specialties
  vinculo           TEXT        NOT NULL DEFAULT 'autonomo'
                    CHECK (vinculo IN ('clt', 'pj', 'autonomo')), -- PRO-01: employment type
  commission_rules  JSONB       NOT NULL DEFAULT '[]',             -- PRO-03: stored only; Phase 16 calcs
  ativo             BOOLEAN     NOT NULL DEFAULT true,
  deleted_at        TIMESTAMPTZ,                                   -- LGPD soft delete
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Mandatory indexes (CLAUDE.md: index every clinic_id + unit_id)
CREATE INDEX idx_professionals_clinic_id ON public.professionals(clinic_id);
CREATE INDEX idx_professionals_unit_id   ON public.professionals(unit_id);
CREATE INDEX idx_professionals_user_id   ON public.professionals(user_id)
  WHERE user_id IS NOT NULL;

-- Partial unique index (T-11-07 — Pitfall 4):
-- prevents two active professional rows for the same user_id in the same clinic.
-- Soft-deleted rows (deleted_at IS NOT NULL) are excluded from the uniqueness check.
CREATE UNIQUE INDEX idx_professionals_clinic_user
  ON public.professionals(clinic_id, user_id)
  WHERE user_id IS NOT NULL AND deleted_at IS NULL;

-- ============ Audit trigger for professionals ============
-- professionals uses clinic_id (not tenant_id), so we reuse audit_units_changes() pattern.
-- audit_table_changes() would fail because it reads NEW.tenant_id which does not exist here.
CREATE OR REPLACE FUNCTION public.audit_professionals_changes()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_logs (
    tenant_id, actor_id, action, table_name, record_id, old_values, new_values, created_at
  ) VALUES (
    CASE TG_OP WHEN 'DELETE' THEN OLD.clinic_id ELSE NEW.clinic_id END,
    auth.uid(),
    TG_OP,
    TG_TABLE_NAME,
    CASE TG_OP WHEN 'DELETE' THEN OLD.id ELSE NEW.id END,
    CASE TG_OP WHEN 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
    CASE TG_OP WHEN 'DELETE' THEN NULL ELSE to_jsonb(NEW) END,
    now()
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER audit_professionals
  AFTER INSERT OR UPDATE OR DELETE ON public.professionals
  FOR EACH ROW EXECUTE FUNCTION public.audit_professionals_changes();

-- ============ professional_availability (PRO-01, D-01/D-02) ============
-- One row per (professional, weekday, time window).
-- Flat row model (not JSONB) — easier to query for slot generation.
-- weekday: 0=Sunday, 1=Monday, ..., 6=Saturday (mirrors JS Date.getDay()).
CREATE TABLE public.professional_availability (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id UUID        NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
  clinic_id       UUID        NOT NULL,                           -- denormalized for RLS + index
  weekday         SMALLINT    NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time      TIME        NOT NULL,
  end_time        TIME        NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_prof_availability_professional ON public.professional_availability(professional_id);
CREATE INDEX idx_prof_availability_clinic_id    ON public.professional_availability(clinic_id);

-- ============ professional_availability_exceptions (PRO-01, D-01/D-02) ============
-- Date-specific overrides:
--   folga   = full day off (blocks even if recurring window exists on that weekday)
--   extra   = additional working hours on that specific date (no recurring needed)
-- start_time/end_time only required for 'extra' type.
CREATE TABLE public.professional_availability_exceptions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id UUID        NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
  clinic_id       UUID        NOT NULL,                           -- denormalized for RLS + index
  exception_date  DATE        NOT NULL,
  exception_type  TEXT        NOT NULL CHECK (exception_type IN ('folga', 'extra')),
  start_time      TIME,                                           -- required for 'extra'; NULL for 'folga'
  end_time        TIME,                                           -- required for 'extra'; NULL for 'folga'
  reason          TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_prof_avail_exc_professional ON public.professional_availability_exceptions(professional_id);
CREATE INDEX idx_prof_avail_exc_date         ON public.professional_availability_exceptions(professional_id, exception_date);

-- ============ Backfill (PRO-01): existing dentist users → professionals rows ============
-- Inserts one professional row per user WHERE role='dentist' AND deleted_at IS NULL.
-- cro and cro_uf are left as empty/placeholder — admin fills these via the cadastro UI (Plan 06).
-- ON CONFLICT DO NOTHING relies on the partial unique index idx_professionals_clinic_user
-- to safely skip users already backfilled (idempotent re-run).
-- unit_id: resolved to the default unit of the user's clinic (is_default=true).
-- If no default unit exists yet, unit_id is NULL (nullable — fine for clinic-wide professionals).
INSERT INTO public.professionals (
  clinic_id,
  unit_id,
  user_id,
  full_name,
  cro,
  cro_uf,
  vinculo
)
SELECT
  u.tenant_id,
  (
    SELECT un.id
    FROM public.units un
    WHERE un.clinic_id = u.tenant_id
      AND un.is_default = true
    LIMIT 1
  ),
  u.id,
  COALESCE(u.full_name, 'Profissional'),
  '',      -- CRO placeholder — admin fills via Plan 06 UI
  'SP',    -- UF placeholder — admin fills via Plan 06 UI
  'clt'
FROM public.users u
WHERE u.role = 'dentist'
  AND u.deleted_at IS NULL
ON CONFLICT DO NOTHING;
