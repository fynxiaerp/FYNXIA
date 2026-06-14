---
phase: 09-hub-de-integra-es-externas
plan: "03"
subsystem: integration-hub
tags: [hub-log, worker, cron, rbac, fire-and-forget, cas, retry, proxy, integracoes]
dependency_graph:
  requires: [09-02]
  provides:
    - INT-02 GREEN (logToHub fire-and-forget in Asaas + WhatsApp handlers)
    - INT-03 GREEN (drainIntegrationEvents CAS worker + integration-retry cron route)
    - integracoes RBAC module in proxy.ts (admin/ti/superadmin write; auditor/dpo/socio readOnly)
  affects:
    - Plan 09-04 ([BLOCKING] db push — migrations from Plan 02 still pending)
    - Plan 09-05 (UI page imports integracoes module gating; uses drainIntegrationEvents for health)
tech_stack:
  added: []
  patterns:
    - logToHub fire-and-forget (.catch()) — NEVER awaited in 200-response path (T-09-09)
    - Null-safe connector resolution in logToHub — NEVER throws "connector not found"
    - drainIntegrationEvents atomic CAS claim — mirrors drainOutbox exactly
    - integration-retry cron route with isCronAuthorized fail-closed (T-09-11)
    - integracoes ModuleKey + /config/integracoes most-specific-first in ROUTE_MODULE_MAP
key_files:
  created:
    - src/lib/integrations/hub-log.ts
    - src/lib/integrations/worker.ts
    - src/app/api/cron/integration-retry/route.ts
  modified:
    - src/app/api/webhooks/asaas/route.ts
    - src/app/api/webhooks/whatsapp/route.ts
    - src/proxy.ts
    - vercel.json
    - supabase/migrations/20260615000500_integration_events.sql
decisions:
  - D-301: logToHub placed AFTER processWebhookEvent/.catch() and BEFORE return Response 200 — fire-and-forget ensures hub log error cannot suppress the 200 or trigger provider retry floods (T-09-09)
  - D-302: drainIntegrationEvents uses .eq('status','pending') (not .in) on both fetch and CAS guard — matches health.test.ts assertion exactly and keeps CAS logic clean; 'failed'→'pending' requeue deferred to Plan 05 manual reprocess action
  - D-303: /config/integracoes inserted BEFORE /config in ROUTE_MODULE_MAP — most-specific-first mirrors /clinica/documentos pattern; deriveRoleRoutes() maps integracoes→/integracoes in ROLE_ROUTES (acceptable; actual gating uses routeToModule on /config/integracoes)
  - D-304: Migration comment "Do NOT reference message_status / message_channel ENUMs" was causing not.toMatch test failures — fixed by removing the enum names from the comment text (Rule 1 bug fix from Plan 02 artifact)
metrics:
  duration_minutes: 22
  completed_date: "2026-06-14"
  tasks_completed: 3
  tasks_total: 3
  files_created: 3
  files_modified: 5
---

# Phase 9 Plan 03: Hub Wire-up — logToHub + Retry Worker + integracoes RBAC

Fire-and-forget logToHub helper wired additively into Asaas/WhatsApp handlers, atomic CAS drainIntegrationEvents worker mirroring drainOutbox, integration-retry Vercel Cron route, and integracoes module added to proxy.ts RBAC matrix.

## What Was Built

**Task 1 — hub-log.ts + additive handler calls:**

- `src/lib/integrations/hub-log.ts`: `logToHub()` server-only async function. Null-safe connector resolution (`.maybeSingle()` with `.or()` filter; falls back to `connector_id = null` if no row found — never throws). Inserts into `integration_events` with IDs/type/status only (T-09-14). Protected by `import 'server-only'`.
- `src/app/api/webhooks/asaas/route.ts`: Added `logToHub({...}).catch(...)` AFTER `processWebhookEvent(...).catch(...)`, BEFORE `return new Response('', { status: 200 })`. Strictly additive — zero changes to token check, dedup upsert, processWebhookEvent call, or 200 response.
- `src/app/api/webhooks/whatsapp/route.ts`: Added `logToHub({...}).catch(...)` AFTER `processInbound(...).catch(...)`, BEFORE `return new Response('', { status: 200 })`. Strictly additive — zero changes to HMAC check, 23505 dedup, processInbound call, or 200 response.
- `supabase/migrations/20260615000500_integration_events.sql`: Removed enum names from migration comment that inadvertently triggered `not.toMatch(/message_status/)` and `not.toMatch(/message_channel/)` assertions (Rule 1 fix).

**Task 2 — worker + cron + vercel.json:**

