-- =============================================================================
-- Migration: 20260619000100_sterilization_cycles.sql
-- Phase: 13-esteriliza-o-cme-laborat-rio-de-pr-tese / Plan 02
-- Purpose: CME foundation tables (CME-01, CME-02, CME-03):
--   - public.sterilization_cycles: autoclave cycle records (autoclave reuses
--     public.resources via autoclave_id FK — D-01; NO dedicated autoclaves table)
--   - public.kit_usages: links a cycle (= the lote, D-02) to appointment + patient
--     for lote-level traceability (CME-03)
--
-- Security: RLS in 20260619000200_sterilization_rls.sql
-- CRITICAL: Do NOT touch public.appointments, its GIST no_overlap, or
--           public.financial_transactions.
-- =============================================================================

-- ─── public.sterilization_cycles ─────────────────────────────────────────────
-- Autoclave cycle record. autoclave_id FK → public.resources(id) (tipo='equipamento').
-- biological_result: 'pendente' (default) → 'aprovado' / 'reprovado' after reading the
--   biological indicator culture.
-- validade: expiry date of the sterilized material (nullable = no expiry recorded).
-- status: persisted snapshot of cycle state; 'vencido' also derived at read-time by
--   isCycleUsable (validade < today). Stored status allows historical queries.
-- operator_id: the staff member who ran the autoclave cycle.
-- deleted_at: LGPD soft-delete.

CREATE TABLE public.sterilization_cycles (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id          UUID        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  unit_id            UUID        REFERENCES public.units(id),
  autoclave_id       UUID        NOT NULL REFERENCES public.resources(id),   -- D-01: autoclave reuses resources (tipo='equipamento')
  cycle_number       TEXT,                                                    -- optional human label / lote ref
  temperatura        NUMERIC(6,2),                                            -- °C
  tempo_minutos      INTEGER,                                                 -- cycle duration (minutes)
  pressao            NUMERIC(6,2),                                            -- kPa/bar
  biological_result  TEXT        NOT NULL DEFAULT 'pendente'
                     CHECK (biological_result IN ('pendente', 'aprovado', 'reprovado')),
  cycle_date         DATE        NOT NULL DEFAULT CURRENT_DATE,
  validade           DATE,                                                    -- expiry of the sterilized material (nullable = no expiry recorded)
  status             TEXT        NOT NULL DEFAULT 'pendente'
                     CHECK (status IN ('pendente', 'aprovado', 'reprovado', 'vencido')),
  operator_id        UUID        REFERENCES public.users(id),
  notes              TEXT,
  created_by         UUID        REFERENCES public.users(id),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at         TIMESTAMPTZ                                              -- LGPD soft delete
);

-- Mandatory indexes (CLAUDE.md: index every FK used in RLS/WHERE)
CREATE INDEX idx_sterilization_cycles_clinic    ON public.sterilization_cycles(clinic_id);
CREATE INDEX idx_sterilization_cycles_unit      ON public.sterilization_cycles(unit_id)
  WHERE unit_id IS NOT NULL;
CREATE INDEX idx_sterilization_cycles_autoclave ON public.sterilization_cycles(autoclave_id);
CREATE INDEX idx_sterilization_cycles_status    ON public.sterilization_cycles(clinic_id, status);

-- ─── public.kit_usages ───────────────────────────────────────────────────────
-- Links a sterilization cycle (= the lote, D-02) to an appointment + patient.
-- Provides CME-03 lote-level traceability: which cycle (batch) of sterilized
-- instruments was used on which patient at which appointment.
-- sterilization_cycle_id is the traceability anchor (the "lote").
-- appointment_id is nullable (kit may be recorded outside a scheduled appointment).
-- deleted_at: LGPD soft-delete (kit_usage record may contain health PII via patient_id).
-- NOTE: No audit_table_changes() trigger — that function expects tenant_id but this
--   table uses clinic_id. Traceability is provided by logBusinessEvent in Plan 04.

CREATE TABLE public.kit_usages (
  id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id              UUID        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  unit_id                UUID        REFERENCES public.units(id),
  sterilization_cycle_id UUID        NOT NULL REFERENCES public.sterilization_cycles(id),   -- the lote (D-02)
  appointment_id         UUID        REFERENCES public.appointments(id),
  patient_id             UUID        NOT NULL REFERENCES public.patients(id),
  kit_label              TEXT,                                                                -- optional free-text kit descriptor (lote-level)
  used_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  used_by                UUID        REFERENCES public.users(id),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at             TIMESTAMPTZ                                                          -- LGPD soft delete
);

-- Mandatory indexes (CLAUDE.md: index every FK used in RLS/WHERE + traceability queries)
CREATE INDEX idx_kit_usages_clinic  ON public.kit_usages(clinic_id);
CREATE INDEX idx_kit_usages_cycle   ON public.kit_usages(sterilization_cycle_id);
CREATE INDEX idx_kit_usages_patient ON public.kit_usages(patient_id);
CREATE INDEX idx_kit_usages_appt    ON public.kit_usages(appointment_id)
  WHERE appointment_id IS NOT NULL;
CREATE INDEX idx_kit_usages_unit    ON public.kit_usages(unit_id)
  WHERE unit_id IS NOT NULL;
