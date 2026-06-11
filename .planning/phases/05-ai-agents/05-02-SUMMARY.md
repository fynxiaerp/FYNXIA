---
phase: "05-ai-agents"
plan: "02"
subsystem: "ai-copilot"
tags: ["ai-sdk-v6", "vercel-ai-gateway", "lgpd", "pii-masking", "tools", "streaming"]
dependency_graph:
  requires:
    - "05-01"  # agent_outreach_log + whatsapp_inbound_events tables; database.types.ts
    - "04-01"  # createClient (RLS-aware) from src/lib/supabase/server
    - "03-01"  # receivables table (getOverdueReceivables)
    - "02-01"  # appointments + patients tables (getTodayAppointments, getPatientSummary)
  provides:
    - "POST /api/copilot streaming endpoint (AI-01)"
    - "src/lib/ai/masking.ts — maskCPF, maskPhone helpers (reusable by future plans)"
    - "src/lib/ai/help-docs.ts — HELP_DOCS + searchHelpDocs (D-03 help/FAQ)"
    - "src/lib/ai/tools.ts — 4 read-only tenant-scoped tools"
  affects:
    - "05-03 (copilot UI) — consumes POST /api/copilot via useChat"
tech_stack:
  added:
    - "ai@6.0.200 (streamText, tool, convertToModelMessages, stepCountIs, UIMessage)"
    - "@ai-sdk/react@3.0.202 (useChat — consumed by 05-03)"
    - "@ai-sdk/gateway@3.0.127 (GatewayProviderOptions type for ZDR)"
  patterns:
    - "AI SDK v6 tool() with inputSchema: z.object({}) (NOT parameters — confirmed from type defs)"
    - "streamText + toUIMessageStreamResponse() for useChat v6 compatibility"
    - "call-time credential read for AI_GATEWAY_API_KEY (same lazy pattern as WHATSAPP_*, getResend)"
    - "zeroDataRetention: true per-request in providerOptions.gateway (D-02 LGPD)"
    - "stopWhen: stepCountIs(5) — replaces removed maxSteps from AI SDK v4/v5"
    - "convertToModelMessages() — replaces removed convertToCoreMessages from AI SDK v4/v5"
key_files:
  created:
    - "src/lib/ai/masking.ts"
    - "src/lib/ai/help-docs.ts"
    - "src/lib/ai/tools.ts"
    - "src/app/api/copilot/route.ts"
  modified:
    - "package.json (ai, @ai-sdk/react, @ai-sdk/gateway added)"
    - "package-lock.json"
    - ".env.local.example (AI_GATEWAY_API_KEY, WHATSAPP_APP_SECRET, WHATSAPP_WEBHOOK_VERIFY_TOKEN)"
decisions:
  - "AI SDK v6 tool() uses inputSchema (not parameters) — RESEARCH Assumption A1 was incorrect; confirmed from @ai-sdk/provider-utils type definitions at node_modules"
  - "maskCPF keeps LAST 2 digits (***.***.***-XX) — differs from PatientTable.tsx which keeps FIRST 3; plan explicitly specifies last-2 for copilot tools"
  - "inputSchema with zod v3 z.object() confirmed working — no type errors"
metrics:
  duration: "~18 minutes"
  completed: "2026-06-10"
  tasks_completed: 3
  tasks_total: 3
  files_created: 4
  files_modified: 3
---

# Phase 05 Plan 02: AI Copilot Backend Summary

**One-liner:** AI SDK v6 copilot backend with streaming Route Handler, 4 read-only RLS-scoped tools, PII masking (CPF/phone/email), ZDR via Vercel AI Gateway, and curated pt-BR help/FAQ (D-03).

## What Was Built

### Task 1 — AI SDK v6 + PII Masking + Curated Help Docs (commit `45870d7`)

**`src/lib/ai/masking.ts`** — `import 'server-only'`:
- `maskCPF(cpf)`: strips non-digits, keeps last 2 verifier digits → `***.***.***-00`
- `maskPhone(phone)`: keeps last 4 digits → `(**) *****-1234` (mobile) or `(**) ****-1234` (landline)

**`src/lib/ai/help-docs.ts`** — `import 'server-only'`:
- `HELP_DOCS`: 8 curated pt-BR how-to entries covering: cadastrar paciente, criar/remarcar consulta, registrar prontuário, usar odontograma, gerar cobrança, ver fluxo de caixa, régua de cobrança, módulos do sistema
- `searchHelpDocs(query)`: case-insensitive keyword/topic scoring → top 3 matches (pure function)

**`package.json`**: `ai@^6.0.200`, `@ai-sdk/react@^3.0.202`, `@ai-sdk/gateway@^3.0.127` added.

