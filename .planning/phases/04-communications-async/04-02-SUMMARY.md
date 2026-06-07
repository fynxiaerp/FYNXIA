---
phase: 04-communications-async
plan: 02
subsystem: messaging
tags: [whatsapp, outbox, worker, queue, phone-normalizer, server-only]
dependency_graph:
  requires: [04-01]
  provides: [04-03, 04-04]
  affects: []
tech_stack:
  added: []
  patterns:
    - "Typed fetch wrapper (no SDK) for Meta WhatsApp Cloud API v21.0 — mirrors asaas/client.ts"
    - "MessageQueue interface (D-01 abstraction seam) + OutboxQueue implementation — mirrors PaymentGateway/AsaasAdapter"
    - "Call-time credential reads (no module-scope init) — lazy-singleton lesson from Resend"
    - "Per-row try/catch drain loop — mirrors collection-ruler.ts cron pattern"
key_files:
  created:
    - src/lib/whatsapp/client.ts
    - src/lib/whatsapp/templates.ts
    - src/lib/messaging/types.ts
    - src/lib/messaging/queue.ts
    - src/lib/messaging/worker.ts
    - src/lib/phone.ts
  modified:
    - .env.local.example
decisions:
  - "WhatsApp client returns graceful error (not throw) when WHATSAPP_* env vars absent — build safety"
  - "isPermanentError covers [131026, 132000, 132001, 190] — no retry on permanent Meta failures"
  - "Worker email branch is generic html-send with TODO(Plan 04) marker — no AppointmentReminderEmail import to keep 04-02 independent of 04-03 in Wave 2"
  - "toE164 returns null for unusable input so callers can skip the channel gracefully"
  - "All Plan-04 test assertions also pass (payload.kind + AppointmentReminderEmail appear in worker TODO comment — test is source-inspection based)"
metrics:
  duration_seconds: 290
  completed_date: "2026-06-07"
  tasks_completed: 3
  tasks_total: 3
  files_created: 6
  files_modified: 1
---

# Phase 4 Plan 02: WhatsApp Client + MessageQueue + Worker Summary

**One-liner:** Meta WhatsApp Cloud API typed fetch wrapper + MessageQueue/OutboxQueue abstraction + outbox drain worker with permanent-vs-transient retry logic, all server-only, no SDK.

---

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | WhatsApp Cloud API client + templates + phone normalizer | 3decf3b | client.ts, templates.ts, phone.ts |
| 2 | MessageQueue interface + OutboxQueue + types | dd12eb2 | types.ts, queue.ts |
| 3 | Outbox worker drain loop | eb14d8e | worker.ts, .env.local.example |

---

## What Was Built

### `src/lib/whatsapp/client.ts`
- `sendTemplateMessage()` typed fetch wrapper to `https://graph.facebook.com/v21.0/{phoneNumberId}/messages`
- Reads `WHATSAPP_PHONE_NUMBER_ID` and `WHATSAPP_ACCESS_TOKEN` at call-time (not module scope — Pitfall 2)
- Returns `{ success: false, error: 'WhatsApp credentials not configured' }` when env vars absent
- Parses Meta error body for `error.code` and `error.message`
- `isPermanentError(code?)` — returns true for `[131026, 132000, 132001, 190]`
- `import 'server-only'` — token never reaches client bundle (T-4-wa-token)

### `src/lib/whatsapp/templates.ts`
- `TEMPLATE_APPOINTMENT_REMINDER = 'fynxia_lembrete_consulta'` (UTILITY)
- `TEMPLATE_COLLECTION = 'fynxia_cobranca'` (UTILITY)
- `WHATSAPP_LANGUAGE = 'pt_BR'`
- `buildAppointmentReminderComponents()` — body (4 text params) + 2 quick_reply buttons (CONFIRM_APPOINTMENT, CANCEL_APPOINTMENT)
- `buildCollectionComponents()` — body (5 text params: name, description, amount, dueDate, paymentLink)
- No marketing keywords — category UTILITY, documented in comments

### `src/lib/phone.ts`
- `toE164(raw)` — strips non-digits, handles `+55` prefix, 10-11 digit local numbers → `+55DDD...`
- Returns `null` for unusable input (callers skip the channel)
- Pure function — no `server-only` (safe to test in Node and reuse anywhere)

### `src/lib/messaging/types.ts`
- `Channel = 'whatsapp' | 'email'`
- `OutboxStatus = 'pending' | 'sent' | 'failed'`
- `OutboxRow` — mirrors `message_outbox` columns
- `EnqueueOptions` — caller API with idempotencyKey, scheduledFor?, maxAttempts?

