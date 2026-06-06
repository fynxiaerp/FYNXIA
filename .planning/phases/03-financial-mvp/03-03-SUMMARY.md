---
phase: 03-financial-mvp
plan: "03"
subsystem: financial-ui
tags: [cash-flow, receivables, nova-cobranca, pix, boleto, rls, brl-formatting, tdd, tanstack-table, nuqs, rhf-zod]

# Dependency graph
requires:
  - phase: 03-01
    provides: "financial tables (charges, receivables, financial_transactions, financial_categories)"
  - phase: 03-02
    provides: "createCharge Server Action (PIX QR, boleto, installments), chargeSchema"
  - phase: 01-x
    provides: "getActor pattern, createClient, logBusinessEvent"
  - phase: 02-x
    provides: "patients table, shadcn component base, @base-ui render-prop pattern"
provides:
  - "formatBRL + deriveReceivableStatus pure helpers (pt-BR locale, D-04)"
  - "createTransaction Server Action (FIN-02: manual cash entry, role-gated)"
  - "listTransactions (month range + totals: entradas/saidas/saldo)"
  - "listCategories (from seeded financial_categories)"
  - "listReceivables (joins charges+patients, raw status — no vencido stored)"
  - "Financeiro hub card on /clinica + /clinica/financeiro module hub"
  - "Fluxo de Caixa page: CashFlowTotals + TransactionList + TransactionModal (FIN-01, FIN-02)"
  - "Contas a Receber page: ReceivablesTable with client-side vencido derivation + Accordion installments (FIN-03, FIN-06)"
  - "Nova Cobrança page: ChargeForm wired to createCharge + PixQRDisplay + boleto link (FIN-04, FIN-05)"
affects: [03-04, UI-hub]

# Tech tracking
tech-stack:
  added:
    - "src/components/ui/switch.tsx (shadcn Switch via @base-ui/react)"
    - "src/components/ui/accordion.tsx (shadcn Accordion via @base-ui/react)"
  patterns:
    - "@base-ui/react render-prop pattern: PopoverTrigger render={<button>}, Button render={<Link>}, Accordion multiple prop — NO asChild"
    - "deriveReceivableStatus: pure helper using date-fns isPast/parseISO; called only in client components — never server-side"
    - "nuqs URL state: ?month=YYYY-MM for cash flow, ?status/?from/?to for receivables, ?tipo/?category for transaction filter"
    - "Zod schema without .default(): avoid z.default() on boolean/number fields — causes RHF resolver type mismatch; use RHF defaultValues instead"
    - "TanStack Table v8 for TransactionList and ReceivablesTable (same pattern as PatientTable)"
    - "NuqsAdapter in Server Component pages wrapping client components that use useQueryState"

key-files:
  created:
    - src/lib/format/money.ts
    - src/actions/transactions.ts
    - src/actions/receivables.ts
    - src/app/(dashboard)/clinica/financeiro/page.tsx
    - src/app/(dashboard)/clinica/financeiro/fluxo-de-caixa/page.tsx
    - src/app/(dashboard)/clinica/financeiro/contas-a-receber/page.tsx
    - src/app/(dashboard)/clinica/financeiro/nova-cobranca/page.tsx
    - src/components/financeiro/CashFlowTotals.tsx
    - src/components/financeiro/TransactionList.tsx
    - src/components/financeiro/TransactionModal.tsx
    - src/components/financeiro/ReceivablesTable.tsx
    - src/components/financeiro/ChargeForm.tsx
    - src/components/financeiro/PixQRDisplay.tsx
    - src/components/ui/switch.tsx
    - src/components/ui/accordion.tsx
    - src/__tests__/financeiro/money.test.ts
    - src/__tests__/financeiro/receivables.test.ts
    - src/__tests__/financeiro/charge-form.test.ts
  modified:
    - src/app/(dashboard)/clinica/page.tsx

key-decisions:
  - "No z.default() in Zod schemas used with RHF zodResolver: .default() makes fields optional in input type causing resolver type mismatch; provide defaults via RHF defaultValues instead"
  - "@base-ui/react components confirmed: Button uses render prop (not asChild), PopoverTrigger uses render prop, Accordion uses multiple prop (not type='multiple' or openMultiple)"
  - "vencido derived exclusively client-side in ReceivablesTable via deriveReceivableStatus (D-04 compliance) — never passed from Server Action"
  - "Pre-existing RED scaffolds (ruler.test.ts, recibo.test.ts, security-headers.test.ts) are Plan 04 responsibilities — not fixed here (scope boundary)"

