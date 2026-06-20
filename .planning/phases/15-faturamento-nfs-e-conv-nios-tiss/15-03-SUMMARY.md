---
phase: 15-faturamento-nfs-e-conv-nios-tiss
plan: "03"
subsystem: faturamento
tags: [migration, rls, os, tiss, nfse, zod, schema]
dependency_graph:
  requires: [15-02]
  provides: [insurers, appointment_procedures, service_orders, service_order_items, nfse_records, unit_os_counters, next_os_number, tiss_lotes, tiss_guides, tiss_guide_items, charges-service_order_id-fk, fk_insurer_prices_insurer, rls-all-13-tables, service-order-validators]
  affects: [charges, insurer_prices, unit_os_counters]
tech_stack:
  added: []
  patterns: [SECURITY DEFINER atomic counter, partial unique index, deferred FK, glosa-by-item, WITH CHECK RLS]
key_files:
  created:
    - supabase/migrations/20260620000200_faturamento_os_tables.sql
    - supabase/migrations/20260620000300_faturamento_tiss_tables.sql
    - supabase/migrations/20260620000400_faturamento_rls.sql
    - src/lib/validators/service-order.ts
  modified:
    - supabase/migrations (charges: service_order_id column via ALTER)
    - supabase/migrations (insurer_prices: FK constraint via ALTER)
decisions:
  - "OS write roles include dentist (creates rascunho on conclude); finer faturar gate in Server Action not RLS"
  - "No financeiro role in project RBAC — cadastro write uses admin/superadmin matching phase-14 pattern"
  - "unit_os_counters separate from unit_fiscal_config.proximo_numero_rps (RPS != OS numbering)"
  - "glosa_motivos WITH CHECK = get_my_tenant_id() prevents NULL-clinic ANS seed mutation"
metrics:
  duration: "~6 minutes"
  completed_date: "2026-06-20"
  tasks_completed: 3
  tasks_total: 3
  files_created: 4
  files_modified: 2
requirements: [OS-01, OS-02, OS-03, CONV-01, CONV-02, CONV-03]
---

# Phase 15 Plan 03: OS Domain + TISS Tables + Unified RLS Summary

**One-liner:** 13-table faturamento schema (OS, NFS-e, TISS, glosa-by-item) with atomic per-unit OS numbering, D-27 enums, D-30 idempotency, charges link, deferred insurer_prices FK, and D-18 role-scoped RLS with WITH CHECK everywhere.

---

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | OS tables migration | a659240 | supabase/migrations/20260620000200_faturamento_os_tables.sql |
| 2 | TISS tables + service-order validators | 4e62ce0 | supabase/migrations/20260620000300_faturamento_tiss_tables.sql, src/lib/validators/service-order.ts |
| 3 | Unified RLS for all 13 faturamento tables | 84e5017 | supabase/migrations/20260620000400_faturamento_rls.sql |

---

## What Was Built

### Task 1 — OS Domain Migration (20260620000200)

Six tables created:

- **insurers** (D-26/CONV-01): operadoras de convênio with connector_id, tiss_version, prazo_pagamento_dias, status CHECK ativo/em_negociacao/inativo
- **appointment_procedures** (D-09/OS-01): procedure lines per appointment; base for Phase 17 stock draw
- **service_orders** (D-10/D-12/D-25/D-27/D-30/OS-01): full OS state machine with D-27 enums (rascunho/faturada/cancelada, particular/convenio), two partial unique indexes (appointment_id WHERE NOT NULL for T-15-09; idempotency_key WHERE NOT NULL for D-30/T-15-10)
- **service_order_items** (D-25/D-29): snapshot lines with professional_id for future D-29 repasse, FCAD-02 account_id/cost_center_id classification
- **nfse_records** (D-17/OS-02): D-27 NFS-e status CHECK (processando/emitida/cancelada/erro), ISS fields, storage paths
- **unit_os_counters**: dedicated per-unit OS counter table (separate from RPS counter)

Also created:
- `next_os_number(p_unit_id UUID)` SECURITY DEFINER function returning 'OS-000001' pattern (T-15-11)
- `ALTER TABLE charges ADD COLUMN service_order_id` (OS-03, D-20 caixa path)
- `ALTER TABLE insurer_prices ADD CONSTRAINT fk_insurer_prices_insurer` (deferred FK from Plan 02)

### Task 2 — TISS Tables (20260620000300) + Validators

Three TISS tables:

