---
phase: 09-hub-de-integra-es-externas
reviewed: 2026-06-14T00:00:00Z
depth: standard
files_reviewed: 20
files_reviewed_list:
  - supabase/migrations/20260615000400_integration_connectors.sql
  - supabase/migrations/20260615000500_integration_events.sql
  - supabase/migrations/20260615000600_integration_revoke.sql
  - src/lib/integrations/types.ts
  - src/lib/integrations/mask.ts
  - src/lib/integrations/health.ts
  - src/lib/integrations/hub-log.ts
  - src/lib/integrations/worker.ts
  - src/lib/validators/connector.ts
  - src/actions/integration-connectors.ts
  - src/actions/integration-events.ts
  - src/app/api/webhooks/asaas/route.ts
  - src/app/api/webhooks/whatsapp/route.ts
  - src/app/api/cron/integration-retry/route.ts
  - src/proxy.ts
  - src/components/config/IntegrationsManager.tsx
  - src/app/(dashboard)/config/integracoes/page.tsx
  - src/__tests__/integrations/health.test.ts
  - src/__tests__/integrations/webhooks.test.ts
  - vercel.json
findings:
  critical: 0
  warning: 3
  info: 2
  total: 5
status: issues_found
---

# Phase 9: Code Review Report — Hub de Integrações Externas

**Reviewed:** 2026-06-14
**Depth:** standard
**Files Reviewed:** 20
**Status:** issues_found (0 Critical, 3 Warning, 2 Info)

## Summary

Phase 9 ships a credential vault (AES-256-GCM), integration event hub, additive webhook
logging, atomic CAS retry worker, and the `/config/integracoes` UI. The security-critical
properties are substantially sound:

- `credential_enc` is column-REVOKED from `authenticated`/`anon`; `ConnectorPublic` omits
  it at compile time; only `credential_masked` (6 bullets + last 4 chars) reaches the client.
- Both webhook handlers preserve their original dedup/signature/processing flows intact;
  `logToHub` calls are strictly fire-and-forget (`.catch()`), positioned after dedup, and
  are never on the hot path for the 200 response.
- `drainIntegrationEvents` uses a correct CAS claim on `(status='pending', attempts=N)`;
  the cron route uses `isCronAuthorized()` (constant-time compare, fail-closed on missing
  `CRON_SECRET`).
- RLS on both tables uses `USING + WITH CHECK` via `get_my_tenant_id()`; system-sentinel
  rows (`clinic_id IS NULL`) are invisible to tenant-scoped policies.
- `assertNotReadOnly()` + role gate (`['admin','superadmin','ti']`) are applied to all
  mutations. RSC page passes only serializable arrays; `credential_enc` never appears in
  `IntegrationsManager`.

Three warnings were found — none are exploitable data leaks in the current call-sites, but
two are latent correctness/isolation risks that should be fixed before Phase 15 extends
the worker with live outbound senders.

---

## Warnings

### WR-01: `reprocessConnector` update lacks clinic_id guard — cross-tenant promotion possible if IDs are guessed

**File:** `src/actions/integration-events.ts:219-225`

**Issue:** The `UPDATE ... IN (ids)` that flips rows `failed -> pending` does not include
`.eq('clinic_id', actor.tenant_id)`:

```typescript
// Step 5 (current)
const { error: updateErr } = await adminClient
  .from('integration_events')
  .update({ status: 'pending', last_error: null })
  .in('id', ids)
```

`ids` was derived from a prior SELECT filtered by `.eq('clinic_id', actor.tenant_id)` and
`.eq('connector_id', connectorId)`, so under normal operation only same-tenant rows enter
`ids`. However, if a future refactor changes the SELECT scope, or if a bug introduces
duplicate UUIDs from a different code path, the UPDATE will blindly flip any row whose ID
is in the array regardless of tenant ownership. Defense-in-depth for a mutation that touches
the retry queue requires the tenant filter at the UPDATE level, not only at the SELECT level.

**Fix:** Add `.eq('clinic_id', actor.tenant_id)` to the update call:

```typescript
const { error: updateErr } = await adminClient
  .from('integration_events')
  .update({ status: 'pending', last_error: null })
  .in('id', ids)
  .eq('clinic_id', actor.tenant_id)   // ADD: redundant guard, but safe-by-default
```

---

### WR-02: `deleteConnector` performs a hard delete — violates project soft-delete / LGPD convention

