# Phase 12: Receituário & Teleodontologia - Research

**Researched:** 2026-06-18
**Domain:** Clinical documents (prescription/certificate/exam request), allergy alerting, teleconsultation session management, SOAP prontuário extension, ICP-Brasil signing reuse
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01 (Base de medicamentos):** Subconjunto curado (~100-200 itens) em tabela própria: medicamentos odontológicos comuns (analgésicos, AINEs, antibióticos, anestésicos locais, controle especial). Cada item carrega classe terapêutica + tag de alérgeno (ex: penicilina, AINE, dipirona, sulfa). Base cresce sob demanda; NÃO importar dataset DCB completo da ANVISA.
- **D-02 (RX-02):** Alerta suave NÃO-bloqueante ao emitir: casa nome/classe do medicamento contra (a) campo de alergia texto-livre do paciente (`patients.allergies`) + (b) flags da anamnese (`alergia_medicamento`, `alergia_anestesia`). Match textual tolerante (case/acento-insensível). Sem nova tabela estruturada de alérgenos nesta fase.
- **D-03 (TEL-01):** Vídeo = link externo (Meet/Zoom/Jitsi); FYNXIA não hospeda mídia. Registra consentimento CFO + início/fim + link + metadados.
- **D-04 (RX-01/03):** Documentos no escopo: receita simples, receita controle especial, atestado, solicitação de exame. Numeração sequencial por clínica + por tipo (atômica, sem corrida). Assinatura ICP reusa engine Fase 8. Flag `visible_no_portal`. UI do Portal = Fase 20.
- **TEL-02:** Teleconsulta gera registro SOAP no prontuário; docs emitidos ficam vinculados ao atendimento.

### Claude's Discretion

- Estrutura/colunas/índices das migrations (sempre indexar `clinic_id` + `unit_id` quando aplicável); enums de tipo de documento e de status da teleconsulta.
- Formato exato da tabela de medicamentos e das tags de alergia/classe; o algoritmo de match textual tolerante.
- Layout das telas (emissão de receita/atestado/exame, tela de teleconsulta + consentimento, editor SOAP), seguindo o design system v1, @base-ui render-prop, tokens, RHF+Zod v3, pt-BR.
- Como a numeração sequencial é gerada de forma atômica (sequência por tenant+tipo) sem corrida.
- Reaproveitar ao máximo a engine de documentos/assinatura (Fase 8) e o PDF (`@react-pdf/renderer`).

### Deferred Ideas (OUT OF SCOPE)

- UI de consumo dos documentos no Portal do Paciente (Fase 20).
- Vídeo nativo WebRTC (Daily/Twilio) ou Jitsi self-host para teleconsulta.
- Importação do dataset DCB/DCI completo da ANVISA.
- Lista estruturada de alérgenos do paciente (match determinístico) — evolução futura do RX-02.
- Integração TISS/convênio do receituário.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RX-01 | Dentista emite receita (simples/controle especial) com medicamento (base DCB/DCI) e posologia | `medications` table (D-01) + `clinical_documents` table with `doc_type` enum + `issueClinicDocument` action |
| RX-02 | A receita valida as alergias do paciente antes de emitir | Allergy check reads `patients.allergies` (decrypt AES-256-GCM) + `anamneses.responses.alergia_medicamento/.alergia_anestesia`; `checkMedicationAllergy()` pure util in `src/lib/clinical/allergy-check.ts` |
| RX-03 | Documento clínico assinado com ICP-Brasil, numerado, disponível no Portal do Paciente | Reuses `signPdfBuffer` from Phase 8; atomic counter via `document_seq_counters` table; `visible_no_portal` flag on `clinical_documents` |
| TEL-01 | Dentista realiza teleconsulta/teleorientação com vídeo (link externo), registrando consentimento CFO | `teleconsultations` table: `external_link`, `consent_given_at`, `started_at`, `ended_at`, `appointment_id`, `patient_id` |
| TEL-02 | A sessão gera registro clínico (SOAP) no prontuário e documentos emitidos na hora | Extend `medical_records` with SOAP columns (`soap_subjective`, `soap_objective`, `soap_assessment`, `soap_plan`, `teleconsultation_id`) OR new `soap_records` table linked to appointment |
</phase_requirements>

---

## Summary

Phase 12 adds the clinical document emission workflow (receituário, atestados, solicitações de exame) and the teleconsultation session model. Both subsystems are primarily data-model + Server Action extensions that reuse existing infrastructure from Phases 2, 8, and 11 rather than introducing new dependencies.

The ICP-Brasil signing engine (`signPdfBuffer` → `SignatureResult`), the PDF renderer (`DocumentoPDF` via `@react-pdf/renderer`), and the document version/immutability pattern are all confirmed operational from Phase 8. Phase 12 clinical documents follow the same generate → draft → sign → immutable pattern but with a clinical-specific table (`clinical_documents`) instead of the generic Phase 8 `documents` table, because they require: (1) `doc_type` discrimination (receita/atestado/exame/controle), (2) `appointment_id` linkage, (3) per-clinic+type sequential numbering, and (4) `visible_no_portal` flag. Extending the existing `documents` table would contaminate generic document semantics with clinical concerns.

The allergy-check subsystem is a pure-function utility that decrypts `patients.allergies` (AES-256-GCM, same `decrypt()` from `src/lib/crypto.ts`) and cross-references the selected medication's `allergen_tags` array against the free-text allergy field plus the two boolean anamnesis flags. The teleconsultation model is a new table with FK to `appointments` and no video infrastructure; SOAP is stored as columns on a new `soap_records` table linked to both `appointments` and `clinical_documents`.

**Primary recommendation:** New `clinical_documents` table (not extending Phase 8 `documents`); atomic sequential numbering via a dedicated `document_seq_counters` table (Postgres advisory lock or SELECT ... FOR UPDATE pattern); allergy check as a pure server-side utility; SOAP as a new `soap_records` table extending Phase 2 prontuário.

---

## Standard Stack

### Core (all already in package.json — no new installs)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@react-pdf/renderer` | ^4.5.1 | Clinical document PDF generation | [VERIFIED: package.json] — established in Phase 8, Flexbox-only, server-safe |
| `node-forge` | ^1.4.0 | ICP-Brasil signing (reused via `signPdfBuffer`) | [VERIFIED: package.json] — Phase 8 engine, RSA-2048 + SHA-256 |
| `zod` | ^3.25.76 | Form + action validation | [VERIFIED: package.json] — pinned at v3, resolvers compat |
| `@supabase/supabase-js` | ^2.107.0 | DB + RLS + Storage | [VERIFIED: package.json] |
| `@react-pdf/renderer` | ^4.5.1 | ReceituarioPDF + AtestadoPDF + ExamePDF components | [VERIFIED: package.json] |

