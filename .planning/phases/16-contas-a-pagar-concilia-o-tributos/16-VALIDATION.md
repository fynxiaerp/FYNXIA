---
phase: 16
slug: contas-a-pagar-concilia-o-tributos
status: ready
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-21
---

# Phase 16 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (existing — see vitest.config.ts) |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run src/lib/financeiro src/lib/reinf` |
| **Full suite command** | `npx vitest run` |
| **Type/build gate** | `npx tsc --noEmit` (Wave 3); `npm run build` (Wave 4 UI) |
| **Estimated runtime** | ~30s unit · ~90s build |

---

## Sampling Rate

- **After every task commit:** Run the task's `<automated>` command (see map below)
- **After every plan wave:** Run `npx vitest run` (+ `npx tsc --noEmit` from Wave 3, `npm run build` from Wave 4)
- **Before `/gsd-verify-work`:** Full suite + build must be green
- **Max feedback latency:** ~30s (unit) / ~90s (build)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 16-01-01 | 01 | 0 | FOP-01/02/03, TRIB-01/02/03 | — | RED: migrations + RLS write-by-role + regression guard encoded | source | `npx vitest run src/__tests__/financeiro16/migrations-phase16.test.ts src/__tests__/financeiro16/regression-guard-phase16.test.ts` | ❌ W0 | ⬜ pending |
| 16-01-02 | 01 | 0 | TRIB-02 | — | RED: INSS 11%/progressivo + IRRF (INSS-before-IR) + ISS by vigência | unit | `npx vitest run src/lib/financeiro/__tests__/tax-tables.test.ts` | ❌ W0 | ⬜ pending |
| 16-01-03 | 01 | 0 | TRIB-01, FOP-02 | — | RED: payout precedence (service>wildcard>0%+alerta) + matchExact/Fuzzy/NToOne | unit | `npx vitest run src/lib/financeiro/__tests__/payout-math.test.ts src/lib/financeiro/__tests__/reconciliation.test.ts` | ❌ W0 | ⬜ pending |
| 16-01-04 | 01 | 0 | FOP-02, TRIB-03 | — | RED: FITID idempotency + ReinfProvider stub + action specs | unit | `npx vitest run src/lib/financeiro/__tests__/ofx-parser.test.ts src/lib/reinf/__tests__/reinf.test.ts src/__tests__/financeiro16/payables.test.ts src/__tests__/financeiro16/bank-statements.test.ts` | ❌ W0 | ⬜ pending |
| 16-02-01 | 02 | 1 | FOP-01 | T-16 tenant | suppliers/payables/installments/recorrente: clinic_id index + NUMERIC(12,2) + enums | source | `npx vitest run src/__tests__/financeiro16/migrations-phase16.test.ts -t "payables\|suppliers\|installment\|recorrente"` | ✅ via W0 | ⬜ pending |
| 16-02-02 | 02 | 1 | FOP-02, TRIB-02 | T-16 idemp | statement_lines partial UNIQUE(fitid)/(fitid_fallback); tax tables vigência | source | `npx vitest run src/__tests__/financeiro16/migrations-phase16.test.ts -t "statement\|fitid\|inss\|irrf\|iss\|vigencia"` | ✅ via W0 | ⬜ pending |
| 16-02-03 | 02 | 1 | TRIB-02 | — | 2026 INSS/IRRF/ISS seed brackets present | source | `npx vitest run src/__tests__/financeiro16/migrations-phase16.test.ts -t "seed\|2026"` | ✅ via W0 | ⬜ pending |
| 16-03-01 | 03 | 1 | TRIB-01/02/03, FOP-03 | T-16 tenant | payout/rpa/reinf/counter/competencia tables + next_rpa_number SECURITY DEFINER | source | `npx vitest run src/__tests__/financeiro16/migrations-phase16.test.ts -t "payout\|rpa\|reinf\|competencia\|counter"` | ✅ via W0 | ⬜ pending |
| 16-03-02 | 03 | 1 | FOP-03 | — | ALTERs: reconciliation_status, saldo_atual/data_abertura, supplier_id, connector types | source | `npx vitest run src/__tests__/financeiro16/migrations-phase16.test.ts -t "ALTER\|reconciliation_status\|saldo_atual"` | ✅ via W0 | ⬜ pending |
| 16-03-03 | 03 | 1 | FOP-01/02/03, TRIB-01/02/03 | T-16 RLS | every table RLS USING get_my_tenant_id() + WITH CHECK admin/superadmin write; tax tables read-only | source | `npx vitest run src/__tests__/financeiro16/migrations-phase16.test.ts -t "RLS\|WITH CHECK\|get_my_role\|ROW LEVEL"` | ✅ via W0 | ⬜ pending |
| 16-04-01 | 04 | 1 | TRIB-01/02 | — | computeInss/Irrf/Iss + computePayout pure functions GREEN | unit | `npx vitest run src/lib/financeiro/__tests__/tax-tables.test.ts src/lib/financeiro/__tests__/payout-math.test.ts` | ❌ (creates lib) | ⬜ pending |
| 16-04-02 | 04 | 1 | FOP-02 | T-16 idemp | matchExact/Fuzzy/NToOne + parseOfx (FITID) pure functions GREEN | unit | `npx vitest run src/lib/financeiro/__tests__/reconciliation.test.ts src/lib/financeiro/__tests__/ofx-parser.test.ts` | ❌ (creates lib) | ⬜ pending |
| 16-04-03 | 04 | 1 | TRIB-03 | — | ReinfProvider stub + ConnectorType union; tsc clean | unit | `npx vitest run src/lib/reinf/__tests__/reinf.test.ts && npx tsc --noEmit` | ❌ (creates lib) | ⬜ pending |
| 16-05-01 | 05 | 2 | FOP-01/02/03, TRIB-01/02/03 | T-16 schema | **[BLOCKING] supabase db push** — live schema (human re-auth, autonomous:false) | manual | see Manual-Only Verifications | ❌ | ⬜ pending |
| 16-05-02 | 05 | 2 | — | — | gen types: all phase-16 tables present in database.types.ts (truncation guard) | source | `grep -c "payables\|statement_lines\|professional_payouts\|rpa_records\|reinf_events\|inss_tax_tables" src/lib/database.types.ts` | ❌ (regen) | ⬜ pending |
| 16-06-01 | 06 | 3 | FOP-01 | T-16 tenant/role | suppliers.ts server-only + role gate; tsc clean | source | `npx tsc --noEmit 2>&1 \| grep actions/suppliers; grep -c "import 'server-only'" src/actions/suppliers.ts` | ❌ (creates) | ⬜ pending |
| 16-06-02 | 06 | 3 | FOP-01 | T-16 money | payables: createPayable/baixarPayable (CAS, partial, debits saldo) behavior | behavior | `npx vitest run src/__tests__/financeiro16/payables.test.ts` | ❌ (creates) | ⬜ pending |
| 16-06-03 | 06 | 3 | FOP-01 | — | recorrente Cron route runtime=nodejs; idempotent per (template,competência) | source | `grep -E "runtime = 'nodejs'" src/app/api/cron/recorrente/route.ts` | ❌ (creates) | ⬜ pending |
| 16-07-01 | 07 | 3 | FOP-02 | T-16 upload | OFX route runtime=nodejs + ownership + size limit; importOFX FITID upsert | source | `grep -E "runtime = 'nodejs'" src/app/api/financeiro/ofx/route.ts` | ❌ (creates) | ⬜ pending |
| 16-07-02 | 07 | 3 | FOP-02, FOP-03 | — | reconciliation: matchExact/Fuzzy + cashFlowPrevistoVsRealizado (3-status: previsto/realizado/baixadoNaoConciliado) | source | `npx tsc --noEmit 2>&1 \| grep actions/reconciliation; grep -E "baixadoNaoConciliado" src/actions/reconciliation.ts` | ❌ (creates) | ⬜ pending |
| 16-07-03 | 07 | 3 | FOP-02 | T-16 money | matchNToOne (fee→despesa) + reconcileLoteConvenio (partial glosa) — appends after task 2 | source | `grep -E "matchNToOne" src/actions/reconciliation.ts` | ❌ (extends) | ⬜ pending |
| 16-08-01 | 08 | 3 | TRIB-01 | T-16 money | computePayouts (regime caixa, join via service_orders) + fecharCompetencia | source | `npx tsc --noEmit 2>&1 \| grep professional-payouts; grep -E "computePayout\|aggregatePayout" src/actions/professional-payouts.ts` | ❌ (creates) | ⬜ pending |
| 16-08-02 | 08 | 3 | TRIB-02 | T-16 pdf | rpa.ts: computeRpaWithholdings by vigência + next_rpa_number + PDF (signed URL, path never returned) | source | `npx tsc --noEmit 2>&1 \| grep "actions/rpa\|RpaPDF"; grep -E "computeRpaWithholdings" src/actions/rpa.ts` | ❌ (creates) | ⬜ pending |
| 16-08-03 | 08 | 3 | TRIB-03 | T-16 cred | reinf.ts: gerarReinfEvent via getReinfProvider STUB + estorno by-alçada + audit | source | `npx tsc --noEmit 2>&1 \| grep actions/reinf; grep -E "getReinfProvider" src/actions/reinf.ts` | ❌ (creates) | ⬜ pending |
| 16-09-01 | 09 | 4 | FOP-01 | T-16 role | Contas a Pagar UI: KPI + nuqs table + PayableFormDialog + BaixaDialog + anexo; read-only viewers | build | `npx tsc --noEmit 2>&1 \| grep -E "contas-a-pagar\|Payable\|Baixa"; npm run build` | ❌ (creates) | ⬜ pending |
| 16-09-02 | 09 | 4 | FOP-02, FOP-03 | T-16 upload | Conciliação UI: OFX upload via POST /api/financeiro/ofx + stage-coded table + N:1 Sheet + Previsto/Realizado | build | `npx tsc --noEmit 2>&1 \| grep -E "conciliacao\|Statement\|NToOne\|Previsto"; npm run build` | ❌ (creates) | ⬜ pending |
| 16-10-01 | 10 | 4 | TRIB-01 | — | Repasse UI: CompetenciaSelector + demonstrativo (getDemonstrativo) + Fechar Competência confirm | build | `npx tsc --noEmit 2>&1 \| grep -E "repasse\|Payout\|Competencia"; npm run build` | ❌ (creates) | ⬜ pending |
| 16-10-02 | 10 | 4 | TRIB-02, TRIB-03 | T-16 pdf | RPA UI: RpaFormDialog "Estimativa" + withholding breakdown + ReinfStatusBadge + nav cards | build | `npx tsc --noEmit 2>&1 \| grep -E "rpa\|Rpa\|Reinf\|financeiro/page"; npm run build` | ❌ (creates) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*"File Exists" = whether the test/target file exists before the task runs (❌ W0 = a Wave-0 RED scaffold; ❌ (creates) = produced by this task).*

