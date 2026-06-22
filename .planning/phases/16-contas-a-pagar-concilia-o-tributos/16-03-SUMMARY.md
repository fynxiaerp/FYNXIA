---
phase: 16
plan: 03
subsystem: financeiro/contas-a-pagar/repasse/rpa/reinf/conciliacao
tags: [migrations, professional-payouts, rpa, reinf, competencia, rls, alters, next-rpa-number]
dependency_graph:
  requires: [16-01, 16-02]
  provides: [payout-rpa-schema, phase16-alters, phase16-rls]
  affects: [16-05, 16-06, 16-07, 16-08, 16-09, 16-10]
tech_stack:
  added: []
  patterns: [security-definer-atomic-counter, insert-on-conflict-counter-init, rls-write-by-role-admin-superadmin, tax-tables-read-only-rls, deferred-fk-alter-pattern]
key_files:
  created:
    - supabase/migrations/20260621000300_payout_rpa_tables.sql
    - supabase/migrations/20260621000500_phase16_alters.sql
    - supabase/migrations/20260621000600_phase16_rls.sql
  modified: []
decisions:
  - next_rpa_number mirrors next_os_number exactly (INSERT ON CONFLICT DO NOTHING + UPDATE RETURNING) — atomic, no MAX+1 race (T-16-08/Pitfall 2)
  - reinf_event_id and payout_id kept as plain UUID in their source tables; forward-ref FKs added in alters file after both target tables exist
  - integration_connectors_type_check dropped (auto-named inline constraint) and re-added as named constraint with reinf + open_finance
  - tax tables (inss/irrf/iss) get SELECT USING(true) only — no authenticated write policy; service role bypasses RLS for migrations/seed (T-16-09)
  - financeiro write roles = admin/superadmin only (no distinct financeiro role in RBAC enum per proxy.ts — D-23/Open Question 3 resolved)
metrics:
  duration: "4 minutes"
  completed: "2026-06-22"
  tasks: 3
  files: 3
requirements: [FOP-03, TRIB-01, TRIB-02, TRIB-03]
---

# Phase 16 Plan 03: Payout/RPA/Reinf Tables + ALTERs + RLS Summary

3 migration files: 6 payout/RPA/Reinf/competência tables verbatim from RESEARCH DDL, ALTERs on 4 existing tables with atomic `next_rpa_number()` SECURITY DEFINER, and full write-by-role RLS across all 15 Phase 16 tables (12 tenant-scoped + 3 global tax reference). 50/50 tests GREEN.

---

## What Was Done

### Task 1 — payout/rpa/reinf/competência tables (commit 8442e35)

Created `supabase/migrations/20260621000300_payout_rpa_tables.sql` with 6 tables verbatim from RESEARCH lines 555-650 + 392-408:

- `professional_payouts` (TRIB-01): deducoes JSONB, valor_base/percentual/valor_repasse, status CHECK (rascunho/aprovado/pago), UNIQUE(clinic_id, professional_id, competencia), idx_payouts_clinic + idx_payouts_professional
- `payout_items` (TRIB-01): payout_id CASCADE, service_order_id + statement_line_id SET NULL FKs, idx_payout_items_payout + idx_payout_items_clinic
- `rpa_records` (TRIB-02): supplier_id ON DELETE RESTRICT, valor_inss/irrf/iss/liquido, aliquotas, pdf_storage_path with D-27 comment (NUNCA retornar ao cliente; signed URL TTL=60s), reinf_event_id plain UUID with deferred FK comment, UNIQUE INDEX idx_rpa_numero ON (clinic_id, numero)
- `reinf_events` (TRIB-03): tipo CHECK ('R2010','R4020'), payload JSONB, idempotency_key, UNIQUE(clinic_id, idempotency_key)
- `unit_rpa_counters` (D-26): unit_id PRIMARY KEY, last_rpa_number INT DEFAULT 0
- `competencia_fechamentos` (D-26): UNIQUE(clinic_id, unit_id, competencia), idx_competencia_clinic

### Task 2 — ALTERs + next_rpa_number + forward-ref FKs (commit 7abc8a4)

Created `supabase/migrations/20260621000500_phase16_alters.sql`:

