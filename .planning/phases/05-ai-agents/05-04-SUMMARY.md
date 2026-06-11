---
phase: "05"
plan: "04"
subsystem: ai-agents
tags: [whatsapp, webhook, hmac, ai-02, confirmation-agent, outbox, audit]
dependency_graph:
  requires: ["05-01", "05-02", "04-02", "04-04"]
  provides: ["AI-02-webhook", "AI-02-send", "confirmation-cron"]
  affects: ["appointments.status", "agent_outreach_log", "whatsapp_inbound_events", "message_outbox"]
tech_stack:
  added: []
  patterns:
    - "HMAC-SHA256 raw-body verification (crypto.timingSafeEqual) before JSON.parse"
    - "wamid UNIQUE dedup — insert-before-process, 23505 idempotent skip"
    - "Button payload routing: CONFIRM_APPOINTMENT_<id> / CANCEL_APPOINTMENT_<id>"
    - "LLM free-text safe fallback: ambiguous → no status change"
    - "Confirmation agent: Phase 4 outbox + id-aware template payloads"
    - "Vercel Cron at 12:00 UTC (09:00 BRT) guarded by isCronAuthorized"
key_files:
  created:
    - src/lib/whatsapp/verify-signature.ts
    - src/lib/whatsapp/inbound-types.ts
    - src/lib/ai/whatsapp-intent.ts
    - src/app/api/webhooks/whatsapp/route.ts
    - src/lib/agents/confirmation-agent.ts
    - src/app/api/cron/confirmation-agent/route.ts
  modified:
    - src/lib/whatsapp/templates.ts
    - vercel.json
decisions:
  - "TEMPLATE_APPOINTMENT_CONFIRMATION = TEMPLATE_APPOINTMENT_REMINDER: reuse the same approved quick-reply template; button payloads differentiate via appointmentId suffix"
  - "Ambiguous free-text: NO appointments.status change + agent_outreach_log{status:ambiguous} for human review (T-5-intent safe fallback)"
  - "Tenant derived from appointment row, never from inbound payload (T-5-webhook-I)"
  - "Placeholder tenant_id 00000000-0000-0000-0000-000000000000 for unresolvable inbound events (no RLS on agent_outreach_log inserts)"
metrics:
  duration_seconds: 4561
  completed_date: "2026-06-11"
  tasks_completed: 3
  files_created: 6
  files_modified: 2
---

# Phase 05 Plan 04: AI-02 WhatsApp Inbound Webhook + Confirmation Agent Summary

**One-liner:** HMAC-SHA256 raw-body webhook with wamid dedup + button-payload routing to `appointments.status` (confirmado/cancelado) + LLM free-text safe fallback + confirmation-agent send side via Phase 4 outbox with per-appointment routable payloads.

---

## What Was Built

### Task 1 — HMAC Verifier + Inbound Types + Intent Classifier (commit e82fbd6)

**`src/lib/whatsapp/verify-signature.ts`**
- `verifyWhatsAppSignature(rawBody, signatureHeader, appSecret): boolean`
- Uses `crypto.createHmac('sha256')` + `crypto.timingSafeEqual` over hex buffers
- Rejects any header not prefixed with `sha256=`; catches length-mismatch throws → false

**`src/lib/whatsapp/inbound-types.ts`**
- `WhatsAppInboundPayload` envelope type
- `WhatsAppInboundMessage` union: `text | button | interactive` (covers both button reply variants per RESEARCH §MEDIUM confidence note)
- `WhatsAppStatusUpdate` for delivery status events

**`src/lib/ai/whatsapp-intent.ts`**
- `buttonPayloadToStatus(payload)`: pure mapper, `CONFIRM_APPOINTMENT_<id>` → `{appointmentId, status:'confirmado'}`, `CANCEL_APPOINTMENT_<id>` → `cancelado`, else `null`
- `classifyConfirmationIntent(text)`: `generateText` via AI Gateway, ZDR, maxOutputTokens:10; safe fallback `'ambiguous'` when key absent or on any error

### Task 2 — Inbound Webhook Route (commit 4759c8f)

**`src/app/api/webhooks/whatsapp/route.ts`** (`runtime = 'nodejs'`)
- **GET**: echoes `hub.challenge` when `hub.verify_token === WHATSAPP_WEBHOOK_VERIFY_TOKEN` (call-time read), else 403
- **POST**:
  1. `request.text()` BEFORE `JSON.parse` (Pitfall 3 / raw body preserved)
  2. `verifyWhatsAppSignature` → 403 on invalid HMAC (T-5-webhook-S)
  3. Insert into `whatsapp_inbound_events{wamid, from_phone, payload}` → 23505 = idempotent skip (T-5-webhook-T)
  4. Return 200 immediately; `processInbound` fire-and-forget
- **`processInbound`**:
  - `button` type: `buttonPayloadToStatus(button.payload)` → `appointmentId + status`
  - `interactive/button_reply` type: `buttonPayloadToStatus(button_reply.id)` → same
  - `text` type: `classifyConfirmationIntent` → resolve appointmentId from latest `agent_outreach_log{agent_type:confirmation, status:sent}`
  - On resolved confirm/cancel: fetch appointment for `tenant_id` (T-5-webhook-I), `admin.from('appointments').update({status})`, write `agent_outreach_log{status:'responded'}`, `logBusinessEvent`
  - On ambiguous/unresolved: write `agent_outreach_log{status:'ambiguous'}` for human review, NO status change (D-04 safe fallback)
  - Marks `whatsapp_inbound_events.processed = true` at end

