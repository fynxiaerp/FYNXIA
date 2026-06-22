---
phase: 16
plan: 01
subsystem: financeiro/tributos
tags: [wave-0, red-scaffolding, tdd, ofx, inss, irrf, iss, reconciliation, reinf, payables]
dependency_graph:
  requires: []
  provides: [wave-0-red-scaffolds, ofx-data-extractor-installed]
  affects: [16-02, 16-03, 16-04, 16-05, 16-06, 16-07, 16-08, 16-09, 16-10]
tech_stack:
  added: [ofx-data-extractor@1.5.0]
  patterns: [existsSync-guard-dynamic-import, readFileSync-source-inspection, absolute-path-import-D144, vitest-RED-scaffold]
key_files:
  created:
    - src/__tests__/financeiro16/migrations-phase16.test.ts
    - src/__tests__/financeiro16/regression-guard-phase16.test.ts
    - src/__tests__/financeiro16/fixtures/sample.ofx
    - src/__tests__/financeiro16/payables.test.ts
    - src/__tests__/financeiro16/bank-statements.test.ts
    - src/lib/financeiro/__tests__/tax-tables.test.ts
    - src/lib/financeiro/__tests__/payout-math.test.ts
    - src/lib/financeiro/__tests__/reconciliation.test.ts
    - src/lib/financeiro/__tests__/ofx-parser.test.ts
    - src/lib/reinf/__tests__/reinf.test.ts
  modified:
    - package.json
    - package-lock.json
    - vitest.config.ts
decisions:
  - vitest.config.ts extended to include src/lib/**/__tests__/**/*.test.ts (existing config only had src/__tests__/**)
  - All lib test files use absolute-path dynamic import (D-144 pattern; @-alias causes TS2307 when target absent)
  - OFX fixture uses synthetic FITID/amounts only (T-16-02 mitigated — no real CPF/CNPJ/bank data)
metrics:
  duration: "11 minutes"
  completed: "2026-06-22"
  tasks: 4
  files: 13
requirements: [FOP-01, FOP-02, FOP-03, TRIB-01, TRIB-02, TRIB-03]
---

# Phase 16 Plan 01: Wave 0 RED Scaffolding Summary

Wave-0 test scaffolds encoding the full Phase 16 contract (schema, tax math, matching, payout precedence, FITID idempotency, ReinfProvider stub) as RED Vitest assertions before any implementation exists.

---

## What Was Done

### Task 1 — ofx-data-extractor + migration scaffold + OFX fixture (commit b51b241)

- Installed `ofx-data-extractor@1.5.0` (TypeScript-native OFX SGML/XML parser, ~30KB, no heavy deps)
- Created `migrations-phase16.test.ts` with 50 RED source-inspection assertions covering all 7 planned migration files (absent → empty string → fail), asserting 15 CREATE TABLE statements, enum CHECKs verbatim, FITID UNIQUE constraints, NUMERIC(12,2) money, clinic_id indexes (4 sampled), vigência index, next_rpa_number SECURITY DEFINER, competência uniqueness, ALTERs (financial_transactions/bank_accounts/professionals/integration_connectors), RLS write-by-role (get_my_role() IN ('admin'...)), and seed INSERTs.
- Created `regression-guard-phase16.test.ts` with 14 GREEN assertions guarding Phase 9/14/15 invariants: ConnectorType union ('asaas'/'nfse'/'tiss'/'banco'), financial_transactions CREATE TABLE + NUMERIC(12,2), bank_accounts CREATE TABLE + saldo_inicial, professionals commission_rules + vinculo.
- Created `fixtures/sample.ofx` — minimal OFX SGML with 3 STMTTRN (FIT001 credit +1500, FIT002 debit -200, FIT003 credit +3200.50); synthetic data only.

### Task 2 — Tax math RED specs (commit ba096ff)

- Created `tax-tables.test.ts` with 17 RED assertions using existsSync-guard dynamic import.
- Covers: computeInss 11pct teto cap (R$ 932.31), progressivo parcela_deduzir (248.60), computeIrrf isento ≤5000 / gradual band 5000.01–7350 / flat 27.5%−908.73 above 7350, Pitfall 3 (teto R$ 8475.55×11%), Pitfall 4 (computeRpaWithholdings: IRRF base = bruto−INSS, not bruto directly), computeIss integer-cent (1200×5%=60), selectBracketsByVigencia temporal filtering.
- Extended `vitest.config.ts` include pattern to cover `src/lib/**/__tests__/**/*.test.ts` (deviation — existing config excluded lib-level tests).

### Task 3 — Payout-math + reconciliation RED specs (commit db5d6b4)

- Created `payout-math.test.ts` with 11 RED assertions: service_id exact match (60%), precedência service>wildcard, wildcard fallback, sem_regra→0%+alerta (non-throwing), applyDeductions named-only (lab+taxa=850, empty→1000, only-lab=900), integer-cent no drift.
- Created `reconciliation.test.ts` with 11 RED assertions: matchExact hit (1-day, same amount), null on amount diff >0.01, null on date diff >3 days, centavo tolerance, matchFuzzy ordered desc / score≥0.85 high confidence / distant excluded, matchNToOne fee=5 (D-09), null when no combination fits, N-cap bounded <2s.

### Task 4 — OFX parser + ReinfProvider + action RED specs (commit b14475b)

- Created `ofx-parser.test.ts` with 7 RED assertions against real fixture: 3 lines, FIT001, +1500, -200, Date instance, non-empty memo.
- Created `reinf.test.ts` with 9 RED assertions: source-inspection of ReinfProvider interface (transmitir/consultar/retificar), StubReinfProvider.transmitir→'transmitido'+protocolo, getReinfProvider→StubReinfProvider when no credential_enc (D-22).
- Created `payables.test.ts` with 5 RED assertions: baixarPayable inserts type='despesa', parcial status update, idempotent re-baixa (insert count stays 0), role gate (auditor→error with 'permissão').
- Created `bank-statements.test.ts` with 5 RED assertions: importOFX inserts 3 lines, 23505→skipped not duplicated, fitid_fallback sha256 non-null when FITID absent.

---

## Final Verification

```
Test Files  8 failed | 1 passed (9)
Tests  115 failed | 15 passed (130)
```

- 8 RED test files (as expected — target implementations absent)
- 1 GREEN regression guard (all Phase 9/14/15 invariants intact)
- 15 assertions pass: fixture existence + regression guard

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] vitest.config.ts extended to include lib/__tests__ paths**
- **Found during:** Task 2 — `npx vitest run src/lib/financeiro/__tests__/tax-tables.test.ts` returned "No test files found"
- **Issue:** Existing `vitest.config.ts` `include` was `['src/__tests__/**/*.test.ts']` only; plan specified test files at `src/lib/financeiro/__tests__/` and `src/lib/reinf/__tests__/`
- **Fix:** Added `'src/lib/**/__tests__/**/*.test.ts'` to the include array
- **Files modified:** `vitest.config.ts`
- **Commit:** ba096ff

---

## Known Stubs

None. This plan creates only test scaffolds (no implementation stubs).

---

## Threat Flags

None. All files are test-only (read-only source inspection + pure-function unit tests + mocked clients). OFX fixture contains synthetic data only (T-16-02 mitigated).

---

## Self-Check: PASSED

All 10 test files confirmed present on disk. All 4 task commits confirmed in git log (b51b241, ba096ff, db5d6b4, b14475b).
