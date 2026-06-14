-- Phase 8 Plan 02: document_templates + documents + document_versions tables
-- DOC-01 (template engine), DOC-02 (ICP signing), DOC-03 (append-only versioning)
-- Security: RLS in next migration (20260615000200); column-level REVOKE also applied there.
-- Pattern: mirrors v1 dental_records / anamneses INSERT-only + Phase 7 certificates table.

-- ─── document_templates ──────────────────────────────────────────────────────────
-- Config-level resource: shared across the clinic, editable by admin only.
-- Contains markdown/rich-text content with {{variable}} placeholders (D-02).
-- Template content itself is NOT patient PII (admin-authored boilerplate); filled
-- document content (document_versions.content) may be encrypted (is_content_encrypted).

CREATE TABLE public.document_templates (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id    UUID        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name         TEXT        NOT NULL,
  category     TEXT        NOT NULL,   -- 'declaracao' | 'contrato' | 'autorizacao' | 'outro'
  content      TEXT        NOT NULL,   -- markdown/rich-text with {{var}} placeholders
  variables    TEXT[]      NOT NULL DEFAULT '{}',  -- detected variable names (cache)
  is_active    BOOLEAN     NOT NULL DEFAULT true,
  created_by   UUID        REFERENCES public.users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at   TIMESTAMPTZ             -- soft delete (LGPD)
);

CREATE INDEX idx_document_templates_clinic    ON public.document_templates(clinic_id);
CREATE INDEX idx_document_templates_category  ON public.document_templates(clinic_id, category);
CREATE INDEX idx_document_templates_active    ON public.document_templates(clinic_id, is_active)
  WHERE deleted_at IS NULL;

-- ─── documents ────────────────────────────────────────────────────────────────────
-- Document instance header (one per generated document).
-- status = 'draft' until signed; 'signed' is immutable (enforced via RLS on versions).
-- unit_id is nullable (Phase 7 multi-unit; not all documents are unit-specific — A4).

CREATE TABLE public.documents (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id        UUID        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  unit_id          UUID        REFERENCES public.units(id),         -- Phase 7 multi-unit (nullable)
  template_id      UUID        REFERENCES public.document_templates(id),
  patient_id       UUID        REFERENCES public.patients(id),      -- nullable (not all docs patient-facing)
  category         TEXT        NOT NULL,
  status           TEXT        NOT NULL DEFAULT 'draft'
                               CHECK (status IN ('draft', 'signed')),
  current_version  INTEGER     NOT NULL DEFAULT 1,
  created_by       UUID        REFERENCES public.users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at       TIMESTAMPTZ           -- soft delete (LGPD)
);

CREATE INDEX idx_documents_clinic   ON public.documents(clinic_id);
CREATE INDEX idx_documents_unit     ON public.documents(unit_id)     WHERE unit_id IS NOT NULL;
CREATE INDEX idx_documents_patient  ON public.documents(patient_id)  WHERE patient_id IS NOT NULL;
CREATE INDEX idx_documents_status   ON public.documents(clinic_id, status);

-- ─── document_versions ────────────────────────────────────────────────────────────
-- Append-only immutability: INSERT-only RLS (no UPDATE, no DELETE policy — mirrors
-- dental_records pattern from 20260605000200_clinical_rls.sql).
-- Signed versions are forever immutable (D-03 / T-08-05).
--
-- LGPD: filled content (vars replaced) may contain patient PII (CPF, full name).
-- is_content_encrypted = true signals content was AES-256-GCM encrypted via crypto.ts.
-- DOC-03 Open Question 1 resolved: encrypt filled content by default.
--
-- storage_path and cert_pem are column-REVOKED in 20260615000200_document_rls.sql (T-08-06).

CREATE TABLE public.document_versions (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id      UUID        NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  clinic_id        UUID        NOT NULL REFERENCES public.clinics(id)   ON DELETE CASCADE,
  version_number   INTEGER     NOT NULL,
  content          TEXT        NOT NULL,   -- filled template content (vars replaced; may be AES-encrypted)
  is_content_encrypted BOOLEAN NOT NULL DEFAULT true,  -- DOC-03/LGPD: AES-256-GCM via crypto.ts
  content_hash     TEXT        NOT NULL,   -- SHA-256 hex of PDF bytes (for verification / T-08-04)
  storage_path     TEXT,                   -- path in documents-pdf bucket (null until signed)
  signature        TEXT,                   -- RSA base64 signature (null = unsigned draft)
  cert_pem         TEXT,                   -- PEM of signing cert (for offline verification — A2)
  signer_cn        TEXT,                   -- cert subject CN (display / audit)
  cert_thumbprint  TEXT,                   -- SHA-1 thumbprint 40-char hex (display/correlation)
  cert_not_after   TEXT,                   -- ISO cert expiry at signing time
  signed_at        TIMESTAMPTZ,            -- server timestamp of signing
  signed_by        UUID        REFERENCES public.users(id),
  supersedes_id    UUID        REFERENCES public.document_versions(id), -- previous version link
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (document_id, version_number)   -- DOC-03: version uniqueness per document
);

CREATE INDEX idx_doc_versions_document ON public.document_versions(document_id, version_number);
CREATE INDEX idx_doc_versions_clinic   ON public.document_versions(clinic_id);
CREATE INDEX idx_doc_versions_signed   ON public.document_versions(clinic_id, signed_at)
  WHERE signed_at IS NOT NULL;
