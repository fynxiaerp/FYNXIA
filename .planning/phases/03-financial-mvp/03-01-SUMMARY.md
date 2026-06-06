---
phase: 03-financial-mvp
plan: "01"
subsystem: database
tags: [postgres, supabase, rls, migrations, asaas, lgpd, audit-trail, vitest]

# Dependency graph
requires:
  - phase: 02-clinical-mvp
    provides: "patients table (FK target for receivables/charges), public.audit_table_changes() trigger function (SEC-03), get_my_tenant_id()/get_my_role() SECURITY DEFINER helpers"
  - phase: 01-auth
    provides: "clinics and users tables (FK anchors for tenant isolation)"
provides:
  - "7 financial tables: charges, receivables, financial_transactions, financial_categories, webhook_events, collection_rules, collection_log"
  - "patients.asaas_customer_id column + partial index"
  - "Provider-agnostic columns (provider, provider_charge_id, provider_installment_id) on charges/receivables"
  - "RLS with USING + WITH CHECK on all 6 tenant-scoped tables; webhook_events intentionally RLS-free"
  - "Audit trigger on financial_transactions reusing Phase 2 audit_table_changes()"
  - "seed_financial_categories() trigger seeds 10 default categories on clinic INSERT + backfills existing clinics"
  - "webhook_events dedup via asaas_event_id TEXT NOT NULL UNIQUE (D-07)"
  - "collection_log UNIQUE(receivable_id, milestone, channel) idempotency constraint"
  - "vencido NOT stored — derived at read-time (D-04)"
  - "7 Wave 0 test scaffolds for all Phase 3 plans (financial.test.ts GREEN; 6 others RED-by-design)"
  - "Regenerated database.types.ts with all financial table types"
affects:
  - 03-02-financial-mvp
  - 03-03-financial-mvp
  - 03-04-financial-mvp

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Provider-agnostic financial schema: provider TEXT DEFAULT 'asaas' column enables future Stripe/other gateway columns without DDL changes"
    - "No stored vencido: receivables.status CHECK has ('pendente','pago','estornado') only; vencido computed at query time from due_date vs NOW()"
    - "Idempotency via dedup table: webhook_events.asaas_event_id UNIQUE prevents double-processing duplicate Asaas webhooks"
    - "collection_log UNIQUE(receivable_id, milestone, channel) prevents duplicate sends even on cron re-runs"
    - "Audit reuse: financial_transactions attaches to the already-live audit_table_changes() function from Phase 2 SEC-03 — no new trigger function needed"
    - "Category admin-only writes: financial_categories write policy gated to get_my_role() = 'admin' (D-05)"
    - "Wave 0 RED scaffolds: all Phase 3 test files authored before implementation using existsSync guard + source-inspection pattern"

key-files:
  created:
    - supabase/migrations/20260606000100_financial_tables.sql
    - supabase/migrations/20260606000200_financial_rls.sql
    - supabase/migrations/20260606000300_financial_categories_seed.sql
    - src/__tests__/migrations/financial.test.ts
    - src/__tests__/webhooks/asaas.test.ts
    - src/__tests__/actions/charges.test.ts
    - src/__tests__/actions/transactions.test.ts
    - src/__tests__/collection/ruler.test.ts
    - src/__tests__/pdf/recibo.test.ts
    - src/__tests__/config/security-headers.test.ts
  modified:
    - src/types/database.types.ts

key-decisions:
  - "Provider-agnostic schema (D-01): provider TEXT DEFAULT 'asaas' column on charges/receivables; no Asaas-specific columns in table names, enabling future gateway additions without DDL"
  - "No stored vencido (D-04): status CHECK limited to (pendente, pago, estornado); vencido derived at read-time to prevent clock-skew stale states"
  - "webhook_events has no tenant_id and no RLS (D-07 / T-3-04): service-role-only table; handler uses createAdminClient; accepted risk documented in threat model"
  - "Audit trigger reuse: financial_transactions attaches to the existing audit_table_changes() function from Phase 2 (SEC-03) rather than creating a new one"
  - "Supabase CLI re-auth required before db push: CLI was not logged into the FYNXIA account (org kczvihafddupruvsrrsc); npx supabase login + link was the resolution — recurring gotcha for phase blocking checkpoints"

