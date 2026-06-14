# Phase 9: Hub de Integrações Externas - Research

**Researched:** 2026-06-14
**Domain:** Integration hub — connector registry, credential vault, webhook routing, event log, health panel, retry worker
**Confidence:** HIGH (all findings source-inspected from the v1 codebase; no external research required)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01 — Credenciais:**
Tabela `integration_connectors` (clinic_id, type/connector, config jsonb não-sensível, credencial cifrada AES-256 via `src/lib/crypto.ts` — mesmo padrão da senha do .pfx e dos dados de saúde, ENCRYPTION_KEY, server-only, status enabled/disabled). Descriptografa só server-side (Server Action / handler); a UI nunca mostra o segredo (mascarado, ex.: `••••••1234`). Sem KMS/Vault externo, sem nova dependência. RLS por `clinic_id` (USING+WITH CHECK); leitura do segredo só via service role server-side.

**D-02 — Webhooks:**
O hub é um registry: `integration_connectors` + reusar a tabela `webhook_events` (dedup do v1, service-role) e os handlers existentes `/api/webhooks/{asaas,whatsapp}` — eles passam a registrar eventos no hub (vincular ao conector + log), sem reescrever. Conectores novos (NFS-e/banco/TISS) seguem o mesmo padrão nas fases futuras.

**D-03 — Saúde e Reenvio:**
Generalizar o outbox do v1 (`message_outbox` + worker em `src/lib/messaging/`): um log de eventos de integração (`integration_events`: connector_id, direction, status pending/sent/failed, attempts, last_error, payload ref) + reenvio automático via o Vercel Cron já existente (worker idempotente). Saúde do conector = derivada dos eventos recentes (ok / degradado / falha) + fila de reenvio. Painel mostra status + último erro + botão de reprocessar.

### Claude's Discretion
- Estrutura/colunas/índices exatos das migrations (sempre indexar clinic_id); nomes; se `integration_events` é tabela nova ou extensão de `webhook_events`/`message_outbox`.
- Enum de tipos de conector inicial (whatsapp, email, asaas; placeholders nfse/banco/tiss disabled).
- Como os handlers Asaas/WhatsApp existentes passam a logar no hub sem regressão (camada fina, opcional/aditiva).
- UI do painel (lista de conectores + status + form de credencial mascarado + reprocessar) no design system v1; rota sob `Configurações › Integrações` (módulo `integracoes`/config; admin/ti write; auditor/dpo read-only).
- Mascaramento da credencial na UI; validação por tipo de conector (Zod v3).

### Deferred Ideas (OUT OF SCOPE)
- Implementação de protocolo NFS-e / Open Finance / TISS — Fases 15/16 (consomem o hub).
- Marketplace de integrações de terceiros.
- KMS/Vault externo (AES no DB cobre o estágio atual).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INT-01 | Admin/TI cadastra conectores (WhatsApp, NFS-e, banco, TISS) com credenciais armazenadas com segurança | D-01: `integration_connectors` table + AES-256-GCM via `crypto.ts`; REVOKE SELECT on secret column mirrors Phase 7/8 certificates pattern |
| INT-02 | Sistema recebe eventos externos via webhooks por conector | D-02: `webhook_events` dedup reused; thin hub-log helper called after dedup in existing handlers; new `integration_events` table links events to connectors |
| INT-03 | Painel mostra a saúde de cada integração e reenvia automaticamente em caso de falha | D-03: health derived from `integration_events` recency; auto-retry via existing Vercel Cron worker pattern; manual reprocess action in UI |
</phase_requirements>

---

## Summary

Phase 9 is a consolidation phase: the v1 codebase already has three mature infrastructure pieces — (1) the `webhook_events` dedup table + idempotent Asaas/WhatsApp handlers, (2) the `message_outbox` / `worker.ts` / Vercel Cron retry loop, and (3) the AES-256-GCM `crypto.ts` vault used for the ICP-Brasil certificate password. Phase 9 wraps these into a unified hub surface: a `integration_connectors` registry per tenant, a new `integration_events` log table that both the existing webhook handlers and the cron worker feed into, and a `/config/integracoes` UI panel showing health and providing reprocess controls.

The central constraint is **additive, not rewriting**: the live Asaas and WhatsApp webhook handlers must remain completely stable. The hub log is injected as a thin fire-and-forget helper after the existing idempotent dedup step, so a failure in the hub log cannot cause the idempotent handlers to return non-200 to providers. The credential vault follows the exact `cert_password_enc` pattern from Phase 7: encrypt with `crypto.ts`, store only the ciphertext, REVOKE SELECT on the column from `authenticated`/`anon`, decrypt only in Server Actions via `createAdminClient`.

The Vercel Cron architecture is a GET endpoint behind `isCronAuthorized` (CRON_SECRET, constant-time compare, fail-closed). The new integration retry sweep fits as a new cron entry in `vercel.json` that calls `drainIntegrationEvents` — or alternatively as an additive drain call appended to the existing `reminder-dispatch` cron since it already imports `drainOutbox`. A dedicated cron path at `/api/cron/integration-retry` is cleaner and avoids coupling.

