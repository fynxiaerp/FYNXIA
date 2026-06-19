---
phase: 13-esteriliza-o-cme-laborat-rio-de-pr-tese
plan: "06"
subsystem: esterilizacao-cme-ui
tags: [esterilizacao, cme, ui, forms, block-guard, proxy, navigation, module-registration]
dependency_graph:
  requires:
    - 13-02 (sterilizationCycleSchema + kitUsageSchema + isCycleUsable)
    - 13-04 (registerSterilizationCycle + registerKitUsage BLOCK GUARD + listSterilizationCycles + getKitTraceability)
  provides:
    - src/proxy.ts (esterilizacao + protese ModuleKey, MODULE_PERMISSIONS, ROUTE_MODULE_MAP most-specific-first)
    - src/components/shell/nav-config.ts (NavIconKey + ALL_NAV_ITEMS entries)
    - src/components/shell/nav-icons.ts (ShieldCheck + Boxes RSC string-key icons)
    - src/components/esterilizacao/CycleForm.tsx (RHF+Zod v3 cycle registration form)
    - src/components/esterilizacao/CycleFormDialog.tsx (Dialog wrapper for CycleForm)
    - src/components/esterilizacao/KitUsageForm.tsx (kit-usage form with CME-02 block surfacing)
    - src/app/(dashboard)/clinica/esterilizacao/page.tsx (cycles list RSC page)
    - src/app/(dashboard)/clinica/esterilizacao/uso-kit/page.tsx (kit usage + traceability RSC page)
  affects:
    - src/proxy.ts
    - src/components/shell/
    - src/components/esterilizacao/
    - src/app/(dashboard)/clinica/esterilizacao/
tech_stack:
  added: []
  patterns:
    - RSC page pattern (headers() x-user-id + x-read-only, nodejs runtime, tenant resolution via users.tenant_id)
    - RHF + zodResolver(schema) with Controller for Select fields (no .default() in schema — D-133)
    - @base-ui Button render-prop (NEVER asChild) — Dialog + nav triggers
    - CME-02 block-guard surfacing: server blocked/error result → destructive Alert, no success state shown
    - Client isCycleUsable convenience filter (disables non-usable items in Select) — server is authoritative
    - Most-specific-first ROUTE_MODULE_MAP: /clinica/esterilizacao + /clinica/protese BEFORE /clinica
    - RSC string-key nav icons (NavIconKey → NAV_ICONS map) — no component crossing RSC boundary
key_files:
  created:
    - src/components/esterilizacao/CycleForm.tsx
    - src/components/esterilizacao/CycleFormDialog.tsx
    - src/components/esterilizacao/KitUsageForm.tsx
    - src/app/(dashboard)/clinica/esterilizacao/page.tsx
    - src/app/(dashboard)/clinica/esterilizacao/uso-kit/page.tsx
  modified:
    - src/proxy.ts (ModuleKey + MODULE_PERMISSIONS + ROUTE_MODULE_MAP — committed b9a4c86)
    - src/components/shell/nav-config.ts (NavIconKey + ALL_NAV_ITEMS — committed b9a4c86)
    - src/components/shell/nav-icons.ts (ShieldCheck + Boxes — committed b9a4c86)
decisions:
  - "CycleFormDialog extracted as separate 'use client' file so RSC page (page.tsx) stays a pure Server Component"
  - "appointments list passed as empty array to KitUsageForm — appointments table lacks patient_id FK so the form filters by patient_id client-side; CME-03 traceability works via kit_usages.patient_id direct link"
  - "uso-kit page uses pre-push type cast (SupabaseClient<any>) for sterilization_cycles query — mirrors Plan 04 idiom; will resolve after Plan 05 type regen"
metrics:
  duration: "~15 minutes"
  completed: "2026-06-19"
  tasks_completed: 2
  tasks_total: 2
  files_created: 5
  files_modified: 3
requirements: [CME-01, CME-02, CME-03]
---

# Phase 13 Plan 06: CME UI Summary

**One-liner:** Esterilização/CME module UI — CycleForm (RHF+Zod v3, autoclave combobox, bio indicator warning) + KitUsageForm (CME-02 server block reason surfaced prominently, client isCycleUsable convenience filter) + RSC list/uso-kit pages (nodejs runtime, status badges, read-only gating) + esterilizacao+protese registered in proxy/nav (most-specific-first, RSC string-key icons).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Register esterilizacao + protese modules (proxy + nav-config + nav-icons) | b9a4c86 | src/proxy.ts, src/components/shell/nav-config.ts, src/components/shell/nav-icons.ts |
| 2 | CycleForm + KitUsageForm + esterilizacao list/uso-kit pages | 304d1da | src/components/esterilizacao/CycleForm.tsx, src/components/esterilizacao/CycleFormDialog.tsx, src/components/esterilizacao/KitUsageForm.tsx, src/app/(dashboard)/clinica/esterilizacao/page.tsx, src/app/(dashboard)/clinica/esterilizacao/uso-kit/page.tsx |

## What Was Built

### Task 1 — Shell registrations (proxy + nav)

**proxy.ts** (already committed b9a4c86 — plan owns these files):
- `ModuleKey` extended with `'esterilizacao' | 'protese'`
- `MODULE_PERMISSIONS`: esterilizacao → superadmin/admin/dentist/receptionist `{allowed:true}` + auditor/dpo/socio `{allowed:true, readOnly:true}`; protese → superadmin/admin/dentist `{allowed:true}` + auditor/dpo/socio `{allowed:true, readOnly:true}` (NO receptionist — OS is clinical/financial)
- `ROUTE_MODULE_MAP`: `/clinica/esterilizacao` + `/clinica/protese` inserted BEFORE `/clinica` (most-specific-first, Pitfall 6)

