---
phase: "05"
plan: "05"
subsystem: ai-agents
tags: [ai, collection-agent, whatsapp, outbox, agent-log, lgpd]
dependency_graph:
  requires: ["05-01", "05-02", "05-04", "03-02"]
  provides: ["AI-03", "agent-outreach-log-page"]
  affects: ["src/lib/agents", "src/actions", "src/components/copilot", "src/app/(dashboard)/clinica/ia"]
tech_stack:
  added: []
  patterns:
    - "AI SDK v6 generateText for LLM text personalization (first name + amount only, ZDR)"
    - "getInvoiceUrl hard invariant: real Asaas link only, abort on null (D-04)"
    - "LLM fallback to static neutral message when AI_GATEWAY_API_KEY absent"
    - "agent_outreach_log insert after successful outbox enqueue (audit trail)"
    - "Server Action with createClient() RLS for tenant-scoped read"
    - "Patient name masking: FirstName L. (SEC-01)"
key_files:
  created:
    - src/lib/agents/collection-agent.ts
    - src/app/api/cron/collection-agent/route.ts
    - src/actions/agent-outreach.ts
    - src/components/copilot/AgentOutreachLog.tsx
    - src/app/(dashboard)/clinica/ia/agentes/page.tsx
  modified:
    - vercel.json
decisions:
  - "LLM personalization (buildCollectionMessage) uses only first name + amount — no CPF/health data (RESEARCH Pattern 6, T-5-collect-I)"
  - "collection-agent cron at 13:00 UTC (10:00 BRT) — one hour after confirmation-agent (12:00) to avoid outbox contention"
  - "collection-agent and collection-ruler coexist: ruler=template reminders+email, agent=AI-03 LLM-personalized WhatsApp"
  - "Patient name masked to FirstName L. in agent log (SEC-01) via maskPatientName() in listAgentOutreach Server Action"
metrics:
  duration_minutes: 15
  completed_date: "2026-06-11"
  tasks_completed: 3
  files_changed: 6
requirements_satisfied: [AI-03]
---

# Phase 05 Plan 05: AI-03 Collection Agent + Agent Outreach Log Page Summary

**One-liner:** AI-03 autonomous collection agent with LLM-personalized pt-BR text, real Asaas getInvoiceUrl (abort on null), outbox enqueue, agent_outreach_log audit, plus read-only /clinica/ia/agentes staff visibility page (RLS-scoped, masked names).

---

## What Was Built

### Task 1: Collection Agent (`collection-agent.ts`)

`src/lib/agents/collection-agent.ts` — AI-03 main entry point.

- `buildCollectionMessage(firstName, amount)`: calls AI SDK v6 `generateText` with model `anthropic/claude-sonnet-4.6`, ZDR enabled, system prompt explicitly forbids URL/link generation. Falls back to neutral static message when `AI_GATEWAY_API_KEY` is absent or LLM throws.
- `runCollectionAgent(admin)`: scans all overdue receivables (`status='pendente'`, `due_date < today`) with LGPD predicates (`deleted_at IS NULL`, `is_anonymized=false`). For each: resolves real Asaas link via `gateway.getInvoiceUrl(provider_charge_id)` — skips on null (D-04 hard invariant). Enqueues via `getOutboxQueue` with idempotency key `collection-agent:{id}:{date}`. Writes `agent_outreach_log` + fires `logBusinessEvent` on success. Returns `{ enqueued, skipped }`.

**Hard invariant satisfied:** file references `getInvoiceUrl`, `getOutboxQueue`, `logBusinessEvent`, `agent_outreach_log`; contains no `asaas.com/i/` literal or template-literal URL construction.

### Task 2: Cron Route + vercel.json

`src/app/api/cron/collection-agent/route.ts` — `export const runtime = 'nodejs'`. `isCronAuthorized` guard (401 fail-closed). Calls `runCollectionAgent(admin)` then `drainOutbox(admin)`. Returns JSON `{ enqueued, skipped, whatsapp_drained, whatsapp_failed }`.

`vercel.json` — added `{ "path": "/api/cron/collection-agent", "schedule": "0 13 * * *" }`. Preserved `regions: ["gru1"]` and all three existing cron entries.

### Task 3: Agent Outreach Action + Component + Page

`src/actions/agent-outreach.ts` — `'use server'`. `listAgentOutreach()` uses `createClient()` (RLS — tenant auto-scoped via `agent_outreach_log` SELECT policy). Selects `id, agent_type, status, created_at, patients(full_name)` ordered by `created_at desc` limit 20. Patient name masked to `FirstName L.` via `maskPatientName()`.

`src/components/copilot/AgentOutreachLog.tsx` — read-only table with columns Tipo | Paciente | Status | Data/Hora. Maps `agent_type` → "Confirmação de consulta"/"Cobrança automática"; `status` → Enviado/Entregue/Respondido/Falhou/Ambíguo. `date-fns` ptBR formatting. Empty state copy per §Copywriting Contract. No action buttons.

`src/app/(dashboard)/clinica/ia/agentes/page.tsx` — Server Component. Calls `listAgentOutreach()`, renders breadcrumb "Clínica > IA > Agentes", title "Ações dos Agentes IA", and `<AgentOutreachLog rows={rows} />`. CopilotTrigger present via `clinica/layout.tsx` parent.

---

## Verification Results

- `npx vitest run src/__tests__/ai/collection-agent.test.ts` — 10/10 GREEN
- `npx vitest run` (full suite) — 368/368 GREEN across 33 test files
- `npx tsc --noEmit` — exit 0 (no errors)
- `npx next build` — clean; `/clinica/ia/agentes` appears in output as `ƒ (Dynamic)`

---

## Deviations from Plan

### Resume state — collection-agent.ts pre-existed uncommitted

The file `src/lib/agents/collection-agent.ts` was already written by a prior run but was uncommitted and untracked. After reading and verifying it fully satisfied all plan requirements (getInvoiceUrl, no fabricated URL, getOutboxQueue, logBusinessEvent, agent_outreach_log, LGPD predicates, ZDR, fallback), it was committed as-is without modification.

No functional deviations — plan executed as specified.

---

## Known Stubs

None. All data flows are wired:
- `listAgentOutreach()` queries real `agent_outreach_log` rows via Supabase
- `runCollectionAgent()` calls real `gateway.getInvoiceUrl` (live Asaas API)
- Live WhatsApp send is UAT-deferred (Meta Business verification) — this is documented in the plan and not a stub; the outbox worker sends when `drainOutbox` is called

---

## Threat Surface Scan

No new network endpoints or trust boundaries beyond what was planned in the threat model:

| File | Disposition |
|------|------------|
| `/api/cron/collection-agent` | Planned in threat model T-5-collect-cron; cron-auth bearer guard applied |
| `agent_outreach_log` read in Server Action | Planned in T-5-collect-tenant; createClient() RLS SELECT policy enforces tenant isolation |

---

## Self-Check: PASSED

All files exist on disk. All 3 task commits confirmed in git log:
- `ff6eeb5` — collection-agent.ts
- `9877dcb` — cron route + vercel.json
- `2d96486` — action + component + page

Full suite: 368/368 GREEN. tsc: exit 0. next build: clean.
