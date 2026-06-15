-- Phase 11 Plan 03: appointments — resource_id FK + presence_status + 4 checkin timestamps
--
-- SACRED CONSTRAINT GUARD (T-11-10 / Pitfall 1 / Pitfall 8):
--   presence_status is a SEPARATE new column — it MUST NOT be folded into the existing
--   `status` column. The existing `status` CHECK ('agendado','confirmado','em_atendimento',
--   'concluido','cancelado') and the EXCLUDE GIST `no_overlap` are intentionally UNTOUCHED.
--   This file must not drop the no_overlap constraint or ALTER COLUMN status — any
--   GIST DDL. Resource conflict is application-level only (no resource GIST this phase —
--   see RESEARCH Pattern 3 / 11-RESEARCH.md §Open Questions Q1).
--
-- NULL semantics (ADD COLUMN nullable pattern from 20260614000700):
--   All new columns are legitimately nullable — NO backfill, NO SET NOT NULL.
--   resource_id=NULL: appointment has no resource reservation (optional).
--   presence_status=NULL: patient has not yet arrived (pre-checkin state).
--   *_at=NULL: event has not occurred yet.

-- 1. Add resource_id nullable FK (RES-02)
ALTER TABLE public.appointments
  ADD COLUMN resource_id UUID REFERENCES public.resources(id);

CREATE INDEX idx_appointments_resource_id ON public.appointments(resource_id);

-- 2. Add presence_status (SEPARATE column — NOT merged into status) + 4 timestamps (RES-03)
ALTER TABLE public.appointments
  ADD COLUMN presence_status TEXT
    CHECK (presence_status IN ('aguardando', 'chamado', 'em_atendimento', 'finalizado')),
  ADD COLUMN arrived_at   TIMESTAMPTZ,   -- patient checks in at reception
  ADD COLUMN called_at    TIMESTAMPTZ,   -- receptionist calls patient name
  ADD COLUMN started_at   TIMESTAMPTZ,   -- dentist starts treatment
  ADD COLUMN finished_at  TIMESTAMPTZ;   -- treatment ends