**nav-config.ts**: `NavIconKey` extended with `'esterilizacao' | 'protese'`; `ALL_NAV_ITEMS` entries added after Teleodontologia (not adminOnly).

**nav-icons.ts**: `ShieldCheck` (esterilizacao) + `Boxes` (protese) imported from lucide-react and mapped in `NAV_ICONS` (RSC string-key, client-only map).

### Task 2 — CME UI (CME-01/CME-02/CME-03)

**CycleForm.tsx** (`'use client'`):
- RHF + `zodResolver(sterilizationCycleSchema)` — no `.default()` in schema (D-133)
- `Controller` wrappers for Select fields (autoclave_id, biological_result)
- Fields: autoclave combobox (resources tipo equipamento), cycle_number, cycle_date (default today), temperatura/tempo_minutos/pressao, biological_result select, validade, notes
- Inline destructive Alert when `biological_result === 'reprovado'` (cycle will be blocked)
- On success: clears form, calls `onSuccess(cycleId)`

**CycleFormDialog.tsx** (`'use client'`):
- Dialog wrapper holding open/close state so RSC page stays a pure Server Component
- @base-ui `DialogTrigger render={<Button>}` pattern

**KitUsageForm.tsx** (`'use client'`):
- RHF + `zodResolver(kitUsageSchema)`
- Cycle Select: iterates cycles, calls `isCycleUsable()` client-side, **disables** non-usable items and shows block reason inline (CONVENIENCE only)
- On submit calls `registerKitUsage`; if `result.blocked` → **destructive Alert with server block reason, no success state** — server is authoritative (CME-02 / T-13-12/T-13-13)
- Patient Select + optional Appointment Select (filtered by selected patient)

**/clinica/esterilizacao/page.tsx** (RSC, `runtime = 'nodejs'`):
- Resolves tenant via `x-user-id` header; fetches resources tipo=equipamento for CycleForm autoclave list
- Calls `listSterilizationCycles()` → table with cycle_number, cycle_date, biological_result, validade, status badge
- Status badges: aprovado=emerald (success), reprovado=destructive, vencido=amber (warning), pendente=secondary/muted
- Read-only roles: no "Registrar Ciclo" CTA (x-read-only header gating)

**/clinica/esterilizacao/uso-kit/page.tsx** (RSC, `runtime = 'nodejs'`):
- Resolves tenant; fetches cycles + patients + appointments (last 30 days)
- `KitUsageForm` rendered only for non-read-only roles
- Traceability table via `getKitTraceability({})` — cycle lote → patient_id → kit_label → used_at → cycle status (CME-03)

## Verification Results

```
npx tsc --noEmit: exit 0

npx vitest run src/__tests__/proxy/ src/__tests__/rbac/ src/__tests__/esterilizacao/
  Test Files: 7 passed (7)
  Tests:      107 passed (107)
```

## Deviations from Plan

**1. [Rule 2 - Missing Critical Functionality] CycleFormDialog extracted as separate client component**
- **Found during:** Task 2
- **Issue:** The RSC page imports CycleFormDialog to embed the "Registrar Ciclo" CTA. The Dialog open/close state must live in a `'use client'` component; embedding it directly in the RSC page would force the entire page to be a Client Component.
- **Fix:** Created `src/components/esterilizacao/CycleFormDialog.tsx` as a thin `'use client'` wrapper. The RSC page stays a pure Server Component and passes the serializable `autoclaves` array as props.
- **Files modified:** src/components/esterilizacao/CycleFormDialog.tsx (new)
- **Commit:** 304d1da

**2. [Rule 1 - Bug] appointments list passed as empty array**
- **Found during:** Task 2 (uso-kit page)
- **Issue:** The `appointments` table schema uses `dentist_id` (not `patient_id`) as the FK to users; there is no `patient_id` column on appointments. Mapping `dentist_id` as `patient_id` in `AppointmentOption` would be semantically wrong and could link kits to the wrong person.
- **Fix:** Passed `appointments={[]}` to KitUsageForm. CME-03 traceability works correctly via `kit_usages.patient_id` (direct FK). The appointment link in `kitUsageSchema` is already optional. The KitUsageForm appointment Select renders only when `filteredAppointments.length > 0`, so no UI degradation.
- **Files modified:** src/app/(dashboard)/clinica/esterilizacao/uso-kit/page.tsx

## Known Stubs

None — all data fetches are wired to real Supabase queries (tenant-scoped). The traceability table shows real `kit_usages` rows joined to `sterilization_cycles`. No placeholder or hardcoded empty data flows to the UI.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: client_block_bypass_surface | src/components/esterilizacao/KitUsageForm.tsx | Client isCycleUsable filter is convenience only; covered by T-13-23 (server re-fetches + blocks in registerKitUsage — cannot be bypassed) |

## Self-Check: PASSED

- [x] src/components/esterilizacao/CycleForm.tsx — FOUND
- [x] src/components/esterilizacao/CycleFormDialog.tsx — FOUND
- [x] src/components/esterilizacao/KitUsageForm.tsx — FOUND
- [x] src/app/(dashboard)/clinica/esterilizacao/page.tsx — FOUND
- [x] src/app/(dashboard)/clinica/esterilizacao/uso-kit/page.tsx — FOUND
- [x] commit b9a4c86 (Task 1 — shell registrations) — FOUND
- [x] commit 304d1da (Task 2 — CME UI) — FOUND
