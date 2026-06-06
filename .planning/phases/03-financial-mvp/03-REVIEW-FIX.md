---
phase: 03-financial-mvp
fixed_at: 2026-06-06T17:10:00Z
review_path: .planning/phases/03-financial-mvp/03-REVIEW.md
iteration: 1
findings_in_scope: 9
fixed: 9
skipped: 0
status: all_fixed
---

# Phase 3: Code Review Fix Report

**Fixed at:** 2026-06-06T17:10:00Z
**Source review:** .planning/phases/03-financial-mvp/03-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 9 (2 Critical + 7 Warning)
- Fixed: 9
- Skipped: 0

**Verification (run after all fixes):**
- `npx tsc --noEmit` — PASS (exit 0, no errors)
- `npx vitest run` — PASS (23 files, 256 tests passed)
- `npx next build` — PASS (exit 0, all 30 routes compiled)

## Fixed Issues

### CR-01: Installment charges store the full total as every parcel's value

**Files modified:** `src/actions/charges.ts`
**Commit:** 4de86ae
**Applied fix:** Replaced the `parcel.value ?? (data.value / data.installmentCount)` mapping with integer-cent distribution. `totalCents = Math.round(data.value * 100)`, `baseCents = Math.floor(totalCents / parcels.length)`, and the last parcel absorbs the remainder (`totalCents - baseCents * (parcels.length - 1)`). When Asaas reports a per-parcel `value` it is trusted (it may carry installment interest/fees); otherwise the even split applies. This guarantees `sum(parcels) === total` exactly and removes silent fractional-cent rounding into `NUMERIC(12,2)`. Note: `baseCents` now divides by `parcels.length` (the actual returned parcel count) rather than `data.installmentCount`, defensively handling any mismatch.

### CR-02: Webhook posts income from untrusted payload `payment.value`

**Files modified:** `src/app/api/webhooks/asaas/route.ts`
**Commit:** a0727fe
**Applied fix:** Both the income-posting branch and the refund branch now use the TRUSTED local `receivable.value` (`amount: receivable.value` and `amount: -Math.abs(receivable.value)`) instead of the payload `payment.value`. Added a reconciliation discrepancy log when `payment.value !== receivable.value` for operator review, without trusting the payload amount.

### WR-01: Money handled as JS floating-point throughout the app layer

**Files modified:** `src/lib/validators/charge.ts`, `src/actions/transactions.ts`
**Commit:** d6ffe82
**Applied fix:** Added an exported `isMoney2dp` helper (`Number(v.toFixed(2)) === v`) in the charge validator and applied it via `.refine(...)` to both `chargeSchema.value` and `transactionSchema.amount`, rejecting inputs with more than 2 decimal places ("Valor deve ter no máximo 2 casas decimais"). This is the schema-boundary guard from the review's "at minimum" recommendation. A full end-to-end integer-cent refactor across the UI/transmit layer was intentionally NOT done here (out of scope for an atomic review-fix; would touch many UI files); the schema now blocks the silent-rounding inputs the finding called out.

### WR-02: Refund (PAYMENT_REFUNDED) branch not idempotent

**Files modified:** `src/app/api/webhooks/asaas/route.ts`
**Commit:** a20dbe7
**Applied fix:** Mirrored the income guard in the refund branch: returns early (marking the webhook event processed) if `receivable.status === 'estornado'`, and additionally checks for an existing negative `financial_transactions` row for the receivable (`.lt('amount', 0).maybeSingle()`) before inserting, preventing over-reversal from distinct refund/chargeback events.

### WR-03: Receipt route reads a non-existent `paid_at` column on `charges`

**Files modified:** `src/app/api/financeiro/charges/[id]/recibo.pdf/route.ts`
**Commit:** 62b79a3
**Applied fix:** Removed the masking `(charge as Record<string, unknown>).paid_at` cast. Added `updated_at` to the charge select and a query for the most recent paid receivable (`receivables` where `charge_id = id AND status = 'pago'`, ordered by `paid_at desc`). `paidAt` now resolves to `paidReceivable?.paid_at ?? charge.updated_at ?? charge.created_at` — the real payment timestamp. No schema migration was required: `receivables.paid_at` already exists (migration `20260606000100`) and the webhook already populates it.

### WR-04: Receipt PDF does not verify the charge is actually paid

**Files modified:** `src/app/api/financeiro/charges/[id]/recibo.pdf/route.ts`
**Commit:** d808d37
**Applied fix:** After loading the charge, the route returns HTTP 409 ("Recibo disponível apenas para cobranças pagas") unless `charge.status === 'pago'`, closing the direct-URL path to generating a receipt for a pendente/cancelado/estornado charge.

### WR-05: Cron passes `tenant_id` as `actorId` and `clinicName`

**Files modified:** `src/app/api/cron/collection-ruler/route.ts`, `src/lib/audit.ts`
**Commit:** f84a501
**Applied fix:** Added a per-tenant `clinics.name` lookup (once per rule, after targets are computed) and pass the resolved `clinicName` (fallback "Sua clínica") to `CollectionReminderEmail` instead of the raw tenant UUID. Changed the audit call to `actorId: null` for the system-generated reminder event. Widened `logBusinessEvent`'s `actorId` parameter type to `string | null` (the `audit_logs.actor_id` column is nullable) to support system events.

### WR-06: `getCharge` lacks the staff role gate

**Files modified:** `src/actions/charges.ts`
**Commit:** acb1a4d
**Applied fix:** Added the same `allowedRoles = ['admin', 'dentist', 'receptionist', 'superadmin']` gate used by `createCharge`/`cancelCharge` to `getCharge`, returning "Permissão insuficiente para visualizar cobrança" for other roles (e.g. `patient`), blocking charge enumeration by id. Note: the review's secondary suggestion to tighten the `charges_tenant_read` / `receivables_tenant_read` RLS policies to exclude `patient` was NOT applied here — it is a separate RLS migration decision flagged as a follow-up (see below).

### WR-07: `listTransactions` month parsing accepts invalid input

**Files modified:** `src/actions/transactions.ts`
**Commit:** 8990dfc
**Applied fix:** Added a strict `/^\d{4}-(0[1-9]|1[0-2])$/` regex guard on the user-controlled `month` param before deriving the range, returning "Mês inválido (YYYY-MM)" on mismatch. Replaced the `split('-').map(Number)` destructure (which produced `number | undefined`) with explicit `month.slice()` parses now that the format is guaranteed.

## Skipped Issues

None — all in-scope findings were fixed.

## Follow-ups / Notes

- **No database migration was needed.** WR-03 was resolvable against the existing `receivables.paid_at` column; no `db push` is required for these fixes.
- **WR-06 secondary (RLS hardening):** The review additionally suggested restricting `charges_tenant_read` / `receivables_tenant_read` RLS policies to staff roles so a `patient`-role user cannot SELECT other patients' receivables. This was deliberately NOT applied as part of this server-action fix — it is an RLS-policy migration that warrants its own review (it affects any patient-facing read path) and should be authored under `supabase/migrations/` with a new timestamp + db push as a separate follow-up.
- **WR-01 scope:** Only the Zod schema boundary guard was added. The broader "integer cents end-to-end" recommendation (parsing UI input to cents, transmitting cents) remains a larger refactor for a future task.

---

_Fixed: 2026-06-06T17:10:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