### No New Packages Required

[VERIFIED: codebase inspection] — All required capabilities exist:
- PDF generation: `@react-pdf/renderer` v4 (Phase 8 pattern)
- Signing: `node-forge` + `src/lib/icp/sign-document.ts`
- Encryption/decryption: `src/lib/crypto.ts` (AES-256-GCM — for allergies read)
- Form: `react-hook-form` + `@hookform/resolvers` + `zod`
- UI: `shadcn/ui` + `@base-ui/react` + `lucide-react`

**Installation:** None required for this phase.

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── actions/
│   ├── clinical-documents.ts   # issueClinicDocument, signClinicDocument, listClinicDocuments
│   └── teleconsultations.ts    # createTeleconsultation, endTeleconsultation, listTeleconsultations
├── lib/
│   ├── clinical/
│   │   └── allergy-check.ts    # checkMedicationAllergy() — pure function, no 'use server'
│   └── validators/
│       ├── clinical-document.ts  # Zod schemas: clinicalDocumentSchema, medicationLineSchema
│       └── teleconsultation.ts   # Zod schemas: teleconsultationSchema, soapSchema
├── components/
│   ├── pdf/
│   │   ├── ReceituarioPDF.tsx   # @react-pdf/renderer — receita simples + controle especial
│   │   ├── AtestadoPDF.tsx      # @react-pdf/renderer — atestado médico
│   │   └── ExamePDF.tsx         # @react-pdf/renderer — solicitação de exame
│   ├── receituario/
│   │   ├── ClinicalDocumentForm.tsx  # RHF+Zod: type select + medication combobox + posologia
│   │   └── AllergyAlert.tsx         # non-blocking warning component
│   └── teleconsultation/
│       ├── TeleconsultationForm.tsx  # consent + external link + start/end
│       └── SoapEditor.tsx           # SOAP fields (S/O/A/P)
├── app/(dashboard)/clinica/
│   ├── receituario/
│   │   └── page.tsx            # RSC: list clinical docs + issue form
│   └── teleodontologia/
│       └── page.tsx            # RSC: list sessions + create session
supabase/migrations/
├── 20260618000100_clinical_documents.sql    # medications, clinical_documents, document_seq_counters
├── 20260618000200_clinical_documents_rls.sql
├── 20260618000300_teleconsultations.sql     # teleconsultations, soap_records
└── 20260618000400_teleconsultations_rls.sql
src/__tests__/
├── receituario/
│   ├── allergy-check.test.ts
│   ├── clinical-documents.test.ts
│   └── migrations-phase12-rx.test.ts
└── teleodontologia/
    ├── teleconsultations.test.ts
    └── migrations-phase12-tel.test.ts
```

### Pattern 1: Clinical Documents Table (separate from Phase 8 `documents`)

**What:** New `clinical_documents` table carries clinical semantics: `doc_type`, `appointment_id`, `professional_id`, `medications_json` (for receita), `visible_no_portal`, sequential `doc_number`.

**Why separate from Phase 8 `documents`:** Phase 8 `documents` is template-driven (admin creates templates, staff fills variables). Clinical documents are structured forms: a receita always has medication + posology fields; an atestado has a reason; an exame request has a CID/exam type. Template-driven rendering is inappropriate for clinical documents where fields are structured. Clinical documents also require `appointment_id`, `professional_id` (CRO), and `doc_number` per type — none of which exist in Phase 8.

**When to use:** All RX-01/02/03 documents (receita simples, controle especial, atestado, solicitação de exame).

**Example schema:**
```sql
-- Source: codebase inspection — mirrors Phase 8 document_tables.sql patterns
CREATE TABLE public.clinical_documents (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id         UUID        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  unit_id           UUID        REFERENCES public.units(id),
  appointment_id    UUID        REFERENCES public.appointments(id),
  patient_id        UUID        NOT NULL REFERENCES public.patients(id),
  professional_id   UUID        REFERENCES public.professionals(id),  -- FK Phase 11
  doc_type          TEXT        NOT NULL
                    CHECK (doc_type IN ('receita_simples', 'receita_controle', 'atestado', 'solicitacao_exame')),
  doc_number        TEXT        NOT NULL,   -- e.g. 'REC-2026-0042' (from seq counter)
  status            TEXT        NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'signed')),
  content_json      JSONB       NOT NULL DEFAULT '{}',  -- structured fields (not free text)
  content_hash      TEXT,                -- SHA-256 of final signed PDF
  storage_path      TEXT,                -- path in clinical-documents-pdf bucket (null = unsigned)
  signature         TEXT,                -- RSA base64 (null = unsigned)
  cert_pem          TEXT,                -- for offline verify
  signer_cn         TEXT,
  cert_thumbprint   TEXT,
  cert_not_after    TEXT,
  signed_at         TIMESTAMPTZ,
  signed_by         UUID        REFERENCES public.users(id),
  visible_no_portal BOOLEAN     NOT NULL DEFAULT false,  -- RX-03 flag; UI = Phase 20
  created_by        UUID        REFERENCES public.users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);
CREATE INDEX idx_clinical_docs_clinic    ON public.clinical_documents(clinic_id);
CREATE INDEX idx_clinical_docs_patient   ON public.clinical_documents(patient_id);
CREATE INDEX idx_clinical_docs_appt      ON public.clinical_documents(appointment_id) WHERE appointment_id IS NOT NULL;
CREATE INDEX idx_clinical_docs_status    ON public.clinical_documents(clinic_id, status);
REVOKE SELECT (storage_path, cert_pem) ON public.clinical_documents FROM authenticated, anon;
```

### Pattern 2: Atomic Sequential Numbering (doc_number)

**What:** Per-clinic + per-type counter that increments atomically without race conditions.

**The race-safe approach — SELECT FOR UPDATE on a counter row:**

```sql
-- Source: codebase inspection — established Postgres pattern
CREATE TABLE public.document_seq_counters (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id   UUID    NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  doc_type    TEXT    NOT NULL,   -- same CHECK as clinical_documents.doc_type
  last_seq    INTEGER NOT NULL DEFAULT 0,
  UNIQUE (clinic_id, doc_type)
);
CREATE INDEX idx_doc_seq_counters_clinic ON public.document_seq_counters(clinic_id);
```

**Usage in Server Action (critical: wrap in transaction):**
```typescript
// Source: [ASSUMED] — standard Postgres advisory-lock-free pattern
// Run inside a Supabase RPC or use .rpc() to execute a plpgsql function atomically
// Option A: Postgres function (recommended — server-side atomic)
CREATE OR REPLACE FUNCTION public.next_doc_number(
  p_clinic_id UUID,
  p_doc_type  TEXT
) RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_seq INTEGER;
  v_prefix TEXT;
