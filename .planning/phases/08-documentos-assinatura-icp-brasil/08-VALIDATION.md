---
phase: 8
slug: documentos-assinatura-icp-brasil
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-14
---

# Phase 8 — Validation Strategy

> Document engine + ICP signing + immutable versioning. Correctness = source-inspection (migrations/actions/components) + a REAL sign→verify unit test against the Phase 7 `.pfx` fixture + build-green + live `supabase db push`. True end-to-end (real cert, PDF in browser) is human-UAT.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.8 |
| **Config file** | `vitest.config.ts` (server-only mock + setup already configured in Phase 7) |
| **Quick run command** | `npx vitest run {changed test file}` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~3–6s |

Test style: **source-inspection** (readFileSync + toMatch on migrations/actions/components) + **pure-unit** for the signing round-trip (`signDocumentHash` → `verifyDocumentSignature` using `src/__tests__/icp/fixtures/test-cert.pfx`) and the `{{var}}` fill engine. Plus `npx tsc --noEmit`, **`npx next build`**, and a **live `supabase db push`** ([BLOCKING], single checkpoint) + `gen types`.

---

## Sampling Rate

- **After every task commit:** `npx vitest run {file}` + `npx tsc --noEmit`
- **After every wave:** full suite + `npx next build`
- **At the migration checkpoint (one plan ONLY):** `[BLOCKING] supabase db push` (re-auth on org `kczvihafddupruvsrrsc` / project `jqjwyqlbbuqnrffdnlpp` first — recurring gotcha) → `supabase gen types typescript` → tsc green
- **Before verify:** full suite GREEN + next build clean + DB checks (3 tables, RLS no UPDATE/DELETE on signed versions) + manual UAT
- **Max feedback latency:** ~10s (unit) / build ~30–60s / db push manual

---

## Per-Requirement Validation Map

| REQ | Concern | Test Type | Automated Command |
|-----|---------|-----------|-------------------|
| DOC-01 | `document_templates` table; `{{var}}` extraction + fill from context; template editor action | source-inspect + unit (fill engine) | `npx vitest run src/__tests__/documents/templates.test.ts` |
| DOC-02 | render PDF (@react-pdf) → SHA-256 → node-forge RSA/PKCS#7 sign with .pfx → store signature+timestamp+signer; verify round-trip | unit (sign→verify vs fixture) + source-inspect | `npx vitest run src/__tests__/documents/signing.test.ts` |
| DOC-03 | `documents` + `document_versions` append-only; signed version immutable (RLS no UPDATE/DELETE); edit → new version; content AES-encrypted | migration source-inspect + DB check | `npx vitest run src/__tests__/documents/versioning.test.ts` |

---

## Manual-Only Verifications (human UAT)

| Behavior | Why Manual |
|----------|------------|
| Create a template with `{{nome_paciente}}`/`{{data}}`, generate a doc, vars filled correctly | Visual + data |
| Sign a generated PDF with a REAL ICP A1 cert; signature + timestamp shown | Real cert + crypto |
| Signed document cannot be edited; editing creates a new version; history preserved | Live RLS + flow |
| Generated PDF renders correctly (layout, pt-BR accents, signature block) in browser | Visual PDF |
| Read-only roles (auditor/dpo/socio) cannot create/sign documents | Live RBAC |

---

## Validation Sign-Off

- [ ] Each DOC- REQ has an automated check or documented manual-UAT item
- [ ] Real sign→verify unit test passes against the Phase 7 `.pfx` fixture
- [ ] [BLOCKING] `supabase db push` task present (single checkpoint) + gen types
- [ ] next build green after every wave
- [ ] `nyquist_compliant: true`

**Approval:** pending
