---
phase: 03-financial-mvp
verified: 2026-06-06T18:00:00Z
status: human_needed
score: 5/5 must-haves verified (code); 3/5 success criteria fully confirmable without Asaas account
human_verification:
  - test: "Live Asaas sandbox: createCharge(billingType=PIX) → pay in simulator → verify webhook fires"
    expected: "receivables.status flips to 'pago', paid_at populated, financial_transactions income row inserted"
    why_human: "Requires provisioned Asaas sandbox account + registered webhook URL (D-02 CONTEXT). See 03-HUMAN-UAT.md for full setup steps."
  - test: "Live Asaas sandbox: replay the same webhook event (Asaas dashboard 'reenviar') after first delivery"
    expected: "No second financial_transactions row created — idempotency guaranteed by webhook_events.asaas_event_id UNIQUE + (receivable_id, type='receita') guard"
    why_human: "Requires live Asaas account and a paid charge to replay. Code unit-tested 6/6 but live replay not run."
  - test: "Live Asaas sandbox: create a boleto installment charge (installmentCount=3), confirm each parcel renders in contas-a-receber with correct individual values that sum to the total"
    expected: "3 receivable rows with due dates, each showing correct parcel value (cents distributed per CR-01 fix), vencido derived client-side for overdue parcels"
    why_human: "Requires live Asaas account + real installment response from Asaas API to confirm the gateway.getInstallmentCharges() call works end-to-end."
  - test: "PDF receipt visual rendering: navigate to a paid charge's recibo.pdf route as receptionist"
    expected: "A4 PDF downloads with clinic name, patient name, CPF, billing method, amount (R$ X.XXX,XX pt-BR), paidAt date, Asaas provider_charge_id, Roboto font (no character encoding issues for ã/ç/ê/õ)"
    why_human: "Visual correctness of @react-pdf/renderer output cannot be asserted programmatically; font registration from Google Fonts CDN requires runtime."
  - test: "Verify CSP, HSTS, X-Frame-Options, X-Content-Type-Options are present on a live deployed response"
    expected: "curl -I {deployed-url} shows all 4 security headers; X-Frame-Options: DENY; Strict-Transport-Security with preload"
    why_human: "next.config.ts headers() only takes effect in a running Next.js server; cannot verify without deployment."
  - test: "Collection ruler email delivery: create a receivable with due_date = today, confirm email is delivered to patient"
    expected: "Resend sends CollectionReminderEmail with real clinic name, correct BRL amount; collection_log row created; a second cron run does NOT send duplicate"
    why_human: "Requires deployed cron endpoint + RESEND_API_KEY + a due-today receivable in the DB."
---

# Phase 3: Financial MVP Verification Report

**Phase Goal:** The clinic can issue payment requests via Pix and boleto, track all receivables, and generate a PDF receipt — the cash flow view reflects real-time payment status without manual intervention.
**Verified:** 2026-06-06T18:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Context: Post-Fix Codebase

This verification runs against the POST-FIX codebase (after 03-REVIEW.md + 03-REVIEW-FIX.md). All 9 review findings (2 critical + 7 warning) were fixed and committed atomically (commits 4de86ae through a8abc07). Final build gate: 256/256 vitest GREEN, tsc exit 0, next build clean (30 routes).

The live Asaas sandbox verification (PIX→pay→webhook real flow) is structurally deferred per 03-HUMAN-UAT.md because no Asaas account exists yet (CONTEXT D-02). Integration code is fully unit-tested (15/15 GREEN). This deferred item constitutes the human_needed gap.

