---
phase: 03-financial-mvp
reviewed: 2026-06-06T00:00:00Z
depth: standard
files_reviewed: 32
files_reviewed_list:
  - supabase/migrations/20260606000100_financial_tables.sql
  - supabase/migrations/20260606000200_financial_rls.sql
  - supabase/migrations/20260606000300_financial_categories_seed.sql
  - src/lib/asaas/types.ts
  - src/lib/asaas/client.ts
  - src/lib/asaas/gateway.ts
  - src/lib/validators/charge.ts
  - src/lib/collection/ruler.ts
  - src/lib/format/money.ts
  - src/actions/charges.ts
  - src/actions/transactions.ts
  - src/actions/receivables.ts
  - src/actions/collection-ruler.ts
  - src/app/api/webhooks/asaas/route.ts
  - src/app/api/cron/collection-ruler/route.ts
  - src/app/api/financeiro/charges/[id]/recibo.pdf/route.ts
  - src/app/(dashboard)/clinica/financeiro/page.tsx
  - src/app/(dashboard)/clinica/financeiro/fluxo-de-caixa/page.tsx
  - src/app/(dashboard)/clinica/financeiro/contas-a-receber/page.tsx
  - src/app/(dashboard)/clinica/financeiro/nova-cobranca/page.tsx
  - src/app/(dashboard)/clinica/financeiro/regua-de-cobranca/page.tsx
  - src/app/(dashboard)/clinica/page.tsx
  - src/components/financeiro/CashFlowTotals.tsx
  - src/components/financeiro/TransactionList.tsx
  - src/components/financeiro/TransactionModal.tsx
  - src/components/financeiro/ReceivablesTable.tsx
  - src/components/financeiro/ChargeForm.tsx
  - src/components/financeiro/PixQRDisplay.tsx
  - src/components/financeiro/CollectionRulerForm.tsx
  - src/components/pdf/ReceiboPDF.tsx
  - src/emails/CollectionReminderEmail.tsx
  - next.config.ts
findings:
  critical: 2
  warning: 7
  info: 6
  total: 15
status: issues_found
---

# Phase 3: Code Review Report

**Reviewed:** 2026-06-06T00:00:00Z
**Depth:** standard
**Files Reviewed:** 32
**Status:** issues_found

## Summary

Phase 3 Financial MVP is well-architected and security-conscious. The webhook handler validates the token before parsing, dedups by `asaas_event_id` with a UNIQUE constraint, derives tenant from local data (never the payload), and guards income posting with an existence check. The cron endpoint correctly gates on `Bearer CRON_SECRET`, processes tenants in isolation, and uses `collection_log` UNIQUE for idempotency. RLS policies pair `USING` + `WITH CHECK` on every tenant table, `tenant_id` is indexed everywhere, and the receipt route enforces auth + role + RLS-based tenant isolation. No raw card data is stored.

However, two correctness issues rise to Critical: (1) the installment charge path persists the full charge total as the value of *each* receivable parcel and as `charges.total_value`, producing inflated receivable amounts and an N-times overstated total; and (2) the webhook posts income using the untrusted `payment.value` from the Asaas payload rather than reconciling against the local `receivable.value`, allowing a spoofed-but-authenticated payload (or an Asaas-side mismatch) to credit an arbitrary amount. Several Warnings concern float-based money math (the system uses `NUMERIC` in the DB but JS floats throughout the app layer), the refund path lacking idempotency, and the receipt route reading a non-existent `paid_at` column. Money handling does NOT use integer cents anywhere — see WR-01.

## Critical Issues

### CR-01: Installment charges store the full total as every parcel's value and as the charge total

