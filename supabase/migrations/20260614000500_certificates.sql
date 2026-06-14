-- Phase 7 Plan 03: certificates metadata table + private icp-certificates Storage bucket
-- Security: T-07-09 (Information Disclosure) — .pfx bytes in private bucket (never DB);
--           cert_password_enc is AES-256-GCM via src/lib/crypto.ts (iv:authTag:ciphertext format)
--           only metadata columns are tenant-scoped SELECT-able; path+password never leave server.
-- Pattern: USING + WITH CHECK via get_my_tenant_id() / get_my_role() (existing RLS convention)

-- ============ certificates table (SYS-02) ============

CREATE TABLE public.certificates (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id         UUID        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  subject_cn        TEXT        NOT NULL,
  cnpj              TEXT,                                   -- ICP-Brasil OID 2.16.76.1.3.3; null if absent
  cpf               TEXT,                                   -- ICP-Brasil OID 2.16.76.1.3.1; null if absent
  issuer_cn         TEXT,
  serial_number     TEXT,
  not_before        TIMESTAMPTZ NOT NULL,
  not_after         TIMESTAMPTZ NOT NULL,
  thumbprint_sha1   TEXT        NOT NULL,
  storage_path      TEXT        NOT NULL,   -- path inside icp-certificates bucket; NEVER exposed as public URL
  -- cert_password_enc: AES-256-GCM encrypted password (src/lib/crypto.ts format: iv:authTag:ciphertext)
  -- plaintext password is NEVER stored; decryption only occurs server-side for signing (Phase 8)
  cert_password_enc TEXT        NOT NULL,
  uploaded_by       UUID        REFERENCES public.users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ           -- soft delete; filter WHERE deleted_at IS NULL in queries
);

CREATE INDEX idx_certificates_clinic ON public.certificates(clinic_id);

-- ============ RLS — certificates ============

ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;

-- All tenant members can SELECT metadata rows (subject_cn, validity, thumbprint — NOT path/password)
-- The storage_path and cert_password_enc columns are present but access is further restricted
-- at the application layer: Server Actions use the admin client (service role) for any cert read.
CREATE POLICY "certificates_tenant_read" ON public.certificates
  FOR SELECT USING (clinic_id = get_my_tenant_id());

-- Only admin / superadmin / ti roles may INSERT, UPDATE, or DELETE certificates
CREATE POLICY "certificates_admin_write" ON public.certificates
  FOR ALL
  USING (
    clinic_id = get_my_tenant_id()
    AND get_my_role() IN ('admin', 'superadmin', 'ti')
  )
  WITH CHECK (
    clinic_id = get_my_tenant_id()
    AND get_my_role() IN ('admin', 'superadmin', 'ti')
  );

-- ============ icp-certificates private Storage bucket ============
-- public = false: no object can be accessed via a public URL.
-- Service role (createAdminClient) is the ONLY reader/writer — no Storage RLS SELECT policy needed.
-- Pattern: INSERT INTO storage.buckets (Research Pattern 6 / Open Question 1 resolution).

INSERT INTO storage.buckets (id, name, public)
VALUES ('icp-certificates', 'icp-certificates', false)
ON CONFLICT (id) DO NOTHING;

-- No storage.objects RLS policies added here intentionally:
-- service role bypasses RLS entirely — admin client is the sole accessor (D-02 / T-07-09).
