---
phase: 17-estoque-materiais
plan: 09
subsystem: ui
tags: [react-hook-form, zod, shadcn-tabs, base-ui-select, service-catalog, materials-templates, prontuario]

# Dependency graph
requires:
  - phase: 17-estoque-materiais (Plan 03)
    provides: products / listProducts (custo_medio, status, unidade_medida)
  - phase: 17-estoque-materiais (Plan 05)
    provides: service_material_templates Server Actions (listServiceMaterials, addServiceMaterial, removeServiceMaterial) + serviceMaterialTemplateSchema
  - phase: 15-faturamento-nfs-e-conv-nios-tiss
    provides: services table + services.ts Server Actions (listServices, createService, updateService)
affects: [18-crc-marketing, future prontuario procedure-selection work]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ServiceForm Dialog+Tabs trigger-wrapper mirrors UnitFormDialog/ProductFormDialog convention (children/trigger div with role=presentation)"
    - "Materiais tab gated on service.id existing — create mode shows a static notice instead of the tab content (FK requires a saved service_id)"
    - "MaterialsUsedSection joins two Server Actions client-side (listServiceMaterials + listProducts) to enrich template rows with custo_medio/status for the cost footer and alert badges"

key-files:
  created:
    - src/app/(dashboard)/config/servicos/page.tsx
    - src/components/config/ServiceForm.tsx
    - src/components/estoque/MaterialsTemplateTab.tsx
    - src/components/estoque/MaterialsUsedSection.tsx
  modified:
    - src/components/prontuario/ProntuarioForm.tsx

key-decisions:
  - "ServiceForm Dados tab exposes only the essential serviceSchema fields (name, code, description, valorParticular, ativo) — tussCode/accountId/aliquotaIssOverride/itemListaServicoOverride are optional/nullable in the schema and stay untouched via defaultValuesFor, no UI needed for this plan's scope"
  - "ProntuarioForm gains an optional serviceId prop (undefined by default) — MaterialsUsedSection auto-hides when absent, so the existing createMedicalRecord flow is unchanged until a future plan wires procedure selection into the prontuário"

requirements-completed: [EST-02]

# Metrics
duration: ~20min
completed: 2026-07-11
---

# Phase 17 Plan 09: Catálogo de Serviços + Materiais Utilizados Summary

**`/config/servicos` catalog with a ServiceForm Materiais tab (D-21) for consumption templates, plus a "Materiais Utilizados" section wired into the prontuário (D-22) with editable qtd and estimated insumo cost.**

## Performance

- **Duration:** ~20min
- **Tasks:** 3
- **Files modified:** 5 (4 created, 1 modified)

## Accomplishments
- `/config/servicos` catalog page (admin/superadmin gated, mirrors `/config/unidades` auth pattern) with create/edit via `ServiceForm`
- `ServiceForm`: Dados tab (RHF + `zodResolver(serviceSchema)`, BRL-masked valor field) + Materiais tab that renders `MaterialsTemplateTab` only once the service has a saved `id`
- `MaterialsTemplateTab`: lists/add/remove `service_material_templates` rows via inline row expansion (no dialog), matching UI-SPEC §5 exactly, including the "Nenhum material configurado" empty-state copy
- `MaterialsUsedSection`: renders in the prontuário, pre-fills qty from `qtd_padrao`, shows "Estoque Baixo"/"Saldo Negativo" badges for `critico`/`negativo` product status, computes and displays "Custo estimado de insumos" — auto-hides (`return null`) when no `serviceId` or no templates exist
- `ProntuarioForm` gets an additive, optional `serviceId` prop — existing `createMedicalRecord` flow is untouched

## Task Commits

Each task was committed atomically:

1. **Task 1: Catálogo de serviços /config/servicos + ServiceForm com Tabs** - `6c8bb53` (feat)
2. **Task 2: MaterialsTemplateTab (aba Materiais)** - `ec314cf` (feat)
3. **Task 3: Seção Materiais Utilizados no prontuário** - `20aa093` (feat)

## Files Created/Modified
- `src/app/(dashboard)/config/servicos/page.tsx` - RSC catalog page: auth + admin role gate (inline Alert, no redirect), `listServices()`, table with per-row `ServiceForm` edit trigger and header "Novo Serviço" create trigger
- `src/components/config/ServiceForm.tsx` - Dialog + Tabs (Dados/Materiais) client component; Dados tab submits via `createService`/`updateService`; Materiais tab renders `MaterialsTemplateTab` in edit mode or a "Salve o serviço primeiro..." notice in create mode
- `src/components/estoque/MaterialsTemplateTab.tsx` - Lists/adds/removes `service_material_templates` for a given `serviceId` via inline row expansion, loads active products via `listProducts()` for the Select
- `src/components/estoque/MaterialsUsedSection.tsx` - Joins `listServiceMaterials` + `listProducts`, renders editable qty inputs, status badges, and the estimated insumo cost footer; renders `null` when not applicable
- `src/components/prontuario/ProntuarioForm.tsx` - Added optional `serviceId` prop; renders `<MaterialsUsedSection serviceId={serviceId} />` before the submit button

## Decisions Made
- ServiceForm's Dados tab intentionally scopes to the essential `serviceSchema` fields listed above — the remaining optional/nullable schema fields (tussCode, accountId, aliquotaIssOverride, itemListaServicoOverride) are preserved via `defaultValuesFor` (so existing values round-trip on edit) but have no dedicated form control in this plan; a future NFS-e/TISS-focused plan can add them without touching this component's structure.
- `ProntuarioForm` accepts `serviceId` as optional rather than requiring the caller to always pass one, because the current prontuário flow has no procedure-selection step yet (per plan instructions) — this keeps `MaterialsUsedSection` additive and non-breaking.

## Deviations from Plan

None — plan executed exactly as written. All three tasks' acceptance-criteria greps (`listServices`, `Tabs`, `MaterialsTemplateTab`, `createService|updateService`, `listServiceMaterials`, `addServiceMaterial`, `removeServiceMaterial`, "Nenhum material configurado", "Custo estimado de insumos", `return null`, `MaterialsUsedSection` in `ProntuarioForm.tsx`) pass, and `npx tsc --noEmit` reports zero errors in any of the 5 files touched by this plan (pre-existing errors in unrelated `__tests__`/`ofx-parser`/`payout-math` test files are out of scope — not caused by this plan's changes).

## Issues Encountered
None. One note for future maintainers: `MaterialsTemplateTab` and `MaterialsUsedSection` both call `setState` synchronously inside a data-fetching `useEffect` (fetch-on-mount pattern), which `eslint-plugin-react-hooks`'s `set-state-in-effect` rule flags. This mirrors an already-established pattern in the codebase (e.g. `src/components/financeiro/OsSheet.tsx`'s `useEffect` that loads OS detail on open) and is not enforced by any pre-commit hook or `next.config` override — left as-is for consistency with existing conventions rather than introducing a new pattern.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- EST-02's UI surface for D-21/D-22 is complete: admins can configure consumption templates per service, and the prontuário is ready to display them the moment a future plan wires procedure/service selection into the appointment-conclusion flow.
- No blockers for Phase 18 (CRC & Marketing). The `serviceId` prop on `ProntuarioForm` is dormant (no caller passes it yet) — a follow-up plan integrating `appointment_procedures` selection into the prontuário UI should pass it through to activate `MaterialsUsedSection`.

---
*Phase: 17-estoque-materiais*
*Completed: 2026-07-11*

## Self-Check: PASSED

All 5 code files + SUMMARY.md verified present on disk; all 3 task commits (6c8bb53, ec314cf, 20aa093) verified present in git log.
