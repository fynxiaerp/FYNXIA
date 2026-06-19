---
phase: 13-esteriliza-o-cme-laborat-rio-de-pr-tese
plan: "07"
subsystem: protese-lab-ui
tags: [protese, lab, ui, forms, financial, status, lab-order, LAB-01, LAB-02]
dependency_graph:
  requires:
    - 13-03 (labSchema + labOrderSchema + labStageSchema + isCostPostable)
    - 13-04 (createLab + updateLab + createLabOrder + setLabOrderCost + updateLabOrderStatus + listLabOrders + listLabs)
    - 13-06 (protese module registered in proxy + nav; /clinica/protese route live)
  provides:
    - src/components/protese/LabForm.tsx (lab supplier CRUD form)
    - src/components/protese/LabOrderForm.tsx (OS form with stages useFieldArray)
    - src/components/protese/LabOrderStatusBar.tsx (status control + cost posting, LAB-02 double-post locked)
    - src/components/protese/LabFormDialog.tsx (client wrapper for RSC pages)
    - src/components/protese/LabOrderFormDialog.tsx (client wrapper for RSC pages)
    - src/components/protese/LabOrderStatusBarDialog.tsx (client wrapper for RSC pages)
    - src/app/(dashboard)/clinica/protese/page.tsx (OS list RSC page)
    - src/app/(dashboard)/clinica/protese/laboratorios/page.tsx (labs list RSC page)
  affects:
    - src/components/protese/
    - src/app/(dashboard)/clinica/protese/
tech_stack:
  added: []
  patterns:
    - RHF + zodResolver(schema) with Controller for Select fields; no .default() in schemas (D-133)
    - useFieldArray for stages JSONB array editor (add/remove rows)
    - Client Dialog wrappers (LabFormDialog, LabOrderFormDialog, LabOrderStatusBarDialog) keep RSC pages pure Server Components
    - LabOrderStatusBar: local state tracks posted status post-action without page refresh; locks cost UI once financial_transaction_id set (T-13-27)
    - @base-ui Button render-prop (NEVER asChild) — all Dialog triggers, form submits, action buttons
    - RSC page pattern (headers() x-read-only + x-user-id, nodejs runtime, tenant resolution via users.tenant_id)
    - isCostPostable client-side gate for "Lançar no Financeiro" CTA enable; server is authoritative backstop
key_files:
  created:
    - src/components/protese/LabForm.tsx
    - src/components/protese/LabOrderForm.tsx
    - src/components/protese/LabOrderStatusBar.tsx
    - src/components/protese/LabFormDialog.tsx
    - src/components/protese/LabOrderFormDialog.tsx
    - src/components/protese/LabOrderStatusBarDialog.tsx
    - src/app/(dashboard)/clinica/protese/page.tsx
    - src/app/(dashboard)/clinica/protese/laboratorios/page.tsx
  modified: []
decisions:
  - "Three Dialog wrappers (LabFormDialog, LabOrderFormDialog, LabOrderStatusBarDialog) extracted as 'use client' files — RSC pages remain pure Server Components; serializable props passed from page"
  - "appointments passed as empty array to LabOrderFormDialog — mirrors CME KitUsageForm decision (appointments table has no patient_id FK); appointment link in labOrderSchema is optional so no UI degradation"
  - "LabOrderStatusBar tracks posted state locally after setLabOrderCost success — avoids requiring a page refresh to show the locked indicator; financial_transaction_id from props seeds initial state"
  - "LabOrderStatusBarDialog closes on onUpdate — user re-opens to see refreshed server state after status/cost change; no client-side invalidation needed at this stage"
metrics:
  duration: "~12 minutes"
  completed: "2026-06-19"
  tasks_completed: 2
  tasks_total: 2
  files_created: 8
  files_modified: 0
requirements: [LAB-01, LAB-02]
---

# Phase 13 Plan 07: Laboratório de Prótese UI Summary