**`.env.local.example`**: `AI_GATEWAY_API_KEY=` (server-only, no NEXT_PUBLIC_), `WHATSAPP_APP_SECRET=`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN=` added for Wave 3 needs.

### Task 2 — Read-Only Tenant-Scoped Copilot Tools (commit `2a6b09a`)

**`src/lib/ai/tools.ts`** — 4 exported tools, all using `createClient()` (RLS):

| Tool | Description |
|------|-------------|
| `getTodayAppointments` | Appointments for a date (default today); no CPF, no health columns; status != cancelado |
| `getOverdueReceivables` | Pending receivables with due_date < today (derived vencido, D-04 schema); patientName only |
| `getPatientSummary` | Patient lookup by name (ilike); CPF/phone/email masked; upcoming appt count |
| `searchHelpDocsTool` | Wraps `searchHelpDocs` from help-docs.ts (D-03 how-to) |

Security enforcement:
- `createClient()` only — RLS auto-isolates by tenant (T-5-tenant mitigated)
- No health data columns in any select (T-5-pii mitigated)
- No `.insert`/`.update`/`.delete`/`.upsert` calls anywhere (T-5-eop mitigated, D-05)

### Task 3 — Copilot Chat Route Handler (commit `ccf65eb`)

**`src/app/api/copilot/route.ts`**:
- `export const runtime = 'nodejs'` (TCP connections for Supabase)
- Auth gate: `supabase.auth.getUser()` → 401 if unauthenticated (T-5-auth mitigated)
- `AI_GATEWAY_API_KEY` read inside POST body — never module scope (T-5-secret + build safety)
- `streamText` with model `'anthropic/claude-sonnet-4.6'`, `convertToModelMessages`, `stepCountIs(5)`, `zeroDataRetention: true` (D-02)
- Returns `result.toUIMessageStreamResponse()` for `useChat` v6 compatibility
- System prompt (pt-BR): read-only orientation, no health data repeat (Pitfall 10 guardrail)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] AI SDK v6 `tool()` uses `inputSchema` not `parameters`**
- **Found during:** Task 2 TypeScript check (`npx tsc --noEmit`)
- **Issue:** RESEARCH Assumption A1 ("highest risk") materialized — the `tool()` function in `@ai-sdk/provider-utils` (re-exported via `ai`) uses `inputSchema: FlexibleSchema<INPUT>`, not `parameters`. The PLAN interfaces section referenced Vercel docs showing `parameters`, but the actual installed types (`node_modules/@ai-sdk/provider-utils/dist/index.d.ts` line 1087) use `inputSchema`.
- **Fix:** Renamed all `parameters: z.object({...})` to `inputSchema: z.object({...})` in `tools.ts`; also changed `execute: async ({ field }) =>` destructuring to `execute: async (input) => { const { field } = input }` to satisfy the TS overload.
- **Files modified:** `src/lib/ai/tools.ts`
- **Commit:** `ccf65eb` (combined with route handler commit)

**2. [Rule 1 - Bug] Source-inspection tests matched forbidden words in comments**
- **Found during:** Task 2 test run
- **Issue:** Test regex `/medical_history/i`, `/createAdminClient/`, `/(insert|update|delete|upsert)\(/` matched file comments, not code.
- **Fix:** Rephrased all comments in `tools.ts` and `route.ts` to avoid the exact forbidden strings without changing semantics.
- **Files modified:** `src/lib/ai/tools.ts`, `src/app/api/copilot/route.ts`
- **Commit:** `2a6b09a`, `ccf65eb`

**3. [Rule 1 - Bug] Supabase join cast error on `r.patient`**
- **Found during:** Task 3 TypeScript check
- **Issue:** Supabase infers `patient:patients(full_name)` as `{full_name: any}[]` (array) but the foreign key is many-to-one; direct cast to `{full_name: string}` (single object) caused TS2352.
- **Fix:** Used double-cast `as unknown as {full_name: string} | null` to satisfy compiler.
- **Files modified:** `src/lib/ai/tools.ts`
- **Commit:** `ccf65eb`

## Verification Results

```
npx vitest run src/__tests__/ai/tools.test.ts      → 12/12 PASSED
npx vitest run src/__tests__/ai/chat-route.test.ts  →  9/9 PASSED
npx tsc --noEmit                                    → exit 0 (clean)
npx next build                                      → clean (no errors; one pre-existing turbopack workspace-root warning)
```

## Known Stubs

None — all tools make real Supabase queries; masking is functional; help-docs are curated content (not placeholders); route handler is fully wired. No empty values or placeholder text flow to UI.

## Threat Flags

All threats from the plan's threat model were mitigated as implemented:

| Threat | Mitigation Applied |
|--------|--------------------|
| T-5-pii | maskCPF + maskPhone + maskEmail in tool outputs; no health columns in selects |
| T-5-tenant | createClient() (RLS) in all tools; no service-role client |
| T-5-eop | No write tools; no insert/update/delete/upsert anywhere in tools.ts |
| T-5-auth | supabase.auth.getUser() gate before any tool execution → 401 |
| T-5-secret | AI_GATEWAY_API_KEY read at call-time, server-only, no NEXT_PUBLIC_ |
| T-5-input | System prompt instructs no-repeat of CPF/health; ZDR prevents retention |

No new threat surface introduced beyond what was planned.

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| src/lib/ai/masking.ts exists | FOUND |
| src/lib/ai/help-docs.ts exists | FOUND |
| src/lib/ai/tools.ts exists | FOUND |
| src/app/api/copilot/route.ts exists | FOUND |
| commit 45870d7 exists | FOUND |
| commit 2a6b09a exists | FOUND |
| commit ccf65eb exists | FOUND |
| tools.test.ts 12/12 GREEN | PASSED |
| chat-route.test.ts 9/9 GREEN | PASSED |
| tsc --noEmit | exit 0 |
| next build | clean |
