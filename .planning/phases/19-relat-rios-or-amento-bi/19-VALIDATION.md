---
phase: 19
slug: relat-rios-or-amento-bi
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-19
---

# Phase 19 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^4.1.8 |
| **Config file** | `vitest.config.ts` (repo root) — `include: ['src/__tests__/**/*.test.ts', 'src/lib/**/__tests__/**/*.test.ts']` |
| **Quick run command** | `npx vitest run <specific new test file touched>` |
| **Full suite command** | `npm test` (= `vitest run`) |
| **Estimated runtime** | ~30-60 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run <specific new test file touched>`
- **After every plan wave:** Run `npm test` (full suite)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 19-XX-XX | TBD | TBD | REP-01 | T-19-01 | DRE aggregation groups by account/type and computes % of revenue correctly | unit | `npx vitest run src/lib/financeiro/__tests__/dre-math.test.ts` | ❌ W0 | ⬜ pending |
| 19-XX-XX | TBD | TBD | REP-01 | T-19-01 | Unit filter resolves to cost_center_ids; "Todas" includes NULL cost_center rows | unit | `npx vitest run src/actions/__tests__/dre.test.ts` | ❌ W0 | ⬜ pending |
| 19-XX-XX | TBD | TBD | REP-01 | T-19-01 | YoY availability: ≥12 months history → real prior-year comparison (period shifted 1yr); <12 months → available:false (D-11) | unit | `npx vitest run src/actions/__tests__/dre.test.ts` | ❌ W0 | ⬜ pending |
| 19-XX-XX | TBD | TBD | REP-02 | T-19-01 | Budget deviation semaphore returns correct verde/amarelo/vermelho at boundary values | unit | `npx vitest run src/lib/financeiro/__tests__/dre-math.test.ts` | ❌ W0 | ⬜ pending |
| 19-XX-XX | TBD | TBD | REP-02 | T-19-01 | Past-month budget edits are rejected (D-18 lock) | unit/integration | `npx vitest run src/actions/__tests__/budget-targets.test.ts` | ❌ W0 | ⬜ pending |
| 19-XX-XX | TBD | TBD | REP-03 | T-19-02 | Vigência query resolves correct percentual for a historical date | unit | `npx vitest run src/lib/financeiro/__tests__/partner-shares.test.ts` | ❌ W0 | ⬜ pending |
| 19-XX-XX | TBD | TBD | REP-03 | T-19-02 | Sum-to-100% validation blocks a new vigência that doesn't reconcile | unit | `npx vitest run src/actions/__tests__/partner-shares.test.ts` | ❌ W0 | ⬜ pending |
| 19-XX-XX | TBD | TBD | BI-01/BI-02 | T-19-03 | Linear trend computation matches known OLS values; `insufficientData` true below 3 points | unit | `npx vitest run src/lib/bi/__tests__/forecast-math.test.ts` | ❌ W0 | ⬜ pending |
| 19-XX-XX | TBD | TBD | BI-02 | T-19-03 | `withAgentPolicy` called per-clinic (never aggregate) inside the cron scan loop | source-inspection/regression | `npx vitest run src/__tests__/governance/bi-forecast-agent.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/financeiro/__tests__/dre-math.test.ts` — new pure-function test file, no scaffold exists yet
- [ ] `src/lib/bi/__tests__/forecast-math.test.ts` — new pure-function test file
- [ ] `src/lib/financeiro/__tests__/partner-shares.test.ts` — vigência resolution + sum-validation tests
- [ ] Framework install: none — Vitest already configured and used by every prior phase's `__tests__` directories

Wave 0 test files above are planned inside Plans 01 (dre-math), 02 (forecast-math / partner-shares math) and 04 (dre action + YoY availability) — hence `wave_0_complete: true` (all MISSING references have an owning plan that creates them RED-first).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| DRE drill-down UI navigation (line → cost centers → transactions) | REP-01 | Visual/interaction flow, not a pure function | Load `/clinica/relatorios`, click a DRE line, confirm the first Accordion level shows cost-center subtotals (D-06) and expanding one lists its `financial_transactions` (D-05) matching account_id+período+unidade |
| DRE YoY comparison display (D-11) | REP-01 | Depends on live clinic history length; visual delta rendering | With ≥12 months of history, confirm `/clinica/relatorios` shows a real YoY delta badge; with a young clinic (<12 months) confirm "comparação indisponível" renders and the screen does NOT crash |
| Sócio-only equity share visibility (own row vs others hidden in UI) | REP-03 | Requires authenticated session as different roles to observe rendered UI | Log in as sócio A, confirm only own cota shown; log in as admin, confirm all sócios shown |
| BI dashboard tab navigation + "Alertas & Previsões" fixed-top behavior | BI-01 | Visual layout behavior | Load `/bi`, switch tabs, confirm alerts section stays visible across all tabs |
| PDF export visual layout (DRE/Orçamento/BI) | REP-01, REP-02 | PDF rendering output, not unit-testable | Generate PDF export for each screen, visually confirm layout/values match on-screen data |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
