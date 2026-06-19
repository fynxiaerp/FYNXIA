-- =============================================================================
-- Migration: 20260619000200_sterilization_rls.sql
-- Phase: 13-esteriliza-o-cme-laborat-rio-de-pr-tese / Plan 02
-- Purpose: RLS for sterilization_cycles + kit_usages (T-13-04, T-13-05)
--
-- T-13-04 Information Disclosure: clinic_id = get_my_tenant_id() USING + WITH CHECK
--   on both tables — cross-tenant isolation.
-- T-13-05 Elevation of Privilege: write policy gated to clinical team roles:
--   admin, superadmin, dentist, receptionist.
--
-- NOTE: The patient-safety BLOCK (non-aprovado/vencido cycles) is NOT an RLS rule.
--   RLS cannot express validade-vs-today cleanly across concurrent requests.
--   The authoritative block guard is in the Server Action (Plan 04) via isCycleUsable.
--   RLS here is the tenant boundary only.
--
-- Pattern: mirrors resources_rls.sql with separate SELECT + ALL-write policies.
-- RLS helpers (SECURITY DEFINER): get_my_tenant_id() → caller clinic UUID;
--   get_my_role() → caller role TEXT.
-- =============================================================================

-- ─── sterilization_cycles ────────────────────────────────────────────────────

ALTER TABLE public.sterilization_cycles ENABLE ROW LEVEL SECURITY;

-- All authenticated clinic members may read their clinic's sterilization cycles
CREATE POLICY "sterilization_cycles_select"
  ON public.sterilization_cycles
  FOR SELECT
  USING (clinic_id = get_my_tenant_id());

-- Write operations: clinical team roles (admin, superadmin, dentist, receptionist)
-- USING + WITH CHECK on both sides — CLAUDE.md requirement.
-- Receptionist/auxiliar is included as they operate the autoclave and register cycles.
-- The authoritative role gate is also re-checked in the Server Action (Plan 04).
CREATE POLICY "sterilization_cycles_write"
  ON public.sterilization_cycles
  FOR ALL
  USING (
    clinic_id = get_my_tenant_id()
    AND get_my_role() IN ('admin', 'superadmin', 'dentist', 'receptionist')
  )
  WITH CHECK (
    clinic_id = get_my_tenant_id()
    AND get_my_role() IN ('admin', 'superadmin', 'dentist', 'receptionist')
  );

-- ─── kit_usages ──────────────────────────────────────────────────────────────

ALTER TABLE public.kit_usages ENABLE ROW LEVEL SECURITY;

-- All authenticated clinic members may read their clinic's kit usage records
CREATE POLICY "kit_usages_select"
  ON public.kit_usages
  FOR SELECT
  USING (clinic_id = get_my_tenant_id());

-- Write operations: clinical team roles (admin, superadmin, dentist, receptionist)
-- USING + WITH CHECK on both sides — CLAUDE.md requirement.
CREATE POLICY "kit_usages_write"
  ON public.kit_usages
  FOR ALL
  USING (
    clinic_id = get_my_tenant_id()
    AND get_my_role() IN ('admin', 'superadmin', 'dentist', 'receptionist')
  )
  WITH CHECK (
    clinic_id = get_my_tenant_id()
    AND get_my_role() IN ('admin', 'superadmin', 'dentist', 'receptionist')
  );