**File:** `src/actions/charges.ts:117-161`
**Issue:** On the installment path (`installmentCount > 1`):
- `charges.total_value` is set to `data.value` (the full amount) — correct.
- BUT each receivable row uses `parcel.value ?? (data.value / data.installmentCount)`. When Asaas returns parcels without a `value` (or the field is undefined), the fallback divides correctly, but when `parcel.value` IS present, Asaas returns the **per-parcel** value, so that branch is correct. The real defect is the **single-charge fallback and `total_value`**: on the single path (line 135) `total_value: data.value` is fine, but on the installment path the same `total_value: data.value` represents the total while individual receivables may sum to more than `data.value` if Asaas applies installment interest/fees — there is no reconciliation that `sum(parcels.value) === total_value`. More concretely, the single-receivable branch (line 181) sets `value: data.value` which is the full total — correct for a single charge. The genuine bug: there is no validation that the value passed to Asaas (`value` vs `totalValue`) and the mirrored receivables stay consistent, and the `parcel.value ?? data.value / installmentCount` fallback can yield fractional cents (e.g. 100.00 / 3 = 33.333...) that are then inserted into `NUMERIC(12,2)`, silently rounding and breaking the invariant `sum(parcels) === total`.
**Fix:**
```ts
// Reconcile parcels against the charge total; distribute remainder cents to the last parcel.
const totalCents = Math.round(data.value * 100)
const baseCents = Math.floor(totalCents / data.installmentCount)
const receivableRows = parcels.map((parcel, idx) => {
  const isLast = idx === parcels.length - 1
  const cents = parcel.value != null
    ? Math.round(parcel.value * 100)
    : (isLast ? totalCents - baseCents * (parcels.length - 1) : baseCents)
  return {
    tenant_id: actor.tenant_id,
    charge_id: charge.id,
    patient_id: patient.id,
    provider_charge_id: parcel.chargeId,
    installment_number: idx + 1,
    value: cents / 100,
    due_date: parcel.dueDate,
    status: 'pendente',
  }
})
// Optionally assert: sum of receivable values === data.value (or Asaas-reported total).
```

### CR-02: Webhook posts income from the untrusted payload `payment.value` without reconciling against the local receivable

**File:** `src/app/api/webhooks/asaas/route.ts:140-148, 171-179`
**Issue:** Both the payment-confirmed and refund branches insert `amount: payment.value` (and `-Math.abs(payment.value)`) directly from the webhook body. The handler already looked up the local `receivable` (which has a trusted `value`), but it ignores it for the financial posting. The token check authenticates *that the caller knows the shared secret*, but it does not guarantee per-field integrity — and the project guidance explicitly says "never trust amount/status without reconciling." A payload with a tampered or mismatched `value` would post an incorrect income/reversal amount into `financial_transactions`, corrupting the cash flow (FIN-01/D-08) and any reconciliation. This is the kind of double-credit / wrong-credit risk the phase brief calls out.
**Fix:**
```ts
// Post the trusted local receivable value, not the payload value.
await admin.from('financial_transactions').insert({
  tenant_id: receivable.tenant_id,
  receivable_id: receivable.id,
  type: 'receita',
  amount: receivable.value,            // trusted local amount
  transaction_date: new Date().toISOString().split('T')[0],
  description: `Pagamento confirmado via Asaas (${event.event})`,
  posted_by: null,
})
// Optional: if payment.value !== receivable.value, log a reconciliation discrepancy
// for operator review instead of trusting the payload.
```

## Warnings

### WR-01: Money handled as JS floating-point throughout the application layer

**File:** `src/components/financeiro/ChargeForm.tsx:120-138`, `src/components/financeiro/TransactionModal.tsx:89-90,119-127`, `src/actions/transactions.ts:200-206`, `src/actions/charges.ts:158`
**Issue:** The phase brief flags "money handling (integer cents vs float rounding)." The DB uses `NUMERIC(12,2)` (good), but every value crosses the app boundary as a JS `number` (IEEE-754 float). BRL parsing (`parseFloat(numericStr)`), totals reduction (`sum + t.amount`), and parcel division (`data.value / data.installmentCount`) all accumulate float error. For example `0.1 + 0.2 !== 0.3`, and summing many `receita` rows can drift by a cent. Validation `z.number().positive()` does not bound decimal places, so `19.999` is accepted and silently rounds on insert.
**Fix:** Standardize on integer cents end-to-end: parse user input to cents (`Math.round(value * 100)`), store/transmit cents, and only format to BRL at the view boundary. At minimum, add `.refine(v => Number.isInteger(Math.round(v * 100)) && Math.round(v*100) === v*100, 'Máximo 2 casas decimais')` to the Zod schemas and compute totals in cents before dividing.

### WR-02: Refund (PAYMENT_REFUNDED) branch is not idempotent and can double-post reversals