**Primary recommendation:** Create two new migrations (`integration_connectors` + `integration_events`), a `drainIntegrationEvents` worker that mirrors `drainOutbox`, a new cron route `/api/cron/integration-retry`, connector Server Actions (create/update/delete/test), and a `/config/integracoes` page mirroring the `/config/certificado` page pattern.

---

## Standard Stack

All libraries already installed — Phase 9 requires **zero new npm packages**.

### Core (All Verified: source inspection)

| Library | Version | Purpose | Source |
|---------|---------|---------|--------|
| `@supabase/supabase-js` | v2 | DB queries, admin client | [VERIFIED: package.json] |
| `@supabase/ssr` | latest | Session auth in Server Components | [VERIFIED: package.json] |
| Node.js `crypto` | built-in | AES-256-GCM via `src/lib/crypto.ts` | [VERIFIED: crypto.ts] |
| `react-hook-form` v7 + `zod` v3 | existing | Connector credential form validation | [VERIFIED: package.json] |
| `shadcn/ui` + `@base-ui/react` | existing | UI components (Button is @base-ui; shadcn for everything else) | [VERIFIED: CLAUDE.md conventions] |
| `lucide-react` | existing | Icons | [VERIFIED: package.json] |

### No New Dependencies

Phase 9 reuses exclusively what is already installed. The crypto module is Node built-in. No SDK, no KMS library, no webhook-registry library is needed.

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── webhooks/
│   │   │   ├── asaas/route.ts         (existing — additive hub-log only)
│   │   │   └── whatsapp/route.ts      (existing — additive hub-log only)
│   │   └── cron/
│   │       └── integration-retry/route.ts   (NEW — mirrors reminder-dispatch pattern)
│   └── (dashboard)/
│       └── config/
│           └── integracoes/
│               └── page.tsx           (NEW — mirrors certificado/page.tsx)
├── components/
│   └── config/
│       └── ConnectorForm.tsx          (NEW — masked credential input, RHF+Zod)
│       └── ConnectorList.tsx          (NEW — health badge + reprocess button)
├── actions/
│   └── integration-connectors.ts     (NEW — CRUD + testConnector, mirrors certificate.ts)
├── lib/
│   ├── integrations/
│   │   ├── types.ts                  (NEW — ConnectorType enum, IntegrationStatus, EventDirection)
│   │   ├── worker.ts                 (NEW — drainIntegrationEvents, mirrors messaging/worker.ts)
│   │   └── hub-log.ts               (NEW — thin helper for additive hub logging from webhook handlers)
│   └── validators/
│       └── connector.ts             (NEW — Zod schemas per connector type)
└── supabase/
    └── migrations/
        ├── 20260615000400_integration_connectors.sql   (NEW)
        └── 20260615000500_integration_events.sql       (NEW)
```

### Pattern 1: Connector Credential Vault (mirrors Phase 7 certificates)

**What:** Store AES-256-GCM ciphertext in `credential_enc` TEXT column; REVOKE SELECT from `authenticated`/`anon`; decrypt only in Server Actions via `createAdminClient`.

**When to use:** Any column holding a secret (API key, token, client secret).

```typescript
// Source: src/lib/crypto.ts (verified)
// encrypt returns "iv:authTag:ciphertext" (hex-colon-delimited)
import { encrypt, decrypt } from '@/lib/crypto'

// On save (Server Action — 'use server'):
const credentialEnc = encrypt(plaintextApiKey)
// insert into integration_connectors: { credential_enc: credentialEnc, ...publicFields }

// On use (Server Action or webhook handler — service role only):
const adminClient = createAdminClient()
const { data } = await adminClient
  .from('integration_connectors')
  .select('credential_enc, config')
  .eq('id', connectorId)
  .single()
const apiKey = decrypt(data.credential_enc)
```

**Column-level REVOKE (exact pattern from Phase 7/8):**
```sql
-- Source: supabase/migrations/20260614000900_certificates_revoke_secrets.sql (verified)
REVOKE SELECT (credential_enc)
  ON public.integration_connectors
  FROM authenticated, anon;