- `src/lib/integrations/worker.ts`: `drainIntegrationEvents()` server-only. Selects `.eq('status','pending')` only. Atomic CAS claim: `.eq('status','pending').eq('attempts', row.attempts)` on UPDATE — only one concurrent drain wins; 0 rows returned = skip (T-09-12). Per-row try/catch; marks 'processed' on success, 'failed'/'pending' on error based on max_attempts. Mirrors drainOutbox CAS pattern exactly.
- `src/app/api/cron/integration-retry/route.ts`: `export const runtime = 'nodejs'` (T-09-15). `isCronAuthorized()` fail-closed 401 before any DB work (T-09-11). Calls `drainIntegrationEvents()` and returns JSON result.
- `vercel.json`: Added `{ "path": "/api/cron/integration-retry", "schedule": "*/15 * * * *" }` to `crons` array.

**Task 3 — integracoes module in proxy.ts:**

- `ModuleKey` type extended with `'integracoes'`.
- `MODULE_PERMISSIONS`: superadmin, admin, ti → `integracoes: {allowed:true}`; auditor, dpo, socio → `integracoes: {allowed:true, readOnly:true}`; dentist, receptionist, patient, implantacao, aluno → no change.
- `ROUTE_MODULE_MAP`: `{ prefix: '/config/integracoes', module: 'integracoes' }` inserted BEFORE `{ prefix: '/config', ... }` — most-specific-first, mirrors /clinica/documentos pattern (T-09-13).

## Test Results

```
webhooks.test.ts (INT-02):          31 passed / 31 — ALL GREEN
health.test.ts (INT-03):            20 passed / 20 — ALL GREEN (was 9/20 after Plan 02)
proxy/rbac.test.ts:                 22 passed / 22 — ALL GREEN
rbac/matrix.test.ts:                26 passed / 26 — ALL GREEN
webhooks/asaas.test.ts (regression):  8 passed / 8  — ALL GREEN
comms/whatsapp.test.ts (regression): 7 passed / 7   — ALL GREEN
Total:                             114 passed / 114

tsc --noEmit:   exit 0 (clean)
next build:     clean (only harmless Turbopack lockfile warning)
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Migration comment text matched not.toMatch() test assertions**
- **Found during:** Task 1 test run
- **Issue:** `supabase/migrations/20260615000500_integration_events.sql` line 4 contained the text "message_status / message_channel ENUMs" in a developer comment. The webhooks.test.ts assertions `expect(sql).not.toMatch(/message_status/)` and `expect(sql).not.toMatch(/message_channel/)` match anywhere in the file, so the comment caused 2 test failures.
- **Fix:** Replaced "Do NOT reference message_status / message_channel ENUMs from message_outbox" with "Do NOT reference outbox ENUMs from message_outbox" — semantically identical, avoids the triggering strings.
- **Files modified:** `supabase/migrations/20260615000500_integration_events.sql`
- **Commit:** c1c49dc

## Known Stubs

None. No UI components created. No data-flowing UI stubs.

## Threat Flags

All threats in the plan's `<threat_model>` are fully mitigated:

| Threat | Mitigation Applied |
|--------|-------------------|
| T-09-09 Denial of Service (hub log in webhook handlers) | logToHub is fire-and-forget `.catch()`, NEVER awaited in 200-response path; hub-log DB error logs to console only |
| T-09-10 Tampering (webhook regression) | Strictly additive edits; all 3 regression tests (asaas + whatsapp + webhooks) assert existing lines still present |
| T-09-11 Spoofing (cron endpoint) | `isCronAuthorized` constant-time CRON_SECRET compare, fail-closed when unset |
| T-09-12 Tampering (overlapping cron double-processing) | CAS: `.eq('status','pending').eq('attempts', row.attempts)` — only one drain wins |
| T-09-13 Elevation of Privilege (/config/integracoes) | proxy MODULE_PERMISSIONS + most-specific ROUTE_MODULE_MAP ordering; x-read-only for auditor/dpo/socio |
| T-09-14 Information Disclosure (secret in hub log) | logToHub inserts only IDs/type/status/last_error — no payload bodies or credentials |
| T-09-15 Tampering (Edge runtime on cron) | `export const runtime = 'nodejs'` on integration-retry route |

No new threat surface beyond the plan's threat model.

## Self-Check: PASSED

Files exist:
- `src/lib/integrations/hub-log.ts` — FOUND
- `src/lib/integrations/worker.ts` — FOUND
- `src/app/api/cron/integration-retry/route.ts` — FOUND

Commits exist:
- `c1c49dc` feat(09-03): add hub-log.ts + additive logToHub calls in Asaas/WhatsApp handlers
- `33ae826` feat(09-03): add drainIntegrationEvents worker + integration-retry cron route + vercel.json schedule
- `c7010db` feat(09-03): add integracoes module to proxy.ts (ModuleKey + ROUTE_MODULE_MAP + MODULE_PERMISSIONS)
