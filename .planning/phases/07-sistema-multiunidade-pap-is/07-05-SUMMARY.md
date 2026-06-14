---
phase: "07"
plan: "05"
subsystem: empresa-config-ui
tags: [sys-01, role-02, empresa, units, config, rbac, server-actions, rhf, zod, design-system]
dependency_graph:
  requires:
    - "07-02: units table + clinic_id schema live"
    - "07-03: MODULE_PERMISSIONS matrix + assertNotReadOnly() + x-read-only header"
    - "07-04: db push applied all migrations; database.types.ts regenerated with regime_tributario + units"
  provides:
    - "src/lib/validators/empresa.ts: empresaSchema (CNPJ/CPF cpf-cnpj-validator refine + regime_tributario enum)"
    - "src/lib/validators/unit.ts: unitSchema (slug regex + ativo + optional CNPJ validation)"
    - "src/actions/empresa.ts: getEmpresa + saveEmpresa (assertNotReadOnly + admin gate + logBusinessEvent)"
    - "src/actions/units.ts: listUnits + createUnit + updateUnit (assertNotReadOnly + admin gate + actor.tenant_id + default-unit guard)"
    - "src/app/(dashboard)/config/empresa/page.tsx: SYS-01 admin-gated Server Component with PageHeader + EmpresaForm + UnitsManager"
    - "src/components/config/EmpresaForm.tsx: RHF + zodResolver empresa form with regime_tributario Select"
    - "src/components/config/UnitsManager.tsx: shadcn Table + Dialog CRUD + ativo Switch (default unit protected)"
    - "src/__tests__/config/empresa.test.ts: 28 tests covering schema + source-inspection security assertions"
  affects:
    - "Plan 06: certificate upload page can share same config route layout"
    - "Plans 07+: all mutation Server Actions call assertNotReadOnly() per this plan's pattern"
tech_stack:
  added: []
  patterns:
    - "empresaSchema: z.refine(cnpj.isValid || cpf.isValid) — single-field CNPJ/CPF with cpf-cnpj-validator"
    - "Server Action pattern: assertNotReadOnly() first → zod.safeParse → getActor → role gate → supabase → logBusinessEvent"
    - "clinic_id always from actor.tenant_id in unit mutations — never from client input (T-07-16)"
    - "Select from @base-ui/react/select wired to RHF via Controller (value/onValueChange)"
    - "Page role gate: non-admin sees in-page Alert (no redirect) — v1 UI convention"
    - "UnitsManager: local useState for dialog + useTransition for ativo toggle optimistic updates"
key_files:
  created:
    - src/lib/validators/empresa.ts
    - src/lib/validators/unit.ts
    - src/actions/empresa.ts
    - src/actions/units.ts
    - src/app/(dashboard)/config/empresa/page.tsx
    - src/components/config/EmpresaForm.tsx
    - src/components/config/UnitsManager.tsx
    - src/__tests__/config/empresa.test.ts
  modified: []
decisions:
  - "Select wired to RHF via Controller (not FormField render-prop) — base-ui Select.Root uses value/onValueChange props not standard input events"
  - "EmpresaForm uses Alert for feedback (no sonner) — consistent with CollectionRulerForm v1 pattern; sonner not in package.json"
  - "UnitsManager uses local React state + useTransition for ativo toggle — nuqs/Zustand not warranted for simple dialog + toggle at this screen size"
  - "No migration, no db push — regime_tributario already live from Plan 02; types already regenerated in Plan 04"
metrics:
  duration_minutes: 45
  tasks_completed: 3
  tasks_total: 3
  files_created: 8
  files_modified: 0
  completed_date: "2026-06-14"
---

# Phase 07 Plan 05: Empresa & Unidades Config UI (SYS-01) Summary

Admin-gated config screen for rede (empresa) CNPJ/CPF + regime tributário + units (filiais) CRUD, wired to assertNotReadOnly-guarded Server Actions that persist to existing clinics.regime_tributario column and the units table (both live since Plan 04 db push).

---

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Validators + Server Actions for empresa + units | 70b8f93 | src/lib/validators/empresa.ts, src/lib/validators/unit.ts, src/actions/empresa.ts, src/actions/units.ts |
| 2 | Empresa page + EmpresaForm + UnitsManager UI | 10f1d51 | src/app/(dashboard)/config/empresa/page.tsx, src/components/config/EmpresaForm.tsx, src/components/config/UnitsManager.tsx |
| 3 | Tests for empresa/units validation + read-only gate | 83cdb57 | src/__tests__/config/empresa.test.ts |