---

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Code Status | Live Status |
|---|-------|-------------|-------------|
| 1 | Receptionist generates PIX link → patient pays → webhook fires → DB status = pago automatically | CODE VERIFIED (15/15 unit tests) | NEEDS HUMAN (no Asaas account) |
| 2 | Receptionist generates boleto + installment tracking, each parcel shows due date + status (pendente/pago/vencido) in receivables view | CODE VERIFIED | NEEDS HUMAN (live boleto end-to-end) |
| 3 | Cash flow view displays current-month income vs expense with correct totals; new transaction appears within one refresh | VERIFIED | VISUAL HUMAN CHECK |
| 4 | Receptionist can generate and download a PDF receipt for a completed payment (@react-pdf/renderer) | CODE VERIFIED | NEEDS HUMAN (visual + route live test) |
| 5 | Webhook returns HTTP 200 immediately, processes asynchronously, idempotent (no duplicate credit); security headers on all responses | CODE VERIFIED (CSP/HSTS/X-Frame/X-Content-Type in next.config.ts; dedup logic unit-tested) | NEEDS HUMAN (live replay + deployed headers check) |

**Code score:** 5/5 truths — implementation complete and substantive

---

### Required Artifacts

| Artifact | Status | Evidence |
|----------|--------|---------|
| `supabase/migrations/20260606000100_financial_tables.sql` | VERIFIED | 7 CREATE TABLE, asaas_customer_id, asaas_event_id UNIQUE, audit trigger, no stored vencido |
| `supabase/migrations/20260606000200_financial_rls.sql` | VERIFIED | ENABLE RLS + USING + WITH CHECK via get_my_tenant_id() on all 6 tenant tables; webhook_events intentionally excluded |
| `supabase/migrations/20260606000300_financial_categories_seed.sql` | VERIFIED | seed_financial_categories() trigger + backfill; 'Consulta', 'Aluguel' literals present |
| `src/lib/asaas/gateway.ts` | VERIFIED | `interface PaymentGateway` + `class AsaasAdapter implements PaymentGateway` + `server-only` import |
| `src/lib/asaas/client.ts` | VERIFIED | `server-only`, `AsaasError`, `access_token` + `User-Agent: FYNXIA/1.0` headers |
| `src/lib/validators/charge.ts` | VERIFIED | `chargeSchema` + `isMoney2dp` refine (WR-01 fix applied) |
| `src/actions/charges.ts` | VERIFIED | `createCharge` (role-gated), `asaas_customer_id` dedup, `getInstallmentCharges`, `getPixQrCode`, `getCharge` with staff role gate (WR-06 fix), `totalCents`/`baseCents` cents distribution (CR-01 fix) |
| `src/app/api/webhooks/asaas/route.ts` | VERIFIED | `runtime='nodejs'`, `asaas-access-token` validation (401), 200 immediately, `onConflict: 'asaas_event_id'`, fire-and-forget, income from `receivable.value` (CR-02 fix), refund idempotency guard (WR-02 fix) |
| `src/lib/format/money.ts` | VERIFIED | `formatBRL` (`toLocaleString('pt-BR',...)`), `deriveReceivableStatus` (date-fns isPast/parseISO) |
| `src/actions/transactions.ts` | VERIFIED | `createTransaction` (role-gated, Zod, INSERT financial_transactions), `listTransactions` with YYYY-MM regex guard (WR-07 fix), `isMoney2dp` refine |
| `src/actions/receivables.ts` | VERIFIED | `listReceivables` returns raw DB status — vencido NOT computed server-side (D-04 compliance) |
| `src/app/(dashboard)/clinica/financeiro/fluxo-de-caixa/page.tsx` | VERIFIED | Server Component, listTransactions, CashFlowTotals, TransactionList, ?month nav |
| `src/app/(dashboard)/clinica/financeiro/contas-a-receber/page.tsx` | VERIFIED | Server Component, listReceivables, ReceivablesTable |
| `src/app/(dashboard)/clinica/financeiro/nova-cobranca/page.tsx` | VERIFIED | Server Component, ChargeForm |
| `src/components/financeiro/CashFlowTotals.tsx` | VERIFIED | formatBRL, entradas/saidas/saldo, aria-label |
| `src/components/financeiro/TransactionList.tsx` | VERIFIED | TanStack Table v8, nuqs filters |
| `src/components/financeiro/TransactionModal.tsx` | VERIFIED | createTransaction wired |
| `src/components/financeiro/ReceivablesTable.tsx` | VERIFIED | deriveReceivableStatus called client-side, Accordion for installment groups (FIN-06) |
| `src/components/financeiro/ChargeForm.tsx` | VERIFIED | createCharge wired, Switch parcelamento, PixQRDisplay rendered on PIX success |
| `src/components/financeiro/PixQRDisplay.tsx` | VERIFIED | `data:image/png;base64,${encodedImage}` inline data URL |
| `src/app/(dashboard)/clinica/page.tsx` | VERIFIED | Financeiro hub card (DollarSign icon, `/clinica/financeiro`) |
| `next.config.ts` | VERIFIED | Content-Security-Policy (wss://*.supabase.co + api-sandbox.asaas.com), HSTS, X-Frame-Options DENY, X-Content-Type-Options nosniff |
| `src/components/pdf/ReceiboPDF.tsx` | VERIFIED | Font.register (Roboto), flexDirection (Flexbox only), toLocaleString('pt-BR') |
| `src/app/api/financeiro/charges/[id]/recibo.pdf/route.ts` | VERIFIED | runtime='nodejs', role gate includes receptionist, charge.status==='pago' guard (WR-04), paid_at from receivables (WR-03) |
| `src/lib/collection/ruler.ts` | VERIFIED | `selectReminders` pure function, milestone idempotency keys ('due_date', 'overdue_N') |
| `src/emails/CollectionReminderEmail.tsx` | VERIFIED | react-email template, formatBRL, clinicName prop |
| `src/app/api/cron/collection-ruler/route.ts` | VERIFIED | CRON_SECRET bearer validation (401), collection_log idempotency, clinicName from DB (WR-05 fix), actorId: null for system events |
| `vercel.json` | VERIFIED | crons: path=/api/cron/collection-ruler, schedule="0 8 * * *" |
| `src/actions/collection-ruler.ts` | VERIFIED | saveCollectionRuler admin/superadmin gate, getCollectionRuler |
| `src/app/(dashboard)/clinica/financeiro/regua-de-cobranca/page.tsx` | VERIFIED | "Acesso restrito" alert for non-admin |
| `src/components/financeiro/CollectionRulerForm.tsx` | VERIFIED | RHF + Switch, "Fase 4" WhatsApp deferral note |
| `src/types/database.types.ts` | VERIFIED | financial_transactions present (regenerated post-db-push) |

---

### Key Link Verification

| From | To | Via | Status |
|------|----|-----|--------|
| `ChargeForm.tsx` | `src/actions/charges.ts` | `import { createCharge }` + call on submit | WIRED |
| `TransactionModal.tsx` | `src/actions/transactions.ts` | `import { createTransaction }` + call on submit | WIRED |
| `/clinica/page.tsx` | `/clinica/financeiro` | navItems Financeiro card (href + DollarSign icon) | WIRED |
| `src/actions/charges.ts` | `src/lib/asaas/gateway.ts` | `new AsaasAdapter()` + `gateway.createCharge/getPixQrCode/getInstallmentCharges` | WIRED |
| `src/app/api/webhooks/asaas/route.ts` | `public.webhook_events` | upsert `onConflict: 'asaas_event_id', ignoreDuplicates: true` | WIRED |
| `webhook PAYMENT_RECEIVED handler` | `public.financial_transactions` | INSERT with `amount: receivable.value` (trusted local) | WIRED |
| `src/app/api/cron/collection-ruler/route.ts` | `public.collection_log` | INSERT with UNIQUE(receivable_id, milestone, channel), 23505 skip | WIRED |
| `src/app/api/cron/collection-ruler/route.ts` | Resend | `resend.emails.send({ react: CollectionReminderEmail })` | WIRED |
| `vercel.json` | `/api/cron/collection-ruler` | `crons[].path = "/api/cron/collection-ruler"`, `schedule = "0 8 * * *"` | WIRED |
| `recibo.pdf/route.ts` | `src/components/pdf/ReceiboPDF.tsx` | `renderToBuffer(createElement(ReceiboPDF, props))` | WIRED |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| `CashFlowTotals.tsx` | entradas/saidas/saldo | `listTransactions(month)` → SELECT financial_transactions scoped to month + tenant (RLS) | Yes — real DB query, totals computed from result | FLOWING |
| `ReceivablesTable.tsx` | receivables | `listReceivables()` → JOIN charges + receivables + patients (RLS) | Yes — real JOIN query | FLOWING |
| `ChargeForm.tsx` | chargeResult (pix/bankSlipUrl) | `createCharge` → `gateway.createCharge` → Asaas REST API | Yes when Asaas env vars set; throws AsaasError otherwise (no silent empty) | FLOWING (pending live creds) |
| `ReceiboPDF.tsx` | clinicName, patientName, amount, paidAt | `createClient()` SELECT charges+patients (RLS) + SELECT receivables.paid_at | Yes — real DB query per route handler | FLOWING |
| `CollectionRulerForm.tsx` | rule (enabled flags, interval) | `getCollectionRuler()` → SELECT collection_rules (PGRST116 fallback to defaults) | Yes — real DB query | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Method | Status |
|----------|--------|--------|
| Webhook route exists and has nodejs runtime | grep `runtime = 'nodejs'` in route.ts | PASS |
| 401 on invalid token | grep `status: 401` after header check | PASS |
| HTTP 200 immediate (fire-and-forget) | grep `processWebhookEvent(...).catch` before `return new Response('', {status:200})` | PASS |
| Dedup via asaas_event_id | grep `onConflict: 'asaas_event_id', ignoreDuplicates: true` | PASS |
| Income posted from trusted local value | grep `amount: receivable.value` in financial_transactions insert | PASS |
| Refund idempotency | grep `receivable.status === 'estornado'` guard + `existingReversal` check | PASS |
| CR-01 cents distribution | grep `totalCents`, `baseCents`, `Math.floor`, `Math.round` in charges.ts | PASS |
| Security headers | grep all 4 header keys in next.config.ts; wss://*.supabase.co + api-sandbox.asaas.com in CSP | PASS |
| ReceiboPDF gated to pago | grep `charge.status !== 'pago'` → 409 | PASS |
| ReceiboPDF includes receptionist | grep `'receptionist'` in allowedRoles | PASS |
| paid_at from receivables not charges | grep `paidReceivable?.paid_at` | PASS |
| vencido never stored | grep `vencido` in 000100 migration = comment only; `deriveReceivableStatus` called only in client components | PASS |
| Month input validated | grep `^\d{4}-(0[1-9]|1[0-2])$` regex in transactions.ts | PASS |
| 2dp money validation | grep `isMoney2dp` refine in both schemas | PASS |
| getCharge role gate | grep `allowedRoles` check in getCharge function | PASS |
| Cron uses real clinic name | grep `clinic?.name ?? 'Sua clínica'` in cron route | PASS |
| Live Asaas PIX→pay→webhook | Requires live Asaas sandbox account | NEEDS HUMAN |

---

### Requirements Coverage

| Req ID | Phase Plans | Description | Code Status | Live Status |
|--------|-------------|-------------|-------------|-------------|
| FIN-01 | 03-01, 03-03 | Cash flow view with entradas/saidas/saldo | SATISFIED | VISUAL HUMAN CHECK |
| FIN-02 | 03-01, 03-03 | Manual transaction (receita/despesa, category, value, date) | SATISFIED | VISUAL HUMAN CHECK |
| FIN-03 | 03-01, 03-03 | Receivables list with pendente/pago/vencido status + due dates | SATISFIED | VISUAL HUMAN CHECK |
| FIN-04 | 03-02, 03-03 | PIX payment link via Asaas + auto-confirm via webhook | CODE SATISFIED | NEEDS HUMAN (live Asaas) |
| FIN-05 | 03-02, 03-03 | Boleto generation via Asaas | CODE SATISFIED | NEEDS HUMAN (live Asaas) |
| FIN-06 | 03-01, 03-02, 03-03 | Installment tracking per parcel with date + status | CODE SATISFIED | NEEDS HUMAN (live installment response) |
| FIN-07 | 03-04 | Automated collection sequence (email at vencimento + N days overdue, idempotent) | SATISFIED | NEEDS HUMAN (deployed cron + RESEND_API_KEY) |
| FIN-08 | 03-04 | PDF receipt via @react-pdf/renderer | CODE SATISFIED | NEEDS HUMAN (visual PDF check) |
| FIN-09 | 03-02 | Webhook returns 200 immediately, async, idempotent — no duplicate credit | CODE SATISFIED (15/15 unit tests) | NEEDS HUMAN (live replay) |
| SEC-06 | 03-04 | Security headers: CSP, HSTS, X-Frame-Options, X-Content-Type-Options | SATISFIED in next.config.ts | NEEDS HUMAN (deployed curl check) |

**Notes:**
- REQUIREMENTS.md marks FIN-09 as "Pending" — this correctly reflects the live end-to-end sandbox verification has not yet been performed. The implementation code is complete and unit-tested.
- FIN-01 through FIN-03 and FIN-07 are marked "Complete" in REQUIREMENTS.md; the code implementations are substantive and wired.

---

### Anti-Patterns Found

| File | Pattern | Severity | Assessment |
|------|---------|----------|------------|
| `src/app/api/webhooks/asaas/route.ts` | `console.error` as only error channel on send failures | Info (IN-04) | Acknowledged in REVIEW; not a blocker — collection_log idempotency still holds |
| `src/components/pdf/ReceiboPDF.tsx` | Remote Google Fonts fetched at render time | Info (IN-05) | Accepted design choice; CSP allows it; no functional blocker |
| 4 Server Action files | `getActor()` helper duplicated | Info (IN-01) | Not a blocker; refactor deferred |
| `src/components/financeiro/CashFlowTotals.tsx` | Re-implements minus sign instead of using `formatBRLSigned` | Info (IN-03) | Minor inconsistency; not a blocker |

No STUB, MISSING, or ORPHANED artifacts found. No critical or warning anti-patterns remain after the REVIEW-FIX pass.

---

### Human Verification Required

#### 1. Live Asaas PIX Charge Flow (FIN-04, SC-1)

**Test:** With an Asaas sandbox account provisioned (see 03-HUMAN-UAT.md for full setup):
1. Navigate to /clinica/financeiro/nova-cobranca as a receptionist
2. Create a PIX charge for a test patient
3. Confirm the response block shows encodedImage QR + copia-e-cola payload

**Expected:** `{ success: true, chargeId, pix: { encodedImage, payload } }` — QR image renders in PixQRDisplay

**Why human:** Requires live Asaas sandbox API key (`ASAAS_API_KEY`) + `ASAAS_BASE_URL`. The `asaasFetch` client throws `AsaasError` if env vars are unset — no silent empty return.

---

#### 2. Webhook End-to-End + Idempotency Replay (FIN-09, SC-5)

**Test:**
1. After the PIX charge is paid in the Asaas sandbox simulator, confirm the webhook fires to the registered URL
2. Check Supabase: `receivables.status = 'pago'`, `paid_at` populated, one `financial_transactions` row with `type='receita'`
3. In Asaas dashboard, replay the same webhook event ("reenviar webhook")
4. Confirm no second `financial_transactions` row is created

**Expected:** Idempotency holds — `webhook_events.asaas_event_id` UNIQUE dedup + `(receivable_id, type='receita')` guard prevents duplicate credit

**Why human:** Requires a live paid Asaas charge + registered HTTPS webhook endpoint (ngrok or Vercel preview).

---

#### 3. Boleto + Installment Parcel Tracking (FIN-05, FIN-06, SC-2)

**Test:**
1. Create a boleto charge with installmentCount=3 for R$ 300,00
2. Confirm bankSlipUrl is returned and displayed
3. Navigate to /clinica/financeiro/contas-a-receber
4. Confirm 3 receivable rows appear under an Accordion, each with its own due date, value (R$ 100,00), and status badge

**Expected:** 3 parcels × R$ 100,00 = R$ 300,00 total; CR-01 cents distribution confirms no rounding drift; vencido derived client-side for overdue parcels

**Why human:** Requires live Asaas account for the `gateway.getInstallmentCharges()` call to return real parcel data.

---

#### 4. PDF Receipt Visual Verification (FIN-08, SC-4)

**Test:**
1. As a receptionist, navigate to a paid charge's recibo URL: `/api/financeiro/charges/{id}/recibo.pdf`
2. Confirm the PDF downloads and opens correctly

**Expected:** A4 PDF with: clinic name, "Recibo de Pagamento" heading, patient full name + CPF, billing method (PIX/BOLETO), amount in `R$ X.XXX,XX` format, payment date (from `receivables.paid_at`), Asaas `provider_charge_id`, Roboto font (ã/ç/ê/õ render correctly), no "grid" layout

**Why human:** `@react-pdf/renderer` output requires visual inspection; Roboto font fetched from Google Fonts CDN at runtime.

---

#### 5. Security Headers on Deployed Response (SEC-06, SC-5)

**Test:** `curl -I {deployed-vercel-url}`

**Expected output includes:**
- `Content-Security-Policy: default-src 'self'; ... wss://*.supabase.co ... api-sandbox.asaas.com ...`
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`

**Why human:** `next.config.ts` `headers()` is verified in source; actual header delivery requires a running Next.js server. The 7/7 security-headers.test.ts assertions verify source-level correctness.

---

#### 6. Collection Ruler Email Delivery (FIN-07)

**Test:**
1. Ensure `RESEND_API_KEY` and `CRON_SECRET` are set in environment
2. Create a receivable with `due_date = today` for a patient with a real email address
3. Trigger the cron manually: `curl -H "Authorization: Bearer {CRON_SECRET}" {url}/api/cron/collection-ruler`
4. Confirm the patient receives an email with real clinic name (not a UUID) and correct BRL amount
5. Trigger again — confirm no duplicate email and collection_log still has only one row

**Expected:** One email delivered via Resend; idempotent (second trigger = 0 additional emails)

**Why human:** Requires a deployed app + RESEND_API_KEY + a due-today receivable; Resend email delivery cannot be asserted programmatically in this test setup.

---

## Gaps Summary

No code-level gaps. All artifacts exist, are substantive, and are wired. All 9 code review findings (2 critical + 7 warnings) were fixed and verified (256/256 vitest, tsc exit 0, next build clean, 30 routes).

The only open items are human-verification UAT tests that require:
1. A live Asaas sandbox account (D-02 — not yet provisioned)
2. A deployed instance with env vars set
3. Visual PDF inspection

These are expected gaps documented in 03-HUMAN-UAT.md, not implementation defects.

**FIN-09 in REQUIREMENTS.md is marked "Pending"** — this correctly reflects that the live end-to-end sandbox verification (SC-1 idempotency replay) has not been performed. The code implementation is complete and unit-tested (15/15 GREEN). The requirement will move to "Complete" after the Asaas sandbox UAT is signed off.

---

*Verified: 2026-06-06T18:00:00Z*
*Verifier: Claude (gsd-verifier)*
*Post-fix pass: 03-REVIEW-FIX.md (9/9 findings fixed, all commits verified in git log)*
