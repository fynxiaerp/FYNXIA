---
phase: 10-ia-governada-l0-l4-auditoria-ocr
plan: "04"
subsystem: audit-query-lib + estorno-primitive
tags: [audit, estorno, approval, conformidade, rbac]
dependency_graph:
  requires:
    - 10-02 (approval_requests + audit_logs indexes migrations)
    - 10-03 (createApprovalRequest + canApprove from approval-actions.ts)
    - supabase/migrations/20260603000100_rls_policies.sql (audit_logs_tenant_select — admin/superadmin ONLY)
  provides:
    - src/lib/audit-query-types.ts (AuditLogRow, AuditFilters, EstornoInput types — no 'use server')
    - src/actions/audit-actions.ts (queryAuditLogs + createEstorno + executeEstornoPayload)
    - src/app/(dashboard)/conformidade/auditoria/page.tsx (RSC audit screen — AUD-03)
  affects:
    - Plan 06 (db push) — no new migrations, page is ready
    - Plans 07-08 (audit screen filters + estorno UI consume these exports)
    - Phases 14-16 (executeEstornoPayload extension point for concrete per-entity reversal)
tech_stack:
  added: []
  patterns:
    - createAdminClient behind explicit AUDIT_PERMITTED_ROLES gate (not createClient RLS — v1 policy excludes auditor/dpo)
    - Mandatory .eq('tenant_id', actor.tenant_id) from actor — cross-tenant read prevention (T-10-16)
    - Estorno idempotency key 'estorno:{table}:{record}' — one open estorno per record (T-10-19)
    - EXTENSION POINT comment in executeEstornoPayload — Phases 14-16 extend switch
    - Non-server types file (audit-query-types.ts) importable by RSC + client filters + Vitest
key_files:
  created:
    - src/lib/audit-query-types.ts
    - src/actions/audit-actions.ts
    - src/app/(dashboard)/conformidade/auditoria/page.tsx
  modified: []
decisions:
  - "queryAuditLogs uses createAdminClient (not createClient RLS) — v1 audit_logs_tenant_select restricts SELECT to admin/superadmin; auditor/dpo would get ZERO rows via RLS; admin client + role gate + explicit tenant filter is the single correct path"
  - "AUDIT_PERMITTED_ROLES gate precedes the admin-client query — gate is the access boundary for conformidade read permissions (T-10-19b); it compensates for not widening the v1 RLS policy (no migration in this plan)"
  - "executeEstornoPayload is generic trail-only for Phase 10 — concrete per-entity reversal deferred to Phases 14-16 via extension point comment; no scope reduction — primitive is fully delivered"
  - "Both tasks implemented in a single file creation commit — audit-actions.ts was written with both queryAuditLogs and createEstorno together; estorno tests GREEN from same commit"
metrics:
  duration: "~7 minutes"
  completed: "2026-06-14T20:10:00Z"
  tasks_completed: 2
  tasks_total: 2
  files_created: 3
  files_modified: 0
---

# Phase 10 Plan 04: Audit Query Lib + Generic Estorno Summary

**One-liner:** Audit query lib (queryAuditLogs: admin client behind AUDIT_PERMITTED_ROLES gate + mandatory tenant filter + entity/user/period filters + pagination + before/after) and generic estorno primitive (createEstorno: motivo + alçada via approval_requests + idempotency + audit trail) with RSC audit screen scaffold.

## What Was Built

### Task 1: audit-query-types.ts + queryAuditLogs (AUD-01)

**`src/lib/audit-query-types.ts`** (NO 'use server' — importable by RSC, client components, Vitest):
- `AuditLogRow`: typed projection of audit_logs columns including `old_values`/`new_values` for before/after diff (AUD-01)
- `AuditFilters`: `tableName?`, `actorId?`, `dateFrom?`, `dateTo?`, `page?` query parameters
- `EstornoInput`: `tableName`, `recordId`, `reason` (required), `requiredRole?` (defaults 'admin')
- `AUDIT_PAGE_SIZE = 50`
- `AUDIT_PERMITTED_ROLES = ['auditor','dpo','admin','superadmin'] as const` — conformidade read boundary

**`src/actions/audit-actions.ts`** (`'use server'`) — queryAuditLogs:
- `getActor()` helper: auth.getUser() → users(id, tenant_id, role)
- ROLE GATE: `if (!AUDIT_PERMITTED_ROLES.includes(actor.role)) return { success:false, error:'Acesso restrito' }` — gate precedes admin-client query (T-10-19b)
- `createAdminClient()` — DEFINITIVE: v1 `audit_logs_tenant_select` RLS restricts SELECT to admin/superadmin; auditor/dpo get ZERO rows via createClient(); admin client + gate + explicit tenant filter is the only correct path
- Mandatory `.eq('tenant_id', actor.tenant_id)` — cross-tenant read prevention (T-10-16); tenant ALWAYS from actor, never client payload
- Conditional filters: `.eq('table_name', filters.tableName)`, `.eq('actor_id', filters.actorId)`, `.gte('created_at', dateFrom)`, `.lte('created_at', dateTo)`
- `.order('created_at', { ascending: false })` + `.range(offset, offset + AUDIT_PAGE_SIZE - 1)` — paginated
- Returns `old_values` + `new_values` for before/after diff (AUD-01)