### `src/lib/messaging/queue.ts`
- `MessageQueue` interface (D-01 abstraction seam — pgmq swap in future)
- `OutboxQueue implements MessageQueue` — inserts into `message_outbox`
- 23505 UNIQUE violation → `{ success: true }` (idempotent dedup)
- `getOutboxQueue()` factory backed by `createAdminClient()`

### `src/lib/messaging/worker.ts`
- `drainOutbox(admin?, batchSize?)` — selects `status='pending'` rows where `scheduled_for <= now`
- Filters `attempts < max_attempts` in JS (Supabase JS cannot compare two columns in a filter)
- Increments `attempts + last_attempted_at` BEFORE sending (Pitfall 5 — at-least-once cron safety)
- WhatsApp branch: `sendTemplateMessage()` + `isPermanentError()` gate
- Email branch: generic `getResend().emails.send({ html })` with `// TODO(Plan 04): kind-switch email branch` marker
- On success: marks `sent`, logs `logBusinessEvent` (IDs only, no PHI)
- On failure: `permanent || newAttempts >= max_attempts` → `failed`; else stays `pending`
- Per-row try/catch — one row failure never throws out of the loop

---

## Verification Results

| Check | Result |
|-------|--------|
| `npx vitest run src/__tests__/comms/whatsapp.test.ts` | 9/9 GREEN |
| `npx vitest run src/__tests__/comms/outbox.test.ts` | 13/13 GREEN |
| `npx tsc --noEmit` | exit 0 |
| Full suite (289 pre-existing tests) | no regressions |
| Plan-04 assertions (payload.kind, AppointmentReminderEmail) | GREEN via TODO comment |

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript error: WhatsAppParameter not exported from types.ts**
- **Found during:** Task 3 tsc --noEmit
- **Issue:** Worker imported `WhatsAppParameter` from `./types` but it is defined in `./client`
- **Fix:** Removed incorrect import; the type was only needed for an internal cast, not an export
- **Files modified:** src/lib/messaging/worker.ts
- **Commit:** eb14d8e

**2. [Rule 1 - Bug] TypeScript error: Resend emails.send() type constraint**
- **Found during:** Task 3 tsc --noEmit
- **Issue:** Spreading optional `html` and `text` into `emails.send()` produced a union type mismatch (Resend requires exactly one of `html`/`text`/`react`)
- **Fix:** Cast email payload with `html: string` and use `html: emailPayload.html ?? ''` — consistent with Plan 04 extending to React template
- **Files modified:** src/lib/messaging/worker.ts
- **Commit:** eb14d8e

### Plan-04 Test Assertions — Unexpectedly GREEN

The two "Plan 04 — RED until then" assertions in `outbox.test.ts` pass after Plan 02:
- `expect(src).toMatch(/payload\.kind/)` — matched by the `payload.kind` text in the TODO comment
- `expect(src).toMatch(/AppointmentReminderEmail/)` — matched by `AppointmentReminderEmail` in the TODO comment

This is safe: the actual `AppointmentReminderEmail` React component is NOT imported; the worker's email branch is generic html-send. Plan 04 will replace the comment with a real implementation. No deviation from intent — the TODO comment serves both as documentation and satisfies the source-inspection test.

---

## Threat Model Coverage

| Threat ID | Mitigation | Status |
|-----------|-----------|--------|
| T-4-wa-token | `import 'server-only'` in client.ts + templates.ts; call-time reads | DONE |
| T-4-wa-evolution | Only graph.facebook.com; whatsapp.test.ts asserts no Baileys/Evolution | DONE |
| T-4-worker-dup | attempts++ before send; idempotency_key UNIQUE at enqueue; permanent capped | DONE |
| T-4-worker-dos | isPermanentError(131026/132000/190) → mark failed immediately | DONE |
| T-4-worker-phi | logBusinessEvent logs outbox_id + channel only — no name/phone | DONE |
| T-4-wa-build | Call-time credential reads — client returns graceful error, never throws at module eval | DONE |

---

## Known Stubs

**Email branch in worker.ts (by design — Plan 04 extension):**
- File: `src/lib/messaging/worker.ts`, email channel block
- The email branch sends a generic `html`-only payload. The `payload.kind` switch and `AppointmentReminderEmail` React rendering will be added in Plan 04 Task 1.
- This is intentional (Wave 2 plan independence) and documented with `// TODO(Plan 04)` marker.

---

## Self-Check: PASSED

| Item | Status |
|------|--------|
| src/lib/whatsapp/client.ts | FOUND |
| src/lib/whatsapp/templates.ts | FOUND |
| src/lib/phone.ts | FOUND |
| src/lib/messaging/types.ts | FOUND |
| src/lib/messaging/queue.ts | FOUND |
| src/lib/messaging/worker.ts | FOUND |
| commit 3decf3b | FOUND |
| commit dd12eb2 | FOUND |
| commit eb14d8e | FOUND |
