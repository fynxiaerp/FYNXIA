---
phase: 17-estoque-materiais
verified: 2026-07-11T19:39:55Z
status: gaps_found
score: 8/9 must-have truths verified (across 9 plans); 1 gap
overrides_applied: 0
gaps:
  - truth: "A seção 'Materiais Utilizados' no prontuário lista os materiais do template com qtd editável e custo estimado (D-22)"
    status: partial
    reason: >
      MaterialsUsedSection.tsx is fully implemented (listServiceMaterials + listProducts join,
      editable qty inputs, status badges, "Custo estimado de insumos" footer, auto-hide via
      `return null` when no templates). ProntuarioForm.tsx correctly renders
      <MaterialsUsedSection serviceId={serviceId} />. However, `serviceId` is an optional prop
      that defaults to `undefined`, and BOTH real callers of ProntuarioForm
      (src/app/(dashboard)/clinica/pacientes/[id]/page.tsx and .../prontuario/page.tsx) invoke
      it as `<ProntuarioForm patientId={id} />` — never passing serviceId. The component is
      permanently dormant in the running application: MaterialsUsedSection always returns null
      in production today because no procedure/service-selection step exists in the prontuário
      flow to supply serviceId. This was self-flagged as a known limitation in the 17-09-SUMMARY.md
      ("Next Phase Readiness" section: "serviceId prop on ProntuarioForm is dormant (no caller
      passes it yet)").
    artifacts:
      - path: "src/components/estoque/MaterialsUsedSection.tsx"
        issue: "Correctly implemented and auto-hiding, but never receives a real serviceId from any caller — functionally unreachable in the live app"
      - path: "src/components/prontuario/ProntuarioForm.tsx"
        issue: "serviceId prop accepted but never supplied by either of its two callers"
    missing:
      - "A procedure/service-selection step in the prontuário flow (or in the pages that render ProntuarioForm) that resolves a real serviceId and passes it through, so MaterialsUsedSection can actually render for dentists"
---

# Phase 17: Estoque & Materiais Verification Report

**Phase Goal:** Usuários cadastram produtos com lote/série, o procedimento realizado dá baixa automática de materiais no estoque, e alertas de estoque mínimo e validade disparam o agente de compras com rastreabilidade ANVISA
**Verified:** 2026-07-11T19:39:55Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (Roadmap Success Criteria)

| # | Truth (Roadmap SC) | Status | Evidence |
|---|---------|--------|----------|
| 1 | Usuário cadastra produto com categoria (insumo/implante/medicamento), lote/série, estoque mínimo e custo médio calculado | ✓ VERIFIED | `productSchema`/`stockEntrySchema` (src/lib/validators/product.ts) enforce category-conditional ANVISA/validade rules; `createProduct`/`createStockEntry` (src/actions/products.ts, src/actions/stock-entries.ts) persist to live DB tables `products`/`product_batches`; `calcularCustoMedioMovel` (src/lib/stock/custo-medio.ts) computes moving-average cost with divide-by-zero/first-batch guard, 6/6 unit tests GREEN; ProductFormDialog + StockEntryFormDialog wire the UI end-to-end with conditional ANVISA fields |
| 2 | Ao registrar procedimento concluído, a baixa de materiais associados é feita automaticamente no estoque | ✓ VERIFIED | `src/actions/appointments.ts` lines 364-371: inside `if (input.status === 'concluido')`, calls `drawMaterialsForProcedures(id, actor.tenant_id, actor.id)` via dynamic import wrapped in try/catch (D-09 — never blocks the appointment). `drawMaterialsForProcedures` (src/actions/stock-draws.ts) resolves unit_id via appointments, joins `appointment_procedures` → `service_material_templates` → FIFO batch (CAS guard via `.eq('saldo_disponivel', valorLido)`), inserts `stock_draws`, and triggers `checkMinimoAndReplenish`. 5/5 stock-draws.test.ts assertions GREEN; full suite (1674 tests) shows zero appointment-flow regressions |
| 3 | Sistema alerta quando estoque atinge o mínimo ou produto está próximo do vencimento; implantes têm rastreabilidade de lote por exigência ANVISA e o agente de compras é disparado | ✓ VERIFIED | `runStockReplenishmentAgent` (src/lib/agents/stock-agent.ts) uses `withAgentPolicy` (clinicId always real per-row, never null — Pitfall 3), creates payable `origem='estoque_agente'` + `approval_requests` (requested_by=null) when `preferred_supplier_id`+`estoque_maximo` are set, else falls back to `insertStockAlert('minimo')`. Cron `/api/cron/estoque-validade` (`runtime='nodejs'`, `isCronAuthorized`, `createAdminClient`) scans `product_batches.data_validade <= hoje+30d`, idempotent via app-level daily dedup + 23505 backstop. `listAnvisaTraceability` (src/actions/stock-draws.ts) + `/clinica/estoque/anvisa` page + `AnvisaReportPdf`/`/api/estoque/anvisa-pdf` (Flexbox-only, nodejs runtime) deliver full ANVISA lot traceability with PDF export |

