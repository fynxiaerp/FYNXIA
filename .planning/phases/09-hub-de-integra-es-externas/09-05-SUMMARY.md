---
phase: 09-hub-de-integra-es-externas
plan: "05"
subsystem: integration-hub
tags: [ui, rsc, rbac, health, reprocess, masked-credential, server-action, rHF, zod]
dependency_graph:
  requires: [09-04]
  provides:
    - INT-01 COMPLETE (connector registry + register/edit form UI — management surface live)
    - INT-03 COMPLETE (health panel + reprocess UI — monitoring surface live)
    - /config/integracoes RSC page (RBAC-gated, 6 roles, data loaded server-side)
  affects:
    - Phase 09 COMPLETE (all 5 plans delivered — INT-01, INT-02, INT-03)
tech_stack:
  added: []
  patterns:
    - RSC passes only serializable plain arrays (connectors/health) — no functions/server objects across boundary (T-09-25)
    - ConnectorPublic type (Omit<ConnectorRow,'credential_enc'>) ensures credential_enc never compiles into client path
    - credential_masked rendered in ConnectorList; credential input is type="password" write-only field
    - reprocessConnector: assertNotReadOnly() FIRST, then role gate, then fetch-filter-update pattern (cannot compare columns inline in Supabase JS)
    - listConnectorHealth: reads integration_events (status/created_at/last_error only), calls deriveHealth — no payload bodies, no credential_enc
    - Select from shadcn/ui (which uses @base-ui/react/select internally) — NO asChild, uses onValueChange render-prop pattern
    - useTransition for non-blocking server action calls + router.refresh() for RSC rehydration
key_files:
  created:
    - src/actions/integration-events.ts
    - src/app/(dashboard)/config/integracoes/page.tsx
    - src/components/config/IntegrationsManager.tsx
  modified:
    - src/__tests__/integrations/health.test.ts (extended with Plan 05 UI source-inspection assertions)
decisions:
  - D-501: reprocessConnector fetches failed rows then filters in JS (r.attempts < r.max_attempts) — Supabase JS cannot compare two columns inline in a single query
  - D-502: UI source-inspection tests assert not.toMatch(/credential_enc/) on IntegrationsManager source — any mention of the ciphertext column in the client file (even in comments) fails the test; comments in the client file must not reference the column name
  - D-503: listConnectorHealth groups events by connector_id in JS (Map) after a single tenant-scoped query — avoids N+1 queries per connector
  - D-504: health badge uses variant mapping (ok→default, degraded→outline, failed→destructive, unknown→secondary) — aligns with shadcn Badge variants without raw color classes
  - D-505: Reprocess button shown only when failedCount > 0 — avoids misleading UX for healthy connectors; server-side gate is still authoritative
metrics:
  duration_minutes: 7
  completed_date: "2026-06-14"
  tasks_completed: 2
  tasks_total: 2
  files_created: 3
  files_modified: 1
---

# Phase 9 Plan 05: /config/integracoes UI — Connector Registry + Masked Form + Health Panel + Reprocess

RBAC-gated `/config/integracoes` RSC page with connector registry list, write-only masked credential register/edit form, per-connector health panel (ok/degraded/failed/unknown via deriveHealth), and manual reprocess action that re-queues failed→pending for the cron worker — credential never reaches the client.

## What Was Built

**Task 1 — integration-events.ts server action:**

- `src/actions/integration-events.ts`: `'use server'`; exports `ConnectorHealthView` interface + `listConnectorHealth` + `reprocessConnector`.
- `listConnectorHealth()`: reads integration_events (last 24h, tenant-scoped via admin client) — selects only status/created_at/last_error/connector_id (never payload bodies or credential); groups by connector_id in JS; calls `deriveHealth()` per connector; returns `ConnectorHealthView[]` with lastError (error message string, not a payload).
- `reprocessConnector(connectorId)`: `assertNotReadOnly()` FIRST; role gate `['admin','superadmin','ti']`; fetches failed rows + JS filter `attempts < max_attempts`; bulk-updates eligible IDs to `status: 'pending'`; `logBusinessEvent` with connectorId + requeued count only.
- `src/__tests__/integrations/health.test.ts`: extended with 3 describe blocks (integration-events.ts source-inspection, IntegrationsManager.tsx source-inspection, /config/integracoes page source-inspection) — 14 new assertions.