**File:** `src/actions/integration-connectors.ts:329-334`

**Issue:** The project's LGPD soft-delete convention (established in
`20260603000000_initial_schema.sql` and consistently applied to `patients`, `clinics`,
`units`, and every other table with PII/configuration data) requires setting `deleted_at`
rather than issuing a `DELETE`. The `deleteConnector` action issues a hard `DELETE`:

```typescript
const { error: deleteError } = await adminClient
  .from('integration_connectors')
  .delete()
  .eq('id', id)
  .eq('clinic_id', actor.tenant_id)
```

Consequences:
1. The `integration_events.connector_id` FK becomes NULL (the `ON DELETE SET NULL` clause
   fires), permanently severing the audit trail link between events and the connector that
   generated them.
2. A reprocessed event whose connector row was hard-deleted will drain with
   `connector_id = null`, silently losing the connector context.
3. LGPD audit requirements expect configuration-level changes to be recoverable.

Note: the `integration_connectors` table does not have a `deleted_at` column in the
migration — this needs to be added alongside the behavioural change.

**Fix:**

Step 1 — add `deleted_at` to the migration (or a follow-up migration):
```sql
ALTER TABLE public.integration_connectors
  ADD COLUMN deleted_at TIMESTAMPTZ;

-- Update the RLS read policy to filter soft-deleted rows
DROP POLICY IF EXISTS "integration_connectors_tenant_read" ON public.integration_connectors;
CREATE POLICY "integration_connectors_tenant_read" ON public.integration_connectors
  FOR SELECT USING (clinic_id = get_my_tenant_id() AND deleted_at IS NULL);
```

Step 2 — change the action to soft-delete:
```typescript
const { error: deleteError } = await adminClient
  .from('integration_connectors')
  .update({ deleted_at: new Date().toISOString() })
  .eq('id', id)
  .eq('clinic_id', actor.tenant_id)
  .is('deleted_at', null)   // idempotent: cannot soft-delete twice
```

---

### WR-03: `logToHub` uses unvalidated string interpolation in a PostgREST `.or()` filter

**File:** `src/lib/integrations/hub-log.ts:48`

**Issue:** The connector-resolution query builds a PostgREST `or` filter string by
interpolating `clinicId` directly:

```typescript
.or(clinicId ? `clinic_id.eq.${clinicId},clinic_id.is.null` : 'clinic_id.is.null')
```

Both current call sites pass `clinicId: null`, so the safe branch (`clinic_id.is.null`) is
always taken in production today. However, `logToHub` accepts any `string | null | undefined`
from the `opts` parameter, and a future caller that resolves and passes a real clinic UUID
will hit the interpolated branch. A UUID is safe, but if a non-UUID string is ever passed
(e.g., a resolved value from an untrusted source), it would corrupt the PostgREST filter
string. No injection into Postgres SQL is possible here (PostgREST parses its own filter
syntax and rejects malformed inputs), but it can cause a runtime query error inside
`logToHub` that swallows via the outer `catch {}`, meaning the event is logged with
`connector_id = null` instead of the resolved connector row — silent degradation.

**Fix:** Validate `clinicId` as a UUID before interpolating, or use two chained `.eq()`
calls with an explicit `.or()` using the documented Supabase JS API (PostgREST `or` with
referenced columns):

```typescript
// Prefer: resolve connector_id in two separate queries rather than the inline or-filter
// Option A — use .filter() with validated UUID only
const safeClinicFilter = clinicId && /^[0-9a-f-]{36}$/i.test(clinicId)
  ? `clinic_id.eq.${clinicId},clinic_id.is.null`
  : 'clinic_id.is.null'

.or(safeClinicFilter)

// Option B — prefer the tenant connector first, fall back with a second query (clearer intent)
```

---

## Info

### IN-01: `ConnectorRow` type (with `credential_enc`) is in a pure-type file importable by client bundles

**File:** `src/lib/integrations/types.ts:28-37`

**Issue:** `ConnectorRow` declares `credential_enc: string | null` as a typed field. This
type file has no `import 'server-only'` (intentionally, per the file comment — it is
type-only). TypeScript type-erases these fields at runtime, so `credential_enc` carries no
actual value to the client. However, because `ConnectorRow` is importable client-side (via
`import type`), a developer may mistakenly reference it in a client component and assume
the `credential_enc` field is populated. The authoritative client type is `ConnectorPublic`
(in `src/actions/integration-connectors.ts`), which omits `credential_enc` at the type
level.

