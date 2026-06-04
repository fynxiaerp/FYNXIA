-- Phase 1: Rename tenants to clinics + add registration columns
-- D-02: public.clinics is the canonical clinic entity; users.tenant_id references clinics(id)

-- Step 1: Rename the table (PG auto-updates FKs and RLS policy associations)
ALTER TABLE public.tenants RENAME TO clinics;

-- Step 2: Rename index (indexes are NOT auto-renamed)
ALTER INDEX idx_tenants_slug RENAME TO idx_clinics_slug;

-- Step 3: Rename RLS policies for naming consistency
ALTER POLICY "tenants_own_record" ON public.clinics RENAME TO "clinics_own_record";
ALTER POLICY "tenants_admin_update" ON public.clinics RENAME TO "clinics_admin_update";

-- Step 4: Add Phase 1 registration columns (D-01)
ALTER TABLE public.clinics
  ADD COLUMN cnpj      TEXT,
  ADD COLUMN phone     TEXT,
  ADD COLUMN address   TEXT,
  ADD COLUMN specialty TEXT,
  ADD COLUMN logo_url  TEXT;

-- Step 5: Unique CNPJ/CPF document constraint (partial — NULL allowed pre-entry; Pitfall 6)
CREATE UNIQUE INDEX idx_clinics_cnpj ON public.clinics(cnpj) WHERE cnpj IS NOT NULL;

-- Step 6: Re-assert SECURITY DEFINER functions to guarantee bodies reference public.users (not tenants)
-- (defensive — Pitfall 1: PG does not rewrite function body text on table rename)
CREATE OR REPLACE FUNCTION public.get_my_tenant_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT tenant_id FROM public.users WHERE id = auth.uid() $$;
REVOKE EXECUTE ON FUNCTION public.get_my_tenant_id() FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT role FROM public.users WHERE id = auth.uid() $$;
REVOKE EXECUTE ON FUNCTION public.get_my_role() FROM PUBLIC;
