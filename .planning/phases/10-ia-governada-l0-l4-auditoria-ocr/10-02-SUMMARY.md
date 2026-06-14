---
phase: 10-ia-governada-l0-l4-auditoria-ocr
plan: "02"
subsystem: schema-foundations + rbac
tags: [database, migrations, rls, rbac, ai-governance, ocr, audit]
dependency_graph:
  requires:
    - 10-01 (Wave 0 RED scaffolds — phase10.test.ts defines acceptance criteria)
    - supabase/migrations/20260603000000_initial_schema.sql (audit_logs schema, get_my_tenant_id())
    - supabase/migrations/20260614000600_ai_agent_config.sql (RLS pattern reference)
  provides:
    - supabase/migrations/20260616000100_ai_decision_log.sql
    - supabase/migrations/20260616000200_approval_requests.sql
    - supabase/migrations/20260616000300_ocr_extractions.sql
    - supabase/migrations/20260616000400_audit_logs_indexes.sql
    - src/proxy.ts (conformidade ModuleKey + ROUTE_MODULE_MAP + MODULE_PERMISSIONS)
  affects:
    - Plans 03-05 (all consume these tables; conformidade module gates screens)
    - Plan 06 (BLOCKING db push — will push all 4 migrations)
tech_stack:
  added: []
  patterns:
    - INSERT-only RLS (no client write policy) — mirrors audit_logs; used for ai_decision_log
    - USING + WITH CHECK on write policies — all three new tables
    - Partial unique index WHERE clause — idempotency guard on approval_requests
    - CREATE INDEX IF NOT EXISTS — safe re-run for audit_logs indexes
    - CREATE TABLE IF NOT EXISTS ... PARTITION OF — defensive forward partitions
    - ModuleKey union extension — adding conformidade to proxy.ts RBAC matrix
key_files:
  created:
    - supabase/migrations/20260616000100_ai_decision_log.sql
    - supabase/migrations/20260616000200_approval_requests.sql
    - supabase/migrations/20260616000300_ocr_extractions.sql
    - supabase/migrations/20260616000400_audit_logs_indexes.sql
  modified:
    - src/proxy.ts (conformidade added to ModuleKey, MODULE_PERMISSIONS, ROUTE_MODULE_MAP)
decisions:
  - "ai_decision_log has NO FK on clinic_id — immutable log must survive tenant delete (mirrors audit_logs)"
  - "approval_requests UPDATE policy uses simple tenant scope; alçada enforced in Server Action (required_role is per-row, not static — cannot live in a static policy)"
  - "ocr_extractions includes deleted_at for LGPD soft-delete — extracted_fields may contain CPF/RG PII"
  - "audit_logs_indexes uses IF NOT EXISTS guards — idempotent; defensive 2026-10/11 partitions added (existing 07/08/09 not recreated)"
  - "conformidade placed after /ia in ROUTE_MODULE_MAP — no more-specific sibling (/conformidade/* has single prefix)"
  - "socio/ti/dentist/receptionist/implantacao/aluno/patient: no conformidade access (compliance module scope)"
metrics:
  duration: "~10 minutes"
  completed: "2026-06-14T19:40:00Z"
  tasks_completed: 3
  tasks_total: 3
  files_created: 4
  files_modified: 1
---

# Phase 10 Plan 02: Schema Foundations + RBAC Summary

**One-liner:** 4 SQL migrations (immutable ai_decision_log, unified approval_requests with idempotency, ocr_extractions with LGPD soft-delete, audit_logs indexes + defensive partitions) and conformidade RBAC module wired in proxy.ts.

## What Was Built

### Migration 1: ai_decision_log (AIG-03 — immutable)

`supabase/migrations/20260616000100_ai_decision_log.sql`

Append-only AI decision audit trail. No FK on `clinic_id` (survives tenant delete). No client INSERT/UPDATE/DELETE policy — service-role only via `createAdminClient`. Tenant-scoped SELECT policy. Indexes on `(clinic_id, created_at DESC)` and `(clinic_id, agent_key)`.

### Migration 2: approval_requests (AIG-02 + AUD-02 — unified queue)

`supabase/migrations/20260616000200_approval_requests.sql`

Unified approval inbox serving both AI sensitive-action approval (`type='ai_action'`) and estorno by alçada (`type='estorno'`). Key features:
- Partial unique index `uq_approval_requests_idempotency` on `(clinic_id, idempotency_key) WHERE idempotency_key IS NOT NULL` — prevents double-execution (T-10-08)
- `expires_at` column for 7-day expiry (cron deferred, query-guarded)
- `executed_at` column to mark executed payloads
- RLS: tenant-scoped SELECT + INSERT (any tenant member); UPDATE has USING+WITH CHECK (alçada enforced in Server Action — per-row `required_role` cannot live in static policy)

