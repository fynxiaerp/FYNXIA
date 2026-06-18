-- =============================================================================
-- Migration: 20260618000200_clinical_documents_rls.sql
-- Phase: 12-receitu-rio-teleodontologia / Plan 02
-- Purpose: RLS policies for clinical_documents + document_seq_counters + medications
--
-- Security:
--   T-12-06 cross-tenant clinical document read → USING clinic_id = get_my_tenant_id()
--   T-12-07 non-clinical role writing prescriptions → role gate IN ('admin','superadmin','dentist')
--   T-12-08 storage_path / cert_pem leak → REVOKE applied in previous migration
--   Pitfall 4: medications is GLOBAL reference — NO get_my_tenant_id() filter
--
-- Pattern: USING + WITH CHECK via get_my_tenant_id() / get_my_role() (project convention)
-- NOTE: db push happens in Plan 12-05 (BLOCKING step) — NOT here.
-- =============================================================================

-- ─── clinical_documents ───────────────────────────────────────────────────────
-- SELECT: any tenant staff member may read their clinic's clinical documents.
-- ALL write (INSERT/UPDATE/DELETE): restricted to admin, superadmin, dentist roles.
-- Immutability of signed documents enforced at the Server Action layer (.is('signature',null) guard).

ALTER TABLE public.clinical_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clinical_docs_tenant_read" ON public.clinical_documents
  FOR SELECT
  USING (
    clinic_id = get_my_tenant_id()
    AND deleted_at IS NULL
  );

CREATE POLICY "clinical_docs_clinical_write" ON public.clinical_documents
  FOR ALL
  USING (
    clinic_id = get_my_tenant_id()
    AND get_my_role() IN ('admin', 'superadmin', 'dentist')
  )
  WITH CHECK (
    clinic_id = get_my_tenant_id()
    AND get_my_role() IN ('admin', 'superadmin', 'dentist')
  );

-- ─── document_seq_counters ────────────────────────────────────────────────────
-- The next_doc_number() function is SECURITY DEFINER and bypasses RLS for the
-- upsert — counters are never directly mutated by clients via SQL.
-- Policies here restrict direct client SELECT/write for defense-in-depth.

ALTER TABLE public.document_seq_counters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "doc_seq_counters_tenant_read" ON public.document_seq_counters
  FOR SELECT
  USING (clinic_id = get_my_tenant_id());

CREATE POLICY "doc_seq_counters_clinical_write" ON public.document_seq_counters
  FOR ALL
  USING (
    clinic_id = get_my_tenant_id()
    AND get_my_role() IN ('admin', 'superadmin', 'dentist')
  )
  WITH CHECK (
    clinic_id = get_my_tenant_id()
    AND get_my_role() IN ('admin', 'superadmin', 'dentist')
  );

-- ─── medications ──────────────────────────────────────────────────────────────
-- GLOBAL reference table — NO clinic_id column (Pitfall 4).
-- SELECT: any authenticated user may read active medications (global reference data).
-- No tenant filter — medications are shared across all clinics.
-- ALL write: restricted to superadmin only (curated reference; no per-tenant writes).

ALTER TABLE public.medications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "medications_read" ON public.medications
  FOR SELECT
  USING (active = true);

CREATE POLICY "medications_superadmin_write" ON public.medications
  FOR ALL
  USING (get_my_role() = 'superadmin')
  WITH CHECK (get_my_role() = 'superadmin');
