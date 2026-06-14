-- =============================================================================
-- Migration: 20260614000700_operational_unit_id.sql
-- Phase: 07-sistema-multiunidade-pap-is / Plan 02
-- Purpose: Add unit_id FK to the three already-populated operational tables
--          (appointments, charges, receivables) with zero data breakage.
--
-- CRITICAL ORDER — Pitfall 2 (07-RESEARCH.md) — T-07-07 mitigation:
--   Step 1: ADD COLUMN unit_id NULLABLE (no NOT NULL yet — existing rows have NULL)
--   Step 2: UPDATE backfill from the clinic's default unit (is_default = true)
--   Step 3: ALTER COLUMN unit_id SET NOT NULL (only safe AFTER backfill)
--   NEVER add NOT NULL on the ADD COLUMN line — migration fails on existing rows.
--
-- Scoping note: This migration ONLY adds the column + index so SYS-05 filtering
-- can be built on it. Unit-level RLS enforcement on operational rows is a
-- future-phase concern; existing tenant-scoped RLS policies are NOT modified here.
-- (Existing policies on appointments, charges, receivables remain unchanged.)
--
-- Pattern 7 from 07-RESEARCH.md.
-- =============================================================================

-- ============ appointments ============

-- Step 1: Add nullable (Pitfall 2 — NOT NULL AFTER backfill, not before)
ALTER TABLE public.appointments
  ADD COLUMN unit_id UUID REFERENCES public.units(id);

-- Step 2: Backfill from the appointment's clinic default unit (tenant_id = clinic_id)
UPDATE public.appointments a
  SET unit_id = u.id
  FROM public.units u
  WHERE u.clinic_id = a.tenant_id
    AND u.is_default = true
    AND a.unit_id IS NULL;

-- Step 3: Enforce NOT NULL now that all rows have a value
ALTER TABLE public.appointments
  ALTER COLUMN unit_id SET NOT NULL;

-- Index: mandatory — clinic_id + unit_id indexed on every tenant-scoped table (CLAUDE.md)
CREATE INDEX idx_appointments_unit_id ON public.appointments(unit_id);


-- ============ charges ============

-- Step 1: Add nullable
ALTER TABLE public.charges
  ADD COLUMN unit_id UUID REFERENCES public.units(id);

-- Step 2: Backfill from the charge's clinic default unit
UPDATE public.charges c
  SET unit_id = u.id
  FROM public.units u
  WHERE u.clinic_id = c.tenant_id
    AND u.is_default = true
    AND c.unit_id IS NULL;

-- Step 3: Enforce NOT NULL
ALTER TABLE public.charges
  ALTER COLUMN unit_id SET NOT NULL;

CREATE INDEX idx_charges_unit_id ON public.charges(unit_id);


-- ============ receivables ============

-- Step 1: Add nullable
ALTER TABLE public.receivables
  ADD COLUMN unit_id UUID REFERENCES public.units(id);

-- Step 2: Backfill from the receivable's clinic default unit (tenant_id = clinic_id)
UPDATE public.receivables r
  SET unit_id = u.id
  FROM public.units u
  WHERE u.clinic_id = r.tenant_id
    AND u.is_default = true
    AND r.unit_id IS NULL;

-- Step 3: Enforce NOT NULL
ALTER TABLE public.receivables
  ALTER COLUMN unit_id SET NOT NULL;

CREATE INDEX idx_receivables_unit_id ON public.receivables(unit_id);
