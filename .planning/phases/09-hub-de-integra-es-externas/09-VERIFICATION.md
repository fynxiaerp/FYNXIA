---
phase: 09-hub-de-integra-es-externas
verified: 2026-06-14T17:42:23Z
status: human_needed
score: 9/9 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Registrar um conector real via /config/integracoes com uma credencial de teste"
    expected: "Credencial aparece mascarada (••••••XXXX) apos salvar; reload persiste; coluna credential_enc nao aparece no DevTools Network"
    why_human: "Fluxo de UI interativo — nao testavel sem browser"
  - test: "Webhook ao vivo do Asaas/WhatsApp disparar e verificar painel de saude"
    expected: "Evento aparece em integration_events (Supabase Dashboard); painel /config/integracoes mostra health ok/degraded/failed"
    why_human: "Requer chamada de provider externo ao vivo e verificacao de UI em tempo real"
  - test: "Simular evento com status failed e clicar em Reprocessar"
    expected: "Linha vira pending; na proxima execucao do cron (*/15) o worker drena e marca processed"
    why_human: "Requer estado de banco real + espera pelo cron schedule"
  - test: "Acessar /config/integracoes com usuario de role auditor"
    expected: "Painel visivel mas botoes de salvar/reprocessar desabilitados ou bloqueados; servidor retorna 'Acesso restrito' ao tentar mutation"
    why_human: "Validacao de RBAC read-only requer sessao de usuario real"
  - test: "Cron GET /api/cron/integration-retry sem CRON_SECRET"
    expected: "Response 401 Unauthorized"
    why_human: "Requer chamada HTTP ao endpoint deployado (Vercel prod ou local)"
---

# Phase 9: Hub de Integrações Externas — Verification Report

**Phase Goal:** registro de conectores com credenciais seguras + webhooks roteados + painel de saúde com reenvio automático (consolidando Asaas/WhatsApp/Resend do v1, sem regressão)
**Verified:** 2026-06-14T17:42:23Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | integration_connectors table: credential_enc AES col, clinic_id NULLABLE, status TEXT CHECK, idx, RLS USING+WITH CHECK, role gate admin/ti/superadmin, REVOKE on credential_enc | VERIFIED | `20260615000400_integration_connectors.sql` + `20260615000600_integration_revoke.sql` — all columns/constraints/RLS present; READ confirmed |
| 2 | integration_events table: TEXT CHECK status (received/pending/processed/failed), connector_id FK SET NULL, clinic_id NULLABLE, 3 indexes, no ENUM reuse | VERIFIED | `20260615000500_integration_events.sql` — all constraints present; TEXT CHECK not ENUM; READ confirmed |
| 3 | Types regenerated in database.types.ts with both new tables (>1000 lines, truncation-guarded) | VERIFIED | `src/types/database.types.ts` — 2221 lines, contains `integration_connectors:` and `integration_events:` at lines 1271/1312 |
| 4 | createConnector: assertNotReadOnly() first, encrypt() before store, ConnectorPublic excludes credential_enc, maskCredential in return, logBusinessEvent without secret | VERIFIED | `src/actions/integration-connectors.ts` — all 4 checks confirmed at exact lines; toPublic() strips credential_enc via Omit<>, decrypt used server-side only for masked tail in listConnectors |
| 5 | logToHub fire-and-forget added to Asaas AND WhatsApp handlers; regression-safe lines intact (asaas-access-token, ignoreDuplicates, processWebhookEvent; verifyWhatsAppSignature, 23505, processInbound) | VERIFIED | Both handlers import `logToHub` and call `.catch(...)` — fire-and-forget confirmed; all 10 regression-safe lines present |
| 6 | drainIntegrationEvents: server-only, CAS claim (.eq('status','pending').eq('attempts', row.attempts)), selects only pending, never re-fetches processed | VERIFIED | `src/lib/integrations/worker.ts` — `import 'server-only'`, CAS pattern at lines 72-77, fetch is `.eq('status','pending')` only |
| 7 | integration-retry cron: export const runtime = 'nodejs', isCronAuthorized fail-closed 401, calls drainIntegrationEvents; vercel.json has schedule */15 | VERIFIED | `src/app/api/cron/integration-retry/route.ts` — runtime, isCronAuthorized, 401, drainIntegrationEvents all present; vercel.json line 8 has `"schedule": "*/15 * * * *"` |
| 8 | integracoes module in proxy.ts: ModuleKey extended, /config/integracoes BEFORE /config in ROUTE_MODULE_MAP, admin/ti/superadmin write + auditor/dpo/socio readOnly | VERIFIED | `src/proxy.ts` line 14 ModuleKey includes 'integracoes'; ROUTE_MODULE_MAP lines 41-42 correct order; MODULE_PERMISSIONS lines 22-30 confirm all roles |
| 9 | /config/integracoes page: RBAC-gated RSC (6 roles), loads listConnectors + listConnectorHealth server-side, renders IntegrationsManager with masked credential only; credential_enc never referenced in client component | VERIFIED | `page.tsx` server-side data load confirmed; `IntegrationsManager.tsx` renders `credential_masked` only; grep for `credential_enc` in client file shows zero hits (only in comment using "ciphertext column" alias) |