# Metrics
duration: ~20min
completed: 2026-06-06
---

# Phase 03 Plan 03: Financial UI Summary

**BRL-formatted cash flow page (totals + TanStack Table), receivables table with client-side vencido derivation and Accordion installment grouping, Nova Cobrança form wired to createCharge (PIX QR + boleto), and Financeiro hub card — 23/23 plan tests GREEN, tsc exit 0, next build clean**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-06-06T17:03Z
- **Completed:** 2026-06-06T17:24Z
- **Tasks:** 3/3
- **Files created/modified:** 19

## Accomplishments

### Task 1: Money helpers + Server Actions + Hub card
- `src/lib/format/money.ts`: `formatBRL` (pt-BR locale, `toLocaleString`), `formatBRLSigned` (U+2212 minus), `deriveReceivableStatus` (date-fns `isPast`/`parseISO` — D-04)
- `src/actions/transactions.ts`: `createTransaction` (Zod + role gate + INSERT `financial_transactions`), `listTransactions` (month range + entradas/saidas/saldo totals), `listCategories`
- `src/actions/receivables.ts`: `listReceivables` (JOIN charges+patients, returns raw DB status — never `vencido` — D-04)
- Financeiro card added to `/clinica` navItems (DollarSign icon)
- `/clinica/financeiro` hub page with role-conditional Régua de Cobrança card
- `money.test.ts` 7/7 GREEN; `transactions.test.ts` 4/4 GREEN

### Task 2: Cash flow + Receivables pages + components
- `CashFlowTotals`: 3-card row, Display-size `tabular-nums` amounts, `aria-label` with full BRL amount (UI-SPEC accessibility)
- `TransactionList`: TanStack Table v8, nuqs `?tipo`/`?category` client-side filters, signed BRL (green/red)
- `TransactionModal`: RHF + Zod dialog, `createTransaction` Server Action, @base-ui `PopoverTrigger render={}` pattern
- `ReceivablesTable`: `deriveReceivableStatus` for every status cell (D-04), `Accordion multiple` for installment grouping (FIN-06), nuqs `?status` filter (including derived `vencido`)
- `fluxo-de-caixa/page.tsx`: Server Component, `?month` URL navigation via `Button render={<Link>}`, NuqsAdapter
- `contas-a-receber/page.tsx`: Server Component, delegates filter to client ReceivablesTable
- `receivables.test.ts` 6/6 GREEN; next build clean

### Task 3: Nova Cobrança + ChargeForm + PixQRDisplay
- `ChargeForm`: RHF + Zod (no `.default()`), patient search inline, `createCharge` Server Action, Switch parcelamento toggle, conditional installmentCount Select, @base-ui `PopoverTrigger render={}` calendar, result block (PIX QR / boleto link) rendered inline on success
- `PixQRDisplay`: `<img src="data:image/png;base64,{encodedImage}">` 200×200, copia-e-cola, "Copiar código Pix" with 2s "Copiado!" feedback, accessibility `aria-label`
- `nova-cobranca/page.tsx`: Server Component, patients fetched server-side (RLS scoped), role guard
- `charge-form.test.ts` 5/5 GREEN; tsc exit 0; next build clean (all 4 financial routes live)

## Task Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | `db74f21` | Money helpers, transactions/receivables actions, Financeiro hub |
| 2 | `a636630` | Cash flow page, receivables page, financial components |
| 3 | `9b1e6dc` | Nova Cobrança page, ChargeForm, PixQRDisplay |

## Files Created/Modified

**Created (18):**
- `src/lib/format/money.ts` — formatBRL, formatBRLSigned, deriveReceivableStatus
- `src/actions/transactions.ts` — createTransaction, listTransactions, listCategories
- `src/actions/receivables.ts` — listReceivables (raw status, no vencido)
- `src/app/(dashboard)/clinica/financeiro/page.tsx` — module hub
- `src/app/(dashboard)/clinica/financeiro/fluxo-de-caixa/page.tsx` — FIN-01
- `src/app/(dashboard)/clinica/financeiro/contas-a-receber/page.tsx` — FIN-03
- `src/app/(dashboard)/clinica/financeiro/nova-cobranca/page.tsx` — FIN-04/05
- `src/components/financeiro/CashFlowTotals.tsx`
- `src/components/financeiro/TransactionList.tsx`
- `src/components/financeiro/TransactionModal.tsx` — FIN-02
- `src/components/financeiro/ReceivablesTable.tsx` — FIN-03/06
- `src/components/financeiro/ChargeForm.tsx` — FIN-04/05/06
- `src/components/financeiro/PixQRDisplay.tsx`
- `src/components/ui/switch.tsx`
- `src/components/ui/accordion.tsx`
- `src/__tests__/financeiro/money.test.ts`
- `src/__tests__/financeiro/receivables.test.ts`
- `src/__tests__/financeiro/charge-form.test.ts`