```

**UI masking pattern:** Return `Omit<Row, 'credential_enc'>` from Server Actions (Type-level exclusion — identical to `CertificatePublic` from certificate.ts). Display last 4 chars: `••••••${lastFour}`.

### Pattern 2: Additive Hub Log in Existing Webhook Handlers

**What:** After the existing idempotent dedup step succeeds and `upserted` is non-null, call a thin fire-and-forget `logToHub()` helper. This helper inserts into `integration_events`. It MUST be fire-and-forget (do not await in the critical path) and MUST NOT affect the handler's 200 response.

**Critical constraint:** The hub log failure must never cause the webhook handler to throw or return non-200. The dedup and payment-processing flow is unchanged.

```typescript
// Source: src/app/api/webhooks/asaas/route.ts (verified — pattern to extend)
// AFTER the existing dedup upsert and BEFORE processWebhookEvent:
if (upserted) {
  // Existing fire-and-forget:
  processWebhookEvent(event, admin, upserted.id).catch(...)
  
  // NEW — additive hub log (fire-and-forget, must not affect 200):
  logToHub({
    admin,
    connectorType: 'asaas',
    direction: 'inbound',
    externalEventId: event.id,
    webhookEventRowId: upserted.id,
    eventType: event.event,
  }).catch((err) => console.error('[webhook/asaas] hub log error:', err))
}
```

**hub-log.ts helper signature:**
```typescript
// src/lib/integrations/hub-log.ts
export async function logToHub(opts: {
  admin: SupabaseClient
  connectorType: ConnectorType  // 'asaas' | 'whatsapp' | etc.
  direction: 'inbound' | 'outbound'
  externalEventId?: string
  webhookEventRowId?: string
  eventType?: string
  status?: 'received' | 'processed' | 'failed'
  lastError?: string
}): Promise<void>
```

The helper resolves the connector row by `(clinic_id, type)` — but for system-level connectors (Asaas, WhatsApp) that are env-var based during transition, it can resolve by `type` alone with a NULL `clinic_id` sentinel, or simply skip if no connector row exists yet. This ensures the hub log degrades gracefully before all clinic connectors are migrated from env vars.

### Pattern 3: Integration Events Table (generalizes message_outbox)

**What:** New table `integration_events` that tracks outbound/inbound integration calls with status, attempts, last_error. The `drainIntegrationEvents` worker mirrors `drainOutbox`.

**Key difference from `message_outbox`:** `integration_events` is linked to a `connector_id` (FK to `integration_connectors`) and tracks both inbound (webhook receipt) and outbound (API call) events. `message_outbox` stays as-is for messaging — do NOT replace it.

```sql
-- Verified design (mirrors message_outbox migration — 20260607000100_message_outbox.sql):
CREATE TYPE public.integration_direction AS ENUM ('inbound', 'outbound');
CREATE TYPE public.integration_event_status AS ENUM ('received', 'pending', 'processed', 'failed');

CREATE TABLE public.integration_events (
  id                UUID                       PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id         UUID                       NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  connector_id      UUID                       REFERENCES public.integration_connectors(id) ON DELETE SET NULL,
  direction         integration_direction      NOT NULL,
  status            integration_event_status   NOT NULL DEFAULT 'received',
  event_type        TEXT,                      -- e.g. 'PAYMENT_RECEIVED', 'message', 'nfse_emitted'
  external_event_id TEXT,                      -- provider's dedup key (nullable for outbound)
  payload_ref       TEXT,                      -- opaque reference (webhook_events.id or outbound req id)
  attempts          INT                        NOT NULL DEFAULT 0,
  max_attempts      INT                        NOT NULL DEFAULT 3,
  last_error        TEXT,
  processed_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ                NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ                NOT NULL DEFAULT now()
);

CREATE INDEX idx_integration_events_clinic     ON public.integration_events(clinic_id);
CREATE INDEX idx_integration_events_connector  ON public.integration_events(connector_id);
CREATE INDEX idx_integration_events_status     ON public.integration_events(status, created_at);
```

### Pattern 4: Connector Health Derivation

**What:** Health is computed at read time from recent `integration_events` for a connector. No materialized column needed.

```typescript
// Source: derived from verified event table shape
// Health function (server-side, in Server Action or page loader):
type ConnectorHealth = 'ok' | 'degraded' | 'failed' | 'unknown'

function deriveHealth(recentEvents: IntegrationEventRow[]): ConnectorHealth {
  if (recentEvents.length === 0) return 'unknown'
  const last24h = recentEvents.filter(e =>
    new Date(e.created_at) > new Date(Date.now() - 24 * 60 * 60 * 1000)
  )
  const failedCount = last24h.filter(e => e.status === 'failed').length
  const total = last24h.length
  if (failedCount === 0) return 'ok'
  if (failedCount / total >= 0.5) return 'failed'
  return 'degraded'
}
```

**Panel query:** For each connector, fetch the last N events (limit 100, ordered by created_at DESC) and derive health client-side. Or use a single query with a window function. The panel does NOT need a persistent `health` column — it's volatile state.

### Pattern 5: New Cron Route (mirrors reminder-dispatch)

```typescript
// src/app/api/cron/integration-retry/route.ts
export const runtime = 'nodejs'  // Required — no Edge (no TCP)

import { isCronAuthorized } from '@/lib/cron-auth'  // existing
import { drainIntegrationEvents } from '@/lib/integrations/worker'  // NEW

export async function GET(request: Request) {
  if (!isCronAuthorized(request.headers.get('authorization'))) {
    return new Response('Unauthorized', { status: 401 })
  }
  const result = await drainIntegrationEvents()
  return Response.json(result)
}
```

Add to `vercel.json`:
```json
{ "path": "/api/cron/integration-retry", "schedule": "*/15 * * * *" }
```
(Every 15 min is appropriate for integration retries; reminders run daily.)

### Pattern 6: Adding Module to proxy.ts (mirrors Phase 7 pattern)

**What:** Add `integracoes` as a new `ModuleKey` and add to `ROUTE_MODULE_MAP` + `MODULE_PERMISSIONS`.

```typescript
// Source: src/proxy.ts (verified)
// Step 1: extend type
type ModuleKey = 'clinica' | 'config' | 'superadmin' | 'paciente' | 'financeiro' | 'ia' | 'bi' | 'documentos' | 'integracoes'

