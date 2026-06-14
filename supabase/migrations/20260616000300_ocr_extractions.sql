-- Phase 10 Plan 02: ocr_extractions — OCR review queue (OCR-02)
-- Stores AI-extracted fields from documents for human review before committing.
-- LGPD: deleted_at soft-delete — extracted_fields may contain PII (CPF, RG) per OCR pilot.
-- RLS: USING + WITH CHECK on ALL policy (T-10-07 Tampering mitigation).

CREATE TABLE public.ocr_extractions (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id         UUID         NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  created_by        UUID         NOT NULL REFERENCES public.users(id),
  source_filename   TEXT,
  extracted_fields  JSONB        NOT NULL,             -- {field: {value, confidence}}
  min_confidence    NUMERIC(4,3) NOT NULL,             -- min across all fields (threshold tracking)
  status            TEXT         NOT NULL DEFAULT 'pending_review'
                    CHECK (status IN ('pending_review','approved','committed','rejected')),
  reviewed_by       UUID         REFERENCES public.users(id),
  reviewed_at       TIMESTAMPTZ,
  target_table      TEXT,                              -- pilot: 'patients'
  target_id         UUID,                              -- set after commit
  deleted_at        TIMESTAMPTZ,                       -- soft delete (LGPD: extracted RG/CPF may be PII)
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_ocr_extractions_clinic ON public.ocr_extractions(clinic_id);
CREATE INDEX idx_ocr_extractions_status ON public.ocr_extractions(clinic_id, status);

ALTER TABLE public.ocr_extractions ENABLE ROW LEVEL SECURITY;

-- Tenant members read their clinic's OCR extractions
CREATE POLICY "ocr_extractions_tenant_read" ON public.ocr_extractions
  FOR SELECT USING (clinic_id = get_my_tenant_id());

-- Write (INSERT + UPDATE + DELETE): tenant-scoped USING + WITH CHECK (T-10-07)
CREATE POLICY "ocr_extractions_tenant_write" ON public.ocr_extractions
  FOR ALL
  USING (clinic_id = get_my_tenant_id())
  WITH CHECK (clinic_id = get_my_tenant_id());
