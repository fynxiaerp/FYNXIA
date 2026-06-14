-- =============================================================================
-- Migration: 20260614000100_units_table.sql
-- Phase: 07-sistema-multiunidade-pap-is / Plan 02
-- Purpose: Create `units` (filiais) table under `clinics` (rede/tenant).
--          Each clinic becomes a rede; this table holds its filiais.
--          Backfill: every existing v1 clinic gets exactly 1 default unit (zero breakage).
-- SYS-01: Admin cadastra empresa e múltiplas unidades da rede.
-- SEC:    TIMESTAMPTZ on all timestamps; soft delete via deleted_at.
-- INDEXES: clinic_id, (clinic_id, slug) unique, cnpj partial unique,
--          (clinic_id) WHERE is_default = true (one default per clinic).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- units: filiais de uma rede odontológica (tenant = clinic)
-- ---------------------------------------------------------------------------
CREATE TABLE public.units (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id   UUID        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  cnpj        TEXT,
  slug        TEXT        NOT NULL,
  phone       TEXT,
  address     TEXT,
  is_default  BOOLEAN     NOT NULL DEFAULT false,
  ativo       BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ                         -- soft delete (LGPD)
);

-- Index: tenant-scoped lookups (mandatory — CLAUDE.md: index every clinic_id)
CREATE INDEX idx_units_clinic_id ON public.units(clinic_id);

-- Unique slug per clinic (URL-friendly unit identifier within the rede)
CREATE UNIQUE INDEX idx_units_clinic_slug ON public.units(clinic_id, slug);

-- Partial unique: CNPJ unique across all units (NULL allowed — not all filiais have own CNPJ)
CREATE UNIQUE INDEX idx_units_cnpj ON public.units(cnpj) WHERE cnpj IS NOT NULL;

-- Partial unique: only one default unit per clinic (enforced at index level)
CREATE UNIQUE INDEX idx_units_one_default ON public.units(clinic_id) WHERE is_default = true;

-- ---------------------------------------------------------------------------
-- Dedicated audit trigger for units
-- units uses clinic_id (not tenant_id), so we cannot reuse audit_table_changes()
-- which accesses NEW.tenant_id. This mirrors audit_clinics_changes() pattern.
-- Source: 20260604000300_clinics_users_phase1.sql (audit_clinics_changes)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.audit_units_changes()
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

CREATE TRIGGER audit_units
  AFTER INSERT OR UPDATE OR DELETE ON public.units
  FOR EACH ROW EXECUTE FUNCTION public.audit_units_changes();

-- ---------------------------------------------------------------------------
-- Backfill: migrate every existing v1 clinic to a rede with 1 default unit.
-- Zero breakage: only inserts if the clinic has no unit yet.
-- Slug: '<clinic-slug>-principal' (guaranteed unique since clinic slug is unique).
-- Pattern 7 from 07-RESEARCH.md.
-- ---------------------------------------------------------------------------
INSERT INTO public.units (clinic_id, name, slug, is_default, ativo)
SELECT
  c.id,
  c.name || ' (Principal)',
  c.slug || '-principal',
  true,
  true
FROM public.clinics c
WHERE c.deleted_at IS NULL;
