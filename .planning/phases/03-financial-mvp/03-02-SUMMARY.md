---
phase: 03-financial-mvp
plan: "02"
subsystem: payments
tags: [asaas, pix, boleto, webhook, idempotency, payment-gateway, server-action, rls]

# Dependency graph
requires:
  - phase: 03-01
    provides: "financial tables (charges, receivables, financial_transactions, webhook_events), patients.asaas_customer_id column, RLS policies"
  - phase: 01-x
    provides: "getActor pattern, createAdminClient, createClient, logBusinessEvent"
  - phase: 02-x
    provides: "patients table with cpf/phone/email columns"
provides:
  - "PaymentGateway interface (provider-agnostic) + AsaasAdapter implementation (D-01)"
  - "asaasFetch typed REST client (server-only, throws AsaasError on non-2xx)"
  - "createCharge Server Action: PIX QR, boleto bankSlipUrl, Asaas-native installments mirrored to N receivable rows"
  - "Customer dedup via patients.asaas_customer_id (D-06)"
  - "Idempotent webhook handler: token validation (401 on mismatch), immediate 200, upsert dedup on asaas_event_id, fire-and-forget processWebhookEvent"
  - "Auto-post income row to financial_transactions on PAYMENT_RECEIVED/CONFIRMED (D-08)"
  - "cancelCharge action, getCharge query"
  - "chargeSchema Zod v3 validator, ChargeInput type"
  - "Unit tests: charges.test.ts 9/9 GREEN, asaas.test.ts 6/6 GREEN (15/15 total)"
affects: [03-03, 03-04, 04-comms]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "PaymentGateway interface (gateway.ts): provider-agnostic contract, AsaasAdapter implements it; export const gateway = new AsaasAdapter() singleton"
    - "asaasFetch: server-only fetch wrapper with access_token + User-Agent headers; throws typed AsaasError(status, body)"
    - "Webhook: export const runtime = 'nodejs'; validate header before any processing; upsert ignoreDuplicates; fire-and-forget async handler"
    - "Customer dedup: read patients.asaas_customer_id; create-and-save only if null (Pitfall 8)"
    - "Double-credit guard: webhook_events.asaas_event_id UNIQUE + pre-insert check on (receivable_id, type='receita')"

key-files:
  created:
    - src/lib/asaas/types.ts
    - src/lib/asaas/client.ts
    - src/lib/asaas/gateway.ts
    - src/lib/validators/charge.ts
    - src/actions/charges.ts
    - src/app/api/webhooks/asaas/route.ts
    - src/__tests__/actions/charges.test.ts
    - src/__tests__/webhooks/asaas.test.ts
  modified:
    - .env.local.example

key-decisions:
  - "provider-agnostic PaymentGateway interface (D-01): future Stripe/outros gateways adicionam sem alterar charges/receivables schema"
  - "no stored vencido (D-04): status CHECK ('pendente','pago','estornado') — vencido derivado em read-time de due_date vs NOW()"
  - "webhook fire-and-forget: return 200 imediato, processWebhookEvent() async sem await — FIN-09 compliance"
  - "Task 4 live sandbox verification DEFERRED to UAT: code unit-tested 15/15 GREEN; real PIX→pay→webhook flow pending Asaas sandbox account (D-02)"

patterns-established:
  - "PaymentGateway pattern: all payment operations go through the interface, never call asaasFetch directly from actions"
  - "Webhook idempotency pattern: upsert on unique event id + application-level double-credit guard"
  - "Customer dedup pattern: check asaas_customer_id on patient before create; always persist back to patients row"

requirements-completed: [FIN-04, FIN-05, FIN-06, FIN-09]

# Metrics
duration: ~90min (Tasks 1-3 code complete; Task 4 deferred to UAT)
completed: 2026-06-06
---

# Phase 03 Plan 02: Asaas Payment Integration Summary

**Provider-agnostic PaymentGateway abstraction + AsaasAdapter (PIX QR / boleto / installments) + idempotent webhook auto-posting income to cash flow; 15/15 unit tests GREEN; live sandbox verification deferred to UAT (no Asaas account yet)**

## Performance

- **Duration:** ~90 min (code tasks 1-3)
- **Started:** 2026-06-06
- **Completed:** 2026-06-06 (code complete; Task 4 deferred)
- **Tasks:** 3/4 (Task 4 is a UAT deferral — not a code task)
- **Files modified:** 9

## Accomplishments

- PaymentGateway interface + AsaasAdapter built in `src/lib/asaas/gateway.ts` (D-01); all charge operations are provider-agnostic — a future Stripe adapter is a drop-in
- `createCharge` Server Action handles PIX (returns encodedImage + payload QR), boleto (returns bankSlipUrl), and Asaas-native installments (each parcel mirrored to a `receivables` row); customer dedup via `patients.asaas_customer_id` prevents duplicate Asaas customer creation (D-06)
- Idempotent webhook handler: validates `asaas-access-token` (401 on mismatch), returns 200 immediately, dedups via `webhook_events` upsert on `asaas_event_id`, fire-and-forget `processWebhookEvent` inserts income into `financial_transactions` on PAYMENT_RECEIVED/CONFIRMED; defense-in-depth double-credit guard on `(receivable_id, type='receita')` (D-07, D-08, FIN-09)
- Unit tests: `charges.test.ts` 9/9 GREEN + `asaas.test.ts` 6/6 GREEN; `tsc --noEmit` exit 0

## Task Commits

Each code task was committed atomically:

