-- Phase 8 Plan 02: RLS policies for document_templates + documents + document_versions
-- DOC-01 (template read/write), DOC-02 (sign), DOC-03 (INSERT-only immutability)
-- Security: T-08-05 (immutability), T-08-06 (column REVOKE), T-08-07 (cross-tenant)
-- Pattern: USING + WITH CHECK via get_my_tenant_id() / get_my_role() (project convention)
-- Pattern: INSERT-only on document_versions mirrors dental_records (20260605000200_clinical_rls.sql)

-- ─── document_templates ───────────────────────────────────────────────────────────
-- Config-level resource: admin/superadmin/ti manage; all tenant members can read active templates.

ALTER TABLE public.document_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "doc_templates_tenant_read" ON public.document_templates
  FOR SELECT USING (clinic_id = get_my_tenant_id() AND deleted_at IS NULL);

CREATE POLICY "doc_templates_admin_write" ON public.document_templates
  FOR ALL
  USING (
    clinic_id = get_my_tenant_id()
    AND get_my_role() IN ('admin', 'superadmin', 'ti')
  )
  WITH CHECK (
    clinic_id = get_my_tenant_id()
    AND get_my_role() IN ('admin', 'superadmin', 'ti')
  );

-- ─── documents ────────────────────────────────────────────────────────────────────
-- All authenticated staff may read tenant documents; dentist/receptionist/admin may create.

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "documents_tenant_read" ON public.documents
  FOR SELECT USING (clinic_id = get_my_tenant_id());

CREATE POLICY "documents_staff_write" ON public.documents
  FOR ALL
  USING (
    clinic_id = get_my_tenant_id()
    AND get_my_role() IN ('admin', 'superadmin', 'dentist', 'receptionist', 'ti')
  )
  WITH CHECK (
    clinic_id = get_my_tenant_id()
    AND get_my_role() IN ('admin', 'superadmin', 'dentist', 'receptionist', 'ti')
  );

-- ─── document_versions ────────────────────────────────────────────────────────────
-- APPEND-ONLY contract (D-03 / T-08-05):
--   SELECT: all tenant members may read version metadata.
--   INSERT: eligible staff only (WITH CHECK enforced).
--   NO UPDATE policy: signed versions can never be altered.
--   NO DELETE policy: version history is perpetually preserved.
--
-- This is intentional and mirrors the dental_records INSERT-only pattern:
--   dental_records has FOR INSERT WITH CHECK only — no FOR UPDATE, no FOR DELETE.

ALTER TABLE public.document_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "doc_versions_tenant_read" ON public.document_versions
  FOR SELECT USING (clinic_id = get_my_tenant_id());

-- INSERT-only: all eligible staff may create new versions (drafts or signed).
-- Never UPDATE or DELETE — immutability is enforced by the absence of those policies.
CREATE POLICY "doc_versions_staff_insert" ON public.document_versions
  FOR INSERT
  WITH CHECK (
    clinic_id = get_my_tenant_id()
    AND get_my_role() IN ('admin', 'superadmin', 'dentist', 'receptionist', 'ti')
  );

-- ── No FOR UPDATE policy on document_versions — signed versions are forever immutable ──
-- ── No FOR DELETE policy on document_versions — version history is never deleted ──

-- ─── Column-level REVOKE (T-08-06 / Pitfall 8) ───────────────────────────────────
-- storage_path reveals bucket structure; cert_pem is sensitive at column level.
-- Restrict SELECT of these two columns from standard authenticated/anon roles.
-- Service role (createAdminClient) bypasses column-level privileges (PostgreSQL design).
REVOKE SELECT (storage_path, cert_pem) ON public.document_versions FROM authenticated, anon;