---

## Verification

- `npx vitest run src/__tests__/config/empresa.test.ts` → 28 PASS (GREEN)
- `npx tsc --noEmit` → exit 0 (clean, after each task)
- `npx next build` → green; `/config/empresa` appears in route list
- No raw `slate-`/`gray-`/`text-white`/`bg-white` Tailwind classes in new UI files (grep returns none)
- No migration file added; no `supabase db push` run
- `assertNotReadOnly()` present in both action files (empresa.ts + units.ts)
- `actor.tenant_id` used for `clinic_id` in createUnit/updateUnit (never from input)
- Default unit deactivation guard present in updateUnit

---

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

### Implementation Notes

**1. Alert instead of sonner for feedback**
- **Found during:** Task 2 — EmpresaForm
- **Issue:** Plan specified "sonner" for toasts, but `sonner` is not in package.json (not installed in the project)
- **Fix:** Used `<Alert>` from shadcn/ui (same pattern as CollectionRulerForm v1 — the established convention in this codebase)
- **Impact:** Functionally equivalent; consistent with existing UI patterns

**2. Controller instead of FormField for regime_tributario Select**
- **Found during:** Task 2 — EmpresaForm
- **Issue:** The @base-ui Select.Root uses `value`/`onValueChange` props (not standard `ref`-based onChange events), so shadcn `FormField` render-prop doesn't wire the field correctly without special handling
- **Fix:** Used RHF `Controller` directly for the Select field (value/onValueChange wired explicitly), which is the correct pattern for non-input primitives in RHF + @base-ui

---

## Known Stubs

None — all data flows are wired. EmpresaForm loads initial data from `getEmpresa()` (real DB). UnitsManager loads from `listUnits()` (real DB). Mutations persist to live Supabase tables.

---

## Threat Flags

All mitigations from plan's threat model applied:

| Threat | Mitigation Applied |
|--------|-------------------|
| T-07-15 (non-admin mutation) | assertNotReadOnly() first in saveEmpresa/createUnit/updateUnit; role gate ['admin','superadmin'] |
| T-07-16 (client-supplied clinic_id) | clinic_id set from actor.tenant_id in createUnit/updateUnit; input clinic_id never accepted |
| T-07-17 (malformed CNPJ/regime) | empresaSchema: cpf-cnpj-validator refine + regime z.enum; unitSchema: cnpj.isValid refine |

---

## Self-Check

| Check | Result |
|-------|--------|
| src/lib/validators/empresa.ts exists | FOUND |
| src/lib/validators/empresa.ts contains regime | FOUND |
| src/lib/validators/unit.ts exists | FOUND |
| src/lib/validators/unit.ts contains slug | FOUND |
| src/lib/validators/unit.ts contains ativo | FOUND |
| src/actions/empresa.ts exists | FOUND |
| src/actions/empresa.ts contains assertNotReadOnly | FOUND |
| src/actions/empresa.ts contains regime_tributario | FOUND |
| src/actions/empresa.ts contains logBusinessEvent | FOUND |
| src/actions/units.ts exists | FOUND |
| src/actions/units.ts contains assertNotReadOnly | FOUND |
| src/actions/units.ts contains actor.tenant_id | FOUND |
| src/actions/units.ts contains logBusinessEvent | FOUND |
| src/app/(dashboard)/config/empresa/page.tsx exists | FOUND |
| page.tsx contains PageHeader | FOUND |
| page.tsx contains Acesso restrito | FOUND |
| page.tsx contains getEmpresa | FOUND |
| page.tsx contains listUnits | FOUND |
| src/components/config/EmpresaForm.tsx contains zodResolver | FOUND |
| src/components/config/EmpresaForm.tsx contains saveEmpresa | FOUND |
| src/components/config/EmpresaForm.tsx contains regime | FOUND |
| src/components/config/UnitsManager.tsx contains createUnit | FOUND |
| src/components/config/UnitsManager.tsx contains updateUnit | FOUND |
| src/components/config/UnitsManager.tsx contains ativo | FOUND |
| src/components/config/UnitsManager.tsx contains is_default | FOUND |
| src/__tests__/config/empresa.test.ts exists | FOUND |
| 28 tests GREEN | CONFIRMED |
| commit 70b8f93 | FOUND |
| commit 10f1d51 | FOUND |
| commit 83cdb57 | FOUND |
| No supabase/migrations file added in this plan | CONFIRMED |

## Self-Check: PASSED