**Score:** 9/9 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/20260615000400_integration_connectors.sql` | Table + index + RLS + seed | VERIFIED | 59 lines; clinic_id NULLABLE, credential_enc TEXT, status CHECK, RLS USING+WITH CHECK, 3 system seed rows |
| `supabase/migrations/20260615000500_integration_events.sql` | Table + 3 indexes + RLS | VERIFIED | 43 lines; TEXT CHECK (not ENUM), connector_id FK SET NULL, 3 indexes, RLS read-only for tenant |
| `supabase/migrations/20260615000600_integration_revoke.sql` | REVOKE SELECT (credential_enc) FROM authenticated, anon | VERIFIED | 12 lines; exact REVOKE statement present |
| `src/lib/integrations/types.ts` | ConnectorRow, IntegrationEventRow, ConnectorHealth types | VERIFIED | EXISTS (confirmed by imports across codebase) |
| `src/lib/integrations/mask.ts` | maskCredential pure util, NO 'use server' | VERIFIED | 30 lines; no 'server-only', no 'use server'; pure function |
| `src/lib/integrations/health.ts` | deriveHealth pure function, 24h window | VERIFIED | 41 lines; 24h cutoff, >=50% failed → 'failed', 0 failed → 'ok', else 'degraded' |
| `src/lib/integrations/hub-log.ts` | logToHub server-only, null-safe connector, inserts integration_events | VERIFIED | 68 lines; `import 'server-only'`; null-safe via try/catch + maybeSingle; inserts only IDs/status |
| `src/lib/integrations/worker.ts` | drainIntegrationEvents server-only, CAS claim | VERIFIED | 113 lines; `import 'server-only'`; CAS .eq('status','pending').eq('attempts',...) confirmed |
| `src/lib/validators/connector.ts` | Zod v3 connectorFormSchema without .default() | VERIFIED | EXISTS; used in integration-connectors.ts |
| `src/actions/integration-connectors.ts` | createConnector/update/list/delete + ConnectorPublic | VERIFIED | 349 lines; all 4 exports; ConnectorPublic = Omit<ConnectorRow,'credential_enc'> + credential_masked |
| `src/actions/integration-events.ts` | listConnectorHealth + reprocessConnector | VERIFIED | 239 lines; assertNotReadOnly() first in reprocessConnector; deriveHealth called; no payload bodies |
| `src/app/api/cron/integration-retry/route.ts` | nodejs runtime, isCronAuthorized, drainIntegrationEvents, 401 | VERIFIED | 36 lines; all four requirements present |
| `src/app/(dashboard)/config/integracoes/page.tsx` | RSC, 6-role gate, listConnectors + listConnectorHealth, IntegrationsManager | VERIFIED | 107 lines; server-side data load; PERMITTED_ROLES array; passes only plain arrays |
| `src/components/config/IntegrationsManager.tsx` | 'use client', credential_masked render, reprocessConnector, no credential_enc | VERIFIED | 500+ lines; credential_masked rendered; reprocessConnector imported; `credential_enc` absent from source |
| `src/types/database.types.ts` | Contains integration_connectors + integration_events, >1000 lines | VERIFIED | 2221 lines; both tables at lines 1271/1312 |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `integration-connectors.ts` | `src/lib/crypto.ts` | `encrypt(credential)` before insert | VERIFIED | Line 134: `const credentialEnc = encrypt(credential)` |
| `integration-connectors.ts` | `integration_connectors` table | `createAdminClient().from('integration_connectors').insert` | VERIFIED | Line 139: `.from('integration_connectors').insert({...})` |
| `asaas/route.ts` | `hub-log.ts` | `logToHub(...).catch(...)` fire-and-forget | VERIFIED | Lines 68-72: import + `.catch((err) => console.error(...))` |
| `whatsapp/route.ts` | `hub-log.ts` | `logToHub(...).catch(...)` fire-and-forget | VERIFIED | Lines 123-127: same pattern |
| `integration-retry/route.ts` | `worker.ts` | `drainIntegrationEvents()` | VERIFIED | Line 33: direct call |
| `proxy.ts ROUTE_MODULE_MAP` | `integracoes` module | `/config/integracoes` prefix before `/config` | VERIFIED | Lines 41-42: correct most-specific-first order |
| `page.tsx` | `listConnectors` + `listConnectorHealth` | server-side await in RSC | VERIFIED | Lines 83-84: both awaited before rendering IntegrationsManager |
| `IntegrationsManager.tsx` | `reprocessConnector` | onClick → server action | VERIFIED | Line 440: `await reprocessConnector(connectorId)` |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `IntegrationsManager.tsx` | `connectors` prop | `listConnectors()` → `createAdminClient().from('integration_connectors').select(...)` → DB | Yes — real DB query tenant-scoped | FLOWING |
| `IntegrationsManager.tsx` | `health` prop | `listConnectorHealth()` → `createAdminClient().from('integration_events').select(...)` → `deriveHealth()` | Yes — real DB query + pure computation | FLOWING |
| `IntegrationsManager.tsx` | `credential_masked` field | `listConnectors()` → `decrypt(row.credential_enc)` → `maskCredential()` | Yes — decrypts server-side, only tail reaches client | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full integration test suite GREEN (86 tests) | `npx vitest run src/__tests__/integrations/` | 3 files, 86 tests, 0 failures | PASS |
| Regression tests GREEN (webhooks + RBAC) | `npx vitest run asaas.test.ts whatsapp.test.ts rbac.test.ts matrix.test.ts` | 4 files, 63 tests, 0 failures | PASS |
| Full test suite GREEN (no regressions) | `npx vitest run` | 51 files, 798 tests, 0 failures | PASS |
| TypeScript compiler clean | `npx tsc --noEmit` | exit 0, no output | PASS |
| Next.js build clean | `npx next build` | `/config/integracoes` in output; only harmless Turbopack lockfile warning | PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| INT-01 | Plans 02, 04, 05 | Admin/TI cadastra conectores com credenciais armazenadas com segurança | SATISFIED | `integration_connectors` migration + REVOKE + createConnector (AES+assertNotReadOnly+Omit) + /config/integracoes management UI |
| INT-02 | Plans 03, 04 | Sistema recebe eventos externos via webhooks por conector | SATISFIED | `integration_events` migration + logToHub additive in Asaas/WhatsApp handlers (fire-and-forget, regression-safe) |
| INT-03 | Plans 02, 03, 04, 05 | Painel mostra saúde de cada integração e reenvia automaticamente em caso de falha | SATISFIED | deriveHealth(24h window) + /config/integracoes health panel + reprocessConnector (failed→pending) + drainIntegrationEvents cron (*/15) |

---

### Anti-Patterns Found

No blockers or warnings found.

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/lib/integrations/worker.ts` | 90-92 | Comment notes "no outbound protocol senders yet" for Phase 09 | INFO | Intentional — NFS-e/banco/TISS senders land in Phases 15/16; the CAS pattern is established for extension |

