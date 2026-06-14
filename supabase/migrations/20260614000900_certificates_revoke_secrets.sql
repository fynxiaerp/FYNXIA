-- Phase 7 fix WR-02: column-level REVOKE on certificates secret columns
-- Revokes SELECT privilege on cert_password_enc and storage_path from authenticated and anon
-- roles so that even a select('*') by an authenticated tenant member cannot return these fields.
--
-- Rationale: The RLS policy certificates_tenant_read grants FOR SELECT with no column
-- restriction, meaning any role with config-read access (e.g. dpo) could construct a direct
-- query and receive cert_password_enc and storage_path. This is defense-in-depth on top of
-- the application-layer column-list SELECT already enforced in getCertificate().
--
-- Service role bypasses column-level privileges (PostgreSQL design), so Phase 8 signing
-- logic that uses createAdminClient() is completely unaffected.
--
-- NOTE: `supabase db push` must be run by the operator to apply this migration to the
-- remote project. The orchestrator will invoke db push after this fix round.

REVOKE SELECT (cert_password_enc, storage_path)
  ON public.certificates
  FROM authenticated, anon;
