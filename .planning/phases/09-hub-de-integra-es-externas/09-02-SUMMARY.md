---
phase: 09-hub-de-integra-es-externas
plan: "02"
subsystem: integration-hub
tags: [migrations, credential-vault, rls, revoke, server-action, aes, masking, health, zod]
dependency_graph:
  requires: [09-01]
  provides:
    - INT-01 GREEN (integration_connectors migration + credential vault + CRUD action)
    - INT-03 GREEN (deriveHealth pure function + health tests GREEN)
  affects:
    - Plan 09-03 (worker.ts + cron route + vercel.json use integration_events schema defined here)
    - Plan 09-04 ([BLOCKING] db push — migrations written here, pushed in 04)
    - Plan 09-05 (UI page imports ConnectorPublic type + listConnectors/createConnector actions from here)
tech_stack:
  added: []
  patterns:
    - AES-256-GCM credential vault via crypto.ts (mirrors Phase 7 certificates pattern exactly)
    - Column-level REVOKE on credential_enc FROM authenticated, anon (defense-in-depth T-09-03)
    - Omit<ConnectorRow,'credential_enc'> + maskCredential() dual defense on action return types
    - TEXT CHECK constraints for status/direction (NOT new ENUMs — avoids Postgres ENUM lock, Pitfall 3)
    - clinic_id NULLABLE on both tables (system sentinel rows + WhatsApp unresolved-tenant path)
    - createAdminClient() bypasses REVOKE for server-side decrypt in listConnectors
    - connectorFormSchema Zod v3 without .default() (avoids resolvers v5 input/output mismatch D-133)
    - Pure deriveHealth function — 24h window, >=50% failure threshold = 'failed'
key_files:
  created:
    - supabase/migrations/20260615000400_integration_connectors.sql
    - supabase/migrations/20260615000500_integration_events.sql
    - supabase/migrations/20260615000600_integration_revoke.sql
    - src/lib/integrations/types.ts
    - src/lib/integrations/mask.ts
    - src/lib/integrations/health.ts
    - src/lib/validators/connector.ts
    - src/actions/integration-connectors.ts
  modified: []
decisions:
  - D-201: status field in connectorFormSchema uses z.enum without .default() — RHF form supplies defaultValues — avoids resolvers v5 type mismatch (D-133 precedent)
  - D-202: listConnectors uses createAdminClient to select credential_enc (REVOKE blocks authenticated client) then decrypts server-side to derive masked tail — never returns ciphertext
  - D-203: integration_events has no client write policy — only service role (createAdminClient) writes events (webhook handlers + cron worker) matching webhook_events/whatsapp_inbound_events pattern
  - D-204: clinic_id NULLABLE on integration_connectors for system sentinel rows; ON CONFLICT DO NOTHING seed is idempotent via partial unique index uq_integration_connectors_system_type
  - D-205: mask.ts has NO 'server-only' import — deliberate, must remain importable by client components for credential display
metrics:
  duration_minutes: 25
  completed_date: "2026-06-14"
  tasks_completed: 3
  tasks_total: 3
  files_created: 8
  files_modified: 0
---

# Phase 9 Plan 02: Integration Connector Migrations + Credential Vault + Health Derivation

AES-256-GCM credential vault with column-level REVOKE, full CRUD Server Action mirroring the Phase 7 certificate pattern, pure deriveHealth function, and three migration files (push deferred to Plan 04).

## What Was Built

**3 SQL migrations (not yet pushed — Plan 04 is [BLOCKING]):**

- `20260615000400_integration_connectors.sql`: `integration_connectors` table (clinic_id NULLABLE, type TEXT CHECK 6 values, config JSONB, credential_enc TEXT, status TEXT CHECK, timestamps); idx_integration_connectors_clinic; partial unique indexes (uq_integration_connectors_clinic_type WHERE clinic_id IS NOT NULL, uq_integration_connectors_system_type WHERE clinic_id IS NULL); RLS tenant_read + admin_write (USING+WITH CHECK on get_my_tenant_id()+get_my_role()); seed 3 system-level disabled rows (asaas/whatsapp/email) with clinic_id=NULL.
- `20260615000500_integration_events.sql`: `integration_events` table (clinic_id NULLABLE, connector_id FK ON DELETE SET NULL, direction TEXT CHECK, status TEXT CHECK — NO ENUM reuse from message_outbox, attempts, max_attempts, last_error, external_event_id, payload_ref TEXT, processed_at); 3 indexes (clinic, connector, status+created_at); RLS tenant_read only — service-role-only writes.
- `20260615000600_integration_revoke.sql`: `REVOKE SELECT (credential_enc) ON public.integration_connectors FROM authenticated, anon` — defense-in-depth T-09-03 (mirrors Phase 7 certificate REVOKE).

