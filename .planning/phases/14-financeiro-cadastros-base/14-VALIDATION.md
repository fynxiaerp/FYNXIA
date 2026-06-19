---
phase: 14
slug: financeiro-cadastros-base
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-19
---

# Phase 14 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Detailed Validation Architecture lives in 14-RESEARCH.md — this file is the execution-time sampling contract.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest + tsc (typecheck) + `supabase db push` (schema apply) |
| **Config file** | vitest.config.ts (existing) |
| **Quick run command** | `npm run build` |
| **Full suite command** | `npm run build && npx vitest run` |
| **Estimated runtime** | ~90 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run build` (catches `'use server'` + type errors that vitest/tsc miss separately)
- **After every plan wave:** Run `npm run build && npx vitest run`
- **Before `/gsd-verify-work`:** Full suite green + schema pushed to Supabase
- **Max feedback latency:** 90 seconds

---

## Per-Task Verification Map

> Filled per plan during planning. Each schema/Server Action task maps to a requirement and an automated check.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 14-01-* | 01 | 1 | FCAD-01 | — | RLS isolates new cadastros by clinic_id; write admin-only | schema/RLS | `supabase db push` + RLS smoke query | ❌ W0 | ⬜ pending |
| 14-02-* | 02 | 2 | FCAD-02 | — | New manual transaction rejected without account_id + cost_center_id; auto-posted/legacy defaulted | unit (Zod/Server Action) | `npx vitest run` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] RLS smoke test helper for the 3 new tables (chart_of_accounts, cost_centers, bank_accounts) — confirm cross-tenant SELECT returns 0 rows and non-admin write is denied
- [ ] Zod schema unit tests for the manual-transaction classification rule (account_id + cost_center_id required)
- [ ] Migration backfill assertion: 0 legacy financial_transactions rows left without a resolvable default cost_center_id

*Existing vitest infrastructure covers the unit layer; schema verification is via `supabase db push` against the dev project.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Plano de contas renderiza como árvore hierárquica na tela de cadastro | FCAD-01 (SC1) | Visual tree render — verified via UI, not unit test | Abrir tela de cadastro do plano de contas; confirmar grupos → subgrupos → contas folha aninhados |
| Filtro por unidade/centro de custo funciona no fluxo de caixa e relatórios | FCAD-02 (SC2) | End-to-end UI filter behavior | Aplicar filtro de unidade/CC; confirmar que lançamentos filtram corretamente |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