---

## Wave 0 Requirements

- [ ] `src/lib/financeiro/__tests__/tax-tables.test.ts` — RED for TRIB-02 (INSS 11%/progressivo, IRRF gradual band w/ INSS deduction, ISS)
- [ ] `src/lib/financeiro/__tests__/payout-math.test.ts` — RED for TRIB-01 (deduções→base→%, service-rule precedence, sem_regra→0%+alerta)
- [ ] `src/lib/financeiro/__tests__/reconciliation.test.ts` — RED for FOP-02 (exact tolerance, fuzzy scoring, N:1 + fee)
- [ ] `src/lib/financeiro/__tests__/ofx-parser.test.ts` — RED for FOP-02 (FITID idempotency)
- [ ] `src/lib/reinf/__tests__/reinf.test.ts` — RED for TRIB-03 (ReinfProvider stub R-2010/R-4020)
- [ ] `src/__tests__/financeiro16/migrations-phase16.test.ts` — source-inspection of all new tables + ALTERs + RLS write-by-role (FOP-01/03, TRIB-02/03)
- [ ] `src/__tests__/financeiro16/{payables,bank-statements}.test.ts` — behavior specs for Wave-3 actions
- [ ] `src/__tests__/financeiro16/regression-guard-phase16.test.ts` — GREEN immediately (GIST/financial/ConnectorType regression guard)
- [ ] `src/__tests__/financeiro16/fixtures/sample.ofx` — minimal OFX SGML fixture (3 STMTTRN)