**Fix:** Add a JSDoc warning to `ConnectorRow` and consider moving it to a server-only
file alongside the action types:

```typescript
/**
 * Full DB row type — includes credential_enc.
 * SERVER-SIDE ONLY: import this type only in server actions and server utilities.
 * For client-facing code, use ConnectorPublic (Omit<ConnectorRow,'credential_enc'>).
 */
export interface ConnectorRow { ... }
```

---

### IN-02: `assertNotReadOnly()` relies on middleware-injected header — does not intercept direct Server Action POSTs from non-browser clients

**File:** `src/lib/auth/guards.ts:25-28`, `src/actions/integration-connectors.ts:101`, `src/actions/integration-events.ts:181`

**Issue:** `assertNotReadOnly()` reads the `x-read-only` request header, which is set by
`proxy.ts` during middleware-intercepted page navigation. Vercel does NOT run middleware for
direct Server Action POST requests (the `/actions/...` internal path); the header is absent,
so `assertNotReadOnly()` returns without throwing. This means an auditor/dpo/socio who
crafts a direct POST to a Server Action (or uses a non-browser client) bypasses the
`assertNotReadOnly()` check.

This is NOT a critical finding because the explicit role gate
(`if (!['admin','superadmin','ti'].includes(actor.role))`) in every mutation action provides
the real authorization enforcement independently of the header. The role is read from the
database in `getActor()`, not from a request header, so it cannot be spoofed.

The only scenario where this matters is if `assertNotReadOnly()` is relied upon as the
**sole** gate for a future mutation that omits the explicit role check — which would then
have no enforcement at all. Document the limitation to protect against future additions.

**Fix:** Add a comment to `assertNotReadOnly()` clarifying that the role gate in each
action is the authoritative enforcement:

```typescript
// NOTE: this guard is a UX convenience, not the authoritative auth check.
// It only fires when x-read-only is set by the middleware on page navigations.
// Every mutation action MUST also have an explicit role gate that reads from the DB.
export async function assertNotReadOnly(): Promise<void> { ... }
```

---

## Clean Areas (for reference)

The following areas were explicitly verified and found clean:

- **Credential secrecy:** AES-256-GCM (randomBytes IV per call, GCM auth tag), REVOKE on
  `credential_enc`, `ConnectorPublic` Omit at compile time, `credential_masked` only to UI.
  Audit log receives `{ type, status }` — no ciphertext, no plaintext.
- **Webhook regression-safety:** Both Asaas and WhatsApp handlers have their token/HMAC
  validation, dedup (ignoreDuplicates / 23505), and fire-and-forget processing flows fully
  intact. `logToHub` is positioned after dedup, uses `.catch()`, and is placed before the
  `return new Response('', { status: 200 })` — additive and non-blocking.
- **Cron auth:** `isCronAuthorized()` uses `crypto.timingSafeEqual`, fails closed when
  `CRON_SECRET` is unset, and uses a length guard before `timingSafeEqual`. The cron route
  declares `runtime = 'nodejs'` and returns `{ status: 401 }` on failure.
- **CAS idempotency:** `drainIntegrationEvents` claims each row with
  `.eq('status','pending').eq('attempts', row.attempts)` — concurrent drains race and only
  one wins; losers see 0 rows and skip. Per-row try/catch prevents cascade failures.
- **RLS isolation:** Both tables use `USING (clinic_id = get_my_tenant_id())` with
  `WITH CHECK` on write policy. System-sentinel rows (`clinic_id IS NULL`) are naturally
  excluded from tenant-scoped policies. No tenant can read another tenant's connectors or
  events via the anon/authenticated client.
- **RBAC:** The `integracoes` module is gated in `MODULE_PERMISSIONS` for all six permitted
  roles. `ti` is correctly assigned write access without read-only. All mutations call
  `assertNotReadOnly()` + explicit role gate.
- **RSC serialization:** `/config/integracoes/page.tsx` passes only `ConnectorPublic[]` and
  `ConnectorHealthView[]` — plain serializable arrays. No functions, components, or server
  objects cross the boundary. `credential_enc` does not appear anywhere in the client
  component or the types it receives.
- **LGPD data minimization:** `hub-log.ts` logs only IDs, type, status, and error messages.
  No payload bodies, no PHI, no credentials are written to `integration_events`.

---

_Reviewed: 2026-06-14_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