1. **Task 1: Asaas client + PaymentGateway + adapter + charge validator** - `6aad525` (feat)
2. **Task 2: createCharge Server Action** - `1b6ce9d` (feat)
3. **Task 3: Idempotent webhook handler** - `c8b5aab` (feat)

Task 4 (live Asaas sandbox verification) was deferred to UAT — see `03-HUMAN-UAT.md`.

## Files Created/Modified

- `src/lib/asaas/types.ts` — AsaasCustomer, AsaasPayment, AsaasPixQrCode, AsaasWebhookEvent, gateway param/result types
- `src/lib/asaas/client.ts` — server-only asaasFetch wrapper + AsaasError (throws on non-2xx)
- `src/lib/asaas/gateway.ts` — PaymentGateway interface + AsaasAdapter (createCustomer, createCharge, getPixQrCode, getInstallmentCharges, cancelCharge); exports `gateway` singleton
- `src/lib/validators/charge.ts` — chargeSchema Zod v3 (patientId, billingType enum, value, dueDate, installmentCount 1-21); exports ChargeInput
- `src/actions/charges.ts` — createCharge (role-gated, customer dedup, installment mirroring, PIX QR / boleto return), getCharge, cancelCharge; uses `logBusinessEvent` (IDs only)
- `src/app/api/webhooks/asaas/route.ts` — POST handler (nodejs runtime), token validation, upsert dedup, fire-and-forget processWebhookEvent, income auto-post, refund reversal
- `src/__tests__/actions/charges.test.ts` — 9 unit tests covering adapter shape, createCharge flows
- `src/__tests__/webhooks/asaas.test.ts` — 6 unit tests covering token validation, dedup, income posting
- `.env.local.example` — ASAAS_API_KEY, ASAAS_BASE_URL, ASAAS_WEBHOOK_SECRET, CRON_SECRET added with comments

## Decisions Made

- **PaymentGateway interface (D-01):** Charges schema uses `provider TEXT DEFAULT 'asaas'` + `provider_charge_id`/`provider_installment_id` as generic columns; zero DDL changes to add Stripe later.
- **No stored `vencido` status (D-04):** DB constraint is `CHECK (status IN ('pendente','pago','estornado'))`; `vencido` derived at read-time from `due_date < NOW()` — avoids stale states from clock-skew.
- **Webhook fire-and-forget:** Return 200 to Asaas immediately; `processWebhookEvent()` runs async without `await` — FIN-09 compliance; Asaas retry logic is harmless due to dedup.
- **Live sandbox Task 4 deferred to UAT (D-02):** The plan marked Task 4 as `type="checkpoint:human-verify" gate="blocking"`. User has no Asaas sandbox account at this time. Code is fully unit-tested (15/15 GREEN) and the deferral is tracked in `03-HUMAN-UAT.md` as item FIN-09-live.

## Deviations from Plan

None — plan executed exactly as written for Tasks 1-3. Task 4 was a human-verify checkpoint (not autonomous code) explicitly requiring an Asaas sandbox account the user does not yet have; deferral is per user instruction, tracked as a UAT item.

## Known Stubs

None — no UI components were built in this plan (integration layer only). The `gateway` singleton returns real Asaas data when env vars are set; when not set, `asaasFetch` throws immediately (no silent empty returns to UI).

## Issues Encountered

None — Tasks 1-3 executed cleanly. `tsc --noEmit` exit 0 after each task.

## Deferred Items

**Task 4: Live Asaas sandbox PIX → pay → webhook verification (D-02)**
- Requires: free Asaas sandbox account at https://sandbox.asaas.com + ASAAS_API_KEY, ASAAS_BASE_URL, ASAAS_WEBHOOK_SECRET env vars + webhook registration (ngrok/Vercel preview URL)
- Status: tracked in `03-HUMAN-UAT.md` as item 1 (pending)
- Code correctness: 15/15 unit tests GREEN; real end-to-end PIX→pay→webhook flow not yet run against a live sandbox

## Threat Surface

All STRIDE mitigations from the plan's threat model were implemented:

| Threat ID | Mitigation | Verified |
|-----------|-----------|---------|
| T-3-webhook-S | `asaas-access-token` header validated → 401 on mismatch | Unit test: asaas.test.ts |
| T-3-webhook-T | `webhook_events` UNIQUE dedup + pre-insert guard on `(receivable_id, type='receita')` | Unit test: asaas.test.ts |
| T-3-webhook-I | tenant_id derived from matched charge (not from webhook payload) | Code review |
| T-3-charge-E | getActor role gate (admin/dentist/receptionist/superadmin) in createCharge | Unit test: charges.test.ts |
| T-3-charge-I | `createAdminClient` is server-only; `import 'server-only'` in client.ts + gateway.ts | tsc --noEmit |
| T-3-card | billingType=CREDIT_CARD routes to Asaas tokenization only; no raw card data stored | Code review |
| T-3-xss | Only Asaas `description` string surfaced to UI; never innerHTML/eval | Code review |

## Next Phase Readiness

- Wave 3 plans (03-03 + 03-04) can start immediately
- 03-03 (Financial UI) uses `createCharge`, `getCharge`, `cancelCharge` from `src/actions/charges.ts` — all exported and typed
- 03-04 (Collection ruler + PDF receipt + SEC-06 headers) uses `financial_transactions` rows inserted by the webhook handler — schema live from 03-01
- Task 4 UAT can proceed in parallel with Wave 3 code work as soon as an Asaas sandbox account is provisioned

---
*Phase: 03-financial-mvp*
*Completed: 2026-06-06 (Tasks 1-3; Task 4 deferred to UAT)*
