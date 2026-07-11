---
phase: 17-estoque-materiais
reviewed: 2026-07-11T00:00:00Z
depth: standard
files_reviewed: 39
files_reviewed_list:
  - src/lib/validators/product.ts
  - src/lib/stock/custo-medio.ts
  - src/lib/agents/stock-agent.ts
  - src/actions/products.ts
  - src/actions/product-batches.ts
  - src/actions/stock-entries.ts
  - src/actions/stock-draws.ts
  - src/actions/stock-alerts.ts
  - src/actions/service-material-templates.ts
  - src/actions/appointments.ts
  - src/app/api/cron/estoque-validade/route.ts
  - src/app/api/estoque/anvisa-pdf/route.ts
  - src/app/(dashboard)/clinica/estoque/page.tsx
  - src/app/(dashboard)/clinica/estoque/produtos/page.tsx
  - src/app/(dashboard)/clinica/estoque/entradas/page.tsx
  - src/app/(dashboard)/clinica/estoque/anvisa/page.tsx
  - src/app/(dashboard)/config/servicos/page.tsx
  - src/components/config/ServiceForm.tsx
  - src/components/estoque/AnvisaReportPdf.tsx
  - src/components/estoque/AnvisaReportTable.tsx
  - src/components/estoque/ManualDrawDialog.tsx
  - src/components/estoque/MaterialsTemplateTab.tsx
  - src/components/estoque/MaterialsUsedSection.tsx
  - src/components/estoque/ProductFormDialog.tsx
  - src/components/estoque/ProductsTable.tsx
  - src/components/estoque/StockAlertBanner.tsx
  - src/components/estoque/StockEntriesTable.tsx
  - src/components/estoque/StockEntryFormDialog.tsx
  - src/components/prontuario/ProntuarioForm.tsx
  - src/components/shell/nav-config.ts
  - src/components/shell/nav-icons.ts
  - src/__tests__/estoque/cron-validade.test.ts
  - src/__tests__/estoque/custo-medio.test.ts
  - src/__tests__/estoque/produto-schema.test.ts
  - src/__tests__/estoque/stock-agent.test.ts
  - src/__tests__/estoque/stock-draws.test.ts
  - src/__tests__/estoque/stock-entries.test.ts
  - vercel.json
findings:
  critical: 0
  warning: 4
  info: 5
  total: 9
status: issues_found
---

# Phase 17: Code Review Report

**Reviewed:** 2026-07-11
**Depth:** standard
**Files Reviewed:** 39
**Status:** issues_found

## Summary

Phase 17 (Estoque & Materiais) is well structured and internally documented. Multi-tenant
isolation is handled consistently: reads go through `createClient()` (RLS tenant-scoped),
writes to tables with no `authenticated` write policy (`stock_draws`, `stock_alerts`) use
`createAdminClient()` with explicit `clinic_id`, and `WRITER_ROLES` gating mirrors the RLS
policies. The moving-average cost function is a correct pure function with good test coverage,
the FIFO compare-and-swap loop is a reasonable race guard, and the cron/PDF routes are
correctly pinned to the Node.js runtime with fail-closed auth. Zod schemas avoid `.default()`
per project convention and `@base-ui` Button `render` props are used correctly.

The prior STRIDE audit (17-SECURITY.md) was not re-derived. The findings below are correctness
and quality issues found by reading the code in context. The most important is a missing
idempotency guard on automatic material draws (WR-01), which can silently double-consume
inventory and duplicate ANVISA traceability records if a concluded appointment is saved more
than once. Three other warnings concern inventory-accuracy edge cases and a status-derivation
mismatch that produces false "low stock" badges. No Critical issues were found.

## Warnings

### WR-01: Automatic material draw is not idempotent — repeated "concluído" saves double-consume stock

