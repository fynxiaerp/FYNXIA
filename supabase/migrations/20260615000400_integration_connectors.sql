-- Phase 9 Plan 02: integration_connectors table + index + RLS + seed
-- Security: T-09-03 (Information Disclosure) — credential_enc is AES-256-GCM via src/lib/crypto.ts;
--           REVOKE SELECT on credential_enc is in migration 20260615000600_integration_revoke.sql.
-- Pattern: USING + WITH CHECK via get_my_tenant_id() / get_my_role() (existing RLS convention).
-- clinic_id is NULLABLE to support system-level sentinel rows (Asaas/WhatsApp/email env-var connectors).

-- ============ integration_connectors table (INT-01) ============

CREATE TABLE public.integration_connectors (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id      UUID                 REFERENCES public.clinics(id) ON DELETE CASCADE,  -- NULLABLE: system sentinel rows (asaas/whatsapp/email env-var creds)
  type           TEXT        NOT NULL CHECK (type IN ('asaas','whatsapp','email','nfse','banco','tiss')),
  config         JSONB       NOT NULL DEFAULT '{}'::jsonb,   -- NON-sensitive metadata only (endpoint URLs, template ids, phone)
  credential_enc TEXT,                                        -- AES-256-GCM via crypto.ts (iv:authTag:ciphertext); NULL for placeholder rows
  status         TEXT        NOT NULL DEFAULT 'disabled' CHECK (status IN ('enabled','disabled')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_integration_connectors_clinic ON public.integration_connectors(clinic_id);

-- Prevent duplicate connector of same type per clinic; partial unique indexes because NULLs are distinct in Postgres
CREATE UNIQUE INDEX uq_integration_connectors_clinic_type ON public.integration_connectors(clinic_id, type) WHERE clinic_id IS NOT NULL;
CREATE UNIQUE INDEX uq_integration_connectors_system_type ON public.integration_connectors(type) WHERE clinic_id IS NULL;

-- ============ RLS — integration_connectors ============

ALTER TABLE public.integration_connectors ENABLE ROW LEVEL SECURITY;

-- Tenant members read their own rows (system sentinel rows with clinic_id IS NULL are NOT
-- tenant-visible via this policy — they are read server-side only via createAdminClient).
CREATE POLICY "integration_connectors_tenant_read" ON public.integration_connectors
  FOR SELECT USING (clinic_id = get_my_tenant_id());

-- admin/superadmin/ti may write connector rows for their own tenant only.
-- Mirrors certificates_admin_write (Phase 7): both USING and WITH CHECK on tenant + role.
CREATE POLICY "integration_connectors_admin_write" ON public.integration_connectors
  FOR ALL
  USING (
    clinic_id = get_my_tenant_id()
    AND get_my_role() IN ('admin', 'superadmin', 'ti')
  )
  WITH CHECK (
    clinic_id = get_my_tenant_id()
    AND get_my_role() IN ('admin', 'superadmin', 'ti')
  );

-- ============ Seed — system-level placeholder connectors ============
-- clinic_id NULL, status disabled: hub logging works before any clinic registers DB credentials.
-- Existing env-var creds remain the live auth; DB creds are future opt-in per clinic.
-- ON CONFLICT DO NOTHING: safe to re-run (idempotent via uq_integration_connectors_system_type).

INSERT INTO public.integration_connectors (clinic_id, type, status)
VALUES
  (NULL, 'asaas',    'disabled'),
  (NULL, 'whatsapp', 'disabled'),
  (NULL, 'email',    'disabled')
ON CONFLICT DO NOTHING;
