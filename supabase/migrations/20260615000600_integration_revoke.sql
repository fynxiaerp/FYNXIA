-- Phase 9 Plan 02: column-level REVOKE on integration_connectors.credential_enc
-- Defense-in-depth: even a select('*') by an authenticated tenant member cannot read the secret.
-- Service role (createAdminClient) bypasses column privileges, so the action/worker decrypt path
-- is completely unaffected (PostgreSQL design — same pattern as Phase 7 certificates).
--
-- This mirrors supabase/migrations/20260614000900_certificates_revoke_secrets.sql exactly.
-- T-09-03 (Information Disclosure): both REVOKE (Postgres-level) + Omit<> (app-level) are applied.

REVOKE SELECT (credential_enc)
  ON public.integration_connectors
  FROM authenticated, anon;
