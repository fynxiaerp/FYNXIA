---
phase: 15-faturamento-nfs-e-conv-nios-tiss
plan: "02"
subsystem: faturamento-catalog
tags: [migration, seed, validators, billing, nfse, tiss]
requires: [14-02, 14-03]
provides: [services, insurer_prices, unit_fiscal_config, glosa_motivos, serviceSchema, insurerSchema]
affects: [15-03, 15-04, 15-05, 15-06]
tech-stack:
  added: []
  patterns: [AFTER INSERT trigger seed, deferred cross-file FK via ALTER TABLE, isMoney2dp refine, Zod v3 no .default()]
key-files:
  created:
    - supabase/migrations/20260620000100_faturamento_catalog_tables.sql
    - supabase/migrations/20260620000500_faturamento_seed.sql
    - src/lib/validators/service.ts
    - src/lib/validators/insurer.ts
  modified: []
decisions:
  - insurer_prices deferred FK pattern: column insurer_id UUID NOT NULL exists in 000100; ALTER TABLE ADD CONSTRAINT emitted at end of 000200 (OS tables) to avoid forward reference
  - glosa_motivos clinic_id nullable: NULL = ANS system-wide shared codes (public reference, no PII); non-NULL = per-clinic custom codes
  - seed_faturamento_services trigger name alphabetically after seed_accounts_on_clinic: PostgreSQL fires AFTER triggers in alphabetical order; chart-of-accounts guaranteed present when services seed fires
metrics:
  duration_seconds: 256
  completed_date: "2026-06-20"
  tasks_completed: 2
  files_created: 4
  files_modified: 0
---

# Phase 15 Plan 02: Catalog & Fiscal-Config Layer Summary

**One-liner:** 4-table billing catalog (services/insurer_prices/unit_fiscal_config/glosa_motivos) with ANS Tabela 38 seed + per-tenant dental catalog trigger + Zod v3 service/insurer validators.

---

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Catalog & fiscal-config migration (4 tables) | 3f7d997 | supabase/migrations/20260620000100_faturamento_catalog_tables.sql |
| 2 | Seed (ANS motivos + dental services) + validators | b4bb316 | supabase/migrations/20260620000500_faturamento_seed.sql, src/lib/validators/service.ts, src/lib/validators/insurer.ts |

---

## What Was Built

### Migration 000100 — 4 catalog/fiscal tables

**`unit_fiscal_config`** (D-16): per-unit NFS-e emitente configuration — CNPJ, município IBGE code, RPS series, próximo número, alíquota ISS padrão (NUMERIC(5,4) DEFAULT 0.05), código LC 116 (DEFAULT '11.02'), regime_emissao CHECK ('competencia'|'caixa'). UNIQUE(unit_id).

**`services`** (D-04/D-05): clinic-scoped service catalog — name, code, tuss_code (optional TUSS terminologia), valor_particular NUMERIC(12,2), account_id FK → chart_of_accounts ON DELETE SET NULL, aliquota_iss_override and item_lista_servico_override for per-service ISS overrides. Partial unique index `idx_services_code` WHERE code IS NOT NULL.

**`insurer_prices`** (D-06): operadora × serviço × valor price overrides — UNIQUE(insurer_id, service_id). insurer_id column exists without inline FK (deferred to Plan 03 migration 000200).

**`glosa_motivos`** (D-14): ANS rejection motivo seed target — clinic_id NULLABLE (NULL = shared ANS reference data). Indexes on clinic_id.

### Migration 000500 — seed

**Part A:** 21 ANS Tabela 38 system-wide glosa motivos inserted with clinic_id=NULL. Idempotent via `WHERE NOT EXISTS (SELECT 1 FROM public.glosa_motivos WHERE clinic_id IS NULL)` + `ON CONFLICT DO NOTHING` subquery pattern.

**Part B:** `seed_faturamento_services()` SECURITY DEFINER function + `AFTER INSERT ON public.clinics` trigger named `seed_services_on_clinic`. Seeds 12 default dental services per new tenant: Consulta (80.00), Profilaxia (120.00), Restauração resina (180.00), Endodontia (700.00), Exodontia (200.00), Raspagem periodontal (250.00), Clareamento (600.00), Prótese total (1200.00), Coroa unitária (1500.00), Radiografia periapical (50.00), Selante (90.00), Aplicação de flúor (70.00). Backfill INSERT…SELECT covers existing clinics (NOT EXISTS guard on clinic_id).

### Validators

**`src/lib/validators/service.ts`**: `serviceSchema` (name/code/tussCode/description/valorParticular/accountId/aliquotaIssOverride/itemListaServicoOverride/ativo) + `insurerPriceSchema` (insurerId/serviceId/valor). Both use local `isMoney2dp` refine on money fields (T-15-03). No `.default()`.

**`src/lib/validators/insurer.ts`**: `insurerSchema` (name/cnpj/registroAns/tissVersion/prazoPagamentoDias/contatoEmail/contatoPhone/connectorId/status enum). Status enum: 'ativo'|'em_negociacao'|'inativo' (T-15-06). No `.default()`.

---

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Deferred FK on insurer_prices.insurer_id | insurers table created in 000200 (Plan 03); 000100 runs first; ALTER TABLE ADD CONSTRAINT emitted at end of 000200 to avoid forward reference error |
| glosa_motivos clinic_id nullable | clinic_id NULL = ANS system-wide shared reference data (public, no PII — T-15-05 accepted); per-clinic custom codes use non-NULL clinic_id |
| seed trigger name `seed_services_on_clinic` | Alphabetically after `seed_accounts_on_clinic` (Phase 14); PostgreSQL fires AFTER triggers in alphabetical order per event; guarantees chart_of_accounts seeded before services on same clinic INSERT |
| 21 ANS motivos (not 15) | RESEARCH §"ANS Tabela 38" boundary codes 1001/9901 present; fuller coverage reduces per-clinic manual configuration |

---

## Deviations from Plan

None — plan executed exactly as written. The deferred FK pattern for insurer_prices.insurer_id was specified in the plan and implemented as instructed.

---

## Verification Results

- `grep -c "CREATE TABLE public\." 20260620000100...` → 4
- `grep "REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL"` → present
- `grep "CHECK (regime_emissao IN ('competencia', 'caixa'))"` → present
- `grep "aliquota_iss_padrao NUMERIC(5,4)"` → present, `grep "DEFAULT '11.02'"` → present
- `grep "CREATE UNIQUE INDEX idx_services_code"` + `"WHERE code IS NOT NULL"` → present
- glosa_motivos.clinic_id: no NOT NULL constraint → confirmed nullable
- Deferred FK comment in both 000100 and 000200 placeholder → present
- `npx vitest run migrations-phase15.test.ts -t "seed"` → 4 passed, 67 skipped
- `npx tsc --noEmit` → 0 errors on service.ts and insurer.ts
- `grep -c "\.default(" service.ts insurer.ts` → only in JSDoc comments, 0 in code

---

## Known Stubs

None — this plan creates DDL + seed data + validators. No UI or data-wiring stubs.

---

## Threat Flags

No new network endpoints or auth paths introduced. All new surface is database-internal (tables, triggers, functions) and TypeScript validators. Threat model items T-15-03 through T-15-06 are mitigated as designed.

## Self-Check: PASSED

- `supabase/migrations/20260620000100_faturamento_catalog_tables.sql` — FOUND
- `supabase/migrations/20260620000500_faturamento_seed.sql` — FOUND
- `src/lib/validators/service.ts` — FOUND
- `src/lib/validators/insurer.ts` — FOUND
- Commit 3f7d997 — FOUND
- Commit b4bb316 — FOUND