**File:** `src/actions/appointments.ts:337-372`, `src/actions/stock-draws.ts:187-286`
**Issue:** `updateAppointment` calls `drawMaterialsForProcedures` on every invocation where
`input.status === 'concluido'`. The inline comment (lines 348-350) acknowledges the prior-status
guard cannot work because the row was already updated to `concluido` before the check. For OS
creation this is safe because a partial UNIQUE index on `appointment_id` makes the insert
idempotent — but `drawMaterialsForProcedures` has **no** equivalent guard. Each call re-runs
FIFO selection and inserts a fresh set of `stock_draws` rows (and decrements batches again).
Any second save of an already-concluded appointment that includes `status: 'concluido'` in the
payload (e.g. editing notes, re-confirming) will draw all materials a second time, corrupting
`saldo_disponivel` and duplicating regulated ANVISA traceability records.
**Fix:** Guard the draw so it only runs once per appointment. Either detect the real status
transition before the update, or make the draw idempotent at the data layer, e.g.:
```ts
// In drawMaterialsForProcedures, before drawing, bail if draws already exist:
const { data: existing } = await admin
  .from('stock_draws')
  .select('id')
  .eq('clinic_id', clinicId)
  .in('appointment_procedure_id', procedures.map((p) => p.id))
  .eq('tipo', 'automatico')
  .limit(1)
if (existing && existing.length > 0) return // already drawn for this appointment
```
(Or add a UNIQUE partial index on `(appointment_procedure_id, product_id)` for `tipo='automatico'`
and swallow 23505, mirroring the OS-01 pattern.)

### WR-02: FIFO "no split between batches" can record a draw without decrementing any stock

**File:** `src/actions/stock-draws.ts:85-136` (`selectFifoBatch`)
**Issue:** `selectFifoBatch` only debits a batch that individually holds the full `qtd`
(`candidate.saldo_disponivel < qtd` → skip to next batch). When the requested quantity exceeds
every individual batch's balance but the aggregate across batches would cover it (e.g. two
batches of 6 units each, draw of 10), the function returns `null`. The caller then records the
draw with `batch_id: null` and a snapshot cost, but **no batch is decremented**. The aggregate
`saldo_disponivel` therefore still reads 12 even though 10 units were consumed, so the balance
overstates real stock and the `checkMinimoAndReplenish` minimum-check will not fire. This is the
opposite of the intended D-09 "negative balance allowed" behavior — the balance simply never
moves.
**Fix:** Split the draw across consecutive FIFO batches (accumulate partial debits from multiple
batches until `qtd` is satisfied, inserting one `stock_draws` row per batch consumed), or at
minimum debit the largest-available batch to `0` and record the remainder against `batch_id:null`
so the aggregate balance reflects actual consumption.

### WR-03: `listProducts` derives status 'critico' for every product when `unitId` is omitted → false "Estoque Baixo" badges

**File:** `src/actions/products.ts:204-267`, `src/components/estoque/MaterialsUsedSection.tsx:78-133`
**Issue:** When `listProducts` is called without `opts.unitId`, `saldo` is hardcoded to `0`
(line 264) and `deriveProductStatus(0, estoqueMinimo)` returns `'critico'` for every product
(`0 <= estoqueMinimo * 0.5` is always true since `estoque_minimo >= 0`). The header comment
(lines 205-206) claims this path "retorna 0/status 'normal'" — that is incorrect; it never
returns `normal`. `MaterialsUsedSection` calls `listProducts()` with no `unitId` and uses
`product.status` to render stock badges, so **every** material line shows an "Estoque Baixo"
(critico) badge regardless of the product's real balance, misleading the dentist at point of care.
**Fix:** Either (a) pass the unit into `MaterialsUsedSection`'s `listProducts` call so status is
meaningful, or (b) when no `unitId` is supplied, return a neutral status (`'normal'`) instead of
running `deriveProductStatus` against a fabricated `saldo=0`, and correct the comment to match.

### WR-04: `createStockEntry` performs a non-atomic read-modify-write of moving-average cost

