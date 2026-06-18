-- =============================================================================
-- Migration: 20260618000300_clinical_documents_bucket.sql
-- Phase: 12-receitu-rio-teleodontologia / Plan 02
-- Purpose: Private 'clinical-documents-pdf' Supabase Storage bucket (RX-03)
--
-- Security: T-12-08 — private bucket; service-role (createAdminClient) is sole accessor.
-- Pattern: mirrors documents_bucket.sql (20260615000300) — same policy shape.
-- Storage path convention: {clinic_id}/{clinical_document_id}.pdf
--
-- No storage.objects RLS policies added here intentionally:
-- service role bypasses RLS entirely — createAdminClient() is the sole reader/writer.
-- Signed PDFs served via createSignedUrl (TTL-limited) in Server Actions, never via
-- public URL (mirrors documents-pdf bucket behaviour from Phase 8).
--
-- NOTE: db push happens in Plan 12-05 (BLOCKING step) — NOT here.
-- =============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('clinical-documents-pdf', 'clinical-documents-pdf', false)
ON CONFLICT (id) DO NOTHING;
