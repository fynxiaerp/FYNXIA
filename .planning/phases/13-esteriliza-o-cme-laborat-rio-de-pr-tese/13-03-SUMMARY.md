---
phase: 13-esteriliza-o-cme-laborat-rio-de-pr-tese
plan: "03"
subsystem: protese-lab
tags: [protese, lab, migration, database, financial, rls, lab-order, validators, zod]
dependency_graph:
  requires:
    - 13-01 (RED scaffolds — lab-cost.test.ts + migrations-phase13-lab.test.ts)
  provides:
    - prosthetic_labs table + RLS (LAB-01)
    - lab_orders table + financial_transaction_id FK + RLS (LAB-01/LAB-02 foundation)
    - isCostPostable + buildLabExpenseDescription pure helpers (Plan 04 consumes)
    - labSchema + labOrderSchema Zod v3 validators (Plan 04 consumes)
  affects:
    - supabase/migrations/
    - src/lib/protese/
    - src/lib/validators/
tech_stack:
  added: []
  patterns:
    - RLS separate SELECT + ALL-write policies (USING+WITH CHECK — CLAUDE.md mandate)
    - clinic_id indexed on every new table
    - financial_transaction_id FK on lab_orders pointing AT financial_transactions (no ALTER on that table)
    - Zod v3 schema with no .default() (D-133)
    - PURE helpers — no 'use server' / 'server-only' (client+server importable)
key_files:
  created:
    - supabase/migrations/20260619000300_prosthetic_labs.sql
    - supabase/migrations/20260619000400_lab_orders_rls.sql
    - src/lib/protese/lab-cost.ts
    - src/lib/validators/lab-order.ts
  modified: []
decisions:
  - "financial_transaction_id is a FK column ON lab_orders pointing AT financial_transactions(id) — financial_transactions itself is NOT altered (T-13-11 accepted; Plan 04 inserts the despesa row)"
  - "RLS write policy gated to admin/superadmin/dentist (T-13-09); SELECT open to all clinic members (T-13-08)"
  - "labOrderSchema stages is optional array (not required) — forms default to empty array via RHF defaultValues, not Zod .default() (D-133)"
  - "buildLabExpenseDescription returns 'OS protética {orderNumber} — {prosthesisType} ({labName})' — pt-BR, includes all three test-asserted substrings"
metrics:
  duration: "~4 minutes"
  completed: "2026-06-19"
  tasks_completed: 2
  tasks_total: 2
  files_created: 4
  files_modified: 0
---

# Phase 13 Plan 03: LAB Migrations + Libs Summary

**One-liner:** prosthetic_labs + lab_orders tables (stages JSONB, status enviado/prova/concluido, financial_transaction_id FK — D-03/D-04) with RLS USING+WITH CHECK; isCostPostable + buildLabExpenseDescription PURE helpers; labSchema + labOrderSchema Zod v3 validators — 39 tests GREEN, tsc clean.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | LAB migrations — prosthetic_labs + lab_orders + RLS | a91ec26 | 20260619000300_prosthetic_labs.sql, 20260619000400_lab_orders_rls.sql |
| 2 | lab-cost pure helpers + lab/lab-order Zod schemas | 411abfd | src/lib/protese/lab-cost.ts, src/lib/validators/lab-order.ts |

## What Was Built

### Task 1 — LAB Migrations

**20260619000300_prosthetic_labs.sql:**
- `public.prosthetic_labs`: clinic_id (FK→clinics), nome, cnpj, contato_nome, telefone, email, notes, deleted_at (LGPD soft delete)
- `public.lab_orders`: clinic_id (FK→clinics), unit_id (FK→units), lab_id (FK→prosthetic_labs), patient_id (FK→patients), appointment_id (FK→appointments), order_number, prosthesis_type, due_date, stages JSONB DEFAULT '[]', status CHECK (enviado/prova/concluido), cost NUMERIC(12,2), **financial_transaction_id** UUID REFERENCES financial_transactions(id) (D-04 LAB-02 link), notes, created_by (FK→users), deleted_at
- Indexes: idx_prosthetic_labs_clinic; idx_lab_orders_clinic/lab/patient/status/unit (partial)/fin_txn (partial)

**20260619000400_lab_orders_rls.sql:**
- prosthetic_labs: ENABLE RLS + SELECT policy (get_my_tenant_id()) + ALL-write policy (admin/superadmin/dentist) with USING+WITH CHECK
- lab_orders: same RLS pattern
- financial_transactions RLS NOT touched (existing tenant_id policy applies to Plan 04 despesa INSERT)

### Task 2 — Pure Helpers + Validators

**src/lib/protese/lab-cost.ts** (PURE):
- `isCostPostable(cost: number | null): boolean` — false for null/0/negative; true for positive
- `buildLabExpenseDescription({ labName, prosthesisType, orderNumber }): string` — returns `"OS protética {orderNumber} — {prosthesisType} ({labName})"`

**src/lib/validators/lab-order.ts** (Zod v3, no .default()):
- `labSchema`: nome (required, max 200), cnpj/contato_nome/telefone/email/notes (optional)
- `labStageSchema`: nome (required), prevista/concluida_em (optional date strings)
- `labOrderSchema`: lab_id/patient_id (uuid required), prosthesis_type (required), appointment_id/unit_id (uuid optional), order_number/due_date/notes (optional), status enum (enviado/prova/concluido), stages array (optional), cost nonnegative (optional)
- Exports: `LabInput`, `LabStageInput`, `LabOrderInput` inferred types

## Verification Results

```
vitest run src/__tests__/protese/ src/__tests__/esterilizacao/regression-guard-phase13.test.ts
  Test Files: 3 passed (3)
  Tests:      39 passed (39)

tsc --noEmit: exit 0
```

Test breakdown:
- migrations-phase13-lab.test.ts: 27 passed (prosthetic_labs + lab_orders + RLS assertions)
- lab-cost.test.ts: 7 passed (isCostPostable 4 cases + buildLabExpenseDescription 3 substrings)
- regression-guard-phase13.test.ts: 5 passed (no ALTER appointments / DROP financial_transactions)

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — this plan produces migrations and pure library code. No UI rendering paths; no placeholder data.

## Threat Flags

None — no new network endpoints or auth paths introduced. New DB tables are gated by RLS (T-13-08/T-13-09). The financial_transaction_id FK is an inert column until Plan 04 populates it.

## Self-Check: PASSED

- [x] supabase/migrations/20260619000300_prosthetic_labs.sql — FOUND
- [x] supabase/migrations/20260619000400_lab_orders_rls.sql — FOUND
- [x] src/lib/protese/lab-cost.ts — FOUND
- [x] src/lib/validators/lab-order.ts — FOUND
- [x] commit a91ec26 — FOUND
- [x] commit 411abfd — FOUND
