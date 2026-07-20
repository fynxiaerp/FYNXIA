---
phase: 19-relat-rios-or-amento-bi
reviewed: 2026-07-19T00:00:00Z
depth: standard
files_reviewed: 45
files_reviewed_list:
  - src/__tests__/governance/bi-forecast-agent.test.ts
  - src/__tests__/rbac-phase19.test.ts
  - src/actions/__tests__/budget-targets.test.ts
  - src/actions/__tests__/dre.test.ts
  - src/actions/__tests__/partner-shares.test.ts
  - src/actions/approval-actions.ts
  - src/actions/bi-alerts.ts
  - src/actions/bi-kpis.ts
  - src/actions/budget-targets.ts
  - src/actions/dre.ts
  - src/actions/kpi-targets.ts
  - src/actions/partner-shares.ts
  - src/app/(dashboard)/bi/page.tsx
  - src/app/(dashboard)/clinica/orcamento/page.tsx
  - src/app/(dashboard)/clinica/prototipos/page.tsx
  - src/app/(dashboard)/clinica/relatorios/page.tsx
  - src/app/(dashboard)/clinica/societario/page.tsx
  - src/app/api/bi/pdf/route.ts
  - src/app/api/cron/bi-previsoes/route.ts
  - src/app/api/orcamento/pdf/route.ts
  - src/app/api/relatorios/dre-pdf/route.ts
  - src/app/api/societario/pdf/route.ts
  - src/components/relatorios/BiAlertsSection.tsx
  - src/components/relatorios/BiDashboard.tsx
  - src/components/relatorios/BiPdf.tsx
  - src/components/relatorios/BudgetGrid.tsx
  - src/components/relatorios/BudgetPdf.tsx
  - src/components/relatorios/charts.tsx
  - src/components/relatorios/DreFilters.tsx
  - src/components/relatorios/DrePdf.tsx
  - src/components/relatorios/DreView.tsx
  - src/components/relatorios/OrcamentoFilters.tsx
  - src/components/relatorios/PartnerDistribution.tsx
  - src/components/relatorios/PartnerShareFormDialog.tsx
  - src/components/relatorios/SocietarioPdf.tsx
  - src/components/shell/nav-config.ts
  - src/components/shell/nav-icons.ts
  - src/lib/agents/bi-forecast-agent.ts
  - src/lib/bi/__tests__/forecast-math.test.ts
  - src/lib/bi/forecast-math.ts
  - src/lib/financeiro/__tests__/dre-math.test.ts
  - src/lib/financeiro/__tests__/partner-share-math.test.ts
  - src/lib/financeiro/budget-schema.ts
  - src/lib/financeiro/dre-math.ts
  - src/lib/financeiro/kpi-target-schema.ts
  - src/lib/financeiro/partner-share-math.ts
  - src/lib/financeiro/partner-share-schema.ts
  - src/lib/supabase/database.types.ts
  - src/proxy.ts
  - supabase/migrations/20260719000100_bi_tables.sql
  - supabase/migrations/20260719000200_bi_rls.sql
  - supabase/migrations/20260719000300_bi_seed.sql
  - vercel.json
  - vitest.config.ts
findings:
  critical: 1
  warning: 2
  info: 4
  total: 7
status: issues_found
---

# Phase 19: Code Review Report

**Reviewed:** 2026-07-19T00:00:00Z
**Depth:** standard
**Files Reviewed:** 45
**Status:** issues_found

## Summary

Phase 19 (DRE, Orçamento, Societário, BI dashboard + forecast agent) is generally
well-built: RLS policies correctly mirror the action-layer role gates (budget_targets
write allows socio per D-14, kpi_targets/partner_shares write is admin/superadmin-only,
bi_alerts has zero authenticated write policy), tenant scoping is consistently enforced
(explicit `clinic_id`/`tenant_id` filters on writes, RLS-only on reads — a documented,
consistent pattern across the codebase), the `'use server'`-file-exports-only-async
constraint is respected everywhere (all pure helpers like `priorCloseDate`,
`isMonthLocked`, `resolveDreCostCenterFilter` are wrapped as `async`), and the
`approveBudgetAdjustment` approve-then-mutate ordering is correctly implemented
(`approveRequest()` is awaited and checked for success *before* the `budget_targets`
UPDATE runs, mirroring the Phase 18 campaign-approval precedent).

