---
phase: 05-ai-agents
verified: 2026-06-11T00:00:00Z
status: human_needed
score: 9/9 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Live copilot answer — tenant-scoped + ZDR"
    expected: >
      Log in as a clinic staff member, open /clinica/agenda, click the Bot trigger,
      ask 'Quais consultas tenho hoje?'. The streamed answer should list real appointments
      for that tenant only. Confirm no raw CPF or health data appears in the response.
    why_human: >
      Requires a live AI_GATEWAY_API_KEY (not provisioned in dev env). Automated
      checks confirm the route, tools, masking, and ZDR flag are correctly wired;
      the actual streaming answer can only be observed in a running app with a key.
  - test: "Confirmation agent — live WhatsApp send + inbound reply"
    expected: >
      Trigger /api/cron/confirmation-agent (or wait for 12:00 UTC cron). Confirm
      the next-day patient receives a WhatsApp confirmation request with CONFIRM/CANCEL
      buttons. Reply with a button — verify appointments.status changes to confirmado
      or cancelado in Supabase, and agent_outreach_log shows status='responded'.
    why_human: >
      Requires Meta Business verification (phone number verified, template approved)
      and a live WHATSAPP_APP_SECRET + WHATSAPP_PHONE_NUMBER_ID. Unit tests mock the
      WhatsApp client; live end-to-end delivery cannot be verified programmatically.
  - test: "Collection agent — live WhatsApp send with real Asaas payment link"
    expected: >
      Trigger /api/cron/collection-agent. Confirm an overdue patient receives a
      personalized pt-BR WhatsApp message containing the real Asaas invoiceUrl (the
      link must open the actual Asaas invoice page). Confirm agent_outreach_log shows
      status='sent' and logBusinessEvent recorded ai03.collection.sent.
    why_human: >
      Requires Meta Business verification + a live AI_GATEWAY_API_KEY for LLM
      personalization + a live Asaas sandbox/prod account where getInvoiceUrl returns
      real URLs. All three dependencies are UAT-deferred by design.
  - test: "Free-text inbound reply ownership verification (CR-01/CR-02 post-fix)"
    expected: >
      Patient at phone +5511999999990 sends free-text 'sim'. The webhook must resolve
      the appointment ONLY from agent_outreach_log rows where to_phone=+5511999999990,
      status='sent', within 48h. Confirm no cross-tenant or cross-patient resolution
      occurs. The matched 'sent' row must transition to 'responded'.
    why_human: >
      to_phone column requires supabase db push (migration 20260611000100) to be live.
      REVIEW-FIX.md confirms the migration is applied (Local==Remote migration list),
      but the end-to-end ownership logic is security-sensitive and warrants a manual
      smoke test with two tenants after the column is confirmed live.
---

# Phase 5: AI Agents Verification Report