- **tiss_lotes** (D-22/CONV-02): lote per operadora per competência; D-27 5-value TISS enum
- **tiss_guides** (D-13/D-22/CONV-02): GTO per OS per operadora; valor_glosado cumulative tracking
- **tiss_guide_items** (D-28/CONV-03): item-level glosa with motivo_glosa_id FK, glosa_status CHECK (pendente/glosada/em_recurso/paga)

Validators (`src/lib/validators/service-order.ts`):
- `serviceOrderItemSchema`: uuid fields, isMoney2dp refine, quantity int, FCAD-02 fields
- `serviceOrderSchema`: pagador enum + `.refine` enforcing insurerId required when pagador==='convenio'
- `faturarOsSchema`: billingType enum, installmentCount 1–21 (D-21)
- isMoney2dp re-declared locally; Zod v3, zero `.default()` calls (D-133)

### Task 3 — Unified RLS (20260620000400)

13 tables covered with ENABLE ROW LEVEL SECURITY + 2 policies each (read + write):

- SELECT: `clinic_id = get_my_tenant_id()` on all tables (T-15-07)
- Exception: glosa_motivos SELECT `clinic_id IS NULL OR clinic_id = get_my_tenant_id()` (shared ANS seed)
- WRITE WITH CHECK: every write policy has both USING and WITH CHECK (CLAUDE.md requirement, T-14-02)
- OS tables (service_orders, service_order_items, appointment_procedures): `get_my_role() IN ('dentist', 'receptionist', 'admin', 'superadmin')`
- All other tables: `get_my_role() IN ('admin', 'superadmin')`
- glosa_motivos WITH CHECK: `clinic_id = get_my_tenant_id()` prevents mutation of NULL-clinic ANS rows (T-15-08)

---

## Verification

- `npx vitest run src/__tests__/faturamento/migrations-phase15.test.ts` — **71/71 PASS**
- All D-27 CHECK constraints verbatim per plan note
- 6 CREATE TABLE in 000200, 3 in 000300
- 13 ENABLE ROW LEVEL SECURITY, 17 WITH CHECK in 000400
- `grep -c "\.default(" src/lib/validators/service-order.ts` — 0 (comment line only, no schema .default())

---

## Deviations from Plan

### Auto-resolved

**1. [Rule 2 - Missing critical detail] Role 'financeiro' does not exist in project RBAC**

- **Found during:** Task 3
- **Issue:** Plan note mentions `'financeiro'` as a write role, but proxy.ts has no such role string. The project RBAC uses: `admin`, `superadmin`, `dentist`, `receptionist`, `auditor`, `socio`, `dpo`, `ti`, `aluno`, `patient`.
- **Fix:** Plan itself provides the resolution: "RESOLUTION: match phase-14 (admin/superadmin) for cadastro tables and add dentist/receptionist write only on the three OS tables." Applied exactly.
- **Files modified:** 20260620000400_faturamento_rls.sql

No other deviations — plan executed as specified.

---

## Known Stubs

None. These are pure schema/migration files and validators. No UI rendering paths introduced.

---

## Threat Flags

All threats covered per plan's `<threat_model>`:

| Flag | File | Description |
|------|------|-------------|
| T-15-07 mitigated | 20260620000400 | clinic_id = get_my_tenant_id() on all 13 table SELECT policies |
| T-15-08 mitigated | 20260620000400 | glosa_motivos WITH CHECK = get_my_tenant_id() — NULL-clinic rows immutable |
| T-15-09 mitigated | 20260620000200 | Partial UNIQUE INDEX on service_orders(appointment_id) WHERE NOT NULL |
| T-15-10 mitigated | 20260620000200 | Partial UNIQUE INDEX on service_orders(idempotency_key) WHERE NOT NULL |
| T-15-11 mitigated | 20260620000200 | next_os_number() SECURITY DEFINER SET search_path = public |

---

## Self-Check: PASSED

Files verified:
- supabase/migrations/20260620000200_faturamento_os_tables.sql — FOUND
- supabase/migrations/20260620000300_faturamento_tiss_tables.sql — FOUND
- supabase/migrations/20260620000400_faturamento_rls.sql — FOUND
- src/lib/validators/service-order.ts — FOUND

Commits verified:
- a659240 — feat(15-03): OS domain migration
- 4e62ce0 — feat(15-03): TISS tables + validators
- 84e5017 — feat(15-03): unified RLS