However, one critical logic bug was found that silently disables the headline BI-02
capability (the agent's persistent-budget-deviation → human-approval suggestion never
fires under the seeded configuration), plus two warnings (a navigation gap that hides
Orçamento/Relatórios/Societário/BI links from the `socio` role despite that role having
real access, and a missing date-format validation on one of the four PDF export routes)
and four minor informational items.

## Critical Issues

### CR-01: bi_forecast agent's persistent-deviation approval suggestion never executes (governance level/sensitivity mismatch)

**File:** `src/lib/agents/bi-forecast-agent.ts:454-513` (in combination with `supabase/migrations/20260719000300_bi_seed.sql:24-28`)

**Issue:**
`evaluateBudgetDeviations` puts the entire "create the suggestion" side effect — the
`approval_requests` INSERT, the `bi_alerts` INSERT (with `approval_request_id` set so
the panel renders "Revisar sugestão"), and the `logBusinessEvent` audit call — **inside**
the `originalExecute` callback passed to `withAgentPolicy`:

```ts
const govResult = await withAgentPolicy(
  { clinicId, agentKey: 'bi_forecast', actorId: null,
    action: 'agent.bi.suggest_budget_adjustment',
    actionSensitivity: 'reversible' },
  async () => {
    // approval_requests INSERT + bi_alert INSERT + logBusinessEvent all live here
    ...
  },
)
```

`withAgentPolicy` (`src/lib/ai/policy.ts:106-108`) only invokes `originalExecute()` when
the computed decision is `'execute'`:

```ts
if (decision === 'execute') { return originalExecute() }
if (decision === 'pending_approval') { return { _policy: 'pending_approval', reason } }
// 'suggest' or 'block'
return { _policy: decision, reason: ... }
```

`computePolicyDecision` (`src/lib/ai/policy-types.ts:51`) for level `'L1'` is:

```ts
if (level === 'L1') return sensitivity === 'safe' ? 'execute' : 'suggest'
```

The `bi_forecast` agent is seeded at **`'L1'`** (`20260719000300_bi_seed.sql:25`:
`INSERT ... SELECT c.id, 'bi_forecast', 'L1', true ...`), and the call site passes
`actionSensitivity: 'reversible'` (not `'safe'`). `computePolicyDecision('L1', 'reversible')`
therefore always returns `'suggest'` — never `'execute'` — so **`originalExecute()` is
never called under the default seeded configuration**. The result: no `approval_requests`
row is ever created for a persistent budget deviation, no `bi_alerts` row gets an
`approval_request_id`, and the "Revisar sugestão" link (D-35) never appears — the entire
BI-02 "agent suggests a budget adjustment" pipeline is dead code in production, even
though `approveBudgetAdjustment` (the consuming side, `src/actions/approval-actions.ts`)
is implemented correctly.

This directly contradicts the seed migration's own comment (`20260719000300_bi_seed.sql:18-19`):
> "D-34/D-35 sempre roteiam por approval_requests independentemente do nível
> configurado" (*"D-34/D-35 always route through approval_requests regardless of the
> configured level"*) — which is not true given how `withAgentPolicy` actually behaves.

Contrast with the working precedent this code claims to mirror: `stock-agent.ts`'s
`runStockReplenishmentAgent` also uses `actionSensitivity: 'reversible'`, but its agent
(`stock_replenishment`) is seeded at **`'L2'`** (`20260703000400_estoque_seed.sql:26`),
where `computePolicyDecision('L2', 'reversible')` → `'execute'` (since `'reversible' !==
'sensitive'`). That is why the stock agent's draft-payable + approval_request creation
actually runs. `bi_forecast`'s `'L1'` seed does not have the same property.

Existing test coverage does not catch this: `src/__tests__/governance/bi-forecast-agent.test.ts`
only does source-text regex assertions (`withAgentPolicy` is called, `agentKey:
'bi_forecast'` string is present, no direct `budget_targets` UPDATE) — it never actually
invokes the policy matrix end-to-end with the seeded `'L1'` config to assert an
`approval_requests` row gets created.

