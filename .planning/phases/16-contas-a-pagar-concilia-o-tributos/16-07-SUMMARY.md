---
phase: 16
plan: 07
subsystem: financeiro/conciliacao
tags: [ofx-upload, bank-statements, reconciliation, cashflow, fop-02, fop-03]
dependency_graph:
  requires: [16-04, 16-05, 16-06]
  provides: [importOFX, runAutoReconciliation, suggestMatches, confirmMatch, createReconciledTransaction, cashFlowPrevistoVsRealizado, matchNToOne, reconcileLoteConvenio]
  affects: [statement_lines, bank_statements, financial_transactions, tiss_guides]
tech_stack:
  added: []
  patterns:
    - OFX multipart upload via nodejs runtime route (5MB limit, T-16-30)
    - Idempotent upsert via onConflict fitid + SHA-256 fallback hash (D-11)
    - 3-stage reconciliation: exact CAS / fuzzy read-only / N:1 batch
    - Three-bucket cashflow: previsto/realizado/baixadoNaoConciliado (D-08)
key_files:
  created:
    - src/app/api/financeiro/ofx/route.ts
    - src/actions/bank-statements.ts
    - src/actions/reconciliation.ts
  modified: []
decisions:
  - importOFX is the single parse+persist orchestrator; route delegates entirely to it (no parsing in route)
  - FITID hash fallback uses SHA-256 of bankAccountId|date|amount|memo to guarantee uniqueness for OFX files without FITIDs
  - cashFlowPrevistoVsRealizado includes 'baixado' in realizado bucket to avoid saldo underestimation (D-08); baixadoNaoConciliado surfaced as separate signal
  - reconcileLoteConvenio uses tiss_guides as the receivable entity (confirmed from 20260620000300 migration); glosado items stay open (status unchanged) per D-10
  - matchNToOne action renamed to libMatchNToOne alias to avoid name conflict with exported action of same name
metrics:
  duration_minutes: 6
  completed_date: "2026-06-22"
  tasks_completed: 3
  files_created: 3
  files_modified: 0
requirements_delivered: [FOP-02, FOP-03]
---

# Phase 16 Plan 07: OFX Upload + 3-Stage Reconciliation Engine Summary

**One-liner:** OFX multipart nodejs route + idempotent FITID import + full 3-stage reconciliation (exact/fuzzy/N:1 lote) + previsto-vs-realizado cashflow with baixado bucket.

---

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | OFX route (nodejs) + bank-statements.ts | 021de73 | src/app/api/financeiro/ofx/route.ts, src/actions/bank-statements.ts |
| 2 | reconciliation.ts Stage 1/2, confirmMatch, D-07, FOP-03 | 24ee60a | src/actions/reconciliation.ts |
| 3 | reconciliation.ts Stage 3 N:1 + lote convênio | 24ee60a | src/actions/reconciliation.ts (appended) |

---

## Artifacts Delivered

### src/app/api/financeiro/ofx/route.ts
- `export const runtime = 'nodejs'` + `maxDuration = 60`
- POST handler: auth gate → role gate ['admin','superadmin'] → formData parse → 5MB size check (T-16-30) → bank_account ownership via RLS → bufferize → `importOFX()`

### src/actions/bank-statements.ts
- `importOFX({ bankAccountId, filename, buffer })`: getActor → writer gate → ownership check → `parseOfxBuffer()` → compute periodo → insert bank_statement → upsert statement_lines idempotent by fitid / fitid_fallback (SHA-256 hash, D-11) → logBusinessEvent → revalidatePath
- `listStatementLines(filters)`: tenant-scoped select with optional bankAccountId/status/from/to filters

### src/actions/reconciliation.ts
- `runAutoReconciliation(bankAccountId)`: Stage 1 — loads pending lines+txs, `matchExact()` loop, CAS UPDATE on both entities (T-16-34), removes matched from pool
- `suggestMatches(statementLineId)`: Stage 2 — read-only `matchFuzzy()` ranked suggestions; never writes
- `confirmMatch(lineId, txId)`: CAS UPDATE with rollback on concurrent conflict (T-16-34)
- `createReconciledTransaction(input)`: D-07 — type from amount sign (T-16-35), inserts FT + CAS update line, rollback on conflict
- `cashFlowPrevistoVsRealizado(filters)`: FOP-03/D-08 — three buckets: `pendente`→previsto, `baixado`+`conciliado`→realizado, `baixado`-only→baixadoNaoConciliado; unitId→cost_center_ids resolution
- `matchNToOne(input)`: D-09 — `libMatchNToOne()` → CAS UPDATE N txs → fee>0.005→insert despesa FT (T-16-35) → fee_transaction_id on line
- `reconcileLoteConvenio(input)`: D-10 — per-item: glosado=skip (open), não-glosado=CAS UPDATE tiss_guides status→'paga'; statement_line→conciliado with guide IDs

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Pattern] Tasks 2 and 3 combined in one commit**
- **Found during:** Task 3
- **Issue:** Plan specifies Task 3 appends to Task 2's file — both were implemented in a single Write operation for correctness (importing libMatchNToOne requires the import alias to avoid name collision with the exported `matchNToOne` action function)
- **Fix:** Named the lib import as `libMatchNToOne` to resolve naming conflict; all exports present
- **Commit:** 24ee60a

None — plan executed with only the naming-alias adjustment noted above.

---

## Security Mitigations (from Threat Register)

| Threat ID | Status | Implementation |
|-----------|--------|----------------|
| T-16-30 | mitigated | `MAX_FILE_BYTES = 5 * 1024 * 1024`; 413 before bufferize |
| T-16-31 | mitigated | RLS ownership check; `clinic_id` always from `actor.tenant_id` |
| T-16-32 | mitigated | upsert `ignoreDuplicates: true` on both fitid and fitid_fallback conflicts |
| T-16-33 | mitigated | `WRITER_ROLES = ['admin','superadmin']` gate in route + every mutating action |
| T-16-34 | mitigated | CAS `.eq('reconciliation_status','pendente')` before all conciliated updates |
| T-16-35 | mitigated | `amount >= 0 ? 'receita' : 'despesa'`; fee always `type: 'despesa'` |

---

## Known Stubs

None — all data flows are wired to real Supabase tables.

---

## Threat Flags

None — no new network endpoints or trust boundaries beyond the POST /api/financeiro/ofx route already modelled in the plan's threat register.

---

## Self-Check

Checking created files exist...

- FOUND: src/app/api/financeiro/ofx/route.ts
- FOUND: src/actions/bank-statements.ts
- FOUND: src/actions/reconciliation.ts
- FOUND: .planning/phases/16-contas-a-pagar-concilia-o-tributos/16-07-SUMMARY.md
- FOUND commit 021de73 (Task 1)
- FOUND commit 24ee60a (Tasks 2+3)

## Self-Check: PASSED