**Phase Goal:** Clinic staff have an AI copilot available on every screen that answers contextual questions about the clinic's data, and autonomous agents handle appointment confirmations and overdue collection without human intervention.
**Verified:** 2026-06-11T00:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Copilot sidebar accessible from any /clinica/* page | VERIFIED | `clinica/layout.tsx` mounts `<CopilotTrigger />` which renders `<CopilotSidebar />`; fixed position, no reflow |
| 2 | Staff asks "Quais consultas tenho hoje?" and gets tenant-scoped answer via Vercel AI Gateway WITHOUT exposing raw patient data | VERIFIED (code) / human for live answer | route.ts: `createClient()` gate (401 if unauth), `AI_GATEWAY_API_KEY` call-time, `zeroDataRetention: true`, tools use RLS-only `createClient()`, no health columns, CPF/phone/email masked |
| 3 | Appointment confirmation agent autonomously sends WhatsApp confirmation request to next-day patients | VERIFIED (code) / UAT for live send | `confirmation-agent.ts`: scans tomorrow `status='agendado'`, enqueues via `getOutboxQueue` with per-appointment payloads, writes `agent_outreach_log{to_phone}`, cron at 12:00 UTC in `vercel.json` |
| 4 | Agent records the patient's confirm/cancel reply in appointments | VERIFIED (code) / UAT for live inbound | `webhooks/whatsapp/route.ts`: HMAC before JSON.parse, wamid dedup, `buttonPayloadToStatus` maps to `confirmado`/`cancelado`, `appointments.update` scoped by id+tenant_id |
| 5 | Free-text inbound replies are phone-bound (CR-01 fix applied) | VERIFIED | `to_phone` column in migration 20260611000100 (applied per REVIEW-FIX.md), `confirmation-agent.ts` writes `to_phone: to`, route filters by `.eq('to_phone', senderE164)` + 48h window |
| 6 | Ambiguous replies do NOT update appointments status (safe fallback) | VERIFIED | route.ts: `intentResult === 'ambiguous'` branch has no `appointments.update` call; logs to console + logBusinessEvent only |
| 7 | Collection agent identifies overdue receivables (pendente + due_date < today) | VERIFIED | `collection-agent.ts`: `.eq('status', 'pendente').lt('due_date', todayISO)` with LGPD predicates (`deleted_at IS NULL`, `is_anonymized=false`) |
| 8 | Collection agent uses real Asaas invoiceUrl (abort on null — never LLM-fabricated) | VERIFIED | `gateway.getInvoiceUrl(provider_charge_id)` called; `if (!paymentLink)` → `skipped++; continue`; no `asaas.com/i/` or `https://...${` in file |
| 9 | Each send logged to agent_outreach_log + audit trail | VERIFIED | Both agents: `admin.from('agent_outreach_log').insert(...)` after successful `queue.enqueue`; `logBusinessEvent` with `ai02.confirmation.sent` / `ai03.collection.sent` |

**Score:** 9/9 truths verified (code-level); 4 require UAT for live confirmation

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/20260610000100_agent_outreach_log.sql` | agent_outreach_log table + FK to clinics | VERIFIED | Contains `CREATE TABLE public.agent_outreach_log`, `REFERENCES public.clinics(id)`, `agent_type CHECK` |
| `supabase/migrations/20260610000200_agent_outreach_log_rls.sql` | SELECT-only RLS policy | VERIFIED | Contains `ENABLE ROW LEVEL SECURITY`, `FOR SELECT USING (tenant_id = get_my_tenant_id())`, no INSERT/UPDATE/DELETE policy |
| `supabase/migrations/20260610000300_whatsapp_inbound_events.sql` | wamid UNIQUE dedup table, no RLS | VERIFIED | Contains `wamid TEXT UNIQUE NOT NULL`, `processed BOOLEAN`, no `ENABLE ROW LEVEL SECURITY` |
| `supabase/migrations/20260611000100_agent_outreach_log_to_phone.sql` | to_phone column + index (CR-01 fix) | VERIFIED | Adds nullable `to_phone TEXT` + `idx_agent_outreach_log_to_phone_created`; applied to live DB per REVIEW-FIX.md |
| `src/lib/ai/masking.ts` | maskCPF/maskPhone helpers, server-only | VERIFIED | Exports `maskCPF`, `maskPhone`; `import 'server-only'`; maskCPF keeps last 2 digits |
| `src/lib/ai/help-docs.ts` | HELP_DOCS + searchHelpDocs (D-03) | VERIFIED | File exists, exports `HELP_DOCS` and `searchHelpDocs` |
| `src/lib/ai/tools.ts` | 4 read-only tenant-scoped tools | VERIFIED | Imports `createClient` (RLS); no `createAdminClient`; no health columns; no mutation methods; `maskEmail` declared before use (WR-01 fix applied) |
| `src/app/api/copilot/route.ts` | streamText handler, runtime nodejs, ZDR | VERIFIED | `export const runtime = 'nodejs'`; `zeroDataRetention: true`; `stepCountIs(5)`; `toUIMessageStreamResponse()`; `AI_GATEWAY_API_KEY` inside POST |
| `src/lib/stores/copilot-store.ts` | Zustand open/closed store | VERIFIED | File exists (SUMMARY-03 lists it as created) |
| `src/components/copilot/CopilotTrigger.tsx` | Fixed Bot trigger | VERIFIED | `fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40`; Bot/X icon toggle; aria-label/aria-expanded |
| `src/components/copilot/CopilotSidebar.tsx` | Sheet + useChat (v6) | VERIFIED | `useChat({ transport: copilotTransport })`; `DefaultChatTransport({ api: '/api/copilot' })`; `sendMessage`/`status`/`setMessages` (v6 API) |
| `src/components/copilot/MessageList.tsx` | ScrollArea + aria-live | VERIFIED | File exists; aria-live="polite" per SUMMARY-03 |
| `src/components/copilot/MessageBubble.tsx` | message.parts rendering | VERIFIED | File exists; renders `message.parts` filtering `part.type === 'text'` per SUMMARY-03 |
| `src/components/copilot/SuggestedPrompts.tsx` | Context-aware chips by pathname | VERIFIED | File exists; `usePathname()` per SUMMARY-03 |
| `src/components/copilot/CopilotInput.tsx` | Textarea + send + clear | VERIFIED | File exists; Enter submits, D-05 no mutation buttons per SUMMARY-03 |
| `src/app/(dashboard)/clinica/layout.tsx` | Mounts CopilotTrigger on all /clinica/* | VERIFIED | Renders `{children}` + `<CopilotTrigger />`; Server Component |
| `src/lib/whatsapp/verify-signature.ts` | HMAC-SHA256 verifier, timingSafeEqual | VERIFIED | `crypto.createHmac('sha256')` + `crypto.timingSafeEqual`; rejects non-`sha256=` headers; catch → false |
| `src/lib/whatsapp/inbound-types.ts` | WhatsApp inbound payload types | VERIFIED | File exists (SUMMARY-04) |
| `src/lib/ai/whatsapp-intent.ts` | buttonPayloadToStatus + classifyConfirmationIntent | VERIFIED | Pure mapper returns `confirmado`/`cancelado`; LLM fallback returns `'ambiguous'`; key read at call-time |
| `src/app/api/webhooks/whatsapp/route.ts` | GET verify + POST inbound handler | VERIFIED | `runtime = 'nodejs'`; GET hub.challenge; POST: `request.text()` before JSON.parse; HMAC verify; wamid dedup; phone-bound free-text resolution |
| `src/lib/agents/confirmation-agent.ts` | AI-02 send side | VERIFIED | Scans tomorrow; enqueues with `buildAppointmentConfirmationComponents`; writes `agent_outreach_log{to_phone}`; `logBusinessEvent` |
| `src/app/api/cron/confirmation-agent/route.ts` | Cron route, cron-auth guarded | VERIFIED | `runtime = 'nodejs'`; `isCronAuthorized`; calls `runConfirmationAgent()` + `drainOutbox` |
| `src/lib/agents/collection-agent.ts` | AI-03 collection agent | VERIFIED | `getInvoiceUrl` call; abort on null; LLM text only (first name + amount, ZDR); `getOutboxQueue`; `logBusinessEvent`; `agent_outreach_log` |
| `src/app/api/cron/collection-agent/route.ts` | Cron route, cron-auth guarded | VERIFIED | `runtime = 'nodejs'`; `isCronAuthorized`; calls `runCollectionAgent()` + `drainOutbox` |
| `src/actions/agent-outreach.ts` | Server Action, RLS-scoped, masked names | VERIFIED | `'use server'`; `createClient()` (RLS); selects from `agent_outreach_log` limit 20 desc; `maskPatientName()` |
| `src/components/copilot/AgentOutreachLog.tsx` | Read-only 4-column table | VERIFIED | Renders Tipo/Paciente/Status/Data/Hora; pt-BR labels; no action buttons |
| `src/app/(dashboard)/clinica/ia/agentes/page.tsx` | Agent log page, Server Component | VERIFIED | Calls `listAgentOutreach()`; title "Ações dos Agentes IA"; renders `<AgentOutreachLog rows={rows} />` |
| `src/types/database.types.ts` | Includes agent_outreach_log, whatsapp_inbound_events, to_phone | VERIFIED | agent_outreach_log Row/Insert/Update at line 42; whatsapp_inbound_events at line 1370; `to_phone: string | null` at lines 54/69/84 |
| `vercel.json` | Both agent crons + gru1 region | VERIFIED | `confirmation-agent` at `0 12 * * *`; `collection-agent` at `0 13 * * *`; `regions: ["gru1"]`; existing crons preserved |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `clinica/layout.tsx` | `CopilotTrigger` | import + render | WIRED | `import { CopilotTrigger } from '@/components/copilot/CopilotTrigger'`; rendered as `<CopilotTrigger />` |
| `CopilotSidebar.tsx` | `/api/copilot` | DefaultChatTransport | WIRED | `new DefaultChatTransport({ api: '/api/copilot' })`; passed to `useChat({ transport: copilotTransport })` |
| `route.ts (copilot)` | `src/lib/ai/tools.ts` | tools: {} in streamText | WIRED | All 4 tools imported and registered in `tools: { getTodayAppointments, getOverdueReceivables, getPatientSummary, searchHelpDocs: searchHelpDocsTool }` |
| `tools.ts` | `createClient` (RLS) | import from @/lib/supabase/server | WIRED | `import { createClient } from '@/lib/supabase/server'`; called inside each tool's execute |
| `webhooks/whatsapp/route.ts` | `whatsapp_inbound_events` | wamid dedup insert | WIRED | `admin.from('whatsapp_inbound_events').insert({ wamid, from_phone, payload })`; 23505 → idempotent skip |
| `webhooks/whatsapp/route.ts` | `appointments.status` | update scoped by id+tenant_id | WIRED | `.update({ status: newStatus }).eq('id', appointmentId).eq('tenant_id', tenantId)` |
| `confirmation-agent.ts` | `agent_outreach_log` | insert after enqueue (with to_phone) | WIRED | `admin.from('agent_outreach_log').insert({ ..., to_phone: to })` |
| `collection-agent.ts` | `gateway.getInvoiceUrl` | real Asaas link (abort on null) | WIRED | `await gateway.getInvoiceUrl(receivable.provider_charge_id)`; `if (!paymentLink) { skipped++; continue }` |
| `collection-agent.ts` | `agent_outreach_log` | insert after successful enqueue | WIRED | `admin.from('agent_outreach_log').insert({ agent_type:'collection', receivable_id, status:'sent' })` |
| `agentes/page.tsx` | `AgentOutreachLog` | import + render with rows | WIRED | `import { AgentOutreachLog }` + `<AgentOutreachLog rows={rows} />` |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `CopilotSidebar.tsx` | `messages` from `useChat` | POST /api/copilot → streamText → RLS tools | Real Supabase queries via createClient() (RLS) | FLOWING (code); UAT for live stream |
| `AgentOutreachLog.tsx` | `rows` prop | `listAgentOutreach()` Server Action → `agent_outreach_log` table | Real DB query, RLS-scoped, limit 20 desc | FLOWING |
| `agentes/page.tsx` | `rows = await listAgentOutreach()` | `agent_outreach_log` via `createClient()` | RLS SELECT policy applied | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Check | Status |
|----------|-------|--------|
| tools.ts: no health columns | `grep -r "medical_history\|allergies\|medications\|anamnes" src/lib/ai/tools.ts` | PASS — no matches |
| tools.ts: no mutation methods | `grep -r "\.insert\|\.update\|\.delete\|\.upsert" src/lib/ai/tools.ts` | PASS — only `.is('deleted_at', null)` (filter, not mutation) |
| tools.ts: no createAdminClient | `grep "createAdminClient" src/lib/ai/tools.ts` | PASS — no matches |
| route.ts: AI_GATEWAY_API_KEY inside POST | Verified in source: line 46 inside `export async function POST` | PASS |
| route.ts: zeroDataRetention | `grep "zeroDataRetention" src/app/api/copilot/route.ts` | PASS — line 65 |
| collection-agent: no fabricated URL | `grep "asaas.com/i/" src/lib/agents/collection-agent.ts` + `grep "https://.*\${" ...` | PASS — no matches |
| collection-agent: getInvoiceUrl abort-on-null | Source review line 184: `if (!paymentLink) { skipped++; continue }` | PASS |
| webhook: request.text() before JSON.parse | Source review line 63 (`request.text()`) precedes line 75 (`JSON.parse`) | PASS |
| webhook: HMAC verify before processing | Source review lines 66-70: signature check returns 403 before dedup/processing | PASS |
| webhook: wamid dedup 23505 idempotent skip | Source review lines 104-108: `if (insertError.code === '23505') return 200` | PASS |
| webhook: CR-01 phone-bound resolution | `grep "to_phone.*senderE164" route.ts` → line 176 `.eq('to_phone', senderE164)` | PASS |
| webhook: CR-02 ownership check | Source review lines 212-220: `toE164(apptPatient?.phone)` vs `senderE164` | PASS |
| webhook: ambiguous → no appointments update | Source review: `intentResult === 'ambiguous'` path has no `.update` on appointments | PASS |
| confirmation-agent: to_phone recorded | Source review line 160: `to_phone: to` in `agent_outreach_log.insert` | PASS |
| vercel.json: gru1 + both agent crons | File content verified: gru1 + confirmation-agent 0 12 + collection-agent 0 13 | PASS |
| D-05 read-only: no write actions in copilot panel | CopilotTrigger.tsx, CopilotSidebar.tsx, CopilotInput.tsx, MessageBubble.tsx reviewed — no mutation buttons | PASS |

---

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| AI-01 | 05-02, 05-03 | Copiloto IA disponível em toda tela via chat lateral (Vercel AI Gateway) | SATISFIED | Trigger in layout.tsx; Sidebar with useChat v6 → /api/copilot; tools with RLS, masking, ZDR; tsc + next build clean |
| AI-02 | 05-04 | Agente autônomo confirma consultas do dia seguinte via WhatsApp e registra resposta | SATISFIED (code) | confirmation-agent.ts + cron; webhook with HMAC/dedup/phone-bound reply + CR-01/CR-02 fix; UAT-deferred for live delivery |
| AI-03 | 05-05 | Agente autônomo identifica inadimplentes e envia mensagem de cobrança personalizada | SATISFIED (code) | collection-agent.ts: overdue scan, LLM text, real getInvoiceUrl (abort-on-null), outbox enqueue, agent_outreach_log audit; UAT-deferred for live delivery |

---

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| (none) | — | — | All critical/warning findings from 05-REVIEW.md were fixed in 05-REVIEW-FIX.md (commit 862019b): CR-01 cross-tenant free-text (to_phone binding), CR-02 ownership check, WR-02 fake tenant_id FK violation, WR-03 stale sent row re-match, WR-04 misleading eslint-disable. WR-01 maskEmail hoisting fixed in commit 63146b5. Info findings IN-01..IN-04 are low-severity and out of scope. |

---

### Human Verification Required

#### 1. Live Copilot Answer (AI-01 end-to-end)

**Test:** Log in as clinic staff, navigate to `/clinica/agenda`, click the Bot trigger. Ask "Quais consultas tenho hoje?". Then ask "Como cadastro um paciente?" (help/FAQ path).
**Expected:**
- Streamed answer lists real appointments for that tenant only.
- No raw CPF or health data (medical_history/allergies/medications) appears in the response.
- How-to question returns useful guidance from curated HELP_DOCS (D-03).
- Trigger also visible on `/clinica/financeiro` and `/clinica/pacientes` with context-appropriate chips.
- "Limpar conversa" clears messages without dialog.
- No action buttons (Confirmar/Remarcar/Gerar cobrança) exist in the panel (D-05).
**Why human:** Requires `AI_GATEWAY_API_KEY` (not provisioned in dev env). Automated checks confirm correct wiring; the actual LLM stream can only be verified with a live key. Without the key, the route returns 503 — the UI graceful-error path is also acceptable to confirm visually.

#### 2. Confirmation Agent Live Delivery (AI-02 send side)

**Test:** Trigger `GET /api/cron/confirmation-agent` with the `CRON_SECRET` bearer token. Confirm the target patient's WhatsApp number receives a message with CONFIRM/CANCEL buttons. Reply with the CONFIRM button.
**Expected:**
- Patient receives a WhatsApp template message with two buttons labeled "Confirmar" / "Cancelar".
- Button reply is captured by `POST /api/webhooks/whatsapp`.
- `appointments.status` changes from `agendado` to `confirmado` in Supabase.
- `agent_outreach_log` row shows `status='responded'`, `intent_result='confirm'`.
**Why human:** Requires Meta Business API verification, approved template, live `WHATSAPP_APP_SECRET`, `WHATSAPP_PHONE_NUMBER_ID`. Unit tests mock the outbox client; live delivery cannot be verified programmatically.

#### 3. Collection Agent Live Delivery (AI-03 end-to-end)

**Test:** Trigger `GET /api/cron/collection-agent` with the `CRON_SECRET` bearer token (with at least one overdue receivable with a `provider_charge_id`). Confirm the outbound WhatsApp message.
**Expected:**
- Patient receives a personalized pt-BR 1-2 sentence message with a real Asaas invoice link.
- The link opens the actual Asaas invoice page (not a fabricated URL).
- `agent_outreach_log` shows `agent_type='collection'`, `status='sent'`.
- `logBusinessEvent` entry with `action='ai03.collection.sent'` in audit_logs.
**Why human:** Requires live AI_GATEWAY_API_KEY (LLM text personalization), live Asaas API (getInvoiceUrl), and Meta Business verification. The null-link abort path can be confirmed by ensuring a receivable without `provider_charge_id` increments `skipped`.

#### 4. Free-text Inbound Ownership Logic (CR-01/CR-02 security path)

**Test:** With two tenants (Clinic A and Clinic B) each having a next-day appointment, trigger the confirmation agent for both. Then send a free-text "sim" from Clinic A's patient phone to the webhook.
**Expected:**
- Only Clinic A's appointment status changes to `confirmado`.
- Clinic B's appointment is not affected.
- The matched `agent_outreach_log` row transitions from `status='sent'` to `status='responded'`.
- A second "sim" from the same number (after the row is `responded`) finds no `sent` match → logs `ambiguous`, no double-update.
**Why human:** The `to_phone` column (migration 20260611000100) must be live. The logic involves a time-window query and ownership comparison — security-sensitive conditionals best validated with real data across two tenants.

---

## Summary

Phase 5 (AI Agents) achieves all three requirements (AI-01, AI-02, AI-03) at the code + unit-test level. The implementation is architecturally sound:

- **AI-01 copilot:** Fully wired — trigger on every `/clinica/*` page via layout.tsx, AI SDK v6 streaming with `DefaultChatTransport`, read-only tenant-scoped tools (RLS-only `createClient()`), CPF/phone/email masked, ZDR enabled, no health columns, no write tools (D-05), 401 auth gate.
- **AI-02 confirmation agent:** Confirmation send side enqueues per-appointment routable payloads with `to_phone` recorded. Inbound webhook verifies HMAC on raw body, dedups by `wamid`, maps button payloads to Portuguese statuses (`confirmado`/`cancelado`), uses phone-bound 48h window for free-text (CR-01 fix), verifies sender ownership before updating (CR-02 fix), ambiguous → no appointment change (safe fallback).
- **AI-03 collection agent:** Scans overdue receivables with LGPD predicates, calls `gateway.getInvoiceUrl` with abort-on-null (no fabricated links), LLM personalizes text with first name + amount only (ZDR), enqueues via outbox with idempotency key, writes `agent_outreach_log` + fires `logBusinessEvent`.
- All review findings (2 critical, 4 warnings from 05-REVIEW.md) were fixed in 05-REVIEW-FIX.md. Final gates: 368/368 Vitest GREEN, tsc exit 0, next build clean.

The phase is blocked only on 4 UAT items that require live credentials (AI_GATEWAY_API_KEY, Meta Business verification, Asaas prod/sandbox) — all explicitly deferred by design per the phase context.

---

_Verified: 2026-06-11T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
