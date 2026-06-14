-- =============================================================================
-- Migration: 20260614000400_role_expansion.sql
-- Phase: 07-sistema-multiunidade-pap-is / Plan 02
-- Purpose: Expand the role CHECK constraint on BOTH public.users AND
--          public.invitations from 5 values to 11 values (adding 6 new roles).
--
-- ROLE-01: System supports 6 additional roles: dpo, auditor, socio, ti,
--          implantacao, aluno (in addition to the 5 v1 roles).
-- Pitfall 3 (07-RESEARCH.md): DROP CONSTRAINT IF EXISTS used for safety in case
--          the auto-generated constraint name differs from the default.
--          Verify actual name before push with:
--          SELECT conname FROM pg_constraint
--          WHERE conrelid = 'public.users'::regclass AND contype = 'c';
-- Pitfall 7 (07-RESEARCH.md): BOTH tables (users AND invitations) must be updated
--          in the same migration. Updating only users causes invitations to reject
--          new role values at insert time (constraint violation on invite creation).
-- Pattern 2 (07-RESEARCH.md): TEXT CHECK constraint (not enum) — safe for
--          transactional DDL; ALTER TYPE ADD VALUE is non-transactional in PG 12–17.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Expand users.role CHECK (v1 name: users_role_check — inline constraint)
-- ---------------------------------------------------------------------------
-- NOTE: If this migration fails with "constraint does not exist", query the actual
-- name: SELECT conname FROM pg_constraint WHERE conrelid='public.users'::regclass
-- AND contype='c'; Then replace 'users_role_check' below with the actual name.
ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_role_check,
  ADD CONSTRAINT users_role_check
    CHECK (role IN (
      'admin', 'dentist', 'receptionist', 'patient', 'superadmin',
      'dpo', 'auditor', 'socio', 'ti', 'implantacao', 'aluno'
    ));

-- ---------------------------------------------------------------------------
-- 2. Expand invitations.role CHECK (Pitfall 7 — same 11-value list)
-- v1 name: invitations_role_check (from 20260604000300_clinics_users_phase1.sql:9)
-- ---------------------------------------------------------------------------
ALTER TABLE public.invitations
  DROP CONSTRAINT IF EXISTS invitations_role_check,
  ADD CONSTRAINT invitations_role_check
    CHECK (role IN (
      'admin', 'dentist', 'receptionist', 'patient', 'superadmin',
      'dpo', 'auditor', 'socio', 'ti', 'implantacao', 'aluno'
    ));
