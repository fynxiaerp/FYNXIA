-- Phase 8 Plan 02: private 'documents-pdf' Supabase Storage bucket
-- DOC-02 (signed PDF storage), DOC-03 (immutable signed PDF archive)
-- Security: T-08-06 — private bucket; service-role (createAdminClient) is sole accessor.
-- Pattern mirrors icp-certificates bucket (20260614000500_certificates.sql).

INSERT INTO storage.buckets (id, name, public)
VALUES ('documents-pdf', 'documents-pdf', false)
ON CONFLICT (id) DO NOTHING;

-- No storage.objects RLS policies added here intentionally:
-- service role bypasses RLS entirely — createAdminClient() is the sole reader/writer.
-- Signed PDFs are served via createSignedUrl (TTL-limited) in Server Actions, never via
-- public URL. Path: {clinic_id}/{document_id}/{version_id}.pdf
