---
phase: 13-esteriliza-o-cme-laborat-rio-de-pr-tese
reviewed: 2026-06-19T00:00:00Z
depth: standard
files_reviewed: 19
files_reviewed_list:
  - src/actions/lab-orders.ts
  - src/actions/sterilization.ts
  - src/lib/esterilizacao/cycle-status.ts
  - src/lib/protese/lab-cost.ts
  - src/lib/validators/lab-order.ts
  - src/lib/validators/sterilization.ts
  - src/components/esterilizacao/CycleForm.tsx
  - src/components/esterilizacao/KitUsageForm.tsx
  - src/components/protese/LabForm.tsx
  - src/components/protese/LabOrderForm.tsx
  - src/components/protese/LabOrderStatusBar.tsx
  - src/app/(dashboard)/clinica/esterilizacao/page.tsx
  - src/app/(dashboard)/clinica/esterilizacao/uso-kit/page.tsx
  - src/app/(dashboard)/clinica/protese/page.tsx
  - src/app/(dashboard)/clinica/protese/laboratorios/page.tsx
  - supabase/migrations/20260619000100_sterilization_cycles.sql
  - supabase/migrations/20260619000200_sterilization_rls.sql
  - supabase/migrations/20260619000300_prosthetic_labs.sql
  - supabase/migrations/20260619000400_lab_orders_rls.sql
findings:
  critical: 0
  warning: 3
  info: 4
  total: 7
status: issues_found
---

# Phase 13: Code Review Report

**Reviewed:** 2026-06-19
**Depth:** standard
**Files Reviewed:** 19
**Status:** issues_found

## Summary

Reviewed the Esterilização/CME and Laboratório de Prótese phase: two server-action
files, two pure helper libs, two validators, five client components, four RSC pages,
and four SQL migrations.

**The two highest-stakes controls are correct.**

1. **CME-02 patient-safety block guard** (`registerKitUsage`, `src/actions/sterilization.ts`)
   is sound. The action re-fetches the cycle server-side scoped to `id + clinic_id`,
   explicitly rejects soft-deleted cycles, then runs `isCycleUsable` against the FRESH
   DB row using server-side `today()` — and refuses the insert before any write when the
   cycle is `reprovado`/`pendente`/`vencido`. No client field can override the block; the
   client-side `disabled` filter in `KitUsageForm` is convenience only. The TOCTOU window
   between the SELECT and the INSERT is not exploitable in any way that matters (validade is
   date-granular and a cycle that reads usable cannot silently become unusable within the
   request).

2. **LAB-02 financial posting** (`postLabExpense` / `setLabOrderCost`) writes to
   `financial_transactions` with the correct `tenant_id` column (verified against
   `20260606000100_financial_tables.sql`), and the double-post guard re-fetches
   `financial_transaction_id` and refuses when already set.

3. **Multi-tenant RLS** — all four new tables (`sterilization_cycles`, `kit_usages`,
   `prosthetic_labs`, `lab_orders`) `ENABLE ROW LEVEL SECURITY` and every write policy
   pairs `USING` with `WITH CHECK`, both gated on `clinic_id = get_my_tenant_id()`.
   All `clinic_id` columns are indexed.

4. All three `'use server'` constraints hold — every module-level export in both action
   files is an `async function`; the only non-exported helpers (`getActor`, `postLabExpense`)
   are also async and not re-exported.

The issues below are correctness/robustness concerns, not security or patient-safety
defects. The most actionable is WR-01 (a broken appointments query that runs on every
uso-kit page load against non-existent columns).

## Warnings

### WR-01: Broken appointments query — wrong column names, result discarded

**File:** `src/app/(dashboard)/clinica/esterilizacao/uso-kit/page.tsx:139-153`
**Issue:** The query selects `scheduled_at` and filters `.eq('clinic_id', tenantId)` /
`.gte('scheduled_at', ...)`, but `public.appointments` (per
`20260605000100_clinical_tables.sql`) has **no `clinic_id` and no `scheduled_at` column** —
it uses `tenant_id`, `start_time`, `end_time`, and `dentist_id` (no FK named that the select
expects either). The query will return a PostgREST error every time the page loads. The
error is silently swallowed (only `data` is destructured, `error` ignored) and `appointments`
is then hard-coded to `[]` at line 153, so the broken call is pure dead weight: a guaranteed
failed round-trip on every render with no functional effect. This also makes the
`AppointmentOption` plumbing in `KitUsageForm` permanently dead.
**Fix:** Either remove the dead query block entirely (lines 137-153) since `appointments`
is unconditionally `[]`, or fix it to the real schema and actually wire it through:
```ts
// If appointment linkage is wanted, use the real columns:
const { data: rawAppointments } = tenantId
  ? await supabase
      .from('appointments')
      .select('id, start_time, patient_id')
      .eq('tenant_id', tenantId)            // not clinic_id
      .gte('start_time', thirtyDaysAgo)     // not scheduled_at
      .not('patient_id', 'is', null)
      .order('start_time', { ascending: false })
      .limit(100)
  : { data: [] }

const appointments: AppointmentOption[] = (rawAppointments ?? []).map((a) => ({
  id: a.id,
  scheduled_at: a.start_time,
  patient_id: a.patient_id,
}))
```
Otherwise delete lines 137-153 and keep `const appointments: AppointmentOption[] = []`.

### WR-02: Double-post guard has a TOCTOU race with no DB-level backstop

