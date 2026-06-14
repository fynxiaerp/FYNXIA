---
phase: 09-hub-de-integra-es-externas
plan: "01"
subsystem: integration-hub
tags: [testing, tdd, red-scaffold, integration-hub, webhooks, credentials, health]
dependency_graph:
  requires: []
  provides:
    - INT-01 RED test coverage (connectors.test.ts)
    - INT-02 RED test coverage (webhooks.test.ts)
    - INT-03 RED test coverage (health.test.ts)
  affects:
    - Plans 02-05 implementation targets (must turn these tests GREEN)
tech_stack:
  added: []
  patterns:
    - source-inspection via readFileSync + suffix-match M() helper (mirrors phase8.test.ts)
    - SRC() helper returns '' on missing files (ENOENT never thrown — fail on content)
    - beforeAll ENCRYPTION_KEY injection (64-char hex, mirrors patients.test.ts)
    - vi.mock('server-only', () => ({})) for crypto.ts import in test env
    - absolute-path dynamic import (not @-alias) to stay tsc-clean on missing modules
key_files:
  created:
    - src/__tests__/integrations/connectors.test.ts
    - src/__tests__/integrations/webhooks.test.ts
    - src/__tests__/integrations/health.test.ts
  modified: []
decisions:
  - maskCredential placed at src/lib/integrations/mask.ts (NOT 'use server') — importable by both server actions and client components; documented in connectors.test.ts so Plan 02 follows it
  - Dynamic import uses absolute path (not @-alias) to avoid TS2307 when target module does not yet exist — @-alias causes tsc errors on missing files
  - deriveHealth tests use absolute-path beforeAll dynamic import with existsSync guard — module absent → deriveHealth = undefined → tests throw and fail RED
  - Regression-safety assertions added to webhooks.test.ts covering critical existing lines in asaas/whatsapp handlers — turns RED if additive edit accidentally removes them
  - TWENTY_FOUR_HOURS_MS constant named but superseded by TWENTY_FIVE_HOURS_MS usage in tests; both retained for clarity
metrics:
  duration_minutes: 30
  completed_date: "2026-06-14"
  tasks_completed: 3
  tasks_total: 3
  files_created: 3
  files_modified: 0
---

# Phase 9 Plan 01: Wave 0 RED Test Scaffolds — Integration Hub

Wave 0 Nyquist-compliance scaffolds for Phase 9 (hub de integrações externas). Three test files created under `src/__tests__/integrations/` covering all INT-01/02/03 requirements via source-inspection + unit assertions that are RED now and turn GREEN as Plans 02–05 deliver the implementation.

## What Was Built

Three source-inspection test scaffolds following the established `phase8.test.ts` pattern (M() suffix-match helper, SRC() missing-file-safe reader):

**connectors.test.ts (INT-01):**
- Migration assertions: `_integration_connectors.sql` schema (credential_enc, clinic_id NULLABLE, status CHECK, idx, RLS, get_my_tenant_id(), WITH CHECK, role gate admin/ti/superadmin)
- Migration assertions: `_integration_revoke.sql` (REVOKE SELECT (credential_enc) FROM authenticated, anon)
- Action assertions: `src/actions/integration-connectors.ts` (assertNotReadOnly, encrypt(, Omit<...,'credential_enc'>, maskCredential)
- Mask util assertions: `src/lib/integrations/mask.ts` (exports maskCredential, NOT server-only)
- AES round-trip unit tests: GREEN immediately (crypto.ts exists)
- maskCredential contract unit: RED until Plan 02 creates mask.ts

**webhooks.test.ts (INT-02):**
- Migration assertions: `_integration_events.sql` (connector_id FK ON DELETE SET NULL, direction/status TEXT CHECK, attempts, max_attempts, last_error, external_event_id, payload_ref, clinic_id NULLABLE, 3 indexes, no message_status/message_channel ENUM reuse)
- Asaas handler assertions: additive logToHub() call + .catch() fire-and-forget
- WhatsApp handler assertions: same additive logToHub() pattern
- hub-log.ts assertions: exports logToHub, server-only, integration_events insert, null-safe connector_id
- REGRESSION-SAFE: 10 assertions locking existing critical lines in both webhook handlers

**health.test.ts (INT-03):**
- deriveHealth unit tests (8 cases): unknown/ok/failed/degraded/24h-window exclusion — via dynamic import with existsSync guard (RED until health.ts created)
- drainIntegrationEvents assertions: export shape, server-only, .eq('status','pending') fetch, CAS .eq('attempts',...) update, no processed-row re-fetch
- Cron route assertions: runtime='nodejs', isCronAuthorized, drainIntegrationEvents, status 401
- vercel.json assertions: integration-retry path + schedule string present

## Test Results

```
Test Files  3 failed | 48 passed (51)
     Tests  57 failed | 727 passed (784)
```

- **57 RED** by design: migration files absent, action/worker/health/cron-route/hub-log not yet created
- **15 GREEN** immediately: AES round-trip (3), Asaas regression guards (5), WhatsApp regression guards (5), mask.ts server-only absence (1), worker no-processed-rows (1)
- **727 existing tests UNAFFECTED** — zero regressions

`npx tsc --noEmit` exit 0 (clean).

## Deviations from Plan

None — plan executed exactly as written.

The only implementation decision made (maskCredential path) was explicitly allowed as Claude's discretion per the plan: `src/lib/integrations/mask.ts` was chosen over a 'use server' action export, and this decision is documented in the test file so Plan 02 follows it.

## Known Stubs

None. This plan creates test scaffolds only — no data-flowing UI components or stub values.

## Threat Flags

None. Test files only read source/migration files and use a throwaway plaintext `'api-key-1234'` for the AES round-trip (T-09-01 mitigated). ENCRYPTION_KEY is a 64-char hex constant seeded in beforeAll (same throwaway mechanism as patients.test.ts — not a real key). No secrets committed.

## Self-Check: PASSED

Files exist:
- `src/__tests__/integrations/connectors.test.ts` — FOUND
- `src/__tests__/integrations/webhooks.test.ts` — FOUND
- `src/__tests__/integrations/health.test.ts` — FOUND

Commits exist:
- `1e34a36` test(09-01): add INT-01 RED scaffold — connectors migration + RLS + AES round-trip + masking
- `e9722e0` test(09-01): add INT-02 RED scaffold — integration_events migration + additive logToHub + regression guards
- `df6ebee` test(09-01): add INT-03 RED scaffold — deriveHealth unit + drainIntegrationEvents CAS + cron route
