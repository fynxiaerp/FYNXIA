-- =============================================================================
-- Migration: 20260618000400_teleconsultations.sql
-- Phase: 12-receitu-rio-teleodontologia / Plan 03
-- Purpose: Create teleodontologia data model:
--   - public.teleconsultations: session metadata, CFO consent (TEL-01)
--     external_link (D-03: video = link only), consent_given/consent_given_at/consent_ip,
--     started_at/ended_at, status CHECK, deleted_at (LGPD soft delete).
--   - public.soap_records: structured SOAP note (TEL-02) — separate from
--     medical_records (free-text) and dental_records (FDI odontogram).
--     Linked to both appointments and teleconsultations (nullable FKs).
-- CRITICAL: does NOT touch public.appointments, its GIST (no_overlap),
--           public.medical_records, or public.dental_records.
-- NOTE: db push happens in Plan 12-05 (BLOCKING step) — NOT here.
-- =============================================================================

-- ============ teleconsultations (TEL-01, D-03) ============
-- Stores teleconsultation session metadata:
--   - external_link: Meet/Zoom/Jitsi URL (null = not yet set)
--   - consent_given + consent_given_at + consent_ip: CFO audit trail
--   - started_at + ended_at: session lifecycle timestamps
--   - status: agendada → em_andamento → concluida | cancelada
--   - deleted_at: LGPD soft delete (Lei 13.787/2018 — 20-year retention)
CREATE TABLE public.teleconsultations (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id         UUID        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  unit_id           UUID        REFERENCES public.units(id),           -- nullable: clinic-wide session
  appointment_id    UUID        REFERENCES public.appointments(id),    -- nullable: may not be linked to appointment
  patient_id        UUID        NOT NULL REFERENCES public.patients(id),
  professional_id   UUID        REFERENCES public.professionals(id),   -- FK Phase 11
  external_link     TEXT,                                               -- Meet/Zoom/Jitsi URL (D-03: video = external link)
  consent_given     BOOLEAN     NOT NULL DEFAULT false,                 -- CFO consent flag (TEL-01)
  consent_given_at  TIMESTAMPTZ,                                        -- when consent was given
  consent_ip        INET,                                               -- server-side IP capture (T-12-04 — set in Plan 04, never client-provided)
  status            TEXT        NOT NULL DEFAULT 'agendada'
                    CHECK (status IN ('agendada', 'em_andamento', 'concluida', 'cancelada')),
  started_at        TIMESTAMPTZ,                                        -- session start (em_andamento transition)
  ended_at          TIMESTAMPTZ,                                        -- session end (concluida transition)
  notes             TEXT,                                               -- session notes
  created_by        UUID        REFERENCES public.users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ                                         -- LGPD soft delete
);

-- Mandatory indexes (CLAUDE.md: index every clinic_id + unit_id)
CREATE INDEX idx_teleconsultations_clinic  ON public.teleconsultations(clinic_id);
CREATE INDEX idx_teleconsultations_patient ON public.teleconsultations(patient_id);
CREATE INDEX idx_teleconsultations_appt    ON public.teleconsultations(appointment_id)
  WHERE appointment_id IS NOT NULL;
CREATE INDEX idx_teleconsultations_unit    ON public.teleconsultations(unit_id)
  WHERE unit_id IS NOT NULL;

-- ============ soap_records (TEL-02) ============
-- Stores structured SOAP notes generated from teleconsultation sessions.
-- SEPARATE from:
--   - medical_records (free-text: diagnosis, treatment_plan, prescription)
--   - dental_records (FDI tooth-by-tooth odontogram status)
-- Linked to appointments (optional) and teleconsultations (optional),
-- allowing SOAP notes for both in-person and remote visits.
-- NOTE: deleted_at for LGPD soft delete (clinical health PII per Lei 13.787/2018).
CREATE TABLE public.soap_records (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id           UUID        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id          UUID        NOT NULL REFERENCES public.patients(id),
  appointment_id      UUID        REFERENCES public.appointments(id),            -- nullable: links to atendimento
  teleconsultation_id UUID        REFERENCES public.teleconsultations(id),       -- nullable: links to session (TEL-02)
  dentist_id          UUID        NOT NULL REFERENCES public.users(id),
  soap_subjective     TEXT,   -- S: queixa principal, sintomas relatados pelo paciente
  soap_objective      TEXT,   -- O: exame clínico, achados objetivos
  soap_assessment     TEXT,   -- A: avaliação/diagnóstico
  soap_plan           TEXT,   -- P: plano de tratamento/conduta
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at          TIMESTAMPTZ                                                 -- LGPD soft delete
);

-- Mandatory indexes (CLAUDE.md: index every clinic_id)
CREATE INDEX idx_soap_records_clinic   ON public.soap_records(clinic_id);
CREATE INDEX idx_soap_records_patient  ON public.soap_records(patient_id, created_at DESC);
CREATE INDEX idx_soap_records_telec    ON public.soap_records(teleconsultation_id)
  WHERE teleconsultation_id IS NOT NULL;
CREATE INDEX idx_soap_records_appt     ON public.soap_records(appointment_id)
  WHERE appointment_id IS NOT NULL;