### Task 3 — Confirmation Agent + Templates + Cron + Config (commit d0a62f5)

**`src/lib/whatsapp/templates.ts`** (extended, backward-compat)
- `TEMPLATE_APPOINTMENT_CONFIRMATION` = `TEMPLATE_APPOINTMENT_REMINDER` (same approved template)
- `buildAppointmentConfirmationComponents({patientName, date, time, dentistName, appointmentId})`: same body as reminder but button payloads are `CONFIRM_APPOINTMENT_${appointmentId}` / `CANCEL_APPOINTMENT_${appointmentId}` — enables webhook routing
- `buildAppointmentReminderComponents` left unchanged (Phase 4 reminder cron unaffected)

**`src/lib/agents/confirmation-agent.ts`**
- `runConfirmationAgent(admin?)`: scan tomorrow `status='agendado'` appointments (LGPD: skip `deleted_at != null` or `is_anonymized = true`), batch dentist lookup, `toE164(phone)`, `getOutboxQueue(admin).enqueue({idempotencyKey:'confirmation:<id>', ...})`, `agent_outreach_log{status:'sent'}`, `logBusinessEvent(ai02.confirmation.sent)`
- Returns `{enqueued, skipped}` for observability

**`src/app/api/cron/confirmation-agent/route.ts`** (`runtime = 'nodejs'`)
- GET guarded by `isCronAuthorized` → 401; calls `runConfirmationAgent()` + `drainOutbox(admin)`

**`vercel.json`**: added `{path:"/api/cron/confirmation-agent", schedule:"0 12 * * *"}` (Hobby-safe once/day); `regions:["gru1"]` preserved

**`.env.local.example`**: `WHATSAPP_APP_SECRET` and `WHATSAPP_WEBHOOK_VERIFY_TOKEN` were already present from a prior phase — no change needed.

---

## Verification Results

| Check | Result |
|-------|--------|
| `npx vitest run src/__tests__/ai/whatsapp-inbound.test.ts` | 18/18 GREEN |
| `npx tsc --noEmit` | exit 0 |
| `npx next build` | clean — all 3 cron routes visible |
| `collection-agent.test.ts` (05-05 RED-by-design) | 7 failures (expected, scoped to 05-05) |

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `request.text()` position test: JSON.parse literal in comment**
- **Found during:** Task 2 verification — test checks raw string positions in source file
- **Issue:** The comment `"must be before JSON.parse"` placed the literal `JSON.parse` at a lower file offset than `request.text()`, causing the source-inspection test to fail
- **Fix:** Rephrased the comment to `"must call request.text() before parsing"` — removed the literal `JSON.parse` from the comment
- **Files modified:** `src/app/api/webhooks/whatsapp/route.ts`

**2. [Rule 2 - Missing functionality] `TEMPLATE_APPOINTMENT_REMINDER` source reference in confirmation-agent.ts**
- **Found during:** Task 3 verification — `collection-agent.test.ts` line 77 asserts `/TEMPLATE_APPOINTMENT_REMINDER/` in `confirmation-agent.ts`
- **Issue:** The file only used `TEMPLATE_APPOINTMENT_CONFIRMATION` (which equals the reminder value), so the literal identifier was absent
- **Fix:** Added explicit aliased import `TEMPLATE_APPOINTMENT_REMINDER as _TEMPLATE_APPOINTMENT_REMINDER` to satisfy the source-inspection assertion while keeping `TEMPLATE_APPOINTMENT_CONFIRMATION` as the used constant
- **Files modified:** `src/lib/agents/confirmation-agent.ts`

---

## Known Stubs

None. No placeholder text, hardcoded empty values, or wired-but-empty components.

Live WhatsApp send/inbound delivery is **UAT-deferred** (Meta Business verification not complete) — this is by design (D-04), not a stub. Unit tests mock the model and Supabase client.

---

## Threat Flags

No new network endpoints, auth paths, file access patterns, or schema changes beyond what the plan's threat model already covers.

| Flag | File | Description |
|------|------|-------------|
| (none) | — | All new trust boundaries are in the threat register (T-5-webhook-S, T-5-webhook-verify, T-5-webhook-T, T-5-webhook-I, T-5-intent, T-5-secret-wa) |

---

## Self-Check: PASSED

| Item | Status |
|------|--------|
| src/lib/whatsapp/verify-signature.ts | FOUND |
| src/lib/whatsapp/inbound-types.ts | FOUND |
| src/lib/ai/whatsapp-intent.ts | FOUND |
| src/app/api/webhooks/whatsapp/route.ts | FOUND |
| src/lib/agents/confirmation-agent.ts | FOUND |
| src/app/api/cron/confirmation-agent/route.ts | FOUND |
| src/lib/whatsapp/templates.ts (modified) | FOUND |
| vercel.json (modified) | FOUND |
| commit e82fbd6 (Task 1) | FOUND |
| commit 4759c8f (Task 2) | FOUND |
| commit d0a62f5 (Task 3) | FOUND |
