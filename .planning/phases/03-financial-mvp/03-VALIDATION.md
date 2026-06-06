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
| 03-01-01 | 01 | 1 | FIN-02,03,06 | T-3-* | tenant isolation + audit on financial_transactions | static SQL | `npx vitest run src/__tests__/migrations/financial.test.ts` | ❌ W0 | ⬜ pending |
| 03-02-xx | 02 | 2 | FIN-04,05 | — | Asaas charge via PaymentGateway adapter | unit | `npx vitest run src/__tests__/actions/charges.test.ts` | ❌ W0 | ⬜ pending |
| 03-02-xx | 02 | 2 | FIN-09 | T-3-webhook | idempotent webhook (dedup by asaas_event_id) | unit | `npx vitest run src/__tests__/webhooks/asaas.test.ts` | ❌ W0 | ⬜ pending |
| 03-03-01 | 03 | 3 | FIN-02 | T-3-ui-E | createTransaction gates role + scopes tenant | unit | `npx vitest run src/__tests__/actions/transactions.test.ts` | ❌ W0 | ⬜ pending |
| 03-03-02 | 03 | 3 | FIN-03,06 | T-3-ui-I | read-time vencido derivation + installment Accordion | source-inspect | `npx vitest run src/__tests__/financeiro/receivables.test.ts` | ❌ W0 | ⬜ pending |
| 03-03-03 | 03 | 3 | FIN-04,05 | T-3-ui-V | ChargeForm calls createCharge + Switch + base64 QR | source-inspect | `npx vitest run src/__tests__/financeiro/charge-form.test.ts` | ❌ W0 | ⬜ pending |
| 03-04-01 | 04 | 3 | FIN-08,SEC-06 | T-3-pdf-I,T-3-sec06-* | ReceiboPDF BRL/pt-BR + recibo role gate (admin/dentist/receptionist per ROADMAP SC-4) + CSP/HSTS headers | source-inspect | `npx vitest run src/__tests__/pdf/recibo.test.ts src/__tests__/config/security-headers.test.ts` | ❌ W0 | ⬜ pending |
| 03-04-02 | 04 | 3 | FIN-07 | T-3-cron-E,T-3-cron-T | collection ruler engine + CRON_SECRET + idempotent milestone | unit | `npx vitest run src/__tests__/collection/ruler.test.ts` | ❌ W0 | ⬜ pending |
| 03-04-03 | 04 | 3 | FIN-07 | T-3-ui-E | admin-gated ruler config + Acesso restrito + Fase 4 note | source-inspect | `npx vitest run src/__tests__/collection/ruler-config.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/__tests__/migrations/financial.test.ts` — SQL assertions: charges/payments tables (provider, provider_charge_id), receivables/installments, financial_transactions, categories (seeded), collection_rules/collection_log; RLS enabled + WITH CHECK; audit trigger on financial_transactions (reuses Phase 2 SEC-03 audit function); tenant_id indexed.
- [ ] `src/__tests__/actions/charges.test.ts` — PaymentGateway adapter shape + charge creation mapping (FIN-04, FIN-05, FIN-06).
- [ ] `src/__tests__/actions/transactions.test.ts` — createTransaction action unit test (FIN-02): exports createTransaction, validates type receita/despesa, scopes by tenant. (Authored RED in Plan 01 Task 0; turns GREEN in Plan 03 Task 1.)
- [ ] `src/__tests__/webhooks/asaas.test.ts` — idempotency: duplicate `asaas_event_id` does not double-credit; token validation (FIN-09).
- [ ] `src/__tests__/collection/ruler.test.ts` — ruler selects overdue receivables at correct cadence; idempotent per (receivable + milestone) (FIN-07).
- [ ] `src/__tests__/pdf/recibo.test.ts` — BRL/pt-BR formatting; ReceiboPDF Flexbox layout; recibo route role allowlist includes receptionist (ROADMAP SC-4) (FIN-08).
- [ ] `src/__tests__/config/security-headers.test.ts` — SEC-06 header assertions: CSP, HSTS, X-Frame-Options, X-Content-Type-Options + wss://*.supabase.co + api-sandbox.asaas.com. (Authored RED in Plan 01 Task 0; turns GREEN in Plan 04 Task 1.)

*vitest itself is already installed — no framework install needed in Wave 0.*

> Behavioral tests authored within their producing wave (not Wave 0), to keep no 3 consecutive impl tasks without a behavioral automated check:
> - `src/__tests__/financeiro/money.test.ts` (Plan 03 Task 1 — pure helpers)
> - `src/__tests__/financeiro/receivables.test.ts` (Plan 03 Task 2 — vencido derivation + Accordion)
> - `src/__tests__/financeiro/charge-form.test.ts` (Plan 03 Task 3 — createCharge wiring)
> - `src/__tests__/collection/ruler-config.test.ts` (Plan 04 Task 3 — admin gate + Fase 4 note)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| End-to-end PIX charge → pay → webhook → status paid | FIN-04, FIN-09 | Requires live/sandbox Asaas account + real payment + public webhook URL (ngrok) | Create sandbox Asaas account, register webhook, emit PIX charge, pay in sandbox, confirm DB status flips to pago |
| Boleto + installment tracking | FIN-05, FIN-06 | Requires Asaas sandbox | Emit parcelado charge, confirm each parcel mirrored as receivable |
| Collection email actually delivered | FIN-07 | Requires Resend live send | Trigger ruler against an overdue receivable, confirm email arrives |
| Receptionist can download recibo.pdf | FIN-08 (ROADMAP SC-4) | Requires a logged-in receptionist session | Log in as receptionist, open a paid charge, click "Baixar Recibo", confirm PDF downloads (no 403) |
| Security headers present on responses | SEC-06 | Requires running server / deployed app | `curl -I https://fynxia.vercel.app` shows CSP, HSTS, X-Frame-Options, X-Content-Type-Options |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (incl. transactions.test.ts FIN-02 + security-headers.test.ts SEC-06)
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
</content>