**One-liner:** Laboratório de Prótese UI — LabForm (RHF+Zod v3, CNPJ/contato/email) + LabOrderForm (useFieldArray stages editor, lab/patient selects, cost hint) + LabOrderStatusBar (enviado→prova→concluído Select + cost-posting CTA locked once financial_transaction_id set, LAB-02 double-post prevention) + RSC OS list page (status Badge + Lançado/— financeiro indicator) + RSC laboratorios page — build green, 50 tests GREEN, no proxy/nav edits.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | LabForm + LabOrderForm (stages editor) + LabOrderStatusBar (status + cost-posting) | 17dd29c | src/components/protese/LabForm.tsx, LabOrderForm.tsx, LabOrderStatusBar.tsx |
| 2 | protese OS list page + laboratorios cadastro page + Dialog wrappers | 1fe581e | src/app/(dashboard)/clinica/protese/page.tsx, laboratorios/page.tsx, LabFormDialog.tsx, LabOrderFormDialog.tsx, LabOrderStatusBarDialog.tsx |

## What Was Built

### Task 1 — Components (LAB-01 / LAB-02)

**LabForm.tsx** (`'use client'`):
- RHF + `zodResolver(labSchema)` — no `.default()` (D-133)
- Fields: `nome` (required), `cnpj`, `contato_nome`, `telefone`, `email`, `notes`
- Calls `createLab` on create, `updateLab(id)` on edit (id prop)
- shadcn Alert for error/success (pt-BR)
- @base-ui Button render-prop

**LabOrderForm.tsx** (`'use client'`):
- RHF + `zodResolver(labOrderSchema)` — no `.default()` (D-133)
- Props: `labs`, `patients`, `appointments` (optional)
- `useFieldArray` for `stages` JSONB array — add/remove rows with `nome` + `prevista` date
- `lab_id`, `patient_id`, `appointment_id` via `Controller` + shadcn Select
- `status` Select defaulting to `'enviado'`; `prosthesis_type` required text; `order_number` optional
- `cost` number input with hint: "Definir o custo lança uma despesa no módulo financeiro (LAB-02)"
- Calls `createLabOrder`; shows cost-posted confirmation in success message
- Appointments filtered by selected patient_id; hidden if empty array

**LabOrderStatusBar.tsx** (`'use client'`):
- Props: `order` (id, status, cost, financial_transaction_id, lab_name, prosthesis_type, order_number)
- Status header: prosthesis_type + order_number + lab_name + status Badge
- Status Select: enviado/prova/concluído — calls `updateLabOrderStatus(order.id, next)` with null guard
- Cost section (LAB-02 / T-13-27):
  - `financial_transaction_id` set (from props OR after post) → locked green indicator "Lançado no financeiro: R$ X" — NO re-post CTA
  - Not yet posted → number input + "Lançar no Financeiro" button enabled only when `isCostPostable(value)` → calls `setLabOrderCost(order.id, value)`; on success transitions to locked state locally; on error shows destructive Alert

### Task 2 — RSC Pages + Dialog Wrappers

**protese/page.tsx** (RSC, `runtime = 'nodejs'`):
- Resolves tenant via `x-user-id`; fetches patients (tenant-scoped), labs (`listLabs`), orders (`listLabOrders`)
- Table: N.º OS | Paciente | Laboratório | Tipo | Prazo | Status Badge | Financeiro column
- Financeiro column: `CheckCircle2 Lançado` (emerald) when `financial_transaction_id` set, else `Minus —`
- "Abrir OS" CTA → `LabOrderFormDialog` (hidden for read-only roles)
- Per-row "Gerenciar" → `LabOrderStatusBarDialog` (hidden for read-only roles)
- Link to `/clinica/protese/laboratorios` always visible
- EmptyState with CTA for non-read-only roles

**protese/laboratorios/page.tsx** (RSC, `runtime = 'nodejs'`):
- Fetches `listLabs()`; table: nome | contato_nome | telefone | email
- "Cadastrar laboratório" CTA → `LabFormDialog` (hidden for read-only roles)
- EmptyState with CTA