**File:** `src/actions/lab-orders.ts:431-450` (and `postLabExpense` 99-170)
**Issue:** `setLabOrderCost` prevents duplicate despesas by re-reading
`financial_transaction_id` and refusing if set. This is a check-then-act with no atomicity:
two concurrent admin requests for the same OS can both read `financial_transaction_id = null`,
both pass the guard, and both insert a despesa into `financial_transactions` — a double debit
to the clinic's cash flow. The window is small and requires two simultaneous admin actions,
but the consequence (real money posted twice) warrants a hard backstop. There is no unique
constraint or conditional update protecting the invariant.
**Fix:** Make the backfill a guarded conditional update and treat "0 rows affected" as the
loser of the race (then the just-inserted txn should be reconciled/ignored). Simplest robust
option: add a partial unique index so the DB rejects the second post, e.g.
```sql
CREATE UNIQUE INDEX uq_lab_orders_one_financial_txn
  ON public.lab_orders(id)
  WHERE financial_transaction_id IS NOT NULL;
```
is not sufficient (id is already unique); instead guard the update:
```ts
const { data: claimed, error } = await db
  .from('lab_orders')
  .update({ cost, financial_transaction_id: txn.id, updated_at: new Date().toISOString() })
  .eq('id', orderId)
  .eq('clinic_id', actor.tenant_id)
  .is('financial_transaction_id', null)   // only the first writer wins
  .select('id')
  .maybeSingle()
if (!claimed) { /* lost the race: delete the orphan txn we just inserted, return 'já lançado' */ }
```

### WR-03: Lab expense orphaned if backfill fails after the financial insert

**File:** `src/actions/lab-orders.ts:125-156`
**Issue:** `postLabExpense` inserts the `financial_transactions` row first (line 125), then
updates `lab_orders.financial_transaction_id` (line 144). If the insert succeeds but the
update fails (RLS edge, transient error, or — see WR-02 — the conditional update matching
zero rows), the despesa already exists in the ledger with no link back to the OS, and the OS
still shows `financial_transaction_id = null`. A subsequent retry will insert a *second*
despesa. There is no transaction wrapping the two writes (Supabase JS can't do multi-statement
transactions; this needs an RPC/`SECURITY DEFINER` function for true atomicity).
**Fix:** Wrap both writes in a Postgres function (`SECURITY DEFINER`, tenant-checked) called via
`db.rpc(...)` so the insert+backfill commit atomically; or, as a lighter mitigation, on
backfill failure delete the just-inserted `financial_transactions` row before returning the
error so a retry stays idempotent. Combine with WR-02's conditional update.

## Info

### IN-01: COST_ROLES comment misstates the actual financial_transactions write RLS

**File:** `src/actions/lab-orders.ts:27-28, 56-57`
**Issue:** The header and `COST_ROLES` comments claim the value matches an "admin-only write
policy" / "financial_transactions write RLS (admin-only write policy)". The actual policy
(`20260606000200_financial_rls.sql:41-46`) is `financial_transactions_staff_write` allowing
`('admin','dentist','receptionist','superadmin')`. The action is intentionally *stricter*
than RLS (so no security gap), but the comment is wrong and will mislead a future maintainer
into thinking RLS already blocks dentists from posting despesas — it does not.
**Fix:** Correct the comment to: "COST_ROLES is stricter than the financial_transactions RLS
(which allows admin/dentist/receptionist/superadmin); the action restricts financial posting
to admin/superadmin by design."

### IN-02: Traceability table renders raw patient UUID instead of patient name (LGPD/UX)

**File:** `src/app/(dashboard)/clinica/esterilizacao/uso-kit/page.tsx:240-242`
**Issue:** The "Paciente" column renders `String(row.patient_id)` — a raw UUID — rather than
the patient's name. `getKitTraceability` returns no patient join, and unlike the protese page
(which builds a `patientMap`), this page already fetches `patients` but does not map the id to
a name here. Functionally harmless but unreadable for staff and inconsistent with the rest of
the module.
**Fix:** Reuse the already-fetched `patients` list to build a `Map<id, full_name>` and render
`patientMap.get(String(row.patient_id)) ?? '—'`, mirroring `protese/page.tsx:117,199`.

### IN-03: `deriveCycleStatus` return type widens to `CycleStatus | 'pendente'`

**File:** `src/lib/esterilizacao/cycle-status.ts:42-55`
**Issue:** The function can return `'pendente'`, which is not part of `CycleStatus`
(`'aprovado' | 'reprovado' | 'vencido'`), so the return type is the awkward union
`CycleStatus | 'pendente'`. The DB `status` CHECK does include `'pendente'`, so this is
correct at runtime, but the type modeling is a smell — `'pendente'` is a legitimate cycle
status and should be in the enum.
**Fix:** Add `'pendente'` to the `CycleStatus` union and return `CycleStatus`:
```ts
export type CycleStatus = 'pendente' | 'aprovado' | 'reprovado' | 'vencido'
export function deriveCycleStatus(params: {...}): CycleStatus { ... }
```

### IN-04: `today()` uses UTC date — off-by-one risk for late-night BR expiry checks

**File:** `src/lib/esterilizacao/cycle-status.ts:21`; mirrored in
`src/actions/lab-orders.ts:123` and `CycleForm.tsx:65`
**Issue:** `new Date().toISOString().slice(0,10)` yields the UTC calendar date. Brazil is
UTC-3, so between 21:00 and 23:59 local time the UTC date is already "tomorrow." A cycle whose
`validade` is "today" (BR) could be computed as expired three hours early, or a `transaction_date`
could be posted on the wrong calendar day. For a patient-safety expiry boundary this is a
real (if narrow) correctness edge. Not flagged higher because the block fails *safe* (it would
block a still-valid cycle, never allow an expired one) and validade granularity is coarse.
**Fix:** Compute the reference date in the clinic's timezone (America/Sao_Paulo), e.g. via
`Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())` which
returns `YYYY-MM-DD` in that zone, and use it for both expiry comparison and `transaction_date`.

---

_Reviewed: 2026-06-19_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