**File:** `src/app/api/webhooks/asaas/route.ts:163-179`
**Issue:** The `PAYMENT_RECEIVED`/`PAYMENT_CONFIRMED` branch guards income posting with an `existingTx` check and an early return when already `pago`. The refund branch has no equivalent guard: it unconditionally sets status to `estornado` and inserts a negative `financial_transactions` row. While `webhook_events` dedup prevents replay of the *same* event ID, Asaas can legitimately send distinct refund-related events (e.g. `PAYMENT_REFUNDED` plus a later chargeback/partial event) for the same receivable, producing multiple negative postings and an over-reversed cash flow.
**Fix:** Mirror the income guard: skip if `receivable.status === 'estornado'` already, and/or check for an existing reversal row before inserting:
```ts
if (receivable.status === 'estornado') { /* mark processed, return */ }
const { data: existingReversal } = await admin
  .from('financial_transactions')
  .select('id').eq('receivable_id', receivable.id).lt('amount', 0).maybeSingle()
if (existingReversal) { /* mark processed, return */ }
```

### WR-03: Receipt route reads a `paid_at` column that does not exist on `charges`

**File:** `src/app/api/financeiro/charges/[id]/recibo.pdf/route.ts:102-105`
**Issue:** The code does `(charge as Record<string, unknown>).paid_at ?? charge.created_at`. The `charges` table (migration `20260606000100`) has no `paid_at` column (only `created_at`/`updated_at`); `paid_at` lives on `receivables`. The `as Record<string, unknown>` cast suppresses the type error, so `paid_at` is always `undefined` and the receipt always shows `created_at` as the payment date — which is the charge *creation* time, not the payment time. For a paid charge this prints a misleading "Data do Pagamento."
**Fix:** Join the paid receivable and use its `paid_at`, or select `updated_at` from the charge as the fallback. Remove the `as Record<string, unknown>` cast so the schema mismatch surfaces at compile time:
```ts
const { data: rec } = await supabase
  .from('receivables').select('paid_at')
  .eq('charge_id', id).eq('status', 'pago')
  .order('paid_at', { ascending: false }).limit(1).maybeSingle()
const paidAt = rec?.paid_at ?? charge.updated_at ?? charge.created_at
```

### WR-04: Receipt PDF does not verify the charge is actually paid

**File:** `src/app/api/financeiro/charges/[id]/recibo.pdf/route.ts:69-80`
**Issue:** The route loads the charge and generates a "Recibo de Pagamento" without checking `charge.status === 'pago'`. A staff member (or a crafted URL) can download a payment receipt for a `pendente` or `cancelado` charge, producing a document that falsely attests payment. The UI only shows the link for paid rows, but the endpoint is directly reachable.
**Fix:** After loading the charge, return 404/409 unless paid:
```ts
if (charge.status !== 'pago') {
  return new Response('Recibo disponível apenas para cobranças pagas', { status: 409 })
}
```

### WR-05: Cron passes `tenant_id` as `actorId` and `clinicName` into audit + email

**File:** `src/app/api/cron/collection-ruler/route.ts:162, 172`
**Issue:** Two correctness problems in the cron's per-send block:
1. `clinicName: rule.tenant_id` is passed to `CollectionReminderEmail` (line 162). The comment says "resolved below via clinic lookup if needed" but no lookup happens — so patients receive emails showing a raw tenant UUID as the clinic name in subject and body ("Cobrança em atraso — <uuid>"). This is a patient-facing data-quality bug and mildly leaks the internal tenant identifier.
2. `actorId: rule.tenant_id` (line 172) records the tenant UUID in `audit_logs.actor_id`, a column semantically meaning the acting user. `actor_id` is nullable for system events; a system reminder should use `null` (or a sentinel), not the tenant id.
**Fix:** Resolve the clinic name once per tenant (`select name from clinics where id = rule.tenant_id`) and pass it as `clinicName`; pass `actorId: null` (logBusinessEvent/audit_logs allow null) for system-generated events, or extend `logBusinessEvent` to accept a system actor.

### WR-06: `getCharge` and `cancelCharge` lack the role gate applied elsewhere