**Dialog wrappers** (`'use client'`):
- `LabFormDialog` — wraps LabForm; trigger: @base-ui Button "Cadastrar Laboratório"
- `LabOrderFormDialog` — wraps LabOrderForm; passes labs/patients/appointments props; trigger: "Abrir OS"
- `LabOrderStatusBarDialog` — wraps LabOrderStatusBar; passes serializable order; trigger: "Gerenciar"
- All wrappers use `Dialog open/onOpenChange` state; close on `onSuccess`/`onUpdate`

## Verification Results

```
npx tsc --noEmit: exit 0

npx vitest run src/__tests__/protese/
  Test Files: 3 passed (3)
  Tests:      50 passed (50)

npx next build:
  ├ ƒ /clinica/protese
  └ ƒ /clinica/protese/laboratorios
  Build: green (no errors)
```

## Deviations from Plan

**1. [Rule 2 - Missing Critical Functionality] Three Dialog wrappers extracted as separate client components**
- **Found during:** Task 2
- **Issue:** RSC pages must remain pure Server Components. Embedding open/close Dialog state directly in a Server Component is not possible — it would force the entire page to become a Client Component.
- **Fix:** Created `LabFormDialog`, `LabOrderFormDialog`, and `LabOrderStatusBarDialog` as thin `'use client'` wrappers (same pattern as CycleFormDialog in Plan 06). RSC pages pass serializable props.
- **Files created:** LabFormDialog.tsx, LabOrderFormDialog.tsx, LabOrderStatusBarDialog.tsx
- **Commit:** 1fe581e

**2. [Rule 1 - Bug] appointments passed as empty array to LabOrderFormDialog**
- **Found during:** Task 2
- **Issue:** The appointments table uses `dentist_id` (not `patient_id`) as its FK to users — there is no `patient_id` column on appointments. Passing appointment data with a wrong semantic mapping could link OS to the wrong person.
- **Fix:** Passed `appointments={[]}` to LabOrderFormDialog. The `appointment_id` field in `labOrderSchema` is optional, and the form hides the appointment Select when the array is empty — no UI degradation. Mirrors the identical decision made in Plan 06 for KitUsageForm.
- **Files modified:** src/app/(dashboard)/clinica/protese/page.tsx

## Known Stubs

None — all data fetches are wired to real Supabase queries via server actions (tenant-scoped). No placeholder or hardcoded empty data flows to UI rendering. The cost-posting path calls `setLabOrderCost` which calls `postLabExpense` → real `financial_transactions` insert + `lab_orders.financial_transaction_id` backfill.

## Threat Flags

None — all threat mitigations from the plan's `<threat_model>` are implemented:
- T-13-27 (double-post): LabOrderStatusBar locks cost UI once `financial_transaction_id` set; server backstop in `setLabOrderCost` (Plan 04)
- T-13-28 (elevation of privilege): read-only gating via `x-read-only` header hides all mutation CTAs
- T-13-29 (cross-tenant): RSC pages query tenant-scoped; RLS (Plan 03) is DB backstop
- T-13-30 (read-only mutation via form): `x-read-only` hides CTAs; `assertNotReadOnly()` is action backstop

## Self-Check: PASSED

- [x] src/components/protese/LabForm.tsx — FOUND
- [x] src/components/protese/LabOrderForm.tsx — FOUND
- [x] src/components/protese/LabOrderStatusBar.tsx — FOUND
- [x] src/components/protese/LabFormDialog.tsx — FOUND
- [x] src/components/protese/LabOrderFormDialog.tsx — FOUND
- [x] src/components/protese/LabOrderStatusBarDialog.tsx — FOUND
- [x] src/app/(dashboard)/clinica/protese/page.tsx — FOUND
- [x] src/app/(dashboard)/clinica/protese/laboratorios/page.tsx — FOUND
- [x] commit 17dd29c (Task 1) — FOUND
- [x] commit 1fe581e (Task 2) — FOUND