**5 lib/action files:**

- `src/lib/integrations/types.ts`: ConnectorRow, IntegrationEventRow, ConnectorType, IntegrationStatus, EventDirection, IntegrationEventStatus, ConnectorHealth — pure type file, no server-only.
- `src/lib/integrations/mask.ts`: `maskCredential(plaintext)` pure util — NO 'use server' — importable by both server actions and client components — returns '••••••' + last 4 chars.
- `src/lib/integrations/health.ts`: `deriveHealth(recentEvents)` pure function — 24h window filter, 0 failed → 'ok', >=50% failed → 'failed', else → 'degraded', no events in window → 'unknown'.
- `src/lib/validators/connector.ts`: Zod v3 `connectorFormSchema` (type, credential min 1, config optional, status enum without .default()) + `connectorUpdateSchema` (credential optional for updates).
- `src/actions/integration-connectors.ts`: 'use server'; `ConnectorPublic = Omit<ConnectorRow,'credential_enc'> & {credential_masked}; createConnector, listConnectors, updateConnector, deleteConnector` — all mutations gate on assertNotReadOnly() + role ['admin','superadmin','ti']; createAdminClient() for DB writes and reads; encrypt() before insert; decrypt() only for masked tail derivation; logBusinessEvent without credential/ciphertext.

## Test Results

```
connectors.test.ts (INT-01):   21 passed / 21 — ALL GREEN
health.test.ts (INT-03):        9 passed / 20 — deriveHealth 8 unit tests GREEN; 11 remain RED for Plan 03 targets
tsc --noEmit:                   clean (exit 0)
```

Plan 03 targets still RED (expected): worker.ts, cron route, vercel.json — those are Plan 03's scope.

## Deviations from Plan

None — plan executed exactly as written.

Implementation decisions that were Claude's discretion (per CONTEXT.md):
- TEXT CHECK constraints instead of ENUMs (Pitfall 3 avoidance — per plan instructions)
- connectorUpdateSchema credential as optional (natural — not in plan spec but required for correct update logic)
- listConnectors decrypts server-side to derive masked tail, using createAdminClient (correctly mirrors plan's "use admin client because REVOKE blocks credential_enc for the anon/auth client")

## Known Stubs

None. No UI components created. No data-flowing UI stubs.

## Threat Flags

All threats in the plan's `<threat_model>` are fully mitigated:

| Threat | Mitigation Applied |
|--------|-------------------|
| T-09-03 Information Disclosure (credential_enc) | REVOKE SELECT migration (000600) + Omit<> return type + listConnectors maps to masked tail only + createAdminClient for server-side decrypt |
| T-09-04 Information Disclosure (logBusinessEvent) | Audit details carry only {type, status} — no credential or ciphertext |
| T-09-05 Cross-tenant read/write | RLS USING(clinic_id = get_my_tenant_id()) + WITH CHECK; all queries .eq('clinic_id', actor.tenant_id) |
| T-09-06 Elevation of Privilege (read-only roles) | assertNotReadOnly() is first statement of every mutation; role gate ['admin','superadmin','ti'] second |
| T-09-07 Input Validation | Zod v3 connectorFormSchema.safeParse before any DB write |
| T-09-08 Tampering (ciphertext) | AES-256-GCM auth tag — decrypt throws on tamper (caught gracefully in listConnectors) |

No new threat surface identified beyond the plan's threat model.

## Self-Check: PASSED

Files exist:
- `supabase/migrations/20260615000400_integration_connectors.sql` — FOUND
- `supabase/migrations/20260615000500_integration_events.sql` — FOUND
- `supabase/migrations/20260615000600_integration_revoke.sql` — FOUND
- `src/lib/integrations/types.ts` — FOUND
- `src/lib/integrations/mask.ts` — FOUND
- `src/lib/integrations/health.ts` — FOUND
- `src/lib/validators/connector.ts` — FOUND
- `src/actions/integration-connectors.ts` — FOUND

Commits exist:
- `d71159d` feat(09-02): add integration_connectors + integration_events migrations + REVOKE
- `9f806c8` feat(09-02): add lib/integrations types + mask + health + connector validator
- `d932fb5` feat(09-02): add integration-connectors Server Action (AES vault + RBAC + masking)