*Wave 0 is plan 16-01. `wave_0_complete` flips to true once these scaffolds are confirmed RED during execution.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `supabase db push` of all phase-16 migrations (16-05-01) | FOP-01/02/03, TRIB-01/02/03 | Human re-auth required (CLI/MCP often logged into wrong account nexus-*; correct = org kczvihafddupruvsrrsc / project jqjwyqlbbuqnrffdnlpp); autonomous:false | Re-login (`supabase login` / verify `supabase projects list`), set `SUPABASE_ACCESS_TOKEN`, run `supabase db push`; then 16-05-02 gen-types guard verifies tables landed |
| OFX upload + auto-reconciliation against a real bank statement | FOP-02 | Needs a real .ofx file + browser upload flow | Upload sample at /clinica/financeiro/conciliacao; confirm exact matches auto-conciliam (green) and fuzzy show as suggestions (amber) |
| EFD-Reinf transmission (real provider) | TRIB-03 | Gated on real provider/certificate — STUB only this phase | Verify stub returns `status:'transmitido'` + protocolo; real transmission deferred |

*All tax math, matching, payout, OFX parsing, and migrations have automated verification.*

---

## Validation Sign-Off

- [x] All auto tasks have `<automated>` verify; the one manual task (16-05-01 db push) is documented in Manual-Only
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (pure libs + migration + action specs)
- [x] No watch-mode flags
- [x] Feedback latency < 90s (build) / < 30s (unit)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-06-21 (planning-time contract; `wave_0_complete` set at execution)