- `financial_transactions`: ADD reconciliation_status TEXT NOT NULL DEFAULT 'pendente' CHECK (pendente/baixado/conciliado) + statement_line_id UUID FK; partial index idx_ft_reconciliation_status WHERE != 'conciliado'
- `bank_accounts`: ADD data_abertura DATE + saldo_atual NUMERIC(12,2) NOT NULL DEFAULT 0
- `professionals`: ADD supplier_id UUID REFERENCES suppliers ON DELETE SET NULL
- `integration_connectors`: DROP integration_connectors_type_check + ADD named constraint including 'reinf' and 'open_finance'
- `payables.payout_id` forward-ref FK: fk_payables_payout → professional_payouts(id) ON DELETE SET NULL
- `rpa_records.reinf_event_id` forward-ref FK: fk_rpa_reinf_event → reinf_events(id) ON DELETE SET NULL
- `next_rpa_number(p_unit_id UUID)` SECURITY DEFINER: mirrors next_os_number exactly — INSERT ON CONFLICT DO NOTHING to init counter, UPDATE last_rpa_number = last_rpa_number + 1 RETURNING, returns 'RPA-' || LPAD(seq,6,'0')

### Task 3 — RLS write-by-role for all 15 Phase 16 tables (commit 37f3268)

Created `supabase/migrations/20260621000600_phase16_rls.sql`:

- 12 tenant-scoped tables (suppliers, payables, payable_installments, recorrente_templates, bank_statements, statement_lines, professional_payouts, payout_items, rpa_records, reinf_events, unit_rpa_counters, competencia_fechamentos): ENABLE RLS + SELECT USING (clinic_id = get_my_tenant_id()) + ALL USING+WITH CHECK (clinic_id = get_my_tenant_id() AND get_my_role() IN ('admin','superadmin'))
- 3 global tax reference tables (inss_tax_tables, irrf_tax_tables, iss_tax_tables): ENABLE RLS + SELECT USING (true); NO authenticated write policy — service role bypasses RLS for seed/migrations

---

## Final Verification

```
Tests  50 passed (50 total)
```

- 50 GREEN: all Phase 16 migration assertions (payables/reconciliation/payout/rpa/reinf/tax/alters/next_rpa_number/RLS)
- Progression: 28 GREEN (after Plan 02) → 50 GREEN (after Plan 03) — +22 assertions turned GREEN

---

## Deviations from Plan

None — plan executed exactly as written. The integration_connectors inline-unnamed CHECK drop-and-recreate pattern was anticipated in the plan ("verify the exact constraint name during execution"); PostgreSQL auto-names it `integration_connectors_type_check`, which matches the DROP CONSTRAINT IF EXISTS call.

---

## Known Stubs

None. This plan creates only DDL migration files. No application code stubs.

---

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: PII | 20260621000300_payout_rpa_tables.sql | rpa_records stores valor_inss/irrf/iss (tax retention data linked to CPF/CNPJ); RLS USING (clinic_id = get_my_tenant_id()) provides tenant isolation (T-16-06) |
| threat_flag: PII | 20260621000300_payout_rpa_tables.sql | reinf_events.payload JSONB may contain CNPJ/CPF; same RLS isolation backstop |

T-16-06 (cross-tenant read): mitigated by RLS USING clinic_id on all 12 tenant tables.
T-16-07 (read-only role write): mitigated by absence of write policy for auditor/dpo/socio.
T-16-08 (RPA number race): mitigated by next_rpa_number SECURITY DEFINER atomic INSERT-ON-CONFLICT + UPDATE RETURNING.
T-16-09 (tenant mutating tax tables): mitigated by SELECT-only RLS for authenticated; no write policy present.

---

## Self-Check: PASSED

Files confirmed present:
- supabase/migrations/20260621000300_payout_rpa_tables.sql — FOUND (commit 8442e35)
- supabase/migrations/20260621000500_phase16_alters.sql — FOUND (commit 7abc8a4)
- supabase/migrations/20260621000600_phase16_rls.sql — FOUND (commit 37f3268)

Commits confirmed:
- 8442e35 feat(16-03): professional_payouts/payout_items/rpa_records/reinf_events/unit_rpa_counters/competencia_fechamentos migration — FOUND
- 7abc8a4 feat(16-03): ALTERs + next_rpa_number SECURITY DEFINER + forward-ref FKs — FOUND
- 37f3268 feat(16-03): RLS write-by-role for all 15 Phase 16 tables — FOUND