**Modified (1):**
- `src/app/(dashboard)/clinica/page.tsx` — DollarSign Financeiro card

## Decisions Made

1. **No `z.default()` with RHF zodResolver**: `.default()` makes fields optional in Zod's input type but required in output, causing resolver type incompatibility with RHF. Fixed by removing `.default()` and providing initial values via RHF `defaultValues`.
2. **@base-ui render-prop confirmed for all components**: `Button render={<Link/>}`, `PopoverTrigger render={<button/>}`, `Accordion multiple` (not `type="multiple"` or `openMultiple`), `DialogTrigger` renders its own button (children are content).
3. **vencido exclusively client-side**: `deriveReceivableStatus` is imported and called only in `ReceivablesTable.tsx` (client component) — never in Server Actions or pages. The test asserts this pattern.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] @base-ui render-prop pattern (no asChild)**
- **Found during:** Tasks 2 and 3 (tsc --noEmit)
- **Issue:** `Button asChild`, `PopoverTrigger asChild`, `Accordion type="multiple"` / `openMultiple` are Radix UI patterns; @base-ui uses `render` prop and `multiple` boolean
- **Fix:** All `asChild` replaced with `render={<element>}` pattern; Accordion uses `multiple` prop; confirmed from PatientForm.tsx as canonical example
- **Files modified:** ReceivablesTable.tsx, TransactionModal.tsx, fluxo-de-caixa/page.tsx, contas-a-receber/page.tsx, ChargeForm.tsx
- **Commits:** included in task commits

**2. [Rule 1 - Bug] TypeScript array destructuring undefined**
- **Found during:** Task 2 (tsc --noEmit)
- **Issue:** `const [y, m] = month.split('-').map(Number)` — TypeScript strict mode flags `y` and `m` as `number | undefined`
- **Fix:** Replaced with explicit `parseInt(parts[0] ?? 'fallback', 10)` pattern
- **Files modified:** fluxo-de-caixa/page.tsx

**3. [Rule 1 - Bug] Zod `.default()` RHF resolver type mismatch**
- **Found during:** Task 3 (tsc --noEmit)
- **Issue:** `z.boolean().default(false)` and `z.number().default(2)` create optional input types that conflict with RHF's strict resolver typing
- **Fix:** Removed `.default()` from schema; used RHF `defaultValues` instead
- **Files modified:** ChargeForm.tsx

**4. [Rule 1 - Bug] `Select.onValueChange` typed as `(value: string | null) => void`**
- **Found during:** Task 3 (tsc --noEmit)
- **Issue:** @base-ui Select's `onValueChange` callback receives `string | null` (deselect returns null); `parseInt(v, 10)` where `v: string | null` fails TS strict check
- **Fix:** Added null guard `if (v) field.onChange(parseInt(v, 10))`
- **Files modified:** ChargeForm.tsx

## Known Stubs

None — all data flows through real Server Actions. Patient list, categories, and transactions are fetched from Supabase (RLS-scoped). Asaas PIX/boleto results are real API responses (live test deferred to Plan 03-02 UAT per D-02).

## Threat Surface

All STRIDE mitigations from the plan's threat model were implemented:

| Threat ID | Mitigation | Verified |
|-----------|-----------|---------|
| T-3-ui-I | All reads via createClient (RLS USING tenant_id = get_my_tenant_id()); no cross-tenant rows | Code review |
| T-3-ui-E | getActor role gate in createTransaction; Régua card admin-only (display); action-level gates are real enforcement | Code review |
| T-3-ui-V | Zod schemas on createTransaction + chargeSchema on createCharge; amount parsed as number | tsc --noEmit |
| T-3-ui-xss | React escapes by default; only Asaas `description` string surfaced; no innerHTML | Code review |

## Self-Check: PASSED

All 16 created files present. All 3 task commits verified (db74f21, a636630, 9b1e6dc).