---

### Human Verification Required

These items cannot be verified programmatically. All automated checks passed (9/9 must-haves, 798/798 tests, tsc exit 0, next build clean).

#### 1. Register a Connector Live

**Test:** Navigate to `/config/integracoes` as admin, register a connector (e.g. type=asaas, fake credential `test-key-1234`), save, reload page.
**Expected:** Credential shows as `••••••1234` after save; reload still shows masked; Network tab shows no `credential_enc` field in response JSON.
**Why human:** Requires interactive browser session.

#### 2. Live Webhook Still Works (Asaas/WhatsApp)

**Test:** Trigger a test event from Asaas sandbox or WhatsApp test number; verify Supabase Dashboard shows new row in `integration_events` with `direction='inbound'` and `status='received'`.
**Expected:** Row appears in `integration_events`; the existing webhook handler returns HTTP 200; no regression in Asaas payment processing.
**Why human:** Requires external provider call to live endpoint.

#### 3. Failed Event Auto-Resend via Cron

**Test:** Manually insert a row into `integration_events` with `status='pending'`, `attempts=0`, `max_attempts=3`; wait for or manually invoke `GET /api/cron/integration-retry` (with valid CRON_SECRET); confirm row becomes `status='processed'`.
**Expected:** Worker drains the row atomically (CAS); no double-processing if triggered twice simultaneously.
**Why human:** Requires live DB state + HTTP call to cron endpoint with real CRON_SECRET.