patterns-established:
  - "Wave 0 RED scaffolds: author ALL phase test files before any implementation using existsSync guards — files that do not exist yet produce failing (not skipped) assertions"
  - "Provider-agnostic columns pattern: provider + provider_charge_id + provider_installment_id on payment tables"
  - "Seed-on-insert pattern: AFTER INSERT trigger on clinics calls seed function; backfill INSERT...SELECT for existing rows"

requirements-completed: [FIN-01, FIN-02, FIN-03, FIN-06]

# Metrics
duration: multi-session (checkpoint at db push)
completed: 2026-06-06
---

# Phase 3 Plan 01: Financial DB Foundation Summary

**7-table provider-agnostic financial schema with RLS, LGPD-compliant audit trail (reusing Phase 2 audit_table_changes()), idempotent dedup primitives, and 10 seeded dental categories — live in Supabase sa-east-1**

## Performance

- **Duration:** Multi-session (blocked at Task 2 db push checkpoint; resumed after Supabase CLI re-auth)
- **Started:** 2026-06-06
- **Completed:** 2026-06-06
- **Tasks:** 3 (Task 0: Wave 0 RED scaffolds, Task 1: 3 migrations TDD GREEN, Task 2: db push + type regen [human-action])
- **Files modified:** 11

## Accomplishments

- Authored 3 SQL migrations (financial tables, RLS policies, category seed) producing 7 new tables in the live Supabase project (jqjwyqlbbuqnrffdnlpp, sa-east-1)
- Established provider-agnostic schema (D-01) with `provider TEXT DEFAULT 'asaas'` column — future Stripe/other gateways add without DDL changes; `vencido` NOT stored anywhere (D-04)
- RLS enabled with both `USING` and `WITH CHECK` on all 6 tenant-scoped tables; `webhook_events` intentionally RLS-free (service-role only); financial_categories write gated to `get_my_role() = 'admin'` (D-05)
- Audit trigger on `financial_transactions` reuses Phase 2 `audit_table_changes()` function (SEC-03) — zero new trigger function code, full LGPD audit trail
- Seeded 10 default categories (4 receita + 6 despesa) for all new AND existing clinics via `seed_financial_categories()` trigger + backfill
- Authored all 7 Wave 0 RED test scaffolds: `financial.test.ts` is 13/13 GREEN post-migration; 6 other scaffolds are RED-by-design and turn GREEN in plans 02/03/04
- Regenerated `database.types.ts` — all 7 financial tables typed; `npx tsc --noEmit` exits 0

## Task Commits

Each task was committed atomically:

1. **Task 0: Wave 0 — 7 RED test scaffolds** - `ea1ef4c` (test)
2. **Task 1: 3 financial migrations (tables + RLS + seed)** - `83e1ce1` (feat)
3. **Task 2: db push + types regenerated** - `da68ce5` (feat)

_Note: Intermediate STATE/ROADMAP doc commit also made: `d9d89b1` (blocked state snapshot before db push checkpoint)_

## Files Created/Modified