// Step 2: add to ROUTE_MODULE_MAP BEFORE '/config' (more specific prefix first)
{ prefix: '/config/integracoes', module: 'integracoes' },

// Step 3: add to MODULE_PERMISSIONS — admin/superadmin/ti write; auditor/dpo/socio readOnly
superadmin:   { ..., integracoes: {allowed:true} },
admin:        { ..., integracoes: {allowed:true} },
ti:           { config: {allowed:true}, ia: {allowed:true}, integracoes: {allowed:true} },
dpo:          { ..., integracoes: {allowed:true, readOnly:true} },
auditor:      { ..., integracoes: {allowed:true, readOnly:true} },
socio:        { ..., integracoes: {allowed:true, readOnly:true} },
// dentist, receptionist, patient, implantacao, aluno: no change
```

**Note on route prefix ordering:** `/config/integracoes` must appear before `/config` in `ROUTE_MODULE_MAP` (the array is checked in order by most-specific prefix). This matches the existing pattern where `/clinica/documentos` and `/clinica/financeiro` appear before `/clinica`.

### Pattern 7: Connector Server Action (mirrors certificate.ts)

```typescript
// 'use server' — follows certificate.ts structure exactly
export async function createConnector(formData: FormData): Promise<ConnectorActionResult> {
  await assertNotReadOnly()                        // guard 1: read-only roles
  // auth + role gate: admin/superadmin/ti only    // guard 2: role check
  const credentialEnc = encrypt(plaintextCredential)  // guard 3: encrypt before insert
  await adminClient.from('integration_connectors').insert({ ..., credential_enc: credentialEnc })
  await logBusinessEvent(...)                      // guard 4: audit log (no secrets)
  // Return ConnectorPublic = Omit<Row, 'credential_enc'>  // guard 5: type exclusion
}
```

### Anti-Patterns to Avoid

- **Rewriting the Asaas/WhatsApp handlers:** Adding hub log MUST be fire-and-forget and outside the existing idempotent flow. Never `await logToHub()` in the critical path.
- **Storing credentials in `config` JSONB:** The `config` column is for non-sensitive metadata (endpoint URLs, template IDs, phone numbers). All secrets go in `credential_enc TEXT` encrypted with `crypto.ts`.
- **Adding `connector_id` FK to `webhook_events`:** The existing `webhook_events` table is service-role only and has no `clinic_id` or FK columns — adding to it would alter a stable, tested schema. Instead, `integration_events.payload_ref` records the `webhook_events.id` as an opaque reference string.
- **Using Edge runtime for the cron or connector actions:** Edge has no `net` module. All DB-touching routes use `export const runtime = 'nodejs'` (verified in both webhook handlers and all cron routes).
- **Missing `server-only` import in the worker/hub-log:** All files in `src/lib/` that touch secrets import `'server-only'` at the top (verified in queue.ts, worker.ts, crypto.ts, cron-auth.ts, guards.ts).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Webhook dedup | Custom lock mechanism | `webhook_events.asaas_event_id UNIQUE` upsert with `ignoreDuplicates:true` (verified in asaas handler) | Already works, battle-tested at-least-once pattern |
| Outbound retry | New queue mechanism | `drainIntegrationEvents` modeled on `drainOutbox` (verified in worker.ts) | Atomic claim via CAS on `attempts` prevents double-send |
| Credential storage | Plaintext in config JSONB or env var per tenant | AES-256-GCM via `crypto.ts` encrypt/decrypt (verified) | Same key, same format, no new dependency |
| Cron auth | IP allowlist or signed URL | `isCronAuthorized` constant-time CRON_SECRET check (verified in cron-auth.ts) | Fail-closed when unset; timing-safe compare |
| Module gating | Per-page role checks scattered | `isPathAllowed` + `isReadOnly` in proxy.ts + `assertNotReadOnly` in Server Actions (verified) | Double-enforcement already in v1 |
| Secret column exposure | Column exclusion in every query | `REVOKE SELECT (credential_enc) FROM authenticated, anon` (verified in Phase 7 migration) | Postgres-level defense-in-depth; protects even `select('*')` |

---

## V1 Infrastructure — Exact Shapes (source-inspected)

### webhook_events table

```sql
-- Source: supabase/migrations/20260606000100_financial_tables.sql (verified)
CREATE TABLE public.webhook_events (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  asaas_event_id  TEXT        NOT NULL UNIQUE,  -- dedup key; UNIQUE constraint name auto-generated
  event_type      TEXT        NOT NULL,
  processed       BOOLEAN     NOT NULL DEFAULT false,
  payload         JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- NO RLS — service-role-only (see 20260606000200_financial_rls.sql)
-- NO tenant_id column
```

**Implication for hub log:** `webhook_events` has no `clinic_id`/`connector_id`. Do not add to it. `integration_events.payload_ref` stores the `webhook_events.id` UUID as a TEXT reference for tracing. `integration_events.clinic_id` is derived from the matched receivable's `tenant_id` (already resolved in the handler).

### whatsapp_inbound_events table

```sql
-- Source: supabase/migrations/20260610000300_whatsapp_inbound_events.sql (verified)
CREATE TABLE public.whatsapp_inbound_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wamid       TEXT UNIQUE NOT NULL,
  from_phone  TEXT NOT NULL,
  payload     JSONB NOT NULL,
  processed   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- NO RLS — service-role-only
```

**Dedup mechanism in WhatsApp handler:** `INSERT ... ON CONFLICT` returns Postgres error code `23505` (unique_violation) → handler returns 200 immediately. This is different from the Asaas handler which uses `.upsert(..., { ignoreDuplicates: true })`. Both produce equivalent behavior.

### message_outbox table

```sql
-- Source: supabase/migrations/20260607000100_message_outbox.sql (verified)
-- ENUMs: message_channel ('whatsapp'|'email'), message_status ('pending'|'sent'|'failed')
CREATE TABLE public.message_outbox (
  id                UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID            NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  channel           message_channel NOT NULL,
  status            message_status  NOT NULL DEFAULT 'pending',
  attempts          INT             NOT NULL DEFAULT 0,
  max_attempts      INT             NOT NULL DEFAULT 3,
  payload           JSONB           NOT NULL,
  idempotency_key   TEXT            NOT NULL,
  scheduled_for     TIMESTAMPTZ     NOT NULL DEFAULT now(),
  last_attempted_at TIMESTAMPTZ,
  sent_at           TIMESTAMPTZ,
  error_message     TEXT,
  created_at        TIMESTAMPTZ     NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ     NOT NULL DEFAULT now(),
  CONSTRAINT message_outbox_idempotency_key_unique UNIQUE (idempotency_key)
);
```

**Implication:** The `integration_events` table does NOT reuse the `message_channel` or `message_status` ENUMs (naming collision). Create new ENUMs: `integration_direction` and `integration_event_status` (or use plain TEXT CHECK constraints to avoid Postgres ENUM management complexity — recommended for a new table).

### Vercel Cron: current vercel.json (verified)

```json
{
  "regions": ["gru1"],
  "crons": [
    { "path": "/api/cron/collection-ruler",    "schedule": "0 8 * * *" },
    { "path": "/api/cron/reminder-dispatch",   "schedule": "0 11 * * *" },
    { "path": "/api/cron/confirmation-agent",  "schedule": "0 12 * * *" },
    { "path": "/api/cron/collection-agent",    "schedule": "0 13 * * *" }
  ]
}
```

Phase 9 adds: `{ "path": "/api/cron/integration-retry", "schedule": "*/15 * * * *" }`.

### Cron Auth Pattern (verified — cron-auth.ts)

- `isCronAuthorized(authHeader)` reads `process.env.CRON_SECRET` at call time (NOT module scope)
- Returns `false` if `CRON_SECRET` is unset (fail-closed)
- Uses `crypto.timingSafeEqual` with length guard
- Vercel injects `Authorization: Bearer {CRON_SECRET}` automatically on scheduled invocation
- All four existing cron routes follow this exact pattern — use it identically

### crypto.ts AES-256-GCM (verified)

- `encrypt(plaintext: string): string` → returns `"iv:authTag:ciphertext"` (hex-colon-delimited)
- `decrypt(ciphertext: string): string` → verifies GCM auth tag; throws on tamper
- Key source: `process.env.ENCRYPTION_KEY` (64-char hex = 32 bytes); validated at call time
- `encryptJSON` / `decryptJSON` for objects
- File has `import 'server-only'` — cannot be imported by Client Components

### assertNotReadOnly (verified — guards.ts)

- Reads `x-read-only` request header (set by middleware in proxy.ts)
- Throws `Error('Acesso somente leitura...')` if header is `'true'`
- Must be the first statement in every mutation Server Action
- Next.js 15: `headers()` is async, must be awaited (already handled in the existing implementation)

### Config UI Pattern (verified — certificado/page.tsx)

- Server Component pattern: `createClient()` → `getUser()` → role check → load data → render
- Role gate renders in-page Alert for unauthorized roles (NOT a redirect)
- Roles with write access: `['admin', 'superadmin', 'ti']`
- Uses `PageHeader` with breadcrumbs: `[{ label: 'Configurações', href: '/config' }, { label: 'Integrações' }]`
- Imports action from `@/actions/...` (typed return, Omit<> for secrets)

### MODULE_PERMISSIONS current shape (verified — proxy.ts)

Current `ModuleKey` type: `'clinica' | 'config' | 'superadmin' | 'paciente' | 'financeiro' | 'ia' | 'bi' | 'documentos'`

Phase 9 adds `'integracoes'`. Existing roles that need `integracoes`:
- `superadmin`, `admin`: `{allowed:true}` (write)
- `ti`: `{allowed:true}` (write — currently only has `config` and `ia`)
- `dpo`, `auditor`, `socio`: `{allowed:true, readOnly:true}` (read-only)
- All other roles: no entry (no access)

**ROUTE_MODULE_MAP ordering constraint:** `/config/integracoes` is a sub-route of `/config`. It must appear BEFORE `{ prefix: '/config', module: 'config' }` in the array to match correctly. The existing pattern (line 38-46 in proxy.ts) demonstrates this: `/clinica/documentos` and `/clinica/financeiro` appear before `/clinica`.

---

## Common Pitfalls

### Pitfall 1: Hub Log Breaks Live Webhook Handlers
**What goes wrong:** Adding `await logToHub(...)` inside the existing webhook handlers before the `return new Response('', { status: 200 })` can cause a DB error to delay or suppress the 200 response, triggering provider retries (Asaas retries on non-200; Meta WhatsApp Cloud API retries on non-200).
**Why it happens:** The hub log is a new write operation; any DB error propagates to the caller.
**How to avoid:** Hub log MUST be fire-and-forget `.catch(...)` — never awaited in the critical response path. The pattern is identical to how `processWebhookEvent` is called in the Asaas handler (line 60-63: fire-and-forget).
**Warning signs:** 5xx from Asaas or WhatsApp retrying the same event ID multiple times in production.

### Pitfall 2: Credential Leak via select('*') or Client-Side Return
**What goes wrong:** A Server Action returns the full row including `credential_enc`; or the frontend receives the encrypted blob (still an information disclosure).
**Why it happens:** Not applying the `Omit<Row, 'credential_enc'>` type exclusion; not applying REVOKE SELECT.
**How to avoid:** (a) Column-level REVOKE in migration (Phase 7 pattern). (b) Type-level `Omit` in Server Action return type. (c) Never log `credential_enc` in `logBusinessEvent`. Both defenses are needed (defense-in-depth).
**Warning signs:** A test that reads a connector row via the anon client and receives a non-null `credential_enc`.

### Pitfall 3: ENUM Naming Collision with message_outbox
**What goes wrong:** Trying to reuse `message_status` ENUM for `integration_event_status` or `message_channel` for direction. Postgres ENUMs are schema-scoped; adding values to a used ENUM requires an exclusive lock.
**Why it happens:** Cargo-culting the `message_outbox` migration without reading the ENUM names.
**How to avoid:** Create new ENUMs (`integration_direction`, `integration_event_status`) OR use TEXT with CHECK constraints (simpler, avoids migration lock issues).
**Recommendation:** Use TEXT CHECK constraints for `integration_events` status and direction — avoids Postgres ENUM migration complexity while maintaining data integrity. Only create ENUMs if the type will be reused across multiple tables.

### Pitfall 4: Env-Var Connectors vs DB Connectors — Transition
**What goes wrong:** Phase 9 creates DB-stored connector rows, but production Asaas and WhatsApp still use env-var credentials (`ASAAS_WEBHOOK_SECRET`, `WHATSAPP_APP_SECRET`). If the hub log tries to resolve a connector by `(clinic_id, type)` and finds no row, it errors.
**Why it happens:** The transition from env-var creds to DB-stored creds is not instantaneous — production continues using env vars until each clinic admin registers their connector.
**How to avoid:** `logToHub` must be null-safe: if no connector row exists for `(clinic_id, type)`, insert the event with `connector_id = NULL` (the FK is nullable). Do NOT prevent hub logging when no connector row exists. Connector rows can be retroactively associated.
**Warning signs:** Hub log throwing "connector not found" errors in production for all Asaas/WhatsApp events.

### Pitfall 5: Supabase CLI Re-auth Before db push
**What goes wrong:** `supabase db push` runs against the wrong project (the CLI caches sessions; common misconfiguration is nexus-* account instead of FYNXIA org).
**Why it happens:** The CLI is logged into the wrong Supabase account (see MEMORY.md).
**How to avoid:** Before every `db push`: (1) `supabase projects list` to verify `jqjwyqlbbuqnrffdnlpp` is active; (2) if not, `supabase logout && supabase login` and select org `kczvihafddupruvsrrsc`. Execute command: `supabase db push --project-ref jqjwyqlbbuqnrffdnlpp`.
**Warning signs:** Migration applies to the wrong project; no tables appear in the FYNXIA dashboard.

### Pitfall 6: drainIntegrationEvents — CAS on attempts
**What goes wrong:** Two overlapping cron invocations both claim the same `pending` event row and attempt to send it twice.
**Why it happens:** Vercel Cron is at-least-once; two invocations can overlap.
**How to avoid:** Mirror the atomic claim pattern from `drainOutbox` (worker.ts lines 79-95): UPDATE with `.eq('status', 'pending').eq('attempts', row.attempts)` — only the first write wins; the second finds 0 rows returned and skips.
**Warning signs:** Duplicate outbound calls in provider logs (Asaas, WhatsApp, NFS-e in future phases).

### Pitfall 7: Adding integracoes Module to proxy.ts — Type Must Be Extended
**What goes wrong:** Adding `integracoes` to `MODULE_PERMISSIONS` values without adding it to the `ModuleKey` type causes TypeScript to silently accept the extra key in `Partial<Record<ModuleKey, ...>>` (it won't — TypeScript will error on excess properties).
**Why it happens:** Forgetting to extend the `type ModuleKey = ...` union.
**How to avoid:** Extend `ModuleKey` first, then add to `ROUTE_MODULE_MAP`, then add to `MODULE_PERMISSIONS`. The TypeScript compiler will catch missing entries.
**Warning signs:** `tsc --noEmit` errors on `proxy.ts`; or `npm run build` fails.

### Pitfall 8: Missing `runtime = 'nodejs'` on New Cron Route
**What goes wrong:** Edge runtime — no TCP connections, Supabase queries fail.
**How to avoid:** `export const runtime = 'nodejs'` at top of every new cron/webhook route. All four existing cron routes and both webhook handlers have this (verified).

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Adding `*/15 * * * *` cron schedule for integration-retry is acceptable on the current Vercel plan | Standard Stack / Cron | Vercel Hobby limits cron; Pro plan required (CLAUDE.md says Pro minimum for production) |
| A2 | `clinic_id` on `integration_events` can be derived from the webhook handler's already-resolved `receivable.tenant_id` (Asaas) or `appt.tenant_id` (WhatsApp) | Architecture Patterns | If tenant resolution fails before hub log, event is inserted with NULL clinic_id (FK violation) — hub log must use the resolved tenant or skip gracefully |
| A3 | The `message_outbox` ENUMs (`message_channel`, `message_status`) must NOT be reused for `integration_events` | Architecture Patterns | If reused, any ENUM value addition requires an exclusive lock; TEXT CHECK constraints are safer |

---

## Open Questions

1. **Env-var connector transition strategy**
   - What we know: Asaas and WhatsApp credentials are currently env-var-based at the system level, not per-clinic.
   - What's unclear: Should Phase 9 create a "system-level" connector row per connector type (seeded at migration time) so all clinics share one row? Or should each clinic register their own connector (true multi-tenant)?
   - Recommendation: For INT-01 compliance, each clinic should register their own connector (multi-tenant real). Seed a placeholder system row for Asaas/WhatsApp as `status='disabled'` to enable hub logging without requiring immediate migration of production credentials. The existing env-var auth remains the live auth; DB creds are future opt-in.

2. **integration_events.clinic_id when WhatsApp sender has no tenant**
   - What we know: The WhatsApp handler has a code path where `matchedOutreach` is null and `tenantId` is not resolved — it logs to console only (verified line 311-319 in whatsapp/route.ts).
   - What's unclear: The hub log in this path has no `clinic_id` to insert — the FK is NOT NULL.
   - Recommendation: Make `clinic_id` NULLABLE on `integration_events` for the WhatsApp unresolved-tenant case, OR skip hub logging for this code path. NULLABLE is safer and more correct (reflects reality).

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Supabase CLI | migrations + db push | Confirm before push | latest | Reinstall via `npm install -g supabase` |
| `ENCRYPTION_KEY` env var | `crypto.ts` — connector credential vault | Present (already used by Phase 7/8) | 64-char hex | None — must be set; key already exists in Vercel env |
| `CRON_SECRET` env var | `isCronAuthorized` in new cron route | Present (used by all existing cron routes) | any non-empty string | None — already set in Vercel env |
| Node.js `crypto` | `crypto.ts`, `cron-auth.ts` | Built-in | Node 20+ | None needed |

**Note on Supabase re-auth (BLOCKING):** See Pitfall 5. Every migration run requires verifying CLI login against org `kczvihafddupruvsrrsc` / project `jqjwyqlbbuqnrffdnlpp`.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.8 |
| Config file | `vitest.config.ts` (inferred from `"test": "vitest run"` in package.json) |
| Quick run command | `npx vitest run src/__tests__/` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INT-01 | `integration_connectors` migration contains `credential_enc`, `clinic_id`, `connector_type`; `REVOKE SELECT (credential_enc)` migration exists | source-inspection | `npx vitest run src/__tests__/integrations/connectors.test.ts -x` | Wave 0 |
| INT-01 | `createConnector` Server Action contains `encrypt(`, `assertNotReadOnly`, returns `Omit<Row, 'credential_enc'>` | source-inspection | `npx vitest run src/__tests__/integrations/connectors.test.ts -x` | Wave 0 |
| INT-01 | AES round-trip: `decrypt(encrypt(plaintext)) === plaintext` | unit | `npx vitest run src/__tests__/integrations/connectors.test.ts -x` | Wave 0 (crypto.ts already tested indirectly in Phase 7 icp tests — extend) |
| INT-02 | `asaas/route.ts` contains `logToHub` call after dedup upsert check | source-inspection | `npx vitest run src/__tests__/integrations/hub-log.test.ts -x` | Wave 0 |
| INT-02 | `whatsapp/route.ts` contains `logToHub` call after wamid dedup insert | source-inspection | `npx vitest run src/__tests__/integrations/hub-log.test.ts -x` | Wave 0 |
| INT-02 | `integration_events` migration exists with correct columns | source-inspection | `npx vitest run src/__tests__/integrations/hub-log.test.ts -x` | Wave 0 |
| INT-03 | `drainIntegrationEvents` worker: atomic claim (CAS on attempts), does not re-send `processed` rows | source-inspection | `npx vitest run src/__tests__/integrations/worker.test.ts -x` | Wave 0 |
| INT-03 | `deriveHealth` returns correct status for 0 failures / 50% failures / 100% failures | unit | `npx vitest run src/__tests__/integrations/health.test.ts -x` | Wave 0 |
| INT-03 | Cron route `integration-retry` contains `isCronAuthorized`, `runtime = 'nodejs'` | source-inspection | `npx vitest run src/__tests__/integrations/worker.test.ts -x` | Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run src/__tests__/integrations/ -x`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green + `npm run build` (tsc) before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/__tests__/integrations/connectors.test.ts` — covers INT-01 (source-inspection + AES round-trip)
- [ ] `src/__tests__/integrations/hub-log.test.ts` — covers INT-02 (source-inspection of additive log in handlers)
- [ ] `src/__tests__/integrations/worker.test.ts` — covers INT-03 drainIntegrationEvents + cron route
- [ ] `src/__tests__/integrations/health.test.ts` — covers INT-03 deriveHealth unit test

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | N/A (uses existing Supabase session auth) |
| V3 Session Management | No | Handled by `@supabase/ssr` |
| V4 Access Control | Yes | `assertNotReadOnly` + proxy.ts `MODULE_PERMISSIONS` (verified) |
| V5 Input Validation | Yes | Zod v3 schemas per connector type in `src/lib/validators/connector.ts` |
| V6 Cryptography | Yes | AES-256-GCM via `crypto.ts`; column-level REVOKE; `server-only` import |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Credential exposure via API response | Information Disclosure | `Omit<Row, 'credential_enc'>` return type + `REVOKE SELECT` migration |
| Webhook spoofing (Asaas) | Spoofing | Validate `asaas-access-token` header BEFORE parsing body (verified) |
| Webhook spoofing (WhatsApp) | Spoofing | HMAC-SHA256 on raw body before any processing (verified in whatsapp handler) |
| Duplicate webhook delivery | Tampering | `webhook_events.asaas_event_id UNIQUE` + `wamid UNIQUE` (verified) |
| Hub log blocker (DoS via write failure) | Denial of Service | Hub log is fire-and-forget; failure logged to console, not propagated to provider |
| Cross-tenant connector read | Elevation of Privilege | RLS `USING(clinic_id = get_my_tenant_id())` + `WITH CHECK` |
| Service role key client-side | Tampering | `createAdminClient()` used only in Server Actions and cron routes (never client code) |
| Cron endpoint called externally | Spoofing | `isCronAuthorized` constant-time CRON_SECRET check, fail-closed (verified) |

---

## Sources

### Primary (HIGH confidence — source-inspected)

- `src/app/api/webhooks/asaas/route.ts` — webhook dedup pattern, fire-and-forget, nodejs runtime
- `src/app/api/webhooks/whatsapp/route.ts` — HMAC verification, wamid dedup via 23505 code
- `src/lib/messaging/queue.ts` — OutboxQueue interface + idempotency_key UNIQUE pattern
- `src/lib/messaging/worker.ts` — drainOutbox, atomic claim (CAS), per-row try/catch
- `src/lib/messaging/types.ts` — OutboxRow shape, Channel/OutboxStatus enums
- `src/lib/crypto.ts` — AES-256-GCM encrypt/decrypt, iv:authTag:ciphertext format
- `src/lib/cron-auth.ts` — isCronAuthorized, fail-closed, timingSafeEqual
- `src/lib/auth/guards.ts` — assertNotReadOnly, x-read-only header
- `src/proxy.ts` — MODULE_PERMISSIONS, ModuleKey, ROUTE_MODULE_MAP, isPathAllowed/isReadOnly
- `src/actions/certificate.ts` — Omit<> secret exclusion, assertNotReadOnly, role gate pattern
- `src/app/(dashboard)/config/certificado/page.tsx` — config page Server Component pattern
- `supabase/migrations/20260606000100_financial_tables.sql` — webhook_events exact shape
- `supabase/migrations/20260607000100_message_outbox.sql` — message_outbox exact shape + ENUMs
- `supabase/migrations/20260610000300_whatsapp_inbound_events.sql` — wamid dedup shape
- `supabase/migrations/20260614000500_certificates.sql` — certificates RLS + REVOKE pattern
- `supabase/migrations/20260614000900_certificates_revoke_secrets.sql` — column REVOKE exact SQL
- `vercel.json` — existing cron entries + gru1 region

### Secondary (verified from CONTEXT.md + MODULES-SPEC-v2.md)

- `.planning/phases/09-hub-de-integra-es-externas/09-CONTEXT.md` — locked decisions D-01..D-03
- `.planning/REQUIREMENTS.md` — INT-01..INT-03 text
- `.planning/MODULES-SPEC-v2.md` — Módulo 27 feature description

---

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — all packages source-verified in package.json; no new dependencies
- Architecture Patterns: HIGH — every pattern derives directly from source-inspected v1 code
- Pitfalls: HIGH — each pitfall identified from specific code paths in the verified sources
- Migration design: MEDIUM — exact column names and CHECK constraints are Claude's discretion per CONTEXT.md

**Research date:** 2026-06-14
**Valid until:** 2026-07-14 (stable stack; only risk is Vercel Cron pricing tier changes)