#### 4. Health Panel Display

**Test:** With events in `integration_events` (some failed, some processed), navigate to `/config/integracoes` health panel.
**Expected:** Each connector shows correct ok/degraded/failed/unknown badge; Reprocess button appears only when failedCount > 0; clicking Reprocess shows "{n} eventos reenfileirados" feedback.
**Why human:** Visual UI state validation with real data.

#### 5. Read-Only Role Cannot Mutate

**Test:** Log in as a user with role `auditor` (or `dpo`/`socio`); navigate to `/config/integracoes`; attempt to register a connector or click Reprocess.
**Expected:** Panel visible (read-only); server returns `Acesso restrito` on any mutation attempt; `assertNotReadOnly()` throws before any DB write.
**Why human:** Requires real user session with read-only role.

---

### Gaps Summary

No gaps. All 9 must-haves verified against actual codebase (files read and confirmed, not trusted from SUMMARY). The 5 items above are normal human-UAT work for any shipped feature — they cannot be automated without a live browser, external providers, or a live cron scheduler.

---

## Gate Results

| Gate | Result | Details |
|------|--------|---------|
| `npx vitest run` | GREEN | 51 test files, 798 tests, 0 failures |
| `npx vitest run src/__tests__/integrations/` | GREEN | 3 files, 86 tests — all INT-01/02/03 assertions pass |
| `npx vitest run asaas.test.ts whatsapp.test.ts rbac.test.ts matrix.test.ts` | GREEN | 4 files, 63 tests — zero regressions |
| `npx tsc --noEmit` | GREEN | exit 0, no errors |
| `npx next build` | GREEN | `/config/integracoes` in output; only harmless Turbopack lockfile warning |

---

_Verified: 2026-06-14T17:42:23Z_
_Verifier: Claude (gsd-verifier)_