**File:** `src/actions/stock-entries.ts:96-179`
**Issue:** The entry flow is five separate round-trips (sum batches → read `products.custo_medio`
→ insert batch → insert entry → update `products.custo_medio`) with no transaction. Two concurrent
entries for the same product both read the same `custo_medio`/`saldo`, so the second update
overwrites the first and the persisted moving average is wrong. A failure after the batch insert
but before the entry insert also leaves an orphan batch (balance already increased) with no
corresponding `stock_entries` record. The comments acknowledge no RPC exists, but the correctness
risk should be tracked.
**Fix:** Move the recalculation into a single Postgres RPC / `plpgsql` function that reads the
current balance and cost and updates the batch, entry, and product atomically (`SELECT ... FOR
UPDATE` on the product row), mirroring the CAS approach used for draws. Minor: the
`products` update (line 172-175) filters only on `id` — add `.eq('clinic_id', actor.tenant_id)`
for consistency with the reads/other writes (RLS covers it today, but the explicit scope is the
project convention).

## Info

### IN-01: Edited quantities in `MaterialsUsedSection` are never persisted or used

**File:** `src/components/prontuario/ProntuarioForm.tsx:87-108`, `src/components/estoque/MaterialsUsedSection.tsx:135-149`
**Issue:** The `qtds` state lets the user edit per-material quantities, but `onSubmit` only calls
`createMedicalRecord` — the edited quantities are discarded. The real draw (server-side) uses
`qtd_padrao` from the template. This is documented as a D-22 limitation, but the editable inputs
imply an effect they do not have, which will confuse users.
**Fix:** Either make the inputs read-only until the D-22 wiring lands, or add a helper caption
clarifying the quantities are informational only for now.

### IN-02: Dashboard "Movimentações Recentes" mixes unit-scoped draws with all-unit entries

**File:** `src/app/(dashboard)/clinica/estoque/page.tsx:40-66`
**Issue:** `listStockDraws({ unitId })` is scoped to the default unit, but `listStockEntries()` is
called with no filter and returns entries across all units (it has no `unitId` parameter). The
merged "recent movements" list is therefore inconsistent by unit.
**Fix:** Add a `unitId`/unit filter to `listStockEntries` and pass the same `unitId`, or document
that the dashboard intentionally shows network-wide entries.

### IN-03: Replenishment agent treats `estoque_maximo === 0` as "not configured"

**File:** `src/lib/agents/stock-agent.ts:149`
**Issue:** `if (!preferredSupplierId || !estoqueMaximo)` uses falsy coercion, so an
`estoque_maximo` of `0` disables the purchasing agent and only emits an alert. `0` is an unlikely
but valid-per-schema value (`.min(0)`).
**Fix:** Use an explicit null check: `estoqueMaximo == null` instead of `!estoqueMaximo`.

### IN-04: `unit_id` from the client is not verified to belong to the actor's tenant

**File:** `src/actions/stock-entries.ts:69-141`, `src/actions/stock-draws.ts:291-342`
**Issue:** `createStockEntry` and `createManualDraw` accept `unit_id` from the payload and write it
alongside `clinic_id: actor.tenant_id` without confirming the unit belongs to that tenant. Tenant
integrity relies on a FK/RLS check on the `units` relationship. If that constraint is absent, an
admin could attach a row to a foreign unit id under their own `clinic_id`.
**Fix:** Validate the unit belongs to `actor.tenant_id` before insert (a quick `units` lookup), or
confirm a DB-level FK + RLS enforces it.

### IN-05: `deriveProductStatus` never returns 'vencido', but the UI enumerates it as a status

**File:** `src/actions/products.ts:64-69`, `src/components/estoque/ProductsTable.tsx:50-98,284-291`
**Issue:** `ProductStatus` in `ProductsTable` and the status filter/labels include `'vencido'`,
but the server's `deriveProductStatus` can only produce `normal | baixo | critico | negativo`.
The "Vencido" filter option and badge path are dead — selecting it always yields an empty table.
**Fix:** Remove the `'vencido'` option/labels until expiry-based status is actually derived, or
implement the derivation (e.g. from `product_batches.data_validade`).

---

_Reviewed: 2026-07-11_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
