---
phase: 12-receitu-rio-teleodontologia
verified: 2026-06-19T13:30:00Z
status: human_needed
score: 5/5 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Assinatura ICP-Brasil ao vivo de uma receita"
    expected: "Documento draft → signed, PDF assinado armazenado no bucket clinical-documents-pdf, signer_cn/thumbprint/signed_at preenchidos; re-assinatura bloqueada"
    why_human: "Requer certificado A1 real + renderToBuffer + signPdfBuffer em runtime; não verificável por grep"
  - test: "Alerta de alergia ao vivo (RX-02)"
    expected: "Paciente com 'alergia a penicilina' em patients.allergies (AES) recebe alerta NÃO-bloqueante ao prescrever Amoxicilina; documento ainda é criado"
    why_human: "Requer decrypt server-side de dados reais + match contra base curada em runtime"
  - test: "Fluxo de teleconsulta + SOAP (TEL-01/TEL-02)"
    expected: "Criar teleconsulta com consentimento CFO (consent_ip/consent_given_at server-side) → iniciar → encerrar → registro SOAP vinculado a appointment + teleconsultation"
    why_human: "Fluxo de UI multi-etapa + headers de request reais; não verificável estaticamente"
  - test: "Imutabilidade do documento assinado"
    expected: "Após signed, conteúdo não pode ser alterado; numeração doc_number sequencial atômica por clínica+tipo persiste sem colisão sob concorrência"
    why_human: "Imutabilidade é garantida no nível de aplicação (.is('signature', null)), não por trigger DB — requer teste de concorrência ao vivo"
---

# Phase 12: Receituário & Teleodontologia Verification Report

**Phase Goal:** Dentistas emitem receitas/atestados/solicitações de exame assinados com ICP-Brasil (com alerta de alergia não-bloqueante) e realizam teleconsultas (link externo + consentimento CFO) que geram registro SOAP no prontuário e documentos vinculados ao atendimento — reusando a engine de assinatura da Fase 8 e o prontuário da Fase 2, sem quebrar o GIST de appointments.

**Verified:** 2026-06-19T13:30:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Dentista emite receita (simples/controle especial) com medicamento da base DCB/DCI + posologia; doc_number sequencial atômico | ✓ VERIFIED | `issueClinicDocument` em `clinical-documents.ts:87-322`; numeração via RPC `next_doc_number` (`:273`); RPC atômico `ON CONFLICT DO UPDATE SET last_seq+1` em `20260618000100:596-600`; base seedada (~113 linhas) em `:46`; formatDocNumber em `doc-number.ts:45` |
| 2 | Sistema valida alergias e alerta (não-bloqueante) ao conflitar com alergia cadastrada | ✓ VERIFIED | Fetch `patients.allergies` com `tenant_id` (`clinical-documents.ts:147`, CR-01 corrigido) → `decrypt()` server-side (`:154`) → anamnese tenant-scoped (`:162`, CR-02 corrigido) → `checkMedicationAllergy` puro (`allergy-check.ts:36-80`); alerta NÃO aborta (`:206-208` retorna allergyAlert junto de success) |
| 3 | Receita/atestado assinado com ICP-Brasil, numerado, imutável, disponível no Portal | ✓ VERIFIED | `signClinicDocument` reusa `signPdfBuffer` da Fase 8 inalterado (`:32`, `:506`); guard atômico `.is('signature', null)` (`:545`) + rollback de storage (`:550`); flag `portal_visible` (`:298`); imutável (sem update após signed) |
| 4 | Teleconsulta com link externo + consentimento CFO registrado server-side | ✓ VERIFIED | `createTeleconsultation` (`teleconsultations.ts:73-147`); `consent_given_at`/`consent_ip` setados server-side de headers (`:101-120`); consent_ip omitido do audit log (`:134`); `startTeleconsultation` exige consent_given (`:187-189`) |
| 5 | Sessão gera registro SOAP no prontuário vinculado a appointment/teleconsultation | ✓ VERIFIED | `createSoapRecord` (`teleconsultations.ts:268-332`) insere em `soap_records` com FK dupla `appointment_id` + `teleconsultation_id` (`:302-303`); migration `20260618000400:65,82` define FKs nullable |