BEGIN
  -- Upsert + increment atomically
  INSERT INTO document_seq_counters (clinic_id, doc_type, last_seq)
    VALUES (p_clinic_id, p_doc_type, 1)
  ON CONFLICT (clinic_id, doc_type)
    DO UPDATE SET last_seq = document_seq_counters.last_seq + 1
  RETURNING last_seq INTO v_seq;

  v_prefix := CASE p_doc_type
    WHEN 'receita_simples'     THEN 'REC'
    WHEN 'receita_controle'    THEN 'RCC'
    WHEN 'atestado'            THEN 'ATE'
    WHEN 'solicitacao_exame'   THEN 'EXM'
    ELSE 'DOC'
  END;
  RETURN v_prefix || '-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(v_seq::TEXT, 4, '0');
END;
$$;
```

**Why this approach beats `MAX(doc_number)+1`:** INSERT ... ON CONFLICT DO UPDATE is atomic in Postgres; no SERIALIZABLE isolation required; no deadlock risk. [VERIFIED: codebase inspection of Phase 8 pattern `is('signature', null)` atomic guard for race safety — same philosophy.]

### Pattern 3: Allergy Check — Pure Function

**What:** `checkMedicationAllergy()` in `src/lib/clinical/allergy-check.ts` — no 'use server', importable server-side from actions.

**Allergy data sources confirmed:**
1. `patients.allergies` — TEXT, AES-256-GCM encrypted. Must be decrypted via `decrypt()` from `src/lib/crypto.ts` before string comparison. [VERIFIED: `src/actions/patients.ts` + `supabase/migrations/20260605000100_clinical_tables.sql`]
2. `anamneses.responses.alergia_medicamento` — BOOLEAN in JSONB. Latest anamnesis by `created_at DESC`. [VERIFIED: `src/lib/validators/anamnesis.ts` — `alergia_medicamento`, `alergia_anestesia` keys in `cfoResponsesSchema`]
3. `medications.allergen_tags` — TEXT[] on the curated medications table (new in Phase 12).

**Tolerant match algorithm:**
```typescript
// Source: [ASSUMED] — standard NFC normalize + toLowerCase approach for pt-BR
function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

export function checkMedicationAllergy(params: {
  medicationName: string
  allergenTags: string[]         // from medications.allergen_tags
  patientAllergiesPlaintext: string | null   // decrypted patients.allergies
  anamnesisFlags: { alergia_medicamento: boolean; alergia_anestesia: boolean }
}): { hasAlert: boolean; reasons: string[] }
```

- Step 1: If `alergia_medicamento === true`, flag "Paciente declarou alergia a medicamentos na anamnese"
- Step 2: If `alergia_anestesia === true` AND medication class is anestésico local, flag "Paciente declarou alergia a anestesia local"
- Step 3: For each `allergenTag` in `allergenTags`, check `normalize(patientAllergiesPlaintext).includes(normalize(allergenTag))`
- Step 4: Check `normalize(patientAllergiesPlaintext).includes(normalize(medicationName))`
- Returns `{ hasAlert: boolean; reasons: string[] }` — never throws, always returns gracefully when data is null/empty

### Pattern 4: Teleconsultation Table + SOAP

**What:** `teleconsultations` table stores session metadata; `soap_records` table stores SOAP text linked to appointments and optionally to teleconsultations.

**Why a new `soap_records` table rather than adding SOAP columns to `medical_records`:**
- `medical_records` has free-text `diagnosis`, `treatment_plan`, `prescription` — not structured S/O/A/P fields
- SOAP is generated specifically from teleconsultations (TEL-02) but may later be usable in-person too (Phase 20+)
- Adding 4 nullable columns + `teleconsultation_id` to `medical_records` is a viable alternative — see Open Questions
- New table is cleaner, avoids NULLable sprawl on existing table used by Phase 2

```sql
-- Source: codebase inspection — mirrors professional_availability pattern
CREATE TABLE public.teleconsultations (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id         UUID        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  appointment_id    UUID        REFERENCES public.appointments(id),
  patient_id        UUID        NOT NULL REFERENCES public.patients(id),
  professional_id   UUID        REFERENCES public.professionals(id),
  external_link     TEXT,                    -- Meet/Zoom/Jitsi URL (nullable = not yet set)
  consent_given     BOOLEAN     NOT NULL DEFAULT false,
  consent_given_at  TIMESTAMPTZ,
  consent_ip        INET,
  status            TEXT        NOT NULL DEFAULT 'agendada'
                    CHECK (status IN ('agendada', 'em_andamento', 'concluida', 'cancelada')),
  started_at        TIMESTAMPTZ,
  ended_at          TIMESTAMPTZ,
  notes             TEXT,
  created_by        UUID        REFERENCES public.users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);
CREATE INDEX idx_teleconsultations_clinic   ON public.teleconsultations(clinic_id);
CREATE INDEX idx_teleconsultations_patient  ON public.teleconsultations(patient_id);
CREATE INDEX idx_teleconsultations_appt     ON public.teleconsultations(appointment_id) WHERE appointment_id IS NOT NULL;