### Migration 3: ocr_extractions (OCR-02 — review queue)

`supabase/migrations/20260616000300_ocr_extractions.sql`

OCR human-review queue. Fields: `extracted_fields JSONB`, `min_confidence NUMERIC(4,3)`, `status CHECK ('pending_review','approved','committed','rejected')`, `reviewed_by`, `target_table`/`target_id` (pilot: 'patients'), `deleted_at` for LGPD soft-delete (PII in extracted fields). RLS: FOR ALL with USING + WITH CHECK.

### Migration 4: audit_logs indexes + defensive partitions (AUD-01/03 + T-10-10)

`supabase/migrations/20260616000400_audit_logs_indexes.sql`

Two new indexes on the existing partitioned `audit_logs` table (needed for AUD-03 entity/period filtering):
- `idx_audit_logs_table_name ON public.audit_logs(tenant_id, table_name)` — entity type filter
- `idx_audit_logs_record_id ON public.audit_logs(tenant_id, table_name, record_id)` — per-record audit trail

Both use `IF NOT EXISTS` (idempotent). Defensive forward partitions for 2026-10 and 2026-11 using `CREATE TABLE IF NOT EXISTS ... PARTITION OF` — existing 2026-07/08/09 partitions not recreated.

### proxy.ts: conformidade RBAC module (AUD-03 + T-10-09)

`src/proxy.ts`

- `ModuleKey` union extended with `'conformidade'`
- `ROUTE_MODULE_MAP`: `{ prefix: '/conformidade', module: 'conformidade' }` added (placed after `/ia`)
- `MODULE_PERMISSIONS`:
  - `auditor`: `conformidade: { allowed: true, readOnly: true }` — primary module for compliance roles
  - `dpo`: `conformidade: { allowed: true, readOnly: true }`
  - `admin`: `conformidade: { allowed: true }` — read-write
  - `superadmin`: `conformidade: { allowed: true }` — read-write
  - All other roles (socio, ti, dentist, receptionist, implantacao, aluno, patient): no access
- `deriveRoleRoutes()` automatically maps `/conformidade` for admin/superadmin/auditor/dpo; patient ROLE_ROUTES unchanged (`['/paciente', '/perfil']`)

## Verification

- `npx vitest run src/__tests__/migrations/phase10.test.ts` — **38/38 GREEN**
- `src/__tests__/governance/approvals.test.ts -t "conformidade"` — **6/6 GREEN**
- `src/__tests__/proxy/rbac.test.ts` — **34/34 GREEN** (no regressions)
- `src/__tests__/rbac/matrix.test.ts` — **14/14 GREEN** (no regressions)
- `npx tsc --noEmit` — **exit 0** (clean)

Note: `canApprove alçada check` tests (13 tests) remain RED by design — documented in 10-01-SUMMARY as "RED until Plan 03 exports this function." These are Plan 03 targets, not regressions.

## Commits

| Hash | Message |
|------|---------|
| `94d4259` | feat(10-02): add ai_decision_log + approval_requests migrations |
| `1d5b705` | feat(10-02): add ocr_extractions + audit_logs index migrations |
| `0ce1c5f` | feat(10-02): register conformidade RBAC module in proxy.ts |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — this plan creates SQL migration files and TypeScript type additions only. No UI rendering, no application data flow, no hardcoded empty values.

## Threat Flags

No new threat surface beyond what the plan's threat model documents. All three new tables are gated by RLS (`get_my_tenant_id()`). No new network endpoints introduced. The `conformidade` module entry in proxy.ts gates access before any route renders (T-10-09).

## Self-Check: PASSED

- [x] `supabase/migrations/20260616000100_ai_decision_log.sql` — exists, committed in 94d4259
- [x] `supabase/migrations/20260616000200_approval_requests.sql` — exists, committed in 94d4259
- [x] `supabase/migrations/20260616000300_ocr_extractions.sql` — exists, committed in 1d5b705
- [x] `supabase/migrations/20260616000400_audit_logs_indexes.sql` — exists, committed in 1d5b705
- [x] `src/proxy.ts` conformidade — exists, committed in 0ce1c5f
- [x] 38/38 phase10 migration tests GREEN
- [x] 6/6 conformidade proxy assertions GREEN
- [x] 48/48 rbac + matrix tests GREEN (no regressions)
- [x] tsc exit 0
- [x] ai_decision_log has no FOR INSERT/UPDATE/DELETE client policy (immutable)
- [x] Migrations NOT pushed (deferred to Plan 06 [BLOCKING])