**Score:** 3/3 roadmap Success Criteria VERIFIED.

### Plan-Level Must-Haves (Additional Scope Beyond Roadmap SCs)

All 9 plans' `must_haves.truths` were cross-checked against the live codebase. 1 gap found (Plan 09, truth 4 of 5) — see Gaps Summary below. All other plan-level truths (Zod validation, migrations/RLS, custo médio, FIFO/CAS, cron idempotency, dashboard/catalog UI, entradas/baixa manual UI, ANVISA report/PDF, service catalog + Materiais tab) are VERIFIED with matching code evidence.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/validators/product.ts` | 4 Zod schemas (productSchema, stockEntrySchema, stockDrawSchema, serviceMaterialTemplateSchema) | ✓ VERIFIED | All 4 exported; superRefine enforces category-conditional ANVISA/validade rules; 14/14 unit tests GREEN |
| `supabase/migrations/20260703000100_estoque_tables.sql` | 6 CREATE TABLE statements | ✓ VERIFIED | `grep -c "CREATE TABLE public"` = 6; deviation documented (uq_stock_alerts_daily uses `(created_at AT TIME ZONE 'America/Sao_Paulo')::date` — IMMUTABLE fix for 42P17) |
| `supabase/migrations/20260703000200_estoque_alters.sql` | payables.origem CHECK + approval_requests.requested_by nullable | ✓ VERIFIED | `estoque_agente` present in CHECK constraint; comment documents NULL=system actor |
| `supabase/migrations/20260703000300_estoque_rls.sql` | RLS on 6 tables | ✓ VERIFIED | `grep -c "ENABLE ROW LEVEL SECURITY"` = 6 |
| `supabase/migrations/20260703000400_estoque_seed.sql` | stock_replenishment L2 seed | ✓ VERIFIED | INSERT with `autonomy_level='L2'`, idempotent ON CONFLICT |
| `src/types/database.types.ts` | Regenerated types including 6 estoque tables | ✓ VERIFIED | File is UTF-16LE encoded (Windows PowerShell `>` redirect artifact — cosmetic, tsc compiles it fine, zero errors); converted content confirms product_batches(7), stock_draws(8), service_material_templates(4), stock_alerts(5) occurrences; file terminates in `} as const` (not truncated) |
| `src/lib/stock/custo-medio.ts` | calcularCustoMedioMovel pure fn | ✓ VERIFIED | No 'use server'/'server-only'; 6/6 tests GREEN (first-batch, weighted avg, negative-saldo guard, rounding, NaN/Infinity guards) |
| `src/actions/products.ts` / `product-batches.ts` / `stock-entries.ts` | CRUD + entry recording | ✓ VERIFIED | WRITER_ROLES gate; productSchema/stockEntrySchema parse before DB; saldo derived from SUM(product_batches.saldo_disponivel) |
| `src/lib/agents/stock-agent.ts` | runStockReplenishmentAgent + insertStockAlert | ✓ VERIFIED | withAgentPolicy governance L2; app-level daily dedup + 23505 backstop |
| `src/actions/stock-alerts.ts` | listActiveAlerts / getAlertCounts | ✓ VERIFIED | Both exported; filters `resolvido=false` |
| `src/app/api/cron/estoque-validade/route.ts` | Weekly expiry cron | ✓ VERIFIED | nodejs runtime, isCronAuthorized, createAdminClient, registered in vercel.json (`0 5 * * 1`) |
| `src/actions/stock-draws.ts` | FIFO draw, manual draw, ANVISA report | ✓ VERIFIED | selectFifoBatch CAS guard; drawMaterialsForProcedures wired into appointments.ts; listAnvisaTraceability filters category='implante' |
| `src/actions/service-material-templates.ts` | CRUD templates | ✓ VERIFIED | listServiceMaterials/addServiceMaterial/removeServiceMaterial exported; UNIQUE conflict handled |
| `src/components/shell/nav-config.ts`/`nav-icons.ts` | Estoque sidebar link | ✓ VERIFIED | 'estoque' in NavIconKey + ALL_NAV_ITEMS; Package icon mapped |
| `src/app/(dashboard)/clinica/estoque/page.tsx` | Dashboard with alerts + KPIs | ✓ VERIFIED | getAlertCounts called; `grid-cols-1 gap-4 sm:grid-cols-3` present |
| `src/app/(dashboard)/clinica/estoque/produtos/page.tsx` + ProductsTable + ProductFormDialog | Filterable catalog + dialog | ✓ VERIFIED | listProducts, nuqs filters, productSchema in zodResolver, conditional ANVISA field via watch('category') |
| `src/app/(dashboard)/clinica/estoque/entradas/page.tsx` + StockEntriesTable/StockEntryFormDialog/ManualDrawDialog | Entradas + baixa manual UI | ✓ VERIFIED | createStockEntry/createManualDraw wired; auto-open via ?produto=&acao= query params resolves the Plan 06 dropdown links (previously pointing to a non-existent route, now real) |
| `src/app/(dashboard)/clinica/estoque/anvisa/page.tsx` + AnvisaReportTable/AnvisaReportPdf + `/api/estoque/anvisa-pdf` | ANVISA report + PDF export | ✓ VERIFIED | listAnvisaTraceability consumed; Flexbox-only (0 "Grid" matches); runtime='nodejs'; renderToBuffer present |
| `src/app/(dashboard)/config/servicos/page.tsx` + ServiceForm + MaterialsTemplateTab | Service catalog + Materiais tab | ✓ VERIFIED | listServices; Tabs (Dados/Materiais); MaterialsTemplateTab rendered only in edit mode; addServiceMaterial/removeServiceMaterial wired; "Nenhum material configurado" empty state present |
| `src/components/estoque/MaterialsUsedSection.tsx` + `ProntuarioForm.tsx` integration | Prontuário materials section | ⚠️ ORPHANED | Component correctly implemented (listServiceMaterials, "Custo estimado de insumos", `return null` auto-hide) and correctly rendered inside ProntuarioForm, BUT `serviceId` is never passed by either real caller of ProntuarioForm — component is dead code in the running app today. See Gaps Summary. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `src/actions/appointments.ts` | `src/actions/stock-draws.ts` | `drawMaterialsForProcedures` inside `status==='concluido'` block | ✓ WIRED | Confirmed at lines 364-371, wrapped in try/catch (D-09) |
| `src/actions/stock-draws.ts` | `product_batches` table | CAS UPDATE via `.eq('saldo_disponivel', valorLido)` | ✓ WIRED | selectFifoBatch loops up to 25 attempts, falls back to batch_id=null (D-09) |
| `src/actions/stock-draws.ts` | `src/lib/agents/stock-agent.ts` | `runStockReplenishmentAgent` after baixa when saldo<=minimo | ✓ WIRED | `checkMinimoAndReplenish` helper shared between automatic and manual draws |
| `src/lib/agents/stock-agent.ts` | `payables` + `approval_requests` tables | insert origem='estoque_agente' + approval_request | ✓ WIRED | Confirmed inserts with requested_by=null |
| `src/app/api/cron/estoque-validade/route.ts` | `product_batches` table | createAdminClient scan validade <= hoje+30d | ✓ WIRED | Delegates alert creation to insertStockAlert (shared idempotency) |
| `src/components/shell/nav-config.ts` | `/clinica/estoque` | ALL_NAV_ITEMS + NavIconKey 'estoque' | ✓ WIRED | Confirmed in both nav-config.ts and nav-icons.ts |
| `src/components/estoque/ProductsTable.tsx` dropdown | `/clinica/estoque/entradas` | Link href with ?produto=&acao= | ✓ WIRED | Page honors both params to auto-open StockEntryFormDialog/ManualDrawDialog pre-filled |
| `src/components/estoque/MaterialsTemplateTab.tsx` | `src/actions/service-material-templates.ts` | addServiceMaterial/removeServiceMaterial/listServiceMaterials | ✓ WIRED | Confirmed all 3 imported and called |
| `src/components/prontuario/ProntuarioForm.tsx` | `src/components/estoque/MaterialsUsedSection.tsx` | `serviceId` prop pass-through | ✗ NOT_WIRED (upstream) | Component-to-component wiring is correct, but no page ever supplies a real serviceId value — see Gaps Summary |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| ProductsTable | `listProducts({unitId})` result | `src/actions/products.ts` → SUM(product_batches.saldo_disponivel) | Yes — live DB query, no static fallback | ✓ FLOWING |
| Dashboard KPI cards | `getAlertCounts(unitId)` | `src/actions/stock-alerts.ts` → COUNT stock_alerts + negativo aggregation | Yes — live DB query | ✓ FLOWING |
| AnvisaReportTable | `listAnvisaTraceability()` | `src/actions/stock-draws.ts` → JOIN stock_draws/product_batches/products/appointment_procedures | Yes — live DB query, filtered category='implante' | ✓ FLOWING |
| MaterialsUsedSection | `listServiceMaterials(serviceId)` | `src/actions/service-material-templates.ts` | Query itself is real, but `serviceId` argument is always `undefined` in production (no caller supplies it) | ✗ DISCONNECTED (upstream prop never populated) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Estoque test suite (40 tests, 6 files) all GREEN | `npx vitest run src/__tests__/estoque/` | 6 files passed, 40/40 tests passed | ✓ PASS |
| Full project test suite — no regressions from Phase 17 | `npx vitest run` | 99 files passed, 1674/1674 tests passed | ✓ PASS |
| tsc clean on all Phase 17 files | `npx tsc --noEmit \| grep -iE "estoque\|stock\|product\|servico"` | 0 matches (pre-existing errors confined to `src/__tests__/faturamento`, `financeiro*`, `src/lib/financeiro/__tests__` — Phases 14-16, not Phase 17) | ✓ PASS |
| Vercel cron registered | `grep estoque-validade vercel.json` | `{ "path": "/api/cron/estoque-validade", "schedule": "0 5 * * 1" }` | ✓ PASS |
| appointments.ts wiring present and non-blocking | manual code read | try/catch around drawMaterialsForProcedures, D-09 comment | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| EST-01 | 01, 02, 03, 06, 07 | Usuário cadastra produtos (categoria, lote/série, estoque mínimo, custo médio) | ✓ SATISFIED | productSchema + createProduct/createStockEntry + custo médio móvel + catalog/entradas UI, all live and tested |
| EST-02 | 01, 02, 05, 09 | Procedimento dá baixa automática de material no estoque | ✓ SATISFIED (core mechanism) — ⚠️ partial UI visibility gap | drawMaterialsForProcedures fully wired into appointments.ts (roadmap SC #2 met independent of prontuário UI); the "Materiais Utilizados" prontuário section (D-22, Plan 09 UI must-have) is built but not reachable — see gap |
| EST-03 | 01, 02, 04, 06, 08 | Sistema alerta estoque mínimo (dispara agente) e validade; rastreia lote de implante (ANVISA) | ✓ SATISFIED | runStockReplenishmentAgent + insertStockAlert + cron validade + ANVISA report/PDF, all live and tested |

No orphaned requirements — EST-01/02/03 are the only IDs mapped to Phase 17 in REQUIREMENTS.md, and all three are claimed across the 9 plans.

### Anti-Patterns Found

None. Scanned all Phase 17 source files (actions/, lib/stock/, lib/agents/stock-agent.ts, lib/validators/product.ts, components/estoque/, app/(dashboard)/clinica/estoque/**, app/api/estoque/**, app/api/cron/estoque-validade/**, config/servicos) for TODO/FIXME/HACK/PLACEHOLDER/"coming soon"/"not yet implemented" markers and hardcoded-empty stub patterns. All `placeholder` matches were legitimate UI input placeholders or TanStack Table's `header.isPlaceholder` API — no code smells found.

### Human Verification Required

None required to reach a status determination — the one gap identified (MaterialsUsedSection dormancy) is a code-level wiring gap, not a UI/UX judgment call, and is fully diagnosable from source. A closure plan should either (a) wire a real serviceId into ProntuarioForm's callers, or (b) if intentionally deferred to a future phase (e.g., when appointment_procedures selection is added to the prontuário UI), the developer should record an explicit override/deferral decision.

### Gaps Summary

Phase 17 achieves all 3 roadmap Success Criteria: product cadastro with moving-average cost (SC1), automatic material draw on procedure completion (SC2 — verified independently of the prontuário UI, via the appointments.ts → stock-draws.ts wiring), and minimum-stock/expiry alerting with ANVISA traceability + purchasing agent (SC3). The estoque test suite is 40/40 GREEN, the full project suite is 1674/1674 GREEN with zero regressions, and `tsc --noEmit` is clean for every Phase 17 file.

One gap was found at the plan-must-have level (not at the roadmap-SC level): Plan 09's `MaterialsUsedSection` — the "Materiais Utilizados" section intended to display consumption templates inside the prontuário — is fully implemented and correctly integrated into `ProntuarioForm`, but is functionally unreachable in the live application because `serviceId` is never supplied by either of ProntuarioForm's two real callers (`clinica/pacientes/[id]/page.tsx` and `clinica/pacientes/[id]/prontuario/page.tsx`). This was self-documented as a known limitation in 17-09-SUMMARY.md ("serviceId prop on ProntuarioForm is dormant"). It does not block the core EST-02 mechanism (baixa automática already works end-to-end via the appointment-conclusion flow, independent of this prontuário display feature), but it means a documented decision (D-22) and a plan-level must-have truth are not observable by an end user today.

Recommended next step: a small closure plan to wire a real `serviceId` into the prontuário flow (likely requiring a procedure-selection step that doesn't currently exist in ProntuarioForm), OR an explicit developer decision to defer this to a future phase with a documented override.

---

*Verified: 2026-07-11T19:39:55Z*
*Verifier: Claude (gsd-verifier)*
