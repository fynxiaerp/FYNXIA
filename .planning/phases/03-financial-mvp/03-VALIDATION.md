---
phase: 3
slug: financial-mvp
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-06
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.8 (already installed since Phase 1) |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run {changed test file}` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~2 seconds (full suite, 176 tests as of Phase 2) |

Test style: source-inspection for migrations/`'use server'` modules (readFileSync assertions, per Phase 2 pattern — `'use server'` pulls in `server-only` which throws under Vitest), pure-function unit tests for validators/helpers, and logic tests for gateway adapter + webhook idempotency.

---

## Sampling Rate

- **After every task commit:** Run the relevant `npx vitest run {file}`
- **After every plan wave:** Run `npx vitest run` (full suite) + `npx tsc --noEmit`
- **Before `/gsd-verify-work`:** Full suite green + `next build` green (catches `'use server'` async-export errors that Vitest/tsc miss — lesson from Phase 2/3 deploy)
- **Max feedback latency:** ~10 seconds

---

## Per-Task Verification Map

> Populated by the planner. Maps each task to its requirement, threat, and automated check. Derived from RESEARCH.md §Validation Architecture.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03-01-00 | 01 | 0 | FIN-01..09 | — | N/A | scaffold | `npx vitest run src/__tests__/migrations/financial.test.ts` | ❌ W0 | ⬜ pending |
| 03-01-xx | 01 | 1 | FIN-02,03,06,09,SEC-03 | T-3-* | tenant isolation + audit on financial_transactions | static SQL | `npx vitest run src/__tests__/migrations/financial.test.ts` | ❌ W0 | ⬜ pending |
| 03-xx | — | — | FIN-04,05 | — | Asaas charge via PaymentGateway adapter | unit | `npx vitest run src/__tests__/actions/charges.test.ts` | ❌ W0 | ⬜ pending |
| 03-xx | — | — | FIN-09 | T-3-webhook | idempotent webhook (dedup by asaas_event_id) | unit | `npx vitest run src/__tests__/webhooks/asaas.test.ts` | ❌ W0 | ⬜ pending |
| 03-xx | — | — | FIN-07 | — | collection ruler engine + Resend email | unit | `npx vitest run src/__tests__/collection/ruler.test.ts` | ❌ W0 | ⬜ pending |
| 03-xx | — | — | FIN-08 | — | ReceiboPDF renders BRL/pt-BR | unit | `npx vitest run src/__tests__/pdf/recibo.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/__tests__/migrations/financial.test.ts` — SQL assertions: charges/payments tables (provider, provider_charge_id), receivables/installments, financial_transactions, categories (seeded), collection_rules/collection_log; RLS enabled + WITH CHECK; audit trigger on financial_transactions (SEC-03); tenant_id indexed.
- [ ] `src/__tests__/actions/charges.test.ts` — PaymentGateway adapter shape + charge creation mapping.
- [ ] `src/__tests__/webhooks/asaas.test.ts` — idempotency: duplicate `asaas_event_id` does not double-credit; token validation.
- [ ] `src/__tests__/collection/ruler.test.ts` — ruler selects overdue receivables at correct cadence; idempotent per (receivable + milestone).
- [ ] `src/__tests__/pdf/recibo.test.ts` — BRL/pt-BR formatting helpers; ReceiboPDF Flexbox layout.

*vitest itself is already installed — no framework install needed in Wave 0.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| End-to-end PIX charge → pay → webhook → status paid | FIN-04, FIN-09 | Requires live/sandbox Asaas account + real payment + public webhook URL (ngrok) | Create sandbox Asaas account, register webhook, emit PIX charge, pay in sandbox, confirm DB status flips to pago |
| Boleto + installment tracking | FIN-05, FIN-06 | Requires Asaas sandbox | Emit parcelado charge, confirm each parcel mirrored as receivable |
| Collection email actually delivered | FIN-07 | Requires Resend live send | Trigger ruler against an overdue receivable, confirm email arrives |
| Security headers present on responses | SEC-06 | Requires running server / deployed app | `curl -I https://fynxia.vercel.app` shows CSP, HSTS, X-Frame-Options, X-Content-Type-Options |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
