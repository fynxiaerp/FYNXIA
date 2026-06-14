# Phase 8: Documentos & Assinatura ICP-Brasil — Research

**Researched:** 2026-06-14
**Domain:** Document templates + variable engine + @react-pdf/renderer PDF generation + node-forge RSA/PKCS#7 ICP-Brasil signing + Supabase append-only versioning
**Confidence:** HIGH (all critical claims verified against installed codebase, node-forge 1.4.0, and renderToBuffer)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01 Assinatura ICP:** Fluxo: gerar o PDF → calcular SHA-256 → assinar o hash com a chave privada do .pfx (node-forge: RSA/PKCS#7) → gravar assinatura + carimbo de tempo (signed_at) + cadeia/identidade do certificado (titular/CNPJ/thumbprint). Assinatura criptográfica real e verificável, viável em Node serverless (Vercel nodejs runtime). PAdES embutido no PDF fica como refinamento futuro (deferido). O .pfx é buscado do bucket privado (`createAdminClient`, service role); a senha é descriptografada AES-256 (`src/lib/crypto.ts`, `ENCRYPTION_KEY`) só em memória server-side; a chave privada nunca sai do servidor. Fallback (apenas se não houver certificado/chave disponível): registro hash + timestamp estilo anamnese v1, claramente marcado como "não assinado por ICP".

**D-02 Motor de Modelos + Render:** Modelo = texto rich-text/markdown com placeholders `{{variável}}` (editor no app). Guardado como conteúdo + lista de variáveis detectadas. Ao gerar: o sistema preenche as variáveis do contexto (paciente, clínica, profissional, data, etc.) e renderiza um PDF reusando `@react-pdf/renderer` (lib do v1, nodejs runtime, Flexbox apenas, sem HTML→PDF) num componente genérico que recebe o conteúdo preenchido. O PDF gerado é o artefato assinado (o hash assinado é o do PDF final).

**D-03 Versionamento & Imutabilidade:** Tabelas `documents` (cabeçalho: clinic_id, unit_id?, template_id, tipo/categoria, status draft/signed, current_version) + `document_versions` append-only (version_number, content preenchido, content_hash, signature, signed_at, signed_by, supersedes_id). Versão assinada é imutável via RLS (sem UPDATE/DELETE quando signed); editar gera nova versão (novo draft) preservando o histórico completo. Espelha o padrão INSERT-only do prontuário/odontograma do v1.

**D-02b Modelos (templates):** Tabela `document_templates` (nome, categoria, conteúdo com `{{vars}}`, variáveis declaradas, ativo) — reutilizável; "tipo" do documento = categoria do modelo.

### Claude's Discretion

- Estrutura exata das migrations/colunas/índices; nomes; se `documents` carrega `unit_id` (provável, multiunidade da Fase 7).
- Biblioteca/abordagem de extração de `{{variáveis}}`; conjunto inicial de variáveis de contexto (paciente, clínica, profissional, data, número do documento).
- Detalhes de PKCS#7 com node-forge (detached vs attached signature; formato de armazenamento da assinatura — base64 no DB).
- UI do editor de modelos + tela de geração/visualização/assinatura (design system v1, @base-ui render-prop, tokens, pt-BR).
- Componente genérico `@react-pdf` (cabeçalho com logo/clínica, corpo, bloco de assinatura/validação).
- Rota: `Configurações › Documentos › Modelos·Assinatura` (per spec card); RBAC: módulo `config`/documentos, acessível conforme matriz da Fase 7.

### Deferred Ideas (OUT OF SCOPE)

- PAdES embutido no PDF (assinatura validável nativamente no leitor) — refinamento futuro; nesta fase a assinatura é PKCS#7 sobre o hash + metadados.
- Documentos específicos (receita/atestado/exame, NFS-e, teleconsulta) — Fases 12/15/20 consomem este motor.
- Distribuição ao Portal do Paciente — Fase 20.
- Editor WYSIWYG avançado / biblioteca de modelos pronta — começar com editor simples + `{{variáveis}}`.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DOC-01 | Usuário cria modelos de documento com variáveis preenchidas automaticamente pelo contexto | Template table + regex `{{var}}` engine (no new dep needed) + variable context set (patient/clinic/professional/date/doc#) |
| DOC-02 | Documento é assinado com ICP-Brasil (carimbo de tempo, validade jurídica) | node-forge 1.4.0 RSA sign verified; SHA-256 consistent between Node crypto and forge; PKCS#7 detached available; signing flow tested end-to-end against test-cert.pfx fixture |
| DOC-03 | Documento assinado é imutável e versionado (histórico preservado) | RLS INSERT-only pattern from dental_records + anamneses; append-only document_versions; signed status blocks UPDATE/DELETE |
</phase_requirements>

---

## Summary

Phase 8 builds a generic document engine on top of already-installed infrastructure. The three foundational pieces — node-forge 1.4.0 (installed), `@react-pdf/renderer` 4.5.1 (installed, verified renderToBuffer), and the `icp-certificates` private bucket + cert keystore (live in production from Phase 7) — are all in place and tested. No new production dependencies are required.

The critical technical path is: `textarea/markdown content with {{vars}}` → fill context (pure regex, no dep) → pass filled content to a generic `DocumentoPDF` React component → `renderToBuffer()` → Node.js `crypto.createHash('sha256')` of the Buffer → load .pfx from Storage via `createAdminClient()` → `decrypt(cert_password_enc)` via `src/lib/crypto.ts` → `node-forge` RSA sign of the SHA-256 digest → store Buffer in a private `documents-pdf` Supabase Storage bucket → write metadata + base64 signature to `document_versions`. This flow is fully verified: `renderToBuffer` returns a real `Buffer` starting with `%PDF`, SHA-256 is consistent between Node `crypto` and forge, RSA sign+verify works with the test-cert.pfx fixture (2048-bit RSA, 344-char base64 signature).

The DB schema mirrors v1's INSERT-only patterns: `dental_records` uses INSERT-only with no UPDATE/DELETE RLS policy; `anamneses` uses the same pattern for immutability. `document_versions` will use the same convention — RLS blocks UPDATE/DELETE for `status = 'signed'` rows. The `document_templates` table is a config-level resource (under the `config` module per `MODULE_PERMISSIONS`), accessible to admin/superadmin/ti/dpo.

**Primary recommendation:** Sign with RSA direct (node-forge `privateKey.sign(sha256Digest)`) rather than full PKCS#7 `createSignedData`. Reasoning: RSA direct is simpler, the base64 output is shorter (344 chars vs 1808+ chars), and for this phase the goal is a cryptographically verified signature + metadata record, not a CMS container (PAdES is deferred). Store the cert chain separately as `cert_pem` TEXT in `document_versions`. Full PKCS#7 CMS can be added in a future phase when PAdES is required.

---

## Standard Stack

### Core (all already installed — verified from package.json + node_modules)

| Library | Installed Version | Purpose | Status |
|---------|-----------------|---------|--------|
| `node-forge` | 1.4.0 | RSA sign of PDF hash; PKCS#12 .pfx load; SHA-1 thumbprint | [VERIFIED: node_modules/node-forge/package.json; forge.pkcs7.createSignedData, privateKey.sign, forge.md.sha256 all confirmed available] |
| `@react-pdf/renderer` | 4.5.1 | Server-side PDF generation; renderToBuffer returns Buffer starting with %PDF | [VERIFIED: npm view + local node test] |
| `@supabase/supabase-js` | ^2.107.0 | Supabase Storage for signed PDF files; DB for document tables | [VERIFIED: package.json] |
| `zod` | ^3.25.76 | Template schema validation (content, category, variable names) | [VERIFIED: package.json] |
| `react-hook-form` | ^7.77.0 | Template editor form + generate document form | [VERIFIED: package.json] |
| `@hookform/resolvers` | ^5.4.0 | Zod adapter for RHF | [VERIFIED: package.json] |
| `@base-ui/react` | ^1.5.0 | Behavioral primitives where shadcn has no equivalent | [VERIFIED: package.json] |
| Node.js `crypto` | built-in | SHA-256 hash of PDF bytes for DB storage + signature verification | [VERIFIED: crypto.createHash('sha256') matches forge SHA-256 for same Buffer input] |

### No New Production Dependencies Required

All dependencies are installed. Phase 8 reuses the exact same libraries as Phase 7 (node-forge, supabase admin client, crypto.ts). [VERIFIED: codebase inspection]

### Supporting (dev only)

| Library | Version | Purpose |
|---------|---------|---------|
| `vitest` | ^4.1.8 | Test runner (existing, no change) |
| `@types/node-forge` | ^1.3.14 | TypeScript types for node-forge (existing) |

**Installation:** None required. All dependencies installed.

---

## Architecture Patterns

### Recommended Project Structure for Phase 8

```
src/
├── lib/
│   └── icp/
│       ├── pfx-metadata.ts          # EXISTING — Phase 7
│       └── sign-document.ts         # NEW — Phase 8 signer
├── actions/
│   ├── certificate.ts               # EXISTING — Phase 7
│   ├── document-templates.ts        # NEW — CRUD templates
│   └── documents.ts                 # NEW — generate + sign
├── components/
│   ├── config/
│   │   └── DocumentosConfig.tsx     # NEW — template list + editor
│   └── pdf/
│       ├── ProntuarioPDF.tsx         # EXISTING
│       ├── ReceiboPDF.tsx            # EXISTING
│       └── DocumentoPDF.tsx          # NEW — generic document component
└── app/
    ├── (dashboard)/config/
    │   └── documentos/
    │       └── page.tsx             # NEW — route: /config/documentos
    └── api/
        └── documentos/
            └── [id]/
                └── route.ts         # NEW — PDF download route (nodejs runtime)

supabase/migrations/
├── 20260615000100_document_tables.sql    # document_templates, documents, document_versions
├── 20260615000200_document_rls.sql       # RLS + INSERT-only enforcement
└── 20260615000300_documents_bucket.sql   # documents-pdf private Storage bucket
```

### Pattern 1: RSA Direct Signing (D-01 Implementation)

**What:** Load .pfx from storage → decrypt password → extract private key via node-forge → SHA-256 of PDF Buffer → RSA sign digest → store base64 signature + cert metadata.

**When to use:** Phase 8 signing flow. The private key never leaves the server; decryption happens in RAM only.

**Verified API (tested against test-cert.pfx fixture):**
```typescript
// Source: verified via node REPL against node-forge 1.4.0 + test-cert.pfx
import 'server-only'
import forge from 'node-forge'
import { createHash } from 'crypto'
import { decrypt } from '@/lib/crypto'
import { createAdminClient } from '@/lib/supabase/admin'

export interface SignatureResult {
  sha256Hex: string          // SHA-256 of PDF bytes (hex) — stored in document_versions.content_hash
  signatureB64: string       // RSA signature of SHA-256 digest (base64) — stored in document_versions.signature
  signedAt: string           // ISO 8601 timestamp (server time)
  certSubjectCn: string      // cert.subject.CN — signer identity
  certThumbprintSha1: string // 40-char hex — cert identity
  certNotAfter: string       // ISO 8601 — cert validity at signing time
}

export async function signPdfBuffer(
  pdfBuffer: Buffer,
  certStoragePath: string,
  certPasswordEnc: string
): Promise<SignatureResult> {
  // 1. Decrypt password in memory — plaintext never persisted
  const password = decrypt(certPasswordEnc)

  // 2. Download .pfx bytes from private bucket via service role
  const admin = createAdminClient()
  const { data, error } = await admin.storage
    .from('icp-certificates')
    .download(certStoragePath)
  if (error || !data) throw new Error('Certificado não encontrado no keystore')
  const pfxBuffer = Buffer.from(await data.arrayBuffer())

  // 3. Load PKCS#12 — same pattern as pfx-metadata.ts
  const pfxDer = forge.util.binary.raw.encode(new Uint8Array(pfxBuffer))
  const pfxAsn1 = forge.asn1.fromDer(pfxDer)
  const pfx = forge.pkcs12.pkcs12FromAsn1(pfxAsn1, false, password)

  // 4. Extract cert + private key
  const CERT_BAG_OID = forge.pki.oids.certBag ?? '1.2.840.113549.1.12.10.1.3'
  const KEY_BAG_OID  = forge.pki.oids.pkcs8ShroudedKeyBag ?? '1.2.840.113549.1.12.10.1.2'
  const cert = pfx.getBags({ bagType: CERT_BAG_OID })[CERT_BAG_OID]?.[0]?.cert
  const privateKey = pfx.getBags({ bagType: KEY_BAG_OID })[KEY_BAG_OID]?.[0]?.key
  if (!cert || !privateKey) throw new Error('Chave privada ou certificado não encontrado no .pfx')

  // 5. SHA-256 of PDF bytes (Node crypto — consistent with forge, verified)
  const sha256Hex = createHash('sha256').update(pdfBuffer).digest('hex')

  // 6. RSA sign via forge: md must use the binary string representation of Buffer
  const md = forge.md.sha256.create()
  md.update(pdfBuffer.toString('binary'), 'raw')
  const signature = (privateKey as forge.pki.rsa.PrivateKey).sign(md)
  const signatureB64 = forge.util.encode64(signature)

  // 7. Cert identity for storage
  const certSubjectCn = (cert.subject.getField('CN') as { value: string } | null)?.value ?? ''
  const mdSha1 = forge.md.sha1.create()
  mdSha1.update(forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes())
  const certThumbprintSha1 = mdSha1.digest().toHex()

  return {
    sha256Hex,
    signatureB64,
    signedAt: new Date().toISOString(),
    certSubjectCn,
    certThumbprintSha1,
    certNotAfter: cert.validity.notAfter.toISOString(),
  }
}

// Verification (for audit/validation endpoint)
export function verifyPdfSignature(
  pdfBuffer: Buffer,
  signatureB64: string,
  certPem: string  // stored in document_versions.cert_pem
): boolean {
  const sig = forge.util.decode64(signatureB64)
  const cert = forge.pki.certificateFromPem(certPem)
  const md = forge.md.sha256.create()
  md.update(pdfBuffer.toString('binary'), 'raw')
  return cert.publicKey.verify(md.digest().bytes(), sig)
}
```

**Pitfall:** `md.digest()` consumes the MessageDigest object. For signing, call `privateKey.sign(md)` — it internally digests. For verification, reconstruct the digest with a fresh `md2.create()`. [VERIFIED: tested in REPL]

### Pattern 2: Template Variable Engine (No New Dependency)

**What:** Detect `{{var}}` placeholders in template content and replace them from a context object.

**When to use:** Server-side only, called in the `generateDocument` Server Action.

```typescript
// Source: [VERIFIED — regex approach, no dependency required]
// Pure TypeScript, no library. Global replace handles multiple occurrences.

type DocumentContext = {
  nome_paciente?: string
  cpf_paciente?: string
  data_nascimento?: string
  nome_clinica?: string
  cnpj_clinica?: string
  nome_profissional?: string
  cro_profissional?: string
  data_documento?: string    // formatted dd/MM/yyyy
  numero_documento?: string  // sequential, padded
  unidade?: string
  [key: string]: string | undefined
}

export function fillTemplate(content: string, ctx: DocumentContext): string {
  return content.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    return ctx[key] ?? match  // leave unresolved vars as-is (not empty)
  })
}

export function detectVariables(content: string): string[] {
  const matches = [...content.matchAll(/\{\{(\w+)\}\}/g)]
  return [...new Set(matches.map(m => m[1]))]
}
```

**Initial variable set (Claude's Discretion):**
| Variable | Source |
|----------|--------|
| `{{nome_paciente}}` | `patients.full_name` |
| `{{cpf_paciente}}` | `patients.cpf` |
| `{{data_nascimento}}` | `patients.date_of_birth` formatted pt-BR |
| `{{nome_clinica}}` | `clinics.name` |
| `{{cnpj_clinica}}` | `clinics.cnpj` |
| `{{nome_profissional}}` | `users.full_name` (actor) |
| `{{cro_profissional}}` | `users.cro` (Phase 11; leave blank if absent) |
| `{{data_documento}}` | `new Date()` at generation time, pt-BR |
| `{{numero_documento}}` | sequential, zero-padded (`document_versions.version_number` + document sequence) |
| `{{unidade}}` | `units.name` (from actor's unit, Phase 7) |

### Pattern 3: Generic DocumentoPDF Component (Reusing ProntuarioPDF Pattern)

**What:** A reusable `@react-pdf/renderer` component that renders filled template content + an optional signature block at the bottom. Mirrors `ProntuarioPDF.tsx` exactly in structure (Roboto font, A4, Flexbox only).

**Critical constraints (CLAUDE.md + existing PDFs):**
- `export const runtime = 'nodejs'` on the download route (Edge runtime has no Buffer support for @react-pdf/renderer)
- `Font.register` with Roboto for Latin Extended (same URLs as ProntuarioPDF) — must be called once at module level
- Flexbox only — no `display: 'grid'` (not supported by @react-pdf/renderer)
- `renderToBuffer()` returns a Node.js `Buffer` directly — convert to `Uint8Array` for Response BodyInit
- No `'use client'` — server-only module

```typescript
// Pattern: mirrors ProntuarioPDF.tsx exactly
// Source: [VERIFIED — src/components/pdf/ProntuarioPDF.tsx]
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer'

Font.register({
  family: 'Roboto',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Mu4mxK.woff2', fontWeight: 400 },
    { src: 'https://fonts.gstatic.com/s/roboto/v30/KFOlCnqEu92Fr1MmEU9fBBc4.woff2', fontWeight: 700 },
  ],
})

interface DocumentoPDFProps {
  clinicName: string
  title: string
  content: string           // filled template content ({{vars}} already replaced)
  documentNumber: string
  generatedAt: string       // ISO string
  signatureBlock?: {        // undefined = unsigned draft
    signerCn: string
    signedAt: string
    thumbprintSha1: string
    sha256Hex: string
  }
}
```

**Where to store the generated PDF:** Private Supabase Storage bucket `documents-pdf` (not DB bytea). Path: `{clinic_id}/{document_id}/{version_number}.pdf`. Service role (createAdminClient) for upload; same download pattern as icp-certificates.

### Pattern 4: Database Schema (D-03)

**What:** Three-table design mirroring v1 prontuário immutability patterns.

```sql
-- Migration 20260615000100_document_tables.sql

-- ─── document_templates ──────────────────────────────────────────────────────
-- Config-level resource: shared across the clinic, editable by admin only.
CREATE TABLE public.document_templates (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id    UUID        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name         TEXT        NOT NULL,
  category     TEXT        NOT NULL,   -- e.g. 'declaracao', 'contrato', 'autorizacao'
  content      TEXT        NOT NULL,   -- markdown/rich-text with {{var}} placeholders
  variables    TEXT[]      NOT NULL DEFAULT '{}',  -- detected variable names
  is_active    BOOLEAN     NOT NULL DEFAULT true,
  created_by   UUID        REFERENCES public.users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at   TIMESTAMPTZ             -- soft delete
);
CREATE INDEX idx_document_templates_clinic ON public.document_templates(clinic_id);
CREATE INDEX idx_document_templates_category ON public.document_templates(clinic_id, category);

-- ─── documents ───────────────────────────────────────────────────────────────
-- Document header: one row per document instance (patient-facing, or generic).
CREATE TABLE public.documents (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id        UUID        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  unit_id          UUID        REFERENCES public.units(id),         -- Phase 7 multi-unit
  template_id      UUID        REFERENCES public.document_templates(id),
  patient_id       UUID        REFERENCES public.patients(id),      -- nullable (not all docs are patient-facing)
  category         TEXT        NOT NULL,
  status           TEXT        NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft', 'signed')),
  current_version  INTEGER     NOT NULL DEFAULT 1,
  created_by       UUID        REFERENCES public.users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at       TIMESTAMPTZ
);
CREATE INDEX idx_documents_clinic ON public.documents(clinic_id);
CREATE INDEX idx_documents_unit ON public.documents(unit_id) WHERE unit_id IS NOT NULL;
CREATE INDEX idx_documents_patient ON public.documents(patient_id) WHERE patient_id IS NOT NULL;
CREATE INDEX idx_documents_status ON public.documents(clinic_id, status);

-- ─── document_versions ────────────────────────────────────────────────────────
-- Append-only: INSERT-only when signed. No UPDATE/DELETE on signed versions.
CREATE TABLE public.document_versions (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id    UUID        NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  clinic_id      UUID        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  version_number INTEGER     NOT NULL,
  content        TEXT        NOT NULL,   -- filled content (vars replaced)
  content_hash   TEXT        NOT NULL,   -- SHA-256 hex of PDF bytes (for verification)
  storage_path   TEXT,                   -- path in documents-pdf bucket (null until signed)
  signature      TEXT,                   -- RSA base64 (null = unsigned draft)
  cert_pem       TEXT,                   -- PEM of signing cert (for offline verification)
  signer_cn      TEXT,                   -- cert subject CN (display)
  cert_thumbprint TEXT,                  -- SHA-1 thumbprint (display/correlation)
  cert_not_after TEXT,                   -- ISO cert expiry at signing time
  signed_at      TIMESTAMPTZ,            -- server timestamp of signing
  signed_by      UUID        REFERENCES public.users(id),
  supersedes_id  UUID        REFERENCES public.document_versions(id),  -- previous version
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (document_id, version_number)
);
CREATE INDEX idx_doc_versions_document ON public.document_versions(document_id, version_number);
CREATE INDEX idx_doc_versions_clinic ON public.document_versions(clinic_id);
```

### Pattern 5: RLS — INSERT-only for Signed Versions

```sql
-- Migration 20260615000200_document_rls.sql

-- document_templates: admin/superadmin/ti write; all tenant members read
ALTER TABLE public.document_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "doc_templates_tenant_read" ON public.document_templates
  FOR SELECT USING (clinic_id = get_my_tenant_id() AND deleted_at IS NULL);

CREATE POLICY "doc_templates_admin_write" ON public.document_templates
  FOR ALL
  USING (clinic_id = get_my_tenant_id() AND get_my_role() IN ('admin', 'superadmin', 'ti'))
  WITH CHECK (clinic_id = get_my_tenant_id() AND get_my_role() IN ('admin', 'superadmin', 'ti'));

-- documents: all authenticated staff read; staff write (dentist/admin/receptionist)
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "documents_tenant_read" ON public.documents
  FOR SELECT USING (clinic_id = get_my_tenant_id());

CREATE POLICY "documents_staff_write" ON public.documents
  FOR ALL
  USING (clinic_id = get_my_tenant_id() AND get_my_role() IN ('admin', 'superadmin', 'dentist', 'receptionist', 'ti'))
  WITH CHECK (clinic_id = get_my_tenant_id() AND get_my_role() IN ('admin', 'superadmin', 'dentist', 'receptionist', 'ti'));

-- document_versions: INSERT-only (mirrors dental_records pattern)
-- Signed versions: no UPDATE, no DELETE ever (immutability contract D-03)
ALTER TABLE public.document_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "doc_versions_tenant_read" ON public.document_versions
  FOR SELECT USING (clinic_id = get_my_tenant_id());

-- INSERT-only for all eligible staff: never UPDATE or DELETE
CREATE POLICY "doc_versions_staff_insert" ON public.document_versions
  FOR INSERT
  WITH CHECK (
    clinic_id = get_my_tenant_id()
    AND get_my_role() IN ('admin', 'superadmin', 'dentist', 'receptionist', 'ti')
  );

-- No UPDATE or DELETE policies: signed versions are forever immutable.
-- If status becomes 'signed', the document_versions row cannot be changed.
-- Drafts can be superseded by a new version (supersedes_id) but not deleted.
```

### Pattern 6: Storage Bucket for Signed PDFs

```sql
-- Migration 20260615000300_documents_bucket.sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents-pdf', 'documents-pdf', false)
ON CONFLICT (id) DO NOTHING;
-- No storage.objects RLS: service role (createAdminClient) is the sole accessor.
-- Pattern mirrors icp-certificates bucket (20260614000500_certificates.sql).
```

### Anti-Patterns to Avoid

- **Edge runtime for the PDF download route:** `@react-pdf/renderer` requires Node.js (`Buffer`, `fs`). Always set `export const runtime = 'nodejs'` on the route. [VERIFIED: existing routes ProntuarioPDF and ReceiboPDF both do this]
- **Signing the wrong bytes:** The PDF bytes signed must be the FINAL `renderToBuffer()` output. Never sign a draft or a pre-render buffer. Sign → store the exact bytes that go into Storage.
- **Calling `md.digest()` twice on the same object:** forge's MessageDigest is consumed. For sign: call `privateKey.sign(md)` (sign internally computes digest). For verify: create a fresh `md2 = forge.md.sha256.create()` and re-update before calling `cert.publicKey.verify(digest.bytes(), sig)`. [VERIFIED: REPL testing]
- **Storing cert_password_enc or storage_path of the .pfx in document_versions:** Document signing reads the cert server-side via `createAdminClient()`. The PFX path and encrypted password stay in `certificates` table — never copied to document tables.
- **PKCS#7 `createSignedData` for the stored signature blob:** PKCS#7 is 1808+ bytes base64 (verified). RSA direct sign is 344 bytes (verified). Use RSA direct for Phase 8 storage; PAdES/PKCS#7 CMS is deferred.
- **Using `cert.toAsn1()` for thumbprint:** Does not exist in node-forge 1.4.0. Use `forge.pki.certificateToAsn1(cert)` — confirmed in Phase 7 SUMMARY 07-03. [VERIFIED: existing pfx-metadata.ts uses this]
- **'use server' files exporting non-async values:** Next.js 16 build fails. Extract constants/types to a separate `src/lib/document-types.ts` file. Pattern from Phase 7 (`ai-agent-config-types.ts`). [VERIFIED: 07-06-SUMMARY.md]

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| RSA signing | Custom PKCS#8 key loading + OpenSSL | `node-forge` privateKey.sign(md) | Already installed; tested; handles ICP-Brasil A1 2048-bit keys |
| PDF generation | HTML→PDF conversion, Puppeteer | `@react-pdf/renderer` renderToBuffer | Already installed; 100% serverless-compatible; CLAUDE.md mandate |
| SHA-256 hash | Manual byte hashing | `crypto.createHash('sha256')` (built-in Node.js) | Consistent with forge SHA-256; verified in REPL |
| Template variable replacement | Handlebars, Mustache, nunjucks | Inline regex `replace(/\{\{(\w+)\}\}/g, ...)` | Zero dependency; 3 lines; fully sufficient for `{{var}}` syntax |
| Immutable document versioning | Custom event sourcing | Supabase RLS INSERT-only pattern (dental_records) | Already proven in v1; auditable; no DELETE RLS policy needed |
| Cert chain identity storage | X.509 parsing library | Store `cert_pem` TEXT + `signer_cn` + `thumbprint_sha1` | forge already extracts these; PEM is portable for offline verification |

**Key insight:** The entire Phase 8 technical stack is installed and verified. New code is plumbing, not infrastructure.

---

## Runtime State Inventory

Phase 8 is a greenfield feature addition (new tables, new routes, new bucket). No runtime state from a rename or refactor.

**Checking each category explicitly:**

| Category | Items | Action |
|----------|-------|--------|
| Stored data | No existing document_templates / documents / document_versions records — tables don't exist yet | None (tables created in migrations) |
| Live service config | No existing documents-pdf bucket — must be created in migration | Migration 20260615000300_documents_bucket.sql |
| OS-registered state | None | None |
| Secrets/env vars | No new env vars. ENCRYPTION_KEY (existing) decrypts cert password. SUPABASE_SERVICE_ROLE_KEY (existing) accesses storage. | None — reuse existing |
| Build artifacts | None | None |

---

## Common Pitfalls

### Pitfall 1: Signing a PDF That Later Changes
**What goes wrong:** Template render happens → content modified → sign the original bytes → storage bytes differ from signed bytes → verification always fails.
**Why it happens:** If the fill-and-render step is separated from the sign step with any mutation in between.
**How to avoid:** The Server Action flow must be atomic: fill variables → `renderToBuffer()` → `createHash('sha256')` → RSA sign → upload to Storage (exact same Buffer) → insert `document_versions` row — all in the same server action execution, no re-renders.
**Warning signs:** `verified = false` during the sign-verify test. Content hash in DB does not match hash of downloaded PDF bytes.

### Pitfall 2: md.digest() Consumed After Sign
**What goes wrong:** `md.digest()` is called after `privateKey.sign(md)`, or the same `md` object is used twice.
**Why it happens:** forge's MessageDigest is stateful and consumed after `.sign()`.
**How to avoid:** For sign: `privateKey.sign(md)` internally finalizes the digest. For verify: `const md2 = forge.md.sha256.create(); md2.update(..., 'raw'); cert.publicKey.verify(md2.digest().bytes(), sig)` — always a fresh object. [VERIFIED: REPL testing]

### Pitfall 3: Buffer.toString('binary') for forge input
**What goes wrong:** `md.update(pdfBuffer)` (passing Buffer directly) produces wrong hash — forge expects a binary string, not a Node Buffer.
**Why it happens:** forge predates Node.js Buffer; it operates on JS binary strings (Latin1 encoding).
**How to avoid:** Always: `md.update(pdfBuffer.toString('binary'), 'raw')`. The `'raw'` encoding flag tells forge the string is already binary-encoded. [VERIFIED: SHA-256 hex from `crypto.createHash('sha256').update(buf)` matches `forge.md.sha256.create(); md.update(buf.toString('binary'), 'raw'); md.digest().toHex()` — tested in REPL]

### Pitfall 4: cert.toAsn1() Does Not Exist
**What goes wrong:** `TypeError: cert.toAsn1 is not a function` when computing SHA-1 thumbprint.
**Why it happens:** node-forge 1.4.0 cert objects from `certBag.cert` do not have a `toAsn1()` method.
**How to avoid:** Use `forge.pki.certificateToAsn1(cert)` — confirmed fix from Phase 7 07-03-SUMMARY.md. Already used in `pfx-metadata.ts`.

### Pitfall 5: 'use server' File Exporting Non-Async Constants
**What goes wrong:** Next.js 16 build fails with "A 'use server' file can only export async functions, found object".
**Why it happens:** Server Action files are restricted to async function exports.
**How to avoid:** Extract document category constants, TypeScript types, and configuration objects to `src/lib/document-types.ts` — no 'use server' directive. Pattern established in Phase 7 (`src/lib/ai-agent-config-types.ts`). [VERIFIED: 07-06-SUMMARY.md]

### Pitfall 6: NODE runtime on PDF Download Route
**What goes wrong:** @react-pdf/renderer throws at render time in Edge runtime (no Buffer, no fs).
**Why it happens:** Edge runtime strips Node.js built-ins.
**How to avoid:** All routes calling `renderToBuffer` must export `export const runtime = 'nodejs'`. Confirmed pattern in both `prontuario.pdf/route.ts` and `recibo.pdf/route.ts`. [VERIFIED: codebase]

### Pitfall 7: Missing db push After Migration (Supabase Auth Gotcha)
**What goes wrong:** `supabase db push` fails with auth error connecting to wrong Supabase org.
**Why it happens:** Supabase CLI is logged into the nexus-* account instead of org `kczvihafddupruvsrrsc` (project `jqjwyqlbbuqnrffdnlpp`).
**How to avoid:** Before `supabase db push`, verify: `supabase projects list` shows project `jqjwyqlbbuqnrffdnlpp`. If not, re-login: `supabase login`. After each migration push, regenerate types: `supabase gen types typescript --project-id jqjwyqlbbuqnrffdnlpp > src/types/database.types.ts`. [VERIFIED: MEMORY.md Supabase gotcha note]

### Pitfall 8: document_versions column-level secrets
**What goes wrong:** `storage_path` and `cert_pem` in `document_versions` are potentially sensitive (path reveals bucket structure; cert PEM is public but should be access-controlled).
**Why it happens:** Unlike `certificates` table (which has explicit `REVOKE SELECT` on `cert_password_enc`), document_versions may not have column-level restrictions.
**How to avoid:** `storage_path` is in `document_versions` — it should be SELECT-restricted to admin/superadmin/ti at minimum (same as certificates pattern). `cert_pem` is public data but only relevant for verification UI — restrict to same staff roles that can view documents. Apply `REVOKE SELECT (storage_path)` on authenticated/anon in a migration, or rely on the Server Action (service role only) for download links. [ASSUMED — decide in planning]

---

## Code Examples

### Example 1: Full Sign Flow (Server Action)

```typescript
// src/actions/documents.ts — 'use server'
// Source: verified API from REPL testing + Phase 7 patterns
import 'server-only'
import { createHash } from 'crypto'
import { createElement } from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import forge from 'node-forge'
import { createAdminClient } from '@/lib/supabase/admin'
import { decrypt } from '@/lib/crypto'
import { DocumentoPDF } from '@/components/pdf/DocumentoPDF'

export async function signDocument(documentVersionId: string): Promise<{ success: boolean; error?: string }> {
  // 1. Get cert metadata (storage_path + cert_password_enc) via service role
  const admin = createAdminClient()
  const { data: cert } = await admin
    .from('certificates')
    .select('storage_path, cert_password_enc, subject_cn, thumbprint_sha1, not_after')
    .eq('clinic_id', actor.tenant_id)
    .is('deleted_at', null)
    .single()
  
  // 2. Get document version content
  const { data: version } = await admin
    .from('document_versions')
    .select('content, document_id')
    .eq('id', documentVersionId)
    .single()

  // 3. Render PDF
  const pdfElement = createElement(DocumentoPDF, { /* props */ })
  const pdfBuffer = await renderToBuffer(pdfElement)

  // 4. SHA-256 of PDF bytes
  const sha256Hex = createHash('sha256').update(pdfBuffer).digest('hex')

  // 5. Load PFX + sign
  const password = decrypt(cert.cert_password_enc)
  const { data: pfxBlob } = await admin.storage.from('icp-certificates').download(cert.storage_path)
  const pfxBuffer = Buffer.from(await pfxBlob.arrayBuffer())
  const pfxDer = forge.util.binary.raw.encode(new Uint8Array(pfxBuffer))
  const pfx = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(pfxDer), false, password)
  const CERT_OID = forge.pki.oids.certBag ?? '1.2.840.113549.1.12.10.1.3'
  const KEY_OID  = forge.pki.oids.pkcs8ShroudedKeyBag ?? '1.2.840.113549.1.12.10.1.2'
  const forgeCert = pfx.getBags({ bagType: CERT_OID })[CERT_OID]![0]!.cert!
  const privateKey = pfx.getBags({ bagType: KEY_OID })[KEY_OID]![0]!.key!
  const md = forge.md.sha256.create()
  md.update(pdfBuffer.toString('binary'), 'raw')
  const signatureB64 = forge.util.encode64((privateKey as forge.pki.rsa.PrivateKey).sign(md))

  // 6. Upload PDF to private bucket
  const storagePath = `${actor.tenant_id}/${version.document_id}/${documentVersionId}.pdf`
  await admin.storage.from('documents-pdf').upload(storagePath, new Uint8Array(pdfBuffer), {
    contentType: 'application/pdf', upsert: false
  })

  // 7. Update version with signature (only append new data — no content change)
  await admin.from('document_versions').update({
    content_hash: sha256Hex,
    signature: signatureB64,
    storage_path: storagePath,
    cert_pem: forge.pki.certificateToPem(forgeCert),
    signer_cn: forgeCert.subject.getField('CN')?.value ?? '',
    cert_thumbprint: cert.thumbprint_sha1,
    cert_not_after: cert.not_after,
    signed_at: new Date().toISOString(),
    signed_by: actor.id,
  }).eq('id', documentVersionId)

  // 8. Update documents.status = 'signed'
  await admin.from('documents').update({ status: 'signed' }).eq('id', version.document_id)

  return { success: true }
}
```

### Example 2: Verification Test Pattern

```typescript
// src/__tests__/icp/sign-document.test.ts
// Source-inspection + real crypto test using test-cert.pfx fixture
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import forge from 'node-forge'
import { createHash } from 'crypto'

const FIXTURE_PATH = resolve(process.cwd(), 'src/__tests__/icp/fixtures/test-cert.pfx')

it('signs PDF bytes and verifies with cert public key', () => {
  const pfxBuf = readFileSync(FIXTURE_PATH)
  const pfxDer = forge.util.binary.raw.encode(new Uint8Array(pfxBuf))
  const pfx = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(pfxDer), false, 'test1234')
  const CERT_OID = forge.pki.oids.certBag ?? '1.2.840.113549.1.12.10.1.3'
  const KEY_OID  = forge.pki.oids.pkcs8ShroudedKeyBag ?? '1.2.840.113549.1.12.10.1.2'
  const cert = pfx.getBags({ bagType: CERT_OID })[CERT_OID]![0]!.cert!
  const privateKey = pfx.getBags({ bagType: KEY_OID })[KEY_OID]![0]!.key!

  const fakePdf = Buffer.from('%PDF-1.4 fake content')
  
  // SHA-256 via Node crypto (stored in DB)
  const sha256Hex = createHash('sha256').update(fakePdf).digest('hex')
  expect(sha256Hex).toHaveLength(64)

  // Sign
  const md = forge.md.sha256.create()
  md.update(fakePdf.toString('binary'), 'raw')
  const sig = (privateKey as forge.pki.rsa.PrivateKey).sign(md)
  const sigB64 = forge.util.encode64(sig)
  expect(sigB64).toHaveLength(344) // 2048-bit RSA = 256 bytes = 344 base64 chars

  // Verify with public key
  const md2 = forge.md.sha256.create()
  md2.update(fakePdf.toString('binary'), 'raw')
  const verified = cert.publicKey.verify(md2.digest().bytes(), sig)
  expect(verified).toBe(true)

  // Cert thumbprint via certificateToAsn1 (not cert.toAsn1 — does not exist)
  const mdSha1 = forge.md.sha1.create()
  mdSha1.update(forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes())
  expect(mdSha1.digest().toHex()).toMatch(/^[0-9a-f]{40}$/)
})
```

### Example 3: Template Variable Fill

```typescript
// No dependency needed. Pure regex. [VERIFIED: built-in JS]
export function fillTemplate(content: string, ctx: Record<string, string | undefined>): string {
  return content.replace(/\{\{(\w+)\}\}/g, (match, key: string) => ctx[key] ?? match)
}

export function detectVariables(content: string): string[] {
  return [...new Set([...content.matchAll(/\{\{(\w+)\}\}/g)].map(m => m[1]))]
}
```

---

## State of the Art

| Old Approach | Current Approach | Notes |
|--------------|-----------------|-------|
| PAdES embedded in PDF (deferred) | RSA direct sign of PDF SHA-256 + metadata stored separately | PAdES is phase 2+ refinement; current approach is fully verifiable cryptographically |
| `@supabase/auth-helpers-nextjs` (deprecated) | `@supabase/ssr` | Already using correct package |
| `cert.toAsn1()` | `forge.pki.certificateToAsn1(cert)` | node-forge 1.4.0 API — confirmed in Phase 7 |

**Deprecated/outdated:**
- `forge.pkcs7.createSignedData` for this use case: Valid API but produces 1808+ byte base64 vs 344 bytes for RSA direct. Use RSA direct for Phase 8; PKCS#7 CMS reserved for future PAdES.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `document_versions.storage_path` should have column-level REVOKE on authenticated/anon (like certificates table) | Common Pitfalls #8 | Low — storage access is service-role-only; column restriction is defense-in-depth; not blocking |
| A2 | `cert_pem` TEXT (PEM of the signing cert) stored in `document_versions` is sufficient for offline verification | Architecture — Schema | Low — PEM is public data from the cert chain; if intermediate CA chain is needed, additional `cert_chain_pem` column can be added |
| A3 | Template content stored as plain markdown/text (not encrypted) | Architecture — Schema | Low — template content is admin-authored boilerplate, not patient PHI; filled content in `document_versions.content` may contain patient data and could be encrypted in a future phase |
| A4 | `documents.unit_id` is nullable (not all documents are unit-specific) | Architecture — Schema | Low — consistent with Phase 7 pattern for `ai_agent_config` (partial unique indexes); nullable FK preferred |

**If this table is empty:** All other claims in this research were verified or cited.

---

## Open Questions

1. **Should `document_versions.content` (filled template text) be AES-256-GCM encrypted?**
   - What we know: `patients.medical_history` is encrypted; template content after filling may include patient name, CPF, date of birth.
   - What's unclear: Whether the security/LGPD requirement extends to the filled document content, or whether the signed PDF (in Storage) is the authoritative artifact and DB content is just metadata.
   - Recommendation: Encrypt filled content (AES via `encryptJSON`) using `src/lib/crypto.ts` for LGPD compliance, since it may contain PII. Add `is_content_encrypted BOOLEAN DEFAULT true` column. The PDF in Storage is protected by private bucket + service-role access. Planner to confirm.

2. **Should `document_versions.signature` be verified server-side before returning the PDF download?**
   - What we know: The sign flow is atomic; verification is a separate utility.
   - What's unclear: Whether to verify on every download (adds latency) or only on-demand via a dedicated "verificar assinatura" endpoint.
   - Recommendation: Verify on-demand only (separate endpoint), not on every download. Sign step is the integrity gate.

3. **RBAC for `/config/documentos` route: which roles?**
   - What we know: `MODULE_PERMISSIONS` maps `/config` to admin/superadmin/ti (write), dpo/socio (readOnly), implantacao (readOnly). Dentist does not have config access. But dentists will generate documents.
   - What's unclear: Whether document generation lives under `/config` or under `/clinica`.
   - Recommendation: Template management (`/config/documentos/modelos`) under `config` module (admin/superadmin/ti). Document generation + signing can be accessible from `/clinica` context (dentist generates a document for patient). This requires either adding a `documentos` ModuleKey or re-routing generation to `/clinica/documentos`. Planner to decide.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| node-forge | RSA signing, PKCS#12 load | Yes | 1.4.0 | — |
| @react-pdf/renderer | PDF generation | Yes | 4.5.1 | — |
| Supabase project jqjwyqlbbuqnrffdnlpp | DB + Storage | Yes | CLI 2.105.0 | — |
| Node.js crypto (built-in) | SHA-256 hashing | Yes | Node 20+ built-in | — |
| test-cert.pfx fixture | Sign/verify unit tests | Yes | `src/__tests__/icp/fixtures/test-cert.pfx` exists | — |
| supabase CLI | db push migrations | Yes | ^2.105.0 | — |

**Missing dependencies with no fallback:** None.

**Notes:** Supabase re-auth gotcha: CLI may be logged into wrong account. Before `supabase db push`, run `supabase projects list` and verify project `jqjwyqlbbuqnrffdnlpp` is visible. [VERIFIED: MEMORY.md]

---

## Validation Architecture

Nyquist validation is enabled (`workflow.nyquist_validation: true`).

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.8 |
| Config file | `vitest.config.ts` (root) |
| Setup file | `src/__tests__/setup.ts` (server-only mock + require.cache) |
| Quick run command | `npx vitest run src/__tests__/icp/` |
| Full suite command | `npx vitest run` |

**Baseline:** 657 tests, 43 files, all GREEN. [VERIFIED: test run 2026-06-14]

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DOC-01 | `fillTemplate()` replaces `{{var}}` from context | unit | `npx vitest run src/__tests__/documents/template-engine.test.ts` | Wave 0 |
| DOC-01 | `detectVariables()` extracts `{{var}}` names from content | unit | `npx vitest run src/__tests__/documents/template-engine.test.ts` | Wave 0 |
| DOC-01 | `document_templates` migration creates correct table + indexes | source-inspection | `npx vitest run src/__tests__/migrations/phase8.test.ts` | Wave 0 |
| DOC-01 | `document-templates.ts` Server Action exports async functions | source-inspection | `npx vitest run src/__tests__/documents/actions.test.ts` | Wave 0 |
| DOC-02 | RSA sign of PDF Buffer bytes produces 344-char base64 signature | unit (crypto) | `npx vitest run src/__tests__/icp/sign-document.test.ts` | Wave 0 |
| DOC-02 | Verification with cert public key returns `true` | unit (crypto) | `npx vitest run src/__tests__/icp/sign-document.test.ts` | Wave 0 |
| DOC-02 | SHA-256 from Node crypto matches forge SHA-256 for same Buffer | unit (crypto) | `npx vitest run src/__tests__/icp/sign-document.test.ts` | Wave 0 |
| DOC-02 | `sign-document.ts` is server-only (import 'server-only') | source-inspection | `npx vitest run src/__tests__/icp/sign-document.test.ts` | Wave 0 |
| DOC-02 | `signDocument` Server Action exists and is async | source-inspection | `npx vitest run src/__tests__/documents/actions.test.ts` | Wave 0 |
| DOC-03 | `document_versions` migration has INSERT-only RLS (no UPDATE/DELETE policy) | source-inspection | `npx vitest run src/__tests__/migrations/phase8.test.ts` | Wave 0 |
| DOC-03 | `document_versions` migration has UNIQUE(document_id, version_number) | source-inspection | `npx vitest run src/__tests__/migrations/phase8.test.ts` | Wave 0 |
| DOC-03 | `DocumentoPDF` exists, uses Flexbox, registers Font | source-inspection | `npx vitest run src/__tests__/pdf/documento.test.ts` | Wave 0 |
| All | `npx tsc --noEmit` exits 0 after each wave | type check | `npx tsc --noEmit` | N/A |
| All | `npx next build` succeeds (no edge runtime violations) | build | `npx next build` | N/A |

### Sampling Rate

- **Per task commit:** `npx vitest run src/__tests__/icp/ src/__tests__/documents/ src/__tests__/migrations/phase8.test.ts src/__tests__/pdf/documento.test.ts`
- **Per wave merge:** `npx vitest run` (full suite, all 43+ files)
- **Phase gate:** Full suite green + `npx tsc --noEmit` exit 0 + `npx next build` green before `/gsd-verify-work`

### Wave 0 Gaps (test files to create before implementation)

- [ ] `src/__tests__/icp/sign-document.test.ts` — DOC-02 crypto sign+verify using test-cert.pfx fixture
- [ ] `src/__tests__/documents/template-engine.test.ts` — DOC-01 `fillTemplate` + `detectVariables`
- [ ] `src/__tests__/migrations/phase8.test.ts` — DOC-01/02/03 migration source-inspection
- [ ] `src/__tests__/documents/actions.test.ts` — DOC-01/02/03 Server Action source-inspection
- [ ] `src/__tests__/pdf/documento.test.ts` — DOC-01/02 DocumentoPDF source-inspection

**Test infrastructure needed:** `__mocks__/server-only.js` and `src/__tests__/setup.ts` already exist (Phase 7). No additional setup required for sign-document.ts (same pattern as pfx-metadata.test.ts).

---

## Security Domain

Security enforcement is enabled (default).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes | `createClient()` + `auth.getUser()` on every Server Action; service role for storage |
| V3 Session Management | No | Handled by @supabase/ssr (Phase 1, unchanged) |
| V4 Access Control | Yes | `assertNotReadOnly()` first in all mutations; role gate admin/dentist/receptionist; RLS on all three tables |
| V5 Input Validation | Yes | Zod schema for template content/name/category; variable names validated against allowlist |
| V6 Cryptography | Yes | AES-256-GCM for cert password (existing `src/lib/crypto.ts`); SHA-256 + RSA-2048 for document signing — no hand-roll |
| V7 Error Handling | Yes | Never expose internal errors to client; Portuguese user-facing messages only |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Private key exfiltration | Information Disclosure | `import 'server-only'` on `sign-document.ts`; key loaded in memory only; never serialized or logged |
| Template injection via `{{var}}` values | Tampering | Context values are DB-fetched (not user-controlled free text in the signing path); variable names validated against allowlist |
| Signing a tampered PDF | Tampering | SHA-256 stored in `document_versions.content_hash`; verification endpoint compares hash of downloaded PDF vs stored hash |
| Read-only role triggering sign | Elevation of Privilege | `assertNotReadOnly()` first in `signDocument`; auditor/dpo/socio cannot sign |
| Cross-tenant document access | Information Disclosure | RLS `clinic_id = get_my_tenant_id()` on all three tables; admin client used only for signing (not for data reads) |
| Exposing `storage_path` of signed PDFs | Information Disclosure | Server Action returns a signed URL with TTL (Supabase `createSignedUrl`), not the raw path; raw path never sent to client |
| PDF download route caching sensitive content | Information Disclosure | `Cache-Control: no-store, no-cache` — same as prontuario.pdf route |

---

## Project Constraints (from CLAUDE.md)

| Constraint | Applies to Phase 8 | How Enforced |
|------------|-------------------|--------------|
| PDF: @react-pdf/renderer, Flexbox only, NEVER Puppeteer/HTML→PDF | YES — `DocumentoPDF.tsx` | `export const runtime = 'nodejs'`; no CSS Grid; Font.register at module level |
| @base-ui/react for primitives not in shadcn | YES — template editor | Use `shadcn add` first; @base-ui only where shadcn lacks equivalent |
| RLS: USING + WITH CHECK on all write policies | YES — 3 new tables | INSERT-only on document_versions (no UPDATE policy); explicit WITH CHECK on all write policies |
| Index every clinic_id column | YES | `idx_document_templates_clinic`, `idx_documents_clinic`, `idx_doc_versions_clinic` |
| Supabase: no schema changes via dashboard | YES | All changes via `supabase/migrations/` + `supabase db push` |
| Latency < 200ms | PARTIAL — PDF generation is async (30s budget) | PDF route uses `maxDuration = 30`; non-PDF reads are standard DB queries |
| LGPD: soft delete, audit trail, data masking | YES | `deleted_at` on templates + documents; `logBusinessEvent` on sign action; filled content may need encryption (Open Question 1) |
| Never store service role key client-side | YES | `createAdminClient()` is server-only; never `NEXT_PUBLIC_` prefix |
| `'use server'` files: async functions only | YES | Constants/types extracted to `src/lib/document-types.ts` |

---

## Sources

### Primary (HIGH confidence)

- `node_modules/node-forge/package.json` — version 1.4.0 confirmed installed
- `node-forge` REPL testing (2026-06-14) — `forge.pkcs7.createSignedData`, `privateKey.sign(md)`, `cert.publicKey.verify()`, detached signature, PKCS#7 sizes all verified against `test-cert.pfx` fixture [VERIFIED]
- `@react-pdf/renderer` REPL testing (2026-06-14) — `renderToBuffer` returns Buffer, `%PDF` header confirmed, SHA-256 of output verified [VERIFIED]
- `src/lib/icp/pfx-metadata.ts` — existing Phase 7 PKCS#12 loading pattern, `forge.pki.certificateToAsn1(cert)` thumbprint API [VERIFIED: codebase]
- `src/lib/crypto.ts` — AES-256-GCM `encrypt`/`decrypt` functions, `iv:authTag:ciphertext` format [VERIFIED: codebase]
- `src/actions/certificate.ts` — `createAdminClient()` bucket access, `encrypt(password)`, cert metadata insert, `CertificatePublic` Omit type [VERIFIED: codebase]
- `src/components/pdf/ProntuarioPDF.tsx` + `ReceiboPDF.tsx` — exact Font.register URLs, Flexbox-only patterns, `renderToBuffer` + `createElement` usage [VERIFIED: codebase]
- `src/app/api/patients/[id]/prontuario.pdf/route.ts` — `export const runtime = 'nodejs'`, `maxDuration = 30`, Buffer→Uint8Array conversion [VERIFIED: codebase]
- `supabase/migrations/20260614000500_certificates.sql` — private bucket pattern, RLS with USING+WITH CHECK [VERIFIED: codebase]
- `supabase/migrations/20260605000200_clinical_rls.sql` — INSERT-only pattern for `dental_records` [VERIFIED: codebase]
- `package.json` — complete dependency list [VERIFIED: codebase]
- `vitest.config.ts` + `src/__tests__/setup.ts` — test infrastructure; `__mocks__/server-only.js` [VERIFIED: codebase]
- `src/proxy.ts` — `MODULE_PERMISSIONS` matrix showing config route access [VERIFIED: codebase]
- `.planning/phases/07-sistema-multiunidade-pap-is/07-03-SUMMARY.md` — `cert.toAsn1()` bug fix, `certBag` OID fallback [VERIFIED]
- `.planning/phases/07-sistema-multiunidade-pap-is/07-06-SUMMARY.md` — 'use server' non-async export bug, @base-ui Select.Root signature [VERIFIED]
- `.planning/config.json` — `nyquist_validation: true` [VERIFIED]

### Secondary (MEDIUM confidence)

- MEMORY.md — Supabase CLI re-auth gotcha (org kczvihafddupruvsrrsc, project jqjwyqlbbuqnrffdnlpp) [CITED: MEMORY.md]
- MODULES-SPEC-v2.md §21 — `Configurações › Documentos › Modelos·Assinatura`, "Quem usa: Todos os perfis" [CITED: .planning/MODULES-SPEC-v2.md]

---

## Metadata

**Confidence breakdown:**
- Signing API (node-forge RSA + PKCS#7): HIGH — all APIs tested in REPL with installed 1.4.0 and test-cert.pfx fixture
- PDF generation (renderToBuffer): HIGH — confirmed Buffer output + SHA-256 consistency in REPL
- DB schema (3-table design): HIGH — mirrors proven v1 INSERT-only patterns from dental_records/anamneses
- Variable engine (regex): HIGH — standard JavaScript, no library dependency
- RBAC routing (Open Question 3): MEDIUM — config vs clinica module for document generation needs planner decision

**Research date:** 2026-06-14
**Valid until:** 2026-07-14 (stable stack; node-forge and @react-pdf/renderer are version-pinned in package.json)