**Score:** 5/5 truths verified (all wiring present; behavioral confirmation routed to human UAT)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/20260618000100_clinical_documents.sql` | medications + clinical_documents + document_seq_counters + next_doc_number RPC | ✓ VERIFIED | Todas as estruturas presentes; RPC atômico; seed DCB/DCI |
| `20260618000200/000300/000400/000500` | RLS + bucket + teleconsultations + SOAP | ✓ VERIFIED | 5 migrations presentes; RLS pareando USING+WITH CHECK |
| `src/types/database.types.ts` | reflete 5 tabelas + RPC | ✓ VERIFIED | medications, clinical_documents, document_seq_counters, teleconsultations, soap_records + next_doc_number(Args/Returns string) presentes |
| `src/actions/clinical-documents.ts` | issue/sign/list | ✓ VERIFIED | 627 linhas substantivas; 0 `as never` casts (WR-02 corrigido) |
| `src/actions/teleconsultations.ts` | create/start/end/SOAP/list | ✓ VERIFIED | 382 linhas; 0 `as never`; consent server-side |
| `src/lib/clinical/allergy-check.ts` | matcher puro não-bloqueante | ✓ VERIFIED | `checkMedicationAllergy` retorna {hasAlert, reasons} |
| `src/lib/clinical/doc-number.ts` | formatador sequencial | ✓ VERIFIED | REC/ATE/EXA + padStart(4,'0') |
| `src/lib/icp/sign-document.ts` | engine Fase 8 INALTERADA | ✓ VERIFIED | Último commit fc9986a (Fase 8); nenhum commit Fase 12 a tocou |
| UI: ClinicalDocumentForm/AllergyAlert/TeleconsultationForm/SoapEditor | formulários + alerta | ✓ VERIFIED | Componentes importam actions; AllergyAlert renderizado em ClinicalDocumentForm |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| ClinicalDocumentForm | issueClinicDocument | import + chamada | ✓ WIRED | `src/components/receituario/ClinicalDocumentForm.tsx` |
| receituario/[id]/page | signClinicDocument | import | ✓ WIRED | `src/app/(dashboard)/clinica/receituario/[id]/page.tsx` |
| signClinicDocument | signPdfBuffer (Fase 8) | import `@/lib/icp/sign-document` | ✓ WIRED | `clinical-documents.ts:32,506` — engine reusada sem modificação |
| issueClinicDocument | next_doc_number RPC | `supabase.rpc()` | ✓ WIRED | `clinical-documents.ts:273` |
| TeleconsultationForm/SoapEditor | create/SOAP actions | import + chamada | ✓ WIRED | componentes teleconsultation |
| nav-config + proxy | receituario/teleodontologia | ModuleKey + RBAC matrix | ✓ WIRED | nav-config.ts:21-22,38-39; proxy.ts:14,22-28 (dentist/admin/superadmin allowed; dpo/auditor readOnly) |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| allergyAlert | reasons[] | patients.allergies (decrypt) + anamneses.responses + medications.allergen_tags | Sim (tenant-scoped queries reais) | ✓ FLOWING |
| doc_number | seq | RPC next_doc_number → document_seq_counters | Sim (ON CONFLICT atômico) | ✓ FLOWING |
| signed PDF | storage_path | renderToBuffer + signPdfBuffer + bucket upload | Sim (engine Fase 8 real) | ✓ FLOWING (confirmação runtime → UAT) |
| SOAP record | soap_records row | insert com FK appointment+teleconsultation | Sim | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Type check | `npx tsc --noEmit` | exit 0 | ✓ PASS |
| Test suite | `npx vitest run` | 1202 passed / 67 files | ✓ PASS |
| Production build | `npx next build` | exit 0; rotas receituario+teleodontologia presentes | ✓ PASS |
| Migrações aplicadas (remoto) | `npx supabase migration list --linked` | 403 login role (CLI logado em conta errada — gotcha conhecido) | ? SKIP — confirmado indiretamente: database.types.ts (gerado do schema remoto) reflete as 5 tabelas + RPC |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| RX-01 | 12-02/12-04 | Receita com medicamento DCB/DCI + posologia; doc_number sequencial atômico | ✓ FULL | next_doc_number atômico; base seedada; clinical-documents.ts:265-302 |
| RX-02 | 12-02/12-04 | Valida alergias; alerta NÃO-bloqueante; allergies decrypt server-side; texto-livre + flags | ✓ FULL | clinical-documents.ts:135-210; allergy-check.ts cobre tags + nome + 2 flags anamnese |
| RX-03 | 12-04/12-06 | Documento assinado ICP-Brasil, numerado, imutável, portal_visible | ✓ FULL | signClinicDocument reusa signPdfBuffer; guard atômico; portal_visible |
| TEL-01 | 12-03/12-07 | Teleconsulta link externo + consentimento CFO server-side | ✓ FULL | teleconsultations.ts:100-120; consent_given/at/ip server-side |
| TEL-02 | 12-03/12-07 | Registro SOAP vinculado a appointment/teleconsultation | ✓ FULL | createSoapRecord FK dupla; soap_records migration |

Nenhum requisito órfão: REQUIREMENTS.md mapeia exatamente RX-01..03 + TEL-01..02 para a Fase 12, todos reivindicados por planos.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| clinical-documents.ts | — | `as never` casts | ✓ NONE (0 ocorrências — WR-02 corrigido) | n/a |
| teleconsultations.ts | — | `as never` casts | ✓ NONE (0 ocorrências) | n/a |
| clinical-documents.ts | 511 (migration) | Imutabilidade via app layer, não trigger DB | ℹ️ Info | `.is('signature', null)` garante na aplicação; aceitável, mas sem enforcement DB — anotado para UAT |

### Code Review Fixes — Confirmação (commits 27c1bd1, f1fb656, 64616cb, 7995214, a664bfa, 14dbc26)

| Issue | Fix esperado | Status | Evidência |
|-------|--------------|--------|-----------|
| CR-01 | patients query usa `tenant_id` (não clinic_id) | ✓ PRESENTE | clinical-documents.ts:147 `.eq('tenant_id', actor.tenant_id)` |
| CR-02 | anamneses admin-read com scope `tenant_id` explícito | ✓ PRESENTE | clinical-documents.ts:162 `.eq('tenant_id', actor.tenant_id)` |
| WR-01 | teleodonto page appointments usa `tenant_id` | ✓ PRESENTE | teleodontologia/[id]/page.tsx:92 `.eq('tenant_id', tenantId)` |
| WR-02 | remover `as never` do sign update | ✓ PRESENTE | clinical-documents.ts:532 update tipado, 0 `as never` no arquivo |
| WR-03 | medication_id miss = erro forte (não fall-through) | ✓ PRESENTE | clinical-documents.ts:182-191 `if (medErr || !medRow) return error` + `.eq('active', true)` |
| WR-04 | numeração alocada tarde (pós-validação) + comentário gap-tolerant | ✓ PRESENTE | clinical-documents.ts:266-280 comentário + RPC imediatamente antes do insert |

### Regression Guards

| Guard | Status | Evidência |
|-------|--------|-----------|
| appointments GIST (no_overlap) inalterado | ✓ PASS | Nenhuma migration Fase 12 faz ALTER em appointments; só FK references; migration 000400 documenta "does NOT touch public.appointments, its GIST" |
| appointments status CHECK inalterado | ✓ PASS | CHECK vive em 20260605/20260617 (Fases 2/11), não tocado na Fase 12 |
| sign-document.ts (Fase 8) inalterado | ✓ PASS | git log: último commit fc9986a (Fase 8); nenhum commit Fase 12 |

### Human Verification Required

1. **Assinatura ICP-Brasil ao vivo** — emitir receita e assinar com certificado A1 real; verificar PDF assinado no bucket + bloqueio de re-assinatura.
2. **Alerta de alergia ao vivo (RX-02)** — paciente com alergia cadastrada (criptografada) recebe alerta não-bloqueante ao prescrever medicamento conflitante; documento ainda criado.
3. **Fluxo teleconsulta + SOAP (TEL-01/TEL-02)** — criar com consentimento CFO → iniciar → encerrar → SOAP vinculado a appointment + teleconsultation.
4. **Imutabilidade do doc assinado + numeração concorrente** — confirmar que doc signed não muda e doc_number não colide sob concorrência (garantido no app layer, sem trigger DB).

### Gaps Summary

Nenhum gap bloqueante. Todas as 5 Success Criteria do roadmap e os 5 requisitos (RX-01..03, TEL-01..02) têm implementação substantiva, wired e com data-flow real. Os 2 CRITICAL (CR-01 patients.tenant_id, CR-02 anamneses tenant scope) e os 4 WARNING do code review estão TODOS corrigidos no código vivo. Todos os gates automatizados passam: tsc exit 0, vitest 1202/1202, next build exit 0. As regressões críticas estão protegidas: GIST/status de appointments intactos, engine de assinatura da Fase 8 inalterada, zero `as never` remanescentes.

Único ponto a anotar: `npx supabase migration list --linked` retornou 403 (CLI logado em conta errada — gotcha documentado em MEMORY); a aplicação das migrations ao remoto é confirmada indiretamente porque `database.types.ts` (gerado do schema remoto via `gen types --linked`) reflete as 5 novas tabelas e a RPC `next_doc_number`. Os itens restantes são comportamentais ao vivo (assinatura ICP, alerta de alergia, fluxo teleconsulta/SOAP, imutabilidade) e são human-UAT-only — aceitáveis com gates verdes e wiring presente.

---

_Verified: 2026-06-19T13:30:00Z_
_Verifier: Claude (gsd-verifier)_