- `supabase/migrations/20260606000100_financial_tables.sql` — 7 financial tables, patients.asaas_customer_id amendment, audit trigger on financial_transactions, all indexes
- `supabase/migrations/20260606000200_financial_rls.sql` — RLS ENABLE + USING+WITH CHECK policies on all 6 tenant-scoped tables; webhook_events intentionally excluded
- `supabase/migrations/20260606000300_financial_categories_seed.sql` — seed_financial_categories() trigger function + clinics INSERT trigger + backfill for existing clinics
- `src/__tests__/migrations/financial.test.ts` — 13 assertions (GREEN): all table DDL, provider columns, asaas_customer_id, audit trigger, RLS, no stored vencido, category seed literals, tenant indexes
- `src/__tests__/webhooks/asaas.test.ts` — source-inspects future webhook route (RED until Plan 02)
- `src/__tests__/actions/charges.test.ts` — source-inspects future charges action + PaymentGateway (RED until Plan 02)
- `src/__tests__/actions/transactions.test.ts` — source-inspects future createTransaction action; FIN-02 coverage (RED until Plan 03)
- `src/__tests__/collection/ruler.test.ts` — source-inspects future collection ruler + cron route (RED until Plan 04)
- `src/__tests__/pdf/recibo.test.ts` — source-inspects future ReceiboPDF component (RED until Plan 04)
- `src/__tests__/config/security-headers.test.ts` — asserts next.config.ts security headers presence (RED until Plan 04)
- `src/types/database.types.ts` — regenerated post-db-push; all 7 financial tables typed

## Decisions Made

- **Provider-agnostic schema (D-01):** `provider TEXT DEFAULT 'asaas'` column on `charges` and `receivables` — avoids Asaas lock-in at the schema level. Provider-specific lookup IDs stored as `provider_charge_id`/`provider_installment_id`.
- **No stored vencido (D-04):** `receivables.status CHECK` limited to `('pendente','pago','estornado')`. `vencido` is a display-time derivation (`due_date < NOW() AND status = 'pendente'`). Prevents clock-skew stale states in the DB.
- **webhook_events RLS-free (T-3-04 accepted):** Table has no `tenant_id`, no RLS. Processed exclusively by the service-role webhook handler (Plan 02). Accepted risk; no client path to this table exists.
- **Audit trigger reuse:** `financial_transactions` uses `AFTER INSERT OR UPDATE OR DELETE ... EXECUTE FUNCTION public.audit_table_changes()` — same function authored in Phase 2 for SEC-03. No new trigger code needed.
- **Supabase CLI re-auth documented as recurring gotcha:** db push requires CLI logged into the FYNXIA-owning org (`kczvihafddupruvsrrsc`). Every phase with a `[BLOCKING] db push` checkpoint should include a re-auth step check.

## Deviations from Plan

None — plan executed exactly as written. The human-action checkpoint (Task 2) resolved as expected via Supabase CLI re-auth + db push.

## Issues Encountered

- **Supabase CLI authentication gate (Task 2):** The CLI was not logged into the FYNXIA-owning Supabase account before attempting `npx supabase db push`. Resolution: `npx supabase login` → `npx supabase link --project-ref jqjwyqlbbuqnrffdnlpp` → db push succeeded. This is a recurring pattern for every phase with a `[BLOCKING] db push` checkpoint and is documented in the checkpoint resolution for future executors.

## User Setup Required

Task 2 required the following human action (now complete):
1. `npx supabase login` (re-authenticate CLI to FYNXIA org `kczvihafddupruvsrrsc`)
2. `npx supabase link --project-ref jqjwyqlbbuqnrffdnlpp`
3. `npx supabase db push` (applied migrations `20260606000100/200/300`)
4. `npx supabase gen types typescript --linked > src/types/database.types.ts`

## Next Phase Readiness

**Plan 03-02 (Wave 2) is unblocked.** All schema dependencies are live:
- `public.charges`, `public.receivables`, `public.webhook_events` tables exist in live DB
- `patients.asaas_customer_id` column available for Asaas customer linking
- `database.types.ts` typed — Plan 02 can import table row types immediately
- `src/__tests__/webhooks/asaas.test.ts` and `src/__tests__/actions/charges.test.ts` are RED-and-waiting — Plan 02 implementations will turn them GREEN

**Recurring gotcha for Plan 03-02:** Plan 03-02 has another `[BLOCKING] db push` for Asaas sandbox verification. Ensure Supabase CLI stays authenticated before that checkpoint.

---
*Phase: 03-financial-mvp*
*Completed: 2026-06-06*