**File:** `src/actions/charges.ts:239-268`
**Issue:** `getCharge` performs only `getActor()` with no role check; any authenticated user in the tenant (including a `patient` role, which exists per the users CHECK constraint) can read charge financial data. RLS scopes by tenant but the `*_tenant_read` policies allow all tenant members to SELECT charges, so a `patient` user could enumerate charges by id. `createCharge`/`cancelCharge` correctly gate to staff roles; `getCharge` should too (and the RLS read policy arguably should exclude `patient`).
**Fix:** Add the same `allowedRoles` check to `getCharge`, and reconsider whether `charges_tenant_read` / `receivables_tenant_read` should be restricted to staff roles rather than all tenant members (a `patient`-role user must not see other patients' receivables).

### WR-07: `listTransactions` month parsing accepts invalid input and mis-parses padded months

**File:** `src/actions/transactions.ts:149-155`
**Issue:** `month.split('-').map(Number)` with `if (!year || !mon)` rejects `'2026-00'`? No — `mon=0` is falsy so month `00` is caught, but there is no regex validation that `month` matches `YYYY-MM`. An input like `'2026-13'` passes (`new Date(2026, 13, 0)` rolls over to a valid date), and `'2026-6'` vs `'2026-06'` both work but `from = '2026-6-01'` would be malformed for the unpadded case. Since `month` comes from `searchParams.month` (user-controlled URL), a crafted value can produce an unexpected range or a Postgres date-parse error surfaced to the user.
**Fix:** Validate with a regex/Zod (`/^\d{4}-(0[1-9]|1[0-2])$/`) before deriving the range and return "Mês inválido" on mismatch.

## Info

### IN-01: `getActor` helper duplicated across four Server Action files

**File:** `src/actions/charges.ts:17-39`, `src/actions/transactions.ts:15-37`, `src/actions/receivables.ts:12-34`, `src/actions/collection-ruler.ts:25-47`
**Issue:** The identical `getActor()` implementation (plus `Actor` type and `allowedRoles` array) is copy-pasted in four files. Drift risk: a security fix to one (e.g. tightening the role list) won't propagate.
**Fix:** Extract to `src/lib/auth/actor.ts` and import; keep a single `STAFF_ROLES` constant.

### IN-02: PII (patient email) passed as `actorId`-adjacent detail and clinic UUID emailed — see also WR-05

**File:** `src/app/api/cron/collection-ruler/route.ts:178`
**Issue:** The audit `details` include `patient_id` (an id, acceptable per the "IDs only" rule) — fine. Noting for completeness that the email subject built at line 151-152 interpolates `charge.description`, which is staff-entered free text; it is not HTML-rendered in the subject so no injection, but long descriptions could produce awkward subjects. Low priority.
**Fix:** Optionally truncate `charge.description` used in subject lines.

### IN-03: `formatBRLSigned` and `CashFlowTotals` re-implement the minus-sign logic separately

**File:** `src/lib/format/money.ts:28-34`, `src/components/financeiro/CashFlowTotals.tsx:52,73`
**Issue:** `CashFlowTotals` manually prepends `−` (U+2212) instead of using `formatBRLSigned`, duplicating the contract. The Saídas card uses `saidas > 0 ? '−' + formatBRL(saidas)` while `formatBRLSigned(amount,'saida')` already does this. Minor inconsistency risk.
**Fix:** Use `formatBRLSigned(saidas, 'saida')` and a saldo-specific helper for consistency.

### IN-04: `console.error` used as the production error channel in webhook and cron

**File:** `src/app/api/webhooks/asaas/route.ts:49,102`, `src/app/api/cron/collection-ruler/route.ts:57,84,139,184,208`
**Issue:** Failure paths (receivable-not-found, send failures, log-insert errors) only `console.error`. The cron comment even says "in production, monitor collection_log rows where emails are known to have failed," but there is no failure marker — a failed send leaves a `collection_log` row indistinguishable from a successful one, so the idempotency check permanently suppresses retry (acknowledged in the comment but worth a structured TODO).
**Fix:** Add a `status`/`error` column to `collection_log` (or a separate failures table) so failed sends can be retried/monitored; route errors to Sentry/Datadog.

### IN-05: ReceiboPDF registers remote Google Fonts at render time

**File:** `src/components/pdf/ReceiboPDF.tsx:26-38`
**Issue:** `Font.register` points at `https://fonts.gstatic.com/...woff2`. Each cold serverless render fetches the font over the network, adding latency and a hard dependency on Google's CDN availability for receipt generation (and a data egress to a third party at render time). The CSP `font-src` allows it, so this is by design, but bundling the font locally is more robust for a < 500ms PDF target.
**Fix:** Vendor the Roboto woff2 files into the app (e.g. `src/assets/fonts`) and register from the local path/Buffer.

### IN-06: `getInstallmentCharges` assumes Asaas returns parcels in installment order

**File:** `src/actions/charges.ts:152-157`
**Issue:** `installment_number: idx + 1` assigns the parcel number from array index. If Asaas's `/installments/{id}/payments` response is not guaranteed ordered by due date, parcel numbers could be mislabeled.
**Fix:** Sort `parcels` by `dueDate` before mapping, or derive `installment_number` from an Asaas-provided sequence field if available.

---

_Reviewed: 2026-06-06T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