**Task 2 — RSC page + client manager:**

- `src/app/(dashboard)/config/integracoes/page.tsx`: Server Component; auth gate; role gate (6 permitted roles: admin/superadmin/ti/auditor/dpo/socio); loads `listConnectors()` + `listConnectorHealth()` server-side; passes plain serializable arrays to `<IntegrationsManager>` (RSC rule — no functions/server objects across boundary).
- `src/components/config/IntegrationsManager.tsx`: `'use client'`; connector list (type label, status badge, `credential_masked` — masked tail only, never `credential_enc`); register form (RHF + Zod v3, type Select, password credential input, status Select); edit form (credential optional, shows masked current value); health panel (health badge with token-driven variant, failedCount, lastError truncated, Reprocess button with `useTransition`); `router.refresh()` on success for RSC rehydration.

## Test Results

```
health.test.ts (INT-03 + Plan 05 UI):   34 passed / 34 — ALL GREEN
integrations/ full suite:               86 passed / 86 — ALL GREEN
tsc --noEmit:                            exit 0 (clean)
next build:                              clean (/config/integracoes in output; harmless Turbopack lockfile warning only)
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] credential_enc in client component comments failed source-inspection test**
- **Found during:** Task 2 test run (first pass)
- **Issue:** The IntegrationsManager.tsx header comment referenced `credential_enc` in two lines (security note and feature list). The test `not.toMatch(/credential_enc/)` matches anywhere in the file source — including comments — so the test failed.
- **Fix:** Replaced `credential_enc` references in comments with `"ciphertext column"` and `"write-only display"` — semantically identical without the column name string.
- **Files modified:** `src/components/config/IntegrationsManager.tsx`
- **Commit:** 63581c1 (same task commit — fixed before committing)

## Known Stubs

None. The credential field is intentionally write-only (password input); `credential_masked` is the display value from the server — this is the correct design, not a stub.

## Threat Flags

All threats in the plan's `<threat_model>` are fully mitigated:

| Threat | Mitigation Applied |
|--------|-------------------|
| T-09-20 Information Disclosure (credential reaching browser) | ConnectorPublic = Omit<ConnectorRow,'credential_enc'> (compile-time); only credential_masked in JSX; test asserts not.toMatch(/credential_enc/) in client source |
| T-09-21 Information Disclosure (lastError leaking payloads) | listConnectorHealth selects only status/created_at/last_error — no payload_ref bodies; test asserts not.toMatch(/payload_ref:.*body/) |
| T-09-22 Elevation of Privilege (read-only roles mutating) | assertNotReadOnly() first in reprocessConnector (and createConnector/updateConnector from Plan 02); role gate ['admin','superadmin','ti']; server gate is source of truth |
| T-09-23 Tampering (reprocess double-requeue) | reprocess only flips failed→pending; drainIntegrationEvents CAS (Plan 03) drains exactly once even under overlapping runs |
| T-09-24 Elevation of Privilege (cross-tenant) | Every query .eq('clinic_id', actor.tenant_id); RLS on both tables (Plans 02/04) is backstop |
| T-09-25 Information Disclosure (RSC non-serializable) | RSC passes only plain connectors/health arrays; no functions/components/server objects across boundary |

No new threat surface identified beyond the plan's threat model.

## Self-Check: PASSED

Files exist:
- `src/actions/integration-events.ts` — FOUND
- `src/app/(dashboard)/config/integracoes/page.tsx` — FOUND
- `src/components/config/IntegrationsManager.tsx` — FOUND

Commits exist:
- `8a6c722` feat(09-05): add integration-events server action + UI source-inspection tests
- `63581c1` feat(09-05): add /config/integracoes RSC page + IntegrationsManager client