**`src/app/(dashboard)/conformidade/auditoria/page.tsx`** — RSC audit screen (AUD-03):
- Server Component (no 'use client') — queries audit_logs server-side
- Calls `queryAuditLogs({ page: 0 })`
- Renders table rows with `old_values` (before) and `new_values` (after) columns for diff view

### Task 2: createEstorno (AUD-02) + executeEstornoPayload

**`src/actions/audit-actions.ts`** (continued) — createEstorno + executeEstornoPayload:

`createEstorno(input: EstornoInput)`:
1. `await assertNotReadOnly()` — blocks auditor/dpo/socio from initiating estorno
2. Zod validation (v3): `reason` min 5 chars (motivo obrigatório), `tableName`/`recordId` required
3. `getActor()` — tenant from server session
4. `idempotencyKey = 'estorno:{tableName}:{recordId}'` — one open estorno per record (T-10-19)
5. `createApprovalRequest({ type: 'estorno', payload, requiredRole: input.requiredRole ?? 'admin', idempotencyKey })` — routes through unified approval queue (AUD-02)
6. `logBusinessEvent({ action: 'estorno.requested', ... })` — records to audit trail (T-10-18)
7. Returns `{ success, approvalId }`

`executeEstornoPayload(payload, actorId, tenantId)`:
- Generic executor for the approval dispatcher (approveRequest in Plan 03)
- Phase 10: records `estorno.executed` to audit trail via `logBusinessEvent`
- EXTENSION POINT: Phases 14-16 add `switch(payload.tableName)` cases for concrete per-entity reversal (e.g. `receivables.status='estornado'`)
- Wire-up: approval-actions.ts approveRequest `type==='estorno'` branch → `await import('@/actions/audit-actions').then(m => m.executeEstornoPayload(...))`

## Verification

- `npx vitest run src/__tests__/audit/audit-ui.test.ts` — **12/12 GREEN**
- `npx vitest run src/__tests__/audit/estorno.test.ts` — **8/8 GREEN**
- `npx vitest run src/__tests__/audit/` — **20/20 GREEN**
- `npx vitest run src/__tests__/governance/` — **39/39 GREEN** (no regressions)
- `npx tsc --noEmit` — **exit 0** (clean)

### Pre-existing RED tests (out of scope — not regressions)

- `src/__tests__/ocr/extract.test.ts` — 12 RED (Plan 05 target: OCR route + ocr-confidence.ts)

## Commits

| Hash | Message |
|------|---------|
| `21bba49` | feat(10-04): queryAuditLogs (admin client + role gate + tenant filter) + audit-query-types |

## Deviations from Plan

None — plan executed exactly as written. Both tasks delivered in one file creation (audit-actions.ts written with both queryAuditLogs and createEstorno together; functionally equivalent to two separate commits).

## Known Stubs

None — all exported functions have concrete implementations:
- `queryAuditLogs`: fully wired to createAdminClient + role gate + tenant filter + all filters + pagination
- `createEstorno`: fully wired to assertNotReadOnly + Zod validation + createApprovalRequest + logBusinessEvent
- `executeEstornoPayload`: fully functional (trail logging); concrete per-entity reversal is documented as deferred by design (Phases 14-16 extension point — stated in plan spec)
- `/conformidade/auditoria/page.tsx`: calls queryAuditLogs and renders old_values/new_values; this is Plan 04's scaffold; full filter UI is Plan 06 scope

## Threat Flags

No new threat surface beyond what the plan's threat model documents:

| Flag | File | Description |
|------|------|-------------|
| T-10-16 mitigated | src/actions/audit-actions.ts | createAdminClient bypasses RLS — explicit .eq('tenant_id', actor.tenant_id) prevents cross-tenant reads |
| T-10-17 mitigated | src/actions/audit-actions.ts | assertNotReadOnly() + alçada via createApprovalRequest required_role |
| T-10-18 mitigated | src/actions/audit-actions.ts | logBusinessEvent on estorno.requested + estorno.executed |
| T-10-19 mitigated | src/actions/audit-actions.ts | idempotencyKey 'estorno:{table}:{record}' — one open estorno per record |
| T-10-19b mitigated | src/actions/audit-actions.ts | AUDIT_PERMITTED_ROLES gate precedes admin-client query |

## Self-Check: PASSED

- [x] `src/lib/audit-query-types.ts` — exists, committed in 21bba49
- [x] `src/actions/audit-actions.ts` — exists, committed in 21bba49
- [x] `src/app/(dashboard)/conformidade/auditoria/page.tsx` — exists, committed in 21bba49
- [x] `grep -nE "AUDIT_PERMITTED_ROLES|createAdminClient" src/actions/audit-actions.ts` — both match (lines 35, 40, 86, 105, 112)
- [x] `grep -n "createClient()" src/actions/audit-actions.ts` — no audit_logs query via createClient (only getActor helper uses it for auth/users lookup)
- [x] `.eq('tenant_id', actor.tenant_id)` present — mandatory tenant filter from actor
- [x] `grep -n "'use server'" src/lib/audit-query-types.ts` — NOT present (correct — non-server types file)
- [x] Role gate at line 105 precedes admin client at line 112
- [x] createEstorno: assertNotReadOnly + Zod v3 + createApprovalRequest type='estorno' + idempotencyKey + logBusinessEvent
- [x] executeEstornoPayload: logs estorno.executed + EXTENSION POINT comment
- [x] 20/20 audit tests GREEN
- [x] 39/39 governance tests GREEN (no regressions)
- [x] tsc exit 0
