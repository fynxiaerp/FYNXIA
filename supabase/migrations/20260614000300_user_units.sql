-- =============================================================================
-- Migration: 20260614000300_user_units.sql
-- Phase: 07-sistema-multiunidade-pap-is / Plan 02
-- Purpose: N:N assignment table `user_units` (user ↔ filial) + SECURITY DEFINER
--          helper `get_my_unit_ids()` + RLS on user_units + operational backfill.
--
-- D-04: Papéis de rede (admin/superadmin/socio/auditor/dpo/ti) → todas as unidades.
--       Papéis operacionais (dentist/receptionist/aluno) → unidades atribuídas.
-- T-07-04: user_units write RLS requires clinic_id = get_my_tenant_id()
--          in BOTH USING and WITH CHECK to prevent cross-tenant unit assignment.
-- T-07-05: get_my_unit_ids() network-role branch filters by get_my_tenant_id();
--          operational branch scoped to auth.uid() rows — no cross-tenant leak.
-- Pitfall 1: All three helpers (get_my_tenant_id, get_my_role, get_my_unit_ids) are
--            SECURITY DEFINER, terminating at auth.uid() — no RLS recursion possible.
-- Pattern 1 + Pattern 5 from 07-RESEARCH.md.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- user_units: N:N assignment (user ↔ unit within a rede)
-- clinic_id is denormalized here for fast RLS checks without joining units.
-- UNIQUE (user_id, unit_id): one assignment row per user-per-unit.
-- ---------------------------------------------------------------------------
CREATE TABLE public.user_units (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  unit_id    UUID        NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  clinic_id  UUID        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, unit_id)
);

-- Indexes: mandatory per CLAUDE.md — index clinic_id + unit_id on every junction table
CREATE INDEX idx_user_units_user_id   ON public.user_units(user_id);
CREATE INDEX idx_user_units_unit_id   ON public.user_units(unit_id);
CREATE INDEX idx_user_units_clinic_id ON public.user_units(clinic_id);

-- ---------------------------------------------------------------------------
-- RLS on user_units
-- All tenant members can see assignments within their rede.
-- Only admin/superadmin can create/modify/delete assignments.
-- T-07-04: BOTH USING + WITH CHECK enforce clinic_id = get_my_tenant_id().
-- ---------------------------------------------------------------------------
ALTER TABLE public.user_units ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_units_tenant_read" ON public.user_units
  FOR SELECT USING (clinic_id = get_my_tenant_id());

CREATE POLICY "user_units_admin_write" ON public.user_units
  FOR ALL
  USING (
    clinic_id = get_my_tenant_id()
    AND get_my_role() IN ('admin', 'superadmin')
  )
  WITH CHECK (
    clinic_id = get_my_tenant_id()
    AND get_my_role() IN ('admin', 'superadmin')
  );

-- ---------------------------------------------------------------------------
-- get_my_unit_ids(): returns UUID[] of units accessible to the current user.
-- Network roles → all active units for their rede (clinic).
-- Operational roles → only their assigned units from user_units.
-- STABLE: PostgreSQL caches result per transaction (O(1) per query, not per row).
-- SECURITY DEFINER: executes as definer, bypassing RLS on internal lookups.
-- SET search_path = public: prevents search_path injection (same as v1 pattern).
-- REVOKE EXECUTE FROM PUBLIC: only RLS policies (running as definer) may call this.
-- RLS usage: wrap in (SELECT get_my_unit_ids()) so PG caches once per statement.
-- Pattern 1 from 07-RESEARCH.md; modeled on get_my_tenant_id() (initial_schema.sql:97).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_my_unit_ids()
RETURNS UUID[]
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN get_my_role() IN ('admin', 'superadmin', 'socio', 'auditor', 'dpo', 'ti')
      -- Network roles: all active units for this rede
      THEN ARRAY(
        SELECT id FROM public.units
        WHERE clinic_id = get_my_tenant_id()
          AND deleted_at IS NULL
      )
    ELSE
      -- Operational roles: only units explicitly assigned to this user
      ARRAY(
        SELECT unit_id FROM public.user_units
        WHERE user_id = auth.uid()
      )
  END
$$;

-- Revoke public execution — called only by RLS policies internally
REVOKE EXECUTE ON FUNCTION public.get_my_unit_ids() FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- Backfill: assign every existing operational user (dentist/receptionist) to
-- their clinic's default unit. Mirrors the pattern in Pattern 7 (07-RESEARCH.md).
-- ON CONFLICT DO NOTHING: idempotent; safe to re-run.
-- ---------------------------------------------------------------------------
INSERT INTO public.user_units (user_id, unit_id, clinic_id)
SELECT
  u.id,
  un.id,
  u.tenant_id
FROM public.users u
JOIN public.units un ON un.clinic_id = u.tenant_id AND un.is_default = true
WHERE u.role IN ('dentist', 'receptionist')
  AND u.deleted_at IS NULL
ON CONFLICT (user_id, unit_id) DO NOTHING;
