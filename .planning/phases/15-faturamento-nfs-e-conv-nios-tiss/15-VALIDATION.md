---
phase: 15
slug: faturamento-nfs-e-conv-nios-tiss
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-20
---

# Phase 15 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (vitest.config.ts at project root) |
| **Config file** | `vitest.config.ts` — `include: ['src/__tests__/**/*.test.ts']` |
| **Quick run command** | `npx vitest run src/__tests__/faturamento/` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~30 seconds (faturamento subset ~8s) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/__tests__/faturamento/`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Req ID | Behavior | Test Type | Automated Command | File Exists | Status |
|--------|----------|-----------|-------------------|-------------|--------|
| OS-01 | `appointment.status='concluido'` → OS rascunho created (1 per appointment, unique) | unit | `npx vitest run src/__tests__/faturamento/service-orders.test.ts` | ❌ W0 | ⬜ pending |
| OS-01 | UNIQUE constraint prevents duplicate OS for same appointment | source-inspection | `npx vitest run src/__tests__/faturamento/migrations-phase15.test.ts` | ❌ W0 | ⬜ pending |
| OS-02 | FiscalProvider.emit() called on faturarOs (particular, competência) | unit | `npx vitest run src/__tests__/faturamento/nfse.test.ts` | ❌ W0 | ⬜ pending |
| OS-02 | Stub returns `emitida` synchronously; nfse_records row created | unit | `npx vitest run src/__tests__/faturamento/nfse.test.ts` | ❌ W0 | ⬜ pending |
| OS-02 | NFS-e NOT emitted if OS pagador = 'convenio' | unit | `npx vitest run src/__tests__/faturamento/nfse.test.ts` | ❌ W0 | ⬜ pending |
| OS-03 | createCharge called on faturarOs (particular path) | unit | `npx vitest run src/__tests__/faturamento/service-orders.test.ts` | ❌ W0 | ⬜ pending |
| OS-03 | Insurer receivable created on faturarOs (convenio path, no Asaas) | unit | `npx vitest run src/__tests__/faturamento/service-orders.test.ts` | ❌ W0 | ⬜ pending |
| CONV-01 | insurers + insurer_prices tables created with correct schema | source-inspection | `npx vitest run src/__tests__/faturamento/migrations-phase15.test.ts` | ❌ W0 | ⬜ pending |
| CONV-02 | criarGuiaTiss creates tiss_guides record in `em_analise` | unit | `npx vitest run src/__tests__/faturamento/tiss.test.ts` | ❌ W0 | ⬜ pending |
| CONV-02 | fecharLote groups guides, calls TissProvider.sendLote, stores protocolo | unit | `npx vitest run src/__tests__/faturamento/tiss.test.ts` | ❌ W0 | ⬜ pending |
| CONV-03 | registrarGlosa per item with motivo_glosa_id and valor_glosado | unit | `npx vitest run src/__tests__/faturamento/tiss.test.ts` | ❌ W0 | ⬜ pending |
| CONV-03 | registrarRecurso updates glosa_status to `em_recurso` | unit | `npx vitest run src/__tests__/faturamento/tiss.test.ts` | ❌ W0 | ⬜ pending |
| D-30 | faturarOs idempotent: second call with same osId returns success without re-emitting | unit | `npx vitest run src/__tests__/faturamento/service-orders.test.ts` | ❌ W0 | ⬜ pending |
| D-30 | CAS guard: concurrent faturarOs on same OS — only one wins | unit | `npx vitest run src/__tests__/faturamento/service-orders.test.ts` | ❌ W0 | ⬜ pending |
| D-25 | OS total = sum(item.valor_total) - desconto_total + acrescimo_total | unit | `npx vitest run src/__tests__/faturamento/service-orders.test.ts` | ❌ W0 | ⬜ pending |
| D-25 | ISS base = OS total after discounts | unit | `npx vitest run src/__tests__/faturamento/nfse.test.ts` | ❌ W0 | ⬜ pending |
| D-27 | Status enums in migration match D-27 exactly (OS/NFS-e/TISS/pagador) | source-inspection | `npx vitest run src/__tests__/faturamento/migrations-phase15.test.ts` | ❌ W0 | ⬜ pending |
| D-20 | regime=competência → emitirNfse on faturar | unit | `npx vitest run src/__tests__/faturamento/nfse.test.ts` | ❌ W0 | ⬜ pending |
| D-20 | regime=caixa → NO NFS-e on faturar; emission deferred to payment webhook | unit | `npx vitest run src/__tests__/faturamento/nfse.test.ts` | ❌ W0 | ⬜ pending |
| D-28 | glosa valor: sum(tiss_guide_items.valor_glosado) = tiss_guides.valor_glosado | unit | `npx vitest run src/__tests__/faturamento/tiss.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/__tests__/faturamento/migrations-phase15.test.ts` — source-inspection for all new tables + RLS patterns + D-27 enum CHECK constraints
- [ ] `src/__tests__/faturamento/service-orders.test.ts` — OS state machine, createOs, faturarOs, idempotency CAS, OS total math
- [ ] `src/__tests__/faturamento/nfse.test.ts` — FiscalProvider interface, StubFiscalProvider, emitirNfse, regime caixa vs competência, ISS calc
- [ ] `src/__tests__/faturamento/tiss.test.ts` — TissProvider interface, StubTissProvider, criarGuia, fecharLote, registrarGlosa, registrarRecurso, glosa math
- [ ] `src/__tests__/faturamento/regression-guard-phase15.test.ts` — ensures `appointment.ts` enum `concluido` still present, financial_tables columns unchanged, integration_connectors types still include `nfse`/`tiss`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real NFS-e emission against a municipal prefecture (via aggregator) | OS-02 | Gated behind real provider credentials; STUB covers automated path | Configure Focus NFe/PlugNotas connector in Hub with sandbox creds; faturar a particular OS; confirm número/protocolo returned and PDF archived |
| Real TISS lote submission to an operadora | CONV-02 | Gated behind real TissProvider credentials + ANS homologation | Register insurer with real TISS creds; fechar lote; confirm protocolo from operadora endpoint |
| Visual parity of /clinica/financeiro screens with approved prototypes | OS-02/CONV-01..03 | Visual/UX judgment per UI-SPEC | Compare faturamento, nfse, convenios screens against `/clinica/prototipos` reference |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (5 new test files)
- [ ] No watch-mode flags (use `vitest run`, not `vitest`)
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
