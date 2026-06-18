---
phase: 12
slug: receitu-rio-teleodontologia
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-18
---

# Phase 12 — Validation Strategy

> Receituário (receita/atestado/exame assinados ICP + alerta de alergia) + Teleodontologia (consentimento CFO + link externo + SOAP). Correctness = source-inspection (migrations/actions/PDF/signing/proxy) + pure-unit (allergy match, doc-number format) + build-green + um `supabase db push` ao vivo. CRITICAL: reusar a engine de assinatura ICP da Fase 8 sem quebrá-la; alergia descriptografada server-side (AES); GIST de appointments intocado.

---

## Test Infrastructure
| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.8 (node) |
| **Config** | `vitest.config.ts` (server-only mock + setup) |
| **Quick** | `npx vitest run src/__tests__/receituario/ src/__tests__/teleodontologia/` |
| **Full** | `npx vitest run` |
| **Runtime** | ~5–10s |

Style: **source-inspection** (readFileSync/toMatch nas migrations, nas Server Actions de emissão/assinatura, no PDF, no proxy) + **pure-unit** (`checkMedicationAllergy`, formato do `doc_number`). Plus `npx tsc --noEmit`, **`npx next build`**, e um **`supabase db push`** ([BLOCKING], checkpoint único) + `gen types` (temp-file guard).

---

## Sampling Rate
- **After every task commit:** `npx vitest run {file}` + `npx tsc --noEmit`
- **After every wave:** full suite + `npx next build`
- **At the migration checkpoint (one plan ONLY):** `[BLOCKING] supabase db push` (re-auth org `kczvihafddupruvsrrsc` / projeto `jqjwyqlbbuqnrffdnlpp` antes — gotcha recorrente) → `gen types` (temp-file guard) → tsc green
- **Before verify:** full suite GREEN + next build clean + DB checks (novas tabelas, função `next_doc_number`, RLS, REVOKE) + UAT manual
- **Max latency:** ~10s unit / build ~30–60s / db push manual

---

## Per-Requirement Validation Map
| REQ | Concern | Test Type | Automated Command |
|-----|---------|-----------|-------------------|
| RX-01 | `medications` (name, allergen_tags, requires_special_control) + `clinical_documents` (doc_type CHECK 4 valores: receita/receita_controle_especial/atestado/solicitacao_exame) + `issueClinicDocument` retorna `doc_number` no formato por tipo | migration + source-inspect + unit | `npx vitest run src/__tests__/receituario/clinical-documents.test.ts src/__tests__/receituario/migrations-phase12-rx.test.ts` |
| RX-02 | `checkMedicationAllergy` (PURE): hasAlert=true quando allergen_tag ∈ alergia texto-livre (descriptografada) OU `alergia_medicamento=true`; hasAlert=false sem match; match acento/case-insensível; action importa `@/lib/crypto` `decrypt()` | pure-unit + source-inspect | `npx vitest run src/__tests__/receituario/allergy-check.test.ts` |
| RX-03 | `signClinicDocument` chama `signPdfBuffer`; transição `draft`→`signed` imutável (sem UPDATE após signed, guard `.is('signature', null)`); `document_seq_counters` + função `next_doc_number` na migration; flag `portal_visible` | source-inspect + migration | `npx vitest run src/__tests__/receituario/clinical-documents.test.ts src/__tests__/receituario/migrations-phase12-rx.test.ts` |
| TEL-01 | `createTeleconsultation` grava `external_link`, `consent_given`, `consent_given_at` (+ `consent_ip` server-side); `teleconsultations.status` CHECK | source-inspect + migration | `npx vitest run src/__tests__/teleodontologia/teleconsultations.test.ts src/__tests__/teleodontologia/migrations-phase12-tel.test.ts` |
| TEL-02 | `createSoapRecord` vincula `teleconsultation_id` + `appointment_id`; `soap_records` tem as 4 colunas SOAP (subjective/objective/assessment/plan) | source-inspect + migration | `npx vitest run src/__tests__/teleodontologia/teleconsultations.test.ts src/__tests__/teleodontologia/migrations-phase12-tel.test.ts` |

(Plus a regression assertion: nenhuma migration da Fase 12 toca o GIST `no_overlap` nem a engine de assinatura da Fase 8.)

---

## Wave 0 Test Files (RED scaffolds)
- `src/__tests__/receituario/allergy-check.test.ts` — RX-02 pure-unit
- `src/__tests__/receituario/clinical-documents.test.ts` — RX-01/RX-03 source-inspection
- `src/__tests__/receituario/migrations-phase12-rx.test.ts` — RX-01/RX-03 migrations
- `src/__tests__/teleodontologia/teleconsultations.test.ts` — TEL-01/02 source-inspection
- `src/__tests__/teleodontologia/migrations-phase12-tel.test.ts` — TEL-01/02 migrations

---

## Manual-Only Verifications (human UAT)
| Behavior | Why Manual |
|----------|------------|
| Emitir receita com medicamento da base + posologia; PDF assinado ICP + numerado | Visual + assinatura ao vivo |
| Alerta de alergia dispara ao prescrever medicamento conflitante (não bloqueia) | Live + dados cifrados |
| Atestado e solicitação de exame assinados e numerados por tipo | Live |
| Teleconsulta: registrar consentimento CFO + link + iniciar/encerrar | Live |
| Teleconsulta gera registro SOAP no prontuário + docs vinculados ao atendimento | Live |
| Documento assinado fica imutável (não editável) | Live |
| Read-only roles não emitem/assinam documentos | Live RBAC |

---

## Validation Sign-Off
- [ ] Cada REQ (RX-01..03, TEL-01..02) com check automatizado ou UAT documentado
- [ ] Alergia: match server-side com `decrypt()` (nunca contra ciphertext)
- [ ] [BLOCKING] `supabase db push` único + gen types guard
- [ ] Assinatura ICP da Fase 8 reusada sem regressão; doc assinado imutável
- [ ] content_json (PII de saúde) cifrado; REVOKE em colunas sensíveis
- [ ] next build green após cada wave
- [ ] `nyquist_compliant: true`

**Approval:** pending