**Fix:** Either (a) change the seed migration to `'L2'` for `bi_forecast` (mirroring
`stock_replenishment`'s convention, since "suggestion requiring human approval" is the
same shape of action), e.g.:
```sql
INSERT INTO public.ai_agent_config (clinic_id, agent_key, autonomy_level, enabled)
SELECT c.id, 'bi_forecast', 'L2', true FROM public.clinics c WHERE c.deleted_at IS NULL
ON CONFLICT (clinic_id, agent_key) WHERE unit_id IS NULL DO NOTHING;
```
or (b) move the `approval_requests`/`bi_alerts`/audit-log side effect out of
`originalExecute()` and instead trigger it unconditionally after the persistence check
(the way this action is described as behaving "regardless of configured level"), or (c)
use `actionSensitivity: 'sensitive'` together with an `'L2'`/`'L3'` seed so the decision
resolves to `'pending_approval'`, and create the `approval_requests` row in the caller
branch that handles `govResult._policy === 'pending_approval'` (this is the documented
usage pattern in `policy.ts`'s own doc comment: *"Caller is responsible for creating the
approval_requests row"*). Whichever fix is chosen, add an integration test that actually
runs `withAgentPolicy` against the real seeded `autonomy_level` and asserts an
`approval_requests` row is created for a persistent deviation — the current test suite
would not have caught this regression.

## Warnings

### WR-01: Orçamento/Relatórios/Societário/BI nav links are hidden from `socio`, despite `socio` having real access to all four

**File:** `src/components/shell/nav-config.ts:52-55` (consumed by
`src/components/shell/AppSidebar.tsx:31-32` and
`src/app/(dashboard)/clinica/layout.tsx:21-22`)

**Issue:** The four Phase 19 nav items are marked `adminOnly: true`:
```ts
{ href: '/clinica/relatorios', label: 'Relatórios', icon: 'relatorios', adminOnly: true },
{ href: '/clinica/orcamento',  label: 'Orçamento',  icon: 'orcamento',  adminOnly: true },
{ href: '/clinica/societario', label: 'Societário', icon: 'societario', adminOnly: true },
{ href: '/bi',                 label: 'BI',         icon: 'bi',         adminOnly: true },
```
Both call sites compute `isAdmin` as strictly `role === 'admin' || role === 'superadmin'`
(`AppSidebar.tsx:31`, `layout.tsx:21`), which excludes `socio`. But `src/proxy.ts`'s
`MODULE_PERMISSIONS` (and `src/__tests__/rbac-phase19.test.ts`, which explicitly asserts
this) grant `socio` real access: full write access to `orcamento` (D-14: *"socio has WRITE
access to budget targets"*) and read-only access to `relatorios`, `societario`, and `bi`.
A `socio` user can navigate to any of these four routes directly by URL and the RBAC gate
in `proxy.ts` correctly allows it, but there is no sidebar/mobile-nav link to get there —
the module is invisible to the one non-admin role for which Phase 19 was explicitly
designed to work.

**Fix:** Either introduce a broader gating flag (e.g. `visibleTo: AppRole[]` instead of
the binary `adminOnly`) driven by the same `MODULE_PERMISSIONS` table `proxy.ts` already
uses as source of truth, or at minimum extend the `isAdmin` boolean at both call sites to
`role === 'admin' || role === 'superadmin' || role === 'socio'` for these four items so
`buildNavItems` renders them for `socio` too.

### WR-02: `/api/societario/pdf` skips the `from`/`to` date-format validation the other three PDF export routes apply

**File:** `src/app/api/societario/pdf/route.ts:82-90`

**Issue:** `dre-pdf`, `orcamento-pdf`'s `ano`, and `bi/pdf` routes all validate their date
query params against a `DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/` regex
(or `Number.isInteger` for `ano`) before calling into the action layer. `societario/pdf`
only checks truthiness:
```ts
const from = url.searchParams.get('from')
const to = url.searchParams.get('to')
if (!from || !to) {
  return new Response(JSON.stringify({ error: 'Período (from/to) obrigatório.' }), { status: 400, ... })
}
```
A malformed (but non-empty) `from`/`to` value is passed straight into
`getPartnerDistribution({ from, to })`, which uses it directly in
`.gte('transaction_date', params.from)` / `.lte('transaction_date', params.to')`. An
invalid date string will make the underlying Postgrest query fail, and the route then
surfaces the raw Postgrest `error.message` in the JSON 500 response
(`result.error ?? 'Não foi possível carregar a distribuição societária.'`), which is both
a worse failure mode (500 instead of a clean 400) and a minor internal-error-message
disclosure.

**Fix:** Add the same `DATE_RE` check used by the sibling routes before calling
`getPartnerDistribution`:
```ts
const DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/
if (!DATE_RE.test(from) || !DATE_RE.test(to)) {
  return new Response(JSON.stringify({ error: 'Período inválido (YYYY-MM-DD)' }), { status: 400, ... })
}
```

## Info

### IN-01: `computeCrc` in `getBiKpis` silently ignores the `unitId` filter

**File:** `src/actions/bi-kpis.ts:292-322`

**Issue:** `computeOperacional`, `computeProfissionais`, and `computeEstoqueTiss` all
accept and honor `unitId`. `computeCrc` does not — it calls `getRoiByCampaign({ from, to
})` and `getRoiByOrigin({ from, to })` without `unitId` (only `getNpsSummary` receives
it). When a user selects a specific unit in the BI dashboard's period/unit filter, the
"CRC" tab's CPL/CAC/conversão indicators silently continue to show network-wide totals
while the other three tabs correctly scope to the selected unit — an inconsistent
filtering contract across dimensions of the same dashboard.

**Fix:** If `getRoiByCampaign`/`getRoiByOrigin` support a `unitId` parameter, pass it
through; if they don't, either add that support or add a UI note that CRC metrics are
always network-wide (so the inconsistency is at least intentional and visible, not
silent).

### IN-02: Persistent-deviation check assumes contiguous months without verifying it

**File:** `src/lib/agents/bi-forecast-agent.ts:392-422`

**Issue:** `persistent = monthly.length >= 2 && monthly.every((s) => s.semaphore !==
'verde')` is intended to mean "≥2 *consecutive* evaluated months all non-verde" (per the
D-34 doc comment), but `monthly` is built from whatever `budget_targets` rows happen to
exist for that `account_id` in the current year (sorted ascending, `.slice(-3)`), with no
check that the selected months are actually consecutive calendar months. If a clinic
saves budget targets for, say, months 1 and 7 only (skipping 2–6), `evaluated` would be
`[1, 7]` and the code would treat a Jan + Jul deviation as "persistent" even though they
are 6 months apart. In practice this is low-risk because `budgetTargetSchema` requires
saving all 12 months in one block (`saveBudgetTargets`/`copyBudgetFromPreviousYear`), but
the code doesn't defend against partial/manual data (e.g. seeded via SQL, or a future
partial-save feature).

**Fix:** Either add an explicit contiguity check (`rows[i].mes === rows[i-1].mes + 1`) or
document the reliance on the "always-12-months" invariant directly at this call site.

### IN-03: `computeProfissionais` does not filter out soft-deleted professionals when resolving display names

**File:** `src/actions/bi-kpis.ts:269-277`

**Issue:** The `professionals` table has a `deleted_at` soft-delete column
(confirmed in `database.types.ts:4437-4488`), but the name lookup
(`.from('professionals').select('id, full_name').in('id', ...)`) does not filter
`deleted_at IS NULL`. This is likely intentional for historical reporting (a
soft-deleted professional's past billings should still show their name), but it's worth
confirming that's the deliberate choice rather than an oversight, since every other
soft-delete-aware query in the codebase explicitly filters it.

**Fix:** If historical-name-preservation is intended, add a one-line comment noting the
deliberate omission (mirrors the commenting convention used throughout this phase's other
files); otherwise add `.is('deleted_at', null)`.

### IN-04: `evaluateBudgetDeviations`'s per-month `financial_transactions` query does not special-case an empty `costCenterIds` array

**File:** `src/lib/agents/bi-forecast-agent.ts:402-410`

**Issue:** `loadMonthlySum` explicitly short-circuits when `costCenterIds !== null &&
costCenterIds.length === 0` (a unit with zero cost centers) and returns zero-value points
without querying (`bi-forecast-agent.ts:244-246`). The per-account transaction query
inside `evaluateBudgetDeviations` does not apply the same short-circuit — it just calls
`.in('cost_center_id', costCenterIds)` unconditionally whenever `costCenterIds !== null`,
including when the array is empty. This is inconsistent with the sibling helper in the
same file (and with `computeEstoqueTiss`/`getBudgetVsRealizado` elsewhere in the phase,
which do special-case the empty-array case). Functionally this likely still returns zero
rows (`in.()` matches nothing), but it performs an extra network round-trip per
evaluated month per account for units with no cost centers, and breaks the "empty array →
skip query" convention this phase otherwise applies consistently.

**Fix:** Add the same early-return/skip pattern used in `loadMonthlySum` and
`computeEstoqueTiss` for consistency.

---

_Reviewed: 2026-07-19T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