CREATE TABLE public.soap_records (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id           UUID        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id          UUID        NOT NULL REFERENCES public.patients(id),
  appointment_id      UUID        REFERENCES public.appointments(id),
  teleconsultation_id UUID        REFERENCES public.teleconsultations(id),
  dentist_id          UUID        NOT NULL REFERENCES public.users(id),
  soap_subjective     TEXT,   -- S: queixa principal, sintomas relatados
  soap_objective      TEXT,   -- O: exame clínico, achados objetivos
  soap_assessment     TEXT,   -- A: avaliação/diagnóstico
  soap_plan           TEXT,   -- P: plano de tratamento/conduta
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_soap_records_clinic   ON public.soap_records(clinic_id);
CREATE INDEX idx_soap_records_patient  ON public.soap_records(patient_id, created_at DESC);
CREATE INDEX idx_soap_records_telec    ON public.soap_records(teleconsultation_id) WHERE teleconsultation_id IS NOT NULL;
```

### Pattern 5: ICP Signing Reuse for Clinical Documents

**Confirmed API from Phase 8 — `signPdfBuffer` signature:**
```typescript
// Source: src/lib/icp/sign-document.ts [VERIFIED]
export async function signPdfBuffer(
  pdfBuffer: Buffer,
  certStoragePath: string,
  certPasswordEnc: string
): Promise<SignatureResult>

// SignatureResult [VERIFIED: src/lib/documents/document-types.ts]
interface SignatureResult {
  sha256Hex: string
  signatureB64: string
  signedAt: string
  certSubjectCn: string
  certThumbprintSha1: string
  certNotAfter: string
  certPem: string
}
```

**Phase 12 signing flow (mirrors Phase 8 `signDocument` action exactly):**
1. Fetch `clinical_documents` row via admin client (bypasses REVOKE on `storage_path`, `cert_pem`)
2. Fetch clinic's ICP certificate (`certificates` table, `cert_password_enc`, `storage_path`)
3. Build PDF: `createElement(ReceituarioPDF | AtestadoPDF | ExamePDF, props)` → `renderToBuffer()`
4. Call `signPdfBuffer(pdfBuffer, cert.storage_path, cert.cert_password_enc)`
5. Upload to `clinical-documents-pdf` bucket (new private bucket, same pattern as `documents-pdf`)
6. Atomic update: `.is('signature', null)` guard — identical to Phase 8 race guard
7. Update `status = 'signed'`, store `content_hash`, `signature`, `cert_pem`, `signer_cn`, `cert_thumbprint`, `signed_at`, `signed_by`

**New PDF bucket:** `clinical-documents-pdf` (private, same policy as `documents-pdf`). Storage path: `{clinic_id}/{clinical_document_id}.pdf`.

### Pattern 6: Medications Table (seed via migration)

```sql
-- Source: [ASSUMED] — standard reference table pattern
CREATE TABLE public.medications (
  id               UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT     NOT NULL,           -- nome comercial/DCI
  generic_name     TEXT,                         -- nome genérico DCB/DCI
  therapeutic_class TEXT    NOT NULL,            -- 'analgesico', 'aine', 'antibiotico', 'anestesico_local', 'controle_especial', etc.
  allergen_tags    TEXT[]   NOT NULL DEFAULT '{}', -- ['penicilina'], ['aine','dipirona'], etc.
  requires_special_control BOOLEAN NOT NULL DEFAULT false,  -- RX-01: receita controle especial
  common_dosages   TEXT[]   NOT NULL DEFAULT '{}',          -- UX helper: common posology suggestions
  active           BOOLEAN  NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_medications_class  ON public.medications(therapeutic_class);
CREATE INDEX idx_medications_active ON public.medications(active) WHERE active = true;
-- NO clinic_id: this is a GLOBAL reference table (read-only for all tenants)
-- RLS: SELECT open to authenticated; no INSERT/UPDATE/DELETE for non-superadmin
ALTER TABLE public.medications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "medications_read" ON public.medications FOR SELECT USING (active = true);
-- Superadmin write access only (not per-tenant)
CREATE POLICY "medications_superadmin_write" ON public.medications
  FOR ALL USING (get_my_role() = 'superadmin')
  WITH CHECK (get_my_role() = 'superadmin');
```

**Seed (~100-200 items) via the same migration file.** Example insert block:
```sql
INSERT INTO public.medications (name, generic_name, therapeutic_class, allergen_tags, requires_special_control, common_dosages) VALUES
  ('Amoxicilina 500mg', 'Amoxicilina', 'antibiotico', ARRAY['penicilina', 'betalactamico'], false, ARRAY['500mg 8/8h por 7 dias', '500mg 12/12h por 7 dias']),
  ('Ibuprofeno 400mg', 'Ibuprofeno', 'aine', ARRAY['aine'], false, ARRAY['400mg 8/8h por 3 dias', '400mg 6/6h por 5 dias']),
  ('Dipirona 500mg', 'Dipirona Monoidratada', 'analgesico', ARRAY['dipirona'], false, ARRAY['500mg de 6/6h', '1g de 8/8h']),
  ('Nimesulida 100mg', 'Nimesulida', 'aine', ARRAY['aine', 'nimesulida'], false, ARRAY['100mg 12/12h por 3 dias']),
  ('Clindamicina 300mg', 'Clindamicina', 'antibiotico', ARRAY['lincosamida'], false, ARRAY['300mg 8/8h por 7 dias', '600mg 12/12h por 7 dias']),
  ('Tramadol 50mg', 'Tramadol', 'analgesico_opioide', ARRAY['opioide'], true, ARRAY['50mg de 6/6h conforme dor']),
  ('Diazepam 5mg', 'Diazepam', 'benzodiazepínico', ARRAY['benzodiazepínico'], true, ARRAY['5mg 30min antes do procedimento']),
  ('Lidocaína 2%', 'Lidocaína', 'anestesico_local', ARRAY['anestesico_local', 'amida'], false, ARRAY['1,8ml por tubete']),
  ...
-- Full seed list ~100-200 items covers all dental formulary needs
```

### Pattern 7: Module Registration (nav + proxy)

**Two files require edits:**

1. `src/components/shell/nav-config.ts` — add new `NavIconKey` literals and `ALL_NAV_ITEMS` entries:
```typescript
// Source: src/components/shell/nav-config.ts [VERIFIED]
export type NavIconKey =
  | 'agenda' | 'pacientes' | 'financeiro' | 'documentos' | 'equipe'
  | 'profissionais' | 'recursos' | 'ia' | 'prototipos'
  | 'receituario'          // NEW
  | 'teleodontologia'      // NEW

// ALL_NAV_ITEMS additions:
{ href: '/clinica/receituario',      label: 'Receituário',      icon: 'receituario'     },
{ href: '/clinica/teleodontologia',  label: 'Teleodontologia',  icon: 'teleodontologia' },
```

2. `src/components/shell/nav-icons.ts` — map new keys to Lucide icons:
```typescript
// Source: src/components/shell/nav-icons.ts [VERIFIED]
import { FileHeart, Video } from 'lucide-react'
// receituario: FileHeart (prescription/clinical docs)
// teleodontologia: Video (teleconsultation)
```

3. `src/proxy.ts` — add `ModuleKey` values and `MODULE_PERMISSIONS` entries + `ROUTE_MODULE_MAP` prefixes:
```typescript
// ROUTE_MODULE_MAP (must be BEFORE generic '/clinica' entry):
{ prefix: '/clinica/receituario',      module: 'receituario'     },
{ prefix: '/clinica/teleodontologia',  module: 'teleodontologia' },
// MODULE_PERMISSIONS: dentist gets write; auditor/dpo get readOnly; receptionist can view (TBD)
```

### Anti-Patterns to Avoid

- **Re-rendering PDF after signing:** Must sign the exact bytes rendered once — same Pitfall 1 from Phase 8. The `created_at` timestamp must be used as `generatedAt` in PDF rendering for deterministic re-sign on retry.
- **Using MAX(seq)+1 for document numbering:** Race condition between two concurrent emissions. Use `INSERT ... ON CONFLICT DO UPDATE SET last_seq = last_seq + 1` (atomic) instead.
- **Decrypting `patients.allergies` client-side:** `decrypt()` requires `ENCRYPTION_KEY` env var (server-only). Allergy check MUST happen in a Server Action, never in a Client Component.
- **Storing allergy check result in session/cookie:** PII. Only send the result boolean + non-identifying reason string to the client.
- **Phase 8 `documents` table for clinical docs:** Template-driven system is wrong abstraction for structured clinical forms. New table required.
- **Blocking UI on allergy alert:** D-02 specifies non-blocking; the alert is informative only, never prevents form submission.
- **Adding `teleodontologia` as a sub-route of `/clinica/documentos`:** Must be its own module in `ROUTE_MODULE_MAP` (registered BEFORE `/clinica` entry) so proxy resolves it correctly.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PDF generation | Custom HTML→PDF | `@react-pdf/renderer` (Phase 8) | Already installed; Flexbox-only; server-safe; no binary blobs |
| RSA signing | Custom crypto | `signPdfBuffer` from `src/lib/icp/sign-document.ts` | Phase 8 verified; node-forge already configured |
| AES-256 decrypt (allergies) | Custom decrypt | `decrypt()` from `src/lib/crypto.ts` | Same key, same format iv:authTag:ciphertext |
| Immutability enforcement | App-layer flag | INSERT-only RLS + no UPDATE policy | Phase 8 pattern; database-enforced, not app-enforced |
| Sequential numbering race | MAX+1 | `next_doc_number()` Postgres function | Atomic ON CONFLICT DO UPDATE; no SELECT FOR UPDATE needed |
| Access token auth | Custom session | `createClient()` + `get_my_tenant_id()` RLS | Established pattern across all phases |

---

## Runtime State Inventory

> Phase 12 is greenfield (new tables, new routes). No existing runtime state affected.

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | No existing medications/clinical_documents/teleconsultations/soap_records tables | New tables via migration |
| Live service config | No external services for video (D-03: link only) | None |
| OS-registered state | None | None |
| Secrets/env vars | `ENCRYPTION_KEY` already set (Phase 2 allergies) | None — reusing existing key |
| Build artifacts | None phase-specific | None |

---

## Common Pitfalls

### Pitfall 1: Signing Re-rendered PDF (inherited from Phase 8)
**What goes wrong:** `renderToBuffer()` called twice — once for draft hash, once for signing. Font caching and timestamp differences produce different bytes → SHA-256 mismatch.
**Why it happens:** `new Date()` or fresh font fetch between renders.
**How to avoid:** Store `created_at` on `clinical_documents` at creation time. Use that timestamp as `generatedAt` in all PDF renders for the same document. Never re-render after signing. [VERIFIED: Phase 8 `signDocument` action uses `version.created_at` specifically to prevent this — line 365-374 of `src/actions/documents.ts`]

### Pitfall 2: Allergy Check Reads Encrypted Ciphertext
**What goes wrong:** Allergy text in `patients.allergies` is AES-256-GCM ciphertext (format: `iv:authTag:ciphertext` hex). A naive `includes('penicilina')` against ciphertext will always return false.
**Why it happens:** D-07 encrypts `allergies` on insert. [VERIFIED: `src/actions/patients.ts` line 95]
**How to avoid:** In the allergy-check Server Action, fetch patient via `createAdminClient()` to bypass RLS if needed, then call `decrypt(patient.allergies)` before the string comparison. Guard against null: if `allergies` is null/empty, skip text check but still evaluate anamnesis flags.

### Pitfall 3: atomic `doc_number` — Missing `ON CONFLICT DO UPDATE` Upsert on `document_seq_counters`
**What goes wrong:** First document of a type → INSERT succeeds. Second → INSERT fails (UNIQUE violation) → no update → same seq returned → duplicate `doc_number`.
**Why it happens:** INSERT without `ON CONFLICT` handling.
**How to avoid:** Use `INSERT ... ON CONFLICT (clinic_id, doc_type) DO UPDATE SET last_seq = document_seq_counters.last_seq + 1 RETURNING last_seq` in the Postgres function. [VERIFIED: Postgres upsert pattern, ASSUMED: atomic correctness]

### Pitfall 4: `medications` Table RLS — No `clinic_id`, Needs Global SELECT
**What goes wrong:** Standard `USING (clinic_id = get_my_tenant_id())` policy on a global reference table blocks all reads.
**Why it happens:** Medications are global (not per-tenant); policy must allow any authenticated user to read active medications.
**How to avoid:** `CREATE POLICY "medications_read" ON public.medications FOR SELECT USING (active = true)` — no tenant filter. Only superadmin can write. [ASSUMED: consistent with pattern for global reference data]

### Pitfall 5: SOAP Records — `dental_records` vs `medical_records` Confusion
**What goes wrong:** SOAP goes into `dental_records` (odontogram changes) instead of the prontuário timeline.
**Why it happens:** Confusion between clinical note types.
**How to avoid:** `soap_records` is separate from both `dental_records` (odontogram FDI tooth-by-tooth) and `medical_records` (Phase 2 free-text diagnosis/treatment/prescription). SOAP is a new structured note type specific to teleconsultation. [VERIFIED: `supabase/migrations/20260605000100_clinical_tables.sql` — `medical_records` has `diagnosis/treatment_plan/prescription` TEXT, `dental_records` is tooth-FDI-status only]

### Pitfall 6: Proxy Module Resolution — Specific Route Before Generic
**What goes wrong:** `/clinica/receituario` resolves to `clinica` module instead of `receituario`.
**Why it happens:** `ROUTE_MODULE_MAP` uses first-match; if `/clinica` entry appears before `/clinica/receituario`, it matches first.
**How to avoid:** Register `/clinica/receituario` and `/clinica/teleodontologia` BEFORE the generic `/clinica` entry in `ROUTE_MODULE_MAP`. [VERIFIED: pattern from `/clinica/documentos` and `/clinica/financeiro` entries in `src/proxy.ts`]

### Pitfall 7: `content_json` in `clinical_documents` — PII in JSONB
**What goes wrong:** `content_json` stores medication name + patient data at rest unencrypted.
**Why it happens:** JSONB is often stored plaintext without thinking.
**How to avoid:** For `clinical_documents`, `content_json` contains dosage/medication/prescription info but NOT patient CPF or medical history. Patient identity is linked via `patient_id` FK only. The signed PDF (in storage, path REVOKE-protected) contains the rendered clinical content. `content_json` may contain the prescription data (medication, dosage, duration) — this is clinical PII. Consider encrypting via `encrypt(JSON.stringify(content_json))` similar to Phase 8 `content` column pattern. Mark column as `TEXT` if encrypted, not `JSONB`.

---

## Code Examples

### Example 1: issueClinicDocument Server Action (RX-01 flow)
```typescript
// Source: [ASSUMED] — mirrors src/actions/documents.ts generateDocument pattern
'use server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { decrypt } from '@/lib/crypto'
import { signPdfBuffer } from '@/lib/icp/sign-document'
import { checkMedicationAllergy } from '@/lib/clinical/allergy-check'
import { createElement } from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { ReceituarioPDF } from '@/components/pdf/ReceituarioPDF'

export async function issueClinicDocument(input: ClinicalDocumentInput) {
  await assertNotReadOnly()
  // 1. getActor() → role gate (dentist/admin/superadmin only)
  // 2. If doc_type includes 'receita': fetch patient allergies + latest anamnesis
  //    → decrypt(patient.allergies) → checkMedicationAllergy() → return allergyAlert if hasAlert
  // 3. Fetch next doc_number via supabase.rpc('next_doc_number', {clinic_id, doc_type})
  // 4. Insert clinical_documents row (status='draft', content_json encrypted)
  // 5. Render PDF → signPdfBuffer → upload to clinical-documents-pdf bucket
  // 6. Atomic UPDATE .is('signature', null) guard
  // 7. logBusinessEvent
}
```

### Example 2: checkMedicationAllergy (pure function)
```typescript
// Source: [ASSUMED] — pure function pattern, no server-only import
export function checkMedicationAllergy(params: {
  medicationName: string
  allergenTags: string[]
  patientAllergiesPlaintext: string | null
  anamnesisFlags: { alergia_medicamento: boolean; alergia_anestesia: boolean }
  therapeuticClass: string
}): { hasAlert: boolean; reasons: string[] } {
  const reasons: string[] = []
  const norm = (s: string) =>
    s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
  const allergiesNorm = params.patientAllergiesPlaintext
    ? norm(params.patientAllergiesPlaintext)
    : ''

  if (params.anamnesisFlags.alergia_medicamento) {
    reasons.push('Paciente declarou alergia a medicamentos na anamnese')
  }
  if (
    params.anamnesisFlags.alergia_anestesia &&
    params.therapeuticClass === 'anestesico_local'
  ) {
    reasons.push('Paciente declarou alergia a anestesia local na anamnese')
  }
  for (const tag of params.allergenTags) {
    if (allergiesNorm && allergiesNorm.includes(norm(tag))) {
      reasons.push(`Possível alergia a ${tag} (campo de alergias do paciente)`)
    }
  }
  if (allergiesNorm && allergiesNorm.includes(norm(params.medicationName))) {
    reasons.push(`Medicamento "${params.medicationName}" mencionado no campo de alergias`)
  }
  return { hasAlert: reasons.length > 0, reasons }
}
```

### Example 3: next_doc_number Postgres function call in action
```typescript
// Source: [ASSUMED] — mirrors supabase.rpc() pattern from codebase
const { data: docNumber, error: seqError } = await supabase.rpc('next_doc_number', {
  p_clinic_id: actor.tenant_id,
  p_doc_type:  input.doc_type,
})
if (seqError || !docNumber) {
  return { success: false, error: 'Erro ao gerar número do documento' }
}
```

### Example 4: AllergyAlert component (non-blocking — D-02)
```typescript
// Source: [ASSUMED] — shadcn Alert component, non-blocking
// Shown as a yellow/amber Alert above the submit button
// dentist confirms and submits — no form state change required
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

interface AllergyAlertProps {
  reasons: string[]
}

export function AllergyAlert({ reasons }: AllergyAlertProps) {
  if (reasons.length === 0) return null
  return (
    <Alert variant="default" className="border-amber-500 bg-amber-50 text-amber-900">
      <AlertTitle>Atenção: Possível alergia detectada</AlertTitle>
      <AlertDescription>
        <ul className="list-disc pl-4 space-y-1 text-sm">
          {reasons.map((r, i) => <li key={i}>{r}</li>)}
        </ul>
        <p className="mt-2 text-xs text-muted-foreground">
          Confirme com o paciente antes de emitir. A emissão não está bloqueada.
        </p>
      </AlertDescription>
    </Alert>
  )
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Blocking allergy validation | Non-blocking soft alert (D-02) | Phase 12 decision | Preserves clinical autonomy |
| Template-only documents (Phase 8) | Structured clinical documents with own table | Phase 12 | Separate clinical doc concern from generic doc engine |
| `medical_records` free-text fields for all notes | SOAP-structured notes in `soap_records` | Phase 12 | Teleconsultation-specific structured format |
| `documents-pdf` bucket for all docs | `clinical-documents-pdf` separate bucket | Phase 12 | Cleaner access control separation |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `INSERT ... ON CONFLICT DO UPDATE SET last_seq = last_seq + 1` is atomic in Postgres without explicit transaction | Pattern 2 | Rare race → duplicate doc_number; fix: wrap in BEGIN/COMMIT or use FOR UPDATE lock |
| A2 | `medications` table needs no per-tenant RLS (global reference data, all clinics read) | Pattern 6 | If a clinic needs custom medications, need per-tenant overrides; not in scope this phase |
| A3 | `checkMedicationAllergy` normalize approach (NFD decompose + strip combining chars) correctly handles all pt-BR diacritics in allergy text | Pattern 3 | False negatives on unusual Unicode; acceptable risk for soft alert |
| A4 | `soap_records` as separate table (not adding columns to `medical_records`) is preferred | Pattern 4 | Planner may prefer simpler ADD COLUMN approach; see Open Questions |
| A5 | `clinical-documents-pdf` is a new bucket (separate from `documents-pdf`) | Pattern 5 | Same bucket is also acceptable; planner decides |
| A6 | Teleconsultation `consent_given_at` timestamps capture CFO regulatory requirement | Pattern 4 | If CFO specifies additional fields (signed consent PDF), more complex solution needed |

---

## Open Questions

1. **SOAP storage: new `soap_records` table vs ADD COLUMN to `medical_records`?**
   - What we know: `medical_records` has `diagnosis`, `treatment_plan`, `prescription` TEXT fields; SOAP is structured (S/O/A/P)
   - What's unclear: Whether SOAP in-person (not teleconsultation) is desired in future phases
   - Recommendation: New `soap_records` table preferred for separation of concerns; simpler to extend later

2. **CFO regulatory consent for teleconsultation — what exactly is required?**
   - What we know: D-03 says "registrar consentimento CFO" — a boolean + timestamp + IP is the planned approach
   - What's unclear: Whether CFO Resolution 226/2022 requires a signed consent PDF or just a logged consent event
   - Recommendation: [ASSUMED] Log `consent_given=true`, `consent_given_at`, `consent_ip` — this satisfies audit trail requirement. No signed consent PDF needed at MVP. Flag as LOW confidence — planner should confirm.

3. **`clinical_documents.content_json` — encrypt or plaintext JSONB?**
   - What we know: Phase 8 encrypts `document_versions.content` (contains PII). `content_json` may contain prescription data (medication + dosage) but not patient CPF/name
   - What's unclear: Whether prescription details constitute LGPD "dados de saúde" requiring encryption
   - Recommendation: Encrypt `content_json` (serialize to TEXT via `encrypt(JSON.stringify(...))`) for safety, consistent with D-07. Accept performance cost.

4. **`receituario` and `teleodontologia` as separate nav items or nested under `documentos`?**
   - What we know: `documentos` module exists; clinical docs are a different concern
   - What's unclear: UX preference
   - Recommendation: Separate top-level nav items for discoverability; `documentos` remains the generic template engine

---

## Environment Availability

> Step 2.6: All dependencies are already installed in `node_modules`. No external services required for this phase (no video server, no external API for medication database).

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `@react-pdf/renderer` | ReceituarioPDF/AtestadoPDF/ExamePDF | Yes | ^4.5.1 | — |
| `node-forge` | `signPdfBuffer` reuse | Yes | ^1.4.0 | — |
| `zod` v3 | Form validation | Yes | ^3.25.76 | — |
| Supabase `sa-east-1` | DB + Storage | Yes | — | — |
| ICP certificate in `certificates` table | Signing | Depends on clinic setup | — | Emit unsigned (no cert) |

**Missing dependencies with no fallback:** None.

**Conditional dependency:** If no ICP-Brasil certificate is configured for the clinic (`certificates` table empty), `signClinicDocument` returns `{ success: false, error: 'Certificado ICP-Brasil não encontrado' }` — same as Phase 8. Planner should add this guard.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (node environment) |
| Config file | `vitest.config.ts` — `include: ['src/__tests__/**/*.test.ts']` |
| Quick run command | `npx vitest run src/__tests__/receituario/ src/__tests__/teleodontologia/` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RX-01 | `issueClinicDocument` returns `doc_number` in correct format per type | source-inspection + unit | `npx vitest run src/__tests__/receituario/clinical-documents.test.ts` | Wave 0 |
| RX-01 | `medications` table has `name`, `allergen_tags`, `requires_special_control` columns | migration-inspection | `npx vitest run src/__tests__/receituario/migrations-phase12-rx.test.ts` | Wave 0 |
| RX-01 | `clinical_documents` table has `doc_type` CHECK constraint with 4 values | migration-inspection | same | Wave 0 |
| RX-02 | `checkMedicationAllergy` returns `hasAlert=true` when allergen_tag in free-text allergy | pure unit | `npx vitest run src/__tests__/receituario/allergy-check.test.ts` | Wave 0 |
| RX-02 | `checkMedicationAllergy` returns `hasAlert=true` when `alergia_medicamento=true` | pure unit | same | Wave 0 |
| RX-02 | `checkMedicationAllergy` returns `hasAlert=false` when no match | pure unit | same | Wave 0 |
| RX-02 | Allergy check uses `decrypt()` — action imports `@/lib/crypto` | source-inspection | same | Wave 0 |
| RX-03 | `signClinicDocument` calls `signPdfBuffer` | source-inspection | clinical-documents.test.ts | Wave 0 |
| RX-03 | `clinical_documents.status` transitions draft→signed; no UPDATE after signed | source-inspection | same | Wave 0 |
| RX-03 | `document_seq_counters` table exists + `next_doc_number` function exists in migration | migration-inspection | migrations-phase12-rx.test.ts | Wave 0 |
| TEL-01 | `createTeleconsultation` stores `external_link`, `consent_given`, `consent_given_at` | source-inspection | teleconsultations.test.ts | Wave 0 |
| TEL-01 | `teleconsultations` table has `status` CHECK with expected values | migration-inspection | migrations-phase12-tel.test.ts | Wave 0 |
| TEL-02 | `createSoapRecord` links `teleconsultation_id` and `appointment_id` | source-inspection | teleconsultations.test.ts | Wave 0 |
| TEL-02 | `soap_records` has all 4 SOAP columns (subjective/objective/assessment/plan) | migration-inspection | migrations-phase12-tel.test.ts | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run src/__tests__/receituario/ src/__tests__/teleodontologia/`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/__tests__/receituario/allergy-check.test.ts` — covers RX-02 pure unit
- [ ] `src/__tests__/receituario/clinical-documents.test.ts` — covers RX-01, RX-03 source-inspection
- [ ] `src/__tests__/receituario/migrations-phase12-rx.test.ts` — covers RX-01 migrations
- [ ] `src/__tests__/teleodontologia/teleconsultations.test.ts` — covers TEL-01, TEL-02 source-inspection
- [ ] `src/__tests__/teleodontologia/migrations-phase12-tel.test.ts` — covers TEL-01/02 migrations

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (inherited) | `@supabase/ssr` + `createClient()` server-side |
| V3 Session Management | yes (inherited) | HTTP-only cookies via SSR |
| V4 Access Control | yes | RLS USING+WITH CHECK + `assertNotReadOnly()` + role gate in actions |
| V5 Input Validation | yes | Zod v3 schema on all action inputs |
| V6 Cryptography | yes | AES-256-GCM for `content_json` + `patients.allergies`; never hand-roll |
| V7 Error Handling | yes | No stack traces to client; generic error messages |

### Known Threat Patterns for Phase 12 Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-tenant prescription access | Information disclosure | RLS `clinic_id = get_my_tenant_id()` + cross-tenant guard in actions |
| Re-signing already-signed document | Tampering | `.is('signature', null)` atomic guard (Phase 8 pattern) — verified |
| Allergy check bypass (client sends pre-checked result) | Tampering | Allergy check runs server-side in action; client input has no allergy-override field |
| PII in `content_json` at rest | Disclosure | Encrypt `content_json` as TEXT via `encrypt(JSON.stringify(...))` |
| `storage_path` / `cert_pem` exposure | Disclosure | `REVOKE SELECT (storage_path, cert_pem)` on `clinical_documents` — same as Phase 8 |
| Teleconsultation consent forgery | Repudiation | Server records `consent_given_at` + `consent_ip` server-side; client cannot forge |
| Sequential number prediction | Spoofing | `doc_number` is display-only; actual ID is UUID; no security-critical function |

### LGPD Specific
- `clinical_documents.content_json` may contain prescription data (health data) → encrypt at rest
- `soap_records` SOAP fields contain clinical notes (health data) → soft-delete + `deleted_at` NULLABLE or audit trail
- `teleconsultations.consent_ip` is personal data → retained for legal basis per CFO; consider retention policy (20-year clinical record rule: Lei 13.787/2018)

---

## Project Constraints (from CLAUDE.md)

| Directive | Impact on Phase 12 |
|-----------|-------------------|
| Next.js 15 App Router + TypeScript strict | All new pages/actions follow App Router conventions |
| Supabase `@supabase/ssr` (not deprecated auth-helpers) | `createClient()` from `@/lib/supabase/server` in all server actions |
| RLS USING+WITH CHECK | All new tables get full USING+WITH CHECK pairs |
| Index every `clinic_id` | `clinical_documents`, `teleconsultations`, `soap_records`, `document_seq_counters` all get `idx_*_clinic` |
| `@react-pdf/renderer` Flexbox only (no CSS Grid) | ReceituarioPDF, AtestadoPDF, ExamePDF use Flexbox layout exclusively |
| `'use server'` async-only exports | `checkMedicationAllergy` must be in NON-'use server' file (pure function); doc-types constants follow same pattern |
| nodejs runtime (not edge) | All new API routes: `export const runtime = 'nodejs'` |
| LGPD: soft delete, audit trail | `clinical_documents` + `teleconsultations` + `soap_records` all get `deleted_at` NULLABLE |
| AES-256 for health data | `clinical_documents.content_json` encrypted if it contains prescription PII |
| signPdfBuffer signs exact buffer once | Use `created_at` timestamp as deterministic `generatedAt` in all PDF renders |
| service role key server-only | `createAdminClient()` only in Server Actions for cert fetch, column-REVOKE bypass |
| gen types temp-file guard + single db push | Wave with migrations gets one [BLOCKING] db push + `npx supabase gen types` |
| deploy master+master:main | No change to deploy flow |
| @base-ui/react for Button primitives | ClinicalDocumentForm uses `@base-ui/react/button` if new Button needed |
| RSC string-key icons | Nav icons for `receituario` and `teleodontologia` added to `nav-icons.ts` as string keys |
| Supabase re-auth gotcha | Remember: CLI often logged in as nexus-* account — re-login before db push |

---

## Sources

### Primary (HIGH confidence)
- `src/lib/icp/sign-document.ts` — `signPdfBuffer` signature, algorithm, return type verified
- `src/lib/documents/document-types.ts` — `SignatureResult`, `DocumentStatus`, `DocumentContext` verified
- `src/lib/documents/template-engine.ts` — `fillTemplate`, `detectVariables` verified
- `src/actions/documents.ts` — full signing flow, atomic race guard, storage path pattern verified
- `supabase/migrations/20260605000100_clinical_tables.sql` — `patients.allergies TEXT` (encrypted), `medical_records`, `anamneses.responses JSONB` verified
- `supabase/migrations/20260615000100_document_tables.sql` — `documents`, `document_versions` schema verified
- `supabase/migrations/20260615000200_document_rls.sql` — RLS INSERT-only pattern, column REVOKE verified
- `supabase/migrations/20260617000100_professionals.sql` — `professionals.cro`, `cro_uf` verified
- `src/lib/validators/anamnesis.ts` — `alergia_medicamento`, `alergia_anestesia` boolean flags verified
- `src/lib/crypto.ts` — `decrypt()` function signature, `iv:authTag:ciphertext` format verified
- `src/proxy.ts` — `ROUTE_MODULE_MAP` first-match pattern, `MODULE_PERMISSIONS` structure verified
- `src/components/shell/nav-config.ts` — `NavIconKey` union, `ALL_NAV_ITEMS` structure verified
- `src/components/shell/nav-icons.ts` — string-key → Lucide component pattern verified
- `src/components/pdf/DocumentoPDF.tsx` — PDF component props, Flexbox layout, Roboto font verified
- `src/app/(dashboard)/clinica/pacientes/[id]/prontuario/page.tsx` — `medical_records` query shape verified

### Secondary (MEDIUM confidence)
- `package.json` — `@react-pdf/renderer ^4.5.1`, `node-forge ^1.4.0`, `zod ^3.25.76` verified
- Phase 8 `src/actions/documents.ts` sign flow — `created_at` deterministic timestamp pattern verified
- `.planning/phases/12-receitu-rio-teleodontologia/12-CONTEXT.md` — locked decisions and constraints

### Tertiary (LOW confidence / assumed)
- CFO Resolution 226/2022 teleconsultation consent requirements — `[ASSUMED]` consent_given boolean + timestamp sufficient for MVP (see Open Question 2)
- `medications` table RLS (global SELECT) — `[ASSUMED]` consistent with global reference data pattern
- `INSERT ... ON CONFLICT DO UPDATE` atomicity without explicit transaction — `[ASSUMED]` standard Postgres guarantee

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified in package.json; no new installs
- Architecture — clinical_documents table: HIGH — verified Phase 8 documents table as reference; structural differences from Phase 8 are well-reasoned
- Architecture — allergy check: HIGH — allergy data sources verified; pure-function approach established pattern; [ASSUMED] NFD normalize approach
- Architecture — seq numbering: MEDIUM — ON CONFLICT DO UPDATE pattern is standard Postgres; Postgres RPC call pattern verified; [ASSUMED] no explicit transaction needed
- Architecture — teleconsultations/SOAP: HIGH — schema design follows Phase 2 and Phase 11 patterns; CFO requirements LOW confidence
- Pitfalls: HIGH — all inherited from verified Phase 8 codebase; new pitfalls documented from code inspection

**Research date:** 2026-06-18
**Valid until:** 2026-07-18 (stable stack — no fast-moving dependencies)
